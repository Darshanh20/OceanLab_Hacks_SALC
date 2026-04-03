import io
import json
import re
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fpdf import FPDF
from app.middleware.auth_middleware import get_current_user
from app.services.supabase_client import get_supabase
from app.services.organization_service import OrganizationService
from app.services.group_service import GroupService

router = APIRouter(prefix="/api/export", tags=["Export"])


class ExportRequest(BaseModel):
    lecture_id: str
    include_transcript: bool = True
    include_summary: bool = True


async def _can_access_lecture(lecture: dict, user_id: str) -> bool:
    """
    Access model:
    - Personal lecture (no org_id): only uploader can access.
    - Workspace lecture (org_id, no group_id): any workspace member can access.
    - Team lecture (org_id + group_id): team members, org admins, and org owner can access.
    """
    owner_id = lecture.get("user_id")
    org_id = lecture.get("org_id")
    group_id = lecture.get("group_id")

    # Personal content remains private to creator.
    if not org_id:
        return owner_id == user_id

    org_role = await OrganizationService.get_role(org_id, user_id)
    if not org_role:
        return False

    # Workspace-wide lecture is visible to all workspace members.
    if not group_id:
        return True

    # Org owner/admin can always access team lectures.
    if org_role in ["owner", "admin"]:
        return True

    # Members need explicit team membership for team-scoped lectures.
    group_role = await GroupService.get_group_role(group_id, user_id)
    return bool(group_role)


async def _get_lecture_data(lecture_id: str, user_id: str) -> dict:
    """Get full lecture data, verify access."""
    supabase = get_supabase()
    result = (
        supabase.table("lectures")
        .select("*")
        .eq("id", lecture_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    
    lecture = result.data[0]
    can_access = await _can_access_lecture(lecture, user_id)
    if not can_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    return lecture


def _strip_markdown(text: str) -> str:
    """Remove markdown formatting for plain text."""
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^-\s+', '• ', text, flags=re.MULTILINE)
    return text


def _build_markdown(lecture: dict, include_transcript: bool, include_summary: bool) -> str:
    """Build markdown content from lecture data."""
    lines = []
    lines.append(f"# {lecture['title']}")
    lines.append(f"\n*Date: {lecture.get('created_at', 'N/A')}*\n")

    if include_summary and lecture.get("summary_text"):
        lines.append("---\n")
        lines.append("## Summary\n")
        lines.append(lecture["summary_text"])
        lines.append("")

    if include_transcript and lecture.get("transcript_text"):
        lines.append("---\n")
        lines.append("## Full Transcript\n")
        lines.append(lecture["transcript_text"])
        lines.append("")

    return "\n".join(lines)


class LecturePDF(FPDF):
    """Custom PDF with header/footer."""

    def __init__(self, title: str = "Lecture"):
        super().__init__()
        self.lecture_title = title

    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"KnowledgeFlow | {self.lecture_title}", align="L")
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def add_section_title(self, title: str):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(50, 50, 120)
        self.ln(6)
        self.cell(0, 10, title)
        self.ln(10)
        self.set_draw_color(50, 50, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def add_body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        clean = _strip_markdown(text)
        for line in clean.split("\n"):
            line = line.strip()
            if not line:
                self.ln(3)
                continue
            self.multi_cell(0, 5.5, line)
            self.ln(1)


@router.post("/pdf")
async def export_pdf(req: ExportRequest, current_user: dict = Depends(get_current_user)):
    """Export lecture as formatted PDF."""
    lecture = await _get_lecture_data(req.lecture_id, current_user["user_id"])

    pdf = LecturePDF(title=lecture["title"])
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(30, 30, 80)
    pdf.multi_cell(0, 12, lecture["title"])
    pdf.ln(2)

    # Date
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, f"Date: {lecture.get('created_at', 'N/A')}")
    pdf.ln(10)

    # Summary
    if req.include_summary and lecture.get("summary_text"):
        pdf.add_section_title("Summary")
        pdf.add_body_text(lecture["summary_text"])

    # Transcript
    if req.include_transcript and lecture.get("transcript_text"):
        pdf.add_section_title("Full Transcript")
        pdf.add_body_text(lecture["transcript_text"])

    buffer = io.BytesIO()
    pdf.output(buffer)
    buffer.seek(0)

    filename = f"{lecture['title'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/markdown")
async def export_markdown(req: ExportRequest, current_user: dict = Depends(get_current_user)):
    """Export lecture as Markdown."""
    lecture = await _get_lecture_data(req.lecture_id, current_user["user_id"])
    content = _build_markdown(lecture, req.include_transcript, req.include_summary)

    buffer = io.BytesIO(content.encode("utf-8"))
    filename = f"{lecture['title'].replace(' ', '_')}.md"

    return StreamingResponse(
        buffer,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/txt")
async def export_txt(req: ExportRequest, current_user: dict = Depends(get_current_user)):
    """Export lecture as plain text."""
    lecture = await _get_lecture_data(req.lecture_id, current_user["user_id"])

    lines = []
    lines.append(f"{'=' * 60}")
    lines.append(f"  {lecture['title']}")
    lines.append(f"  Date: {lecture.get('created_at', 'N/A')}")
    lines.append(f"{'=' * 60}\n")

    if req.include_summary and lecture.get("summary_text"):
        lines.append("SUMMARY")
        lines.append("-" * 40)
        lines.append(_strip_markdown(lecture["summary_text"]))
        lines.append("")

    if req.include_transcript and lecture.get("transcript_text"):
        lines.append("FULL TRANSCRIPT")
        lines.append("-" * 40)
        lines.append(lecture["transcript_text"])
        lines.append("")

    content = "\n".join(lines)
    buffer = io.BytesIO(content.encode("utf-8"))
    filename = f"{lecture['title'].replace(' ', '_')}.txt"

    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/json")
async def export_json(req: ExportRequest, current_user: dict = Depends(get_current_user)):
    """Export lecture data as JSON."""
    lecture = await _get_lecture_data(req.lecture_id, current_user["user_id"])

    export_data = {
        "title": lecture["title"],
        "created_at": lecture.get("created_at"),
        "status": lecture.get("status"),
    }
    if req.include_transcript:
        export_data["transcript"] = lecture.get("transcript_text", "")
    if req.include_summary:
        export_data["summary"] = lecture.get("summary_text", "")

    content = json.dumps(export_data, indent=2, ensure_ascii=False)
    buffer = io.BytesIO(content.encode("utf-8"))
    filename = f"{lecture['title'].replace(' ', '_')}.json"

    return StreamingResponse(
        buffer,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
