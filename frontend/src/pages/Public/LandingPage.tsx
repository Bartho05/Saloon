import { Link } from 'react-router-dom';
import { Section, Container, Card, CardContent, Badge, Button, Separator } from '@components/ui';

const stats = [
  { value: '10+', label: 'Barbearias na rede' },
  { value: '80K+', label: 'Clientes satisfeitos' },
  { value: '78K+', label: 'Cortes realizados' },
];

const services = [
  { name: "Corte Masculino", description: "Corte clássico ou moderno com tesoura e máquina", duration: "30 min", price: 45 },
  { name: "Barba Completa", description: "Aparar, modelar e hidratar com toalha quente", duration: "25 min", price: 35 },
  { name: "Combo Corte + Barba", description: "Serviço completo com desconto especial", duration: "50 min", price: 70 },
  { name: "Corte Longo (Tesoura)", description: "Corte preciso apenas com tesoura para cabelo longo", duration: "40 min", price: 55 },
  { name: "Cabelo + Barba", description: "Corte de cabelo completo com barba aparada", duration: "55 min", price: 80 },
  { name: "Corte Infantil", description: "Até 12 anos, com paciência e diversão", duration: "25 min", price: 30 },
];

/**
 * Galeria em collage editorial: uma célula grande à esquerda (2 linhas) e
 * três menores empilhadas à direita. Proporções fixas por posição — usar
 * `aspect-*` dinâmico por índice deixa buracos no grid.
 */
