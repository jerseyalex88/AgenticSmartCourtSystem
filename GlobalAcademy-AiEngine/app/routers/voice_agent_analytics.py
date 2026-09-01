# File: GlobalAcademy-AiEngine/app/routers/voice_agent_analytics.py
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.services.voice_agent_service import VoiceAgentService

router = APIRouter(prefix="/api/ai/voice", tags=["Voice Recognition Agent Front-Doors"])

@router.post("/transcribe-query", status_code=status.HTTP_200_OK)
async def transcribe_player_query(audio_file: UploadFile = File(...)):
    """
    Accepts raw multi-form audio bytes streamed over the internal loopback, 
    and returns a clean JSON response containing the plain text transcript string.
    """
    print("\n" + "="*80)
    print(f"📡 [PYTHON VOICE AGENT HANDSHAKE]: Processing payload chunk file: {audio_file.filename}")
    print("="*80)

    # Establish an isolated scratch space path for audio processing
    scratch_workspace_dir = "/tmp/globalacademy_voice_scratch"
    os.makedirs(scratch_workspace_dir, exist_ok=True)
    
    temporary_audio_target_path = os.path.join(scratch_workspace_dir, f"query_{audio_file.filename}")

    try:
        # Buffer the incoming audio binary chunk down to scratch disk
        with open(temporary_audio_target_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)
            
        # Fire local Faster-Whisper speech-to-text inference
        extracted_query_text = VoiceAgentService.transcribe_audio_file(temporary_audio_target_path)
        
        return {
            "status": "SUCCESS",
            "extracted_text": extracted_query_text
        }
        
    except Exception as err:
        print(f"❌ [VOICE INGESTION ENDPOINT FAULT]: Ingest pipeline failed: {err}")
        raise HTTPException(status_code=500, detail=f"Speech processing internal translation crash: {err}")
        
    finally:
        # Secure cleanup: Wipe the temporary scratch file row from disk to protect player audio privacy
        if os.path.exists(temporary_audio_target_path):
            try: os.remove(temporary_audio_target_path)
            except OSError: pass
        print("="*80 + "\n")
