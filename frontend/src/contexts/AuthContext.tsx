import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authApi, isAuthFailure } from '@services/api';
import type { AuthState } from '@types';

interface AuthContextType extends AuthState {
  /** true enquanto os tokens do localStorage estão sendo validados */
  loading: boolean;
  /**
   * Mensagem de falha passageira ao reidratar ("Você fez muitas requisições…").
   * Preenchida quando os tokens existem mas a consulta falhou por 429/500/rede.
   * Nula quando não há sessão, ou quando a sessão acabou de verdade.
   */
  sessionError: string | null;
  loginOwner: (email: string, password: string) => Promise<void>;
  loginEmployee: (accessCode: string) => Promise<void>;
  requestClientCode: (phone: string) => Promise<string | null>;
  verifyClientCode: (phone: string, code: string) => Promise<{ isNewClient: boolean }>;
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

  /**
   * Mensagem de falha passageira ao reidratar a sessão.
   *
   * Distingue "não estou logado" de "não consegui conferir se estou logado".
   * Sem isso, um 429 jogava o dono para a tela de login mesmo com o token
   * válido, e ele achava que a conta tinha sido desconectada.
   */
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Reidrata a sessão salva no navegador.
  //
  // O código do WhatsApp só é pedido na primeira verificação (criação de
  // conta) ou quando o refresh token expira (15 dias). O request() já
  // renova o access token sozinho em 401, mas na montagem o primeiro getMe
  // acontece antes de qualquer outra chamada — então tratamos o 401 aqui
  // também, em vez de limpar a sessão.
  useEffect(() => {
    const initAuth = async () => {
      if (!localStorage.getItem('accessToken') || !localStorage.getItem('refreshToken')) {
        setLoading(false);
        return;
      }

      try {
        // getMe já faz refresh+retry internamente quando o access expirou
        const res = await authApi.getMe();

        const user = 'user' in res ? res.user : res.client;
        const role = 'user' in res ? res.user.role : ('CLIENT' as const);

        setState({
          user,
          accessToken: localStorage.getItem('accessToken'),
          refreshToken: localStorage.getItem('refreshToken'),
          isAuthenticated: true,
          role,
        });
      } catch (err) {
        /**
         * Só descarta a sessão quando a falha é de AUTENTICAÇÃO.
         *
         * Antes qualquer erro derrubava o login — inclusive 429 do rate
         * limiter, 500 e queda de rede. Perder a sessão por um 429 é o pior
         * caso possível: obriga o dono a digitar e-mail e senha de novo por
         * causa de um limite que ele nem caused, e o refresh token de 15 dias
         * ia para o lixo junto.
         *
         * Erro transitório mantém os tokens e a tela segue protegida — a
         * rota protegida espera o `loading` baixar, e o usuário só é jogado
         * para o login se o token realmente não servir mais.
         */
        if (isAuthFailure(err)) {
          clearAuth();
        } else {
          setSessionError(
            err instanceof Error && err.message
              ? err.message
              : 'A conexão falhou ao carregar sua conta.'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void initAuth();

    // refreshSession() dispara este evento quando o refresh token também
    // expirou — aí sim a sessão acabou de verdade.
    const onExpired = () => {
      setSessionError(null);
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        role: null,
      });
    };

    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setSessionError(null);
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
    const res = await authApi.clientRequestCode(phone);
    // Em dev, retorna o código para exibir na tela
    return res.code || null;
  };

  /**
   * Verifica o código do WhatsApp.
   *
   * Retorna `isNewClient: true` quando o telefone ainda não tem cadastro:
   * o servidor NÃO cria um cliente provisório nesse caso (virava "Cliente
   * WhatsApp" na agenda), e o painel do cliente precisa saber disso para
   * mandar a pessoa criar o cadastro em vez de tentar abrir uma conta
   * inexistente.
   */
  const verifyClientCode = async (phone: string, code: string) => {
    const res = await authApi.clientVerifyCode(phone, code);

    if (res.isNew || !res.accessToken || !res.client) {
      return { isNewClient: true };
    }

    // `refreshToken` é null na prática quando há token, mas o tipo do
    // servidor é `string | null`; o guard acima já garante os dois.
    saveTokens(res.accessToken, res.refreshToken!);
    setState({
      user: res.client,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken!,
      isAuthenticated: true,
      role: 'CLIENT',
    });

    return { isNewClient: false };
  };

  const logout = () => {
    clearAuth();
  };

  /**
   * Revalida a sessão a partir dos tokens que já estão no navegador.
   *
   * Serve ao botão "Tentar novamente" da tela de falha passageira: não pede
   * senha de novo, só refaz a consulta. Também é o `retry` da reidratação.
   */
  const refreshAuth = useCallback(async () => {
    if (!localStorage.getItem('accessToken') || !localStorage.getItem('refreshToken')) {
      setSessionError(null);
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.getMe();
      const user = 'user' in res ? res.user : res.client;
      const role = 'user' in res ? res.user.role : ('CLIENT' as const);

      setSessionError(null);
      setState({
        user,
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        isAuthenticated: true,
        role,
      });
    } catch (err) {
      if (isAuthFailure(err)) {
        // Token recusado de verdade: agora sim a sessão acabou.
        clearAuth();
        setSessionError(null);
      } else {
        setSessionError(
          err instanceof Error && err.message
            ? err.message
            : 'A conexão falhou ao carregar sua conta.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loading, sessionError, loginOwner, loginEmployee, requestClientCode, verifyClientCode, logout, refreshAuth }}>
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