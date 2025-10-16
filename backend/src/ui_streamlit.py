import streamlit as st
from PIL import Image
import os
import time

# ===============================
# Import your backend modules here
# ===============================
# from attribute_parser import extract_attributes
# from stylegan_generate import generate_face
# from pix2pix_translate import face_to_sketch
# from validation_clip import clip_similarity
# from validation_fairface import validate_attributes

# -------------------------------
# PLACEHOLDER FUNCTIONS (for demo)
# Replace these with actual functions later
# -------------------------------

def extract_attributes(description: str):
    """Mock function to extract attributes from text description."""
    desc = description.lower()
    attrs = {
        "gender": "male" if "man" in desc or "male" in desc else "female" if "woman" in desc else "unknown",
        "age": "30" if "30" in desc else "unknown",
        "ethnicity": "asian" if "asian" in desc or "chinese" in desc else "unknown",
        "accessory": "glasses" if "glass" in desc else "none"
    }
    return attrs


def generate_face(attributes: dict):
    """Placeholder: Generate a fake face image (for now just load a sample)."""
    sample_img_path = "docs/sample_output.png"
    if not os.path.exists(sample_img_path):
        img = Image.new("RGB", (512, 512), (200, 200, 200))
        img.save(sample_img_path)
    return Image.open(sample_img_path)


def face_to_sketch(face_img: Image.Image):
    """Placeholder: Convert face to sketch (for now grayscale)."""
    return face_img.convert("L")


def clip_similarity(prompt, sketch_img):
    """Placeholder CLIP similarity score."""
    return round(0.87, 2)


def validate_attributes(sketch_img):
    """Placeholder FairFace validation results."""
    return {"age": "25–35", "gender": "Male", "ethnicity": "Asian"}


# ===============================
# STREAMLIT APP STARTS HERE
# ===============================

st.set_page_config(page_title="Smart Forensic AI", layout="centered")

st.title("Smart Forensic AI – Text/Voice to Sketch Prototype")
st.write(
    "This prototype generates forensic-style sketches from **text or voice descriptions** "
    "using deep learning models (StyleGAN + Pix2Pix)."
)

st.markdown("---")

# ----------- INPUT SECTION -----------

input_mode = st.radio("Choose input mode:", ["📝 Text Input", "🎤 Voice Upload"])

description = ""

if input_mode == "📝 Text Input":
    description = st.text_area("Enter suspect description:", 
                               placeholder="Example: A 30-year-old Asian man with short black hair and glasses.")
elif input_mode == "🎤 Voice Upload":
    audio_file = st.file_uploader("Upload a short voice clip (WAV/MP3):", type=["wav", "mp3"])
    if audio_file:
        st.audio(audio_file)
        st.info("⚙️ Voice to text conversion (Whisper) will process this file — demo placeholder.")
        # description = whisper_to_text(audio_file)  # Future integration
        description = "A 30-year-old Asian man with glasses"

if description:
    st.success("✅ Description received!")
    st.markdown(f"**Description:** {description}")

    # Extract attributes
    attributes = extract_attributes(description)
    st.markdown("### 🧩 Extracted Attributes")
    st.json(attributes)

    # Generate face
    if st.button("🎨 Generate Sketch"):
        with st.spinner("Generating AI sketch... please wait ⏳"):
            time.sleep(2)

            face_img = generate_face(attributes)
            sketch_img = face_to_sketch(face_img)

            # Validation
            clip_score = clip_similarity(description, sketch_img)
            fairface_results = validate_attributes(sketch_img)

            st.markdown("### 🖼️ Generated Forensic Sketch")
            st.image(sketch_img, caption="AI-generated sketch", use_column_width=True)

            st.markdown("### ✅ Validation Results")
            col1, col2 = st.columns(2)
            with col1:
                st.metric("CLIP Similarity", f"{clip_score*100:.1f}%")
            with col2:
                st.write(f"**FairFace Prediction:**")
                st.json(fairface_results)

        st.success("Sketch generation complete! 🔍")
else:
    st.info("Please enter a description or upload a voice clip to begin.")

st.markdown("---")
