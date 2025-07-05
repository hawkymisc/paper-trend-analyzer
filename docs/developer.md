# Developer Guide

This guide provides information for developers working on the Paper Trend Analyzer project.

## Project Structure

- `backend/`: Contains the FastAPI backend application.
  - `app/`: Core application logic.
    - `main.py`: FastAPI application entry point, API routes.
    - `database.py`: Database connection and session management.
    - `models.py`: SQLAlchemy ORM models for database tables.
    - `schemas.py`: Pydantic schemas for request/response validation and serialization.
    - `services.py`: Business logic and data processing (e.g., trending keywords calculation).
  - `scripts/`: Utility scripts (e.g., `fetch_papers.py` for data collection).
  - `venv/`: Python virtual environment.
  - `requirements.txt`: Python dependencies.
  - `.env`: Environment variables for local development.
  - `test.db`: SQLite database file (for local development).
- `frontend/`: Contains the React frontend application.
  - `public/`: Static assets.
  - `src/`: React source code.
    - `App.tsx`: Main application component.
    - `TrendAnalysis.tsx`: Component for trend analysis view.
  - `node_modules/`: Node.js dependencies.
  - `package.json`, `package-lock.json`: Node.js dependencies and scripts.
  - `tsconfig.json`: TypeScript configuration.
- `docs/`: Project documentation.
  - `api.md`: API documentation.
  - `setup.md`: Setup and deployment guide.
  - `developer.md`: This document.
  - `usage.md`: User usage guide.
- `GEMINI.md`: Gemini agent specific configuration and context.
- `SPEC.md`: Project specification.
- `TODO.md`: Project roadmap and pending tasks.

## Backend Development

### Running the Backend
Refer to `docs/setup.md` for detailed instructions on setting up and running the backend.

### Database Migrations
Currently, database schema changes are handled by `Base.metadata.create_all(bind=engine)` which recreates tables on each run. For production environments, consider using a dedicated migration tool like [Alembic](https://alembic.sqlalchemy.org/en/latest/) to manage schema evolution.

### Testing
Refer to `docs/setup.md` for instructions on running backend tests.

### Code Style and Linting
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) for Python code style.
- Use a linter (e.g., `flake8`, `ruff`) to ensure code quality. (Not explicitly configured in `requirements.txt` but recommended).

## Frontend Development

### Development Workflow

1. **Environment Setup**:
   ```bash
   cd frontend
   npm install
   ```

2. **Development Server**:
   ```bash
   npm start
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

### Key Components

**Dashboard Component** (`Dashboard.tsx`):
- Displays summary statistics
- Interactive word cloud visualization
- Trending keywords with navigation
- Integrated search functionality

**Paper Search Component** (`PaperSearch.tsx`):
- Advanced search with filtering
- Sort by date or relevance
- Expandable abstracts
- Pagination support
- URL parameter handling

**Trend Analysis Component** (`TrendAnalysis.tsx`):
- Interactive trend charts
- Multi-keyword comparison
- Date range selection
- Real-time data updates

**Language Switcher Component** (`LanguageSwitcher.tsx`):
- Language selection dropdown
- Persistent language preference
- Smooth language transitions

### Internationalization (i18n)

**Configuration** (`i18n.ts`):
```typescript
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
] as const;
```

**Usage in Components**:
```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  return <div>{t('common.loading')}</div>;
};
```

### Code Quality

**Linting and Formatting**:
```bash
npm run lint
npm run format
```

**Code Style Guidelines**:
- Follow Airbnb JavaScript Style Guide
- Use TypeScript for type safety
- Consistent component structure
- Proper prop types and interfaces

## Contributing

### Development Process

1. **Fork the Repository**
2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/new-feature
   ```

3. **Make Changes**:
   - Follow coding standards
   - Add tests for new features
   - Update documentation

4. **Test Changes**:
   ```bash
   # Backend tests
   cd backend && pytest
   
   # Frontend tests
   cd frontend && npm test
   
   # Linting
   npm run lint
   ```

5. **Submit Pull Request**:
   - Write clear commit messages
   - Provide detailed PR description
   - Link to related issues
