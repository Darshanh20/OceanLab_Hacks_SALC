"""
Analysis pipeline.

Generates summaries, insights, and action items.
"""

from app.services.db.lecture_repo import get_lecture, update_lecture_status
from app.services.analysis_service import (
    generate_summary,
    extract_keywords,
    generate_questions,
    segment_topics,
)
from app.services.db.analysis_repo import save_analysis


async def run_analysis_pipeline(lecture_id: str) -> dict:
    """
    Generate AI-powered analysis.
    
    Steps:
    1. Get lecture from DB
    2. Generate summary
    3. Extract keywords
    4. Generate questions
    5. Segment topics
    6. Save all analyses
    7. Mark complete
    """
    try:
        # 1. Get lecture
        lecture = get_lecture(lecture_id)
        
        if not lecture or not lecture.get("transcript_text"):
            raise ValueError("Lecture not found or missing transcript_text")
        
        # 2. Generate summary
        summary = await generate_summary(lecture["transcript_text"])
        
        # 3. Extract keywords
        keywords = await extract_keywords(lecture["transcript_text"])
        
        # 4. Generate questions
        questions = await generate_questions(lecture["transcript_text"])
        
        # 5. Segment topics
        topics = await segment_topics(lecture["transcript_text"])
        
        # 6. Cache all analyses
        analyses = [
            {"analysis_type": "summary", "content": summary},
            {"analysis_type": "keywords", "content": keywords},
            {"analysis_type": "questions", "content": questions},
            {"analysis_type": "topics", "content": topics},
        ]
        
        for analysis in analyses:
            save_analysis(lecture_id, analysis["analysis_type"], analysis["content"])
        
        # 7. Mark lecture as complete
        update_lecture_status(lecture_id, "completed")
        
        return {
            "lecture_id": lecture_id,
            "status": "analysis_complete",
            "analyses_generated": len(analyses)
        }
    
    except Exception as e:
        update_lecture_status(lecture_id, "failed")
        raise Exception(f"Analysis pipeline failed: {str(e)}")
