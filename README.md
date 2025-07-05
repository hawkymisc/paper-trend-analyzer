# Paper Trend Analyzer

An intelligent system for analyzing trends in academic papers, with a focus on Large Language Models (LLMs) and Artificial Intelligence research. This application provides real-time insights into trending keywords, automated paper analysis, and comprehensive search capabilities with multi-language support.

## Features

- **Dashboard**: Summary statistics and trending keywords with interactive word cloud visualization
- **Automated Paper Analysis**: Fully automated keyword extraction and trend analysis
- **Multi-language Support**: Full internationalization (i18n) support for English, Japanese, Chinese, Korean, and German
- **Advanced Search**: Paper search with relevance and date sorting options
- **Real-time Trends**: Dynamic trend analysis with customizable date ranges
- **Responsive Design**: Bootstrap-based UI that works on all devices

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 14+
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd paper-trend-analyzer
```

2. Start the development environment:
```bash
# Make the startup script executable
chmod +x start_dev.sh

# Run both backend and frontend
./start_dev.sh
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Manual Setup

For detailed setup instructions, see [docs/setup.md](docs/setup.md).

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
