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
#include <HTTPClient.h>
// 🔵 Bluetooth Master Toggle (Set to 'true' to enable, 'false' to disable and save RAM/Power)
#define ENABLE_BLUETOOTH false

#include <time.h>
#if ENABLE_BLUETOOTH
#include <BluetoothSerial.h>
#include "esp_bt.h"          // Used to lower Bluetooth TX Power
#endif
#include <nvs_flash.h> // Required to permanently save Bluetooth pairing keys!

// Web OTA Libraries
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Update.h>

WebServer server(80);

// Webpage for OTA Upload (Hardcoded HTML String)
const char* serverIndex = 
"<script src='https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js'></script>"
"<form method='POST' action='#' enctype='multipart/form-data' id='upload_form'>"
"   <input type='file' name='update'>"
"   <input type='submit' value='Update Firmware'>"
"</form>"
"<div id='prg'>Progress: 0%</div>"
"<script>"
"  $('form').submit(function(e){"
"      e.preventDefault();"
"      var form = $('#upload_form')[0];"
"      var data = new FormData(form);"
"      $.ajax({"
"          url: '/update',"
"          type: 'POST',"
"          data: data,"
"          contentType: false,"
"          processData: false,"
"          xhr: function() {"
"              var xhr = new window.XMLHttpRequest();"
"              xhr.upload.addEventListener('progress', function(evt) {"
"                  if (evt.lengthComputable) {"
"                      var per = evt.loaded / evt.total;"
"                      $('#prg').html('Progress: ' + Math.round(per*100) + '%');"
"                  }"
"              }, false);"
"              return xhr;"
"          },"
"          success:function(d, s) {"
"              console.log('success!');"
"          },"
"          error: function (a, b, c) {"
"          }"
"      });"
"  });"
"</script>";

#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <BH1750.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_AHTX0.h>
#include <DHT.h>
#include <ESPmDNS.h>
#include "Config.h"

String currentApiBaseUrl = FALLBACK_API_BASE_URL;
bool mdnsResolved = false;

// 🔋 Battery Calibration Multiplier (Tweak this if the voltage reading is off!)
// Increase to raise the reported voltage, decrease to lower it.
#define BATT_CALIBRATION_MULTIPLIER 1.484 

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
#if ENABLE_BLUETOOTH
BluetoothSerial SerialBT;
#endif

// MicroSD SPI Pins (Default CS = GPIO 5)
#define SD_CS 5
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
const int TOTAL_PAGES = 4;
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
bool sntpInitialized = false;



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

    // 1. Green LED (Power Heartbeat) - Blinks every 5 seconds (Only LED Kept for Power Saving)
    bool heartbeatPulse = (currentMillis % 5000) < 100;
    digitalWrite(LED_HEARTBEAT, heartbeatPulse ? HIGH : LOW);

    // Track Wi-Fi State & Initialize NTP
    bool wasConnected = wifiConnected;
    wifiConnected = (WiFi.status() == WL_CONNECTED);
    if (wifiConnected && !sntpInitialized) {
        configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
        sntpInitialized = true;
        Serial.println(F("[NTP] SNTP Time Sync Started..."));
    }

    // Track Bluetooth State
    btConnected = false;
#if ENABLE_BLUETOOTH
    btConnected = SerialBT.hasClient();
