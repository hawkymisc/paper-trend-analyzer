# Paper Trend Analyzer - AI Assistant Context

## Project Overview
This is a Paper Trend Analyzer application that helps analyze trends in academic papers. It provides search functionality, trend analysis, and a dashboard for visualizing academic paper data sourced from arXiv API.

## Important Instruction

This is a **FULLY FUNCTIONAL MVP**. Do not break existing functionality. Focus on enhancements, bug fixes, or filling identified gaps. The system is designed with high code quality standards and comprehensive testing.

**speak in Japanese** when providing error messages or user-facing text in the API responses.

## Current Implementation Status

### Phase 1 (MVP) - ✅ COMPLETED
- **Data Collection**: ✅ Implemented with `fetch_papers.py` script using feedparser for arXiv API
- **Database**: ✅ SQLAlchemy models with Papers, Keywords, and PaperKeywords tables
- **Backend APIs**: ✅ All core endpoints implemented
- **Frontend**: ✅ All three main pages implemented (Dashboard, Trend Analysis, Paper Search)

### Current State Analysis
- **Database**: Uses SQLite for development (`/tmp/test.db`), PostgreSQL ready for production
- **Data Collection**: Automated script fetches papers from cs.CL, cs.AI, cs.LG categories
- **Backend**: 7 REST endpoints implemented with comprehensive error handling
- **Frontend**: 3 React components with full functionality
- **Testing**: Comprehensive pytest suite with 20+ test cases

## Architecture

### Backend (FastAPI + SQLAlchemy)
- **Framework**: FastAPI with automatic OpenAPI documentation
- **Database ORM**: SQLAlchemy with custom UTCDateTime handling
- **Database**: SQLite (dev) / PostgreSQL (production via psycopg2-binary)
- **Caching**: In-memory cache with 5-minute TTL for expensive queries
- **Data Source**: arXiv API via feedparser with retry logic (tenacity)

### Frontend (React + TypeScript)
- **Framework**: React 18.2.0 with TypeScript 4.9.5
- **UI Framework**: React-Bootstrap 2.10.10 with Bootstrap 5.3.7
- **Routing**: React Router DOM 7.6.3
- **Charts**: Recharts 3.0.2 for trend visualization
- **Word Cloud**: wordcloud 1.2.3 (not react-wordcloud as originally planned)
- **Internationalization**: react-i18next with support for 5 languages (Japanese, English, Chinese, Korean, German)
- **Proxy Setup**: setupProxy.js redirects /api to backend on port 8000

## Database Schema

### Core Tables
1. **papers** - Main paper storage
   - `id`, `arxiv_id` (unique), `title`, `authors` (JSON), `summary`, `published_at`, timestamps
   - Indexes on published_at, title, summary for performance

2. **keywords** - Keyword dictionary
   - `id`, `name` (unique) - Extracted from predefined LLM keyword list

3. **paper_keywords** - Many-to-many relationship
   - `paper_id`, `keyword_id` - Links papers to extracted keywords

## API Endpoints

### Implemented Endpoints (7 total)
1. **GET /api/v1/dashboard/summary** - Dashboard statistics
2. **GET /api/v1/dashboard/trending-keywords** - Growth-based trending keywords
3. **GET /api/v1/trends** - Keyword trend data over time (monthly aggregation)
4. **GET /api/v1/papers/search** - Paper search with pagination
5. **GET /api/v1/keywords/word-cloud** - Word cloud data (last 7 days)

### Missing from Original Spec
- Root endpoint (/) returns welcome message, not documented in API spec
- Paper count trend graph in dashboard (mentioned in spec but not implemented as separate endpoint)

## Frontend Components

### 1. Dashboard (`/`) - ✅ FULLY IMPLEMENTED
- ✅ Summary statistics cards (6 metrics including total_keywords)
- ✅ Word cloud visualization using wordcloud library
- ⚠️ Paper count trend graph section placeholder (not implemented)

### 2. Trend Analysis (`/trend-analysis`) - ✅ FULLY IMPLEMENTED  
- ✅ Dynamic keyword management (add/remove)
- ✅ Date range selection with defaults
- ✅ Multi-line chart with fixed color palette
- ✅ Data normalization for missing dates

### 3. Recent Research Trends (`/recent-trends`) - ✅ FULLY IMPLEMENTED
- ✅ AI-powered research trend analysis (1-3 day periods)
- ✅ Multi-language analysis support
- ✅ Topic keyword extraction
- ✅ Summary generation with configurable prompts
- ✅ X (Twitter) post generation

### 4. Trend Summary (`/trend-summary`) - ✅ FULLY IMPLEMENTED
- ✅ Historical trend summary management
- ✅ CRUD operations for trend summaries
- ✅ AI-powered summary generation
- ✅ X (Twitter) post generation from summaries

