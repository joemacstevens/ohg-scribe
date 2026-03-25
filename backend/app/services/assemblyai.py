import httpx
from app.config import get_settings

settings = get_settings()

ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2"


def _headers():
    return {"Authorization": settings.assemblyai_api_key}


async def submit_transcription(audio_url: str, options: dict) -> str:
    """Submit a transcription job to AssemblyAI. Returns transcript ID."""
    payload = {
        "audio_url": audio_url,
        "speaker_labels": True,
        **_build_options(options),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{ASSEMBLYAI_BASE}/transcript",
            headers=_headers(),
            json=payload,
        )
        r.raise_for_status()
        return r.json()["id"]


async def poll_transcription(transcript_id: str) -> dict:
    """Poll AssemblyAI for transcription status. Returns full response dict."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{ASSEMBLYAI_BASE}/transcript/{transcript_id}",
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


async def identify_speakers(transcript_id: str, context: str, final_model: str) -> str:
    """Use LeMUR to identify speakers in a transcript."""
    payload = {
        "transcript_ids": [transcript_id],
        "context": context,
        "final_model": final_model,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.assemblyai.com/lemur/v3/apply-task",
            headers=_headers(),
            json=payload,
        )
        r.raise_for_status()
        return r.json().get("response", "")


def _build_options(options: dict) -> dict:
    """Map frontend options dict to AssemblyAI request fields."""
    payload = {}

    max_speakers = options.get("max_speakers")
    if max_speakers:
        payload["speakers_expected"] = max_speakers

    boost_words = options.get("boost_words", [])
    if boost_words:
        payload["word_boost"] = boost_words[:200]

    if options.get("include_summary"):
        payload["summarization"] = True
        payload["summary_model"] = "informative"
        payload["summary_type"] = "bullets"

    if options.get("detect_topics"):
        payload["iab_categories"] = True

    if options.get("analyze_sentiment"):
        payload["sentiment_analysis"] = True

    if options.get("extract_key_phrases"):
        payload["auto_highlights"] = True

    # Speaker identification modes
    mode = options.get("speaker_label_mode", "generic")
    values = options.get("speaker_values", [])
    speech_understanding = _build_speech_understanding(mode, values)
    if speech_understanding:
        payload["speech_understanding"] = speech_understanding

    return payload


def _build_speech_understanding(mode: str, values: list) -> dict | None:
    mode_map = {
        "auto-names": {"speaker_type": "name", "known_values": []},
        "known-names": {"speaker_type": "name", "known_values": values},
        "interview": {"speaker_type": "role", "known_values": ["Interviewer", "Interviewee"]},
        "podcast": {"speaker_type": "role", "known_values": ["Host", "Guest"]},
        "panel": {"speaker_type": "role", "known_values": ["Moderator", "Panelist"]},
        "custom-roles": {"speaker_type": "role", "known_values": values},
    }
    if mode not in mode_map:
        return None
    cfg = mode_map[mode]
    return {"request": {"speaker_identification": cfg}}