#endif
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
        Serial.print(F("💡 BH1750 Lux Reading: ")); 
        Serial.println(lux);
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

    // 6. 4300mAh Battery Voltage Sensor (GPIO 32) (Averaged to stop jumping percentage!)
    long rawBattSum = 0;
    for (int i = 0; i < 20; i++) {
        rawBattSum += analogRead(PIN_BATT_ANALOG);
        delay(2);
    }
    int rawBatt = rawBattSum / 20;
    if (rawBatt > 150) {
        float uncalibratedV = (rawBatt / 4095.0) * 3.3 * 5.0;
        // Apply the user-tunable calibration multiplier from the top of the file
        float calibratedV = uncalibratedV * BATT_CALIBRATION_MULTIPLIER; 
        
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

    // 10ms timeout prevents loop-blocking before NTP sync completes!
    if (sntpInitialized && getLocalTime(&timeinfo, 10) && timeinfo.tm_year > 120) {
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
        display.print(F("--:--"));
    }

#if ENABLE_BLUETOOTH
    if (btConnected) {
        display.drawBitmap(69, 1, bitmap_bluetooth, 8, 8, SH110X_WHITE);
    }
#endif

    if (wifiConnected) {
        display.drawBitmap(81, 1, bitmap_wifi, 8, 8, SH110X_WHITE);
    }

    display.drawRect(93, 1, 9, 7, SH110X_WHITE);
    display.drawPixel(102, 3, SH110X_WHITE);
    int fillW = (batteryValid && batteryPercent > 0) ? map(constrain(batteryPercent, 0, 100), 0, 100, 0, 7) : 0;
    if (fillW > 0) {
        display.fillRect(94, 2, fillW, 5, SH110X_WHITE);
    }
    if (batteryValid && batteryPercent >= 0) {
        if (batteryPercent == 100) display.setCursor(104, 0);
        else if (batteryPercent >= 10) display.setCursor(110, 0);
        else display.setCursor(116, 0);
        display.print(batteryPercent);
        display.print(F("%"));
    } else {
        display.setCursor(116, 0);
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
    display.setTextColor(SH110X_WHITE, SH110X_BLACK);

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
                display.print(F("%"));
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
            display.print(wifiConnected ? WiFi.SSID() : F("DISCONNECTED"));
            display.setCursor(0, 32);
            display.print(F("BT    : "));
            display.print(btConnected ? F("CONNECTED") : F("READY"));

            display.setCursor(0, 48);
            display.print(F("Node  : AgriShield_01"));
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

    // Initialize NVS (Non-Volatile Storage) to permanently save Bluetooth pairing keys!
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    Serial.println(F("\n======================================================="));
    Serial.println(F("🌾 AgriShield_Main.ino Master Node Initializing..."));
    Serial.println(F("======================================================="));

    // 1. Initialize Pin Modes (100% Safe Non-Strapping GPIOs)
    pinMode(PIN_BUTTON_1, INPUT_PULLUP);
    pinMode(PIN_BUTTON_2, INPUT_PULLUP);
    pinMode(PIN_CHARGE, INPUT_PULLUP);

    pinMode(LED_HEARTBEAT, OUTPUT);

    digitalWrite(LED_HEARTBEAT, HIGH);

    // 2. START BLUETOOTH CLASSIC FIRST (Reserves contiguous DRAM block cleanly before SD card allocation!)
#if ENABLE_BLUETOOTH
    Serial.println(F("[BT] Reserving DRAM & Starting Bluetooth SPP ('AgriShield_Node_01')..."));
    if (SerialBT.begin("AgriShield_Node_01")) {
        // ⚡ BROWNOUT FIX: Drastically reduce Bluetooth transmission power to -12dBm (lowers current draw!)
        esp_bredr_tx_power_set(ESP_PWR_LVL_N12, ESP_PWR_LVL_N12);
        Serial.println(F("✅ Bluetooth Classic Initialized (Low Power Mode)"));
    } else {
        Serial.println(F("⚠️ Bluetooth Classic Init Failed!"));
    }
#else
    Serial.println(F("[BT] Bluetooth is DISABLED via master toggle to save power."));
#endif

    // 4. MicroSD Initialization AFTER Bluetooth DRAM Reservation
    pinMode(SD_CS, OUTPUT);
    digitalWrite(SD_CS, HIGH);

    // Explicitly initialize the SPI bus to prevent intermittent mount failures!
    SPI.begin(18, 19, 23, 5);
    delay(100);

    if (SD.begin(SD_CS) && SD.cardType() != CARD_NONE) {
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
        Serial.println(F("❌ SD Card Not Detected or Initialization Failed!"));
    }

    // 5. Initialize I2C Bus
    Wire.begin(21, 22);
    Wire.setClock(400000); // Increase I2C speed to 400kHz (Fast Mode) for GPIO 21 and 22
    delay(500); // Wait for devices to power up, matching sample code!
    // scanI2CBus(); // Temporarily disabled because this scanner loop can lock up some cheap I2C sensors!

    // 6. Initialize OLED (1.3" SH1106 via Adafruit SH110X library)
    if (!display.begin(0x3C, true)) {
        Serial.println(F("⚠️ OLED SH1106 Init Failed! Check SDA 21 / SCL 22"));
    } else {
        Serial.println(F("✅ 1.3\" OLED SH1106 Display Detected!"));
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SH110X_WHITE, SH110X_BLACK);
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
    delay(200); // Give BH1750 extra time to wake up after other sensors
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
        bh1750Valid = true;
        Serial.println(F("✅ BH1750 Light Sensor Initialized Successfully!"));
    } else if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire)) {
        bh1750Valid = true;
        Serial.println(F("✅ BH1750 Light Sensor Initialized Successfully (Alternate Address)!"));
    } else {
        bh1750Valid = false;
        Serial.println(F("⚠️ BH1750 Light Sensor Initialization Failed! Check I2C Wiring."));
    }

    // 9. Initialize Wi-Fi Connection (STA Mode)
    WiFi.persistent(false);
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);

    if (KNOWN_WIFI_COUNT > 0 && String(KNOWN_WIFI_NETWORKS[0].ssid).length() > 0) {
        Serial.printf("[WiFi] Initializing connection to Slot 1 '%s'...\n", KNOWN_WIFI_NETWORKS[0].ssid);
        WiFi.setTxPower(WIFI_POWER_8_5dBm); // Reduce initial Wi-Fi power to prevent Brownout!
        WiFi.begin(KNOWN_WIFI_NETWORKS[0].ssid, KNOWN_WIFI_NETWORKS[0].password);
    } else {
        Serial.println(F("[WiFi] No Wi-Fi networks found in Config.h! Connect via Bluetooth and send 'WIFI:SSID,PASSWORD'"));
    }

    if (!MDNS.begin("esp32-agrishield-client")) {
        Serial.println("Error setting up MDNS responder!");
    } else {
        Serial.println("mDNS responder started.");
    }

    // Backup DHT22
    dht.begin();

    // Start OTA Server
    MDNS.begin("agrishield");
    server.on("/", HTTP_GET, []() {
      server.sendHeader("Connection", "close");
      server.send(200, "text/html", serverIndex);
    });
    server.on("/update", HTTP_POST, []() {
      server.sendHeader("Connection", "close");
      server.send(200, "text/plain", (Update.hasError()) ? "FAIL" : "OK");
      ESP.restart();
    }, []() {
      HTTPUpload& upload = server.upload();
      if (upload.status == UPLOAD_FILE_START) {
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { Update.printError(Serial); }
      } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) { Update.printError(Serial); }
      } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) { Serial.printf("Update Success: %u\nRebooting...\n", upload.totalSize); }
      }
    });
    server.begin();

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
    
    updateStatusLeds();
    unsigned long currentMillis = millis();

    // 1. MANUAL PUSH BUTTON PAGE SWITCH ONLY (GPIO 25 & GPIO 14)
    static int lastBtn1 = digitalRead(PIN_BUTTON_1);
    static int lastBtn2 = digitalRead(PIN_BUTTON_2);
    static unsigned long lastPressTime = 0;

    int curBtn1 = digitalRead(PIN_BUTTON_1);
    int curBtn2 = digitalRead(PIN_BUTTON_2);

    bool btn1Pressed = (lastBtn1 == HIGH && curBtn1 == LOW);
    bool btn2Pressed = (lastBtn2 == HIGH && curBtn2 == LOW);

    if (btn1Pressed && (currentMillis - lastPressTime > 250)) {
        lastPressTime = currentMillis;
        activePage = (activePage % TOTAL_PAGES) + 1; // Forward
        drawOledPage();
        Serial.printf("[BUTTON] Forward to Page %d\n", activePage);
    } else if (btn2Pressed && (currentMillis - lastPressTime > 250)) {
        lastPressTime = currentMillis;
        activePage = activePage - 1; // Backward
        if (activePage < 1) activePage = TOTAL_PAGES;
        drawOledPage();
        Serial.printf("[BUTTON] Backward to Page %d\n", activePage);
    }
    lastBtn1 = curBtn1;
    lastBtn2 = curBtn2;

    // 2. 3-Wi-Fi Network Auto-Failover Retry Loop (Clean WiFi.disconnect to prevent driver log errors)
    if (!wifiConnected) {
        if (currentMillis - lastWifiRetryTime >= 5000) {
            lastWifiRetryTime = currentMillis;
            
            // Cleanly reset Wi-Fi driver state before trying next slot
            WiFi.disconnect(true, true);
            delay(100);
            WiFi.mode(WIFI_STA);
            delay(100);
            mdnsResolved = false;

            for (int attempts = 0; attempts < KNOWN_WIFI_COUNT; attempts++) {
                currentWifiSlot = (currentWifiSlot + 1) % KNOWN_WIFI_COUNT;
                if (String(KNOWN_WIFI_NETWORKS[currentWifiSlot].ssid).length() > 0) {
                    Serial.printf("[WiFi Failover] Retrying Slot %d: '%s'...\n", currentWifiSlot + 1, KNOWN_WIFI_NETWORKS[currentWifiSlot].ssid);
                    WiFi.mode(WIFI_STA);
                    WiFi.setTxPower(WIFI_POWER_8_5dBm); // Reduce Wi-Fi power to prevent Brownout Resets when Bluetooth spikes!
                    WiFi.begin(KNOWN_WIFI_NETWORKS[currentWifiSlot].ssid, KNOWN_WIFI_NETWORKS[currentWifiSlot].password);
                    break;
                }
            }
        }
    }

    // 3. Process Bluetooth Terminal Commands
