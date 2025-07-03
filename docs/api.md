# API Documentation

This document provides details about the backend API endpoints for the Paper Trend Analyzer.

## Base URL
`/`

## Endpoints

### 1. GET /
**Description**: Root endpoint of the API. Returns a welcome message.
**Method**: `GET`
**Request**:
  - No parameters.
**Response**:
  - `200 OK`
  ```json
  {
    "message": "Welcome to Paper Trend Analyzer API"
  }
  ```

### 2. GET /api/v1/dashboard/summary
**Description**: Retrieves summary statistics for the dashboard, including total papers and recent paper counts.
**Method**: `GET`
**Request**:
  - No parameters.
**Response**:
  - `200 OK`
  ```json
  {
    "total_papers": 1234,
    "recent_papers_24h": 50,
    "recent_papers_7d": 200,
    "recent_papers_30d": 500
  }
  ```

### 3. GET /api/v1/trends
**Description**: Retrieves trend data for specified keywords over time.
**Method**: `GET`
**Request**:
  - Query Parameters:
    - `keywords`: `list[str]` (Required) - A list of keywords to analyze.
    - `start_date`: `datetime` (Optional) - Start date for filtering papers (YYYY-MM-DDTHH:MM:SSZ).
    - `end_date`: `datetime` (Optional) - End date for filtering papers (YYYY-MM-DDTHH:MM:SSZ).
**Response**:
  - `200 OK`
  ```json
  [
    {
      "keyword": "LLM",
      "data": [
        {
          "date": "2023-01",
          "count": 10
        },
        {
          "date": "2023-02",
          "count": 15
        }
      ]
    },
    {
      "keyword": "AI",
      "data": [
        {
          "date": "2023-01",
          "count": 8
        },
        {
          "date": "2023-02",
          "count": 12
        }
      ]
    }
  ]
  ```
  - `400 Bad Request` (if `keywords` is empty or `start_date` > `end_date`)
  ```json
  {
    "detail": "キーワードは少なくとも1つ指定してください。"
  }
  ```
  - `422 Unprocessable Entity` (if date format is invalid)
  ```json
  {
    "detail": [
      {
        "loc": [
          "query",
          "start_date"
        ],
        "msg": "value is not a valid datetime or date, invalid character in year",
        "type": "value_error.datetime"
      }
    ]
  }
  ```

### 4. GET /api/v1/dashboard/trending-keywords
**Description**: Retrieves a list of trending keywords based on recent growth.
**Method**: `GET`
**Request**:
  - No parameters.
**Response**:
  - `200 OK`
  ```json
  {
    "trending_keywords": [
      {
        "name": "LLM",
        "recent_count": 100,
        "previous_count": 50,
        "growth_count": 50,
        "growth_rate_percent": 100.0
      },
      {
        "name": "Transformer",
        "recent_count": 80,
        "previous_count": 40,
        "growth_count": 40,
        "growth_rate_percent": 100.0
      }
    ]
  }
  ```

### Common Error Responses

- `404 Not Found`: The requested resource was not found.
  ```json
  {
    "detail": "Not Found"
  }
  ```
- `405 Method Not Allowed`: The HTTP method used is not allowed for the requested resource.
  ```json
  {
    "detail": "Method Not Allowed"
  }
  ```
