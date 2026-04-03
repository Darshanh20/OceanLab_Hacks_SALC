"""
Analysis pipeline.

Compatibility orchestrator that delegates to the AI layer pipelines.
"""

from app.core.pipeline.summary_pipeline import run_summary_pipeline
from app.core.pipeline.action_plan_pipeline import run_action_plan_pipeline
from app.core.pipeline.insights_pipeline import run_insights_pipeline
from app.services.db.lecture_repo import update_lecture_status


async def run_analysis_pipeline(lecture_id: str) -> dict:
    """
    Generate AI-powered analysis by delegating to the summary,
    action plan, and insights pipelines.
    """
    try:
        summary_result = await run_summary_pipeline(lecture_id)
        action_plan_result = await run_action_plan_pipeline(lecture_id)
        insights_result = await run_insights_pipeline(lecture_id)

        update_lecture_status(lecture_id, "completed")
        
        return {
            "lecture_id": lecture_id,
            "status": "analysis_complete",
            "summary_cached": summary_result.get("cached", False),
            "action_plan_cached": action_plan_result.get("cached", False),
            "insights_cached": insights_result.get("cached", False),
        }
    
    except Exception as e:
        update_lecture_status(lecture_id, "failed")
        raise Exception(f"Analysis pipeline failed: {str(e)}")
