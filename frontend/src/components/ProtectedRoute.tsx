import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

interface ProtectedRouteProps {
  allowedRoles: ('OWNER' | 'EMPLOYEE' | 'CLIENT')[];
  children?: ReactNode;
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-black border-t-transparent" />
    </div>
  );
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    // Rota da home de acordo com o perfil do usuário
    const home = role === 'OWNER' ? '/owner/dashboard' : role === 'EMPLOYEE' ? '/funcionario/agenda' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;

  if (isAuthenticated) {
    const home = role === 'OWNER' ? '/owner/dashboard' : role === 'EMPLOYEE' ? '/funcionario/agenda' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
