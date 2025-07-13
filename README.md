# 📊 Paper Trend Analyzer

A comprehensive research paper trend analysis platform that provides insights into emerging research topics, trending keywords, and paper summaries using advanced AI analysis.

## ✨ Recent Updates

### Version 2.2.0 - AI-Powered Paper Summarization (January 13, 2025)
- **🤖 Paper Summary Generation**: New AI-powered feature to generate comprehensive paper summaries
  - Download and analyze arXiv PDFs using Gemini API
  - Generate detailed Japanese summaries covering research background, methodology, results, and implications
  - Smart caching system to avoid regenerating existing summaries
- **📄 Enhanced Paper Display**: Added interactive summary buttons to analyzed papers
  - "この論文を要約" button for generating new summaries
  - "要約を表示" button for viewing existing summaries
  - Rich modal interface with paper metadata and formatted summaries
- **⚙️ Analysis Configuration Improvements**: Fixed paper count consistency issues
  - UI now correctly displays the specified number of papers (up to 50)
  - Added proper validation and explanatory text for AI processing limits
- **🧪 Comprehensive Testing**: Added complete test suite for paper summary functionality

### Version 2.1.0 - Interactive Paper References & Customization
- **Enhanced Paper References**: Superscript notation (¹'²'³) with interactive tooltips and clickable arXiv links
- **Custom Keyword Dictionary**: User-defined terminology weighting for improved trend analysis
- **Markdown Style Customization**: Personalize heading fonts, line spacing, and content typography
- **Multi-language Translation Updates**: Comprehensive localization for dictionary and styling features
- **Improved UI**: Page title management and refined interface elements

## 🚀 Features

### 📈 Dashboard & Analytics
- **Real-time Statistics**: Track total papers, recent submissions, and trending keywords
- **Interactive Word Cloud**: Visualize trending keywords from the last 16 weeks
- **Comprehensive Summaries**: Get insights about research landscape

### 🔍 Paper Search & Management
- **Advanced Search**: Full-text search across titles, abstracts, and keywords
- **Smart Filtering**: Date range, relevance, and sorting options
- **Reading List**: Personal paper management with priority levels and notes
- **Multi-language Support**: Interface available in English, Japanese, Chinese, Korean, and German

### 🔥 AI-Powered Analysis
- **Hot Topics Detection**: Automatically identify trending research areas
- **Weekly Trend Analysis**: Get AI-generated summaries of research trends
- **Topic Keywords Extraction**: Extract and rank relevant research keywords
- **Topic Summaries**: Generate detailed summaries for selected topics

### ⚙️ Advanced Configuration
- **Multiple AI Providers**: Support for Google Gemini, OpenAI, and Anthropic Claude
- **Custom System Prompts**: Personalize AI analysis behavior
- **Thinking Budget Control**: Fine-tune AI reasoning depth (-1 for unlimited, 0 to disable)
- **Theme Management**: Light, dark, and auto themes
- **Markdown Rendering**: Beautiful formatting with syntax highlighting
- **Dictionary-Based Analysis**: Custom keyword weighting for enhanced trend detection
- **Flexible Styling**: User-customizable typography and spacing for content display

### 📄 Smart Content Features
- **Interactive Paper References**: Automatic detection of paper references with superscript links¹'² and hover tooltips
- **Custom Keyword Dictionary**: User-defined technical terminology for enhanced keyword analysis
- **Markdown Style Customization**: Personalize heading fonts, line spacing, and paragraph formatting
- **Cached Analysis**: Efficient database caching to reduce API costs
- **Manual Triggers**: Cost-effective analysis generation on demand

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM
- **Pydantic**: Data validation using Python type annotations
- **Google Generative AI**: Advanced AI analysis capabilities
- **asyncio**: Asynchronous programming support

### Frontend
- **React 18**: Modern UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Bootstrap 5**: Responsive design framework
- **React Markdown**: Markdown rendering with syntax highlighting
- **i18next**: Internationalization framework
- **React Router**: Client-side routing

### Database
- **SQLite**: Lightweight, file-based database
- **Caching System**: Efficient result storage for cost optimization

## 📦 Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/hawkymisc/paper-trend-analyzer.git
   cd paper-trend-analyzer/backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your settings:
   ```env
   # AI Provider Settings
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_key_here  # Optional
   ANTHROPIC_API_KEY=your_anthropic_key_here  # Optional
   
   # AI Configuration
   AI_PROVIDER=gemini
   GEMINI_MODEL=gemini-1.5-pro
   GEMINI_MAX_TOKENS=4000
   GEMINI_TEMPERATURE=0.3
   GEMINI_THINKING_BUDGET=20000
   GEMINI_TIMEOUT=120
   
   # Analysis Settings
   HOT_TOPICS_MAX_TOPICS=10
   HOT_TOPICS_MIN_PAPERS=3
   HOT_TOPICS_TIMEOUT=180
   ```

5. **Run the backend**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start development server**
   ```bash
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Multi-language Support

The application supports the following languages:
- English (en)
- Japanese (ja) - 日本語
- Chinese (zh) - 中文
- Korean (ko) - 한국어
- German (de) - Deutsch

Users can switch languages using the language switcher in the navigation bar.

## API Documentation

Comprehensive API documentation is available in [docs/api.md](docs/api.md). Key endpoints include:

- `GET /api/v1/dashboard/summary` - Dashboard statistics
- `GET /api/v1/dashboard/trending-keywords` - Trending keywords
- `GET /api/v1/papers/search` - Paper search with sorting
- `GET /api/v1/trends` - Keyword trend analysis

## Architecture

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: Database ORM with SQLite for local development
- **Automated Processing**: Scheduled paper fetching and keyword extraction
- **Caching**: In-memory caching for performance optimization

### Frontend
- **React**: Component-based UI library with TypeScript
- **React Router**: Client-side routing
- **react-i18next**: Internationalization framework
- **Bootstrap**: Responsive UI components
- **Chart.js**: Interactive data visualization

## Development

### Project Structure
```
paper-trend-analyzer/
├── backend/                 # FastAPI backend
│   ├── app/                # Core application
│   │   ├── main.py        # API routes
│   │   ├── models.py      # Database models
│   │   ├── services.py    # Business logic
│   │   └── schemas.py     # Pydantic schemas
│   └── scripts/           # Utility scripts
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── locales/       # Translation files
│   │   └── i18n.ts        # i18n configuration
│   └── public/           # Static assets
├── docs/                  # Documentation
└── start_dev.sh          # Development startup script
```

### Key Technologies
- **Backend**: FastAPI, SQLAlchemy, Pydantic, arXiv API
- **Frontend**: React, TypeScript, Bootstrap, react-i18next
- **Database**: SQLite (development), PostgreSQL (production)
- **Deployment**: Docker, Kubernetes ready

## Documentation

- [Setup Guide](docs/setup.md) - Installation and deployment instructions
- [API Documentation](docs/api.md) - Complete API reference
- [Developer Guide](docs/developer.md) - Development workflow and architecture
- [User Guide](docs/usage.md) - How to use the application

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

For detailed development guidelines, see [docs/developer.md](docs/developer.md).

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please use the GitHub Issues page or refer to the documentation in the `docs/` directory.
