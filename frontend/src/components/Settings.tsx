import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, DEFAULT_SETTINGS, KeywordDictionary, AI_MODELS } from '../contexts/SettingsContext';
import { Button, Card, Modal, Form, Badge, Alert } from 'react-bootstrap';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { settings, updateSetting, saveSettings, resetSettings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Dictionary management state
  const [showKeywordModal, setShowKeywordModal] = useState<boolean>(false);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [newKeywordImportance, setNewKeywordImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [newKeywordCategory, setNewKeywordCategory] = useState<string>('other');
  const [bulkKeywords, setBulkKeywords] = useState<string>('');
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false);

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


  // Dictionary management functions
  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    
    const keyword: KeywordDictionary = {
      id: Date.now().toString(),
      keyword: newKeyword.trim(),
      importance: newKeywordImportance,
      category: newKeywordCategory,
      created_at: new Date().toISOString()
    };
    
    const updatedKeywords = [...settings.customKeywords, keyword];
    handleSettingChange('customKeywords', updatedKeywords);
    
    setNewKeyword('');
    setShowKeywordModal(false);
  };

  const removeKeyword = (id: string) => {
    const updatedKeywords = settings.customKeywords.filter(k => k.id !== id);
    handleSettingChange('customKeywords', updatedKeywords);
  };

  const bulkImportKeywords = () => {
    const keywords = bulkKeywords
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(keyword => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        keyword,
        importance: 'medium' as const,
        category: 'other',
        created_at: new Date().toISOString()
      }));
    
    const updatedKeywords = [...settings.customKeywords, ...keywords];
    handleSettingChange('customKeywords', updatedKeywords);
    
    setBulkKeywords('');
    setShowBulkImport(false);
  };

  const exportKeywords = () => {
    const dataStr = JSON.stringify(settings.customKeywords, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'keyword-dictionary.json';
    link.click();
    URL.revokeObjectURL(url);
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

                  <div className="mb-3">
                    <label htmlFor="ai-model" className="form-label">
                      {t('settings.modelSelection.title')}
                    </label>
                    <select
                      id="ai-model"
                      className="form-select"
                      value={
                        settings.aiProvider === 'gemini' ? settings.geminiModel :
                        settings.aiProvider === 'openai' ? settings.openaiModel :
                        settings.anthropicModel
                      }
                      onChange={(e) => {
                        const modelKey = `${settings.aiProvider}Model` as keyof typeof settings;
                        handleSettingChange(modelKey, e.target.value);
                      }}
                    >
                      {AI_MODELS[settings.aiProvider].map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      {t('settings.modelSelection.description')}
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
                        min="-1"
                        max="1000000"
                        value={settings.geminiThinkingBudget}
                        onChange={(e) => handleSettingChange('geminiThinkingBudget', parseInt(e.target.value) || 0)}
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

            {/* Twitter Post Prompt Settings */}
            <div className="col-lg-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-twitter me-2"></i>
                    {t('settings.twitterPost.title')}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="twitter-prompt" className="form-label">
                      {t('settings.twitterPost.prompt')}
                    </label>
                    <textarea
                      id="twitter-prompt"
                      className="form-control"
                      rows={8}
                      value={settings.twitterPostPrompt}
                      onChange={(e) => handleSettingChange('twitterPostPrompt', e.target.value)}
                      placeholder={t('settings.twitterPost.placeholder')}
                    />
                    <div className="form-text">
                      {t('settings.twitterPost.description')}
                    </div>
                  </div>
                  
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleSettingChange('twitterPostPrompt', DEFAULT_SETTINGS.twitterPostPrompt)}
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
                      <option value="auto">Auto Detect / 自動検出 / 自动检测 / 자동 감지 / Automatisch</option>
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


                  {settings.enableMarkdownRendering && (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      <small>
                        {t('settings.rendering.markdownNotice')}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Markdown Style Settings */}
            {settings.enableMarkdownRendering && (
              <div className="col-lg-6 mb-4">
                <div className="card h-100">
                  <div className="card-header">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-type me-2"></i>
                      {t('settings.markdownStyles.title')}
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="h1-font-size" className="form-label">
                          {t('settings.markdownStyles.h1FontSize')}
                        </label>
                        <input
                          type="text"
                          id="h1-font-size"
                          className="form-control"
                          value={settings.markdownStyles.h1FontSize}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, h1FontSize: e.target.value })}
                          placeholder="1.75rem"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="h2-font-size" className="form-label">
                          {t('settings.markdownStyles.h2FontSize')}
                        </label>
                        <input
                          type="text"
                          id="h2-font-size"
                          className="form-control"
                          value={settings.markdownStyles.h2FontSize}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, h2FontSize: e.target.value })}
                          placeholder="1.5rem"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="h3-font-size" className="form-label">
                          {t('settings.markdownStyles.h3FontSize')}
                        </label>
                        <input
                          type="text"
                          id="h3-font-size"
                          className="form-control"
                          value={settings.markdownStyles.h3FontSize}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, h3FontSize: e.target.value })}
                          placeholder="1.25rem"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="body-font-size" className="form-label">
                          {t('settings.markdownStyles.bodyFontSize')}
                        </label>
                        <input
                          type="text"
                          id="body-font-size"
                          className="form-control"
                          value={settings.markdownStyles.bodyFontSize}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, bodyFontSize: e.target.value })}
                          placeholder="1rem"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="line-height" className="form-label">
                          {t('settings.markdownStyles.lineHeight')}
                        </label>
                        <input
                          type="text"
                          id="line-height"
                          className="form-control"
                          value={settings.markdownStyles.lineHeight}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, lineHeight: e.target.value })}
                          placeholder="1.6"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="paragraph-spacing" className="form-label">
                          {t('settings.markdownStyles.paragraphSpacing')}
                        </label>
                        <input
                          type="text"
                          id="paragraph-spacing"
                          className="form-control"
                          value={settings.markdownStyles.paragraphSpacing}
                          onChange={(e) => handleSettingChange('markdownStyles', { ...settings.markdownStyles, paragraphSpacing: e.target.value })}
                          placeholder="1rem"
                        />
                      </div>
                    </div>
                    
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleSettingChange('markdownStyles', DEFAULT_SETTINGS.markdownStyles)}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        {t('settings.markdownStyles.resetToDefault')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keyword Dictionary Settings */}
          <div className="col-12 mb-4">
            <Card>
              <Card.Header>
                <h5 className="card-title mb-0">
                  <i className="bi bi-book me-2"></i>
                  {t('settings.dictionary.title')}
                </h5>
              </Card.Header>
              <Card.Body>
                <p className="text-muted">{t('settings.dictionary.description')}</p>
                
                <div className="d-flex gap-2 mb-3">
                  <Button variant="primary" onClick={() => setShowKeywordModal(true)}>
                    <i className="bi bi-plus me-1"></i>
                    {t('settings.dictionary.addKeyword')}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => setShowBulkImport(true)}>
                    <i className="bi bi-upload me-1"></i>
                    {t('settings.dictionary.bulkImport')}
                  </Button>
                  <Button variant="outline-info" onClick={exportKeywords}>
                    <i className="bi bi-download me-1"></i>
                    {t('settings.dictionary.exportKeywords')}
                  </Button>
                  <Button 
                    variant="outline-warning" 
                    onClick={() => handleSettingChange('customKeywords', DEFAULT_SETTINGS.customKeywords)}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    {t('settings.dictionary.resetToDefaults')}
                  </Button>
                </div>

                <div className="row">
                  {settings.customKeywords.map((keyword) => (
                    <div key={keyword.id} className="col-md-6 col-lg-4 mb-2">
                      <div className="d-flex align-items-center justify-content-between border rounded p-2">
                        <div>
                          <span className="fw-medium">{keyword.keyword}</span>
                          <div>
                            <Badge bg={keyword.importance === 'high' ? 'danger' : keyword.importance === 'medium' ? 'warning' : 'secondary'} className="me-1">
                              {t(`settings.dictionary.${keyword.importance}`)}
                            </Badge>
                            <Badge bg="secondary" className="small">
                              {t(`settings.dictionary.categories.${keyword.category}`) || keyword.category}
                            </Badge>
                          </div>
                        </div>
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          onClick={() => removeKeyword(keyword.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {settings.customKeywords.length === 0 && (
                  <Alert variant="info">
                    <i className="bi bi-info-circle me-2"></i>
                    {t('settings.dictionary.description')}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </div>

        </div>
      </div>

      {/* Add Keyword Modal */}
      <Modal show={showKeywordModal} onHide={() => setShowKeywordModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('settings.dictionary.addKeyword')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.dictionary.keywordPlaceholder')}</Form.Label>
              <Form.Control
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t('settings.dictionary.keywordPlaceholder')}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.dictionary.importanceLevel')}</Form.Label>
              <Form.Select
                value={newKeywordImportance}
                onChange={(e) => setNewKeywordImportance(e.target.value as 'high' | 'medium' | 'low')}
              >
                <option value="high">{t('settings.dictionary.high')}</option>
                <option value="medium">{t('settings.dictionary.medium')}</option>
                <option value="low">{t('settings.dictionary.low')}</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.dictionary.category')}</Form.Label>
              <Form.Select
                value={newKeywordCategory}
                onChange={(e) => setNewKeywordCategory(e.target.value)}
              >
                <option value="ai">{t('settings.dictionary.categories.ai')}</option>
                <option value="cv">{t('settings.dictionary.categories.cv')}</option>
                <option value="nlp">{t('settings.dictionary.categories.nlp')}</option>
                <option value="robotics">{t('settings.dictionary.categories.robotics')}</option>
                <option value="security">{t('settings.dictionary.categories.security')}</option>
                <option value="network">{t('settings.dictionary.categories.network')}</option>
                <option value="database">{t('settings.dictionary.categories.database')}</option>
                <option value="quantum">{t('settings.dictionary.categories.quantum')}</option>
                <option value="blockchain">{t('settings.dictionary.categories.blockchain')}</option>
                <option value="bioinformatics">{t('settings.dictionary.categories.bioinformatics')}</option>
                <option value="other">{t('settings.dictionary.categories.other')}</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowKeywordModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={addKeyword} disabled={!newKeyword.trim()}>
            {t('settings.dictionary.addKeyword')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal show={showBulkImport} onHide={() => setShowBulkImport(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('settings.dictionary.bulkImport')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">{t('settings.dictionary.bulkImportDescription')}</p>
          <Form.Group>
            <Form.Label>{t('settings.dictionary.keywordList')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={bulkKeywords}
              onChange={(e) => setBulkKeywords(e.target.value)}
              placeholder={t('settings.dictionary.bulkImportPlaceholder')}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkImport(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={bulkImportKeywords} disabled={!bulkKeywords.trim()}>
            {t('settings.dictionary.import')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Settings;