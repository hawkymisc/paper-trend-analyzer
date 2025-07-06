# User Usage Guide

Welcome to the Paper Trend Analyzer! This application helps you discover trends in academic papers related to Large Language Models (LLMs) and Artificial Intelligence (AI).

## 1. Overview

The application consists of two main parts:
- **Dashboard**: Provides a summary of paper statistics and trending keywords.
- **Trend Analysis**: Allows you to analyze the trend of specific keywords over time.

## 2. Getting Started

To use the application, you need to have the backend and frontend running. Please refer to the [Setup and Deployment Guide](setup.md) for instructions on how to set up and run the application locally.

## 3. Dashboard

Upon launching the application, you will land on the Dashboard. Here you can see:

- **Total Papers**: The total number of papers collected in the database.
- **Recent Papers**: The number of papers published in the last 24 hours, 7 days, and 30 days.
- **Trending Keywords**: A list of keywords that have shown significant growth in recent publications. This helps you quickly identify emerging topics.

## 4. Trend Analysis

Navigate to the "Trend Analysis" section to explore the trends of specific keywords.

### How to Use:

1.  **Enter Keywords**: In the input field, type the keywords you are interested in. You can enter multiple keywords separated by commas (e.g., `LLM, Transformer, RAG`).
2.  **Select Date Range (Optional)**: You can specify a start and end date to filter the papers. This allows you to focus on trends within a particular period.
3.  **Analyze**: Click the "Analyze" button to generate a trend graph. The graph will show the number of papers published each month for your selected keywords within the specified date range.

### Tips for Trend Analysis:

-   **Broad vs. Specific Keywords**: Experiment with both broad (e.g., "AI") and specific (e.g., "Reinforcement Learning from Human Feedback") keywords to get different perspectives on trends.
-   **Date Range**: Adjust the date range to observe short-term spikes or long-term growth patterns.
-   **Combine Keywords**: Analyze multiple related keywords together to understand their co-occurrence and comparative trends.


## 6. Data Collection and Processing

The application features fully automated data collection and processing:

### Automated Paper Fetching
- **arXiv Integration**: Automatically fetches papers from the arXiv API
- **Scheduled Updates**: Regular updates to ensure fresh data
- **Quality Filtering**: Filters papers based on relevance and quality metrics

### Intelligent Keyword Extraction
- **NLP Processing**: Uses advanced natural language processing for keyword extraction
- **Technical Dictionary**: Specialized technical dictionary for high-quality keyword identification
- **Automatic Filtering**: Removes low-quality keywords and stop words
- **Trend Analysis**: Analyzes keyword growth patterns automatically

### Data Quality
- **Duplicate Detection**: Prevents duplicate papers from being stored
- **Metadata Validation**: Ensures data integrity and consistency
- **Cache Management**: Automatic cache invalidation for optimal performance

## 7. Advanced Features

### Internationalization
- **Multi-language UI**: Complete interface translation for 5 languages
- **Locale-aware Formatting**: Proper date, number, and text formatting for each language
- **Easy Language Switching**: Instant language changes without page reload

### Performance Optimization
- **Intelligent Caching**: 5-minute cache for trending keywords
- **Optimized Queries**: Database queries optimized for performance
- **Responsive Design**: Bootstrap-based responsive UI for all devices

### Search Capabilities
- **Full-text Search**: Search across titles, abstracts, and keywords
- **Relevance Scoring**: Intelligent relevance scoring for search results
- **Flexible Sorting**: Multiple sorting options for different use cases
- **Pagination**: Efficient pagination for large result sets

## 8. Troubleshooting

### Common Issues

1. **No Search Results**: 
   - Check if the database has been populated with papers
   - Try broader search terms
   - Verify date range settings

2. **Language Switching Issues**:
   - Clear browser cache
   - Refresh the page
   - Check if all translation files are loaded

3. **Performance Issues**:
   - Check if data fetching is in progress
   - Verify internet connection
   - Consider reducing search result limits

4. **Dashboard Loading Issues**:
   - Ensure backend server is running
   - Check if database contains data
   - Verify API endpoints are accessible

### Getting Help

For detailed technical information and troubleshooting, please refer to:
- [Developer Guide](developer.md) - Technical architecture and debugging
- [Setup Guide](setup.md) - Installation and configuration
- [API Documentation](api.md) - Backend API reference
