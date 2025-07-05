import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SystemSettings {
  aiProvider: 'gemini' | 'openai' | 'anthropic';
  systemPrompt: string;
  uiTheme: 'light' | 'dark' | 'auto';
  language: string;
  geminiThinkingBudget: number;
  analysisTimeout: number;
  enableMarkdownRendering: boolean;
  enableCodeHighlighting: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  aiProvider: 'gemini',
  systemPrompt: 'You are an expert research analyst. Analyze the provided research papers and generate concise, insightful summaries focusing on emerging trends, key methodologies, and potential impacts. Use Markdown formatting for better readability. Format paper references as "Paper N" where N is the paper number. Prioritize clarity and actionable insights.',
  uiTheme: 'light',
  language: 'auto',
  geminiThinkingBudget: 20000,
  analysisTimeout: 120,
  enableMarkdownRendering: true,
  enableCodeHighlighting: true,
};

interface SettingsContextType {
  settings: SystemSettings;
  updateSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  resetSettings: () => void;
  saveSettings: () => void;
  loadSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme changes
  useEffect(() => {
    applyTheme(settings.uiTheme);
  }, [settings.uiTheme]);

  const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-bs-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-bs-theme', theme);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K, 
    value: SystemSettings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('systemSettings');
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('systemSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      throw error;
    }
  };

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('systemSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      // Fallback to default settings if parsing fails
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const contextValue: SettingsContextType = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    saveSettings,
    loadSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};