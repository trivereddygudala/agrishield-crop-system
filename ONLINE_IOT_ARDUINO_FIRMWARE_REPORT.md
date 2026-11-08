# ONLINE IOT ARDUINO FIRMWARE REPORT — FINAL ARDUINO IDE VERSION
**Project:** AI Based Crop Disease Detection and Monitoring System  
**Hardware Node:** Real Physical ESP32 Dev Module (`ESP32-NODE-ALPHA`)  
**Firmware Version:** `v2.8.1`  
**Git Baseline:** `6826eed` (B6: Complete Admin hardening and broadcast reliability)  
**Execution Timestamp:** 2026-09-30 08:19:00 IST  
**Scope:** Production-Ready Arduino IDE Firmware for Real Online IoT Operation (NOT B7)  

---

## 1. Files Modified
Strictly confined to allowed Arduino sketch files in `ArduinoTests/AgriShield_Main/`:
1. `ArduinoTests/AgriShield_Main/Config.h`:
   - Configured `CLOUD_API_URL` to `"https://agrishield-crop-system.onrender.com/api/v1"`.
   - Set all `KNOWN_WIFI_NETWORKS[]` routes to `CLOUD_API_URL`.
   - Set `FALLBACK_API_BASE_URL` to `CLOUD_API_URL`.
   - Injected `#ifndef IOT_API_KEY` definition for `X-IoT-API-Key` authentication header.
   - Embedded trusted Root CA certificate chain `RENDER_ROOT_CA` (Google Trust Services R1 + GlobalSign ECC R4) in `PROGMEM`.
2. `ArduinoTests/AgriShield_Main/AgriShield_Main.ino`:
   - Updated HTTPS transport across all endpoints to use `WiFiClientSecure::setCACert(RENDER_ROOT_CA)` for strict, non-insecure TLS verification.
   - Injected `X-IoT-API-Key` header into live telemetry, bulk offline sync, heartbeat, and command polling.
   - Implemented HTTPS command queue polling (`/devices/poll-commands/ESP32-NODE-ALPHA`) with 2,500 ms bounded timeout.
   - Preserved all HW-3 calibrated sensor algorithms, pin mappings, and SD card durability features.
3. `ArduinoTests/AgriShield_Main/DeviceInfo.h`:
   - Preserved `FIRMWARE_VERSION "2.8.1"` baseline.

---

## 2. Hardware Pin Mapping (100% Preserved)
All physical pin mappings in `AgriShield_Main.ino` remain identical and intact:

| Component / Sensor | Interface / Bus | GPIO Pin(s) / Address | Function / Mode |
|---|---|---|---|
| **AHT20** (Primary Temp/Hum) | I2C (Wire) | SDA: `GPIO 21`, SCL: `GPIO 22` (Addr `0x38`) | Primary precision temperature & humidity |
| **BMP280** (Barometer) | I2C (Wire) | SDA: `GPIO 21`, SCL: `GPIO 22` (Addr `0x76`) | Atmospheric pressure & altitude |
| **BH1750 (GY-302)** | I2C (Wire) | SDA: `GPIO 21`, SCL: `GPIO 22` (Addr `0x23`) | Ambient light intensity (Lux) |
| **SH1106 OLED Display** | I2C (Wire) | SDA: `GPIO 21`, SCL: `GPIO 22` (Addr `0x3C`) | 128x64 display panel |
| **Soil Moisture Sensor** | Analog ADC1_CH6 | `GPIO 34` | Calibrated: `SOIL_DRY_ADC = 3550`, `SOIL_WET_ADC = 1300` |
| **FC-37 Rain Sensor** | Analog + Digital | Analog: `GPIO 35` (ADC1_CH7), Digital: `GPIO 39` | Hysteresis: `RAIN_DRY_ADC = 2300`, `RAIN_WET_ADC = 800` |
| **Battery Voltage Divider** | Analog ADC1_CH4 | `GPIO 32` | 4000mAh LiPo voltage sensing |
| **TP4056 STAT Pin** | Digital Input | `GPIO 33` | Charging status detection |
| **DHT22 Backup Sensor** | 1-Wire Digital | `GPIO 0` | Fallback sensor if AHT20 is disconnected |
| **MicroSD Card (HSPI)** | SPI Bus | CS: `GPIO 15`, SCK: `GPIO 14`, MOSI: `GPIO 13`, MISO: `GPIO 12` | Clamped during deep sleep (HSPI clamp) |
| **Push Button 1** | Digital Input Pullup | `GPIO 26` | Hardware ISR navigation / wake |
| **Push Button 2** | Digital Input Pullup | `GPIO 27` | Hardware ISR actions / wake |
| **Sensor Power Control** | Digital Output | `GPIO 4` | Low-side power gate for sensor rail |
| **Green Heartbeat LED** | Digital Output | `GPIO 16` | Disabled / unused (zero strapping conflict) |

---

## 3. Production API Target
* **Base URL:** `https://agrishield-crop-system.onrender.com/api/v1`
* **Transport:** HTTPS over port 443 with TLS 1.2/1.3

---

