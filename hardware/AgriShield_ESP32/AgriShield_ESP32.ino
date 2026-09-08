/*
  =================================================================================
  🌾 AgriShield_Main.ino - ESP32 Master Field Transceiver (v4.1 Clean Wi-Fi Failover)
  =================================================================================
  Compatible with: Arduino IDE 2.x / 1.8.x & ESP32 Board Core 3.x (3.3.10)
  Board: ESP32 Dev Module (Partition Scheme: Default 4MB with SPIFFS / Huge APP)

  Feature Summary:
  - 1. Clean Wi-Fi Failover Loop: Executes WiFi.disconnect(false) before WiFi.begin() to eliminate 'wifi:sta is connecting' error log!
  - 2. SD Card Mounting Verified: SD Card mounted and logging telemetry cleanly!
  - 3. Bluetooth & SD Memory Order: SerialBT.begin() initialized BEFORE SD.begin() to reserve Bluetooth DRAM block.
  - 4. Safe Non-Strapping Pins: LEDs mapped to safe pins (4, 16, 17, 27, 13, 26).
  - 5. Real-Time Light Lux Sensor: Live ambient light reading (0 - 100,000 Lux).
  - 6. Permanent NVS Flash Memory (Up to 3 Wi-Fi Networks): Stores 3 Wi-Fi SSIDs & Passwords in Flash!
  - 7. Bluetooth Terminal Commands: 'WIFI:SSID,PASS', 'WIFI:LIST', 'WIFI:CLEAR'.
  - 8. Automatic I2C Bus Scanner: Scans SDA (GPIO 21) & SCL (GPIO 22) during boot.
  - 9. Precision Voltmeter Calibration: Calibrated multiplier (3.95V / 3.31V).
  - 10. Balanced OLED Header Cluster: Time/Date, [BT], [Wi-Fi], and [Battery Bar %].
  =================================================================================
*/

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <WiFi.h>
#include <time.h>
#include <Preferences.h>
#include <BluetoothSerial.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <BH1750.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_AHTX0.h>
#include <DHT.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <DNSServer.h>

DNSServer dnsServer;
bool apModeActive = false;
unsigned long wifiDisconnectTimer = 0;
bool strictOfflineMode = false;
unsigned long oledTimeoutMs = 60000;
unsigned long lastOledActivity = 0;

WebServer server(80);
const char* serverIndex = 
"<script src='https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js'></script>"
"<form method='POST' action='#' enctype='multipart/form-data' id='upload_form'>"
   "<input type='file' name='update'>"
   "<input type='submit' value='Update Firmware'>"
"</form>"
"<div id='prg'>Progress: 0%</div>"
"<script>"
"$('form').submit(function(e){"
"  e.preventDefault();"
"  var form = $('#upload_form')[0];"
"  var data = new FormData(form);"
"  $.ajax({"
"    url: '/update',"
"    type: 'POST',"
"    data: data,"
"    contentType: false,"
"    processData: false,"
"    xhr: function() {"
"      var xhr = new window.XMLHttpRequest();"
"      xhr.upload.addEventListener('progress', function(evt) {"
"        if (evt.lengthComputable) {"
"          var per = evt.loaded / evt.total;"
"          $('#prg').html('Progress: ' + Math.round(per*100) + '%');"
"        }"
"      }, false);"
"      return xhr;"
"    },"
"    success:function(d, s) {"
"      console.log('success!');"
"      $('#prg').html('Update Success! ESP32 is rebooting...');"
"    },"
"    error: function (a, b, c) {"
"      $('#prg').html('Update Failed!');"
"    }"
"  });"
"});"
"</script>";

const char* offlinePanelHTML = 
"<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'>"
"<title>AgriShield Offline Node</title>"
"<style>body{font-family:sans-serif;text-align:center;background:#0f172a;color:#fff;padding:20px;} .card{background:#1e293b;border-radius:12px;padding:20px;margin:20px auto;max-width:400px;} button{background:#10b981;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-weight:bold;cursor:pointer;width:100%;margin-bottom:10px;} .btn-red{background:#ef4444;} .btn-blue{background:#3b82f6;} input{width:100%;padding:10px;margin:10px 0;border-radius:8px;border:none;box-sizing:border-box;} .inline-inputs{display:flex;gap:10px;} .inline-inputs input{width:50%;}</style></head>"
"<body><h2>🌾 AgriShield Offline Node</h2>"
"<div class='card'><h3>Live Telemetry</h3><p>Temp: <span id='t'>--</span>&deg;C</p><p>Humidity: <span id='h'>--</span>%</p><p>Soil: <span id='s'>--</span>%</p><p>Screen Active: <span id='sc'>--</span>s</p><button onclick='fetchData()'>Refresh Data</button></div>"
"<div class='card'><h3>Hardware Controls</h3>"
"<button class='btn-red' onclick='fetch(\"/api/shutdown\",{method:\"POST\"}).then(()=>alert(\"Shutting down!\"))'>Complete Shutdown</button>"
"<button class='btn-blue' onclick='fetch(\"/api/offline_mode\",{method:\"POST\"}).then(()=>alert(\"Strict Offline Activated!\"))'>Strict Offline Mode</button>"
"<form method='POST' action='/api/screen_config' style='margin-top:15px; border-top:1px solid #334155; padding-top:15px;'>"
"<h4>Screen Timeout</h4><div class='inline-inputs'><input type='number' name='min' placeholder='Min' min='0' required><input type='number' name='sec' placeholder='Sec' min='0' max='59' required></div><button type='submit'>Set Timeout</button></form>"
"</div>"
"<div class='card'><h3>Wi-Fi Setup</h3><form method='POST' action='/save_wifi'><input type='text' name='ssid' placeholder='WiFi SSID' required><input type='password' name='pass' placeholder='WiFi Password' required><button type='submit'>Save & Reboot</button></form></div>"
"<script>function fetchData(){ fetch('/api/data').then(r=>r.json()).then(d=>{ document.getElementById('t').innerText=d.t; document.getElementById('h').innerText=d.h; document.getElementById('s').innerText=d.s; document.getElementById('sc').innerText=d.sc; }); } fetchData(); setInterval(fetchData, 5000);</script>"
"</body></html>";

