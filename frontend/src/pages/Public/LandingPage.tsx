import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Seu salão de beleza
              <br />
              <span className="text-yellow-300">na palma da mão</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl">
              Agende seus serviços favoritos online, escolha seu profissional preferido 
              e gerencie seus horários de forma simples e rápida.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/agendar"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-blue-700 bg-white rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
              >
                Agendar Horário
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/login/cliente"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-500/20 border-2 border-white rounded-xl hover:bg-blue-500/30 transition-colors"
              >
                Já sou cliente
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent" />
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Por que escolher nosso salão?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experiência completa de agendamento pensada para sua comodidade
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon=""
              title="Agendamento Online"
              description="Marque seu horário 24/7 sem precisar ligar. Escolha serviço, profissional e melhor horário."
            />
            <FeatureCard
              icon=""
              title="Profissionais Especializados"
              description="Cada profissional tem sua agenda própria. Veja especialidades e escolha quem preferir."
            />
            <FeatureCard
              icon=""
              title="Lembretes Automáticos"
              description="Receba avisos no WhatsApp no dia do seu agendamento e no seu aniversário."
            />
            <FeatureCard
              icon=""
              title="Gerencie pelo Celular"
              description="Acesse seus agendamentos, cancele ou reagende direto do seu telefone."
            />
            <FeatureCard
              icon=""
              title="Serviços Personalizados"
              description="Cortes, colorações, tratamentos e muito mais. Preços e durações transparentes."
            />
            <FeatureCard
              icon=""
              title="Presente de Aniversário"
              description="Cliente aniversariante ganha vantagens especiais no mês do aniversário."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pronto para agendar?</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            É rápido, fácil e você confirma na hora. Sem burocracia.
          </p>
          <Link
            to="/agendar"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-900 bg-white rounded-xl hover:bg-gray-100 transition-colors"
          >
            Agendar Agora
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 hover:shadow-lg transition-shadow text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}