import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from '@components/ui/Chart';
import { shiftPeriod } from '@components/PeriodSelector';

/**
 * O gráfico de barras já teve dois defeitos que só aparecem com dados
 * escassos, e nenhum dos dois quebrava a página — só deixavam a tela
 * parecendo quebrada. Por isso são testes de forma, não de snapshot.
 */
describe('BarChart', () => {
  const ponto = (label: string, value: number) => ({ label, value });

  it('desenha uma barra por ponto', () => {
    const { container } = render(
      <BarChart data={[ponto('01/10', 100), ponto('02/10', 50), ponto('03/10', 0)]} />
    );
    const barras = container.querySelectorAll('svg rect');
    // +1: a linha de base também é um <rect>? Não — é <line>. Então 3 barras.
    expect(barras.length).toBe(3);
  });

  it('não deixa a barra ocupar o gráfico inteiro quando há um ponto só', () => {
    /**
     * Regressão: a largura era `100 / n - gap`, com gap fixo. Com 1 barra a
     * largura virava 97% e preenchia o card. Com 31 barras o gap fixo de 3
     * (3% do viewBox) era maior que a própria vaga (3,2%) e sobrava 0,2% —
     * a barra virava um traço de 1px.
     *
     * Medido no atributo do SVG: o jsdom não faz layout, então
     * getBoundingClientRect() devolveria zero e o teste não diria nada.
     */
    const attr = (c: HTMLElement, nome: string) =>
      Number(c.querySelector('svg rect')!.getAttribute(nome));

    const { container: umPonto } = render(<BarChart data={[ponto('01/10', 100)]} />);
    const larguraUnica = attr(umPonto, 'width');

    const { container: dois } = render(<BarChart data={[ponto('a', 1), ponto('b', 2)]} />);
    const larguraDois = attr(dois, 'width');

    const { container: muitos } = render(
      <BarChart data={Array.from({ length: 31 }, (_, i) => ponto(`${i + 1}/10`, 10))} />
    );
    const larguraCom31 = attr(muitos, 'width');

    // Um ponto só não pode virar a largura toda (teto de 14% do viewBox).
    expect(larguraUnica).toBe(14);
    // E as barras não podem encolher conforme o gráfico enche: com 31 pontos
    // ainda sobra uma barra visível, não um traço de 1px.
    expect(larguraDois).toBeLessThan(100);
    expect(larguraCom31).toBeGreaterThan(2);
    expect(larguraCom31).toBeLessThan(3);
  });

  it('a barra mais alta ocupa a área útil do gráfico', () => {
    const { container } = render(
      <BarChart data={[ponto('a', 100), ponto('b', 50), ponto('c', 25)]} height={200} />
    );
    const alturas = [...container.querySelectorAll('svg rect')].map((r) =>
      Number(r.getAttribute('height'))
    );
    const maior = Math.max(...alturas);
    const menor = Math.min(...alturas);
    // 100 é o máximo: preenche a área útil (altura 200 menos 8 de folga).
    expect(maior).toBe(192);
    // 50 e 25 são metade e um quarto disso — a altura é proporcional ao valor.
    expect(alturas[1]).toBeCloseTo(96, 1);
    expect(menor).toBeCloseTo(maior / 4, 1);
  });

  it('mantém um traço visível no dia aberto que não vendeu, e nada no fechado', () => {
    const { container } = render(
      <BarChart
        data={[
          ponto('01/10', 100),
          ponto('', 0), // domingo: salão fechado
          ponto('03/10', 0), // segunda, aberto mas sem venda
        ]}
      />
    );
    const barras = [...container.querySelectorAll('svg rect')];
    const altura = (i: number) => Number(barras[i].getAttribute('height'));

    expect(altura(0)).toBeGreaterThan(100);
    // Fechado: sem barra nenhuma.
    expect(altura(1)).toBe(0);
    // Aberto sem venda: traço, para o dia continuar visível como dia.
    expect(altura(2)).toBe(2);
  });

  it('não rotula barra de dia fechado, mas rotula dia aberto', () => {
    render(
      <BarChart
        data={[
          ponto('01/10', 100),
          ponto('', 0), // domingo: salão fechado
          ponto('03/10', 0), // segunda, aberto mas sem venda
        ]}
      />
    );
    expect(screen.getByText('01/10')).toBeTruthy();
    expect(screen.getByText('03/10')).toBeTruthy();
  });

  it('mostra o valor máximo como referência', () => {
    render(<BarChart data={[ponto('a', 320), ponto('b', 80)]} formatValue={(v) => `R$ ${v}`} />);
    expect(screen.getByText(/máximo R\$ 320/)).toBeTruthy();
  });

  it('mostra a mensagem de vazio quando não há dado nenhum', () => {
    render(<BarChart data={[]} emptyMessage="Nada por aqui" />);
    expect(screen.getByText('Nada por aqui')).toBeTruthy();
  });

  it('trata todos os valores zero como vazio, não como gráfico de plano', () => {
    /**
     * Período sem faturamento nenhum (férias, salão recém-aberto) não pode
     * virar um gráfico com 31 barras de altura zero, que parece erro de
     * renderização.
     */
    render(
      <BarChart
        data={Array.from({ length: 31 }, (_, i) => ponto(`${i + 1}/10`, 0))}
        emptyMessage="Sem atendimentos no período"
      />
    );
    expect(screen.getByText('Sem atendimentos no período')).toBeTruthy();
  });

  it('o eixo rotula no máximo uma barra a cada 12, para não amontoar', () => {
    render(
      <BarChart data={Array.from({ length: 31 }, (_, i) => ponto(`${i + 1}/10`, 10))} />
    );
    // 31 pontos -> passo de 3 -> 11 rótulos.
    const rotulos = screen.getAllByText(/^\d{2}\/\d{2}$/);
    expect(rotulos.length).toBeLessThanOrEqual(12);
    expect(rotulos.length).toBeGreaterThan(3);
  });
});

