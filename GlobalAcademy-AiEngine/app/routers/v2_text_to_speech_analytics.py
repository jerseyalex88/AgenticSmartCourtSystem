# File: GlobalAcademy-AiEngine/app/routers/v2_text_to_speech_analytics.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.v2_text_to_speech_service import v2TextToSpeechService

router = APIRouter(prefix="/api/ai/tts", tags=["v2 Real-Time Multimodal Voice Streaming Engines"])

class v2TTSRequestSchema(BaseModel):
    text_to_speak: str = Field(..., min_length=1, description="Raw plain text to convert into real-time audio streams.")
    voice_key: str = Field(default="en-US-AriaNeural", description="Dynamic Microsoft Azure neural voice identifier string token.")

@router.post("/synthesize-string-stream")
async def synthesize_string_stream(payload: v2TTSRequestSchema):
    """
    Accepts plain text payloads via JSON body parameters and yields a real-time, 
    low-latency native audio stream directly from neural generator memory buffers.
    """
    if not payload.text_to_speak.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Synthesis payload parameters cannot be empty values."
        )
        
    # Pass both parameters directly down to the service stream worker
    audio_chunk_iterator = v2TextToSpeechService.stream_text_to_memory_chunks(
        text_content=payload.text_to_speak,
        voice_character=payload.voice_key
    )

    return StreamingResponse(
        audio_chunk_iterator,
        media_type="audio/mpeg", # Native audio stream; forces immediate local player buffering
        status_code=status.HTTP_200_OK
    )
