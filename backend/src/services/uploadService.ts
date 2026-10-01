import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import multer from 'multer';
import { AppError } from '@middlewares/errorHandler';

/**
 * Upload de imagens para o disco local, servido por express.static.
 *
 * Por que disco e não base64 no banco: uma foto de rosto tem ~200KB e um
 * logo ~100KB. Guardar no Postgres enche a tabela sem necessidade e deixa
 * toda listagem de funcionário pesada. No disco, o arquivo vira uma URL.
 *
 * Em produção com mais de uma instância, trocar por Supabase Storage ou
 * S3 mantendo a mesma interface (save → string URL).
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

export const UPLOAD_DIRS = {
  salon: path.join(UPLOAD_ROOT, 'salon'),
  employees: path.join(UPLOAD_ROOT, 'employees'),
} as const;

for (const dir of Object.values(UPLOAD_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

/** MIME permitidos + extensões correspondentes. */
const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // o destino final depende da rota; cada rota cria seu próprio storage
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      cb(
        new AppError(
          'Formato não aceito. Envie JPEG, PNG ou WEBP.',
          400,
          'UNSUPPORTED_IMAGE_TYPE'
        )
      );
      return;
    }
    cb(null, true);
  },
});

/** Move o arquivo temporário para o diretório final e devolve a URL pública. */
export function persistImage(
  tmpPath: string,
  kind: keyof typeof UPLOAD_DIRS,
  prefix: string
): string {
  const dir = UPLOAD_DIRS[kind];
  const ext = path.extname(tmpPath) || '.jpg';
  const filename = `${prefix}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  fs.renameSync(tmpPath, path.join(dir, filename));

  return `/uploads/${kind}/${filename}`;
}

/**
 * Remove uma imagem anterior, se existir.
 * Só apaga arquivos dentro de uploads/ — protege contra path traversal caso
 * o banco seja adulterado.
 */
export function removeImage(publicUrl: string | null | undefined): void {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;

  const relative = publicUrl.replace('/uploads/', '');
  const target = path.resolve(UPLOAD_ROOT, relative);

  // não deixa escapar de uploads/
  if (!target.startsWith(UPLOAD_ROOT)) return;

  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (err) {
    console.warn('Não foi possível remover imagem antiga:', err);
  }
}

export { UPLOAD_ROOT };
