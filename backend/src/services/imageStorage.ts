import crypto from 'node:crypto';
import { env } from '@config/env';

/**
 * Onde as imagens ficam.
 *
 * ── Por que isto é uma abstração e não uma escolha ──────────────────────────
 *
 * Em desenvolvimento, disco local. É simples, é rápido e a imagem aparece em
 * `http://localhost:3000/uploads/...`.
 *
 * Em produção, nada disso funciona. O Vercel roda funções serverless sem disco:
 * o sistema de arquivos é somente leitura, exceto `/tmp`, e o `/tmp` é por
 * instância. Uma foto enviada para a instância A não existe para a instância B,
 * e as duas podem responder requisições diferentes do mesmo cliente.
 *
 * O sintoma disso em produção é o pior possível: a tela mostra "enviado com
 * sucesso", o banco grava a URL, e a imagem aparece quebrada para todo mundo.
 * Nenhum erro, nenhuma exceção, nenhuma pista.
 *
 * Por isso a interface é a mesma nos dois casos e a escolha é feita na
 * configuração. O resto do sistema chama `salva()` e recebe uma URL, sem saber
 * nem querer saber onde o arquivo está.
 *
 * ── Por que não base64 no banco ─────────────────────────────────────────────
 *
 * Tentado e descartado: uma foto de rosto tem ~200KB em base64, e a tabela de
 * profissionais é lida em toda tela de agenda. Guardar bytes em linha de banco
 * deixa cada listagem pesada sem necessidade nenhuma.
 */

export type ImageKind = 'salon' | 'employees';

/** O que o resto do sistema precisa saber. Nada além disso. */
export interface ImageStorage {
  /** Recebe os bytes, devolve a URL pública. */
  salva(dados: Buffer, kind: ImageKind, prefix: string, mimeType: string): Promise<string>;
  /** Apaga pela URL pública. Silencioso se não existir. */
  remove(publicUrl: string | null | undefined): Promise<void>;
}

const EXTENSAO: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function extensaoDe(mimeType: string): string {
  return EXTENSAO[mimeType] ?? '.jpg';
}

