import { Outlet } from 'react-router-dom';
import { Sidebar } from '@components/Sidebar';
import { useAuth } from '@hooks/useAuth';

interface DashboardLayoutProps {
  variant: 'owner' | 'employee';
}

export function DashboardLayout({ variant }: DashboardLayoutProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-64">
      <Sidebar variant={variant} />
      
      <div className="lg:pl-4">
        <header className="sticky top-0 z-40 bg-white shadow-sm lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <h1 className="text-xl font-bold text-blue-600">Salão Beleza</h1>
            <button className="p-2 rounded-lg hover:bg-gray-100" aria-label="Abrir menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}