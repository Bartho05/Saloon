import { describe, it, expect } from 'vitest';
import { formatBirthDate, formatDate, formatDateTime } from '@utils/date';
import { clientLabel, clienteSemNome } from '@utils/client';

describe('formatBirthDate', () => {
  /**
   * Regressão: `new Date('1993-08-21')` é interpretado como meia-noite UTC e,
   * exibido no fuso do salão (America/Sao_Paulo, UTC-3), saía 20/08/1993 — um
   * dia antes do que a pessoa digitou no formulário. Para data de nascimento
   * o dia errado não é detalhe de layout.
   *
   * O fuso da máquina de teste não é forçado, então o teste compara as duas
   * formas: onde `new Date` erra, `formatBirthDate` tem que acertar.
   */
  it('nao volta um dia em relacao a new Date', () => {
    const iso = '1993-08-21';

    // Em UTC new Date não erra — não há o que travar nesse fuso.
    if (new Date(iso).getTimezoneOffset() === 0) {
      expect(formatBirthDate(iso)).toBe('21/08/1993');
      return;
    }

    const diaVistoPorNewDate = new Date(iso).getDate();
    const diaVistoPorAqui = Number(formatBirthDate(iso).slice(0, 2));

    expect(diaVistoPorAqui).toBe(21);
    expect(diaVistoPorAqui).toBe(diaVistoPorNewDate + 1);
  });

  it('formata o dia que foi digitado', () => {
    expect(formatBirthDate('1993-08-21')).toBe('21/08/1993');
    expect(formatBirthDate('2000-01-01')).toBe('01/01/2000');
    // viradas de ano e de mês
    expect(formatBirthDate('2024-12-31')).toBe('31/12/2024');
    expect(formatBirthDate('2024-03-01')).toBe('01/03/2024');
  });
});

describe('formatDate', () => {
  it('formata data sem hora em dd/MM/yyyy', () => {
    expect(formatDate('2026-10-03')).toBe('03/10/2026');
  });
});

describe('formatDateTime', () => {
  it('formata data e hora', () => {
    expect(formatDateTime('2026-10-03T14:30:00')).toBe('03/10/2026 14:30');
  });
});

describe('clientLabel', () => {
  /**
   * O nome do cliente pode estar vazio: o telefone é verificado por WhatsApp
   * antes do primeiro agendamento, e o cadastro só se completa no agendamento.
   * A agenda não pode mostrar linha em branco, e o telefone identifica melhor
   * que um "Cliente" genérico.
   */
  it('usa o nome quando existe', () => {
    expect(clientLabel({ fullName: 'Maria Silva', phone: '31955558888' })).toBe('Maria Silva');
  });

  it('ignora nome com so espaco', () => {
    expect(clientLabel({ fullName: '   ', phone: '31955558888' })).toBe('(31) 95555-8888');
  });

  it('cai para o telefone formatado quando o nome falta', () => {
    expect(clientLabel({ fullName: '', phone: '31955558888' })).toBe('(31) 95555-8888');
  });

  it('cai para o telefone quando fullName e null', () => {
    expect(clientLabel({ fullName: null, phone: '31955558888' })).toBe('(31) 95555-8888');
  });

  it('nunca devolve o placeholder antigo', () => {
    const rotulos = [
      clientLabel({ fullName: '', phone: '31955558888' }),
      clientLabel({ fullName: null, phone: null }),
      clientLabel(null),
      clientLabel(undefined),
      clientLabel({}),
    ];
    for (const r of rotulos) {
      expect(r).not.toBe('Cliente WhatsApp');
      expect(r.trim().length).toBeGreaterThan(0);
    }
  });

  it('aceita o formato do financeiro (client aninhado)', () => {
    const apt = {
      id: 'a1',
      startsAt: '2026-10-03T14:30:00.000Z',
      status: 'SCHEDULED' as const,
      client: { fullName: '', phone: '31955558888' },
      employeeName: 'Carlos',
      serviceName: 'Corte',
      price: 50,
    };
    expect(clientLabel(apt.client)).toBe('(31) 95555-8888');
  });
});

describe('clienteSemNome', () => {
  it('detecta cadastro pendente', () => {
    expect(clienteSemNome({ fullName: '' })).toBe(true);
    expect(clienteSemNome({ fullName: '  ' })).toBe(true);
    expect(clienteSemNome({ fullName: null })).toBe(true);
    expect(clienteSemNome(null)).toBe(true);
    expect(clienteSemNome(undefined)).toBe(true);
  });

  it('nao acusa cadastro completo', () => {
    expect(clienteSemNome({ fullName: 'Maria' })).toBe(false);
  });
});
