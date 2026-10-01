import { NavLink } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import {
  HomeIcon,
  ScissorsIcon,
  UsersIcon,
  CalendarIcon,
  SettingsIcon,
  ListIcon,
  UserIcon,
  LogoutIcon,
  WalletIcon,
  MapPinIcon,
} from '@components/icons';

interface SidebarProps {
  variant: 'owner' | 'employee' | 'client';
  onNavigate?: () => void;
}

const ownerMenu = [
  { label: 'Dashboard', href: '/owner/dashboard', icon: HomeIcon },
  { label: 'Serviços', href: '/owner/servicos', icon: ScissorsIcon },
  { label: 'Funcionários', href: '/owner/funcionarios', icon: UsersIcon },
  { label: 'Agenda', href: '/owner/agenda', icon: CalendarIcon },
  { label: 'Financeiro', href: '/owner/financeiro', icon: WalletIcon },
  { label: 'Configurações', href: '/owner/configuracoes', icon: SettingsIcon },
];

const employeeMenu = [
  { label: 'Minha Agenda', href: '/funcionario/agenda', icon: CalendarIcon },
  { label: 'Agendamentos', href: '/funcionario/agendamentos', icon: ListIcon },
  { label: 'Meu Faturamento', href: '/funcionario/financeiro', icon: WalletIcon },
  { label: 'Salão', href: '/funcionario/salao', icon: MapPinIcon },
  { label: 'Perfil', href: '/funcionario/perfil', icon: UserIcon },
];

const clientMenu = [
  { label: 'Meus Agendamentos', href: '/meus-agendamentos', icon: CalendarIcon },
  { label: 'Agendar', href: '/agendar', icon: ScissorsIcon },
  { label: 'Meu Perfil', href: '/meu-perfil', icon: UserIcon },
];

const variantLabels: Record<SidebarProps['variant'], string> = {
  owner: 'Proprietário',
  employee: 'Funcionário',
  client: 'Cliente',
};

export function Sidebar({ variant, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const menu = variant === 'owner' ? ownerMenu : variant === 'client' ? clientMenu : employeeMenu;
  const displayName =
    user && 'name' in user ? user.name : user && 'fullName' in user ? user.fullName : 'Usuário';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-brand-white">
      {/* Brand */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-brand-gray flex-shrink-0">
        <span className="font-display font-bold text-body-lg tracking-tight">MR. CUT</span>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="lg:hidden p-1 -mr-1 text-brand-black"
            aria-label="Fechar menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* User */}
      <div className="px-5 py-5 border-b border-brand-gray flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-black text-brand-white flex items-center justify-center flex-shrink-0 font-display font-bold text-body">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-display font-medium text-body-sm truncate">{displayName}</p>
            <p className="text-caption text-brand-grayMid">{variantLabels[variant]}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Menu principal">
        {menu.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-3 font-display text-body-sm
              border-l-2 transition-colors duration-fast mb-0.5
              ${isActive
                ? 'border-brand-black text-brand-black bg-brand-grayLight'
                : 'border-transparent text-brand-grayMid hover:text-brand-black hover:border-brand-gray'
              }
            `}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-brand-gray flex-shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-3 font-display text-body-sm text-brand-grayMid hover:text-brand-black transition-colors duration-fast"
        >
          <LogoutIcon className="w-4 h-4 flex-shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );
}

export default Sidebar;