import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';
import i18n from '../i18n/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize authentication state on load with permanent persistence
  useEffect(() => {
    const initializeAuth = async () => {
      // Check localStorage first, fallback to sessionStorage
      const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          // 1. Optimistic Auth: set state immediately so the user never sees login screen
          setToken(savedToken);
          setUser(parsedUser);
          
          if (parsedUser.preferred_language) {
            i18n.changeLanguage(parsedUser.preferred_language);
          }
          if (parsedUser.farmer_mode) {
            document.body.classList.add('farmer-mode');
          } else {
            document.body.classList.remove('farmer-mode');
          }

          // Always ensure persisted in localStorage so closing the browser never logs the user out
          localStorage.setItem('token', savedToken);
          localStorage.setItem('user', JSON.stringify(parsedUser));

          // 2. Validate in background with backend
          try {
            const res = await API.get('/api/auth/profile');
            if (res.data) {
              setUser(res.data);
              localStorage.setItem('user', JSON.stringify(res.data));
              if (res.data.preferred_language) {
                i18n.changeLanguage(res.data.preferred_language);
              }
            }
          } catch (profileErr) {
            // ONLY log out if the backend explicitly rejected the token as 401 Unauthorized
            if (profileErr.response && profileErr.response.status === 401) {
              console.warn("Token expired or revoked by server. Clearing session.");
              localStorage.removeItem('token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('refresh_token');
              sessionStorage.removeItem('user');
              setToken(null);
              setUser(null);
            } else {
              // Network error, backend cold-start, or offline: KEEP USER LOGGED IN!
              console.info("Offline / server spin-up: retaining authenticated farmer session.");
            }
          }
        } catch (parseErr) {
          console.error("Failed to parse saved user credentials:", parseErr);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password, rememberMe = true, botTrap = '') => {
    setLoading(true);
    try {
      const payload = { email: email.trim(), password, remember_me: true };
      if (botTrap) payload.bot_trap = botTrap;
      const res = await API.post('/api/auth/login', payload);
      const { access_token, refresh_token, user: userData } = res.data;

      // Clear both storages to ensure clean state
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user');

      setToken(access_token);
      setUser(userData);
      
      if (userData.preferred_language) {
        i18n.changeLanguage(userData.preferred_language);
      }

      if (userData.farmer_mode) {
        document.body.classList.add('farmer-mode');
      } else {
        document.body.classList.remove('farmer-mode');
      }

      // Permanent persistent storage in localStorage by default
      localStorage.setItem('token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const biometricLogin = async (email, credentialId) => {
    setLoading(true);
    try {
      const payload = { email: (email || '').trim(), credential_id: credentialId };
      const res = await API.post('/api/auth/biometric/login', payload);
      const { access_token, refresh_token, user: userData } = res.data;

      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user');

      setToken(access_token);
      setUser(userData);

      if (userData.preferred_language) {
        i18n.changeLanguage(userData.preferred_language);
      }

      if (userData.farmer_mode) {
        document.body.classList.add('farmer-mode');
      } else {
        document.body.classList.remove('farmer-mode');
      }

      localStorage.setItem('token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, preferred_language = 'en', botTrap = '') => {
    setLoading(true);
    try {
      const payload = { name, email, password, role: 'farmer', preferred_language };
      if (botTrap) payload.bot_trap = botTrap;
      const res = await API.post('/api/auth/register', payload);
      // Auto-login with permanent persistence (rememberMe = true)
      return await login(email, password, true, botTrap);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {
      console.warn("Backend logout failed or session already expired", e);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user');
      setToken(null);
      setUser(null);
      document.body.classList.remove('farmer-mode');
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await API.put('/api/auth/profile', profileData);
      const updatedUser = res.data;
      setUser(updatedUser);
      
      if (updatedUser.preferred_language) {
        i18n.changeLanguage(updatedUser.preferred_language);
      }
      
      if (updatedUser.farmer_mode !== undefined) {
        if (updatedUser.farmer_mode) {
          document.body.classList.add('farmer-mode');
        } else {
          document.body.classList.remove('farmer-mode');
        }
      }

      // Keep it in the correct storage
      if (localStorage.getItem('token')) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return updatedUser;
    } catch (error) {
      throw error;
    }
  };

  const updateProfileLocal = (updatedUser) => {
    setUser(updatedUser);
    
    if (updatedUser.preferred_language) {
      i18n.changeLanguage(updatedUser.preferred_language);
    }
    
    if (updatedUser.farmer_mode !== undefined) {
      if (updatedUser.farmer_mode) {
        document.body.classList.add('farmer-mode');
      } else {
        document.body.classList.remove('farmer-mode');
      }
    }

    if (localStorage.getItem('token')) {
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, biometricLogin, register, logout, updateProfile, updateProfileLocal }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
