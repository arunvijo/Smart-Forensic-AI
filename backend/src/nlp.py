from flask import Flask, request
import whisper
import tempfile
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow frontend requests
model = whisper.load_model("base")

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    audio_file = request.files["audio"]
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        audio_file.save(tmp.name)
        result = model.transcribe(tmp.name)
        
        # Print transcription to terminal
        print("\n🎤 Transcription Result:")
        print(result["text"])
        print("-" * 50)
    
    # Just return 204 (no content)
    return ("", 204)

if __name__ == "__main__":
    app.run(debug=True)
