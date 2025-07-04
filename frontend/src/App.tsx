import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './i18n'; // Initialize i18n
import Dashboard from './components/Dashboard';
import TrendAnalysis from './components/TrendAnalysis';
import PaperSearch from './components/PaperSearch';
import LanguageSwitcher from './components/LanguageSwitcher';

function App() {
  const { t } = useTranslation('common');

  return (
    <Router>
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">{t('appName')}</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">{t('navigation.dashboard')}</Nav.Link>
              <Nav.Link as={Link} to="/trend-analysis">Trend Analysis</Nav.Link>
              <Nav.Link as={Link} to="/paper-search">{t('navigation.paperSearch')}</Nav.Link>
            </Nav>
            <Nav className="ms-auto">
              <LanguageSwitcher />
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trend-analysis" element={<TrendAnalysis />} />
          <Route path="/paper-search" element={<PaperSearch />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;