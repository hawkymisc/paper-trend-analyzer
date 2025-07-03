# Paper Trend Analyzer - Project Specification

## 1. Project Overview

This project, "Paper Trend Analyzer," aims to provide tools for analyzing trends in academic papers. It allows users to search for papers, analyze keyword trends over time, and view a dashboard summarizing key metrics and trending topics.

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

## 3. Technical Stack (Current/Planned)

### 3.1. Frontend
- **Framework:** React (TypeScript)
- **UI Library:** React-Bootstrap, Bootstrap CSS
- **Charting Library:** Recharts
- **Word Cloud Library:** react-wordcloud
- **Routing:** React Router DOM

### 3.2. Backend
- **Framework:** FastAPI (Python)
- **Database ORM:** SQLAlchemy
- **Database:** PostgreSQL (implied by `psycopg2-binary` in `requirements.txt` and `test.db` file name, though `test.db` might imply SQLite for testing)
- **Dependency Management:** pip (requirements.txt)

## 4. Data Sources

- Academic paper data (e.g., arXiv API, though not explicitly stated, implied by `arxiv_id` and `arxiv_url` in schemas).

## 5. Future Considerations (Implied)

- Interactivity for word cloud.
- More sophisticated trend analysis features.
