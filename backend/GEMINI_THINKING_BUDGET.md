# Gemini API Thinking Budget Configuration

## Overview

The Gemini API supports a `thinking_budget` parameter that allows you to control the amount of computational resources the model uses for reasoning before generating its response. This feature can improve the quality of complex analysis tasks like hot topics summarization.

## Configuration

### Environment Variable

Add the following to your `.env` file:

```env
GEMINI_THINKING_BUDGET=20000
```

### Settings

The thinking budget is configured in `app/config.py`:

```python
gemini_thinking_budget: Optional[int] = Field(default=20000, description="Thinking budget for Gemini API (tokens)")
```

## How It Works

1. **Higher Budget**: More computational resources for complex reasoning
   - Better analysis quality for hot topics
   - More thorough understanding of paper relationships
   - Improved topic categorization

2. **Lower Budget**: Faster responses with basic reasoning
   - Quicker hot topic generation
   - Good for simple summarization tasks

3. **No Budget (None/0)**: Standard Gemini behavior
   - Default model performance
   - Fastest response times

## Recommended Values

| Use Case | Thinking Budget | Trade-off |
|----------|----------------|-----------|
| Complex Analysis | 20000-30000 | High quality, slower |
| Standard Analysis | 10000-20000 | Balanced quality/speed |
| Quick Summaries | 5000-10000 | Good quality, faster |
| Real-time | 0 or None | Basic quality, fastest |

## Fallback Behavior

The implementation includes automatic fallback:

1. If `thinking_budget` is not supported by the current Gemini API version, it will log a warning and continue without it
2. If the parameter causes errors, it will retry without the thinking budget
3. The system remains functional even with older Gemini API versions

## Usage in Hot Topics

The thinking budget is particularly useful for hot topics analysis because:

- **Pattern Recognition**: Better identification of emerging research trends
- **Relationship Analysis**: More accurate grouping of related papers
- **Summary Quality**: More coherent and insightful topic summaries
- **Keyword Extraction**: Better identification of relevant technical terms

## Monitoring

Check the application logs for thinking budget usage:

```
INFO: Using thinking budget: 20000 tokens
WARNING: Thinking budget not supported in this Gemini API version
```

## Performance Impact

| Thinking Budget | Response Time | Analysis Quality |
|----------------|---------------|------------------|
| None | ~2-5 seconds | Good |
| 10000 | ~5-8 seconds | Better |
| 20000 | ~8-15 seconds | Excellent |
| 30000+ | ~15-30 seconds | Outstanding |

Choose the value that best balances your quality requirements with acceptable response times.