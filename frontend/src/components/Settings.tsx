import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, DEFAULT_SETTINGS } from '../contexts/SettingsContext';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { settings, updateSetting, saveSettings, resetSettings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    updateSetting(key, value);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('saving');

    try {
      // Save settings using context
      saveSettings();
      
      // Apply language change if needed
      if (settings.language !== i18n.language) {
        await i18n.changeLanguage(settings.language);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm(t('settings.confirmReset'))) {
      resetSettings();
      setSaveStatus('idle');
    }
  };

  const getSaveButtonClass = () => {
    switch (saveStatus) {
      case 'saving': return 'btn btn-primary';
      case 'saved': return 'btn btn-success';
      case 'error': return 'btn btn-danger';
      default: return 'btn btn-primary';
    }
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving': return t('settings.saving');
      case 'saved': return t('settings.saved');
      case 'error': return t('settings.saveError');
      default: return t('settings.save');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <i className="bi bi-gear me-2"></i>
              {t('settings.title')}
            </h2>
            <div>
              <button
                type="button"
                className="btn btn-outline-secondary me-2"
                onClick={handleReset}
                disabled={isLoading}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                {t('settings.reset')}
              </button>
              <button
                type="button"
                className={getSaveButtonClass()}
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                ) : (
                  <i className="bi bi-check2 me-1"></i>
                )}
                {getSaveButtonText()}
              </button>
            </div>
          </div>

          <div className="row">
            {/* AI Provider Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-robot me-2"></i>
                    {t('settings.aiProvider.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="ai-provider" className="form-label">
                      {t('settings.aiProvider.provider')}
                    </label>
                    <select
                      id="ai-provider"
                      className="form-select"
                      value={settings.aiProvider}
                      onChange={(e) => handleSettingChange('aiProvider', e.target.value)}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI GPT</option>
                      <option value="anthropic">Anthropic Claude</option>
                    </select>
                    <div className="form-text">
                      {t('settings.aiProvider.description')}
                    </div>
                  </div>

                  {settings.aiProvider === 'gemini' && (
                    <div className="mb-3">
                      <label htmlFor="thinking-budget" className="form-label">
                        {t('settings.aiProvider.thinkingBudget')}
                      </label>
                      <input
                        type="number"
                        id="thinking-budget"
                        className="form-control"
                        min="1000"
                        max="100000"
                        step="1000"
                        value={settings.geminiThinkingBudget}
                        onChange={(e) => handleSettingChange('geminiThinkingBudget', parseInt(e.target.value))}
                      />
                      <div className="form-text">
                        {t('settings.aiProvider.thinkingBudgetDescription')}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="analysis-timeout" className="form-label">
                      {t('settings.aiProvider.timeout')}
                    </label>
                    <select
                      id="analysis-timeout"
                      className="form-select"
                      value={settings.analysisTimeout}
                      onChange={(e) => handleSettingChange('analysisTimeout', parseInt(e.target.value))}
                    >
                      <option value={60}>1 {t('settings.aiProvider.minute')}</option>
                      <option value={120}>2 {t('settings.aiProvider.minutes')}</option>
                      <option value={180}>3 {t('settings.aiProvider.minutes')}</option>
                      <option value={300}>5 {t('settings.aiProvider.minutes')}</option>
                    </select>
                    <div className="form-text">
                      {t('settings.aiProvider.timeoutDescription')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Prompt Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-chat-text me-2"></i>
                    {t('settings.systemPrompt.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="system-prompt" className="form-label">
                      {t('settings.systemPrompt.prompt')}
                    </label>
                    <textarea
                      id="system-prompt"
                      className="form-control"
                      rows={8}
                      value={settings.systemPrompt}
                      onChange={(e) => handleSettingChange('systemPrompt', e.target.value)}
                      placeholder={t('settings.systemPrompt.placeholder')}
                    />
                    <div className="form-text">
                      {t('settings.systemPrompt.description')}
                    </div>
                  </div>
                  
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleSettingChange('systemPrompt', DEFAULT_SETTINGS.systemPrompt)}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      {t('settings.systemPrompt.resetToDefault')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* UI Theme Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-palette me-2"></i>
                    {t('settings.theme.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">
                      {t('settings.theme.mode')}
                    </label>
                    <div className="btn-group w-100" role="group">
                      <input
                        type="radio"
                        className="btn-check"
                        name="theme-radio"
                        id="theme-light"
                        checked={settings.uiTheme === 'light'}
                        onChange={() => handleSettingChange('uiTheme', 'light')}
                      />
                      <label className="btn btn-outline-primary" htmlFor="theme-light">
                        <i className="bi bi-sun me-1"></i>
                        {t('settings.theme.light')}
                      </label>

                      <input
                        type="radio"
                        className="btn-check"
                        name="theme-radio"
                        id="theme-dark"
                        checked={settings.uiTheme === 'dark'}
                        onChange={() => handleSettingChange('uiTheme', 'dark')}
                      />
                      <label className="btn btn-outline-primary" htmlFor="theme-dark">
                        <i className="bi bi-moon me-1"></i>
                        {t('settings.theme.dark')}
                      </label>

                      <input
                        type="radio"
                        className="btn-check"
                        name="theme-radio"
                        id="theme-auto"
                        checked={settings.uiTheme === 'auto'}
                        onChange={() => handleSettingChange('uiTheme', 'auto')}
                      />
                      <label className="btn btn-outline-primary" htmlFor="theme-auto">
                        <i className="bi bi-circle-half me-1"></i>
                        {t('settings.theme.auto')}
                      </label>
                    </div>
                    <div className="form-text">
                      {t('settings.theme.description')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Language Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-globe me-2"></i>
                    {t('settings.language.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="ui-language" className="form-label">
                      {t('settings.language.interface')}
                    </label>
                    <select
                      id="ui-language"
                      className="form-select"
                      value={settings.language}
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                    >
                      <option value="auto">Auto Detect</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                      <option value="zh">中文</option>
                      <option value="ko">한국어</option>
                      <option value="de">Deutsch</option>
                    </select>
                    <div className="form-text">
                      {t('settings.language.description')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Rendering Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-file-richtext me-2"></i>
                    {t('settings.rendering.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="enable-markdown"
                        checked={settings.enableMarkdownRendering}
                        onChange={(e) => handleSettingChange('enableMarkdownRendering', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="enable-markdown">
                        {t('settings.rendering.enableMarkdown')}
                      </label>
                    </div>
                    <div className="form-text">
                      {t('settings.rendering.markdownDescription')}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="enable-code-highlighting"
                        checked={settings.enableCodeHighlighting}
                        onChange={(e) => handleSettingChange('enableCodeHighlighting', e.target.checked)}
                        disabled={!settings.enableMarkdownRendering}
                      />
                      <label className="form-check-label" htmlFor="enable-code-highlighting">
                        {t('settings.rendering.codeHighlighting')}
                      </label>
                    </div>
                    <div className="form-text">
                      {t('settings.rendering.codeDescription')}
                    </div>
                  </div>

                  {settings.enableMarkdownRendering && (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      <small>
                        Markdown rendering will apply to all AI-generated content including weekly trends, topic summaries, and hot topics analysis.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-graph-up me-2"></i>
                {t('settings.usage.title')}
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-md-3">
                  <div className="border rounded p-3">
                    <h6 className="text-muted">{t('settings.usage.apiCalls')}</h6>
                    <h4>--</h4>
                    <small className="text-muted">{t('settings.usage.thisMonth')}</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3">
                    <h6 className="text-muted">{t('settings.usage.analysisGenerated')}</h6>
                    <h4>--</h4>
                    <small className="text-muted">{t('settings.usage.total')}</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3">
                    <h6 className="text-muted">{t('settings.usage.cacheHits')}</h6>
                    <h4>--</h4>
                    <small className="text-muted">{t('settings.usage.thisWeek')}</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3">
                    <h6 className="text-muted">{t('settings.usage.costSaved')}</h6>
                    <h4>--</h4>
                    <small className="text-muted">{t('settings.usage.estimated')}</small>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  {t('settings.usage.note')}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;