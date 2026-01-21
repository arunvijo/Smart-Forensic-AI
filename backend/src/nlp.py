from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import json
import requests
from datetime import datetime

# --- FIX: Add strict path handling ---
# Get the absolute path of the directory containing this script (src/)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Add it to Python's system path so it can find 'models'
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Try importing again with the new path
try:
    from models.eye_generator import EyeGenerator
except ImportError as e:
    print(f"\n❌ CRITICAL ERROR: Could not import 'EyeGenerator'.")
    print(f"Python is looking in: {current_dir}")
    print("Please ensure your file structure is exactly:")
    print("  backend/")
    print("  └── src/")
    print("      ├── nlp.py")
    print("      └── models/")
    print("          └── eye_generator.py\n")
    raise e

app = Flask(__name__)
CORS(app)
# ... (Rest of your code remains the same)
# =========================
# Config / Constants
# =========================
# Mistral is currently disabled/dummy, but we keep config structure
MISTRAL_API_KEY = "DUMMY_KEY" 
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-tiny-latest"

# --- INITIALIZE GENERATOR ---
# Path logic: assumes .pth file is in the root of 'backend' folder
CHECKPOINT_PATH = os.path.join(os.getcwd(), "forensic_eye_checkpoint.pth")
print(f"🔄 Initializing Eye Generator from: {CHECKPOINT_PATH}")
eye_gen = EyeGenerator(CHECKPOINT_PATH)

# The conversational order of parts we want to collect
PART_ORDER = ["face", "eyes", "nose", "mouth", "ears", "hair"]

# Minimal required fields per part
REQUIRED_FIELDS = {
    "face": ["shape"],          
    "eyes": ["shape", "color"], 
    "nose": ["type"],           
    "mouth": ["type"],          
    "ears": ["type"],           
    "hair": ["style", "color"], 
}

# In-memory session store
SESSIONS = {} 

# Next-question helper prompts
NEXT_QUESTION_TEMPLATES = {
    "face":  "Could you describe the overall face shape? (e.g., round, oval, square)",
    "eyes":  "How do the eyes look? Mention shape (almond/round) or details like 'bushy', 'bags', or 'narrow'.",
    "nose":  "How would you describe the nose? (e.g., straight, hooked, broad)",
    "mouth": "How would you describe the mouth? (e.g., thin, full, bowed)",
    "ears":  "Anything notable about the ears? (e.g., attached lobes)",
    "hair":  "Describe the hair style and color.",
}

# =========================
# Utilities
# =========================

def get_or_create_session(session_id: str):
    if not session_id:
        session_id = "default"
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "stage_index": 0,
            "collected": {p: {} for p in PART_ORDER},
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
    return session_id, SESSIONS[session_id]

def current_part(session):
    if session["stage_index"] >= len(PART_ORDER):
        return "complete"
    return PART_ORDER[session["stage_index"]]

def part_complete(part_name: str, data: dict):
    needed = REQUIRED_FIELDS.get(part_name, [])
    # A part is complete if all required fields exist and are non-empty
    return all((field in data and data[field]) for field in needed)

def advance_if_ready(session):
    while session["stage_index"] < len(PART_ORDER):
        p = current_part(session)
        if part_complete(p, session["collected"].get(p, {})):
            session["stage_index"] += 1
        else:
            break

def summarize_collected(session):
    lines = []
    for p in PART_ORDER:
        vals = session["collected"].get(p, {})
        flat = ", ".join(f"{k}: {v}" for k, v in vals.items() if v)
        lines.append(f"{p}: {flat if flat else '(pending)'}")
    return " | ".join(lines)

def merge_extraction(session, extracted: dict):
    collected = session["collected"]
    for part, fields in (extracted or {}).items():
        if part not in collected:
            continue
        if not isinstance(fields, dict):
            continue
        for key, val in fields.items():
            if val not in (None, "", "null"):
                collected[part][key] = val

def next_missing_prompt(session):
    if session["stage_index"] >= len(PART_ORDER):
        return None
    p = current_part(session)
    missing = [f for f in REQUIRED_FIELDS[p] if not session["collected"][p].get(f)]
    base = NEXT_QUESTION_TEMPLATES[p]
    if missing:
        return base
    return base

