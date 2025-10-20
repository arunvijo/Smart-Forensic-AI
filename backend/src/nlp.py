from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# =========================
# Config / Constants
# =========================
# !!! For prod, set this in environment (Render/locally) and DO NOT hardcode !!!
MISTRAL_API_KEY = "vHeNjpH8Bq9h6WOp1QIkOKoACs1WB9Qu"  # set on Render dashboard
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-tiny-latest"  # Switched from small to tiny for better availability


# The conversational order of parts we want to collect
PART_ORDER = ["face", "eyes", "nose", "mouth", "ears", "hair"]

# Minimal required fields per part (keep it simple; you can expand anytime)
REQUIRED_FIELDS = {
    "face": ["shape"],          # e.g., round / oval / long / heart / square
    "eyes": ["shape", "color"], # e.g., almond/round/hooded; brown/blue/black
    "nose": ["type"],           # e.g., straight/hooked/broad/narrow
    "mouth": ["type"],          # e.g., thin/full/bowed; you can split later
    "ears": ["type"],           # e.g., protruding/average/attached lobes
    "hair": ["style", "color"], # e.g., short/long/curly/straight; black/brown
}

# In-memory session store (OK for one-process dev; use Redis for production scale)
SESSIONS = {}  # sessionId -> {"stage_index": int, "collected": dict, "created_at": str}

# =========================
# LLM Prompts
# =========================
# Gatekeeper now extracts across *all categories*, not just "is_feature".
# It must ALWAYS return strict JSON so we can trust it.
LLM_SYSTEM_PROMPT = (
    "You are a careful information extractor for a forensic sketch assistant. "
    "User messages may be casual and out of order. Extract any facial attributes you can find "
    "and file them under these categories: face, eyes, nose, mouth, ears, hair.\n\n"
    "ALWAYS return ONLY a JSON object with this schema:\n"
    "{\n"
    '  \"extracted\": {\n'
    '    \"face\": {\"shape\": \"string|null\", \"extra\": \"string|null\"},\n'
    '    \"eyes\": {\"shape\": \"string|null\", \"color\": \"string|null\", \"extra\": \"string|null\"},\n'
    '    \"nose\": {\"type\": \"string|null\", \"extra\": \"string|null\"},\n'
    '    \"mouth\": {\"type\": \"string|null\", \"extra\": \"string|null\"},\n'
    '    \"ears\": {\"type\": \"string|null\", \"extra\": \"string|null\"},\n'
    '    \"hair\": {\"style\": \"string|null\", \"color\": \"string|null\", \"extra\": \"string|null\"}\n'
    "  },\n"
    '  \"small_talk_reply\": \"string\",   // a natural short reply acknowledging the user\n'
    '  \"confidence\": 0.0                 // 0 to 1 overall extraction confidence\n'
    "}\n\n"
    "Rules:\n"
    "- If nothing is mentioned for a field, put null.\n"
    "- Be concise. Do not infer wildly; prefer null over guessing.\n"
    "- The 'small_talk_reply' should sound friendly and confirm what you understood.\n"
)

# Next-question helper prompt (when we need to ask user something specific)
# We'll synthesize this ourselves from REQUIRED_FIELDS and what's missing, but we keep LLM free.
NEXT_QUESTION_TEMPLATES = {
    "face":  "Could you describe the overall face shape? For example: round, oval, long, heart, or square.",
    "eyes":  "How do the eyes look? You can mention a shape (almond/round/hooded) and color (brown/black/blue/green).",
    "nose":  "How would you describe the nose? For example: straight, hooked, broad, narrow.",
    "mouth": "How would you describe the mouth or lips? For example: thin, full, bowed.",
    "ears":  "Anything notable about the ears? For example: protruding, average, attached lobes.",
    "hair":  "Please describe hair style and color. For example: short/long/curly/straight and black/brown/blonde.",
}

# =========================
# Utilities
# =========================

def get_or_create_session(session_id: str):
    if not session_id:
        session_id = "default"  # fallback for dev
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "stage_index": 0,
            "collected": {p: {} for p in PART_ORDER},
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
    return session_id, SESSIONS[session_id]

def current_part(session):
    return PART_ORDER[session["stage_index"]]

def part_complete(part_name: str, data: dict):
    needed = REQUIRED_FIELDS.get(part_name, [])
    # A part is complete if all required fields exist and are non-empty
    return all((field in data and data[field]) for field in needed)

