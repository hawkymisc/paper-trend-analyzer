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

### Running the Frontend
Refer to `docs/setup.md` for detailed instructions on setting up and running the frontend.

### Testing
Refer to `docs/setup.md` for instructions on running frontend tests.

### Code Style and Linting
- Follow [Airbnb JavaScript Style Guide](https://airbnb.io/javascript/) for JavaScript/TypeScript code style.
- Use a linter (e.g., ESLint) and formatter (e.g., Prettier) to ensure code quality. (Configured in `package.json` scripts).

## Contributing

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and write tests.
4. Ensure all tests pass and code adheres to style guidelines.
5. Submit a pull request.
