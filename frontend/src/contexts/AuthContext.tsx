import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authApi } from '@services/api';
import type { AuthState, User, Client } from '@types';

interface AuthContextType extends AuthState {
  loginOwner: (email: string, password: string) => Promise<void>;
  loginEmployee: (accessCode: string) => Promise<void>;
  requestClientCode: (phone: string) => Promise<void>;
  verifyClientCode: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    role: null,
  });

  const [loading, setLoading] = useState(true);

  // Carrega tokens do localStorage na inicialização
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (accessToken && refreshToken) {
        try {
          const res = await authApi.getMe();
          if ('user' in res) {
            setState({
              user: res.user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              role: res.user.role,
            });
          } else if ('client' in res) {
            setState({
              user: res.client,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              role: 'CLIENT',
            });
          }
        } catch {
          // Token inválido, limpa
          clearAuth();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      role: null,
    });
  };

  const saveTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  const loginOwner = async (email: string, password: string) => {
    const res = await authApi.ownerLogin(email, password);
    saveTokens(res.accessToken, res.refreshToken);
    setState({
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      isAuthenticated: true,
      role: 'OWNER',
    });
  };

  const loginEmployee = async (accessCode: string) => {
    const res = await authApi.employeeLogin(accessCode);
    saveTokens(res.accessToken, res.refreshToken);
    setState({
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      isAuthenticated: true,
      role: 'EMPLOYEE',
    });
  };

  const requestClientCode = async (phone: string) => {
    await authApi.clientRequestCode(phone);
  };

  const verifyClientCode = async (phone: string, code: string) => {
    const res = await authApi.clientVerifyCode(phone, code);
    saveTokens(res.accessToken, res.refreshToken);
    setState({
      user: res.client,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      isAuthenticated: true,
      role: 'CLIENT',
    });
  };

  const logout = () => {
    clearAuth();
  };

  const refreshAuth = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    try {
      const res = await authApi.refreshToken(refreshToken);
      saveTokens(res.accessToken, res.refreshToken);
      setState(prev => ({ ...prev, accessToken: res.accessToken, refreshToken: res.refreshToken }));
    } catch {
      clearAuth();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loading, loginOwner, loginEmployee, requestClientCode, verifyClientCode, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}