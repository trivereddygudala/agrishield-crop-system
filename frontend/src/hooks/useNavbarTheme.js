import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const useNavbarTheme = () => {
  const { user } = useAuth();
  
  const [theme, setTheme] = useState(() => {
    return user?.navbar_theme || localStorage.getItem('navbarAnimation') || 'farmer-dynamic';
  });

  // Keep state in sync with user profile changes (e.g. from websocket updates)
  useEffect(() => {
    if (user?.navbar_theme) {
      setTheme(user.navbar_theme);
    }
  }, [user?.navbar_theme]);

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail) {
        setTheme(e.detail);
      }
    };
    window.addEventListener('navbarThemeChange', handleThemeChange);
    return () => window.removeEventListener('navbarThemeChange', handleThemeChange);
  }, []);

  const changeTheme = (newTheme) => {
    localStorage.setItem('navbarAnimation', newTheme);
    window.dispatchEvent(new CustomEvent('navbarThemeChange', { detail: newTheme }));
  };

  return { theme, changeTheme };
};
