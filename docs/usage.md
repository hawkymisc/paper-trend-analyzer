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

## 5. Data Collection

The application collects paper data from the arXiv API. The `fetch_papers.py` script in the `backend/scripts/` directory is responsible for this. You can run this script periodically to update the database with the latest papers.

## 6. Troubleshooting

If you encounter any issues, please refer to the [Developer Guide](developer.md) for debugging tips and project structure information.