def advance_if_ready(session):
    # If current part is complete, move to the next
    while session["stage_index"] < len(PART_ORDER):
        p = current_part(session)
        if part_complete(p, session["collected"].get(p, {})):
            session["stage_index"] += 1
        else:
            break

def summarize_collected(session):
    """Simple human-readable summary for debugging/UX if needed."""
    lines = []
    for p in PART_ORDER:
        vals = session["collected"].get(p, {})
        flat = ", ".join(f"{k}: {v}" for k, v in vals.items() if v)
        lines.append(f"{p}: {flat if flat else '(pending)'}")
    return " | ".join(lines)

def merge_extraction(session, extracted: dict):
    """Merge LLM extracted fields into session store, without overwriting filled fields with null."""
    collected = session["collected"]
    for part, fields in (extracted or {}).items():
        if part not in collected:
            continue
        if not isinstance(fields, dict):
            continue
        # store only non-null values
        for key, val in fields.items():
            if val not in (None, "", "null"):
                collected[part][key] = val

def next_missing_prompt(session):
    if session["stage_index"] >= len(PART_ORDER):
        return None  # everything done
    p = current_part(session)
    # check what is missing to tailor the prompt
    missing = [f for f in REQUIRED_FIELDS[p] if not session["collected"][p].get(f)]
    base = NEXT_QUESTION_TEMPLATES[p]
    if missing:
        # Emphasize the first missing field to keep it simple for laypersons
        return base
    return base

def call_mistral_extractor(conversation, latest_text):
    """
    Calls Mistral to *extract* attributes (not to decide feature vs not).
    Returns dict with keys: extracted, small_talk_reply, confidence
    """
    # Build a compact history string (optional; we mainly need latest_text)
    hist_lines = []
    for msg in (conversation or []):
        sender = msg.get("sender", "")
        text = msg.get("text", "")
        # keep it short to save tokens
        hist_lines.append(f"{sender}: {text}")
    history_block = "Conversation so far:\n" + "\n".join(hist_lines[-10:])  # last 10 lines max

    user_block = f"\n\nNew message:\nuser: {latest_text}"

    messages = [
        {"role": "system", "content": LLM_SYSTEM_PROMPT},
        {"role": "user", "content": history_block + user_block}
    ]

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MISTRAL_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 512,
    }

    resp = requests.post(MISTRAL_CHAT_URL, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Mistral API error: {resp.status_code} {resp.text}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]  # should be JSON
    try:
        parsed = json.loads(content)
    except Exception:
        # Try to recover JSON
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            parsed = json.loads(content[start:end+1])
        else:
            # fallback empty extraction
            parsed = {
                "extracted": {k: {} for k in PART_ORDER},
                "small_talk_reply": "Okay.",
                "confidence": 0.0,
            }

    # ensure required keys exist
    parsed.setdefault("extracted", {k: {} for k in PART_ORDER})
    parsed.setdefault("small_talk_reply", "Okay.")
    parsed.setdefault("confidence", 0.0)
    return parsed

def generate_feature_vector(description: str):
    """ Demo numeric vector (placeholder) """
    if not description:
        return []
    base = [0.1, 0.5, -0.2]
    tail = [b / 255.0 for b in os.urandom(16)]
    return base + tail

# =========================
# Existing endpoints (kept)
# =========================
@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "No audio file in request"}), 400

    audio_file = request.files['audio']
    print(f"\n🎤 Received audio file: {audio_file.filename}")

    # Simulated Whisper
    transcribed_text = "The subject had a long, narrow face with a prominent chin."
    print(f"✅ Simulated Transcription: '{transcribed_text}'\n")

    return jsonify({"status": "success", "transcription": transcribed_text})

@app.route("/generate-vector", methods=["POST"])
def generate_vector():
    data = request.get_json(silent=True) or {}
    description = data.get("description")
    if not description:
        return jsonify({"status": "error", "message": "No description provided"}), 400
    print(f"\n⚡ Vectorization request: '{description}'")
    vec = generate_feature_vector(description)
    print(f"✅ Feature Vector (len={len(vec)}), first5={vec[:5]}\n")
    return jsonify({"status": "success", "message": f"Vector for: {description}", "feature_vector": vec})

