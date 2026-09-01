# File: GlobalAcademy-AiEngine/app/services/text_to_speech_service.py
import os
import base64
import edge_tts

class TextToSpeechService:
    # High-fidelity, natural neural voice configurations
    _VOICE_CHARACTER = "en-US-AriaNeural"

    @classmethod
    async def synthesize_text_to_base64(cls, text_content: str) -> str:
        """
        Asynchronously synthesizes plain text strings into a high-fidelity neural MP3 stream,
        converting the file output into a clean Base64 string in memory.
        """
        if not text_content.strip():
            return ""

        # Establish an isolated workspace directory scratch file
        scratch_dir = "/tmp/globalacademy_tts_scratch"
        os.makedirs(scratch_dir, exist_ok=True)
        temporary_mp3_path = os.path.join(scratch_dir, f"speech_{os.urandom(4).hex()}.mp3")

        try:
            # 🎯 INITIALIZE HIGH-SPEED NEURAL SYNTHESIS ENGINE
            communicate = edge_tts.Communicate(text_content, cls._VOICE_CHARACTER)
            await communicate.save(temporary_mp3_path)

            # Read the synthesized binary byte content from disk
            with open(temporary_mp3_path, "rb") as audio_file:
                binary_bytes = audio_file.read()
                # Encode straight into a clean base64 string block
                base64_encoded_audio = base64.b64encode(binary_bytes).decode("utf-8")

            print(f"🔊 [TTS SYNTHESIS SUCCESS]: Compiled {len(text_content)} text characters into Base64 audio stream.")
            return base64_encoded_audio

        except Exception as ex:
            print(f"❌ [TTS MODULE FAULT]: Failed to synthesize text parameters: {ex}")
            return ""

        finally:
            # Clean up the file to maintain disk sanity
            if os.path.exists(temporary_mp3_path):
                try: os.remove(temporary_mp3_path)
                except OSError: pass
