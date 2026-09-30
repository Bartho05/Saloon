import { useAuth as useAuthContext } from '@contexts/AuthContext';

/**
 * Hook de acesso à autenticação.
 *
 * Antes este arquivo também exportava `fetchWithAuth` (com refresh automático
 * de token) e `useRequireAuth`. Ambos estavam sem uso e `fetchWithAuth` duplicava
 * o `request()` de `@services/api` sem aplicar o prefixo `/api` — ou seja,
 * qualquer uso futuro quebraria silenciosamente. A proteção de rota vive em
 * `@components/ProtectedRoute`.
 */
export function useAuth() {
  return useAuthContext();
}
