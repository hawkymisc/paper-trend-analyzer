import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Navbar, Nav, Container, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-toastify/dist/ReactToastify.css';
import './styles/ReadingList.css';
import './styles/HotTopics.css';
import './i18n'; // Initialize i18n
import Dashboard from './components/Dashboard';
import TrendAnalysis from './components/TrendAnalysis';
import PaperSearch from './components/PaperSearch';
import ReadingList from './components/ReadingList';
import HotTopics from './components/HotTopics';
import WeeklyTrendAnalysis from './components/WeeklyTrendAnalysis';
import Settings from './components/Settings';
import LanguageSwitcher from './components/LanguageSwitcher';
import { ReadingListProvider, useReadingList } from './contexts/ReadingListContext';
import { SettingsProvider } from './contexts/SettingsContext';

// Navigation component that uses reading list context
const AppNavigation: React.FC = () => {
  const { t } = useTranslation();
  const { stats } = useReadingList();

  return (
    <Navbar bg="light" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">{t('appName')}</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">{t('navigation.dashboard')}</Nav.Link>
            <Nav.Link as={Link} to="/trend-analysis">Trend Analysis</Nav.Link>
            <Nav.Link as={Link} to="/paper-search">{t('navigation.paperSearch')}</Nav.Link>
            <Nav.Link as={Link} to="/hot-topics">{t('hotTopics.title')}</Nav.Link>
            <Nav.Link as={Link} to="/weekly-trends">Weekly Trends</Nav.Link>
            <Nav.Link as={Link} to="/reading-list">
              {t('navigation.readingList')}
              {stats.total > 0 && (
                <Badge bg="primary" className="ms-1">{stats.total}</Badge>
              )}
            </Nav.Link>
            <Nav.Link as={Link} to="/settings">
              <i className="bi bi-gear me-1"></i>
              Settings
            </Nav.Link>
          </Nav>
          <Nav className="ms-auto">
            <LanguageSwitcher />
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

function App() {
  return (
    <Router>
      <SettingsProvider>
        <ReadingListProvider>
          <AppNavigation />
          <Container className="mt-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trend-analysis" element={<TrendAnalysis />} />
              <Route path="/paper-search" element={<PaperSearch />} />
              <Route path="/hot-topics" element={<HotTopics />} />
              <Route path="/weekly-trends" element={<WeeklyTrendAnalysis />} />
              <Route path="/reading-list" element={<ReadingList />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Container>
        
        {/* Toast notification container */}
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        </ReadingListProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;