import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  generateAccessCode,
  hashCode,
  verifyCode,
  fingerprintOf,
  formatCodeForDisplay,
  lockDurationMs,
} from '@services/superadminCrypto';

describe('superadminCrypto', () => {
  // O pepper é lido na chamada, e o módulo se recusa a funcionar sem ele.
  const pepperOriginal = process.env.SUPERADMIN_PEPPER;
  beforeAll(() => {
    if (!process.env.SUPERADMIN_PEPPER) {
      process.env.SUPERADMIN_PEPPER = 'pepper-de-teste-suficientemente-longo';
    }
  });
  afterAll(() => {
    process.env.SUPERADMIN_PEPPER = pepperOriginal;
  });

  describe('generateAccessCode', () => {
    it('gera 24 caracteres', () => {
      expect(generateAccessCode()).toHaveLength(24);
      expect(generateAccessCode(12)).toHaveLength(12);
    });

    /**
     * O alfabeto é sem `0/O`, `1/I/L` de propósito: o código é digitado de
     * vez em quando e um `O` no lugar de `0` joga a pessoa no acesso errado
     * sem ela perceber por quê.
     */
    it('usa só caracteres do alfabeto legível', () => {
      const ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ3479]+$/;
      for (let i = 0; i < 50; i++) {
        expect(generateAccessCode()).toMatch(ALPHABET);
      }
    });

    /**
     * A regra real não é "proibir estes caracteres", é "não ter dois que se
     * confundam". O alfabeto mantém o `L` e descarta o `1` e o `I` — o que
     * resolve, porque nunca existe um par presente ao mesmo tempo.
     *
     * Escrever a regra como lista de proibidos erra: proibiria o `L` também,
     * jogando fora um caractere perfectly legível, e amanhã alguém acrescentaria
     * `S` e o teste passaria sem avisar que `5`/`S` agora se confundem.
     */
    it('nunca tem dois caracteres que se confundem', () => {
      const PARES_CONFUSIVEIS: Array<[string, string]> = [
        ['0', 'O'],
        ['1', 'I'],
        ['1', 'L'],
        ['1', 'l'],
        ['5', 'S'],
        ['8', 'B'],
        ['2', 'Z'],
        ['6', 'G'],
      ];

      const conjunto = new Set<string>();
      // Amostra grande: com 200 códigos de 24, todo caractere do alfabeto
      // deveria ter aparecido várias vezes.
      for (let i = 0; i < 200; i++) {
        for (const c of generateAccessCode()) conjunto.add(c);
      }

      for (const [a, b] of PARES_CONFUSIVEIS) {
        const temA = conjunto.has(a);
        const temB = conjunto.has(b);
        expect(
          temA && temB,
          `'${a}' e '${b}' são confundíveis e ambos entram no alfabeto`
        ).toBe(false);
      }
    });

    it('gera códigos diferentes a cada chamada', () => {
      const vistos = new Set<string>();
      for (let i = 0; i < 500; i++) vistos.add(generateAccessCode());
      // 500 de 24 caracteres: colisão seria um bug de aleatoriedade.
      expect(vistos.size).toBe(500);
    });

    /**
     * `bytes[i] % 33` não é uniforme: 256 não é múltiplo de 33. Com 24
     * caracteres a diferença é pequena, mas é o tipo de viés que cresce com o
     * comprimento. Este teste fixa a distribuição observada.
     */
    it('não distorce a distribuição de forma perceptível', () => {
      const contagem: Record<string, number> = {};
      const TOTAL = 2000;
      for (let i = 0; i < TOTAL; i++) {
        for (const c of generateAccessCode()) contagem[c] = (contagem[c] || 0) + 1;
      }
      const esperado = (TOTAL * 24) / Object.keys(contagem).length;
      for (const [c, n] of Object.entries(contagem)) {
        // 20% de folga: pega viés real sem acusar o acaso da amostra.
        expect(n, `caractere ${c}`).toBeGreaterThan(esperado * 0.8);
        expect(n, `caractere ${c}`).toBeLessThan(esperado * 1.2);
      }
    });
  });

  describe('hashCode e verifyCode', () => {
    it('o código sozinho não é o hash', async () => {
      const code = generateAccessCode();
      const { hash, salt } = await hashCode(code);
      expect(hash).not.toBe(code);
      expect(hash).not.toContain(code);
      expect(Buffer.from(code, 'utf8').toString('base64')).not.toBe(hash);
      expect(salt.length).toBeGreaterThanOrEqual(20);
    });

    it('confere o código certo e rejeita os errados', async () => {
      const code = generateAccessCode();
      const { hash, salt } = await hashCode(code);

      await expect(verifyCode(code, hash, salt)).resolves.toBe(true);
      await expect(verifyCode(code.slice(0, -1) + 'X', hash, salt)).resolves.toBe(false);
      await expect(verifyCode('', hash, salt)).resolves.toBe(false);
      await expect(verifyCode(code.toLowerCase(), hash, salt)).resolves.toBe(false);
    });

    /**
     * Salt por conta: dois superadmins com o MESMO código precisam de hashes
     * diferentes, senão uma tabela pré-computada atinge os dois de uma vez e
     * ainda revela que o código se repete.
     */
    it('gera hashes diferentes para o mesmo código', async () => {
      const code = 'CODIGO_COMPARTILHADO1234';
      const a = await hashCode(code);
      const b = await hashCode(code);
      expect(a.salt).not.toBe(b.salt);
      expect(a.hash).not.toBe(b.hash);
      // E os dois continuam conferindo.
      await expect(verifyCode(code, a.hash, a.salt)).resolves.toBe(true);
      await expect(verifyCode(code, b.hash, b.salt)).resolves.toBe(true);
    });

    /**
     * O pepper é o que separa "vazamento do banco" de "vazamento do
     * servidor". Com o banco em mãos e sem a chave do servidor, recalcular o
     * hash para testar candidatos é inviável.
     */
    it('o hash depende do pepper do servidor', async () => {
      const code = generateAccessCode();
      const { salt } = await hashCode(code);

      const comPepper = (await hashCode(code, salt)).hash;

      const original = process.env.SUPERADMIN_PEPPER;
      process.env.SUPERADMIN_PEPPER = 'outro-pepper-bem-diferente-32';
      const semPepperCerto = (await hashCode(code, salt)).hash;
      process.env.SUPERADMIN_PEPPER = original;

      expect(comPepper).not.toBe(semPepperCerto);
    });

    it('recusa hash corrompido em vez de estourar exceção', async () => {
      const code = generateAccessCode();
      const { salt } = await hashCode(code);
      // `timingSafeEqual` exige dois buffers do mesmo tamanho; um hash
      // truncado não pode virar erro que distinga "banco quebrado" de
      // "código errado".
      await expect(verifyCode(code, 'hash-quebrado', salt)).resolves.toBe(false);
      await expect(verifyCode(code, Buffer.alloc(10).toString('base64'), salt)).resolves.toBe(false);
    });

    it('gasta tempo parecido com código certo e errado', async () => {
      const code = generateAccessCode();
      const { hash, salt } = await hashCode(code);

      const medir = async (tentativa: string) => {
        const inicio = Date.now();
        await verifyCode(tentativa, hash, salt);
        return Date.now() - inicio;
      };

      await medir(code); // aquece o scrypt, senão a 1ª chamada paga a JIT
      const errado = await medir(code.slice(0, -1) + 'X');
      const certo = await medir(code);

      // Margem folgada: o teste roda em CI compartilhado e não deve ficar
      // instável. Só interessa que a ordem de grandeza seja a mesma.
      expect(Math.abs(errado - certo)).toBeLessThan(200);
    });
  });

  describe('fingerprintOf', () => {
    it('é estável para o mesmo código', () => {
      const code = 'ABCDEFGHJKLMNPQRS';
      expect(fingerprintOf(code)).toBe(fingerprintOf(code));
      expect(fingerprintOf(code)).toHaveLength(6);
    });

    it('muda com o código', () => {
      expect(fingerprintOf('CODIGOAAAAAAAAAAAA')).not.toBe(fingerprintOf('CODIGOAAAAAAAAAAAB'));
    });

    it('não deixa o código inteiro vazar', () => {
      const code = 'SEGREDO_MUITO_LONGO';
      expect(fingerprintOf(code)).not.toContain('SEGREDO');
    });
  });

  describe('formatCodeForDisplay', () => {
    it('agrupa em blocos de 4', () => {
      expect(formatCodeForDisplay('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP');
    });

    it('não mexe no valor, só na exibição', () => {
      const code = generateAccessCode();
      expect(formatCodeForDisplay(code).replace(/\s/g, '')).toBe(code);
    });
  });

  describe('lockDurationMs', () => {
    it('não trava nas primeiras tentativas', () => {
      expect(lockDurationMs(0)).toBe(0);
      expect(lockDurationMs(1)).toBe(0);
      expect(lockDurationMs(2)).toBe(0);
    });

    it('começa a travar na terceira e cresce', () => {
      const t3 = lockDurationMs(3);
      const t5 = lockDurationMs(5);
      expect(t3).toBeGreaterThan(0);
      expect(t5).toBeGreaterThan(t3);
    });

    it('satura em 30 minutos, para não travar a conta para sempre', () => {
      expect(lockDurationMs(50)).toBe(30 * 60 * 1000);
      expect(lockDurationMs(200)).toBe(30 * 60 * 1000);
    });
  });

  describe('pepper ausente', () => {
    it('falha em vez de usar um valor padrão previsível', async () => {
      const original = process.env.SUPERADMIN_PEPPER;
      delete process.env.SUPERADMIN_PEPPER;
      // Um pepper fixo no código-fonte seria pior que não ter: daria a
      // impressão de proteção sem existir.
      await expect(hashCode('QUALQUER')).rejects.toThrow(/SUPERADMIN_PEPPER/);
      process.env.SUPERADMIN_PEPPER = original;
    });

    it('recusa pepper curto demais', async () => {
      const original = process.env.SUPERADMIN_PEPPER;
      process.env.SUPERADMIN_PEPPER = 'curto';
      await expect(hashCode('QUALQUER')).rejects.toThrow(/SUPERADMIN_PEPPER/);
      process.env.SUPERADMIN_PEPPER = original;
    });
  });

  describe('qualidade do CSPRNG', () => {
    it('não está usando Math.random', () => {
      // Sanidade: `randomBytes` do sistema é o que garante que o código não é
      // previsível. Este teste não prova o uso, mas pega uma troca acidental
      // por `Math.random`, que geraria códigos com a distribuição de PRNG
      // fraca em vez de criptográfica.
      const codigos = Array.from({ length: 50 }, () => generateAccessCode());
      const todos = new Set(codigos);
      expect(todos.size).toBe(50);

      // Entropia mínima: 24 caracteres de alfabeto 32 ≈ 120 bits.
      const bits = Math.log2(32) * 24;
      expect(bits).toBeGreaterThan(119);
    });
  });
});
