import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@components/Sidebar';
import { SalonBrand } from '@components/SalonBrand';
import { DevCredits } from '@components/DevCredits';
import { useAuth } from '@hooks/useAuth';

interface DashboardLayoutProps {
  variant: 'owner' | 'employee' | 'client';
}

export function DashboardLayout({ variant }: DashboardLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Fecha o menu ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-white">
        <div className="w-10 h-10 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-brand-grayLight lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-brand-gray bg-brand-white z-30">
        <Sidebar variant={variant} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-brand-gray bg-brand-white animate-fade-in">
            <Sidebar variant={variant} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:col-start-2 min-w-0">
        {/* Header mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-brand-white border-b border-brand-gray">
          <div className="flex items-center justify-between h-16 px-4">
            <SalonBrand size="sm" />
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -mr-2 text-brand-black"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8 xl:p-10">
          <Outlet />
        </main>

        {/* Créditos do desenvolvedor — mesma assinatura em todos os painéis */}
        <footer className="px-4 md:px-6 lg:px-8 xl:px-10 pb-8">
          <DevCredits tone="aside" />
        </footer>
      </div>
    </div>
  );
}

export default DashboardLayout;