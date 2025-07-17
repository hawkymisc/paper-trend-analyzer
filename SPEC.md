# Paper Trend Analyzer - Project Specification

## 1. Project Overview

This project, "Paper Trend Analyzer," aims to provide tools for analyzing trends in academic papers. It allows users to search for papers, analyze keyword trends over time, view a dashboard summarizing key metrics and trending topics, and provides AI-powered research trend analysis with multi-language support.

## 2. Key Features

### 2.1. Dashboard
A central dashboard providing an overview of paper trends.
- **Summary Information:** Displays key statistics such as total papers, papers published in the last 24 hours, 7 days, and 30 days.
- **Trending Keywords (Word Cloud):** Visualizes the most frequently occurring keywords from recent papers (last 7 days) as a word cloud, where the size of the word corresponds to its frequency. This feature is designed to be interactive and extensible for future enhancements.
- **Paper Count Trend Graph:** Shows the trend of paper counts over time for selected keywords, allowing users to identify rising or falling interest in specific research areas.

### 2.2. Trend Analysis
Allows users to input multiple keywords and visualize their publication trends over a specified period.
- **Keyword Input:** Users can add and remove keywords for analysis.
- **Date Range Selection:** Users can specify a start and end date for the trend analysis.
- **Line Chart Visualization:** Displays the count of papers for each selected keyword over the chosen time period using a line chart. The color palette for the lines is fixed for consistency.

### 2.3. Paper Search
Enables users to search for academic papers based on keywords.
- **Keyword Search:** Users can enter a query to find relevant papers.
- **Pagination:** Search results are paginated for easy browsing.
- **Paper Details:** Clicking on a search result displays detailed information about the paper, including title, authors, summary, publication date, and a link to the arXiv URL.

### 2.4. Recent Research Trends (AI-Powered)
Provides AI-powered analysis of recent research trends with configurable time periods.
- **Flexible Time Periods:** Optimized for 1-3 day analysis periods due to context window constraints.
- **Multi-language Analysis:** Supports analysis in multiple languages with language-specific prompts.
- **Topic Keyword Extraction:** Automatically extracts relevant keywords from analyzed papers.
- **Summary Generation:** Creates comprehensive summaries of research trends using configurable AI prompts.
- **X (Twitter) Integration:** Generates social media posts from research summaries.

### 2.5. Trend Summary Management
Allows users to create, view, and manage historical trend summaries.
- **CRUD Operations:** Full create, read, update, delete functionality for trend summaries.
- **Historical Tracking:** Maintains records of past trend analyses with timestamps.
- **AI-Generated Content:** Leverages AI for automatic summary generation.
- **Social Media Integration:** Supports X (Twitter) post generation from summaries.

### 2.6. Reading List
Personal paper management system for organizing research interests.
- **Save for Later:** Add papers from search results to a personal reading list.
- **Status Tracking:** Mark papers as unread, reading, or completed.
- **Priority Levels:** Assign high, medium, or low priority to papers.
- **Notes System:** Add personal notes and annotations to saved papers.
- **Filtering & Sorting:** Advanced filtering by status, priority, and date.
- **Local Storage:** Persistent storage using browser local storage.

### 2.7. Comprehensive Settings
Extensive configuration options for personalizing the application experience.
- **AI Provider Configuration:** Support for OpenAI, Anthropic, and Google Gemini.
- **Model Selection:** Choose specific models within each AI provider.
- **Thinking Budget Control:** Configurable AI thinking budget for Gemini models.
- **Analysis Timeout:** Configurable timeout settings for AI operations.
- **System Prompts:** Customize AI analysis prompts for different use cases.
- **X (Twitter) Post Prompts:** Configure prompts for social media post generation.
- **UI Themes:** Light, dark, and auto themes with system preference detection.
- **Multi-language Support:** Full internationalization with 5 language options.
- **Keyword Dictionary:** Manage custom keyword dictionaries for trend analysis.
- **Markdown Rendering:** Configurable Markdown rendering for AI-generated content.
- **Markdown Style Customization:** Fine-tune typography and spacing for rendered content.

