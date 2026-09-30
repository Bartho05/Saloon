import { NavLink } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

interface SidebarProps {
  variant: 'owner' | 'employee';
  onNavigate?: () => void;
}

const ownerMenu = [
  { label: 'Dashboard', href: '/owner/dashboard', icon: HomeIcon },
  { label: 'Serviços', href: '/owner/servicos', icon: ScissorsIcon },
  { label: 'Funcionários', href: '/owner/funcionarios', icon: UsersIcon },
  { label: 'Agenda', href: '/owner/agenda', icon: CalendarIcon },
  { label: 'Configurações', href: '/owner/configuracoes', icon: SettingsIcon },
];

const employeeMenu = [
  { label: 'Minha Agenda', href: '/funcionario/agenda', icon: CalendarIcon },
  { label: 'Agendamentos', href: '/funcionario/agendamentos', icon: ListIcon },
  { label: 'Perfil', href: '/funcionario/perfil', icon: UserIcon },
];

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function ScissorsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.101v3.867M9 14.25v2.25m-2.247-3.375l1.515 1.515m0 0l1.515 1.516m-1.515-1.515l-1.515 1.515M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>;
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function ListIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function UserIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}

export function Sidebar({ variant, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const menu = variant === 'owner' ? ownerMenu : employeeMenu;
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
            <p className="text-caption text-brand-grayMid">{variant === 'owner' ? 'Proprietário' : 'Funcionário'}</p>
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