#if ENABLE_BLUETOOTH
    if (btConnected && SerialBT.available()) {
        String btCommand = SerialBT.readStringUntil('\n');
        btCommand.trim();
        Serial.printf("[Bluetooth] Received: %s\n", btCommand.c_str());

        if (btCommand.startsWith("WIFI:")) {
            String credentials = btCommand.substring(5);
            int commaIndex = credentials.indexOf(',');
            if (commaIndex > 0) {
                String newSSID = credentials.substring(0, commaIndex);
                String newPASS = credentials.substring(commaIndex + 1);

                SerialBT.println(F("🌐 Session Wi-Fi Credentials Received (Not saved permanently)!"));
                SerialBT.print(F("SSID: ")); SerialBT.println(newSSID);
                SerialBT.println(F("🔄 Connecting now..."));
                
                WiFi.disconnect(true, true);
                delay(100);
                WiFi.mode(WIFI_STA);
                WiFi.setTxPower(WIFI_POWER_8_5dBm);
                WiFi.begin(newSSID.c_str(), newPASS.c_str());
            } else {
                SerialBT.println(F("⚠️ Format to connect for this session: WIFI:YourSSID,YourPassword"));
            }
        } else {
            SerialBT.print(F("✅ [AgriShield] Command Processed: "));
            SerialBT.println(btCommand);
            SerialBT.print(F("Temp: ")); if (ahtValid || dhtValid) SerialBT.print(temperature, 1); else SerialBT.print(F("--")); SerialBT.print(F(" C | "));
            SerialBT.print(F("Humid: ")); if (ahtValid || dhtValid) SerialBT.print(humidity, 1); else SerialBT.print(F("--")); SerialBT.print(F(" %RH | "));
            SerialBT.print(F("Light: ")); if (bh1750Valid && lightLux >= 0) SerialBT.print(lightLux); else SerialBT.print(F("--")); SerialBT.print(F(" Lux | "));
            SerialBT.print(F("Batt: ")); if (batteryValid) SerialBT.print(batteryPercent); else SerialBT.print(F("--")); SerialBT.println(F("%"));
        }
    }
