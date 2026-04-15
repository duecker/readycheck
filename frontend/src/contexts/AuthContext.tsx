import React, { createContext, useContext, useState } from 'react';

interface AuthState {
  token: string | null;
  user: { id: string; name: string; email: string; role: string } | null;
  teamId: string | null;
  teamName: string | null;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: any, teamId: string, teamName: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    token: localStorage.getItem('rc_token'),
    user: JSON.parse(localStorage.getItem('rc_user') || 'null'),
    teamId: localStorage.getItem('rc_teamId'),
    teamName: localStorage.getItem('rc_teamName')
  });

  const login = (token: string, user: any, teamId: string, teamName: string) => {
    localStorage.setItem('rc_token', token);
    localStorage.setItem('rc_user', JSON.stringify(user));
    localStorage.setItem('rc_teamId', teamId);
    localStorage.setItem('rc_teamName', teamName);
    setAuth({ token, user, teamId, teamName });
  };

  const logout = () => {
    localStorage.removeItem('rc_token');
    localStorage.removeItem('rc_user');
    localStorage.removeItem('rc_teamId');
    localStorage.removeItem('rc_teamName');
    setAuth({ token: null, user: null, teamId: null, teamName: null });
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
