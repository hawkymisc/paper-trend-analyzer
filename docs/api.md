# API Documentation

This document provides comprehensive details about the backend API endpoints for the Paper Trend Analyzer.

## Base URL
`http://localhost:8000` (development) or your deployed server URL

## Interactive API Documentation

FastAPI automatically generates interactive API documentation:
- **Swagger UI**: Available at `/docs` (e.g., `http://localhost:8000/docs`)
- **ReDoc**: Available at `/redoc` (e.g., `http://localhost:8000/redoc`)

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

### 5. GET /api/v1/papers/search
**Description**: Searches for papers based on query terms with sorting and filtering options.
**Method**: `GET`
**Request**:
  - Query Parameters:
    - `query`: `str` (Required) - Search terms for title, abstract, or keywords
    - `skip`: `int` (Optional, default: 0) - Number of results to skip (for pagination)
    - `limit`: `int` (Optional, default: 100, max: 200) - Number of results to return
    - `start_date`: `str` (Optional) - Start date filter (YYYY-MM-DD format)
    - `end_date`: `str` (Optional) - End date filter (YYYY-MM-DD format)
    - `sort_by`: `str` (Optional, default: "date") - Sort order ("date" or "relevance")
**Response**:
  - `200 OK`
  ```json
  {
    "papers": [
      {
        "id": 1,
        "title": "Attention Is All You Need",
        "authors": ["Vaswani, A.", "Shazeer, N."],
        "summary": "We propose a new simple network architecture...",
        "published_at": "2017-06-12T00:00:00Z",
        "arxiv_id": "1706.03762",
        "arxiv_url": "https://arxiv.org/abs/1706.03762"
      }
    ],
    "total_count": 1234,
    "skip": 0,
    "limit": 100
  }
  ```
  - `400 Bad Request` (if query is empty)
  ```json
  {
    "detail": "Search query cannot be empty"
  }
  ```

### 6. GET /api/v1/keywords/word-cloud
**Description**: Retrieves keyword data for word cloud visualization.
**Method**: `GET`
**Request**:
  - No parameters.
**Response**:
  - `200 OK`
  ```json
  [
    {
      "text": "LLM",
      "value": 150,
      "rank": 1
    },
    {
      "text": "Transformer",
      "value": 120,
      "rank": 2
    }
  ]
  ```

### 7. GET /api/v1/keywords/stats
**Description**: Retrieves keyword statistics for system monitoring.
**Method**: `GET`
**Request**:
  - No parameters.
**Response**:
  - `200 OK`
  ```json
  {
    "total_keywords": 5432,
    "total_associations": 98765
  }
  ```

## Common Error Responses

- `400 Bad Request`: Invalid request parameters.
  ```json
  {
    "detail": "Invalid request parameters"
  }
  ```
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
- `422 Unprocessable Entity`: Validation error.
  ```json
  {
    "detail": [
      {
        "loc": ["query", "field_name"],
        "msg": "field required",
        "type": "value_error.missing"
      }
    ]
  }
  ```
- `500 Internal Server Error`: Server-side error.
  ```json
  {
    "detail": "Internal Server Error"
  }
  ```

## Rate Limiting

The API implements caching to improve performance:
- Trending keywords are cached for 5 minutes
- Database queries are optimized with proper indexing
- Consider implementing rate limiting for production deployments

## Authentication

Currently, the API does not require authentication for read operations. Consider implementing authentication for production deployments.

## CORS Configuration

The API is configured to allow cross-origin requests from all origins during development. Restrict this in production environments.

## Data Models

### Paper
```json
{
  "id": "integer",
  "title": "string",
  "authors": ["string"],
  "summary": "string",
  "published_at": "datetime (ISO 8601)",
  "arxiv_id": "string",
  "arxiv_url": "string"
}
```

### Keyword
```json
{
  "name": "string",
  "recent_count": "integer",
  "previous_count": "integer",
  "growth_count": "integer",
  "growth_rate_percent": "float"
}
```

### Trend Data Point
```json
{
  "date": "string (YYYY-MM)",
  "count": "integer"
}
```