### 5. Paper Search (`/paper-search`) - ✅ FULLY IMPLEMENTED
- ✅ Search input with query validation
- ✅ Pagination (10 papers per page)
- ✅ Paper cards with arXiv links
- ✅ Author and publication date display

### 6. Reading List (`/reading-list`) - ✅ FULLY IMPLEMENTED
- ✅ Save papers for later reading
- ✅ Status management (unread/reading/completed)
- ✅ Priority levels and notes
- ✅ Filtering and sorting capabilities
- ✅ Local storage persistence

### 7. Settings (`/settings`) - ✅ FULLY IMPLEMENTED
- ✅ AI provider configuration (OpenAI, Anthropic, Gemini)
- ✅ Model selection and parameters
- ✅ System prompt customization
- ✅ X (Twitter) post prompt configuration
- ✅ UI theme selection (light/dark/auto)
- ✅ Language selection (5 languages)
- ✅ Keyword dictionary management
- ✅ Markdown rendering settings

## Data Collection System

### ArXiv Data Fetching (`fetch_papers.py`)
- **Scope**: Fetches from cs.CL, cs.AI, cs.LG categories
- **Keyword Extraction**: 20 predefined LLM-related keywords
- **Batch Processing**: Monthly chunks to respect API limits
- **Retry Logic**: Exponential backoff with tenacity
- **Logging**: Comprehensive logging to fetch_papers.log

### Keyword Extraction Strategy
- **Current**: Rule-based matching against predefined keywords (LLM, GPT, BERT, etc.)
- **Limitation**: Only extracts from predefined list, not dynamic discovery

## Development & Deployment

### Development Setup
- **Startup Script**: `start_dev.sh` runs both frontend and backend
- **Backend**: `uvicorn app.main:app --reload --port 8000`
- **Frontend**: `npm start` on port 3000 with proxy to backend
- **Database**: Auto-created SQLite at `/tmp/test.db`

### Testing Infrastructure
- **Backend**: pytest with Factory Boy for test data generation
- **Coverage**: 20+ test cases covering all endpoints
- **Test Database**: In-memory SQLite for isolated testing
- **Mock Data**: Configurable test data with realistic paper volumes (up to 2000 papers tested)

## Performance Optimizations

### Implemented
- **Database Indexes**: Composite indexes on published_at + title/summary
- **Caching**: 5-minute TTL cache for trending keywords and word cloud data
- **Query Optimization**: Single-query aggregations for trending keywords
- **Pagination**: Efficient pagination in search results

### Potential Issues Identified
1. **Word Cloud Library**: Using vanilla `wordcloud` instead of `react-wordcloud` as specified
2. **Dashboard Trend Graph**: Mentioned in spec but only placeholder implemented
3. **CORS**: Currently allows all origins (development setting)
4. **Database Path**: Uses `/tmp/test.db` which may not persist across reboots

## Missing Features vs Specification

### Minor Gaps
1. **Dashboard Paper Trend Graph**: Section exists but shows placeholder text
2. **Interactive Word Cloud**: Current implementation not interactive (spec mentions extensibility)
3. **Root API Documentation**: Missing root endpoint documentation

### Phase 2 Features (Not Yet Implemented)
- User authentication system
- Notification system
- User preferences and settings

## Key Technical Decisions

### Backend
- **Timezone Handling**: Custom UTCDateTime type ensures consistent UTC storage
- **Error Handling**: Comprehensive HTTP status codes with Japanese error messages
- **API Design**: RESTful with clear query parameter validation
- **Database Strategy**: SQLAlchemy with support for both SQLite and PostgreSQL

### Frontend
- **State Management**: Local component state with Context for settings and reading list
- **Type Safety**: Full TypeScript implementation with proper interfaces
- **UI Consistency**: Bootstrap-based responsive design
- **Chart Formatting**: Automatic data normalization for consistent visualization
- **Internationalization**: Complete i18n implementation with 5 language support
- **Navigation**: Consistent naming and routing structure across all languages

## Development Commands
- **Combined Start**: `./start_dev.sh` (starts both services)
- **Backend Only**: `cd backend && uvicorn app.main:app --reload`
- **Frontend Only**: `cd frontend && npm start`
- **Data Fetch**: `cd backend && python scripts/fetch_papers.py`
- **Database Init**: `cd backend && python create_db.py`
- **Tests**: `cd backend && pytest test_api.py -v`

## File Structure Overview
```
paper-trend-analyzer/
├── backend/app/          # FastAPI application core
├── backend/scripts/      # Data collection scripts
├── frontend/src/         # React TypeScript application
├── docs/                 # Project documentation
├── start_dev.sh         # Development startup script
└── test.db              # SQLite database (development)
```

