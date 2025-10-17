from flask import Flask, request, jsonify
from flask_cors import CORS
import os
# import whisper # Uncomment for real implementation

app = Flask(__name__)
CORS(app)

# --- WHISPER MODEL LOADING (REAL IMPLEMENTATION) ---
# print("Loading Whisper model...")
# whisper_model = whisper.load_model("base")
# print("Whisper model loaded.")
# ----------------------------------------------------

# --- NEW: /transcribe ENDPOINT ---
@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    """
    Receives an audio file, transcribes it, and returns the text.
    """
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "No audio file in request"}), 400

    audio_file = request.files['audio']
    print(f"\n🎤--- Received audio file: {audio_file.filename} ---🎤")

    # --- SIMULATED TRANSCRIPTION FOR 30% DEMO ---
    transcribed_text = "The subject had a long, narrow face with a prominent chin."
    print(f"✅--- Simulated Transcription: '{transcribed_text}' ---✅\n")
    # ---------------------------------------------

    # --- REAL WHISPER IMPLEMENTATION ---
    # try:
    #     # Save the file temporarily to transcribe it
    #     filepath = os.path.join("/tmp", audio_file.filename)
    #     audio_file.save(filepath)
    #     result = whisper_model.transcribe(filepath)
    #     transcribed_text = result['text']
    #     os.remove(filepath) # Clean up the file
    #     print(f"✅--- Transcribed Text: '{transcribed_text}' ---✅\n")
    # except Exception as e:
    #     print(f"Error during transcription: {e}")
    #     return jsonify({"status": "error", "message": "Failed to transcribe audio"}), 500
    # -----------------------------------

    return jsonify({
        "status": "success",
        "transcription": transcribed_text
    })
# --- END OF NEW ENDPOINT ---

@app.route("/generate-vector", methods=["POST"])
def generate_vector():
    data = request.get_json()
    description = data.get("description")
    if not description:
        return jsonify({"status": "error", "message": "No description provided"}), 400
    print(f"\n⚡️--- Received description for vectorization: '{description}' ---⚡️")
    simulated_vector = [0.1, 0.5, -0.2] + [round(num, 4) for num in (os.urandom(10))]
    print(f"✅--- Generated Feature Vector (first 5 elements): {simulated_vector[:5]}... ---✅\n")
    return jsonify({
        "status": "success",
        "message": f"Successfully generated vector for: {description}",
        "feature_vector": simulated_vector
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)