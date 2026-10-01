import { CheckCircleIcon, AlertIcon, RefreshIcon, PhoneIcon, ExternalLinkIcon, InfoIcon, ClockIcon } from '@components/icons';

/**
 * Componentes da aba de WhatsApp.
 *
 * Ficam em arquivo à parte porque a página de configurações já cuida de dez
 * outras coisas, e a regra de formatação do projeto manda que um bloco só com
 * apresentação não se misture com o estado de um formulário de oito abas.
 */

interface Estado {
  configurado: boolean;
  conectado: boolean;
  numero: string | null;
  pushName: string | null;
  smartphoneConectado: boolean | null;
  mensagem: string;
}

/**
 * A pergunta "está funcionando?".
 *
 * O texto da resposta é do backend, não daqui. Isso é deliberado: a Z-API tem
 * várias formas de dizer que algo está errado — instância inexistente, token
 * inválido, número desconectado, conexão recusada — e cada uma tem um conserto
 * diferente. Traduzir isso no frontend seria copiar a lista de motivos para
 * outro lugar, onde ia envelhecer sem ninguém perceber.
 */
export function EstadoWhatsApp({
  estado,
  carregando,
  erro,
  onAtualizar,
}: {
  estado: Estado | null;
  carregando: boolean;
  erro?: string | null;
  onAtualizar: () => void;
}) {
  if (carregando && !estado && !erro) {
    return (
      <div className="bg-brand-white border border-brand-gray p-6 flex items-center gap-3">
        <RefreshIcon className="w-4 h-4 animate-spin text-brand-grayMid" />
        <span className="text-body-sm text-brand-grayMid">Consultando a Z-API...</span>
      </div>
    );
  }

  /*
   * Falha de consulta é um estado de tela, não um silêncio.
   *
   * A versão anterior simplesmente não desenhava nada aqui, e com isso o
   * dono ficava olhando os campos de credencial sem nenhuma pista. É
   * exatamente o caso que o bloco existe para evitar: a Z-API disse "Instance
   * not found", essa é a instrução de conserto, e ela precisa aparecer.
   */
  if (erro) {
    return (
      <div className="bg-brand-white border border-brand-black p-6">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 flex-shrink-0 border border-brand-black text-brand-black flex items-center justify-center">
            <AlertIcon className="w-5 h-5" />
          </span>

          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-body">Não consegui consultar a Z-API</p>
            <p className="text-body-sm text-brand-grayMid mt-1 break-words">{erro}</p>
            <p className="text-caption text-brand-grayMid mt-2">
              Isso costuma ser credencial errada, instância que não existe, ou URL da API
              incorreta. Confira os campos abaixo.
            </p>

            <button
              onClick={onAtualizar}
              disabled={carregando}
              className="mt-4 flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sem resposta ainda e sem carregamento: não diz nada, em vez de dizer que
  // está tudo bem. Inventar um "desconectado" aqui seria mentir na direção
  // oposta.
  if (!estado) return null;

  const tom = !estado.configurado || !estado.conectado ? 'problema' : 'ok';

  return (
    <div
      className={`bg-brand-white border p-6 ${
        tom === 'problema' ? 'border-brand-black' : 'border-brand-gray'
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`w-10 h-10 flex-shrink-0 border flex items-center justify-center ${
            tom === 'problema' ? 'border-brand-black text-brand-black' : 'border-brand-gray text-brand-grayMid'
          }`}
        >
          {tom === 'problema' ? (
            <AlertIcon className="w-5 h-5" />
          ) : (
            <CheckCircleIcon className="w-5 h-5" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-body">
            {tom === 'ok' ? 'WhatsApp funcionando' : 'WhatsApp com problema'}
          </p>
          <p className="text-body-sm text-brand-grayMid mt-1 break-words">{estado.mensagem}</p>

          {/*
            O número só aparece se a Z-API mandar. Ela normalmente não manda, e
            a versão anterior escrevia "número desconhecido", que soava a defeito
            num sistema perfeito. O bloco some em vez de Inventar.
          */}
          {estado.conectado && estado.numero && (
            <p className="text-caption text-brand-grayMid mt-2 flex items-center gap-1.5">
              <PhoneIcon className="w-3.5 h-3.5" />
              {formatarNumero(estado.numero)}
              {estado.pushName ? ` · ${estado.pushName}` : ''}
            </p>
          )}

          <button
            onClick={onAtualizar}
            disabled={carregando}
            className="mt-4 flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Consultar de novo
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * QR Code para parear o celular.
 *
 * Fica escondido até o dono pedir. Uma imagem de QR sempre visível seria ruído
 * para quem já conectou — e, pior, o QR expira em poucos minutos, então uma
 * imagem parada na tela vira um quadrado que não funciona.
 *
 * O caso "já está conectado" é tratado como o que é: o melhor estado possível.
 * A Z-API devolve `{connected: true}` e nenhum QR nesse caso, e apresentar isso
 * como erro mostraria um cartão vermelho num sistema funcionando.
 */
export function ParearCelular({
  qr,
  jaConectado,
  carregando,
  onGerar,
  onAbrirLink,
}: {
  qr: string | null;
  jaConectado: boolean;
  carregando: boolean;
  onGerar: () => void;
  onAbrirLink: string | null;
}) {
  return (
    <div className="bg-brand-white border border-brand-gray p-6">
      <h3 className="text-md font-medium text-brand-black mb-1">Parear o celular</h3>
      <p className="text-body-sm text-brand-grayMid mb-5">
        Abra o WhatsApp no celular, toque em <strong>Aparelhos conectados</strong> e
        <strong> Conectar um aparelho</strong>. O código abaixo substitui o que aparece
        na tela do celular.
      </p>

      {jaConectado ? (
        <div className="flex items-start gap-3 border border-brand-gray p-4">
          <CheckCircleIcon className="w-5 h-5 text-brand-grayMid flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-medium text-body-sm">
              Este número já está conectado
            </p>
            <p className="text-body-sm text-brand-grayMid mt-1">
              Não há código a exibir, e não precisa haver: o WhatsApp está pareado e
              mandando. Para trocar de celular, desconecte em
              <strong> Aparelhos conectados</strong> no WhatsApp do celular e gere o código
              de novo.
            </p>
            <button
              onClick={onGerar}
              disabled={carregando}
              className="mt-3 flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Verificar de novo
            </button>
          </div>
        </div>
      ) : !qr ? (
        <button
          onClick={onGerar}
          disabled={carregando}
          className="px-5 py-2.5 bg-brand-black text-white text-body-sm font-medium hover:bg-brand-grayDark disabled:opacity-50"
        >
          {carregando ? 'Gerando...' : 'Gerar QR Code'}
        </button>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="border border-brand-gray p-3 bg-white shrink-0">
            <img
              src={`data:image/png;base64,${qr}`}
              alt="QR Code para parear o WhatsApp"
              className="w-48 h-48 block"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <p className="flex items-start gap-2 text-caption text-brand-grayMid">
              <ClockIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Este código expira em poucos minutos. Se passar, gere outro.</span>
            </p>

            {onAbrirLink && (
              <a
                href={onAbrirLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-body-sm text-brand-black underline underline-offset-2 hover:opacity-70 transition-opacity duration-fast"
              >
                Abrir o código no celular
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={onGerar}
              disabled={carregando}
              className="mt-4 flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Gerar outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Webhooks: entrega e queda.
 *
 * Esta seção é a diferença entre o sistema avisar que o WhatsApp caiu e o
 * cliente avisar. Sem webhook, nada no sistema percebe uma desconexão — as
 * mensagens continuam "saindo" da API e o dono só descobre pelo celular de um
 * cliente que não recebeu o lembrete.
 *
 * O aviso de `BACKEND_URL` fica visível mesmo antes de clicar, porque a causa
 * número um de "registrei e nunca chegou nada" é apontar para `localhost`, que
 * a Z-API não alcança.
 */
export function Webhooks({
  registrando,
  registrado,
  onRegistrar,
}: {
  registrando: boolean;
  registrado: boolean | null;
  onRegistrar: () => void;
}) {
  return (
    <div className="bg-brand-white border border-brand-gray p-6">
      <h3 className="text-md font-medium text-brand-black mb-1">Avisos automáticos</h3>
      <p className="text-body-sm text-brand-grayMid mb-4">
        Registra no sistema dois avisos: quando o WhatsApp <strong>cai</strong> e quando uma
        mensagem é <strong>entregue</strong> no celular do cliente. Sem isso, a única forma de
        descobrir que o número desconectou é um cliente reclamar.
      </p>

      <div className="flex items-start gap-2 text-caption text-brand-grayMid mb-5">
        <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Precisa da variável <code className="bg-brand-gray px-1">BACKEND_URL</code> no servidor,
          com a URL pública do backend. É para onde a Z-API avisa.
        </span>
      </div>

      {registrado && (
        <p className="flex items-center gap-2 text-body-sm text-brand-black mb-4">
          <CheckCircleIcon className="w-4 h-4" />
          Avisos registrados. O sistema passa a saber quando o número cai.
        </p>
      )}

      <button
        onClick={onRegistrar}
        disabled={registrando}
        className="px-5 py-2.5 border border-brand-black text-brand-black text-body-sm font-medium hover:bg-brand-black hover:text-white transition-colors duration-fast disabled:opacity-50"
      >
        {registrando ? 'Registrando...' : registrado ? 'Registrar de novo' : 'Registrar avisos'}
      </button>
    </div>
  );
}

/** `5511987654321` vira `(11) 98765-4321`. */
function formatarNumero(numero: string): string {
  const d = numero.replace(/\D/g, '');
  if (d.length === 13) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return numero;
}