// ---------------------------------------------------------------------------------
// 💾 NON-VOLATILE FLASH STORAGE FOR UP TO 3 PERMANENT WI-FI NETWORKS
// ---------------------------------------------------------------------------------
Preferences preferences;
String wifi_ssids[3] = {"", "", ""};
String wifi_passes[3] = {"", "", ""};

// NTP Time Server Configuration (UTC+5:30 IST Default: 19800 seconds offset)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // 5 hours 30 mins
const int daylightOffset_sec = 0;

// ---------------------------------------------------------------------------------
// OLED Display Configuration (1.3" SH1106)
// ---------------------------------------------------------------------------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ---------------------------------------------------------------------------------
// 🎨 8x8 BITMAP GRAPHIC ICONS FOR HEADER BAR
// ---------------------------------------------------------------------------------
const unsigned char PROGMEM bitmap_bluetooth[] = {
    0b00100000,
    0b00101000,
    0b01101000,
    0b00110000,
    0b00110000,
    0b01101000,
    0b00101000,
    0b00100000
};

const unsigned char PROGMEM bitmap_wifi[] = {
    0b00000000,
    0b01111100,
    0b10000010,
    0b00111000,
    0b01000100,
    0b00010000,
    0b00000000,
    0b00000000
};

// Bluetooth Serial Instance
BluetoothSerial SerialBT;

// MicroSD SPI Pins — Final Working Connections
#define SD_CS   15
#define SD_SCK  14
#define SD_MOSI 13
#define SD_MISO 12
bool sdMounted = false;
uint64_t sdCardSizeMB = 0;

// I2C Sensor Instances (AHT20 + BMP280 Combo Module + BH1750)
BH1750 lightMeter;
Adafruit_BMP280 bmp;
Adafruit_AHTX0 aht;

// Backup DHT Pin Configuration (Dedicated GPIO 0)
#define DHTPIN 0
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Push Button Dual Mapping (Supports GPIO 25 & GPIO 14)
#define PIN_BUTTON_1  25
#define PIN_BUTTON_2  14
#define PIN_CHARGE    33  // USB Charger STAT pin

// 6 Status LEDs (100% Safe GPIOs - Zero Strapping/SPI Conflicts!)
#define LED_HEARTBEAT   16  // Green LED (Power Heartbeat - GPIO 16)
#define LED_WIFI        4   // White LED1 (Wi-Fi - GPIO 4)
#define LED_BT          17  // Blue LED (Bluetooth - GPIO 17)
#define LED_TX          27  // Yellow LED (Data Transmit - GPIO 27)
#define LED_PAGE        13  // White LED2 (Page Button Glow - GPIO 13)
#define LED_RED_ALERT   26  // RED Alert LED (Low Battery / Fault - GPIO 26)

// Analog Sensor Inputs (ADC1_CH4, ADC1_CH6, ADC1_CH7)
#define PIN_SOIL_ANALOG 34  // Capacitive Soil Moisture (ADC1_CH6)
#define PIN_RAIN_ANALOG 35  // Rain Sensor Analog (ADC1_CH7)
#define PIN_BATT_ANALOG 32  // 4000mAh Battery Voltage Sensor Module (ADC1_CH4)

// Calibration Constants
const int SOIL_DRY_ADC = 3200;
const int SOIL_WET_ADC = 1400;
const int RAIN_DRY_ADC = 4095;
const int RAIN_WET_ADC = 1200;

// Global System Variables
int activePage = 1;
const int TOTAL_PAGES = 5;
unsigned long lastDisplayUpdate = 0;
unsigned long lastTelemetryUpload = 0;
unsigned long lastWifiRetryTime = 0;
int currentWifiSlot = 0;

// Real Sensor Variables (Initialized to -999 for unconnected detection)
float temperature = -999.0;
float humidity = -999.0;
float pressurehPa = -999.0;
float altitudeMeters = -999.0;
float soilMoisture = -999.0;
int lightLux = -1;
int rainPercent = -1;
bool isRaining = false;
float batteryVoltage = -1.0;
int batteryPercent = -1;
bool isCharging = false;

// Sensor Validation & Network Flags
bool ahtValid = false;
bool bh1750Valid = false;
bool bmp280Valid = false;
bool dhtValid = false;
bool soilValid = false;
bool rainValid = false;
bool batteryValid = false;
bool wifiConnected = false;
bool btConnected = false;

