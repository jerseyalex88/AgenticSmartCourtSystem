# File: GlobalAcademy-AiEngine/app/services/voice_agent_service.py
import os
from faster_whisper import WhisperModel

class VoiceAgentService:
    # Initialize the ultra-lightweight, high-speed whisper-tiny model parameters
    # 'cpu' compute ensures compatibility inside your standard local development pool
    print("⏳ [WHISPER ENGINE WARMUP]: Initializing Faster-Whisper tiny neural weights...")
    _model_instance = WhisperModel("tiny", device="cpu", compute_type="float32")
    print("🚀 [WHISPER ENGINE ONLINE]: Speech-to-text inference channels fully responsive.")

    @classmethod
    def transcribe_audio_file(cls, audio_file_path: str) -> str:
        """
        Ingests a temporary raw audio binary file chunk clip, runs local Faster-Whisper 
        speech recognition, and aggregates the segment tokens into a single clean string statement.
        """
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Target transcription audio chunk file not resolved at: {audio_file_path}")

        try:
            # Execute high-speed local inference
            # beam_size=1 enforces rapid, non-greedy token selection to minimize processing latency
            segments, info = cls._model_instance.transcribe(audio_file_path, beam_size=1)
            
            # Combine the parsed audio segment chunks into a single sentence string
            transcribed_text_fragments = [segment.text for segment in segments]
            compiled_statement = " ".join(transcribed_text_fragments).strip()
            
            print(f"📟 [WHISPER INFERENCE DETECTED] Lang: {info.language} (Confidence: {info.language_probability:.2f})")
            print(f"   👉 Text Output: \"{compiled_statement}\"")
            
            return compiled_statement
            
        except Exception as ex:
            print(f"❌ [WHISPER INFERENCE FAULT]: Failed to transcribe audio binary stream: {ex}")
            raise ex