#endif

    // 4. OLED Redraw (Every 200ms)
    if (currentMillis - lastDisplayUpdate >= 200) {
        lastDisplayUpdate = currentMillis;
        drawOledPage();
    }

    // 5. Read Sensors & Transmit Telemetry over USB Serial & Bluetooth & SD Card Logging (Every 60 seconds)
    if (currentMillis - lastTelemetryUpload >= 60000) {
        lastTelemetryUpload = currentMillis;
        readAllSensors();

        String jsonPayload = String("{\"device_id\":\"ESP32-NODE-ALPHA\",\"temperature\":") +
                             (ahtValid || dhtValid ? String(temperature, 1) : String("null")) +
                             String(",\"humidity\":") + (ahtValid || dhtValid ? String(humidity, 1) : String("null")) +
                             String(",\"pressure\":") + (bmp280Valid ? String(pressurehPa, 1) : String("null")) +
                             String(",\"soil_moisture\":") + (soilValid ? String(soilMoisture, 1) : String("null")) +
                             String(",\"rain_detected\":") + (rainValid ? (isRaining ? String("true") : String("false")) : String("false")) +
                             String(",\"light_lux\":") + (bh1750Valid && lightLux >= 0 ? String(lightLux) : String("null")) +
                             String(",\"battery_percentage\":") + (batteryValid ? String(batteryPercent) : String("null")) +
                             String(",\"sd_card_status\":") + (sdMounted ? String("\"mounted\"") : String("\"unmounted\"")) +
                             String(",\"sd_total_mb\":") + (sdMounted ? String((unsigned long)sdCardSizeMB) : String("0")) +
                             String(",\"sd_used_mb\":") + (sdMounted ? String((unsigned long)(SD.usedBytes() / (1024 * 1024))) : String("0")) +
                             String(",\"bluetooth_connected\":") + (btConnected ? String("true") : String("false")) +
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

#if ENABLE_BLUETOOTH
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
            SerialBT.flush(); // Force the Bluetooth TX buffer to completely empty over the air
            delay(250);       // Wait 250ms for the 2.4GHz antenna multiplexer to clear before Wi-Fi takes over!
        }