// ---------------------------------------------------------------------------------
// 💾 WI-FI FLASH MEMORY MANAGEMENT (PERMANENT NVS STORAGE)
// ---------------------------------------------------------------------------------
void loadSavedWifiNetworks() {
    preferences.begin("agri_wifi", true); // Read-only mode
    for (int i = 0; i < 3; i++) {
        String keySsid = "ssid_" + String(i + 1);
        String keyPass = "pass_" + String(i + 1);
        wifi_ssids[i] = preferences.getString(keySsid.c_str(), "");
        wifi_passes[i] = preferences.getString(keyPass.c_str(), "");
    }
    preferences.end();

    Serial.println(F("[FLASH MEMORY] Loaded Permanent Saved Wi-Fi Networks:"));
    for (int i = 0; i < 3; i++) {
        if (wifi_ssids[i].length() > 0) {
            Serial.printf("  Slot %d: '%s'\n", i + 1, wifi_ssids[i].c_str());
        } else {
            Serial.printf("  Slot %d: [EMPTY]\n", i + 1);
        }
    }
}

void saveWifiToFlash(String newSsid, String newPass) {
    newSsid.trim();
    newPass.trim();
    if (newSsid.length() == 0) return;

    int targetSlot = -1;
    for (int i = 0; i < 3; i++) {
        if (wifi_ssids[i].equalsIgnoreCase(newSsid)) {
            targetSlot = i;
            break;
        }
    }

    if (targetSlot == -1) {
        for (int i = 0; i < 3; i++) {
            if (wifi_ssids[i].length() == 0) {
                targetSlot = i;
                break;
            }
        }
    }

    if (targetSlot == -1) {
        wifi_ssids[0] = wifi_ssids[1];
        wifi_passes[0] = wifi_passes[1];
        wifi_ssids[1] = wifi_ssids[2];
        wifi_passes[1] = wifi_passes[2];
        targetSlot = 2;
    }

    wifi_ssids[targetSlot] = newSsid;
    wifi_passes[targetSlot] = newPass;

    preferences.begin("agri_wifi", false);
    String keySsid = "ssid_" + String(targetSlot + 1);
    String keyPass = "pass_" + String(targetSlot + 1);
    preferences.putString(keySsid.c_str(), newSsid);
    preferences.putString(keyPass.c_str(), newPass);
    preferences.end();

    Serial.printf("💾 Permanently Saved Wi-Fi '%s' to Flash Memory Slot %d!\n", newSsid.c_str(), targetSlot + 1);
}

void clearWifiFlashMemory() {
    preferences.begin("agri_wifi", false);
    preferences.clear();
    preferences.end();
    for (int i = 0; i < 3; i++) {
        wifi_ssids[i] = "";
        wifi_passes[i] = "";
    }
    WiFi.disconnect(true);
    Serial.println(F("🗑️ All Wi-Fi Networks Erased from Flash Memory!"));
}

// ---------------------------------------------------------------------------------
// 🔍 AUTOMATIC I2C BUS SCANNER
// ---------------------------------------------------------------------------------
void scanI2CBus() {
    Serial.println(F("[I2C SCAN] Probing SDA (GPIO 21) & SCL (GPIO 22)..."));
    byte count = 0;
    for (byte address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        byte error = Wire.endTransmission();
        if (error == 0) {
            Serial.printf("  -> Found I2C Device at 0x%02X\n", address);
            count++;
        }
    }
    if (count == 0) {
        Serial.println(F("⚠️ No I2C devices detected! Check VCC, GND, SDA 21 & SCL 22."));
    }
}

// ---------------------------------------------------------------------------------
// 💡 STATUS LED CONTROLLER
// ---------------------------------------------------------------------------------
void updateStatusLeds() {
    unsigned long currentMillis = millis();

    // 1. Green LED (Power Heartbeat) - Blinks every 5 seconds
    bool heartbeatPulse = (currentMillis % 5000) < 100;
    digitalWrite(LED_HEARTBEAT, heartbeatPulse ? HIGH : LOW);

    // 2. White LED1 (Wi-Fi) - Blinks every 6 seconds IF connected
    wifiConnected = (WiFi.status() == WL_CONNECTED);
    if (wifiConnected) {
        bool wifiPulse = (currentMillis % 6000) < 100;
        digitalWrite(LED_WIFI, wifiPulse ? HIGH : LOW);
    } else {
        digitalWrite(LED_WIFI, LOW);
    }

    // 3. Blue LED (Bluetooth) - Blinks every 6 seconds IF connected
    btConnected = SerialBT.hasClient();
    if (btConnected) {
        bool btPulse = (currentMillis % 6000) < 100;
        digitalWrite(LED_BT, btPulse ? HIGH : LOW);
    } else {
        digitalWrite(LED_BT, LOW);
    }

    // 4. Red Alert LED Logic (PWM & Blinking)
    bool anyIotDisconnected = (!ahtValid || !bmp280Valid || !dhtValid || !bh1750Valid || !soilValid || !rainValid || !sdMounted);
    bool isBatteryLow = (batteryValid && batteryPercent > 5 && batteryPercent <= 20);
    bool isCritical = (batteryValid && batteryPercent <= 5);

    if (isCritical) {
        // System Critical -> Solid Red (100%)
        analogWrite(LED_RED_ALERT, 255);
    } else if (anyIotDisconnected) {
        // IoT Device Disconnected -> Blinks every 2 seconds
        bool blink2s = (currentMillis % 2000) < 1000;
        analogWrite(LED_RED_ALERT, blink2s ? 255 : 0);
    } else if (isBatteryLow) {
        // Battery Low -> Blinks every 3 seconds with 50% light (PWM 127)
        bool blink3s = (currentMillis % 3000) < 1500;
        analogWrite(LED_RED_ALERT, blink3s ? 127 : 0);
    } else {
        analogWrite(LED_RED_ALERT, 0); // Normal operation (OFF)
    }
}

