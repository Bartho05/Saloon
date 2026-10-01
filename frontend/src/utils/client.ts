import { formatPhone } from './validation';

/**
 * Como mostrar um cliente quando o nome não está preenchido.
 *
 * Um telefone pode ter o cadastro iniciado (verificado por WhatsApp) sem
 * ainda ter informado o nome — o cadastro nasce no primeiro agendamento.
 * Antes disso o servidor gravava "Cliente WhatsApp", e era esse nome falso
 * que aparecia na agenda do dono e do profissional.
 *
 * Agora o nome fica vazio, mas a agenda não pode mostrar linha em branco:
 * o telefone identifica a pessoa melhor do que um "Cliente" genérico, e é
 * por ele que o salão manda a mensagem de confirmação.
 *
 * @returns o nome, ou o telefone entre parênteses, ou o último recurso
 */
export function clientLabel(
  client: { fullName?: string | null; phone?: string | null } | null | undefined
): string {
  const nome = client?.fullName?.trim();
  if (nome) return nome;

  const telefone = client?.phone?.trim();
  if (telefone) return formatPhone(telefone);

  return 'Cliente sem cadastro';
}

/**
 * Indica que o nome exibido não é o informado pela pessoa — veio do
 * telefone. Usado para marcar visualmente o cadastro pendente, sem
 * disguise de nome real.
 */
export function clienteSemNome(
  client: { fullName?: string | null } | null | undefined
): boolean {
  return !client?.fullName?.trim();
}
