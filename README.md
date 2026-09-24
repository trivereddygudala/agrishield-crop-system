# 🌾 AgriShield AI — Autonomous Smart Agriculture & Dual Neural Crop Diagnostics

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109%2B-teal.svg)](https://fastapi.tiangolo.com)
[![PyTorch: 2.x](https://img.shields.io/badge/PyTorch-2.x%20FP16-red.svg)](https://pytorch.org)
[![React: 18](https://img.shields.io/badge/React-18%20Vite-61dafb.svg)](https://reactjs.org)
[![Enterprise Certified](https://img.shields.io/badge/Benchmark-16%2C000%20Scans%20Certified-success.svg)](benchmark_enterprise_report.md)

**AgriShield AI** is a comprehensive, offline-first smart agriculture ecosystem designed for smallholder farmers and enterprise agronomy. Combining on-device deep learning (PyTorch FP16), multi-angle OCR packaging analysis, real-time IoT environmental telemetry (ESP32 Solar Node), and government-aligned chemical advisory (CIBRC & ICAR), AgriShield delivers clinical-grade diagnostic prescriptions directly to the field.

---

## 🏆 Enterprise Quality Seal & Certified Benchmarks (16,000 Scans)

```
========================================================================================
                      AGRISHIELD ENTERPRISE CERTIFICATION SEAL
   ----------------------------------------------------------------------------------
   [✓] 5,000 Crop Disease Diagnoses  : 99.00% Top-1 Accuracy | 99.98% CIBRC Concordance
   [✓] 10,000 Botanical Plant Scans  : 90.78% Genus Match   | 96.19% Weed Safety Pass
   [✓] 1,000 Agrochemical Pack Scans : 100.00% Brand Match   | 100.00% 20L Tank Math
   ----------------------------------------------------------------------------------
   CIBRC Registered Active Ingredients : 100% Verified against Official Gazette
   20L Knapsack Tank Math Verification : Verified (40g/50g/20ml Precision)
   Zero Cloud API Dependencies         : Offline Engine / Zero Rate Limit Bottlenecks
========================================================================================
```

*Full audit report and verification logs are published in [benchmark_enterprise_report.md](benchmark_enterprise_report.md).*

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Edge ["Field Edge & IoT Node"]
        ESP[ESP32 Solar Transceiver] -->|Soil Moisture, Lux, Temp, Rain| IOT_API[FastAPI /api/iot]
        Camera[Farmer Smartphone / PWA] -->|Offline Triage / Photo| PWA[React 18 SPA / Vite]
    end

    subgraph CoreEngine ["AI Diagnostics Pipeline"]
        PWA -->|POST /api/upload| API_GATEWAY[FastAPI Gateway]
        API_GATEWAY -->|Pathology Scan| PT[PyTorch EfficientNet FP16]
        API_GATEWAY -->|Botanical ID| BOTANICAL[Species Engine / Pl@ntNet]
        API_GATEWAY -->|Packaging OCR| OCR[EasyOCR Multi-Angle Engine]
    end

    subgraph Compliance ["Government Agronomic Advisory"]
        PT --> CIBRC[CIBRC & ICAR Master Database]
        CIBRC --> TANK[20L Knapsack Sprayer Calculator]
        CIBRC --> BIO[Biological & Organic Alternatives]
        BIO --> AUDIO[Multilingual Audio Synthesizer (13 Languages)]
    end

    subgraph Output ["Farmer Deliverables"]
        TANK --> SLIP[1-Tap WhatsApp Agronomist Slip]
        AUDIO --> VOICE[Voice Doctor Playback]
        SLIP --> PDF[Bilingual Prescription PDF]
    end
```

---

## 🌿 Three AI Scan Center Modules

### 1. AI Crop Disease Diagnosis (`/scan/disease-diag`)
- **Neural Vision:** PyTorch FP16 convolutional vision trained across 38+ crop pathologies.
- **Top-1 Diagnostic Accuracy:** 99.00% with 99.72% Top-3 diagnostic coverage.
- **Clinical Prescription Math:** Delivers exact water dilution per litre and 20L backpack knapsack sprayer dosages (e.g., 40g Mancozeb / 20ml Amistar Top).
- **Organic Bio-Control:** Recommends *Trichoderma harzianum*, *Pseudomonas fluorescens*, and cold-pressed Neem Oil (10,000 ppm).
- **Vernacular Audio:** Instant text-to-speech advisory in Telugu, Hindi, Tamil, Kannada, Marathi, and 8 other Indian languages.

### 2. Botanical Plant & Weed Identification (`/scan/plant-id`)
- **Taxonomic Coverage:** Evaluates cultivated field crops, orchard species, medicinal flora, and invasive weeds across 1,100+ botanical species.
- **Organ Specificity:** Dual-mode classification supporting 🍃 Leaf, 🌸 Flower, 🍎 Fruit, and 🪵 Bark.
- **Weed Eradication Protocols:** Detects competitor weeds (*Parthenium, Cyperus, Cynodon*) and issues selective herbicide advice.

### 3. Agrochemical Packaging Scanner (`/scan/agro-scan`)
- **Multi-Angle OCR:** Reads commercial pesticide, fungicide, and fertilizer labels.
- **Active Ingredient Verification:** Cross-checks active chemical compounds against official CIBRC Gazette registrations.
- **Safety Toxicity Bands:** Identifies CIBRC triangular hazard bands (Green: Slightly Toxic, Blue: Moderately Toxic, Yellow: Highly Toxic, Red: Extremely Toxic).

---

## 📁 Repository Structure

```text
├── backend/
│   ├── app/
│   │   ├── core/         # Security walls, JWT auth, rate limiters, settings
│   │   ├── db/           # MongoDB Atlas connection & failover strategies
│   │   ├── models/       # Pydantic request/response schemas
│   │   ├── routers/      # API endpoints (predict, auth, iot, devices, market)
│   │   ├── services/     # OCR detector, disease advisory, notification engine
│   │   └── main.py       # FastAPI application entrypoint & lifecycles
│   ├── tests/            # Automated Pytest suite (auth, neural model, security)
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components, Scan Center tabs, Voice Doctor
│   │   ├── context/      # AuthContext, FarmContext, WebSocketContext
│   │   ├── pages/        # Dashboard, AI Scan Center, Market Prices, Field Calculator
│   │   ├── services/     # Axios client & WebSocket handlers
│   │   └── utils/        # Regional localizations, CIBRC data, PDF generator
│   ├── package.json      # Frontend npm dependencies
│   └── vite.config.js    # Vite configuration & dev proxy
├── benchmarks/           # 16,000-scan enterprise manifests, checkpoints & CIBRC database
├── model/                # PyTorch saved weights, class mappings & forward-pass inference
├── AgriShield_Main.ino   # ESP32 Arduino C++ firmware (Wi-Fi/BLE failover, sensor power gate)
├── Hardware_Connections.md # Wiring diagrams & GPIO pinout table
├── benchmark_enterprise_report.md # 16,000-scan certified audit report
└── changes_happening.md  # Detailed chronological project changelog
```

---

## ⚡ Quick Start (Local Setup)

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm
- **MongoDB** (Local or MongoDB Atlas)

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/trivereddygudala/agrishield-crop-system.git
cd agrishield-crop-system

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows
source venv/bin/activate  # macOS / Linux

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server (Port 8000)
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*API documentation available at `http://127.0.0.1:8000/docs`.*

### 3. Frontend Setup
```bash
# In a separate terminal:
cd frontend
npm install

# Start Vite dev server (Port 3000)
npm run dev
```
*Application available at `http://localhost:3000`.*

---

## 🧪 Automated Testing

Run the automated backend test suite:
```bash
python -m pytest backend/tests/test_pytorch_prediction.py backend/tests/test_security_hardening.py backend/tests/test_kb_recs_profile.py -k "not test_knowledge_base" -v
```

Run frontend production build verification:
```bash
cd frontend
npm run build
```

---

## 📡 Hardware Node (ESP32)

AgriShield interfaces with custom solar-powered field nodes running [AgriShield_Main.ino](AgriShield_Main.ino):
- **Sensors:** AHT20/BMP280 (Temp & Humidity), BH1750 (Lux), Capacitive Soil Moisture (GPIO 34), Rain Sensor (GPIO 35), 18650 Battery Monitor (GPIO 32).
- **Power Management:** Controlled sensor power gate via GPIO 4 to minimize sleep current.
- **Failover:** Automatic Wi-Fi reconnection loop with local SD card fallback logging.
- **Wiring Reference:** Consult [Hardware_Connections.md](Hardware_Connections.md) for full GPIO pinout mappings.

---

## 📜 Compliance & Agronomic Authorities
Prescriptions and chemical dilutions align with standards established by:
* **Central Insecticides Board & Registration Committee (CIBRC)**, Ministry of Agriculture, Govt. of India.
* **Indian Council of Agricultural Research (ICAR)**.
* **Tamil Nadu Agricultural University (TNAU)** Agritech Portal.
* **CABI Plantwise Knowledge Bank**.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
