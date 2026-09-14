import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  /**
   * Relê o perfil do servidor. Usado por telas que alteram algo exibido no
   * cabeçalho — hoje a medalha de Contexto Completo —, para o reflexo ser
   * imediato em vez de depender de o usuário recarregar a página.
   */
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pbl_user_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pbl_auth_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      apiRequest('/auth/profile')
        .then((u) => {
          setUser(u);
          localStorage.setItem('pbl_user_data', JSON.stringify(u));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, senha: string) => {
    const data = await apiRequest<{ token: string; usuario: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });

    setToken(data.token);
    setUser(data.usuario);
    localStorage.setItem('pbl_auth_token', data.token);
    localStorage.setItem('pbl_user_data', JSON.stringify(data.usuario));
  };

  const refreshUser = async () => {
    if (!localStorage.getItem('pbl_auth_token')) return;
    try {
      const u = await apiRequest<User>('/auth/profile');
      setUser(u);
      localStorage.setItem('pbl_user_data', JSON.stringify(u));
    } catch {
      // Falha aqui é cosmética: o cabeçalho continua com o dado anterior e a
      // próxima carga da página corrige. Derrubar a sessão seria pior.
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pbl_auth_token');
    localStorage.removeItem('pbl_user_data');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
