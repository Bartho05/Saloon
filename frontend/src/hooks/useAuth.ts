import { useCallback, useEffect, useState } from 'react';
import { authApi } from '@services/api';
import { useAuth as useAuthContext } from '@contexts/AuthContext';
import type { User, Client } from '@types';

export function useAuth() {
  const auth = useAuthContext();

  // Wrapper para refresh automático em erros 401
  const fetchWithAuth = useCallback(async <T,>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const token = localStorage.getItem('accessToken');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Se 401, tenta refresh token
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await authApi.refreshToken(refreshToken);
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
          
          // Retry com novo token
          (headers as Record<string, string>)['Authorization'] = `Bearer ${res.accessToken}`;
          response = await fetch(url, { ...options, headers });
        } catch {
          // Refresh falhou, logout
          auth.logout();
          throw new Error('Sessão expirada. Faça login novamente.');
        }
      } else {
        auth.logout();
        throw new Error('Não autenticado');
      }
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Erro na requisição');
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }, [auth]);

  return {
    ...auth,
    fetchWithAuth,
  };
}

// Hook para proteger rotas por role
export function useRequireAuth(allowedRoles: ('OWNER' | 'EMPLOYEE' | 'CLIENT')[]) {
  const { isAuthenticated, role, loading } = useAuthContext();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAuthorized(isAuthenticated && role && allowedRoles.includes(role));
    }
  }, [isAuthenticated, role, loading, allowedRoles]);

  return { authorized, loading: loading || !authorized };
}

// Hook para dados do usuário tipado
export function useUser() {
  const { user, role } = useAuthContext();

  if (role === 'CLIENT') {
    return { user: user as Client, isClient: true, isEmployee: false, isOwner: false };
  }
  
  if (role === 'EMPLOYEE') {
    return { user: user as User, isClient: false, isEmployee: true, isOwner: false };
  }
  
  if (role === 'OWNER') {
    return { user: user as User, isClient: false, isEmployee: false, isOwner: true };
  }

  return { user: null, isClient: false, isEmployee: false, isOwner: false };
}