import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load the user's preferred visual theme mode cache out of disk storage
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const cachedTheme = localStorage.getItem('global_academy_ui_theme') as ThemeMode;
    return cachedTheme || 'dark'; // Fallback default anchor to our pristine dark-slate look
  });

  // Dynamically synchronize the root HTML token class lists matching Tailwind v4 constraints
  useEffect(() => {
    const rootElement = window.document.documentElement;
    if (theme === 'dark') {
      rootElement.classList.add('dark');
      rootElement.style.colorScheme = 'dark';
    } else {
      rootElement.classList.remove('dark');
      rootElement.style.colorScheme = 'light';
    }
    localStorage.setItem('global_academy_ui_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be executed within an active ThemeProvider workspace gate.');
  }
  return context;
};