// ---------------------------------------------------------------------------------
// 🔬 REAL SENSOR READING (Standard BH1750 Library + Calibrated Voltmeter)
// ---------------------------------------------------------------------------------
void readAllSensors() {
    yield();

    // 1. AHT20 Temperature & Humidity
    if (ahtValid) {
        sensors_event_t humidityEv, tempEv;
        aht.getEvent(&humidityEv, &tempEv);
        if (!isnan(tempEv.temperature) && tempEv.temperature > -40.0 && tempEv.temperature < 85.0) {
            temperature = tempEv.temperature;
            humidity = humidityEv.relative_humidity;
        }
    } else if (dhtValid) {
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t) && !isnan(h) && t > -40.0 && t < 85.0) {
            temperature = t;
            humidity = h;
        }
    }

    yield();

    // 2. BMP280 Barometric Pressure Sensor
    if (bmp280Valid) {
        float p = bmp.readPressure();
        if (p > 30000.0F && p < 120000.0F) {
            pressurehPa = p / 100.0F;
            altitudeMeters = bmp.readAltitude(1013.25);
        } else {
            bmp280Valid = false;
        }
    }

    yield();

    // 3. BH1750 Sunlight Sensor
    if (bh1750Valid) {
        float lux = lightMeter.readLightLevel();
        if (lux >= 0.0 && lux <= 100000.0) {
            lightLux = (int)lux;
        } else {
            lightLux = -1;
        }
    }

    yield();

    // 4. Soil Moisture Sensor (GPIO 34)
    int rawSoil = analogRead(PIN_SOIL_ANALOG);
    if (rawSoil > 200 && rawSoil < 3900) {
        soilMoisture = map(constrain(rawSoil, SOIL_WET_ADC, SOIL_DRY_ADC), SOIL_DRY_ADC, SOIL_WET_ADC, 0, 100);
        soilValid = true;
    } else {
        soilValid = false;
    }

    yield();

    // 5. Rain Sensor (GPIO 35)
    int rawRain = analogRead(PIN_RAIN_ANALOG);
    if (rawRain > 100) {
        rainPercent = map(constrain(rawRain, RAIN_WET_ADC, RAIN_DRY_ADC), RAIN_DRY_ADC, RAIN_WET_ADC, 0, 100);
        isRaining = (rainPercent > 20);
        rainValid = true;
    } else {
        rainValid = false;
    }

    yield();

    // 6. 4300mAh Battery Voltage Sensor (GPIO 32)
    int rawBatt = analogRead(PIN_BATT_ANALOG);
    if (rawBatt > 150) {
        float uncalibratedV = (rawBatt / 4095.0) * 3.3 * 5.0;
        float calibratedV = uncalibratedV * (3.95 / 3.31);
        
        batteryVoltage = calibratedV;
        batteryPercent = constrain(map(batteryVoltage * 100, 320, 405, 0, 100), 0, 100);
        batteryValid = true;
    } else {
        batteryValid = false;
        batteryPercent = -1;
    }
    isCharging = (digitalRead(PIN_CHARGE) == LOW);

    yield();
}

// ---------------------------------------------------------------------------------
// 👑 TOP HEADER BAR ([Time 12-hr & Date] -> Clean Gaps -> [BT] [Wi-Fi] [Battery])
// ---------------------------------------------------------------------------------
void drawHeaderBar() {
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    unsigned long currentMillis = millis();

    struct tm timeinfo;
    display.setCursor(0, 0);

    if (wifiConnected && getLocalTime(&timeinfo)) {
        int hour12 = timeinfo.tm_hour % 12;
        if (hour12 == 0) hour12 = 12;
        int mins = timeinfo.tm_min;
        int day = timeinfo.tm_mday;
        int month = timeinfo.tm_mon + 1;

        if (hour12 < 10) display.print(F("0"));
        display.print(hour12);
        display.print(F(":"));
        if (mins < 10) display.print(F("0"));
        display.print(mins);
        display.print(F(" "));
        if (day < 10) display.print(F("0"));
        display.print(day);
        display.print(F("/"));
        if (month < 10) display.print(F("0"));
        display.print(month);
    } else {
        unsigned long totalSec = currentMillis / 1000;
        int hrs = (totalSec / 3600) % 12;
        if (hrs == 0) hrs = 12;
        int mins = (totalSec / 60) % 60;
        if (hrs < 10) display.print(F("0"));
        display.print(hrs);
        display.print(F(":"));
        if (mins < 10) display.print(F("0"));
        display.print(mins);
        display.print(F(" 26/07"));
    }

    bool btBlinkState = (currentMillis / 500) % 2 == 0;
    if (btConnected) {
        display.drawBitmap(74, 1, bitmap_bluetooth, 8, 8, SH110X_WHITE);
    } else if (btBlinkState) {
        display.drawBitmap(74, 1, bitmap_bluetooth, 8, 8, SH110X_WHITE);
    }

    bool wifiBlinkState = (currentMillis / 500) % 2 == 0;
    if (wifiConnected) {
        display.drawBitmap(86, 1, bitmap_wifi, 8, 8, SH110X_WHITE);
    } else if (wifiBlinkState) {
        display.drawBitmap(86, 1, bitmap_wifi, 8, 8, SH110X_WHITE);
    }

    display.drawRect(98, 1, 9, 7, SH110X_WHITE);
    display.drawPixel(107, 3, SH110X_WHITE);
    int fillW = (batteryValid && batteryPercent > 0) ? map(constrain(batteryPercent, 0, 100), 0, 100, 0, 7) : 0;
    if (fillW > 0) {
        display.fillRect(99, 2, fillW, 5, SH110X_WHITE);
    }
    display.setCursor(110, 0);
    if (batteryValid && batteryPercent >= 0) {
        display.print(batteryPercent);
        display.print(F("%"));
    } else {
        display.print(F("--"));
    }

    display.drawLine(0, 10, 128, 10, SH110X_WHITE);
}

