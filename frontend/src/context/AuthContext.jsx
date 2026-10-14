import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../api/client';
import { cacheBankPublicKey } from '../db/indexedDB';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('op_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('op_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await apiService.getMe();
          setUser(res.data);
          localStorage.setItem('op_user', JSON.stringify(res.data));

          // Pre-cache Bank Public Key for offline verification
          try {
            const bankKeyRes = await apiService.getBankPublicKey();
            if (bankKeyRes.data && bankKeyRes.data.spki_b64) {
              await cacheBankPublicKey(bankKeyRes.data.spki_b64);
            }
          } catch (e) {
            console.warn('Could not cache bank public key on startup:', e);
          }
        } catch (err) {
          console.error('Failed to restore session:', err);
          // If offline, keep local user!
          if (navigator.onLine) {
            logout();
          }
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [token]);

  const login = async (username, password) => {
    const res = await apiService.login(username, password);
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('op_token', access_token);
    localStorage.setItem('op_user', JSON.stringify(userData));

    // Cache bank public key
    try {
      const bankKeyRes = await apiService.getBankPublicKey();
      if (bankKeyRes.data && bankKeyRes.data.spki_b64) {
        await cacheBankPublicKey(bankKeyRes.data.spki_b64);
      }
    } catch (e) {
      console.warn('Bank key fetch failed:', e);
    }

    return userData;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('op_token');
    localStorage.removeItem('op_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
