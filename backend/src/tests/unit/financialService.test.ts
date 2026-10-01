import { describe, it, expect } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import {
  resolvePeriod,
  resolveReference,
  buildSeries,
  type Period,
} from '@services/financialService';

const SALON = 'America/Sao_Paulo';

/**
 * Lê uma data no fuso do salão, de forma independente do fuso da máquina.
 *
 * Não usar `getDate()`/`getFullYear()` aqui: eles leem o fuso do PROCESSO. Numa
 * máquina em GMT-3, `getDate()` de 2026-10-01T00:00Z devolve 30 — o
 * deslocamento de fuso já está no número. Somar "-3h" para compensar
 * converte duas vezes e o teste passa a mentir.
 */
function noSalon(date: Date): { ano: number; mes: number; dia: number } {
  return {
    ano: Number(formatInTimeZone(date, SALON, 'yyyy')),
    mes: Number(formatInTimeZone(date, SALON, 'M')),
    dia: Number(formatInTimeZone(date, SALON, 'd')),
  };
}

/** Meia-noite local do salão, em UTC. */
function local(y: number, m: number, d: number, h = 0, min = 0): Date {
  const p = (n: number) => String(n).padStart(2, '0');
  return new Date(`${y}-${p(m)}-${p(d)}T${p(h)}:${p(min)}:00${offsetString()}`);
}

