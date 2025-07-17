import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface KeywordDictionary {
  id: string;
  keyword: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  created_at: string;
}

export interface MarkdownStyles {
  // Heading styles
  h1FontSize: string;
  h2FontSize: string;
  h3FontSize: string;
  h4FontSize: string;
  h5FontSize: string;
  h6FontSize: string;
  
  // Spacing
  lineHeight: string;
  paragraphSpacing: string;
  headingMarginTop: string;
  headingMarginBottom: string;
  listItemSpacing: string;
  
  // Text styles
  bodyFontSize: string;
  codeBlockPadding: string;
  blockquotePadding: string;
}

export interface SystemSettings {
  aiProvider: 'gemini' | 'openai' | 'anthropic';
  geminiModel: string;
  openaiModel: string;
  anthropicModel: string;
  systemPrompt: string;
  twitterPostPrompt: string;
  uiTheme: 'light' | 'dark' | 'auto';
  language: string;
  geminiThinkingBudget: number;
  analysisTimeout: number;
  enableMarkdownRendering: boolean;
  customKeywords: KeywordDictionary[];
  markdownStyles: MarkdownStyles;
}

const DEFAULT_MARKDOWN_STYLES: MarkdownStyles = {
  // Heading font sizes
  h1FontSize: '1.75rem',
  h2FontSize: '1.5rem', 
  h3FontSize: '1.25rem',
  h4FontSize: '1.1rem',
  h5FontSize: '1rem',
  h6FontSize: '0.9rem',
  
  // Spacing
  lineHeight: '1.6',
  paragraphSpacing: '1rem',
  headingMarginTop: '1.5rem',
  headingMarginBottom: '0.5rem',
  listItemSpacing: '0.25rem',
  
  // Text styles
  bodyFontSize: '1rem',
  codeBlockPadding: '1rem',
  blockquotePadding: '0.75rem 1rem',
};

const DEFAULT_KEYWORDS: KeywordDictionary[] = [
  { id: '1', keyword: 'machine learning', importance: 'high', category: 'ai', created_at: new Date().toISOString() },
  { id: '2', keyword: 'deep learning', importance: 'high', category: 'ai', created_at: new Date().toISOString() },
  { id: '3', keyword: 'neural network', importance: 'high', category: 'ai', created_at: new Date().toISOString() },
  { id: '4', keyword: 'computer vision', importance: 'high', category: 'cv', created_at: new Date().toISOString() },
  { id: '5', keyword: 'natural language processing', importance: 'high', category: 'nlp', created_at: new Date().toISOString() },
  { id: '6', keyword: 'transformer', importance: 'high', category: 'nlp', created_at: new Date().toISOString() },
  { id: '7', keyword: 'attention mechanism', importance: 'medium', category: 'nlp', created_at: new Date().toISOString() },
  { id: '8', keyword: 'reinforcement learning', importance: 'high', category: 'ai', created_at: new Date().toISOString() },
  { id: '9', keyword: 'generative model', importance: 'high', category: 'ai', created_at: new Date().toISOString() },
  { id: '10', keyword: 'large language model', importance: 'high', category: 'nlp', created_at: new Date().toISOString() },
];

// AI Models available for each provider
export const AI_MODELS = {
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Latest)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Latest)' },
    { value: 'gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash-Lite (Preview)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
};

export const DEFAULT_SETTINGS: SystemSettings = {
  aiProvider: 'gemini',
  geminiModel: 'gemini-2.5-pro',
  openaiModel: 'gpt-4o',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  systemPrompt: 'You are an expert research analyst. Analyze the provided research papers and generate concise, insightful summaries focusing on emerging trends, key methodologies, and potential impacts. Use Markdown formatting for better readability. When referencing specific papers in your analysis, use the format [Paper:N] where N is the paper number from the data provided. This allows for interactive paper references in the UI. Prioritize clarity and actionable insights.',
  twitterPostPrompt: 'あなたは学術論文の魅力を伝える専門家です。以下の論文要約から、X (Twitter) 投稿用の魅力的なテキストを生成してください。\n\n要件:\n1. 280文字以内（日本語）※絶対に超えないでください\n2. 論文の興味深い点、意義、インパクトを簡潔に表現\n3. 一般の人にもわかりやすく\n4. 適切なハッシュタグを2-3個含める (#AI #機械学習 #論文 など)\n5. 論文の革新性や面白さを簡潔に伝える\n6. 感情を込めた魅力的で簡潔な文章\n\n直接的で要点を絞ったX投稿のテキストのみを出力してください。説明文や前置きは不要です。',
  uiTheme: 'light',
  language: 'auto',
  geminiThinkingBudget: 20000,
  analysisTimeout: 120,
  enableMarkdownRendering: true,
  customKeywords: [...DEFAULT_KEYWORDS],
  markdownStyles: DEFAULT_MARKDOWN_STYLES,
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