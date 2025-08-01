"""
AI Service for paper summarization and analysis
"""
import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    import openai
except ImportError:
    openai = None

try:
    import anthropic
except ImportError:
    anthropic = None

from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class HotTopic:
    """Hot topic data structure"""
    topic: str
    paper_count: int
    recent_papers: List[Dict[str, Any]]
    summary: str
    keywords: List[str]
    trend_score: float


class AIServiceBase(ABC):
    """Abstract base class for AI services"""
    
    @abstractmethod
    async def generate_summary(self, text: str, language: str = "auto") -> str:
        """Generate a summary for the given text"""
        pass
    
    @abstractmethod
    async def analyze_hot_topics(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> List[HotTopic]:
        """Analyze papers and extract hot topics"""
        pass
    
    @abstractmethod
    async def generate_weekly_trend_overview(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> str:
        """Generate weekly trend overview text"""
        pass
    
    @abstractmethod
    async def extract_topic_keywords(self, papers_data: List[Dict[str, Any]], language: str = "auto", max_keywords: int = 30) -> List[Dict[str, Any]]:
        """Extract trending topic keywords from papers"""
        pass
    
    @abstractmethod
    async def generate_topic_summary(self, keywords: List[str], papers_data: List[Dict[str, Any]], language: str = "auto") -> Dict[str, Any]:
        """Generate summary for specific topic keywords"""
        pass
    
    @abstractmethod
    async def generate_paper_summary(self, paper_text: str, language: str = "ja") -> str:
        """Generate summary for a specific paper"""
        pass


class GeminiService(AIServiceBase):
    """Gemini AI Service implementation"""
    
    def __init__(self, model_name: str = None):
        if not genai:
            raise ImportError("google-generativeai package not installed")
        
        if not settings.gemini_api_key:
            raise ValueError("Gemini API key not configured")
        
        genai.configure(api_key=settings.gemini_api_key)
        self.model_name = model_name or settings.gemini_model
        self.model = genai.GenerativeModel(self.model_name)
        logger.info(f"Initialized Gemini service with model: {self.model_name}")
    
    def _create_generation_config(self):
        """Create generation config with thinking budget support"""
        config_params = {
            'max_output_tokens': settings.gemini_max_tokens,
            'temperature': settings.gemini_temperature,
        }
        
        # Add thinking budget if configured
        if settings.gemini_thinking_budget:
            try:
                # Check if thinking_budget is supported in this version
                config_params['thinking_budget'] = settings.gemini_thinking_budget
                logger.info(f"Using thinking budget: {settings.gemini_thinking_budget} tokens")
            except Exception as e:
                logger.warning(f"Thinking budget not supported in this Gemini API version: {e}")
        
        try:
            if genai:
                return genai.types.GenerationConfig(**config_params)
            else:
                return config_params
        except (TypeError, AttributeError) as e:
            # Fallback if thinking_budget parameter is not supported
            if 'thinking_budget' in str(e) and 'thinking_budget' in config_params:
                logger.warning("Thinking budget parameter not supported, falling back to basic config")
                config_params.pop('thinking_budget', None)
                if genai:
                    return genai.types.GenerationConfig(**config_params)
                else:
                    return config_params
            raise
    
    async def generate_summary(self, text: str, language: str = "auto") -> str:
        """Generate summary using Gemini"""
        try:
            language_instruction = self._get_language_instruction(language)
            
            prompt = f"""
{language_instruction}

Please provide a concise summary of the following academic papers and research content. 
Focus on the main findings, methodologies, and significance of the research.
Keep the summary under {settings.summary_max_length} words.

Content:
{text}

Summary:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return response.text.strip()
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini summary generation timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"Summary generation timed out after {settings.gemini_timeout} seconds")
        except Exception as e:
            logger.error(f"Gemini summary generation failed: {e}")
            raise
    
    async def analyze_hot_topics(
        self, 
        papers_data: List[Dict[str, Any]], 
        language: str = "auto",
        system_prompt: Optional[str] = None
    ) -> List[HotTopic]:
        """Analyze hot topics using Gemini"""
        try:
            language_instruction = self._get_language_instruction(language)
            
            # Prepare papers text for analysis
            papers_text = self._format_papers_for_analysis(papers_data)
            
            # Use custom system prompt if provided
            base_instruction = system_prompt if system_prompt else "Analyze the following academic papers and identify the top trending topics or research trends."
            
            prompt = f"""
{base_instruction}

{language_instruction}

For each topic, provide:
1. Topic name
2. Number of related papers
3. Brief summary of the research area
4. Key keywords
5. Trend score (0-100, where 100 is most trending)

Format your response as JSON with the following structure:
{{
  "hot_topics": [
    {{
      "topic": "Topic Name",
      "paper_count": number,
      "summary": "Brief summary of the research area",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "trend_score": score
    }}
  ]
}}

Papers data:
{papers_text}

Analysis:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return self._parse_hot_topics_response(response.text, papers_data)
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini hot topics analysis timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"Hot topics analysis timed out after {settings.gemini_timeout} seconds")
        except Exception as e:
            logger.error(f"Gemini hot topics analysis failed: {e}")
            raise
    
    def _get_language_instruction(self, language: str) -> str:
        """Get language-specific instruction"""
        if language == "auto" or language == "en":
            return "Please respond in English."
        elif language == "ja":
            return "日本語で回答してください。"
        elif language == "zh":
            return "请用中文回答。"
        elif language == "ko":
            return "한국어로 답변해 주세요."
        elif language == "de":
            return "Bitte antworten Sie auf Deutsch."
        else:
            return "Please respond in English."
    
    def _format_papers_for_analysis(self, papers_data: List[Dict[str, Any]]) -> str:
        """Format papers data for AI analysis"""
        formatted_papers = []
        # Import settings here to avoid circular imports
        from .config import settings
        max_papers = settings.get_default_analysis_limit()
        for i, paper in enumerate(papers_data[:max_papers]):  # Configurable limit to avoid token overflow
            formatted_paper = f"""
Paper {i+1}:
Title: {paper.get('title', 'N/A')}
Authors: {', '.join(paper.get('authors', []))}
Published: {paper.get('published_at', 'N/A')}
Summary: {paper.get('summary', 'N/A')[:settings.ai_summary_char_limit]}...
Keywords: {', '.join(paper.get('keywords', []))}
"""
            formatted_papers.append(formatted_paper)
        
        return "\n".join(formatted_papers)
    
    def _parse_hot_topics_response(self, response_text: str, papers_data: List[Dict[str, Any]]) -> List[HotTopic]:
        """Parse AI response into HotTopic objects"""
        import json
        import re
        
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")
            
            hot_topics = []
            for topic_data in data.get("hot_topics", []):
                # Find related papers based on keywords and topic
                related_papers = self._find_related_papers(
                    topic_data.get("keywords", []),
                    topic_data.get("topic", ""),
                    papers_data
                )
                
                hot_topic = HotTopic(
                    topic=topic_data.get("topic", "Unknown Topic"),
                    paper_count=len(related_papers),
                    recent_papers=related_papers[:settings.ai_related_papers_display_limit],  # Configurable recent papers
                    summary=topic_data.get("summary", ""),
                    keywords=topic_data.get("keywords", []),
                    trend_score=topic_data.get("trend_score", 0)
                )
                hot_topics.append(hot_topic)
            
            return hot_topics
            
        except Exception as e:
            logger.error(f"Failed to parse hot topics response: {e}")
            # Return fallback hot topics if parsing fails
            return self._generate_fallback_hot_topics(papers_data)
    
    def _find_related_papers(self, keywords: List[str], topic: str, papers_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find papers related to given keywords and topic"""
        related_papers = []
        search_terms = [kw.lower() for kw in keywords] + [topic.lower()]
        
        for paper in papers_data:
            title = paper.get('title', '').lower()
            summary = paper.get('summary', '').lower()
            paper_keywords = [kw.lower() for kw in paper.get('keywords', [])]
            
            # Check if any search term appears in title, summary, or keywords
            if any(term in title or term in summary or term in ' '.join(paper_keywords) for term in search_terms):
                related_papers.append(paper)
        
        # Sort by published date (most recent first)
        related_papers.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        return related_papers
    
    def _generate_fallback_hot_topics(self, papers_data: List[Dict[str, Any]]) -> List[HotTopic]:
        """Generate fallback hot topics when AI parsing fails"""
        # Simple keyword frequency analysis as fallback
        keyword_counts = {}
        for paper in papers_data:
            for keyword in paper.get('keywords', []):
                keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
        
        # Get top keywords
        top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:settings.hot_topics_max_topics]
        
        hot_topics = []
        for i, (keyword, count) in enumerate(top_keywords):
            if count >= settings.hot_topics_min_papers:
                related_papers = [p for p in papers_data if keyword in p.get('keywords', [])]
                hot_topic = HotTopic(
                    topic=keyword,
                    paper_count=count,
                    recent_papers=related_papers[:settings.ai_related_papers_display_limit],
                    summary=f"Research area focusing on {keyword}",
                    keywords=[keyword],
                    trend_score=max(0, 100 - i * 10)  # Decreasing score
                )
                hot_topics.append(hot_topic)
        
        return hot_topics
    
    async def generate_weekly_trend_overview(
        self, 
        papers_data: List[Dict[str, Any]], 
        language: str = "auto",
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate weekly trend overview using Gemini"""
        try:
            language_instruction = self._get_language_instruction(language)
            papers_text = self._format_papers_for_analysis(papers_data[:settings.ai_overview_analysis_papers])  # Configurable overview limit
            
            # Use custom system prompt if provided
            base_instruction = system_prompt if system_prompt else """Analyze the following academic papers from the past week and provide a comprehensive overview of the research trends. 
Focus on:
1. Main research themes and directions
2. Emerging technologies or methodologies  
3. Popular application domains
4. Notable shifts or new developments

Please write a coherent narrative overview (300-500 words) that captures the essence of this week's research landscape.

IMPORTANT: When referencing specific papers in your analysis, use the format [Paper:N] where N is the paper number from the data provided. This allows for interactive paper references in the UI."""
            
            prompt = f"""
{base_instruction}

{language_instruction}

Papers data:
{papers_text}

Weekly Trend Overview:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return response.text.strip()
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini weekly trend overview timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"Weekly trend overview generation timed out after {settings.gemini_timeout} seconds")
        except Exception as e:
            logger.error(f"Gemini weekly trend overview failed: {e}")
            # Fallback overview
            return f"This week's research shows activity across {len(papers_data)} papers covering diverse topics including machine learning, AI applications, and emerging technologies."
    
    async def extract_topic_keywords(
        self, 
        papers_data: List[Dict[str, Any]], 
        language: str = "auto", 
        max_keywords: int = None,
        system_prompt: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Extract trending topic keywords using Gemini"""
        try:
            # Import settings here to avoid circular imports
            from .config import settings
            if max_keywords is None:
                max_keywords = settings.ai_max_keywords_default
            
            language_instruction = self._get_language_instruction(language)
            max_papers = settings.get_default_analysis_limit()
            papers_text = self._format_papers_for_analysis(papers_data[:max_papers])
            
            # Use custom system prompt if provided
            base_instruction = system_prompt if system_prompt else f"""Analyze the following academic papers and extract the most trending and relevant topic keywords.
For each keyword, provide:
1. The keyword/topic name
2. Number of related papers (estimate)
3. Relevance score (0-100, where 100 is most relevant to current trends)

Return exactly {max_keywords} keywords in JSON format:
{{
  "keywords": [
    {{
      "keyword": "Machine Learning",
      "paper_count": 15,
      "relevance_score": 95
    }}
  ]
}}"""
            
            prompt = f"""
{base_instruction}

{language_instruction}

Papers data:
{papers_text}

Topic Keywords:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return self._parse_keywords_response(response.text, papers_data, max_keywords)
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini keyword extraction timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"Keyword extraction timed out after {settings.gemini_timeout} seconds")
        except Exception as e:
            logger.error(f"Gemini keyword extraction failed: {e}")
            return self._generate_fallback_keywords(papers_data, max_keywords)
    
    async def generate_topic_summary(
        self, 
        keywords: List[str], 
        papers_data: List[Dict[str, Any]], 
        language: str = "auto",
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate summary for specific topic keywords using Gemini"""
        try:
            language_instruction = self._get_language_instruction(language)
            
            # Find papers related to the selected keywords
            related_papers = self._find_papers_by_keywords(keywords, papers_data)
            papers_text = self._format_papers_for_analysis(related_papers[:settings.ai_topic_analysis_papers])
            
            keywords_str = ", ".join(keywords)
            topic_name = " & ".join(keywords) if len(keywords) > 1 else keywords[0]
            
            # Use custom system prompt if provided
            base_instruction = system_prompt if system_prompt else f"""Generate a comprehensive summary for the research topic: "{topic_name}"

Based on the following papers related to keywords: {keywords_str}

Provide:
1. A detailed summary (200-400 words) of the current state of research in this area
2. Key findings and breakthroughs
3. Main methodologies being used
4. Future directions and implications

IMPORTANT: When referencing specific papers in your summary, use the format [Paper:N] where N is the paper number from the data provided. This allows for interactive paper references in the UI.

Format as JSON:
{{
  "topic_name": "{topic_name}",
  "summary": "Detailed summary text...",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "related_paper_count": {len(related_papers)}
}}"""
            
            prompt = f"""
{base_instruction}

{language_instruction}

Papers data:
{papers_text}

Topic Summary:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return self._parse_topic_summary_response(response.text, keywords, related_papers)
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini topic summary timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"Topic summary generation timed out after {settings.gemini_timeout} seconds")
        except Exception as e:
            logger.error(f"Gemini topic summary failed: {e}")
            return self._generate_fallback_topic_summary(keywords, papers_data)
    
    def _parse_keywords_response(self, response_text: str, papers_data: List[Dict[str, Any]], max_keywords: int) -> List[Dict[str, Any]]:
        """Parse AI response into keyword objects"""
        import json
        import re
        
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
                return data.get("keywords", [])[:max_keywords]
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            logger.error(f"Failed to parse keywords response: {e}")
            return self._generate_fallback_keywords(papers_data, max_keywords)
    
    def _parse_topic_summary_response(self, response_text: str, keywords: List[str], related_papers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Parse AI response into topic summary object"""
        import json
        import re
        
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
                return data
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            logger.error(f"Failed to parse topic summary response: {e}")
            return self._generate_fallback_topic_summary(keywords, related_papers)
    
    def _find_papers_by_keywords(self, keywords: List[str], papers_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find papers related to given keywords"""
        related_papers = []
        search_terms = [kw.lower() for kw in keywords]
        
        for paper in papers_data:
            title = paper.get('title', '').lower()
            summary = paper.get('summary', '').lower()
            paper_keywords = [kw.lower() for kw in paper.get('keywords', [])]
            
            # Check if any search term appears in title, summary, or keywords
            if any(term in title or term in summary or any(term in pk for pk in paper_keywords) for term in search_terms):
                related_papers.append(paper)
        
        # Sort by published date (most recent first)
        related_papers.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        return related_papers
    
    def _generate_fallback_keywords(self, papers_data: List[Dict[str, Any]], max_keywords: int) -> List[Dict[str, Any]]:
        """Generate fallback keywords when AI parsing fails"""
        keyword_counts = {}
        for paper in papers_data:
            for keyword in paper.get('keywords', []):
                keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
        
        # Get top keywords
        top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:max_keywords]
        
        keywords = []
        for i, (keyword, count) in enumerate(top_keywords):
            keywords.append({
                "keyword": keyword,
                "paper_count": count,
                "relevance_score": max(0, 100 - i * 3)  # Decreasing score
            })
        
        return keywords
    
    def _generate_fallback_topic_summary(self, keywords: List[str], papers_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate fallback topic summary when AI parsing fails"""
        topic_name = " & ".join(keywords) if len(keywords) > 1 else keywords[0]
        related_papers = self._find_papers_by_keywords(keywords, papers_data)
        
        return {
            "topic_name": topic_name,
            "summary": f"Research in {topic_name} shows active development with {len(related_papers)} related papers. This area covers various methodologies and applications in current academic research.",
            "key_findings": [
                f"Active research in {topic_name}",
                f"{len(related_papers)} papers identified in this area",
                "Diverse methodological approaches observed"
            ],
            "related_paper_count": len(related_papers)
        }
    
    async def generate_paper_summary(self, paper_text: str, language: str = "ja") -> str:
        """Generate summary for a specific paper using Gemini"""
        try:
            language_instruction = self._get_language_instruction(language)
            
            prompt = f"""
{language_instruction}

以下の学術論文の内容を要約してください。要約では以下の点に焦点を当ててください：

1. 研究の背景と動機
2. 提案された手法やアプローチ
3. 主要な実験結果や発見
4. 研究の意義と応用可能性
5. 将来の研究方向

要約は400-600文字程度で、読みやすい日本語で記載してください。

論文内容:
{paper_text}

要約:"""

            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    generation_config=self._create_generation_config()
                ),
                timeout=settings.gemini_timeout
            )
            
            return response.text.strip()
            
        except asyncio.TimeoutError:
            logger.error(f"Gemini paper summary generation timed out after {settings.gemini_timeout} seconds")
            raise TimeoutError(f"論文要約の生成がタイムアウトしました（{settings.gemini_timeout}秒）")
        except Exception as e:
            logger.error(f"Gemini paper summary generation failed: {e}")
            raise Exception(f"論文要約の生成に失敗しました: {str(e)}")
    
    async def fetch_arxiv_pdf(self, arxiv_id: str) -> str:
        """Fetch and extract text from arXiv PDF"""
        import aiohttp
        import asyncio
        import io
        
        try:
            # Import settings for configuration
            from .config import settings
            
            # Construct PDF URL
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
            
            # Download PDF
            async with aiohttp.ClientSession() as session:
                async with session.get(pdf_url) as response:
                    if response.status != 200:
                        raise Exception(f"PDFダウンロードに失敗しました。HTTPステータス: {response.status}")
                    
                    pdf_content = await response.read()
            
            # Extract text from PDF
            from pypdf import PdfReader
            
            pdf_file = io.BytesIO(pdf_content)
            pdf_reader = PdfReader(pdf_file)
            
            text_content = ""
            for page_num in range(min(len(pdf_reader.pages), settings.ai_pdf_max_pages)):  # Configurable page limit
                page = pdf_reader.pages[page_num]
                text_content += page.extract_text() + "\n"
            
            if not text_content.strip():
                raise Exception("PDFからテキストを抽出できませんでした")
            
            # Limit text length to avoid token limits
            max_chars = settings.ai_text_max_characters  # Configurable limit for AI processing
            if len(text_content) > max_chars:
                text_content = text_content[:max_chars] + "..."
            
            return text_content
            
        except Exception as e:
            logger.error(f"arXiv PDF fetch failed for {arxiv_id}: {e}")
            raise Exception(f"arXiv PDFの取得に失敗しました: {str(e)}")


class OpenAIService(AIServiceBase):
    """OpenAI Service implementation (placeholder)"""
    
    def __init__(self, model_name: str = None):
        if not openai:
            raise ImportError("openai package not installed")
        
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        self.client = openai.OpenAI(api_key=settings.openai_api_key)
        self.model_name = model_name or settings.openai_model
    
    async def generate_summary(self, text: str, language: str = "auto") -> str:
        # Implementation would go here
        raise NotImplementedError("OpenAI service not yet implemented")
    
    async def analyze_hot_topics(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> List[HotTopic]:
        # Implementation would go here  
        raise NotImplementedError("OpenAI service not yet implemented")
    
    async def generate_weekly_trend_overview(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> str:
        raise NotImplementedError("OpenAI service not yet implemented")
    
    async def extract_topic_keywords(self, papers_data: List[Dict[str, Any]], language: str = "auto", max_keywords: int = None) -> List[Dict[str, Any]]:
        raise NotImplementedError("OpenAI service not yet implemented")
    
    async def generate_topic_summary(self, keywords: List[str], papers_data: List[Dict[str, Any]], language: str = "auto") -> Dict[str, Any]:
        raise NotImplementedError("OpenAI service not yet implemented")
    
    async def generate_paper_summary(self, paper_text: str, language: str = "ja") -> str:
        raise NotImplementedError("OpenAI service not yet implemented")


class AnthropicService(AIServiceBase):
    """Anthropic Service implementation (placeholder)"""
    
    def __init__(self, model_name: str = None):
        if not anthropic:
            raise ImportError("anthropic package not installed")
        
        if not settings.anthropic_api_key:
            raise ValueError("Anthropic API key not configured")
        
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model_name = model_name or settings.anthropic_model
    
    async def generate_summary(self, text: str, language: str = "auto") -> str:
        # Implementation would go here
        raise NotImplementedError("Anthropic service not yet implemented")
    
    async def analyze_hot_topics(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> List[HotTopic]:
        # Implementation would go here
        raise NotImplementedError("Anthropic service not yet implemented")
    
    async def generate_weekly_trend_overview(self, papers_data: List[Dict[str, Any]], language: str = "auto") -> str:
        raise NotImplementedError("Anthropic service not yet implemented")
    
    async def extract_topic_keywords(self, papers_data: List[Dict[str, Any]], language: str = "auto", max_keywords: int = None) -> List[Dict[str, Any]]:
        raise NotImplementedError("Anthropic service not yet implemented")
    
    async def generate_topic_summary(self, keywords: List[str], papers_data: List[Dict[str, Any]], language: str = "auto") -> Dict[str, Any]:
        raise NotImplementedError("Anthropic service not yet implemented")
    
    async def generate_paper_summary(self, paper_text: str, language: str = "ja") -> str:
        raise NotImplementedError("Anthropic service not yet implemented")


class AIServiceFactory:
    """Factory for creating AI service instances"""
    
    @staticmethod
    def create_service(provider: str = None, model_name: str = None) -> AIServiceBase:
        """Create AI service based on configuration"""
        provider = provider or settings.ai_provider
        
        if provider == "gemini":
            return GeminiService(model_name)
        elif provider == "openai":
            return OpenAIService(model_name)
        elif provider == "anthropic":
            return AnthropicService(model_name)
        else:
            raise ValueError(f"Unsupported AI provider: {provider}")


# Global AI service instance
ai_service = None

def get_ai_service() -> AIServiceBase:
    """Get the global AI service instance"""
    global ai_service
    if ai_service is None:
        ai_service = AIServiceFactory.create_service()
    return ai_service