import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    i18n.changeLanguage(langCode);
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === i18n.language
  ) || SUPPORTED_LANGUAGES[0];

  return (
    <Dropdown>
      <Dropdown.Toggle 
        variant="outline-secondary" 
        id="language-dropdown"
        size="sm"
        className="d-flex align-items-center"
      >
        <i className="bi bi-globe me-2"></i>
        <span className="d-none d-md-inline">{t('navigation.languageSwitch')}</span>
        <span className="d-md-none">{currentLanguage.code.toUpperCase()}</span>
      </Dropdown.Toggle>

      <Dropdown.Menu>
        {SUPPORTED_LANGUAGES.map((language) => (
          <Dropdown.Item
            key={language.code}
            active={i18n.language === language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="d-flex justify-content-between align-items-center"
          >
            <span>
              <strong>{language.nativeName}</strong>
              <small className="text-muted ms-2">({language.name})</small>
            </span>
            {i18n.language === language.code && (
              <i className="bi bi-check-circle-fill text-success"></i>
            )}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default LanguageSwitcher;