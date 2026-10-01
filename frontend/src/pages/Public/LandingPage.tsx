import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Section, Container, Card, CardContent, Badge, Button, Separator } from '@components/ui';
import { servicesApi } from '@services/api';
import { formatPhone } from '@utils/validation';
import { useSalon } from '@contexts/SalonContext';
import { DevCredits } from '@components/DevCredits';

/**
 * Galeria em collage editorial: uma célula grande à esquerda (2 linhas) e
 * três menores empilhadas à direita. Proporções fixas por posição — usar
 * `aspect-*` dinâmico por índice deixa buracos no grid.
 */
const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=80', alt: 'Interior do salão' },
  { src: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=700&q=80', alt: 'Profissional trabalhando' },
  { src: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=700&q=80', alt: 'Corte em andamento' },
  { src: 'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=700&q=80', alt: 'Detalhe do acabamento' },
];

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** "09:00" vira "09h" para o texto corrido do hero. */
const hora = (v: string) => v.replace(':', 'h');

export function LandingPage() {
  /**
   * Nome, endereço, telefone e horário vêm do MESMO registro que o dono
   * edita em Configurações — e do mesmo contexto que alimenta header,
   * sidebar e rodapé. Estavam fixos no arquivo ("MR. CUT", três unidades em
   * São Paulo) e divergiam do banco: o cliente via um endereço na landing e
   * outro no agendamento.
   */
  const { salon } = useSalon();

  const [servicos, setServicos] = useState<
    Array<{ id: string; name: string; description?: string | null; durationMinutes: number; price: number }>
  >([]);

  useEffect(() => {
    servicesApi
      .getPublic()
      .then((r) => setServicos(r.services))
      .catch(() => setServicos([]));
  }, []);

  // Sem fallback literal: um nome genérico aqui esconderia o nome real até
  // o GET voltar, que é o que a gente quer evitar. Enquanto não há nome, o
  // hero fica sem a linha — some no primeiro render.
  const nome = salon?.name ?? '';

  const horariosAbertos = Object.entries(salon?.businessHours || {}).filter(
    ([, v]) => v !== null
  );

  return (
    <div className="min-h-screen bg-brand-white text-brand-black">
      {/* Hero Section */}
      <Section size="lg" className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        <Container>
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="max-w-xl">
              <Badge variant="outline" className="mb-6">AGENDAMENTO ONLINE</Badge>
              {/* O nome entra com a altura da linha reservada: sem ele o h1
                  pulava de posição quando o GET voltava. */}
              <h1 className="text-display-xl md:text-display-lg leading-[0.9] mb-6 min-h-[2lh]">
                {nome}
              </h1>
              <p className="text-body-lg text-brand-grayMid mb-10 max-w-md">
                {salon?.description ||
                  'Escolha o serviço, o profissional e o horário. A confirmação chega na hora e você acompanha tudo pela sua conta.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/agendar">
                  <Button size="lg">Agendar Horário</Button>
                </Link>
                <Link to="#servicos">
                  <Button variant="outline" size="lg">Ver Serviços</Button>
                </Link>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative aspect-portrait max-w-md mx-auto md:mx-0">
              <div className="relative aspect-portrait overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80"
                  alt={`Interior de ${nome}`}
                  className="w-full h-full object-cover"
                />
                <div className="overlay-gradient" />
              </div>
              {/* Sobreposição com o horário real */}
              <div className="absolute -bottom-6 -left-6 md:-left-10 bg-brand-white border border-brand-gray p-6 md:p-8 shadow-elevated animate-slide-up">
                <p className="font-display font-bold text-display-md">{hora(horariosAbertos[0]?.[1]?.open || '09:00')}</p>
                <p className="text-caption text-brand-grayMid">Abre às</p>
              </div>
            </div>
          </div>
        </Container>

        {/* Serviços em destaque — mesmos dados do banco */}
        <div className="border-t border-brand-gray mt-16 md:mt-24">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 py-12 md:py-16">
              {[
                { value: servicos.length > 0 ? String(servicos.length) : '—', label: 'Serviços' },
                {
                  value: horariosAbertos[0]?.[1]
                    ? `${hora(horariosAbertos[0][1].open)} — ${hora(horariosAbertos[0][1].close)}`
                    : '—',
                  label: 'Horário',
                },
                { value: salon?.phone ? formatPhone(salon.phone) : '—', label: 'Contato' },
                {
                  value: horariosAbertos.length > 0 ? `${horariosAbertos.length} dias` : '—',
                  label: 'Aberto por semana',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="min-w-0 border-l border-brand-gray first:border-0 pl-6 first:pl-0"
                >
                  {/* Rótulo ANTES do valor, alinhado à esquerda.
                      Centralizado com telefone de 14 caracteres a 30px
                      quebrava em duas linhas desalinhadas; à esquerda cabe
                      numa linha e a coluna não invade a vizinha. */}
                  <p className="text-caption uppercase tracking-wider text-brand-grayMid">
                    {stat.label}
                  </p>
                  {/* base / sm. A 30px o telefone (14 caracteres) e o
                      horário (14) não cabem em ~190px de coluna e saíam
                      em reticências; 18px/24px cabem folgados. */}
                  <p className="font-display font-semibold text-lg sm:text-xl mt-2 tabular-nums truncate">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </div>
      </Section>

      {/* About / Mission */}
      <Section id="about" size="lg" background="gray">
        <Container>
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <Badge variant="outline" className="mb-4">SOBRE</Badge>
              <h2 className="text-display-md md:text-display-lg mb-6">
                Agendar leva menos de dois minutos
              </h2>
              <p className="text-body-lg text-brand-grayMid mb-6">
                Escolha o serviço, o profissional e o horário. A confirmação chega na hora
                e você acompanha tudo pela sua conta, sem precisar ligar.
              </p>
              <p className="text-body text-brand-grayMid mb-8">
                Todo atendimento começa com o profissional que você escolher, e você vê a
                foto dele antes de confirmar. Os horários respeitam a agenda de cada um
                e o intervalo entre um atendimento e outro.
              </p>
              <Link to="#servicos">
                <Button variant="outline" size="lg">Ver os serviços</Button>
              </Link>
            </div>
            <div className="relative aspect-landscape">
              <img
                src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1000&q=80"
                alt="Profissional trabalhando em corte preciso"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* Services */}
      <Section id="services" size="lg">
        <Container>
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">SERVIÇOS</Badge>
            <h2 className="text-display-md md:text-display-lg mb-4">O que oferecemos</h2>
            <p className="text-body-lg text-brand-grayMid">
              Preços transparentes, duração real. Sem surpresas na conta.
            </p>
          </div>

          {/* Card inteiro clicável — em um site de agendamento o alvo de toque
              precisa ser o card, não só o texto do link. */}
          <div className="grid-editorial-3">
            {servicos.map((service) => (
              <Link
                key={service.id}
                to="/agendar"
                className="card-hover flex flex-col p-6 md:p-8 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="font-display font-semibold text-body-lg">{service.name}</h3>
                  <span className="badge badge-muted flex-shrink-0">{service.durationMinutes} min</span>
                </div>

                <p className="text-body-sm text-brand-grayMid mb-8 flex-1">
                  {service.description || 'Serviço realizado pelo profissional.'}
                </p>

                <div className="flex items-end justify-between gap-4 pt-5 border-t border-brand-gray">
                  <span className="font-display font-bold text-display-sm leading-none">
                    R$ {service.price.toFixed(2).replace('.', ',')}
                  </span>
                  <span
                    className="btn-minimal"
                    aria-hidden="true"
                  >
                    Agendar
                    <svg
                      className="w-4 h-4 transition-transform duration-normal group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/agendar">
              <Button variant="outline" size="lg">Ver todos os serviços</Button>
            </Link>
          </div>
        </Container>
      </Section>

      {/* Gallery */}
      <Section id="gallery" size="lg" background="gray">
        <Container>
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">NOSSO TRABALHO</Badge>
            <h2 className="text-display-md md:text-display-lg mb-4">Galeria</h2>
            <p className="text-body-lg text-brand-grayMid">Precisão em cada detalhe</p>
          </div>

          {/* Collage: 1 grande (2 linhas) + 3 empilhadas à direita.
              Alturas fixas por grid-row garantem alinhamento sem depender
              de aspect-ratio dinâmico. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {galleryImages.map((img, i) => (
              <figure
                key={img.src}
                className={[
                  'group relative overflow-hidden bg-brand-gray',
                  i === 0
                    ? 'md:row-span-3 aspect-[4/5] md:aspect-auto md:min-h-[30rem]'
                    : 'aspect-[16/10]',
                ].join(' ')}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-sharp group-hover:scale-[1.04]"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                  <span className="text-caption text-brand-white bg-brand-black/70 px-2 py-1 inline-block">
                    {img.alt}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </Section>

      {/* Onde estamos — endereço do banco, não unidades fictícias */}
      <Section id="localizacao" size="lg" background="gray">
        <Container>
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">LOCALIZAÇÃO</Badge>
            <h2 className="text-display-md md:text-display-lg mb-4">Onde nos encontrar</h2>
            <p className="text-body-lg text-brand-grayMid">{nome}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Card>
              <CardContent>
                <h3 className="font-display font-semibold text-body-lg mb-4">{nome}</h3>

                {salon?.address ? (
                  <p className="text-body text-brand-grayMid mb-1">{salon.address}</p>
                ) : (
                  <p className="text-body text-brand-grayMid mb-1 italic">
                    Endereço não cadastrado. O proprietário pode informá-lo em Configurações.
                  </p>
                )}

                {salon?.phone && <p className="text-body text-brand-grayMid mt-4">{formatPhone(salon.phone)}</p>}
                {salon?.email && (
                  <p className="text-body-sm text-brand-grayMid mt-1 break-all">{salon.email}</p>
                )}

                <div className="divider my-6" />

                <h4 className="font-display text-caption uppercase tracking-wider text-brand-grayMid mb-3">
                  Horário de funcionamento
                </h4>
                <ul className="space-y-2">
                  {WEEKDAYS.map((dia, i) => {
                    const h = salon?.businessHours?.[String(i)];
                    return (
                      <li
                        key={dia}
                        className="flex items-center justify-between text-body-sm border-b border-brand-gray pb-2 last:border-0"
                      >
                        <span>{dia}</span>
                        <span className={h ? 'font-display' : 'text-brand-grayMid'}>
                          {h ? `${hora(h.open)} — ${hora(h.close)}` : 'Fechado'}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Link to="/agendar" className="mt-8 block">
                  <Button className="w-full justify-center">Agendar neste salão</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Mapa — iframe do Google não renderiza em screenshots, bloqueadores
                ou sem consentimento de cookies. O frame com cabeçalho garante
                que mesmo vazio o bloco pareça intencional, e o link externo
                sempre dá saída. */}
            <figure className="border border-brand-gray bg-brand-white">
              <figcaption className="flex items-center justify-between gap-4 px-5 py-3 border-b border-brand-gray">
                <span className="font-display text-caption">ONDE NOS ENCONTRAR</span>
                {salon?.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-minimal"
                  >
                    Abrir no Google Maps
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                  </a>
                )}
              </figcaption>
              <div className="relative aspect-[4/3] bg-brand-grayLight">
                {salon?.address ? (
                  <iframe
                    src={`https://www.google.com/maps?q=${encodeURIComponent(salon.address)}&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    // Escala de cinza mantém o mapa dentro da paleta monocromática;
                    // no hover volta ao normal para a pessoa navegar com cores.
                    className="absolute inset-0 w-full h-full grayscale contrast-[1.05] transition-[filter] duration-normal hover:grayscale-0"
                    title={`Mapa de ${nome}`}
                  />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center text-body-sm text-brand-grayMid text-center px-6">
                    Sem endereço cadastrado para exibir no mapa.
                  </p>
                )}
              </div>
            </figure>
          </div>
        </Container>
      </Section>

      {/* CTA Final */}
      <Section size="md" background="black">
        <Container>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-display-md md:text-display-lg mb-4">Pronto para seu melhor corte?</h2>
            <p className="text-body-lg text-brand-gray mb-8">Agende online em segundos. Escolha unidade, profissional e horário.</p>
            <Link to="/agendar" className="inline-block">
              {/* Botão branco sobre seção preta. Não sobrescreve variant="solid"
                  via className: btn-solid usa @apply (layer components) e a
                  utility do className dispute a mesma especificidade — o
                  vencedor depende da ordem do CSS, não da ordem do className. */}
              <Button size="lg" className="!bg-brand-white !text-brand-black hover:!bg-brand-gray">
                Agendar Agora
              </Button>
            </Link>
          </div>
        </Container>
      </Section>

      {/* Footer — mesma fonte de dados do resto da página */}
      <footer className="border-t border-brand-gray py-12">
        <Container>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link
                to="/"
                className="font-display font-bold text-display-sm tracking-tight block mb-4"
              >
                {nome}
              </Link>
              <p className="text-body-sm text-brand-grayMid max-w-sm">
                {salon?.description || 'Agendamento online, escolha de serviço, profissional e horário.'}
              </p>
            </div>
            <div>
              <h4 className="font-display font-medium text-caption text-brand-grayMid mb-3">ENDEREÇO</h4>
              <ul className="space-y-2 text-body-sm text-brand-grayMid">
                <li>{salon?.address || 'Não cadastrado'}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-medium text-caption text-brand-grayMid mb-3">CONTATO</h4>
              <ul className="space-y-2 text-body-sm text-brand-grayMid">
                {salon?.phone && <li>{formatPhone(salon.phone)}</li>}
                {salon?.email && <li className="break-all">{salon.email}</li>}
                {!salon?.phone && !salon?.email && <li>Não cadastrado</li>}
              </ul>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-caption text-brand-grayMid text-center">
            © {new Date().getFullYear()} {nome}. Todos os direitos reservados.
          </p>
          <DevCredits className="mt-2" />
        </Container>
      </footer>
    </div>
  );
}

export default LandingPage;
