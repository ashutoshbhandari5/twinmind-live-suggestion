import json

from fastapi import APIRouter

from app.models.schemas import ExportRequest, ExportResponse

router = APIRouter()


@router.post("/export", response_model=ExportResponse, response_model_by_alias=True)
async def export(body: ExportRequest) -> ExportResponse:
    return ExportResponse(payload=json.dumps(body.model_dump(), indent=2))