## Production Readiness Assessment

### Ready for Production
- ✅ Complete API implementation
- ✅ Comprehensive testing suite
- ✅ Database schema with proper indexes
- ✅ Error handling and validation
- ✅ CORS configuration
- ✅ Environment variable support
- ✅ Multi-language support (5 languages)
- ✅ Consistent UI/UX across all languages
- ✅ Proper component naming and routing

### Needs Production Configuration
- ⚠️ Database URL configuration for PostgreSQL
- ⚠️ CORS origins restriction
- ⚠️ Production-grade logging
- ⚠️ Database migration strategy (currently uses create_all)
- ⚠️ Static file serving for frontend build

This implementation represents a fully functional MVP that meets the core requirements specified in SPEC.md, with solid foundations for the planned Phase 2 enhancements.

## Important Notes for Claude AI Assistants

### What Claude Should Do When Working on This Project

#### 1. **Understand This Is a Working System**
- This is a **FULLY FUNCTIONAL MVP** - don't break existing functionality
- All core features are implemented and tested
- Focus on enhancements, bug fixes, or filling identified gaps

#### 2. **Development Workflow**
- **Always run tests first**: `cd backend && python -m pytest` before making changes
- **Use the startup script**: `./start_dev.sh` to test changes
- **Follow existing patterns** - code quality is high, maintain standards
- **Check both frontend and backend** when making changes

#### 3. **Code Quality Standards**
- **TypeScript**: Maintain type safety, use existing interfaces
- **Error handling**: Follow the comprehensive error handling patterns
- **Testing**: Add tests for new features, maintain 20+ test coverage
- **Performance**: Respect caching strategy and database indexes

#### 4. **Database Operations**
- **Schema is well-designed** - don't modify without understanding impact
- **Use existing models** in `backend/app/models.py`
- **Database location**: `/tmp/test.db` for development
- **Timezone handling**: Custom UTCDateTime handles UTC consistency

#### 5. **API Development**
- **Follow REST patterns** - 7 endpoints are well-implemented
- **Use Pydantic validation** for request/response schemas
- **Return proper HTTP status codes** and error messages
- **Maintain the 5-minute caching strategy**

#### 6. **Frontend Development**
- **Bootstrap styling** - use React-Bootstrap components consistently
- **Recharts** - for trend visualization (already configured)
- **Word cloud** - uses vanilla wordcloud library (not react-wordcloud)
- **Don't break routing** - 3 routes are configured and working

#### 7. **Known Issues to Address**
- **Dashboard trend graph**: Currently shows placeholder text (line 69)
- **Word cloud interactivity**: Not interactive as specified
- **Production config**: CORS, database URL need production setup

#### 8. **Data Collection**
- **ArXiv integration** - `fetch_papers.py` handles data collection
- **Keyword extraction** - rule-based from 20 predefined keywords
- **Respect API limits** - retry logic with exponential backoff is implemented

#### 9. **What NOT to Do**
- **Don't break existing functionality** - this is a working MVP
- **Don't change core architecture** - it's well-thought-out
- **Don't add unnecessary dependencies** - current stack is sufficient
- **Don't modify database schema** without careful consideration

#### 10. **Quick Commands Reference**
```bash
# Start development environment
./start_dev.sh

# Run tests (ALWAYS do this first)
cd backend && python -m pytest

# Individual services
cd backend && python -m uvicorn app.main:app --reload
cd frontend && npm start

# Data collection
cd backend && python scripts/fetch_papers.py
```

#### 11. **Key Files to Understand**
- `backend/app/main.py` - FastAPI routes and application setup
- `backend/app/models.py` - SQLAlchemy database models
- `frontend/src/components/Dashboard.tsx` - Main dashboard component
- `backend/scripts/fetch_papers.py` - Data collection from arXiv
- `backend/test_api.py` - Comprehensive test suite
- `SPEC.md` - Original requirements specification

#### 12. **Focus Areas for Enhancement**
- **Dashboard trend graph implementation** (placeholder exists)
- **Word cloud interactivity** (make it interactive)
- **Production configuration** (CORS, logging, database)
- **Phase 2 features** (authentication, notifications)
- **Performance optimization** (if needed)

#### 13. **Testing Strategy**
- **Backend tests**: pytest with Factory Boy for test data
- **Test database**: In-memory SQLite for isolation
- **Coverage**: Maintain comprehensive test coverage
- **Mock data**: Uses realistic paper volumes (up to 2000 papers tested)

Remember: This is a high-quality, production-ready MVP. Maintain the existing code quality standards and architectural decisions.
