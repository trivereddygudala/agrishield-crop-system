import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { clearUserNotificationsStorage } from '../utils/notificationStorage';
import i18n from '../i18n/config';
import { signInWithGoogle } from '../services/firebase';

const AuthContext = createContext(null);

// Sync FCM Device Registration Token with Backend Database
export const syncFCMTokenWithBackend = async () => {
  try {
    const fcmToken = typeof window !== 'undefined' ? localStorage.getItem('agrishield_fcm_token') : null;
    if (!fcmToken) return;
    const deviceType = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'web';
    await API.post('/api/notifications/register-fcm', {
      token: fcmToken,
      device_type: deviceType
    });
    console.debug('[AuthContext] Synced FCM device token to backend for user.');
  } catch (err) {
    console.debug('[AuthContext] FCM sync notice:', err?.response?.status || err.message);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // B9.5B (F04): Cross-tab session & logout synchronization
  useEffect(() => {
    const handleStorageEvent = (event) => {
      // Only react to changes on the primary authentication token key
      if (event.key === 'token') {
        if (!event.newValue) {
          // Token was cleared/removed in another tab (cross-tab logout)
          setToken(null);
          setUser(null);
          document.body.classList.remove('farmer-mode');
        } else if (event.newValue !== token) {
          // Token changed to a different session in another tab
          const rawUser = localStorage.getItem('user');
          try {
            const parsedUser = rawUser ? JSON.parse(rawUser) : null;
            setToken(event.newValue);
            setUser(parsedUser);
          } catch (_) {
            setToken(event.newValue);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [token]);

  // Initialize authentication state on load with permanent persistence
  useEffect(() => {
    const initializeAuth = async () => {
      // Check localStorage first, fallback to sessionStorage
      const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && typeof parsedUser === 'object') {
            // 1. Optimistic Auth: set state immediately so the user never sees login screen
            setToken(savedToken);
            setUser(parsedUser);
            
            if (parsedUser.preferred_language) {
              try { i18n.changeLanguage(parsedUser.preferred_language); } catch (_) {}
            }
            if (parsedUser.farmer_mode) {
              document.body.classList.add('farmer-mode');
            } else {
              document.body.classList.remove('farmer-mode');
            }
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
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

      // Asynchronously sync device FCM push token with backend database
      syncFCMTokenWithBackend();

      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (role = 'farmer') => {
    setLoading(true);
    try {
      const fbResult = await signInWithGoogle();
      if (!fbResult.success) {
        throw new Error(fbResult.error || 'Google Sign-In failed or was cancelled');
      }

      const { user: gUser } = fbResult;
      const res = await API.post('/api/auth/google', {
        email: gUser.email,
        name: gUser.displayName || 'Farmer',
        photo_url: gUser.photoURL || '',
        google_id: gUser.uid,
        role: role || 'farmer'
      });

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

      // Asynchronously sync device FCM push token with backend database
      syncFCMTokenWithBackend();

      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, preferred_language = 'en', botTrap = '', role = 'farmer', extraData = {}) => {
    setLoading(true);
    try {
      // Normalize extraData if passed as object or array
      const normalizedExtra = Array.isArray(extraData)
        ? { selected_crops: extraData }
        : (typeof extraData === 'object' && extraData !== null ? extraData : {});

      // Normalize farm_location to string if it's an object
      let normalizedFarmLoc = normalizedExtra.farm_location || '';
      if (typeof normalizedFarmLoc === 'object' && normalizedFarmLoc !== null) {
        normalizedFarmLoc = [normalizedFarmLoc.village, normalizedFarmLoc.district, normalizedFarmLoc.state].filter(Boolean).join(', ');
      }

      const payload = {
        name,
        email,
        password,
        role: role || 'farmer',
        preferred_language,
        selected_crops: Array.isArray(normalizedExtra.selected_crops) ? normalizedExtra.selected_crops : [],
        equipment_types: Array.isArray(normalizedExtra.equipment_types) ? normalizedExtra.equipment_types : [],
        farm_location: typeof normalizedFarmLoc === 'string' ? normalizedFarmLoc : ''
      };
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
      clearUserNotificationsStorage(user);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('agrishield_broadcast_history');
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
    <AuthContext.Provider value={{ user, token, loading, login, biometricLogin, googleLogin, register, logout, updateProfile, updateProfileLocal }}>
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