## 3. Technical Stack (Current/Planned)

### 3.1. Frontend
- **Framework:** React 18.2.0 (TypeScript 4.9.5)
- **UI Library:** React-Bootstrap 2.10.10, Bootstrap 5.3.7
- **Charting Library:** Recharts 3.0.2
- **Word Cloud Library:** wordcloud 1.2.3 (vanilla implementation)
- **Routing:** React Router DOM 7.6.3
- **Internationalization:** react-i18next with 5 language support
- **State Management:** React Context API for settings and reading list

### 3.2. Backend
- **Framework:** FastAPI with automatic OpenAPI documentation
- **Database ORM:** SQLAlchemy with custom UTCDateTime handling
- **Database:** SQLite (development) / PostgreSQL (production)
- **Caching:** In-memory cache with 5-minute TTL for expensive queries
- **Data Source:** arXiv API via feedparser with retry logic (tenacity)
- **AI Integration:** OpenAI, Anthropic, and Google Gemini APIs
- **Testing:** Comprehensive pytest suite with Factory Boy
- **Dependency Management:** pip (requirements.txt)

## 4. Data Sources

- **arXiv API:** Primary source for academic papers from cs.CL, cs.AI, cs.LG categories
- **Automated Collection:** Daily fetching with `fetch_papers.py` script
- **Keyword Extraction:** Rule-based extraction using predefined LLM-related keywords
- **Data Processing:** Batch processing with monthly chunks to respect API limits

## 5. Internationalization

### 5.1. Supported Languages
- **Japanese (ja):** Primary language with full feature coverage
- **English (en):** Complete translation coverage
- **Chinese (zh):** Simplified Chinese support
- **Korean (ko):** Full Korean language support
- **German (de):** Complete German translation

### 5.2. Implementation
- **react-i18next:** Robust internationalization framework
- **Namespace Organization:** Structured translation keys by feature area
- **Dynamic Language Switching:** Real-time language changes without page reload
- **Fallback Support:** English fallback for missing translations

## 6. AI Integration

### 6.1. Supported Providers
- **OpenAI:** GPT models with configurable parameters
- **Anthropic:** Claude models with thinking budget controls
- **Google Gemini:** Gemini models with advanced thinking capabilities

### 6.2. AI Features
- **Research Trend Analysis:** Automated analysis of recent papers
- **Summary Generation:** AI-powered summaries of research trends
- **X (Twitter) Post Generation:** Social media content creation
- **Configurable Prompts:** User-customizable system prompts
- **Multi-language Analysis:** Language-specific AI analysis

## 7. Production Deployment

### 7.1. Environment Support
- **Development:** SQLite database, local file storage
- **Production:** PostgreSQL database, environment variable configuration
- **Docker Ready:** Containerization support for easy deployment
- **CORS Configuration:** Configurable origins for production security

### 7.2. Performance Optimizations
- **Database Indexing:** Optimized queries with composite indexes
- **Caching Strategy:** 5-minute TTL cache for expensive operations
- **Pagination:** Efficient pagination for large datasets
- **Query Optimization:** Single-query aggregations for trending keywords

## 8. Testing & Quality Assurance

### 8.1. Backend Testing
- **pytest Suite:** 20+ comprehensive test cases covering all API endpoints
- **Factory Boy:** Test data generation with realistic volumes
- **Mock Data:** Up to 2000 papers tested for performance
- **API Coverage:** All endpoints tested with various scenarios
- **Error Handling:** Comprehensive error response testing

### 8.2. Frontend Quality
- **TypeScript:** Full type safety implementation with strict mode
- **ESLint:** Code quality enforcement with comprehensive rules
- **Component Testing:** Individual component validation and integration
- **Build Optimization:** Production-ready builds with compression
- **i18n Testing:** Multi-language support validation across all components