#endif

        if (wifiConnected) {
            if (!mdnsResolved) {
                IPAddress backend_ip = MDNS.queryHost(MDNS_HOSTNAME);
                if (backend_ip != INADDR_NONE) {
                    currentApiBaseUrl = "http://" + backend_ip.toString() + ":8000/api/v1";
                    mdnsResolved = true;
                    Serial.println("✅ mDNS Resolved API URL: " + currentApiBaseUrl);
                }
            }

            HTTPClient http;
            String fullApiUrl = currentApiBaseUrl + "/iot/telemetry";
            http.begin(fullApiUrl);
            http.setTimeout(1000); // ⚡ FIX: Stop the ESP32 from freezing for 5 seconds if backend is unreachable!
            http.setReuse(false); // Disable Keep-Alive socket reuse
            http.addHeader("Content-Type", "application/json");
            http.addHeader("Connection", "close"); // Force Uvicorn to close socket cleanly
            int httpResponseCode = http.POST(jsonPayload);
            if (httpResponseCode > 0) {
                if (httpResponseCode == 200 || httpResponseCode == 201) {
                    Serial.printf("📡 HTTP POST Success! Code: %d\n", httpResponseCode);
                } else {
                    Serial.printf("⚠️ HTTP POST Failed! Code: %d\n", httpResponseCode);
                    Serial.println(http.getString());
                }
            } else {
                Serial.printf("⚠️ HTTP POST Failed! Error: %s\n", http.errorToString(httpResponseCode).c_str());
            }
            http.end(); // CRITICAL: Free resources immediately to avoid Heap exhaustion
        }
    }
}
