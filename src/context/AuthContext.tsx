import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'member';
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  csrfToken: string | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (user: User) => void;
  refreshCsrfToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const refreshCsrfToken = async () => {
    try {
      const res = await fetch('/api/csrf-token');
      if (!res.ok) throw new Error('Failed to get CSRF token');
      const data = await res.json();
      const token = data.csrfToken || null;
      setCsrfToken(token);
      if (token) {
        localStorage.setItem('csrfToken', token);
      } else {
        localStorage.removeItem('csrfToken');
      }
    } catch (_err) {
      setCsrfToken(null);
      localStorage.removeItem('csrfToken');
    }
  };

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        const token = data.csrfToken || null;
        setCsrfToken(token);
        if (token) {
          localStorage.setItem('csrfToken', token);
        } else {
          localStorage.removeItem('csrfToken');
        }
      } else {
        setUser(null);
        setCsrfToken(null);
        localStorage.removeItem('csrfToken');
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    refreshCsrfToken();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken || ''
      }
    });
    setUser(null);
    setCsrfToken(null);
  };

  const updateProfile = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, csrfToken, login, logout, refreshUser, updateProfile, refreshCsrfToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
