import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { Button } from '@components/ui';

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

/**
 * Falha temporária ao reidratar a sessão.
 *
 * Os tokens estão no navegador, mas a chamada que valida a sessão falhou por
 * um motivo passageiro (429 do limite de requisições, 500, queda de rede).
 * Redirecionar para o login nesse caso é punir o usuário por um problema que
 * não é dele: ele é expulso do painel e perde o trabalho no meio. A sessão
 * continua salva — basta tentar de novo.
 */
function SessionRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display-md mb-4">Não foi possível carregar</h1>
        <p className="text-body-lg text-brand-grayMid mb-8">{message}</p>
        <p className="text-body-sm text-brand-grayMid mb-8">
          Você continua com a sua conta. Tente novamente em instantes.
        </p>
        <Button variant="solid" size="lg" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading, sessionError, refreshAuth } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;

  // Token existe mas a validação falhou: espera o usuário pedir de novo em vez
  // de mandar para o login.
  if (!isAuthenticated && sessionError) {
    return <SessionRetry message={sessionError} onRetry={() => void refreshAuth()} />;
  }

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