describe('shiftPeriod', () => {
  /**
   * Navegar de mês em mês é onde o `Date` engana: `new Date(2026, 0, 31) + 1 mês`
   * cai em março, porque 31 de fevereiro não existe e o construtor corrige para
   * o dia 3.
   */
  it('avança e volta um mês', () => {
    expect(shiftPeriod('2026-10-15', 'month', 1)).toBe('2026-11-15');
    expect(shiftPeriod('2026-10-15', 'month', -1)).toBe('2026-09-15');
  });

  it('trava no último dia do mês quando o dia não existe no destino', () => {
    // 31 de janeiro -> fevereiro tem 28
    expect(shiftPeriod('2026-01-31', 'month', 1)).toBe('2026-02-28');
    // ano bissexto -> 29
    expect(shiftPeriod('2024-01-31', 'month', 1)).toBe('2024-02-29');
    // 31 de março -> abril tem 30
    expect(shiftPeriod('2026-03-31', 'month', 1)).toBe('2026-04-30');
  });

  it('atravessa a virada de ano', () => {
    expect(shiftPeriod('2026-12-15', 'month', 1)).toBe('2027-01-15');
    expect(shiftPeriod('2027-01-15', 'month', -1)).toBe('2026-12-15');
    expect(shiftPeriod('2026-06-10', 'year', 1)).toBe('2027-06-10');
    expect(shiftPeriod('2027-06-10', 'year', -1)).toBe('2026-06-10');
  });

  it('soma e subtrai dias atravessando o fim do mês', () => {
    expect(shiftPeriod('2026-10-31', 'day', 1)).toBe('2026-11-01');
    expect(shiftPeriod('2026-11-01', 'day', -1)).toBe('2026-10-31');
    expect(shiftPeriod('2026-10-15', 'day', 1)).toBe('2026-10-16');
  });

  it('atravessa o fim de ano em dias', () => {
    expect(shiftPeriod('2026-12-31', 'day', 1)).toBe('2027-01-01');
    expect(shiftPeriod('2027-01-01', 'day', -1)).toBe('2026-12-31');
  });

  it('preserva o formato YYYY-MM-DD sempre', () => {
    for (const p of ['day', 'month', 'year'] as const) {
      const r = shiftPeriod('2026-01-05', p, 1);
      expect(r, p).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