const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=80', alt: 'Interior da barbearia' },
  { src: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=700&q=80', alt: 'Barbeiro trabalhando' },
  { src: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=700&q=80', alt: 'Corte em andamento' },
  { src: 'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=700&q=80', alt: 'Detalhe do acabamento' },
];

const reviews = [
  { name: 'Rafael S.', role: 'Cliente frequente', text: 'Melhor corte que já tive em anos. Precisão cirúrgica no fade. Volto todo mês.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80' },
  { name: 'Marcos L.', role: 'Novo cliente', text: 'Agendamento online funcionou perfeição. Cheguei, sentei, cortei. Sem espera.', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80' },
  { name: 'Pedro H.', role: 'Cliente VIP', text: 'A barba com toalha quente é um ritual. Atendimento de primeira, ambiente top.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80' },
];

const locations = [
  { name: 'MR. CUT - Centro', address: 'Rua XV de Novembro, 1200', city: 'São Paulo - SP', hours: 'Seg-Sex 9h-20h • Sáb 9h-18h' },
  { name: 'MR. CUT - Jardins', address: 'Av. Paulista, 2000', city: 'São Paulo - SP', hours: 'Seg-Sex 10h-21h • Sáb 10h-19h' },
  { name: 'MR. CUT - Vila Madalena', address: 'Rua Harmonia, 350', city: 'São Paulo - SP', hours: 'Seg-Sex 9h-20h • Sáb 9h-18h' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-white text-brand-black">
      {/* Hero Section */}
      <Section size="lg" className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        <Container>
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="max-w-xl">
              <Badge variant="outline" className="mb-6">BARBEARIA PREMIUM • REDE EM SÃO PAULO</Badge>
              <h1 className="text-display-xl md:text-display-lg leading-[0.9] mb-6">
                MR. CUT
                <br />
                <span className="text-brand-grayMid font-normal">BARBEARIA</span>
              </h1>
              <p className="text-body-lg text-brand-grayMid mb-10 max-w-md">
                Rede de barbearias modernas focada em qualidade, estilo e precisão.
                Agendamento online, profissionais especializados e experiência única.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/agendar">
                  <Button size="lg">Agendar Horário</Button>
                </Link>
                <Link to="#locations">
                  <Button variant="outline" size="lg">Nossas Unidades</Button>
                </Link>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative aspect-portrait max-w-md mx-auto md:mx-0">
              <div className="relative aspect-portrait overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80"
                  alt="Interior da barbearia MR. CUT"
                  className="w-full h-full object-cover"
                />
                <div className="overlay-gradient" />
              </div>
              {/* Overlapping stat card */}
              <div className="absolute -bottom-6 -left-6 md:-left-10 bg-brand-white border border-brand-gray p-6 md:p-8 shadow-elevated animate-slide-up">
                <p className="font-display font-bold text-display-md">10+</p>
                <p className="text-caption text-brand-grayMid">Unidades</p>
              </div>
            </div>
          </div>
        </Container>

        {/* Stats Bar */}
        <div className="border-t border-brand-gray mt-16 md:mt-24">
          <Container>
            <div className="grid grid-cols-3 gap-8 py-12 md:py-16">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center border-l border-brand-gray first:border-0 pl-8 first:pl-0">
                  <p className="font-display font-bold text-display-lg md:text-display-xl">{stat.value}</p>
                  <p className="text-caption text-brand-grayMid mt-1">{stat.label}</p>
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
              <Badge variant="outline" className="mb-4">NOSSA MISSÃO</Badge>
              <h2 className="text-display-md md:text-display-lg mb-6">
                Qualidade, estilo e precisão em cada corte
              </h2>
              <p className="text-body-lg text-brand-grayMid mb-6">
                A MR. CUT nasceu da ideia de que o corte de cabelo masculino não precisa ser complicado.
                Unimos a tradição da barbearia clássica — toalha quente, navalha, precisão — com a conveniência
                do mundo digital: agendamento 24/7, escolha de profissional, lembretes automáticos.
              </p>
              <p className="text-body text-brand-grayMid mb-8">
                Cada unidade segue o mesmo padrão de excelência. Do Centro à Vila Madalena,
                você sabe exatamente o que vai encontrar: profissionais treinados, equipamentos de ponta
                e um ambiente pensado para o homem moderno.
              </p>
              <Link to="#locations">
                <Button variant="outline" size="lg">Conheça nossas unidades</Button>
              </Link>
            </div>
            <div className="relative aspect-landscape">
              <img
                src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1000&q=80"
                alt="Barbeiro trabalhando em corte preciso"
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
            {services.map((service) => (
              <Link
                key={service.name}
                to="/agendar"
                className="card-hover flex flex-col p-6 md:p-8 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="font-display font-semibold text-body-lg">{service.name}</h3>
                  <span className="badge badge-muted flex-shrink-0">{service.duration}</span>
                </div>

                <p className="text-body-sm text-brand-grayMid mb-8 flex-1">{service.description}</p>

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

      {/* Reviews */}
      <Section id="reviews" size="lg">
        <Container>
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">AVALIAÇÕES</Badge>
            <h2 className="text-display-md md:text-display-lg mb-4">O que dizem nossos clientes</h2>
            <p className="text-body-lg text-brand-grayMid">Mais de 80.000 clientes satisfeitos</p>
          </div>

          <div className="grid-editorial-3">
            {reviews.map((review) => (
              <Card key={review.name} variant="padded">
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <img src={review.avatar} alt={review.name} className="w-12 h-12 rounded-full object-cover border border-brand-gray" />
                    <div>
                      <p className="font-display font-medium text-body">{review.name}</p>
                      <p className="text-caption text-brand-grayMid">{review.role}</p>
                    </div>
                  </div>
                  <p className="text-body text-brand-grayMid mb-4">"{review.text}"</p>
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1,2,3,4,5].map(() => <svg key={Math.random()} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Locations */}
      <Section id="locations" size="lg" background="gray">
        <Container>
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">UNIDADES</Badge>
            <h2 className="text-display-md md:text-display-lg mb-4">Onde nos encontrar</h2>
            <p className="text-body-lg text-brand-grayMid">Três unidades em São Paulo, mesma excelência</p>
          </div>

          <div className="grid-editorial-3">
            {locations.map((loc) => (
              <Card key={loc.name} variant="hover">
                <CardContent>
                  <h3 className="font-display font-semibold text-body-lg mb-2">{loc.name}</h3>
                  <p className="text-body-sm text-brand-grayMid mb-1">{loc.address}</p>
                  <p className="text-body-sm text-brand-grayMid mb-4">{loc.city}</p>
                  <div className="divider" />
                  <p className="text-caption text-brand-grayMid">{loc.hours}</p>
                  <Link to="/agendar" className="mt-6 block">
                    <Button variant="minimal" className="w-full justify-center">Agendar nesta unidade</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mapa — iframe do Google não renderiza em screenshots, bloqueadores
              ou sem consentimento de cookies. O frame com cabeçalho garante
              que mesmo vazio o bloco pareça intencional, e o link externo
              sempre dá saída. */}
          <figure className="mt-14 border border-brand-gray bg-brand-white">
            <figcaption className="flex items-center justify-between gap-4 px-5 py-3 border-b border-brand-gray">
              <span className="font-display text-caption">ONDE NOS ENCONTRAR</span>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Avenida+Paulista,+S%C3%A3o+Paulo+-+SP"
                target="_blank"
                rel="noreferrer"
                className="btn-minimal"
              >
                Abrir no Google Maps
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </figcaption>
            <div className="relative aspect-[21/9] bg-brand-grayLight">
              <iframe
                src="https://www.google.com/maps?q=Avenida+Paulista,+S%C3%A3o+Paulo+-+SP&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                // Escala de cinza mantém o mapa dentro da paleta monocromática;
                // no hover volta ao normal para a pessoa navegar com cores.
                className="absolute inset-0 w-full h-full grayscale contrast-[1.05] transition-[filter] duration-normal hover:grayscale-0"
                title="Mapa das unidades MR. CUT"
              />
            </div>
          </figure>
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

      {/* Footer */}
      <footer className="border-t border-brand-gray py-12">
        <Container>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link to="/" className="font-display font-bold text-display-sm tracking-tight block mb-4">MR. CUT</Link>
              <p className="text-body-sm text-brand-grayMid max-w-sm">
                Rede de barbearias premium em São Paulo. Qualidade, estilo e precisão desde 2019.
              </p>
            </div>
            <div>
              <h4 className="font-display font-medium text-caption text-brand-grayMid mb-3">UNIDADES</h4>
              <ul className="space-y-2 text-body-sm text-brand-grayMid">
                {locations.map((l) => <li key={l.name}>{l.name}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-display font-medium text-caption text-brand-grayMid mb-3">CONTATO</h4>
              <ul className="space-y-2 text-body-sm text-brand-grayMid">
                <li>(11) 99999-9999</li>
                <li>contato@mrcut.com.br</li>
              </ul>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-caption text-brand-grayMid text-center">© 2024 MR. CUT. Todos os direitos reservados.</p>
        </Container>
      </footer>
    </div>
  );
}

export default LandingPage;