# =========================
# Session helpers (optional)
# =========================
@app.route("/session/reset", methods=["POST"])
def reset_session():
    data = request.get_json(silent=True) or {}
    session_id = data.get("sessionId") or "default"
    if session_id in SESSIONS:
        del SESSIONS[session_id]
    return jsonify({"status": "success", "message": f"Session {session_id} reset."})

# =========================
# NEW: Conversational webhook
# =========================
@app.route("/mistral-chat", methods=["POST"])
def mistral_chat():
    """
    Conversational collector:
    - Accepts JSON ({message, conversation, sessionId}) or multipart with audio.
    - Extracts any mentioned attributes (even out-of-turn) and stores them under the correct part.
    - Prompts the user for the NEXT missing detail in fixed order: face -> eyes -> nose -> mouth -> ears -> hair.
    - Optionally generates per-part vectors once a part becomes complete (placeholder).
    - Returns {sender:'bot', text: '<next question or final summary>'}.
    """

    # Determine input type
    content_type = (request.headers.get("Content-Type") or "").lower()
    is_multipart = "multipart/form-data" in content_type

    conversation = []
    latest_text = ""
    session_id = None

    if is_multipart and "audio" in request.files:
        # Audio path
        session_id = request.form.get("sessionId") or "default"
        # Simulated transcription (you can call /transcribe here if you want strict reuse)
        latest_text = "The subject had a long, narrow face with a prominent chin."
        print(f"📝 Using transcribed text as latest message: {latest_text}")
    else:
        # JSON path
        data = request.get_json(silent=True) or {}
        latest_text = (data.get("message") or "").strip()
        conversation = data.get("conversation", []) or []
        session_id = data.get("sessionId") or "default"
        # Accept pre-transcribed text if provided
        if not latest_text and isinstance(data.get("body"), dict):
            latest_text = (data["body"].get("transcription") or "").strip()

    if not latest_text:
        return jsonify({"sender": "bot", "text": "I didn’t receive any text to process."}), 400

    # Load or create session state
    session_id, session = get_or_create_session(session_id)

    # 1) Extract attributes from this message
    try:
        llm_out = call_mistral_extractor(conversation, latest_text)
    except Exception as e:
        print("LLM error:", e)
        return jsonify({"sender": "bot", "text": "I'm having some trouble connecting."}), 502

    extracted = llm_out.get("extracted", {})
    small_talk = llm_out.get("small_talk_reply", "Okay.")
    merge_extraction(session, extracted)

    # 2) Decide if current part just got completed; if yes, optionally vectorize that part
    before_stage = session["stage_index"]
    advance_if_ready(session)
    after_stage = session["stage_index"]

    if after_stage > before_stage:
        # One or more parts just completed; you can vectorize the last completed part
        last_completed_index = min(after_stage - 1, len(PART_ORDER) - 1)
        last_part = PART_ORDER[last_completed_index]
        # Compose a concise description string from collected fields for that part
        desc_items = []
        for k in REQUIRED_FIELDS[last_part]:
            v = session["collected"][last_part].get(k)
            if v:
                desc_items.append(f"{k}: {v}")
        extra = session["collected"][last_part].get("extra")
        if extra:
            desc_items.append(f"extra: {extra}")
        desc_text = f"{last_part}: " + ", ".join(desc_items) if desc_items else last_part

        try:
            _ = generate_feature_vector(desc_text)  # Not returned to UI; used to trigger downstream later
            print(f"🧬 Vectorized [{last_part}] -> {desc_text}")
        except Exception as e:
            print("Vectorization error:", e)

    # 3) If everything collected, give a short final confirmation
    if session["stage_index"] >= len(PART_ORDER):
        summary = summarize_collected(session)
        final_reply = (
            f"{small_talk} Thanks! I’ve captured all key attributes. "
            f"Summary → {summary}. You can refine any part (e.g., 'make nose narrower')."
        )
        return jsonify({"sender": "bot", "text": final_reply})

    # 4) Otherwise, ask the next best question (keep it simple and clear)
    prompt = next_missing_prompt(session)
    # Prepend the small-talk acknowledgement to keep it friendly
    reply = f"{small_talk} {prompt}"
    return jsonify({"sender": "bot", "text": reply})

# =========================
# Run
# =========================
if __name__ == "__main__":
    # For local dev
    app.run(debug=True, port=5000)
