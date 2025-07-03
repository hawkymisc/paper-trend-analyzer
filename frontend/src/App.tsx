import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import Dashboard from './components/Dashboard';
import TrendAnalysis from './components/TrendAnalysis';
import PaperSearch from './components/PaperSearch';

function App() {
  return (
    <Router>
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">Paper Trend Analyzer</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
              <Nav.Link as={Link} to="/trend-analysis">Trend Analysis</Nav.Link>
              <Nav.Link as={Link} to="/paper-search">Paper Search</Nav.Link>
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