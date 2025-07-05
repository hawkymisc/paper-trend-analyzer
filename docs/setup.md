# Setup and Deployment Guide

This guide provides comprehensive instructions for setting up the Paper Trend Analyzer project locally and deploying it to production environments.

## 1. Quick Start (Recommended)

### Using the Development Script

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd paper-trend-analyzer
   ```

2. Make the startup script executable:
   ```bash
   chmod +x start_dev.sh
   ```

3. Run the development environment:
   ```bash
   ./start_dev.sh
   ```

   This script will:
   - Set up Python virtual environment
   - Install backend dependencies
   - Install frontend dependencies
   - Start both backend and frontend servers

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 2. Manual Setup

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
   
   **Note**: The API documentation will be available at:
   - Swagger UI: `http://127.0.0.1:8000/docs`
   - ReDoc: `http://127.0.0.1:8000/redoc`

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
   
   **Note**: The frontend supports the following languages:
   - English (en)
   - Japanese (ja)
   - Chinese (zh)
   - Korean (ko)
   - German (de)

## 3. Data Population

### Fetching Initial Paper Data

To populate the database with paper data:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Activate the virtual environment:
   ```bash
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Run the paper fetching script:
   ```bash
   python scripts/fetch_papers.py
   ```

   This script will:
   - Fetch recent papers from arXiv
   - Extract keywords automatically
   - Populate the database with papers and keywords
   - Update trend data

## 4. Running Tests

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

### Linting and Code Quality

1. **Backend Linting**:
   ```bash
   cd backend
   pip install flake8 black
   flake8 app/
   black app/
   ```

2. **Frontend Linting**:
   ```bash
   cd frontend
   npm run lint
   npm run format
   ```

## 5. Development Workflow

### Multi-language Development

When working with internationalization:

1. Add new translation keys to all language files in `frontend/src/locales/`:
   - `en/common.json` (English)
   - `ja/common.json` (Japanese)
   - `zh/common.json` (Chinese)
   - `ko/common.json` (Korean)
   - `de/common.json` (German)

2. Use the `useTranslation` hook in React components:
   ```tsx
   import { useTranslation } from 'react-i18next';
   
   const MyComponent = () => {
     const { t } = useTranslation();
     return <div>{t('common.loading')}</div>;
   };
   ```

### Adding New Features

1. Backend changes:
   - Add new API endpoints in `backend/app/main.py`
   - Create corresponding service functions in `backend/app/services.py`
   - Update schemas in `backend/app/schemas.py`
   - Add database models in `backend/app/models.py` if needed

2. Frontend changes:
   - Create new components in `frontend/src/components/`
   - Add translation keys to all language files
   - Update routing in `frontend/src/App.tsx`
   - Add TypeScript types in `frontend/src/types.ts`

## 6. Production Deployment

### Environment Variables

Create a production `.env` file in the backend directory:
```env
DATABASE_URL=postgresql://user:password@localhost/dbname
CORS_ORIGINS=https://yourdomain.com
ENVIRONMENT=production
```

### Backend Deployment

1. **Using Docker** (Recommended):
   ```bash
   # Build Docker image
   docker build -t paper-trend-analyzer-backend ./backend
   
   # Run container
   docker run -p 8000:8000 --env-file .env paper-trend-analyzer-backend
   ```

2. **Using Gunicorn**:
   ```bash
   cd backend
   pip install gunicorn
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

3. **Database Migration**:
   For production, consider using Alembic for database migrations:
   ```bash
   pip install alembic
   alembic init alembic
   # Configure alembic.ini and env.py
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

### Frontend Deployment

1. **Build Production Bundle**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Serve Static Files**:
   - **Nginx Configuration**:
     ```nginx
     server {
         listen 80;
         server_name yourdomain.com;
         root /path/to/frontend/build;
         index index.html;
         
         location / {
             try_files $uri $uri/ /index.html;
         }
         
         location /api/ {
             proxy_pass http://localhost:8000;
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
         }
     }
     ```

   - **Apache Configuration**:
     ```apache
     <VirtualHost *:80>
         ServerName yourdomain.com
         DocumentRoot /path/to/frontend/build
         
         <Directory /path/to/frontend/build>
             Options -Indexes
             AllowOverride All
             Require all granted
         </Directory>
         
         ProxyPass /api/ http://localhost:8000/
         ProxyPassReverse /api/ http://localhost:8000/
     </VirtualHost>
     ```

### Monitoring and Logging

1. **Backend Logging**:
   Configure logging in `backend/app/main.py`:
   ```python
   import logging
   logging.basicConfig(level=logging.INFO)
   ```

2. **Health Checks**:
   Add health check endpoints for monitoring:
   ```python
   @app.get("/health")
   def health_check():
       return {"status": "healthy", "timestamp": datetime.utcnow()}
   ```

3. **Process Management**:
   Use PM2 for Node.js or systemd for Python processes:
   ```bash
   # Create systemd service file
   sudo nano /etc/systemd/system/paper-trend-analyzer.service
   ```

### Security Considerations

1. **CORS Configuration**: Restrict CORS origins in production
2. **HTTPS**: Use SSL certificates (Let's Encrypt recommended)
3. **Rate Limiting**: Implement API rate limiting
4. **Database Security**: Use proper database credentials and connection encryption
5. **Environment Variables**: Store sensitive data in environment variables, not in code

### Performance Optimization

1. **Database Indexing**: Add proper database indexes for frequently queried fields
2. **Caching**: Implement Redis caching for frequently accessed data
3. **CDN**: Use CDN for static assets
4. **Compression**: Enable gzip compression for API responses
5. **Database Connection Pooling**: Configure proper connection pooling

### Backup and Recovery

1. **Database Backups**: Set up automated database backups
2. **Application Backups**: Backup application code and configuration
3. **Recovery Procedures**: Document recovery procedures
4. **Testing**: Regularly test backup and recovery procedures