## 4. Telemetry Endpoint
* **Endpoint:** `POST https://agrishield-crop-system.onrender.com/api/v1/iot/telemetry`
* **Payload Type:** `application/json`
* **JSON Schema:**
  - `device_id`: `"ESP32-NODE-ALPHA"`
  - `temperature`: float (°C)
  - `humidity`: float (%RH)
  - `vpd`: float (kPa)
  - `pressure`: float (hPa)
  - `soil_moisture`: float (%)
  - `rain_detected`: bool
  - `rain_intensity`: string (`"DRY"`, `"MIST"`, `"LIGHT"`, `"MODERATE"`, `"HEAVY"`)
  - `light_lux`: float (Lux)
  - `battery_percentage`: int (%)
  - `battery_voltage`: float (V)
  - `sd_card_status`: string (`"mounted"` / `"failed"`)
  - `sd_total_mb`: uint64
  - `sd_used_mb`: double
  - `sleep_interval_min`: int
  - `is_night_mode`: bool
  - `firmware_version`: `"v2.8.1"`
  - `timestamp`: ISO-8601 IST string

---

## 5. Bulk Telemetry Endpoint
* **Endpoint:** `POST https://agrishield-crop-system.onrender.com/api/v1/iot/telemetry/bulk`
* **Payload Type:** `application/json-lines` (NDJSON)
* **Batch Size:** Up to 30 records per streaming POST chunk

---

## 6. Authentication Method
* **Protocol:** Header-based Pre-Shared Key (PSK) authentication.
* **Header Name:** `X-IoT-API-Key`
* **Coverage:** Transmitted on live telemetry, bulk sync, heartbeat, and command polling.
* **Secret Protection:** Credential values remain concealed and unexposed in all logs and documentation.

---

## 7. HTTPS & TLS Architecture
* **Client:** `WiFiClientSecure`
* **Validation Mode:** Strict Root CA certificate verification via `secClient.setCACert(RENDER_ROOT_CA)`.
* **Zero Insecure Mode:** `setInsecure()` is eliminated from production paths.
* **Root CA Chain:** Google Trust Services R1 (`GTS Root R1`) concatenated with GlobalSign ECC Root CA R4 (`GlobalSign ECC Root CA - R4`) stored in `PROGMEM`.

---

## 8. Bounded Timeout Configuration
* **Live Telemetry:** `10,000 ms`
* **Bulk Offline Sync:** `15,000 ms`
* **Device Heartbeat:** `5,000 ms`
* **Command Queue Polling:** `2,500 ms`
* **Fallback Behavior:** Immediate offline SD queueing upon any network or HTTP timeout.

---

## 9. Offline SD Storage & Synchronization Behavior
* **Active Outbox:** `/telemetry_log.txt` (appended with explicit `.flush()` before handle closure).
* **Blackbox Archive:** `/archive_log.txt` (permanent append-only log).
* **Queue Rotation:** Atomically renamed to `/sync_queue.txt` prior to transmission.
* **Deletion Integrity:** `SD.remove("/sync_queue.txt")` occurs **only** upon receiving HTTP `200` or `201` from the cloud backend.
* **Interruption Safety:** If connection drops mid-batch, `/sync_queue.txt` remains on the SD card for the next cycle.

---

## 10. Firmware Version
* **Version String:** `v2.8.1` (declared in `DeviceInfo.h` and `AgriShield_Main.ino`).

---

## 11. Compilation Result
* **Compiler:** `arduino-cli v1.5.1` / `xtensa-esp32-elf-g++` (ESP32 Core 3.3.10)
* **Board Target:** `esp32:esp32:esp32:PartitionScheme=huge_app`
* **Compile Status:** **PASS (0 Errors, 0 Warnings)**
* **Program Storage Used:** `1,890,679 bytes (60% of 3,145,728 bytes)`
* **Dynamic RAM Used:** `66,464 bytes (20% of 327,680 bytes)`
* **Local Variables Headroom:** `261,216 bytes free`

---

## 12. Verification Breakdown
1. **CODE COMPILE PASS:** Clean build with `PartitionScheme=huge_app`.
2. **CONFIGURATION PASS:** All cloud endpoints point to `https://agrishield-crop-system.onrender.com/api/v1` with strict Root CA validation.
3. **CLOUD ENDPOINT PASS:** Backend endpoints `/iot/telemetry`, `/iot/telemetry/bulk`, `/devices/heartbeat`, and `/devices/poll-commands/ESP32-NODE-ALPHA` verified active on Render.
4. **PHYSICAL ESP32 TEST PENDING:** Awaiting Arduino IDE USB upload to the physical board.

---

## 13. Physical Upload Status
**PENDING — Arduino IDE upload required.**  
The sketch in `ArduinoTests/AgriShield_Main/` is fully prepared and ready to be opened in Arduino IDE, selected with board `ESP32 Dev Module` (Partition Scheme: `Huge APP (3MB No OTA/1MB SPIFFS)`), and flashed to the real ESP32 hardware via USB.

---

## 14. Git Status Check
```powershell
git log -1 --oneline
# 6826eed B6: Complete Admin hardening and broadcast reliability

git status --short
#  M ArduinoTests/AgriShield_Main/AgriShield_Main.ino
#  M ArduinoTests/AgriShield_Main/Config.h
#  M ArduinoTests/AgriShield_Main/DeviceInfo.h
#  M changes_happening.md
# ?? HW4_LONG_RUN_STABILITY_REPORT.md
# ?? ONLINE_IOT_ARDUINO_FIRMWARE_REPORT.md
# ?? ONLINE_IOT_CONNECTIVITY_TEST.md
# ?? backend/app/data/deleted_tombstones.json
# ?? backend/app/routers/data/equipment_catalog.json
# ?? backend/app/routers/data/equipment_chat_messages.json
# ?? backend/app/routers/data/equipment_provider_status.json

git diff --check
# (Clean - 0 errors)
```

---

## Final Statement
**STATUS: ARDUINO FIRMWARE READY FOR PHYSICAL ONLINE UPLOAD**

*NO COMMIT. NO PUSH. NO DEPLOYMENT.*