# =========================
# MOCK LLM (Rule-Based for Testing)
# =========================
def mock_llm_extractor(conversation, latest_text):
    """
    Replaces Mistral API. extract attributes using simple keyword matching
    so you can test the integration flow immediately.
    """
    text = latest_text.lower()
    extracted = {k: {} for k in PART_ORDER}
    
    # --- 1. FACE LOGIC ---
    if any(w in text for w in ["round", "oval", "long", "heart", "square"]):
        for w in ["round", "oval", "long", "heart", "square"]:
            if w in text: extracted["face"]["shape"] = w
    
    # --- 2. EYE LOGIC (Includes Generator Keywords) ---
    # Generator Keywords: "arched", "bushy", "narrow", "bags", "spects", "male"
    eye_keywords = ["arched", "bushy", "narrow", "bags", "spects", "glasses", "male"]
    found_eye_extra = []
    for w in eye_keywords:
        if w in text: 
            found_eye_extra.append(w)
    
    if found_eye_extra:
        # Join them so the generator can find them later
        extracted["eyes"]["extra"] = " ".join(found_eye_extra)

    # Standard Eye fields
    for c in ["blue", "brown", "green", "hazel", "black", "dark"]:
        if c in text: extracted["eyes"]["color"] = c
    for s in ["almond", "hooded", "monolid", "round"]:
        if s in text: extracted["eyes"]["shape"] = s

    # --- 3. NOSE LOGIC ---
    for t in ["straight", "hooked", "broad", "narrow", "button"]:
        if t in text and "face" not in text: # avoid confusion with face shape
            extracted["nose"]["type"] = t

    # --- 4. MOUTH LOGIC ---
    for t in ["thin", "full", "bowed", "wide"]:
        if t in text: extracted["mouth"]["type"] = t

    # --- 5. EARS LOGIC ---
    for t in ["protruding", "attached", "small", "large"]:
        if t in text: extracted["ears"]["type"] = t

    # --- 6. HAIR LOGIC ---
    for s in ["short", "long", "curly", "straight", "bald"]:
        if s in text: extracted["hair"]["style"] = s
    for c in ["black", "brown", "blonde", "red", "white", "grey"]:
        if c in text: extracted["hair"]["color"] = c

    # Fallback confidence
    return {
        "extracted": extracted,
        "small_talk_reply": "Got it.",
        "confidence": 1.0
    }

# =========================
# ENDPOINTS
# =========================
@app.route("/mistral-chat", methods=["POST"])
def mistral_chat():
    """
    Main Logic Flow:
    1. Receive Text
    2. Extract Attributes (Mock LLM)
    3. Update Session
    4. INTEGATION: If 'eyes' data is present, Generate Image
    5. Advance Stage
    6. Return Response
    """
    
    # --- Parse Input ---
    data = request.get_json(silent=True) or {}
    latest_text = (data.get("message") or "").strip()
    conversation = data.get("conversation", []) or []
    session_id = data.get("sessionId") or "default"

    if not latest_text:
        return jsonify({"sender": "bot", "text": "I didn’t receive any text."}), 400

    # --- Load Session ---
    session_id, session = get_or_create_session(session_id)

    # --- Step 1: Extract Attributes (Using Mock now) ---
    try:
        # Using Mock instead of Mistral for stability/testing
        llm_out = mock_llm_extractor(conversation, latest_text)
    except Exception as e:
        print("Extractor error:", e)
        return jsonify({"sender": "bot", "text": "Error processing attributes."}), 502

    extracted = llm_out.get("extracted", {})
    small_talk = llm_out.get("small_talk_reply", "Okay.")
    merge_extraction(session, extracted)

    # --- Step 2: INTEGRATION & GENERATION LOGIC ---
    generated_image_payload = None
    
    # Check if we have eye data in the session
    eye_data = session["collected"].get("eyes", {})
    
    # Trigger generation if we have ANY data for eyes (shape, color, or extra keywords)
    # logic: checks if any value in the eye_data dict is truthy
    has_eye_info = any(v for v in eye_data.values() if v)
    
    if has_eye_info:
        print(f"👀 Attempting generation for eyes with data: {eye_data}")
        try:
            # Generate Base64 Image
            img_b64 = eye_gen.generate(eye_data)
            if img_b64:
                generated_image_payload = {
                    "category": "eyes",
                    "image": img_b64
                }
        except Exception as e:
            print(f"❌ Generation failed: {e}")

    # --- Step 3: Advance Conversation Stage ---
    advance_if_ready(session)
    
    # --- Step 4: Construct Response ---
    prompt = next_missing_prompt(session)
    
    if not prompt:
        summary = summarize_collected(session)
        final_reply = f"{small_talk} I have collected all attributes. Summary: {summary}"
        resp_data = {"sender": "bot", "text": final_reply}
    else:
        resp_data = {"sender": "bot", "text": f"{small_talk} {prompt}"}

    # Attach the image if we generated one
    if generated_image_payload:
        resp_data["generated_image"] = generated_image_payload

    return jsonify(resp_data)

# =========================
# Run
# =========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)