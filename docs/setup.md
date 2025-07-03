# Setup and Deployment Guide

This guide provides instructions for setting up the Paper Trend Analyzer project locally and deploying it.

## 1. Local Development Setup

### Prerequisites
- Python 3.9+
- Node.js 14+
- npm or yarn
- Git

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` directory with your database URL. For local development with SQLite, you can use:
   ```
   DATABASE_URL="sqlite:///./test.db"
   ```
5. Run database migrations (this will create the `test.db` file if it doesn't exist):
   ```bash
   python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
   ```
6. Fetch initial paper data (optional, but recommended for testing):
   ```bash
   python scripts/fetch_papers.py
   ```
7. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend API will be accessible at `http://127.0.0.1:8000`.

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install  # or `yarn install`
   ```
3. Start the React development server:
   ```bash
   npm start  # or `yarn start`
   ```
   The frontend application will be accessible at `http://localhost:3000`.

## 2. Running Tests

### Backend Tests
1. Ensure your Python virtual environment is activated (from `backend` directory).
2. Run pytest:
   ```bash
   pytest test_api.py -v
   ```

### Frontend Tests
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Run frontend tests:
   ```bash
   npm test  # or `yarn test`
   ```

## 3. Deployment (Conceptual)

Deployment strategies will vary based on your chosen environment (e.g., Docker, Kubernetes, cloud platforms like AWS, GCP, Azure).

### Backend Deployment Considerations
- Containerization (Docker)
- Gunicorn/Uvicorn for production server
- Environment variables for sensitive configurations (e.g., `DATABASE_URL`, CORS origins)
- Database migration tools (e.g., Alembic)

### Frontend Deployment Considerations
- Build optimized production bundle (`npm run build`)
- Serve static files via a web server (e.g., Nginx, Apache) or CDN

