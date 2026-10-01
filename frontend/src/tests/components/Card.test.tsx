import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardContent } from '@components/ui/Card';
import { AppointmentCard } from '@components/AppointmentCard';
import { StatusBadge } from '@components/Dashboard';
import type { Appointment, Client } from '@types';

/**
 * Duas regressões de layout que a inspeção visual pegou.
 */
describe('Card', () => {
  /**
   * Padding em dobro.
   *
   * `variant="hover"` trazia `p-6 md:p-8` (32px) E o `CardContent` somava
   * `p-5 md:p-6` (24px): 56px dentro de um card de 172px de altura. O texto
   * ficava longe demais da borda e o card não alinhava com os vizinhos.
   *
   * O `Card` normal não tem padding — quem escreve o corpo (o `CardContent`) é
   * que afasta o conteúdo da borda. Este teste trava essa divisão: se alguém
   * voltar a pôr padding no invólucro, ele quebra.
   */
  it('o invólucro hover não tem padding: quem afasta é o CardContent', () => {
    const { container } = render(
      <Card variant="hover" data-testid="card">
        <CardContent>conteúdo</CardContent>
      </Card>
    );

    const card = container.firstElementChild as HTMLElement;
    const conteudo = card.firstElementChild as HTMLElement;

    expect(card.className).toContain('card-padded-hover');
    expect(card.className).not.toMatch(/\bp-6\b/);
    expect(card.className).not.toMatch(/\bmd:p-8\b/);

    // O padding de 24px está no corpo, uma vez só.
    expect(conteudo.className).toContain('p-5');
    expect(conteudo.className).toContain('md:p-6');
  });

  it('a variante padded continua com padding, para conteúdo cru', () => {
    const { container } = render(<Card variant="padded">estado vazio</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('card-padded');
    expect(card.className).not.toContain('card-padded-hover');
  });
});

/*
 * O `className` sozinho não conta a história do padding: `.card-padded-hover`
 * usava `@apply card-hover p-6 md:p-8` dentro do globals.css, e `@apply` não
 * aparece no elemento (nem no jsdom, que não compila o Tailwind). A regra de
 * ouro fica documentada em `Card.tsx` e em `globals.css`; aqui o que se trava é
 * a divisão de responsabilidade — o invólucro da variante hover não pede
 * padding, e quem afasta o conteúdo é o `CardContent`, uma vez só.
 *
 * A prova de que a correção funciona é de medição: o StatCard do painel tinha
 * 172px de altura com 56px de padding; depois, 108px.
 */

describe('AppointmentCard', () => {
  const base: Appointment = {
    id: 'a1',
    clientId: 'c1',
    employeeId: 'e1',
    serviceId: 's1',
    startsAt: '2026-10-05T14:00:00.000Z',
    endsAt: '2026-10-05T14:30:00.000Z',
    status: 'SCHEDULED',
    createdAt: '2026-10-01T00:00:00.000Z',
    service: { id: 's1', name: 'Corte Masculino', durationMinutes: 30, price: 45, isActive: true },
    client: { id: 'c1', fullName: 'Maria Silva', phone: '31955558888', birthDate: '1990-05-05', createdAt: '' },
  };

  it('mostra o nome do cliente quando existe', () => {
    render(<AppointmentCard appointment={base} />);
    expect(screen.getByText('Maria Silva')).toBeTruthy();
  });

  it('cadastro incompleto mostra o telefone, e não o telefone duas vezes', () => {
    /**
     * O nome vazio não pode virar linha em branco na agenda, e o telefone
     * identifica melhor que um "Cliente" genérico. Mas o subtítulo já traz o
     * telefone: sem o cuidado, "Corte · (31) 95555-8888" apareceria duas vezes
     * na mesma linha.
     */
    const incompleto: Client = { ...base.client!, fullName: '' };
    const { container } = render(
      <AppointmentCard appointment={{ ...base, client: incompleto }} />
    );

    const texto = container.textContent || '';
    const ocorrencias = (texto.match(/\(31\) 95555-8888/g) || []).length;
    expect(ocorrencias).toBe(1);
    expect(texto).not.toContain('Cliente WhatsApp');
  });

  it('não deixa "undefined" nem "NaN" vazar no cadastro incompleto', () => {
    const incompleto: Client = { ...base.client!, fullName: '', birthDate: null };
    const { container } = render(
      <AppointmentCard appointment={{ ...base, client: incompleto }} />
    );
    const texto = container.textContent || '';
    expect(texto).not.toMatch(/undefined|NaN|Invalid Date/);
  });
});

describe('StatusBadge', () => {
  /**
   * Os badges são monocromáticos de propósito (decidido por peso, não por
   * matiz). Este teste trava a decisão — a reintrodução de cor quebraria o
   * desenho sem quebrar a página, então nada mais pegaria.
   */
  it('usa apenas preto, branco e cinza', () => {
    for (const tone of ['neutral', 'success', 'danger', 'warning', 'info'] as const) {
      const { container, unmount } = render(<StatusBadge tone={tone}>x</StatusBadge>);
      const badge = container.firstElementChild as HTMLElement;
      const cor = badge.className.match(/text-(brand-\w+|white|black)/)?.[1] ?? '';
      expect(cor, tone).toMatch(/^brand-(black|white|gray\w*)$/);
      const fundo = badge.className.match(/bg-(brand-\w+|white|black)/)?.[1] ?? '';
      expect(fundo, tone).toMatch(/^brand-(black|white|gray\w*)$/);
      unmount();
    }
  });
});
