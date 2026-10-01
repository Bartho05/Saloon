import type { ReactNode } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { DevCredits } from '@components/DevCredits';
import { Button } from '@components/ui';
import {
  ShieldIcon,
  UserPlusIcon,
  KeyIcon,
  ListIcon,
  GridIcon,
  ArrowLeftIcon,
} from '@components/icons';

interface SuperAdminLayoutProps {
  children?: ReactNode;
}

/**
 * Marca do painel de administração.
 *
 * NÃO é o `SalonBrand`. Aqui o superadmin controla a instalação inteira, não
 * um salão: mostrar o nome do salão no topo sugeriria que aquele painel
 * pertence àquele estabelecimento, e é exatamente o contrário da permissão que
 * ele tem. O rótulo é fixo, e o nome de quem está logado fica logo abaixo.
 */
function BrandMark() {
  return (
    <span className="font-display font-bold tracking-tight text-brand-white">
      Administração
    </span>
  );
}

/**
 * Layout do superadmin: sidebar escura + conteúdo.
 *
 * Não reaproveita o `DashboardLayout` de propósito. As seções aqui são sobre a
 * instalação inteira, não sobre um salão: não faz sentido o nome do salão no
 * cabeçalho nem o mesmo menu de um dono. Além disso, o acesso máximo precisa
 * ficar visualmente distinto — é a tela mais sensível do produto e o operador
 * tem que saber na hora em que está nela.
 *
 * `children` é opcional porque a rota usa `<Outlet />` dentro. Tipar como
 * obrigatório faria o TypeScript reclamar do uso sem children, mesmo com o
 * Outlet resolvendo o conteúdo na prática.
 */
export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const nome = user && 'name' in user ? user.name : 'Administrador';

  const sair = () => {
    logout();
    navigate('/superadmin/login', { replace: true });
  };

  const SECTIONS: Array<{ title: string; items: Array<{ to: string; label: string; icon: any; end?: boolean }> }> = [
    {
      title: 'Instalação',
      items: [
        { to: '/superadmin', label: 'Visão geral', icon: GridIcon, end: true },
        { to: '/superadmin/proprietarios', label: 'Proprietários', icon: UserPlusIcon },
      ],
    },
    {
      title: 'Controle',
      items: [
        { to: '/superadmin/contas', label: 'Contas de acesso', icon: ShieldIcon },
        { to: '/superadmin/auditoria', label: 'Auditoria', icon: ListIcon },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-brand-grayLight lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:flex flex-col bg-brand-black text-brand-white fixed inset-y-0 left-0 w-64 z-30">
        <div className="flex items-center h-16 px-5 border-b border-white/15 flex-shrink-0">
          <BrandMark />
        </div>

        <div className="px-5 py-5 border-b border-white/15">
          <p className="font-display text-caption uppercase tracking-wider text-white/50">
            Acesso máximo
          </p>
          <p className="font-display font-bold text-body mt-1 truncate">{nome}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="px-5 mb-2 font-display text-caption uppercase tracking-wider text-white/40">
                {section.title}
              </p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-5 py-2.5 text-body-sm transition-colors duration-fast ${
                          isActive
                            ? 'bg-white/10 text-white font-display font-medium border-l-2 border-white'
                            : 'text-white/65 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-5 border-t border-white/15 flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-0 py-2 text-body-sm text-white/60 hover:text-white transition-colors duration-fast"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar ao site
          </button>
          <button
            onClick={sair}
            className="w-full flex items-center gap-3 py-2 text-body-sm text-white/60 hover:text-white transition-colors duration-fast"
          >
            <KeyIcon className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:col-start-2 min-w-0">
        {/* Navegação no mobile */}
        <div className="lg:hidden bg-brand-black text-brand-white sticky top-0 z-40">
          <div className="flex items-center justify-between h-16 px-4">
            <BrandMark />
            <button
              onClick={sair}
              className="text-caption text-white/70 hover:text-white transition-colors duration-fast"
            >
              Sair
            </button>
          </div>
          <nav className="flex overflow-x-auto border-t border-white/15">
            {SECTIONS.flatMap((s) => s.items).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-caption whitespace-nowrap transition-colors duration-fast ${
                    isActive
                      ? 'bg-white/10 text-white border-b-2 border-white'
                      : 'text-white/60 border-b-2 border-transparent'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="p-4 md:p-6 lg:p-8 xl:p-10">
          {children ?? <Outlet />}
        </main>

        <footer className="px-4 md:px-6 lg:px-8 xl:px-10 pb-8">
          <DevCredits tone="aside" />
        </footer>
      </div>
    </div>
  );
}

/**
 * Cabeçalho das telas internas do superadmin.
 *
 * `descricao` é o que explica POR QUE a tela existe. Na instalação, quase toda
 * tela responde a "o que ainda falta para isso funcionar?" — deixar isso
 * escrito evita que o operador precise deduzir olhando números.
 */
export function SuperAdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 pb-6 border-b border-brand-gray">
      <div className="min-w-0">
        <h1 className="text-display-md md:text-display-lg">{title}</h1>
        {description && <p className="text-body text-brand-grayMid mt-2">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export { Button };