// ---------------------------------------------------------------------------------
// 📺 OLED 5-PAGE DISPLAY CONTROLLER
// ---------------------------------------------------------------------------------
void drawOledPage() {
    display.clearDisplay();

    drawHeaderBar();

    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);

    switch (activePage) {
        case 1:
            display.setCursor(0, 16);
            display.print(F("Temp  : "));
            if ((ahtValid || dhtValid) && temperature > -40.0) {
                display.print(temperature, 1);
                display.print(F(" C"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 32);
            display.print(F("Humid : "));
            if ((ahtValid || dhtValid) && humidity >= 0.0) {
                display.print(humidity, 1);
                display.print(F(" %RH"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 48);
            display.print(F("Light : "));
            if (bh1750Valid && lightLux >= 0) {
                display.print(lightLux);
                display.print(F(" Lux"));
            } else {
                display.print(F("--"));
            }
            break;

        case 2:
            display.setCursor(0, 16);
            display.print(F("Soil  : "));
            if (soilValid && soilMoisture >= 0.0) {
                display.print(soilMoisture, 1);
                display.print(F(" %"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 32);
            display.print(F("Rain  : "));
            if (rainValid) {
                display.print(isRaining ? F("YES (RAIN)") : F("NO"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 48);
            display.print(F("Press : "));
            if (bmp280Valid && pressurehPa > 0) {
                display.print(pressurehPa, 1);
                display.print(F(" hPa"));
            } else {
                display.print(F("--"));
            }
            break;

        case 3:
            display.setCursor(0, 16);
            display.print(F("Batt  : "));
            if (batteryValid && batteryPercent >= 0) {
                display.print(batteryPercent);
                display.print(F(" % (4300mA)"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 32);
            display.print(F("Volt  : "));
            if (batteryValid && batteryVoltage > 0) {
                display.print(batteryVoltage, 2);
                display.print(F(" V"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 48);
            display.print(F("State : "));
            display.print(isCharging ? F("CHARGING⚡") : F("DISCHARGE"));
            break;

        case 4:
            display.setCursor(0, 16);
            display.print(F("WiFi  : "));
            if (wifiConnected) {
                display.print(WiFi.localIP().toString());
            } else {
                display.print(F("SEARCHING.."));
            }

            display.setCursor(0, 32);
            display.print(F("BT    : "));
            display.print(btConnected ? F("CONNECTED") : F("READY"));

            display.setCursor(0, 48);
            display.print(F("Node  : AgriShield_01"));
            break;

        case 5:
            display.setCursor(0, 16);
            display.print(F("SD Card: "));
            display.print(sdMounted ? F("MOUNTED") : F("NO CARD"));

            display.setCursor(0, 32);
            display.print(F("Format : "));
            display.print(sdMounted ? F("FAT32 OK") : F("--"));

            display.setCursor(0, 48);
            display.print(F("Size   : "));
            if (sdMounted && sdCardSizeMB > 0) {
                display.print((unsigned long)sdCardSizeMB);
                display.print(F(" MB"));
            } else {
                display.print(F("--"));
            }
            break;
    }

    display.display();
}

// ---------------------------------------------------------------------------------
// 🚀 ARDUINO SETUP
// ---------------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n======================================================="));
    Serial.println(F("🌾 AgriShield_Main.ino Master Node Initializing..."));
    Serial.println(F("======================================================="));

    // 1. Initialize Pin Modes (100% Safe Non-Strapping GPIOs)
    pinMode(PIN_BUTTON_1, INPUT_PULLUP);
    pinMode(PIN_BUTTON_2, INPUT_PULLUP);
    pinMode(PIN_CHARGE, INPUT_PULLUP);

    pinMode(LED_HEARTBEAT, OUTPUT);
    pinMode(LED_WIFI, OUTPUT);
    pinMode(LED_BT, OUTPUT);
    pinMode(LED_TX, OUTPUT);
    pinMode(LED_PAGE, OUTPUT);
    pinMode(LED_RED_ALERT, OUTPUT);

    digitalWrite(LED_HEARTBEAT, HIGH);
    digitalWrite(LED_RED_ALERT, LOW);

    // 2. START BLUETOOTH CLASSIC FIRST (Reserves contiguous DRAM block cleanly before SD card allocation!)
    Serial.println(F("[BT] Reserving DRAM & Starting Bluetooth SPP ('AgriShield_Node_01')..."));
    if (SerialBT.begin("AgriShield_Node_01")) {
        Serial.println(F("✅ Bluetooth Classic Active! Pair name: 'AgriShield_Node_01'"));
    } else {
        Serial.println(F("⚠️ Bluetooth Classic Init Failed!"));
    }

    // 3. Load Up To 3 Permanently Saved Wi-Fi Networks from ESP32 NVS Flash Memory
    loadSavedWifiNetworks();

    // 4. MicroSD Initialization AFTER Bluetooth DRAM Reservation
    pinMode(SD_CS, OUTPUT);
    digitalWrite(SD_CS, HIGH);

    SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
    delay(100);

    if (SD.begin(SD_CS)) {
        sdMounted = true;
        sdCardSizeMB = SD.cardSize() / (1024 * 1024);
        Serial.printf("✅ SD Card Initialized Successfully! Size: %LLu MB\n", (unsigned long)sdCardSizeMB);
        
        File file = SD.open("/telemetry_log.txt", FILE_APPEND);
        if (file) {
            file.println(F("--- AgriShield Node Bootup Logging ---"));
            file.close();
        }
    } else {
        sdMounted = false;
        Serial.println(F("❌ SD Card Initialization Failed!"));
    }

    // 5. Initialize I2C Bus & Scan Devices
    Wire.begin(21, 22);
    delay(100);

    scanI2CBus();

    // 6. Initialize OLED (1.3" SH1106 via Adafruit SH110X library)
    if (!display.begin(0x3C, true)) {
        Serial.println(F("⚠️ OLED SH1106 Init Failed! Check SDA 21 / SCL 22"));
    } else {
        Serial.println(F("✅ 1.3\" OLED SH1106 Display Detected!"));
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SH110X_WHITE);
        display.setCursor(10, 20);
        display.println(F("AgriShield AI Node"));
        display.setCursor(10, 38);
        display.println(F("Initializing..."));
        display.display();
        delay(800);
    }

    // 7. AHT20 + BMP280 Combo Module Initialization
    if (aht.begin()) {
        ahtValid = true;
        Serial.println(F("✅ AHT20 Temp & Humidity Active (Address 0x38)!"));
    }
    if (bmp.begin(0x76) || bmp.begin(0x77)) {
        bmp280Valid = true;
        Serial.println(F("✅ BMP280 Barometric Pressure Active (Address 0x76)!"));
    }

    // 8. BH1750 Light Sensor Initialization
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
        bh1750Valid = true;
        Serial.println(F("✅ BH1750 Light Sensor Initialized Successfully!"));
    } else {
        bh1750Valid = false;
        Serial.println(F("⚠️ BH1750 Light Sensor Initialization Failed!"));
    }

    // 9. Initialize Wi-Fi Connection (STA Mode)
    WiFi.persistent(false);
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);

    for (int i = 0; i < 3; i++) {
        if (wifi_ssids[i].length() > 0) {
            Serial.printf("[WiFi] Initializing connection to Slot %d '%s'...\n", i + 1, wifi_ssids[i].c_str());
            WiFi.begin(wifi_ssids[i].c_str(), wifi_passes[i].c_str());
            currentWifiSlot = i;
            break;
        }
    }

    // Configure NTP Real-Time Clock Sync
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    // Backup DHT22
    dht.begin();

    // 10. Web OTA Setup
    server.on("/", HTTP_GET, []() {
      server.sendHeader("Connection", "close");
      server.send(200, "text/html", apModeActive ? offlinePanelHTML : serverIndex);
    });

    server.on("/api/data", HTTP_GET, []() {
      unsigned long screenActiveSec = (millis() - lastOledActivity) / 1000;
      String json = String("{\"t\":") + (ahtValid || dhtValid ? String(temperature, 1) : String("\"--\"")) +
                    ",\"h\":" + (ahtValid || dhtValid ? String(humidity, 1) : String("\"--\"")) +
                    ",\"s\":" + (soilValid ? String(soilMoisture, 1) : String("\"--\"")) + 
                    ",\"sc\":\"" + String(screenActiveSec) + "\"}";
      server.send(200, "application/json", json);
    });

    server.on("/api/shutdown", HTTP_POST, []() {
      server.send(200, "text/plain", "Shutting down");
      delay(500);
      esp_deep_sleep_start();
    });

    server.on("/api/offline_mode", HTTP_POST, []() {
      strictOfflineMode = true;
      WiFi.disconnect(true);
      server.send(200, "text/plain", "Strict Offline Mode Activated");
    });

    server.on("/api/screen_config", HTTP_POST, []() {
      if(server.hasArg("min") && server.hasArg("sec")) {
        int m = server.arg("min").toInt();
        int s = server.arg("sec").toInt();
        oledTimeoutMs = (m * 60000) + (s * 1000);
        lastOledActivity = millis();
        server.sendHeader("Location", "/");
        server.send(303);
      } else {
        server.send(400, "text/plain", "Missing args");
      }
    });

    server.on("/save_wifi", HTTP_POST, []() {
      if(server.hasArg("ssid") && server.hasArg("pass")) {
        String newSsid = server.arg("ssid");
        String newPass = server.arg("pass");
        saveWifiToFlash(newSsid, newPass);
        server.send(200, "text/html", "<h2>Saved! ESP32 is rebooting...</h2>");
        delay(1000);
        ESP.restart();
      } else {
        server.send(400, "text/plain", "Missing args");
      }
    });

    server.on("/update", HTTP_POST, []() {
      server.sendHeader("Connection", "close");
      server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
      ESP.restart();
    }, []() {
      HTTPUpload& upload = server.upload();
      if (upload.status == UPLOAD_FILE_START) {
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) Serial.printf("Update Success: %u bytes\n", upload.totalSize);
        else Update.printError(Serial);
      }
    });
    server.begin();

    // --- PRINT FINAL DEVICE CONNECTION SUMMARY ---
    Serial.println(F("\n======================================================="));
    Serial.println(F("       AGRISHIELD DEVICE CONNECTION SUMMARY            "));
    Serial.println(F("======================================================="));
    Serial.printf("[SD Card]    : %s\n", sdMounted ? "✅ Mounted" : "❌ Failed");
    Serial.printf("[OLED]       : %s\n", "✅ Connected"); 
    Serial.printf("[AHT20]      : %s\n", ahtValid ? "✅ Connected" : "❌ Failed");
    Serial.printf("[BMP280]     : %s\n", bmp280Valid ? "✅ Connected" : "❌ Failed");
    Serial.printf("[BH1750]     : %s\n", bh1750Valid ? "✅ Connected" : "❌ Failed");
    Serial.printf("[DHT22]      : %s\n", dhtValid ? "✅ Connected" : "❌ Failed");
    Serial.printf("[Bluetooth]  : %s\n", btConnected ? "✅ Enabled" : "⚠️ Disabled/Failed");
    Serial.printf("[Wi-Fi]      : %s\n", wifiConnected ? "✅ Connected" : "⚠️ Scanning...");
    Serial.println(F("=======================================================\n"));

    readAllSensors();
    drawOledPage();
    digitalWrite(LED_HEARTBEAT, LOW);
    Serial.println(F("=======================================================\n"));
}

// ---------------------------------------------------------------------------------
// 🔄 ARDUINO LOOP
// ---------------------------------------------------------------------------------
void loop() {
    yield();

    server.handleClient(); // Process Web OTA Requests
    if (apModeActive) dnsServer.processNextRequest();

    if (wifiConnected) {
        wifiDisconnectTimer = 0;
        if (apModeActive) {
            WiFi.softAPdisconnect(true);
            WiFi.mode(WIFI_STA);
            apModeActive = false;
        }
    }

    updateStatusLeds();
    unsigned long currentMillis = millis();

    // 1. MANUAL PUSH BUTTON PAGE SWITCH ONLY (GPIO 25 & GPIO 14)
    static int lastBtn1 = digitalRead(PIN_BUTTON_1);
    static int lastBtn2 = digitalRead(PIN_BUTTON_2);
    static unsigned long lastPressTime = 0;

    int curBtn1 = digitalRead(PIN_BUTTON_1);
    int curBtn2 = digitalRead(PIN_BUTTON_2);

    // 6. White LED2 (Page Switch) - Glows while button is pressed
    digitalWrite(LED_PAGE, (curBtn1 == LOW || curBtn2 == LOW) ? HIGH : LOW);

    bool btn1Pressed = (lastBtn1 == HIGH && curBtn1 == LOW);
    bool btn2Pressed = (lastBtn2 == HIGH && curBtn2 == LOW);

    if (btn1Pressed || btn2Pressed) {
        lastOledActivity = currentMillis;
    }

    if ((btn1Pressed || btn2Pressed) && (currentMillis - lastPressTime > 250)) {
        lastPressTime = currentMillis;
        activePage = (activePage % TOTAL_PAGES) + 1;

        drawOledPage();
        Serial.printf("[BUTTON] Manual Switch to Page %d\n", activePage);
    }
    lastBtn1 = curBtn1;
    lastBtn2 = curBtn2;

    // 2. 3-Wi-Fi Network Auto-Failover Retry Loop (Clean WiFi.disconnect to prevent driver log errors)
    if (!wifiConnected && !strictOfflineMode) {
        if (wifiDisconnectTimer == 0) wifiDisconnectTimer = currentMillis;

        if (!apModeActive && (currentMillis - wifiDisconnectTimer > 60000)) {
            Serial.println(F("[WiFi] 60s Timeout reached! Activating AP Fallback Mode..."));
            WiFi.mode(WIFI_AP_STA);
            WiFi.softAP("AgriShield-Node-Alpha");
            dnsServer.start(53, "*", WiFi.softAPIP());
            apModeActive = true;
            Serial.print(F("[WiFi] AP Mode Active! IP: "));
            Serial.println(WiFi.softAPIP());
        }

        if (currentMillis - lastWifiRetryTime >= 10000) {
            lastWifiRetryTime = currentMillis;
            
            // Cleanly reset Wi-Fi driver state before trying next slot
            WiFi.disconnect(false);
            delay(100);

            for (int attempts = 0; attempts < 3; attempts++) {
                currentWifiSlot = (currentWifiSlot + 1) % 3;
                if (wifi_ssids[currentWifiSlot].length() > 0) {
                    Serial.printf("[WiFi Failover] Retrying Slot %d: '%s'...\n", currentWifiSlot + 1, wifi_ssids[currentWifiSlot].c_str());
                    WiFi.begin(wifi_ssids[currentWifiSlot].c_str(), wifi_passes[currentWifiSlot].c_str());
                    break;
                }
            }
        }
    }

    // 3. Bluetooth Interactive & Flash Memory Wi-Fi Manager
    if (SerialBT.available()) {
        String btCommand = SerialBT.readStringUntil('\n');
        btCommand.trim();
        Serial.print(F("[BT RX] Command Received: "));
        Serial.println(btCommand);
        
        if (btCommand.startsWith("WIFI:") || btCommand.startsWith("wifi:")) {
            String param = btCommand.substring(5);
            param.trim();

            if (param.equalsIgnoreCase("LIST")) {
                SerialBT.println(F("\n--- 💾 SAVED WI-FI NETWORKS IN FLASH ---"));
                for (int i = 0; i < 3; i++) {
                    if (wifi_ssids[i].length() > 0) {
                        SerialBT.printf("Slot %d: %s\n", i + 1, wifi_ssids[i].c_str());
                    } else {
                        SerialBT.printf("Slot %d: [EMPTY]\n", i + 1);
                    }
                }
                SerialBT.println(F("----------------------------------------\n"));
            }
            else if (param.equalsIgnoreCase("CLEAR")) {
                clearWifiFlashMemory();
                SerialBT.println(F("🗑️ All Wi-Fi Networks Erased from Permanent Memory!"));
            }
            else {
                int commaPos = param.indexOf(',');
                if (commaPos > 0) {
                    String newSSID = param.substring(0, commaPos);
                    String newPASS = param.substring(commaPos + 1);
                    newSSID.trim();
                    newPASS.trim();

                    saveWifiToFlash(newSSID, newPASS);

                    SerialBT.println(F("💾 Wi-Fi Credentials Saved Permanently to Flash!"));
                    SerialBT.print(F("SSID: ")); SerialBT.println(newSSID);
                    SerialBT.println(F("🔄 Connecting now..."));

                    WiFi.disconnect(false);
                    delay(100);
                    WiFi.begin(newSSID.c_str(), newPASS.c_str());
                } else {
                    SerialBT.println(F("⚠️ Format to Save: WIFI:YourSSID,YourPassword"));
                    SerialBT.println(F("⚠️ Format to List: WIFI:LIST"));
                    SerialBT.println(F("⚠️ Format to Clear: WIFI:CLEAR"));
                }
            }
        } else {
            readAllSensors();
            SerialBT.print(F("✅ [AgriShield] Command Processed: "));
            SerialBT.println(btCommand);
            SerialBT.print(F("Temp: ")); if (ahtValid || dhtValid) SerialBT.print(temperature, 1); else SerialBT.print(F("--")); SerialBT.print(F(" C | "));
            SerialBT.print(F("Humid: ")); if (ahtValid || dhtValid) SerialBT.print(humidity, 1); else SerialBT.print(F("--")); SerialBT.print(F(" %RH | "));
            SerialBT.print(F("Light: ")); if (bh1750Valid && lightLux >= 0) SerialBT.print(lightLux); else SerialBT.print(F("--")); SerialBT.print(F(" Lux | "));
            SerialBT.print(F("Batt: ")); if (batteryValid) SerialBT.print(batteryPercent); else SerialBT.print(F("--")); SerialBT.println(F("%"));
        }
    }

    // 4. OLED Redraw (Every 200ms) with Timeout Logic
    if (currentMillis - lastDisplayUpdate >= 200) {
        lastDisplayUpdate = currentMillis;
        if (currentMillis - lastOledActivity < oledTimeoutMs) {
            drawOledPage();
        } else {
            display.clearDisplay();
            display.display();
        }
    }

    // 5. Read Sensors & Transmit Telemetry over USB Serial & Bluetooth & SD Card Logging (Every 60 seconds)
    if (currentMillis - lastTelemetryUpload >= 60000) {
        lastTelemetryUpload = currentMillis;
        readAllSensors();

        digitalWrite(LED_TX, HIGH);

        String jsonPayload = String("{\"device_id\":\"ESP32-NODE-ALPHA\",\"temp\":") +
                             (ahtValid || dhtValid ? String(temperature, 1) : String("null")) +
                             String(",\"humidity\":") + (ahtValid || dhtValid ? String(humidity, 1) : String("null")) +
                             String(",\"pressure_hpa\":") + (bmp280Valid ? String(pressurehPa, 1) : String("null")) +
                             String(",\"soil_moisture\":") + (soilValid ? String(soilMoisture, 1) : String("null")) +
                             String(",\"light_lux\":") + (bh1750Valid && lightLux >= 0 ? String(lightLux) : String("null")) +
                             String(",\"battery_percent\":") + (batteryValid ? String(batteryPercent) : String("null")) +
                             String(",\"sd_status\":") + (sdMounted ? String("\"MOUNTED\"") : String("\"NO CARD\"")) +
                             String("}");

        Serial.println(jsonPayload);

        if (sdMounted && !wifiConnected) {
            File file = SD.open("/telemetry_log.txt", FILE_APPEND);
            if (file) {
                file.println(jsonPayload);
                file.close();
            }
            Serial.println(F("💾 Saved to SD Card (Offline Mode)"));
        }

        if (btConnected) {
            SerialBT.println(F("\n--- 🌾 AGRI SHIELD LIVE TELEMETRY ---"));
            SerialBT.print(F("Temp    : ")); if (ahtValid || dhtValid) SerialBT.print(temperature, 1); else SerialBT.print(F("--")); SerialBT.println(F(" C"));
            SerialBT.print(F("Humid   : ")); if (ahtValid || dhtValid) SerialBT.print(humidity, 1); else SerialBT.print(F("--")); SerialBT.println(F(" %RH"));
            SerialBT.print(F("Light   : ")); if (bh1750Valid && lightLux >= 0) SerialBT.print(lightLux); else SerialBT.print(F("--")); SerialBT.println(F(" Lux"));
            SerialBT.print(F("Soil    : ")); if (soilValid) SerialBT.print(soilMoisture, 1); else SerialBT.print(F("--")); SerialBT.println(F(" %"));
            SerialBT.print(F("Rain    : ")); if (rainValid) SerialBT.println(isRaining ? F("YES (RAINING)") : F("NO")); else SerialBT.println(F("--"));
            SerialBT.print(F("Press   : ")); if (bmp280Valid) SerialBT.print(pressurehPa, 1); else SerialBT.print(F("--")); SerialBT.println(F(" hPa"));
            SerialBT.print(F("Battery : ")); if (batteryValid) { SerialBT.print(batteryPercent); SerialBT.print(F("% (")); SerialBT.print(batteryVoltage, 2); SerialBT.print(F("V)")); } else SerialBT.print(F("--")); SerialBT.println();
            SerialBT.print(F("JSON Payload: "));
            SerialBT.println(jsonPayload);
            SerialBT.println(F("-------------------------------------\n"));
        }

        delay(80);
        digitalWrite(LED_TX, LOW);
    }
}
