import logging
import hashlib
from typing import Optional, Dict
from fastapi import APIRouter, Query, HTTPException, status, Response, Body
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/speech", tags=["Neural Speech Engine"])

# High-fidelity Indian Neural Voice Mappings (Male voices prioritized for all languages)
VOICE_MAP: Dict[str, Dict[str, str]] = {
    "te": {
        "female": "te-IN-ShrutiNeural",
        "male": "te-IN-MohanNeural",
        "default": "te-IN-MohanNeural"  # MohanNeural has deep, authoritative Telugu broadcast clarity
    },
    "hi": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
        "default": "hi-IN-MadhurNeural"  # MadhurNeural is a warm, articulate, professional Hindi male voice
    },
    "ta": {
        "female": "ta-IN-PallaviNeural",
        "male": "ta-IN-ValluvarNeural",
        "default": "ta-IN-ValluvarNeural"  # ValluvarNeural is an authoritative, classical Tamil male voice
    },
    "kn": {
        "female": "kn-IN-SapnaNeural",
        "male": "kn-IN-GaganNeural",
        "default": "kn-IN-GaganNeural"  # GaganNeural is a clear, resonant Kannada male voice
    },
    "ml": {
        "female": "ml-IN-SobhanaNeural",
        "male": "ml-IN-MidhunNeural",
        "default": "ml-IN-MidhunNeural"  # MidhunNeural is a fluent, natural Malayalam male voice
    },
    "mr": {
        "female": "mr-IN-AarohiNeural",
        "male": "mr-IN-ManoharNeural",
        "default": "mr-IN-ManoharNeural"  # ManoharNeural is a crisp Marathi male voice
    },
    "gu": {
        "female": "gu-IN-DhwaniNeural",
        "male": "gu-IN-NiranjanNeural",
        "default": "gu-IN-NiranjanNeural"  # NiranjanNeural is an articulate Gujarati male voice
    },
    "bn": {
        "female": "bn-IN-TanishaaNeural",
        "male": "bn-IN-BashkarNeural",
        "default": "bn-IN-BashkarNeural"  # BashkarNeural is a rich, natural Bengali male voice
    },
    "ur": {
        "female": "ur-IN-GulNeural",
        "male": "ur-IN-SalmanNeural",
        "default": "ur-IN-SalmanNeural"  # SalmanNeural is an expressive, elegant Urdu male voice
    },
    "pa": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
        "default": "hi-IN-MadhurNeural"  # MadhurNeural male voice for northern regional fluency
    },
    "or": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
        "default": "hi-IN-MadhurNeural"  # MadhurNeural male voice
    },
    "as": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
        "default": "hi-IN-MadhurNeural"  # MadhurNeural male voice
    },
    "en": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
        "default": "en-IN-PrabhatNeural"  # PrabhatNeural is an authentic, clear Indian English male voice
    }
}

# In-memory LRU audio cache (Max 500 items, ~15MB memory)
AUDIO_CACHE: Dict[str, bytes] = {}
MAX_CACHE_ITEMS = 500

class SpeechSynthesizeRequest(BaseModel):
    text: str
    lang: str = "te"
    gender: Optional[str] = "male"
    rate: Optional[str] = "+10%"
    pitch: Optional[str] = "+0Hz"

def _get_voice_name(lang: str, gender: Optional[str] = "male") -> str:
    primary = (lang or "te").split("-")[0].lower()
    mapping = VOICE_MAP.get(primary, VOICE_MAP["te"])
    # Default to male voice across all languages per farmer accessibility requirements
    g = (gender or "male").lower()
    if g != "female":
        return mapping.get("male", mapping["default"])
    return mapping.get(g, mapping["default"])

async def _synthesize_audio(text: str, voice_name: str, rate: str = "+10%", pitch: str = "+0Hz") -> bytes:
    """Synthesizes broadcast-quality neural voice bytes using edge-tts."""
    cache_key = hashlib.md5(f"{voice_name}:{rate}:{pitch}:{text}".encode("utf-8")).hexdigest()
    if cache_key in AUDIO_CACHE:
        return AUDIO_CACHE[cache_key]

    try:
        import edge_tts
    except ImportError:
        logger.error("[SPEECH ENGINE] edge_tts library not installed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Neural TTS engine library is not available."
        )

    try:
        communicate = edge_tts.Communicate(text=text, voice=voice_name, rate=rate, pitch=pitch)
        chunks = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                chunks.append(chunk.get("data", b""))
        
        audio_bytes = b"".join(chunks)
        if not audio_bytes:
            raise ValueError("Zero audio bytes returned from synthesizer.")

        if len(AUDIO_CACHE) >= MAX_CACHE_ITEMS:
            # Drop oldest 50 items
            keys_to_remove = list(AUDIO_CACHE.keys())[:50]
            for k in keys_to_remove:
                AUDIO_CACHE.pop(k, None)

        AUDIO_CACHE[cache_key] = audio_bytes
        return audio_bytes
    except Exception as e:
        logger.error(f"[SPEECH SYNTHESIS ERROR] Failed synthesizing voice '{voice_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech synthesis error: {str(e)}"
        )

@router.post("/synthesize", summary="Synthesize High-Definition Neural Speech Audio")
async def synthesize_speech_post(payload: SpeechSynthesizeRequest):
    """
    Synthesizes authentic human speech for Telugu, Hindi, Tamil, Kannada, and English.
    Returns standard audio/mpeg bytes playable on any mobile device HTML5 audio player.
    """
    clean_text = (payload.text or "").strip()
    if not clean_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")

    if len(clean_text) > 4000:
        clean_text = clean_text[:4000]

    voice_name = _get_voice_name(payload.lang, payload.gender)
    audio_bytes = await _synthesize_audio(clean_text, voice_name, payload.rate or "+0%", payload.pitch or "+0Hz")

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "public, max-age=86400",
            "X-Voice-Engine": voice_name
        }
    )

@router.get("/synthesize", summary="GET Stream Audio (Convenient for direct audio HTML tags)")
async def synthesize_speech_get(
    text: str = Query(..., description="Text to speak aloud"),
    lang: str = Query("te", description="Language code (te, hi, ta, kn, en, etc.)"),
    gender: Optional[str] = Query("male", description="Voice gender (female/male)"),
    rate: Optional[str] = Query("+10%", description="Speaking rate delta"),
    pitch: Optional[str] = Query("+0Hz", description="Pitch delta")
):
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")

    if len(clean_text) > 4000:
        clean_text = clean_text[:4000]

    voice_name = _get_voice_name(lang, gender)
    audio_bytes = await _synthesize_audio(clean_text, voice_name, rate or "+10%", pitch or "+0Hz")

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "public, max-age=86400",
            "X-Voice-Engine": voice_name
        }
    )

@router.get("/voices", summary="List Available Neural Voices")
async def list_voices():
    """Returns all available regional language neural voices configured for AgriShield."""
    return {
        "status": "online",
        "supported_languages": list(VOICE_MAP.keys()),
        "voice_registry": VOICE_MAP
    }

