# File: GlobalAcademy-AiEngine/app/services/v2_text_to_speech_service.py
import edge_tts
from typing import AsyncGenerator

class v2TextToSpeechService:
    # 🚀 CHANGED: Swapped from en-US-AriaNeural (Female) to en-US-GuyNeural (Male)
    # en-US-BrianNeural (USA - Standard Male)
    # en-US-AndrewNeural (USA - Warm/Conversational Male)
    # en-GB-RyanNeural (United Kingdom - British Male)
    # en-AU-WilliamNeural (Australia - Australian Male)
    _VOICE_CHARACTER = "ja-JP-KeitaNeural"

    @classmethod
    async def stream_text_to_memory_chunks(cls, text_content: str, voice_character: str) -> AsyncGenerator[bytes, None]:
        """
        Asynchronously streams neural text conversion blocks directly from system RAM.
        Bypasses disk read/write constraints entirely to maximize system throughput.
        """
        try:
            #communicate = edge_tts.Communicate(text_content, cls._VOICE_CHARACTER)
            # 🚀 DYNAMIC VOICE CHARACTER ROUTING: Swapped static class reference out for method variable argument
            communicate = edge_tts.Communicate(text_content, voice_character)
            
            # 🚀 REPLACED: .save() replaced with native memory stream loops
            async for chunk in communicate.stream():
                # Extract the raw binary fragment block
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        except Exception as ex:
            print(f"❌ [v2 TTS PIPELINE FAULT]: Memory streaming translation broke: {ex}")
            yield b""
