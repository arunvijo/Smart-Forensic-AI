from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import requests

app = Flask(__name__)
CORS(app)

# =========================
# Config / Constants
# =========================
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")  # set on Render dashboard
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
# Choose a model you have access to; small is cheap/fast. You can switch to "mistral-large-latest".
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")

# System prompt copied from your n8n LLM Chain (gatekeeper that ALWAYS emits JSON)
LLM_SYSTEM_PROMPT = (
    "You are a specialized AI assistant for generating forensic sketches. "
    "Your primary goal is to determine if the user's message describes a specific facial feature. "
    "You must ALWAYS respond with a JSON object.\n\n"
    "The JSON object should have the following structure:\n"
    "{\n"
    '  "is_feature": boolean,\n'
    '  "feature_description": "string or null",\n'
    '  "reply": "string"\n'
    "}\n\n"
    "- If the user's message is a clear description of a facial feature (like 'he had a large, crooked nose' or 'thin eyebrows'), "
    'set "is_feature" to true, put the extracted description in "feature_description", and create a short confirmation message for "reply".\n'
    "- If the user's message is a greeting, a question, or anything else that is NOT a feature description, "
    'set "is_feature" to false, set "feature_description" to null, and create a helpful, conversational response for "reply".'
)

# =========================
# Utilities
# =========================

def call_mistral_gatekeeper(conversation, latest_text):
    """
    Replicates your n8n LLM Chain: builds a single 'user' prompt with:
    - Conversation History (sender: text per line)
    - Latest Message (user: <text>)

    Expects Mistral to return a SINGLE assistant message whose content is a JSON string.
    """
    # Format the prompt like your n8n HumanMessagePromptTemplate
    hist_lines = []
    for msg in (conversation or []):
        # expect items like {"sender": "user"|"bot", "text": "..."}
        sender = msg.get("sender", "")
        text = msg.get("text", "")
        hist_lines.append(f"{sender}: {text}")
    history_block = "Conversation History:\n" + "\n".join(hist_lines)

    latest_block = f"\n\nLatest Message:\nuser: {latest_text}"

    messages = [
        {"role": "system", "content": LLM_SYSTEM_PROMPT},
        {"role": "user", "content": history_block + latest_block}
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
    content = data["choices"][0]["message"]["content"]  # string
    # MUST be JSON per the prompt; fall back defensively
    try:
        parsed = json.loads(content)
    except Exception:
        # Try to extract JSON substring if the model wrapped it
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            parsed = json.loads(content[start:end+1])
        else:
            # worst case: return a non-feature reply
            parsed = {"is_feature": False, "feature_description": None, "reply": content}

    # Ensure required fields exist
    parsed.setdefault("is_feature", False)
    parsed.setdefault("feature_description", None)
    parsed.setdefault("reply", "Okay.")
    return parsed


def generate_feature_vector(description: str):
    """
    Same spirit as your /generate-vector endpoint (quick demo vector).
    """
    if not description:
        return []
    # Not meaningful math—just a deterministic-ish demo vector
    # You can replace with a real embedder later.
    base = [0.1, 0.5, -0.2]
    tail = [b / 255.0 for b in os.urandom(16)]
    return base + tail


# =========================
# Existing endpoints
# =========================

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    """
    Receives an audio file, transcribes it, and returns the text.
    For demo: returns a fixed line. Swap with Whisper when ready.
    """
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "No audio file in request"}), 400

    audio_file = request.files['audio']
    print(f"\n🎤--- Received audio file: {audio_file.filename} ---🎤")

    # --- SIMULATED TRANSCRIPTION FOR 30% DEMO ---
    transcribed_text = "The subject had a long, narrow face with a prominent chin."
    print(f"✅--- Simulated Transcription: '{transcribed_text}' ---✅\n")

    # (Real Whisper code can go here)
    return jsonify({
        "status": "success",
        "transcription": transcribed_text
    })


@app.route("/generate-vector", methods=["POST"])
def generate_vector():
    data = request.get_json(silent=True) or {}
    description = data.get("description")
    if not description:
        return jsonify({"status": "error", "message": "No description provided"}), 400

    print(f"\n⚡️--- Received description for vectorization: '{description}' ---⚡️")
    simulated_vector = generate_feature_vector(description)
    print(f"✅--- Generated Feature Vector (first 5 elements): {simulated_vector[:5]} ---✅\n")
    return jsonify({
        "status": "success",
        "message": f"Successfully generated vector for: {description}",
        "feature_vector": simulated_vector
    })


# =========================
# NEW: Unified webhook (n8n replacement)
# =========================
@app.route("/mistral-chat", methods=["POST"])
def mistral_chat():
    """
    Unifies your Webhook Trigger + Check Input Type + Transcribe + LLM Chain + Check Feature + Call NLP Service
    """

    # 1) Determine input type (JSON chat vs multipart audio), like your n8n "Check Input Type"
    content_type = request.headers.get("Content-Type", "")
    is_multipart = "multipart/form-data" in content_type

    conversation = []
    latest_text = ""

    if is_multipart and "audio" in request.files:
        # 2a) Audio path -> call our /transcribe (same as n8n's HTTP Request 'Transcribe Audio')
        audio = request.files["audio"]
        # You can call the transcribe function directly; here we reuse the route logic
        # For simplicity, emulate by setting latest_text to the simulated transcript:
        transcribed_text = "The subject had a long, narrow face with a prominent chin."
        latest_text = transcribed_text
        # Allow sessionId passthrough if needed
        _ = request.form.get("sessionId")
        # Conversation not passed in multipart in your frontend; keep empty
        print(f"📝 Using transcribed text as latest message: {latest_text}")

    else:
        # 2b) JSON path -> same schema your frontend sends to n8n
        data = request.get_json(silent=True) or {}
        latest_text = data.get("message", "") or ""
        conversation = data.get("conversation", []) or []
        # Optional: accept transcription result if you later post it here
        if not latest_text and isinstance(data.get("body"), dict):
            latest_text = (data["body"].get("transcription") or "").strip()

    if not latest_text:
        return jsonify({"sender": "bot", "text": "I didn’t receive any text to process."}), 400

    # 3) LLM gatekeeper (your LLM Chain that always returns JSON)
    try:
        gate = call_mistral_gatekeeper(conversation, latest_text)
    except Exception as e:
        print("LLM error:", e)
        return jsonify({"sender": "bot", "text": "I'm having some trouble connecting."}), 502

    is_feature = bool(gate.get("is_feature"))
    feat_desc = gate.get("feature_description")
    reply = gate.get("reply") or "Okay."

    # 4) If feature → generate vector (your 'Call NLP Service' step), then respond
    if is_feature and feat_desc:
        try:
            vec = generate_feature_vector(feat_desc)
            # For now we don’t return the vector to the UI; just mirror n8n behavior
            print(f"🧬 Feature vector generated (len={len(vec)}).")
        except Exception as e:
            print("Vector gen error:", e)
            # Even if vectorization fails, still answer the chat
            pass

    # 5) Respond like your Respond nodes do
    return jsonify({"sender": "bot", "text": reply})


if __name__ == "__main__":
    # On Render, gunicorn will run this module. For local dev:
    app.run(debug=True, port=5000)