function offsetString(): string {
  // Derivado do próprio runtime: -03:00 em São Paulo.
  const minutos = -new Date('2026-01-15T12:00:00Z').getTimezoneOffset();
  const sinal = minutos < 0 ? '-' : '+';
  const abs = Math.abs(minutos);
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

describe('resolveReference', () => {
  /**
   * Regressão do bug mais silencioso do financeiro.
   *
   * O front manda o dia civil em "YYYY-MM-DD". `new Date("2026-10-01")` é
   * meia-noite UTC, que em São Paulo (UTC-3) é 30/09 às 21:00. Com isso o
   * financeiro do dia 1º do mês abria o mês ANTERIOR: o dono via
   * "Setembro de 2026" enquanto a agenda era de outubro, sem nenhum erro
   * aparecendo.
   */
  it('trata "YYYY-MM-DD" como o mesmo dia no fuso do salão', () => {
    const { ano, mes, dia } = noSalon(resolveReference('2026-10-01'));
    expect([ano, mes, dia]).toEqual([2026, 10, 1]);
  });

  it('não escorrega para o dia anterior em nenhum mês', () => {
    // Todos os primeiros dias de mês: é exatamente onde o deslize aparecia.
    for (const mes of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const iso = `2026-${String(mes).padStart(2, '0')}-01`;
      const lido = noSalon(resolveReference(iso));
      expect([lido.mes, lido.dia], `dia 1 de ${mes}`).toEqual([mes, 1]);
    }
  });

  it('aceita ISO completo e Date', () => {
    const deData = new Date('2026-05-20T15:00:00Z');
    expect(resolveReference('2026-05-20T15:00:00Z').getTime()).toBe(deData.getTime());
    expect(resolveReference(deData).getTime()).toBe(deData.getTime());
  });

  it('cai no fallback quando não há referência', () => {
    const agora = new Date();
    expect(resolveReference(undefined).getTime()).toBe(agora.getTime());
    expect(resolveReference(null).getTime()).toBe(agora.getTime());
    expect(resolveReference('').getTime()).toBe(agora.getTime());
    expect(resolveReference('lixo').getTime()).toBe(agora.getTime());
  });
});

describe('resolvePeriod', () => {
  it('resolve o dia pedido, não o dia anterior', () => {
    const { label } = resolvePeriod('day', '2026-10-01');
    expect(label).toContain('1 de outubro de 2026');
  });

  it('resolve o mês pedido pelo dia 1º', () => {
    const { label } = resolvePeriod('month', '2026-10-01');
    // Capitalizado de propósito: o rótulo é exibido como título.
    expect(label).toBe('Outubro de 2026');
  });

  it('resolve o ano pedido', () => {
    expect(resolvePeriod('year', '2026-10-01').label).toBe('2026');
    expect(resolvePeriod('year', '2025-03-09').label).toBe('2025');
  });

  it('o rótulo do dia sai em português', () => {
    const { label } = resolvePeriod('day', '2026-10-01');
    // Com date-fns sem locale o rótulo vinha "Thursday, 1 de October".
    expect(label).not.toMatch(/Thursday|October|January|February/);
  });

  it('o intervalo do mês cobre o mês inteiro, no fuso do salão', () => {
    const { start, end } = resolvePeriod('month', '2026-10-15');
    expect(noSalon(start)).toEqual({ ano: 2026, mes: 10, dia: 1 });
    expect(noSalon(end)).toEqual({ ano: 2026, mes: 10, dia: 31 });
  });

  it('o intervalo do ano vai de 1º de janeiro a 31 de dezembro', () => {
    const { start, end } = resolvePeriod('year', '2026-07-20');
    expect(noSalon(start)).toEqual({ ano: 2026, mes: 1, dia: 1 });
    expect(noSalon(end)).toEqual({ ano: 2026, mes: 12, dia: 31 });
  });

  it('o intervalo do dia cobre só aquele dia', () => {
    const { start, end } = resolvePeriod('day', '2026-10-15');
    expect(noSalon(start)).toEqual({ ano: 2026, mes: 10, dia: 15 });
    expect(noSalon(end)).toEqual({ ano: 2026, mes: 10, dia: 15 });
    // E o fim é o último milissegundo: um agendamento às 23:59:59.500 entra.
    expect(end.getTime() - start.getTime()).toBe(86400000 - 1);
  });

  it('aceita dia 29 de fevereiro em ano bissexto', () => {
    const { label } = resolvePeriod('month', '2024-02-29');
    expect(label).toBe('Fevereiro de 2024');
  });

  it('fevereiro não bissexto fecha no dia 28', () => {
    const { end } = resolvePeriod('month', '2026-02-10');
    expect(noSalon(end).dia).toBe(28);
  });

  it('o intervalo não depende do fuso da máquina que roda o servidor', () => {
    /**
     * A versão anterior montava o intervalo com `new Date(ano, mes, 1)` e
     * `ref.getFullYear()`, que leem o fuso do PROCESSO. Em servidor UTC, o
     * dia 1º do mês às 00:00 no salão é 30/09 no servidor, e o período saía
     * com o dia errado. Aqui a referência é ao meio-dia, então o fuso do
     * servidor não tem como influenciar o dia civil lido.
     */
    for (const mes of [1, 6, 10, 12]) {
      const iso = `2026-${String(mes).padStart(2, '0')}-01`;
      const { start } = resolvePeriod('month', iso);
      expect(noSalon(start), `início de ${mes}`).toEqual({ ano: 2026, mes, dia: 1 });
    }
  });
});

describe('buildSeries', () => {
  const HOURS = { '1': { open: '09:00', close: '19:00' }, '0': null };

  const appointment = (y: number, m: number, d: number, h: number, price: number) => ({
    startsAt: local(y, m, d, h),
    price,
  });

  describe('granularidade por período', () => {
    it('dia vira uma barra por hora, da abertura ao fechamento', () => {
      const serie = buildSeries('day', local(2026, 10, 1), local(2026, 10, 1, 23, 59), [], HOURS);
      // 09h..19h = 11 faixas (o serviço das 18:30-19:00 entra na última)
      expect(serie.length).toBe(11);
      expect(serie[0].label).toBe('09h');
      expect(serie[serie.length - 1].label).toBe('19h');
    });

    it('mês vira uma barra por dia do mês', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], HOURS);
      expect(serie.length).toBe(31);
      expect(serie[0].label).toBe('01/10');
    });

    it('ano vira uma barra por mês, não 365 dias', () => {
      const serie = buildSeries(
        'year',
        local(2026, 1, 1),
        local(2026, 12, 31, 23, 59),
        [],
        HOURS
      );
      expect(serie.length).toBe(12);
      // Rótulos em português, em ordem.
      expect(serie[0].label).toBe('Jan');
      expect(serie[6].label).toBe('Jul');
      expect(serie[11].label).toBe('Dez');
    });
  });

  describe('densidade', () => {
    /**
     * Série densa é o que impede o gráfico de mentir. Sem os dias vazios, o
     * mês aparecia só com os dias que tiveram serviço e as barras se
     * espalhavam por cima umas das outras.
     */
    it('mantém os buckets sem atendimento, com zero', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [appointment(2026, 10, 5, 10, 50)], HOURS);

      expect(serie.length).toBe(31);
      expect(serie.filter((p) => p.revenue === 0).length).toBe(30);
      const dia5 = serie.find((p) => p.key === '2026-10-05');
      expect(dia5?.revenue).toBe(50);
      expect(dia5?.count).toBe(1);
    });

    it('a soma dos buckets é o faturamento do período', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries(
        'month',
        inicio,
        fim,
        [
          appointment(2026, 10, 1, 10, 35),
          appointment(2026, 10, 1, 14, 180),
          appointment(2026, 10, 3, 9, 45),
        ],
        HOURS
      );
      expect(serie.reduce((s, p) => s + p.revenue, 0)).toBe(260);
      expect(serie.reduce((s, p) => s + p.count, 0)).toBe(3);
    });
  });

  describe('dias fechados', () => {
    it('marca o domingo como fechado e não rotula', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], HOURS);

      // 4/10/2026 é um domingo.
      const domingo = serie.find((p) => p.key === '2026-10-04');
      expect(domingo?.isOpen).toBe(false);
      expect(domingo?.label).toBe('');

      // 5/10 é segunda, aberto no HOURS de teste.
      const segunda = serie.find((p) => p.key === '2026-10-05');
      expect(segunda?.isOpen).toBe(true);
      expect(segunda?.label).toBe('05/10');
    });

    it('trata dia sem configuração como aberto', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], undefined);
      expect(serie.every((p) => p.isOpen)).toBe(true);
    });

    it('não perde atendimento que cai fora da faixa configurada', () => {
      const serie = buildSeries(
        'day',
        local(2026, 10, 1),
        local(2026, 10, 1, 23, 59),
        [appointment(2026, 10, 1, 22, 90)],
        HOURS
      );
      const fora = serie.find((p) => p.key.endsWith('T22'));
      expect(fora).toBeDefined();
      expect(fora?.revenue).toBe(90);
    });
  });

  describe('rótulos', () => {
    it('o rótulo do dia bate com a chave, sem escorregar um dia', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], HOURS);

      for (const p of serie) {
        if (!p.label) continue;
        const [, mes, dia] = p.key.split('-');
        expect(p.label, `rótulo de ${p.key}`).toBe(`${dia}/${mes}`);
      }
    });

    it('o rótulo completo do dia saiu em português', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [appointment(2026, 10, 5, 10, 50)], HOURS);
      const comDados = serie.find((p) => p.count > 0);
      // `EEEE` sem locale devolvia "Wednesday", e o mês saía "October".
      expect(comDados?.fullLabel).toContain('outubro');
      expect(comDados?.fullLabel).not.toMatch(/October|Wednesday|Monday/);
    });

    it('as chaves são únicas e ordenadas', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], HOURS);
      const chaves = serie.map((p) => p.key);
      expect(new Set(chaves).size).toBe(chaves.length);
      expect([...chaves].sort()).toEqual(chaves);
    });
  });

  describe('período vazio', () => {
    it('devolve buckets zerados, e não lista vazia', () => {
      const inicio = local(2026, 10, 1);
      const fim = new Date(inicio.getTime() + 31 * 86400000 - 3600000);
      const serie = buildSeries('month', inicio, fim, [], HOURS);
      expect(serie.length).toBe(31);
      expect(serie.every((p) => p.revenue === 0)).toBe(true);
    });

    it('funciona sem horário de negócio configurado', () => {
      const serie = buildSeries('day', local(2026, 10, 1), local(2026, 10, 1, 23, 59), [], null);
      // Fallback 8h–20h, com a faixa das 20h já fora: são 12 buckets, 08h..19h.
      expect(serie[0].label).toBe('08h');
      expect(serie[serie.length - 1].label).toBe('19h');
      expect(serie.length).toBe(12);
    });
  });
});
