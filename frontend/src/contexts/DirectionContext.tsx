import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';

type Direction = 'ltr' | 'rtl';

interface DirectionContextType {
  direction: Direction;
  setDirection: (dir: Direction) => void;
}

const STORAGE_KEY = 'crm.lang';

const DirectionContext = createContext<DirectionContextType>({
  direction: 'rtl',
  setDirection: () => {},
});

export const useDirection = () => useContext(DirectionContext);

interface DirectionProviderProps {
  children: ReactNode;
}

export const DirectionProvider: React.FC<DirectionProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();

  // Initialize language from localStorage
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      try {
        const savedLang = localStorage.getItem(STORAGE_KEY);
        if (savedLang === 'he' || savedLang === 'en') {
          i18n.changeLanguage(savedLang);
        }
      } catch (error) {
        logger.error('Failed to read language from localStorage:', error);
      }
      setIsInitialized(true);
    }
  }, [i18n, isInitialized]);

  const [direction, setDirection] = useState<Direction>(
    i18n.language === 'he' ? 'rtl' : 'ltr'
  );

  useEffect(() => {
    // Update direction when language changes
    const newDir = i18n.language === 'he' ? 'rtl' : 'ltr';
    setDirection(newDir);
    document.dir = newDir;
    document.documentElement.setAttribute('dir', newDir);
    document.documentElement.setAttribute('lang', i18n.language);

    // Save language to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, i18n.language);
    } catch (error) {
      logger.error('Failed to save language to localStorage:', error);
    }
  }, [i18n.language]);

  return (
    <DirectionContext.Provider value={{ direction, setDirection }}>
      {children}
    </DirectionContext.Provider>
  );
};
