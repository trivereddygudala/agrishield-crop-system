import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';
import i18n from '../i18n/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize authentication state on load
  useEffect(() => {
    const initializeAuth = async () => {
      const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
      const savedToken = storage.getItem('token');
      const savedUser = storage.getItem('user');

      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          
          // Verify token validity with backend
          const res = await API.get('/api/auth/profile');
          setUser(res.data);
          
          if (res.data.preferred_language) {
            i18n.changeLanguage(res.data.preferred_language);
          }
          
          if (res.data.farmer_mode) {
            document.body.classList.add('farmer-mode');
          } else {
            document.body.classList.remove('farmer-mode');
          }
          
          // Save updated profile to active storage
          if (sessionStorage.getItem('token')) {
            sessionStorage.setItem('user', JSON.stringify(res.data));
          } else {
            localStorage.setItem('user', JSON.stringify(res.data));
          }
        } catch (error) {
          console.error("Token verification failed:", error);
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refresh_token');
          sessionStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    setLoading(true);
    try {
      const res = await API.post('/api/auth/login', { email: email.trim(), password, remember_me: rememberMe });
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

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', access_token);
      if (refresh_token) storage.setItem('refresh_token', refresh_token);
      storage.setItem('user', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, preferred_language = 'en') => {
    setLoading(true);
    try {
      const res = await API.post('/api/auth/register', { name, email, password, role: 'farmer', preferred_language });
      return await login(email, password, false);
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, updateProfileLocal }}>
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
