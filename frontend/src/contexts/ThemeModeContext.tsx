/**
 * Theme Mode Context
 * Manages light/dark theme with localStorage persistence
 */

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { logger } from '@/utils/logger';

type ThemeMode = 'light' | 'dark';

interface ThemeModeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'crm.theme';

const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'light',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

interface ThemeModeProviderProps {
  children: ReactNode;
}

export const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Read from localStorage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (error) {
      logger.error('Failed to read theme from localStorage:', error);
    }
    return 'light';
  });

  useEffect(() => {
    // Save to localStorage when mode changes
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      logger.error('Failed to save theme to localStorage:', error);
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeModeContext.Provider>
  );
};
