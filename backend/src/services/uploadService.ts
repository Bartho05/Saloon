import multer from 'multer';
import { AppError } from '@middlewares/errorHandler';
import { storage, type ImageKind } from '@services/imageStorage';

/**
 * Recebimento de imagens.
 *
 * ── Por que memória, e não disco temporário ─────────────────────────────────
 *
 * A primeira versão gravava num arquivo temporário e depois movia para o
 * diretório final. Isso existia porque o destino era o disco, e mover arquivo é
 * grátis no mesmo disco.
 *
 * Guardar em memória elimina o arquivo temporário inteiro: uma etapa a menos,
 * uma classe de erro a menos (o `rename` falhando), e o mesmo caminho de código
 * em desenvolvimento e em produção. O custo é 4MB na heap por upload, o que é
 * irrelevante para um sistema que recebe uma foto de rosto por vez.
 *
 * O destino final não é mais uma decisão deste arquivo: quem sabe é
 * `imageStorage`, que escolhe entre disco e Supabase conforme a configuração.
 */

/** MIME permitidos. A lista fecha a porta antes de gastar banda e memória. */
const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Arquivos aceitos, exposto para a validação do lado do servidor.
 *
 * O front e o back precisam concordar: um JPEG aceito no navegador e recusado
 * pelo servidor vira "a foto não subiu" sem explicação.
 */
export const EXTENSAO_POR_MIME = ALLOWED;

/**
 * Multer em memória.
 *
 * `fileFilter` antes de `limits` de propósito: um arquivo de 50MB é barrado
 * pelo MIME sem nunca ser lido. Ao contrário, sem o filtro, o limite de tamanho
 * só age depois de o arquivo inteiro estar na memória.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
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

/**
 * Guarda a imagem e devolve a URL pública.
 *
 * `Async` porque o destino pode ser a rede: no Supabase Storage, isto é uma
 * requisição HTTP que pode demorar ou falhar. A interface já era assíncrona
 * desde o começo, então a troca aconteceu sem propagar nada para os chamadores.
 */
export async function persistImage(
  dados: Buffer,
  kind: ImageKind,
  prefix: string,
  mimeType: string
): Promise<string> {
  return storage().salva(dados, kind, prefix, mimeType);
}

/**
 * Remove uma imagem anterior, se existir.
 *
 * Silencioso por desenho: quando o dono troca a foto, apagar a antiga é
 * limpeza, e falhar nisso não pode impedir o cadastro de funcionar. Sem
 * tratamento, uma imagem já removida do Storage derrubaria a troca de foto.
 */
export async function removeImage(publicUrl: string | null | undefined): Promise<void> {
  await storage().remove(publicUrl);
}

export type { ImageKind };
