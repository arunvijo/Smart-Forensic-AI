# 🧠 Smart Forensic AI – Text/Voice to Sketch Prototype

### 🎯 Overview

**Smart Forensic AI** is a research prototype that generates **forensic-style sketches** from **voice or text descriptions** using deep learning.
The system simulates how a sketch artist interviews a witness — asking structured questions (face shape, hair, eyes, nose, etc.) — and converts the answers into an AI-generated sketch.

This project demonstrates how **generative AI** can automate the early stages of suspect profiling in forensic investigations.

---

### ⚙️ **System Workflow**

```
Voice / Text Input
        ↓
Attribute Extraction (face shape, hair, eyes, etc.)
        ↓
StyleGAN (Generates Face from Attributes)
        ↓
Pix2Pix (Converts Face → Forensic Sketch)
        ↓
CLIP + FairFace (Validates Sketch Accuracy)
        ↓
Final Sketch Output
```

---

### 🧩 **Core Modules**

| Module            | Function                                                     | Framework                 |
| ----------------- | ------------------------------------------------------------ | ------------------------- |
| Voice-to-Text     | Converts spoken descriptions to text                         | Whisper (PyTorch)         |
| Attribute Parser  | Extracts attributes like age, gender, ethnicity, accessories | spaCy / Regex             |
| Face Generator    | Generates synthetic face images                              | StyleGAN (PyTorch)        |
| Sketch Translator | Converts faces into sketch-style images                      | Pix2Pix (Conditional GAN) |
| Validation        | Checks semantic and demographic consistency                  | CLIP + FairFace           |
| Interface         | User-friendly web dashboard                                  | Streamlit                 |

---

### 🧱 **Tech Stack**

| Category             | Tools / Frameworks                         |
| -------------------- | ------------------------------------------ |
| Programming Language | Python                                     |
| Deep Learning        | PyTorch                                    |
| Voice Recognition    | Whisper                                    |
| Generative Models    | StyleGAN, Pix2Pix                          |
| Validation           | CLIP, FairFace                             |
| Data Management      | MongoDB / ElasticSearch (optional)         |
| UI                   | Streamlit                                  |
| Dataset              | CelebA, CUFS, synthetic photo–sketch pairs |

---

### 🗂️ **Project Structure**

```
Smart-Forensic-AI/
│
├── data/                        # Datasets (CelebA, CUFS, sample images)
│   ├── sample_faces/
│   └── sample_sketches/
│
├── models/                      # Pretrained weights and checkpoints
│   ├── stylegan/
│   └── pix2pix/
│
├── src/                         # Core source code
│   ├── main.py                  # Master pipeline script
│   ├── attribute_parser.py      # Text/voice to structured attributes
│   ├── stylegan_generate.py     # Face generation module
│   ├── pix2pix_translate.py     # Face→Sketch conversion
│   ├── validation_clip.py       # CLIP similarity module
│   ├── validation_fairface.py   # Age/Ethnicity/Gender validation
│   └── ui_streamlit.py          # Streamlit app interface
│
├── docs/                        # Documentation & diagrams
│   ├── architecture.png
│   ├── database_design.png
│   └── sample_output.png
│
├── requirements.txt
├── LICENSE
└── README.md
```

---

### 💻 **Quick Start**

```bash
# Clone the repository
git clone https://github.com/<your-username>/Smart-Forensic-AI.git
cd Smart-Forensic-AI

# Install dependencies
pip install -r requirements.txt

# Run the prototype interface
streamlit run src/ui_streamlit.py
```

---

### 🧠 **Example Prompt**

```
"A 30-year-old Asian male with short black hair and glasses."
```

➡ Generates a realistic AI sketch aligned with the described attributes.

---

### 📊 **Planned Milestones**

| Phase   | Tasks                                                   | Progress |
| ------- | ------------------------------------------------------- | -------- |
| Phase 1 | GitHub setup, dataset exploration, base modules created | ✅ 30%    |
| Phase 2 | Integrate StyleGAN + Pix2Pix pipeline                   | 🔄       |
| Phase 3 | Add CLIP & FairFace validation                          | ⏳        |
| Phase 4 | Streamlit UI + testing                                  | ⏳        |
| Phase 5 | Final integration, evaluation, report                   | ⏳        |

---

### 📚 **Datasets Used**

* **CelebA / CelebA-HQ:** Face images with 40 attributes.
* **CUHK Face Sketch Dataset (CUFS):** Paired face–sketch images.
* **Synthetic Sketches:** Generated using HED/XDoG filters for training.

---

### 🧩 **Key Features**

* Converts both **voice and text** inputs into structured forensic attributes.
* Generates **realistic sketches** from structured descriptions.
* Uses **deep learning validation** to check output accuracy.
* Prototype-only (no real criminal datasets used).

---

### 📜 **License**

MIT License
© 2025 Smart Forensic AI Project Team. For research and educational use only.
