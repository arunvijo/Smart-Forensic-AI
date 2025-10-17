from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os

app = Flask(__name__)
CORS(app)  # Allow frontend requests

# Load the Whisper model once when the server starts
try:
    model = whisper.load_model("base")
    print("✅ Whisper model loaded successfully.")
except Exception as e:
    print(f"🔥 Error loading Whisper model: {e}")
    model = None

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    if not model:
        return jsonify({"status": "error", "message": "Whisper model not loaded"}), 500

    if "audio" not in request.files:
        return jsonify({"status": "error", "message": "No audio file found"}), 400

    audio_file = request.files["audio"]
    
    # Create a temporary file and immediately close it so it can be used by other processes
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    audio_file.save(temp_file.name)
    temp_file.close() # <-- This is the key change to release the file lock

    try:
        # Transcribe the audio file using its path
        result = model.transcribe(temp_file.name)
        transcribed_text = result["text"]

        print("\n🎤--- Transcription Result ---🎤")
        print(transcribed_text)
        print("-------------------------------\n")

        # Return the transcribed text to the frontend
        return jsonify({"status": "success", "transcription": transcribed_text})
    except Exception as e:
        print(f"🔥 Error during transcription: {e}")
        return jsonify({"status": "error", "message": "Failed to transcribe audio"}), 500
    finally:
        # Clean up the temporary file
        os.remove(temp_file.name)


@app.route("/process_speech", methods=["POST"])
def process_speech():
    data = request.get_json()
    description = data.get("description")

    if not description:
        return jsonify({"status": "error", "message": "No description provided"}), 400

    print("\n✅--- Description Received from Frontend ---✅")
    print(description)
    print("---------------------------------------------\n")

    return jsonify({
        "status": "success",
        "message": "Description received and processed successfully!",
        "received_description": description
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)