# AgriShield - Future Upgrades & Technical Architecture Roadmap

*This document preserves the curated high-impact engineering upgrades for AgriShield. Each upgrade includes problem definition, technical stack, architecture pattern, and implementation steps so any can be activated on-demand.*

---

## 1. 📱 Offline Edge-AI Vision Scanner (Zero-Latency In-Browser Inference)
* **Status:** Saved for future implementation
* **Objective:** Allow farmers to scan leaves and receive instant disease diagnosis in remote fields with zero internet connectivity or 2G signal drops.
* **Technical Architecture:**
  - **Model:** Quantized 8-bit MobileNetV3 / EfficientNet-Lite (~3.8 MB to 4.5 MB `.onnx` or TensorFlow.js format).
  - **Client Execution:** Runs inside a dedicated HTML5 Web Worker (`frontend/src/workers/modelWorker.js`) using `onnxruntime-web` or `@tensorflow/tfjs` with WebGL/WebGPU acceleration.
  - **Latency:** ~180ms – 250ms on standard Android phones.
  - **Resource Impact:** 0 MB backend Render RAM, zero cloud network overhead, works seamlessly in Airplane mode.
  - **Online Sync:** When internet connection is restored, background IndexedDB queue synchronizes the diagnosis to MongoDB and optionally invokes the NVIDIA NIM Cloud cascade for dual verification.

---

## 2. 📈 Real-Time APMC Mandi Price Arbitrage & Profit Radar
* **Status:** Saved for future implementation
* **Objective:** Empower farmers with real-time crop market prices across regional mandis (Guntur, Khammam, Warangal, Kurnool, Vijayawada, etc.) to eliminate exploitative middleman cuts.
* **Technical Architecture:**
  - **Data Source:** Agmarknet / e-NAM / data.gov.in agricultural commodity price feeds cached daily in MongoDB (`backend/app/services/mandi_service.py`).
  - **Arbitrage Calculator:** Compares the farmer's registered crop against live prices in markets within 50–150 km.
  - **UI Display (`MarketPricesPage.jsx` & Dashboard Widget):**
    - High/Low/Modal price indicators per quintal.
    - Net Profit Estimator: Calculates transport fuel cost vs. extra revenue earned by driving to a higher-paying market.
    - Example: *"Chilli in Guntur Mandi is selling at ₹19,200/quintal (+₹1,800 higher than your local town market). Estimated extra net profit after transport: +₹14,500."*

---

## 3. 💬 Autonomous 2-Way WhatsApp Bot Gateway
* **Status:** Saved for future implementation
* **Objective:** Enable farmers to diagnose diseases and receive voice prescriptions directly through WhatsApp without opening a browser.
* **Technical Architecture:**
  - **Endpoint:** FastAPI Webhook at `/api/v1/whatsapp/webhook` integrated with Meta WhatsApp Cloud API / Twilio WhatsApp Sandbox.
  - **Inbound Processing:** 
    - Farmer sends an image or audio query to AgriShield's WhatsApp number.
    - System downloads media buffer, passes image to PyTorch + NVIDIA NIM classifier.
  - **Outbound Response:**
    - Generates localized Telugu prescription text.
    - Synthesizes a 15-second voice audio memo explaining pesticide dosage and application tips.
    - Sends both back into the WhatsApp conversation within 3 seconds.

---

## 4. 🛰️ Sentinel-2 Satellite Field NDVI Health & Soil Stress Index
* **Status:** Saved for future implementation
* **Objective:** Detect plant stress, chlorophyll deficiency, and fungal spread 4–7 days before visible surface lesions appear on leaves.
* **Technical Architecture:**
  - **Data Source:** Free Copernicus Data Space Ecosystem (European Space Agency Sentinel-2 MSI multispectral satellite).
  - **Input Geometry:** Farmer's registered GPS polygon boundaries from `FieldBoundaryMap.jsx`.
  - **Indices Computed:**
    - **NDVI** (Normalized Difference Vegetation Index): $(B8 - B4) / (B8 + B4)$ for canopy vigor.
    - **NDRE** (Normalized Difference Red Edge): $(B8 - B5) / (B8 + B5)$ for early-stage chlorophyll loss.
    - **NDWI** (Normalized Difference Water Index): For root-zone moisture stress.
  - **Early Warning Pipeline:** Generates automatic push notifications if canopy vigor drops >10% over two consecutive 5-day satellite passes.

---

## 5. 🎙️ 1-Tap Walkie-Talkie Voice Crop Doctor (Dialect-Tolerant Indic Voice)
* **Status:** Saved for future implementation
* **Objective:** Eliminate keyboard typing for farmers by providing a press-and-hold microphone interface that converses naturally in rural Telugu and regional dialects.
* **Technical Architecture:**
  - **Microphone Stream:** Web Audio API with Opus compression streaming to backend speech-to-text.
  - **ASR Engine:** Whisper-large-v3 / Bhashini / AI4Bharat IndicASR for accurate Telugu agricultural terminology.
  - **LLM Reasoning:** NVIDIA NIM (`meta/llama-3.3-70b-instruct`) for rapid agronomic reasoning with Indian agricultural university guidelines.
  - **Audio Out:** Natural Telugu TTS voice streaming audio back to the farmer's speaker.