/** Nome aleatório. O prefixo (id do profissional) ajuda a localizar depois. */
function geraNome(prefix: string, mimeType: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}${extensaoDe(mimeType)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Disco local — desenvolvimento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guardar no disco é feito por um módulo separado, e só por `require`.
 *
 * O motivo é o bundle: em produção, no Vercel, este arquivo nunca é carregado —
 * e `import fs from 'node:fs'` no topo do módulo o carregaria, junto com o
 * módulo que faz o `mkdirSync` do diretório. Criar diretório no import de um
 * arquivo que não será usado é o tipo de coisa que só quebra em produção.
 */
function implementacaoDisco(): ImageStorage {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('node:path') as typeof import('node:path');

  const raiz = path.resolve(process.cwd(), 'uploads');
  const dirDe = (kind: ImageKind) => path.join(raiz, kind);

  for (const kind of ['salon', 'employees'] as ImageKind[]) {
    fs.mkdirSync(dirDe(kind), { recursive: true });
  }

  return {
    async salva(dados, kind, prefix, mimeType) {
      const filename = geraNome(prefix, mimeType);
      fs.writeFileSync(path.join(dirDe(kind), filename), dados);
      return `/uploads/${kind}/${filename}`;
    },

    async remove(publicUrl) {
      if (!publicUrl?.startsWith('/uploads/')) return;

      const alvo = path.resolve(raiz, publicUrl.replace('/uploads/', ''));

      // Impede que um banco adulterado apague arquivo fora de uploads/.
      if (!alvo.startsWith(raiz)) return;

      try {
        if (fs.existsSync(alvo)) fs.unlinkSync(alvo);
      } catch (err) {
        console.warn('Não foi possível remover imagem antiga:', err);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage — produção
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supabase Storage pela API REST, sem SDK.
 *
 * A API é um `POST` com a `service_role` e o caminho do objeto no corpo. Trazer
 * o `@supabase/supabase-js` inteiro — centenas de KB e uma árvore de
 * dependências — para fazer duas requisições HTTP seria trocar uma
 * dependência por um problema de manutenção.
 *
 * A `service_role` é a chave de administração. Ela burla as políticas de
 * acesso do bucket, e por isso NUNCA vai para o frontend: fica só em variável
 * de ambiente do servidor, que o Vercel guarda criptografada.
 */
function implementacaoSupabase(): ImageStorage {
  const base = env.SUPABASE_URL!.replace(/\/+$/, '');
  const bucket = env.SUPABASE_STORAGE_BUCKET!;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY!;

  async function chama(metodo: string, caminho: string, corpo?: Buffer): Promise<Response> {
    return fetch(`${base}/storage/v1/object/${bucket}/${caminho}`, {
      method: metodo,
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        ...(corpo ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      body: corpo ? new Uint8Array(corpo) : undefined,
    });
  }

  return {
    async salva(dados, kind, prefix, mimeType) {
      const filename = geraNome(prefix, mimeType);
      const caminho = `${kind}/${filename}`;

      const res = await chama('POST', caminho, dados);

      if (!res.ok) {
        const detalhe = await res.text();
        // Erro legível, porque a mensagem padrão do Supabase ("Internal Error")
        // não diz se foi bucket errado, chave inválida ou arquivo grande demais.
        throw new Error(
          `Falha ao enviar a imagem para o Supabase Storage (${res.status}): ${detalhe.slice(0, 200)}`
        );
      }

      return storagePublicUrl(caminho);
    },

    async remove(publicUrl) {
      if (!publicUrl) return;

      // Só apaga o que for deste projeto. Uma URL de fora (imagem antiga que
      // pointed para outro lugar, por exemplo) é ignorada em vez de virar uma
      // tentativa de deletar objeto alheio.
      const caminho = caminhoDeUrl(publicUrl);
      if (!caminho) return;

      try {
        await chama('DELETE', caminho);
      } catch (err) {
        // Falha ao apagar a foto antiga é Cosmético: a nova já está no lugar.
        // Uma imagem órfã ocupa bytes; um erro aqui derrubaria o cadastro.
        console.warn('Não foi possível remover imagem antiga no Storage:', err);
      }
    },
  };
}

/** URL pública de um objeto, com cache longo: o nome tem hash, nunca é reusado. */
function storagePublicUrl(caminho: string): string {
  const base = env.SUPABASE_URL!.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${caminho}`;
}

/**
 * Extrai `kind/filename` de uma URL pública do Storage.
 *
 * Devolve `null` para o que não for do nosso bucket, e é esse `null` que impede
 * a remoção de tentar deletar algo de fora.
 */
function caminhoDeUrl(publicUrl: string): string | null {
  const prefixo = `/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`;
  const i = publicUrl.indexOf(prefixo);
  if (i < 0) return null;

  const caminho = publicUrl.slice(i + prefixo.length);
  // Sem isto, um `../../` no banco apontaria para outro objeto do bucket.
  if (!/^(salon|employees)\/[A-Za-z0-9._-]+$/.test(caminho)) return null;

  return caminho;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escolhe a implementação.
 *
 * O critério é "tenho as três credenciais?", e não "estou em produção?".
 * Testar a existência das variáveis permite rodar em `NODE_ENV=production` na
 * máquina de desenvolvimento — que é exatamente onde se descobre que a
 * configuração de produção está errada.
 */
function escolhe(): ImageStorage {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET) {
    return implementacaoSupabase();
  }
  return implementacaoDisco();
}

let instancia: ImageStorage | null = null;

/**
 * Raiz do disco local.
 *
 * Calculada sem `mkdir`: só o `express.static` precisa do caminho, e ele só é
 * montado quando não há Supabase configurado. Criar o diretório aqui
 * importaria o módulo em produção e derrubaria o servidor num sistema de
 * arquivos somente leitura.
 */
export const UPLOAD_ROOT_DISCO = 'uploads';

export function storage(): ImageStorage {
  instancia ??= escolhe();
  return instancia;
}

/**
 * Descarta a instância.
 *
 * Usado pelos testes e depois de salvar as configurações, para que uma mudança
 * de credencial não fique presa à implementação antiga até reiniciar.
 */
export function resetStorage(): void {
  instancia = null;
}

/** `true` quando as imagens estão indo para o Supabase. A tela mostra isso. */
export function usandoSupabase(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET);
}
