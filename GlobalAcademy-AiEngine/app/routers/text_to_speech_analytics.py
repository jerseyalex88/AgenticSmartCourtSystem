# File: GlobalAcademy-AiEngine/app/routers/text_to_speech_analytics.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.services.text_to_speech_service import TextToSpeechService

# 🎯 THE EXPORT LINK: Explicitly declare 'router' as a clean variable token
router = APIRouter(prefix="/api/ai/tts", tags=["Neural Text-To-Speech Generators"])

class TTSRequestSchema(BaseModel):
    text_to_speak: str

@router.post("/synthesize-string", status_code=status.HTTP_200_OK)
async def synthesize_string_to_speech(payload: TTSRequestSchema):
    """
    Accepts plain text strings via JSON body payload parameters,
    and returns a double-quoted JSON package containing the Base64 audio string.
    """
    try:
        base64_audio_result = await TextToSpeechService.synthesize_text_to_base64(payload.text_to_speak)
        return {
            "status": "SUCCESS",
            "audio_base64": base64_audio_result
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"TTS Engine internal synthesis failure: {err}")
