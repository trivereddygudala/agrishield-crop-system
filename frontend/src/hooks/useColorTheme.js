import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const useColorTheme = () => {
  const { user } = useAuth();
  
  const [colorTheme, setColorTheme] = useState(() => {
    return user?.color_theme || localStorage.getItem('colorTheme') || 'agrishield-default';
  });

  // Keep state in sync with user profile changes (e.g. from websocket updates)
  useEffect(() => {
    if (user?.color_theme) {
      setColorTheme(user.color_theme);
    }
  }, [user?.color_theme]);

  useEffect(() => {
    // Sync to html tag attribute data-theme
    document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail) {
        setColorTheme(e.detail);
      }
    };
    window.addEventListener('colorThemeChange', handleThemeChange);
    return () => window.removeEventListener('colorThemeChange', handleThemeChange);
  }, []);

  const changeColorTheme = (newTheme) => {
    localStorage.setItem('colorTheme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    window.dispatchEvent(new CustomEvent('colorThemeChange', { detail: newTheme }));
  };

  return { colorTheme, changeColorTheme };
};
