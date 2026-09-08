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
#include "ApiManager.h"
#include "TimeManager.h"
#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_bt.h>
#include <esp_adc_cal.h>
#include <driver/rtc_io.h>
#include <HTTPClient.h>
// 🔵 Bluetooth Master Toggle (Set to 'true' to enable, 'false' to disable and save RAM/Power)
#define ENABLE_BLUETOOTH false

#include <time.h>
#if ENABLE_BLUETOOTH
#include <BluetoothSerial.h>
#endif
#include <nvs_flash.h> // Required to permanently save Bluetooth pairing keys!

// Web OTA Libraries
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Update.h>

#define IOT_API_KEY "crop_iot_secure_key_2026"
WebServer server(80);

TaskHandle_t webServerTask;
void webServerTaskCode(void * pvParameters) {
    for(;;) {
        server.handleClient();
        vTaskDelay(10 / portTICK_PERIOD_MS); // Yield 10ms to watchdog
    }
}


bool isAuthorized() {
    server.enableCORS(true);
    return true;
}

// Webpage for OTA Upload (Hardcoded HTML String)

#include <DNSServer.h>
#include <Preferences.h>

DNSServer dnsServer;
Preferences preferences;

bool setupMode = false;
String savedSSID = "";
String savedPass = "";
String savedApiUrl = "";
unsigned long uploadIntervalMs = 60000;
float tempOffset = 0.0;
bool offlineMode = false;
String deviceId = "ESP32-NODE-ALPHA";
int screenTimeoutSec = 30; // 0 means always on
int sleepIntervalMin = 10; // Default autonomous sleep duration
int daySleepIntervalMin = 0; // 0 = stay awake continuously during the day
bool screenIsOn = true;
bool nightSleepCycle = false; // True when woken from autonomous night sleep timer
bool buttonWakeup = false;    // True when user pressed Button 1 during deep sleep
bool hasUploadedTelemetry = false; // Guarantees one upload before sleeping
bool isSyncingOfflineQueue = false; // 🔒 SLEEP GUARD: True while bulk offline sync is running → blocks deep sleep
bool manualScreenOff = false; // Prevents auto-wakeup if turned off via cloud

int activeAnimation = 0;
unsigned long animStartTime = 0;
const unsigned long ANIM_DURATION = 6000;
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

const char* captivePortalHtml = 
"<!DOCTYPE html><html lang='en'><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
"<title>AgriShield Control Panel</title><style>"
"*{box-sizing:border-box;margin:0;padding:0}"
"body{font-family:'Segoe UI',sans-serif;background:#0a0f1e;color:#e2e8f0;min-height:100vh;padding:16px}"
"h1{text-align:center;color:#10b981;font-size:22px;font-weight:900;margin:16px 0 4px}"
".sub{text-align:center;color:#475569;font-size:12px;margin-bottom:18px}"
".sec{background:#1e293b;border-radius:14px;padding:18px;margin-bottom:14px;border-left:4px solid #10b981}"
".sec.bl{border-left-color:#3b82f6}.sec.am{border-left-color:#f59e0b}.sec.pu{border-left-color:#a855f7}.sec.cy{border-left-color:#06b6d4}"
"h3{font-size:13px;font-weight:800;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8}"
"input[type='text'], input[type='password'], input[type='number'], input[type='date'], input[type='time'], select{width:100%;padding:10px 12px;margin:4px 0 10px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#fff;font-size:15px;outline:none}"
"input:focus, select:focus{border-color:#10b981}"
"label{font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;display:block;margin-top:8px}"
".btn{display:block;width:100%;padding:12px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;margin-top:6px;text-decoration:none;text-align:center}"
".g{background:#10b981;color:#fff}.b{background:#3b82f6;color:#fff}.r{background:#f43f5e;color:#fff}.dk{background:#1e3a5f;color:#60a5fa}"
".grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}"
".grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:6px}"
".sb{padding:10px 4px;border:none;border-radius:8px;cursor:pointer;font-size:20px}"
".toast{display:none;position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 22px;border-radius:10px;font-weight:700;z-index:999}"
".live{background:#000;border:2px solid #334155;border-radius:8px;padding:12px;font-family:monospace;color:#10b981;font-size:14px}"
".lv{color:#fff;float:right}"
".chk-row{display:flex;align-items:center;margin:12px 0;background:#0f172a;padding:10px;border-radius:8px;border:1px solid #334155;}"
".chk-row input{width:auto;margin:0 12px 0 0;transform:scale(1.4)}"
".chk-row label{margin:0;font-size:14px;color:#fff;text-transform:none}"
"</style></head><body>"
"<div class='toast' id='toast'>Done!</div>"
"<h1>&#127807; AgriShield</h1>"
"<p class='sub'>ESP32 Field Node &mdash; Control Panel</p>"
"<div class='sec cy'>"
"<h3>&#128250; Live Screen Monitor</h3>"
"<div class='live' id='screen_box' style='min-height:100px;display:flex;flex-direction:column;justify-content:center;align-items:center;'>"
"<span style='color:#666'>Connecting...</span>"
"</div>"
"</div>"
"</div>"

"<div class='sec am'>"
"<h3>&#128444; Display Controls</h3>"
"<div class='grid2'>"
"<button class='sb g' style='width:100%' onclick=\"cmd('/screen-on','Screen ON')\">&#128161; On</button>"
"<button class='sb dk' style='width:100%' onclick=\"cmd('/screen-off','Screen OFF')\">&#127761; Off</button>"
"</div>"
"<div class='grid2' style='margin-top:8px'>"
"<button class='btn b' onclick=\"cmd('/page-prev','Page Back')\">&#9664; Back</button>"
"<button class='btn b' onclick=\"cmd('/page-next','Page Fwd')\">Fwd &#9654;</button>"
"</div>"
"<button class='btn r' style='margin-top:8px' onclick=\"cmd('/reset','Rebooting...')\">&#128260; Reset Device</button>"
"</div>"

"<div class='sec pu'>"
"<h3>&#127774; Weather Animations</h3>"
"<div class='grid4'>"
"<button class='sb' style='background:#1e3a8a;color:#93c5fd;width:100%' onclick=\"cmd('/anim-rain','Rain')\">&#127783;</button>"
"<button class='sb' style='background:#78350f;color:#fbbf24;width:100%' onclick=\"cmd('/anim-hot','Hot')\">&#9728;</button>"
"<button class='sb' style='background:#7c2d12;color:#fb923c;width:100%' onclick=\"cmd('/anim-sunrise','Sunrise')\">&#127749;</button>"
"<button class='sb' style='background:#2e1065;color:#c084fc;width:100%' onclick=\"cmd('/anim-sunset','Sunset')\">&#127747;</button>"
"<button class='sb' style='background:#14532d;color:#86efac;width:100%' onclick=\"cmd('/anim-grow','Grow')\">&#127809;</button>"
"<button class='sb' style='background:#164e63;color:#67e8f9;width:100%' onclick=\"cmd('/anim-water','Water')\">&#128167;</button>"
"<button class='sb' style='background:#0f172a;color:#cbd5e1;width:100%' onclick=\"cmd('/anim-night','Night')\">&#127769;</button>"
"<button class='sb' style='background:#374151;color:#94a3b8;width:100%' onclick=\"cmd('/anim-sync','Sync')\">&#128225;</button>"
"</div></div>"

"<form action='/save-id' method='POST'>"
"<div class='sec'>"
"<h3>&#128225; Device Identity</h3>"
"<label>Node ID (Device Name)</label><input type='text' name='device' placeholder='e.g. Tomato-Field-1' value='{DEVICE_ID}'>"
"<button class='btn b' type='submit' style='margin-top:16px'>&#128190; Save Device Identity</button>"
"</div>"
"</form>"

"<form action='/save-node' method='POST'>"
"<div class='sec'>"
"<h3>&#128161; Wi-Fi Connection</h3>"
"<label>Wi-Fi Name (SSID)</label><input type='text' name='ssid' placeholder='Your Wi-Fi name' value='{SSID}'>"
"<label>Wi-Fi Password</label><input type='password' name='pass' placeholder='Wi-Fi password' value='{PASS}'>"
"<label>PC API URL (optional)</label><input type='text' name='api' placeholder='Leave blank to auto-discover' value='{API}'>"
"<button class='btn g' type='submit' style='margin-top:16px'>&#128190; Save Wi-Fi Settings</button>"
"</div>"
"</form>"

"<form action='/save-adv' method='POST'>"
"<div class='sec am'>"
"<h3>&#128736;&#65039; Hardware Controls</h3>"
"<div class='grid2'>"
"<button class='btn r' type='button' onclick=\"cmd('/api/shutdown','Shutting Down')\">&#128128; Complete Shutdown</button>"
"<button class='btn b' type='button' onclick=\"cmd('/api/strict_offline','Strict Offline')\">&#128246; Strict Offline</button>"
"</div>"
"<label style='margin-top:12px;'>Screen Timeout (Minutes &amp; Seconds)</label>"
"<div class='grid2'>"
"<input type='number' name='min' placeholder='Min' min='0' value='{T_MIN}'>"
"<input type='number' name='sec' placeholder='Sec' min='0' max='59' value='{T_SEC}'>"
"</div>"
"<label style='margin-top:12px;'>Night Sleep Interval (Minutes)</label>"
"<input type='number' name='sleepInt' placeholder='Default 10 mins' min='1' max='1440' value='{S_INT}'>"
"<label style='margin-top:12px;'>Day Sleep Interval (Minutes)</label>"
"<input type='number' name='daySleepInt' placeholder='0 to disable' min='0' max='1440' value='{DS_INT}'>"
"<label>Data Upload Interval</label>"
"<select name='interval'>"
"<option value='15000' {INT_15}>15 Seconds (Rapid)</option>"
"<option value='30000' {INT_30}>30 Seconds</option>"
"<option value='60000' {INT_60}>1 Minute</option>"
"<option value='300000' {INT_300}>5 Minutes</option>"
"<option value='900000' {INT_900}>15 Minutes (Battery Saver)</option>"
"<option value='3600000' {INT_3600}>1 Hour (Ultra Saver)</option>"
"</select>"
"<label>Temp Calibration Offset (&deg;C)</label>"
"<input type='number' name='tempOff' step='0.1' placeholder='e.g. -1.5 or 2.0' value='{TEMP_OFF}'>"
"<button class='btn b' type='submit' style='margin-top:16px'>&#9881;&#65039; Save Hardware Settings</button>"
"</div>"
"</form>"

"<div class='sec bl'>"
"<h3>&#128190; SD Card Management</h3>"
"<a href='/download-logs' class='btn dk' target='_blank'>&#128466;&#65039; Download SD Logs</a>"
"</div>"

"<div class='sec'>"
"<h3>&#128336; Manual Time &amp; Date</h3>"
"<label>Date</label><input type='date' id='md'>"
"<label>Time</label><input type='time' id='mt' step='1'>"
"<button class='btn b' onclick='setT()'>&#9201; Set Time on Device</button>"
"</div>"
"</div>"

"<script>"
"var now=new Date();"
"document.getElementById('md').value=now.toISOString().slice(0,10);"
"document.getElementById('mt').value=[now.getHours(),now.getMinutes(),now.getSeconds()].map(function(n){return String(n).padStart(2,'0')}).join(':');"
"function show(m){var t=document.getElementById('toast');t.innerText=m;t.style.display='block';setTimeout(function(){t.style.display='none'},2000)}"
"function cmd(u,m){fetch(u).then(function(){show(m+' OK')}).catch(function(){show('Sent!')})}"
"function setT(){"
"var d=document.getElementById('md').value;"
"var t=document.getElementById('mt').value;"
"if(!d||!t){alert('Pick date and time first!');return;}"
"fetch('/settime?d='+encodeURIComponent(d)+'&t='+encodeURIComponent(t)).then(function(){show('Time Set!')})"
"}"
"setInterval(function(){"
"fetch('/status').then(r=>r.json()).then(d=>{"
"var b=document.getElementById('screen_box');"
"if(d.a>0){"
"var an=['','Rain Warn','Hot Warn','Sunrise','Sunset','Growing','Watering','Night Mode','Syncing'];"
"b.innerHTML='<div style=\"font-family:monospace;font-size:16px;line-height:1.5;color:#fff;background:#000;padding:10px;border-radius:4px;text-align:center;width:100%;max-width:200px;margin:0 auto;margin-top:20px;\"><br>'+(an[d.a]||'ANIMATION')+'<br><br></div>';"
"}else{"
"var h='';"
"if(d.p==1) h='Temp  : '+d.t+' C<br>Humid : '+d.h+' %RH<br>Light : '+d.l+' Lux';"
"else if(d.p==2) h='Soil  : '+d.sm+' %<br>Rain  : '+(d.rn?'YES':'NO')+'<br>Press : '+d.pr+' hPa';"
"else if(d.p==3) h='Batt  : '+d.bp+' %<br>Volt  : '+d.bv+' V<br>State : '+(d.l<10?'Night':'Day');"
"else if(d.p==4) h='WiFi  : '+d.wf+'<br>BT    : '+d.bt+'<br>Node  : AgriShield_01';"
"else if(d.p==5) h='SD Card Module:<br>Status: '+d.sd+'<br>Size  : '+d.sz+' MB';"
"else h='PAGE '+d.p;"
"h += '<br>Screen On: '+d.sc+'s';"
"b.innerHTML='<div style=\"font-family:monospace;font-size:16px;line-height:1.5;color:#fff;background:#000;padding:10px;border-radius:4px;text-align:left;width:100%;max-width:200px;margin:0 auto;\">'+h+'</div>';"
"}"
"})}, 1500);"
"</script></body></html>";

String getCaptivePortalHtml() {
    String html = String(captivePortalHtml);
    html.replace("{DEVICE_ID}", deviceId);
    html.replace("{SSID}", savedSSID);
    html.replace("{PASS}", savedPass);
    html.replace("{API}", savedApiUrl);
    html.replace("{T_MIN}", String(screenTimeoutSec / 60));
    html.replace("{T_SEC}", String(screenTimeoutSec % 60));
    html.replace("{S_INT}", String(sleepIntervalMin));
    html.replace("{DS_INT}", String(daySleepIntervalMin));
    
    html.replace("{INT_15}", uploadIntervalMs == 15000 ? "selected" : "");
    html.replace("{INT_30}", uploadIntervalMs == 30000 ? "selected" : "");
    html.replace("{INT_60}", uploadIntervalMs == 60000 ? "selected" : "");
    html.replace("{INT_300}", uploadIntervalMs == 300000 ? "selected" : "");
    html.replace("{INT_900}", uploadIntervalMs == 900000 ? "selected" : "");
    html.replace("{INT_3600}", uploadIntervalMs == 3600000 ? "selected" : "");
    
    html.replace("{TEMP_OFF}", String(tempOffset, 1));
    return html;
}

// ---------------------------------------------------------------------------------
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
// Now that eFuse calibration is integrated, this acts as a fine-tuning factor (default is 1.0).
#define BATT_CALIBRATION_MULTIPLIER 1.0 

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
#define SD_CS 15
bool sdMounted = false;
uint64_t sdCardSizeMB = 0;
double sdUsedMB = 0.0;            // ⚡ Cached SD used space (avoids blocking SD.usedBytes() every reading)
static uint8_t sdUsedMbRefreshCounter = 0; // Refresh every 10 live uploads
bool isNightMode = false;              // Global: true when device is in autonomous night mode

// I2C Sensor Instances (AHT20 + BMP280 Combo Module + BH1750)
BH1750 lightMeter;
Adafruit_BMP280 bmp;
Adafruit_AHTX0 aht;

// Backup DHT Pin Configuration (Dedicated GPIO 0)
#define DHTPIN 0
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Push Button Dual Mapping (Supports GPIO 26 & GPIO 27)
#define PIN_BUTTON_1  26  // MOVED FROM 25 TO 26
#define PIN_BUTTON_2  27  // MOVED FROM 14 TO 27 TO PREVENT SD CARD SPI CLOCK GLITCHES!

// ⚡ Hardware Interrupts for Buttons (Prevents missed taps during Wi-Fi blocking)
volatile bool flagBtn1QuickTap = false;
volatile bool flagBtn2QuickTap = false;
volatile unsigned long lastBtn1IsrTime = 0;
volatile unsigned long lastBtn2IsrTime = 0;

void IRAM_ATTR isrBtn1() {
    if (millis() - lastBtn1IsrTime > 200) {
        flagBtn1QuickTap = true;
        lastBtn1IsrTime = millis();
    }
}

void IRAM_ATTR isrBtn2() {
    if (millis() - lastBtn2IsrTime > 200) {
        flagBtn2QuickTap = true;
        lastBtn2IsrTime = millis();
    }
}

#define PIN_CHARGE    33  // USB Charger STAT pin

// 6 Status LEDs (100% Safe GPIOs - Zero Strapping/SPI Conflicts!)
#define LED_HEARTBEAT   16  // Green LED (Power Heartbeat - GPIO 16)
#define PIN_SENSOR_POWER 4  // Power Control Pin for VCC of AHT20, BH1750, BMP280, DHT22, Soil & Rain (GPIO 4)

// Analog Sensor Inputs (ADC1_CH4, ADC1_CH6, ADC1_CH7)
#define PIN_SOIL_ANALOG 34  // Soil Moisture Analog (ADC1_CH6)
#define PIN_RAIN_ANALOG 35  // Rain Sensor Analog (ADC1_CH7)
#define PIN_RAIN_DIGITAL 39 // Rain Sensor Digital Out (EXT0 Wakeup)
#define PIN_BATT_ANALOG 32  // 4000mAh Battery Voltage Sensor Module (ADC1_CH4)

RTC_DATA_ATTR int bootCount = 0; // Tracks reboots from Deep Sleep
RTC_DATA_ATTR uint32_t rtcEpoch = 0; // Persists accurate offline UNIX time across Deep Sleep in RTC RAM
RTC_DATA_ATTR uint32_t lastSleepSec = 0; // Duration of previous sleep cycle in seconds
RTC_DATA_ATTR float rtcSleepTemp = 25.0f; // Stores pre-sleep temperature for offline clock correction

// Calibration Constants (Calibrated for Dry Air & High-Sensitivity LM393 Modules)
const int SOIL_DRY_ADC = 3550; // Dry air / dry bed threshold (Shows 0%)
const int SOIL_WET_ADC = 1300; // Submerged in wet soil / water (Shows 100%)
const int RAIN_DRY_ADC = 2300; // Dry plate threshold (ADC 2300 - 4095 = DRY)
const int RAIN_WET_ADC = 800;  // Rain droplets on plate (ADC < 1800 = RAIN)

// Global System Variables
int activePage = 1;
const int TOTAL_PAGES = 5;
unsigned long lastDisplayUpdate = 0;
unsigned long lastScreenActiveTime = 0;
unsigned long lastTelemetryUpload = 0;
unsigned long lastWifiRetryTime = 0;
unsigned long wifiDisconnectTimer = 0;
int currentWifiSlot = 0;

// Real Sensor Variables (Initialized to -999 for unconnected detection)
float temperature = -999.0;
float humidity = -999.0;
float vpd = -1.0;
float pressurehPa = -999.0;
float altitudeMeters = -999.0;
float soilMoisture = -999.0;
int lightLux = -1;
int rainPercent = -1;
bool isRaining = false;
String rainIntensity = "--";
float batteryVoltage = -1.0;
int batteryPercent = -1;
bool isCharging = false;
esp_adc_cal_characteristics_t adc_chars;

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
    // digitalWrite(LED_HEARTBEAT, heartbeatPulse ? HIGH : LOW);

    // Track Wi-Fi State & Initialize NTP
    bool wasConnected = wifiConnected;
    wifiConnected = (WiFi.status() == WL_CONNECTED);
    if (wifiConnected && !sntpInitialized) {
        configTime(gmtOffset_sec, daylightOffset_sec, "pool.ntp.org", "time.nist.gov", "time.google.com");
        sntpInitialized = true;
        Serial.println(F("[NTP] SNTP Time Sync Started..."));
    }

    // Track Bluetooth State
    btConnected = false;
#if ENABLE_BLUETOOTH
    btConnected = SerialBT.hasClient();
#endif
}

void readBattery() {
    long rawBattSum = 0;
    for (int i = 0; i < 20; i++) {
        rawBattSum += analogRead(PIN_BATT_ANALOG);
        delay(2);
    }
    int rawBatt = rawBattSum / 20;
    if (rawBatt > 150) {
        // Use factory eFuse calibration for highly accurate, noise-immune voltage reads
        uint32_t pinMv = esp_adc_cal_raw_to_voltage(rawBatt, &adc_chars);
        float newVoltage = (pinMv / 1000.0) * 5.0 * BATT_CALIBRATION_MULTIPLIER; 
        
        // Software Smoothing (EMA Filter) to ignore Wi-Fi power spikes
        if (batteryVoltage <= 0.0) {
            batteryVoltage = newVoltage; // First reading, trust it 100%
        } else {
            batteryVoltage = (batteryVoltage * 0.90) + (newVoltage * 0.10);
        }
        batteryPercent = constrain(map(batteryVoltage * 100, 320, 405, 0, 100), 0, 100);
        batteryValid = true;
    } else {
        batteryValid = false;
        batteryPercent = -1;
    }
    isCharging = (digitalRead(PIN_CHARGE) == LOW);
}

// ⚡ Low-Power Delay (Uses standard safe FreeRTOS task delay to feed watchdogs)
void lowPowerDelay(uint32_t ms) {
    delay(ms);
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
            // Calculate VPD (Vapor Pressure Deficit)
            float svp = 0.61078 * exp((17.27 * temperature) / (temperature + 237.3));
            float avp = svp * (humidity / 100.0);
            vpd = svp - avp;
        }
    } else if (dhtValid) {
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t) && !isnan(h) && t > -40.0 && t < 85.0) {
            temperature = t;
            humidity = h;
            float svp = 0.61078 * exp((17.27 * temperature) / (temperature + 237.3));
            float avp = svp * (humidity / 100.0);
            vpd = svp - avp;
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
    if (rawSoil > 200 && rawSoil < 4095) {
        if (rawSoil >= 2850) {
            soilMoisture = 0.0; // Completely dry in air / dry cloth
        } else {
            soilMoisture = map(constrain(rawSoil, SOIL_WET_ADC, 2850), 2850, SOIL_WET_ADC, 0, 100);
        }
        soilValid = true;
    } else {
        soilValid = false;
    }

    yield();

    // 5. Rain Sensor (GPIO 35)
    int rawRain = analogRead(PIN_RAIN_ANALOG);
    if (rawRain > 50) {
        if (rawRain >= RAIN_DRY_ADC) {
            rainPercent = 0;
            rainIntensity = "DRY";
            isRaining = false;
        } else {
            rainPercent = map(constrain(rawRain, RAIN_WET_ADC, RAIN_DRY_ADC), RAIN_DRY_ADC, RAIN_WET_ADC, 0, 100);
            
            // Intensity Classification
            if (rainPercent < 15) {
                rainIntensity = "DRY";
                isRaining = false;
            } else if (rainPercent < 35) {
                rainIntensity = "MIST";
                isRaining = true;
            } else if (rainPercent < 60) {
                rainIntensity = "LIGHT";
                isRaining = true;
            } else if (rainPercent < 80) {
                rainIntensity = "MEDIUM";
                isRaining = true;
            } else {
                rainIntensity = "HEAVY";
                isRaining = true;
            }
        }
        rainValid = true;
    } else {
        rainValid = false;
    }

    yield();

    // 6. Read battery voltage
    readBattery();

    // 🌡️ Update pre-sleep temperature tracking for drift compensation
    if (ahtValid || dhtValid) {
        rtcSleepTemp = temperature;
    }

    yield();
}

// ---------------------------------------------------------------------------------
// 👑 TOP HEADER BAR ([Time 12-hr & Date] -> Clean Gaps -> [BT] [Wi-Fi] [Battery])
// ---------------------------------------------------------------------------------
void drawHeaderBar() {
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);

    time_t now = time(nullptr);
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);

    if (timeinfo.tm_year > 100) { // Year > 2000 confirms valid RTC time exists
        int hour12 = timeinfo.tm_hour % 12;
        if (hour12 == 0) hour12 = 12;
        int mins = timeinfo.tm_min;
        int day = timeinfo.tm_mday;
        int month = timeinfo.tm_mon + 1;
        int year = timeinfo.tm_year + 1900;

        // Alternate between Time (12hr) and Date every 4 seconds
        if ((millis() / 4000) % 2 == 0) {
            // Show Time: 05:43 AM
            if (hour12 < 10) display.print(F("0"));
            display.print(hour12);
            display.print(F(":"));
            if (mins < 10) display.print(F("0"));
            display.print(mins);
            display.print(F(" "));
            if (timeinfo.tm_hour >= 12) display.print(F("PM"));
            else display.print(F("AM"));
        } else {
            // Show Date: 07/08/2026
            if (day < 10) display.print(F("0"));
            display.print(day);
            display.print(F("/"));
            if (month < 10) display.print(F("0"));
            display.print(month);
            display.print(F("/"));
            display.print(year);
        }
    } else {
        if (wifiConnected) display.print(F("Syncing..."));
        else display.print(F("AgriShield"));
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

void drawRainAnimation() {
    static unsigned long lastFrame = 0;
    static int dropY[8] = {0, -5, -15, -20, -30, -35, -45, -50};
    static int dropX[8] = {30, 45, 60, 75, 90, 40, 55, 70};
    static int lightningFlash = 0;
    
    if (millis() - lastFrame < 60) return;
    lastFrame = millis();
    
    for (int i=0; i<8; i++) {
        dropY[i] += 6;
        if (dropY[i] > 64) dropY[i] = -10;
        dropX[i] -= 1; // Wind effect
        if (dropX[i] < 20) dropX[i] = 100;
    }
    
    if (random(0, 20) == 0) lightningFlash = 3;
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(35, 0);
    if (rainValid && isRaining) {
        if (rainIntensity == "MIST") display.print(F("Mist"));
        else if (rainIntensity == "LIGHT") display.print(F("Light Rain"));
        else display.print(F("Heavy Rain"));
    } else {
        display.print(F("Heavy Rain")); // Default for manual web button
    }
    
    // Draw thick storm cloud
    display.fillCircle(50, 20, 12, SH110X_WHITE);
    display.fillCircle(65, 16, 14, SH110X_WHITE);
    display.fillCircle(80, 20, 10, SH110X_WHITE);
    display.fillRoundRect(40, 16, 50, 16, 8, SH110X_WHITE);
    
    // Lightning
    if (lightningFlash > 0) {
        display.fillTriangle(60, 30, 55, 45, 65, 40, SH110X_WHITE);
        display.fillTriangle(62, 42, 50, 60, 68, 48, SH110X_WHITE);
        display.invertDisplay(true); // Flash screen
        lightningFlash--;
    } else {
        display.invertDisplay(false);
    }
    
    // Draw slanted drops
    for (int i=0; i<8; i++) {
        if (dropY[i] > 30) {
            display.drawLine(dropX[i], dropY[i], dropX[i]-2, dropY[i]+4, SH110X_WHITE);
        }
    }
    display.display();
}

void drawHotAnimation() {
    static unsigned long lastFrame = 0;
    static int sunRadius = 14;
    static bool growing = true;
    static int waveOffset = 0;
    
    if (millis() - lastFrame < 80) return;
    lastFrame = millis();
    if (growing) { sunRadius++; if (sunRadius > 17) growing = false; }
    else { sunRadius--; if (sunRadius < 14) growing = true; }
    
    waveOffset += 2;
    if (waveOffset > 20) waveOffset = 0;
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(30, 0);
    display.print(F("Extreme Heat"));
    
    // Draw pulsing sun in center
    display.fillCircle(64, 30, sunRadius, SH110X_WHITE);
    
    // Draw sharp rays
    for (int i=0; i<8; i++) {
        float angle = i * 45 * (3.14159 / 180.0) + (waveOffset * 0.05);
        int x1 = 64 + (sunRadius + 4) * cos(angle);
        int y1 = 30 + (sunRadius + 4) * sin(angle);
        int x2 = 64 + (sunRadius + 12) * cos(angle);
        int y2 = 30 + (sunRadius + 12) * sin(angle);
        display.drawLine(x1, y1, x2, y2, SH110X_WHITE);
    }
    
    // Thermometer graphic on left
    display.drawRoundRect(5, 15, 8, 35, 4, SH110X_WHITE);
    display.fillCircle(9, 52, 6, SH110X_WHITE); // Bulb
    int mercuryHeight = 10 + (sunRadius - 14) * 2;
    display.fillRect(7, 45 - mercuryHeight, 4, mercuryHeight + 5, SH110X_WHITE); // Mercury
    
    // Heat waves at bottom
    for(int x = 20; x < 110; x+=5) {
        int y = 58 + sin((x + waveOffset) * 0.2) * 3;
        display.drawPixel(x, y, SH110X_WHITE);
        display.drawPixel(x, y+1, SH110X_WHITE);
    }
    
    display.display();
}

void drawSunriseAnimation() {
    static unsigned long lastFrame = 0;
    static int sunY = 70;
    static int birdX = 0;
    
    if (millis() - lastFrame < 100) return;
    lastFrame = millis();
    sunY -= 1;
    if (sunY < 25) sunY = 25; // Stop rising
    
    birdX += 2;
    if (birdX > 128) birdX = -10;
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(40, 0);
    display.print(F("Sunrise"));
    
    // Draw rising sun
    display.fillCircle(64, sunY, 15, SH110X_WHITE);
    
    // Draw mountains blocking the bottom of the sun
    display.fillTriangle(0, 64, 30, 35, 60, 64, SH110X_BLACK); // Black mask
    display.drawTriangle(0, 64, 30, 35, 60, 64, SH110X_WHITE); // Outline
    
    display.fillTriangle(40, 64, 80, 25, 128, 64, SH110X_BLACK);
    display.drawTriangle(40, 64, 80, 25, 128, 64, SH110X_WHITE);
    
    // Draw birds
    if (sunY < 40) {
        display.drawLine(birdX, 20, birdX+3, 17, SH110X_WHITE);
        display.drawLine(birdX+3, 17, birdX+6, 20, SH110X_WHITE);
        
        display.drawLine(birdX-8, 25, birdX-5, 22, SH110X_WHITE);
        display.drawLine(birdX-5, 22, birdX-2, 25, SH110X_WHITE);
    }
    
    display.display();
}

void drawSunsetAnimation() {
    static unsigned long lastFrame = 0;
    static int sunY = 25;
    static int starAlpha = 0;
    
    if (millis() - lastFrame < 100) return;
    lastFrame = millis();
    sunY += 1;
    if (sunY > 70) sunY = 70; // Stop setting
    
    if (sunY > 40 && starAlpha < 100) starAlpha += 5;
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(45, 0);
    display.print(F("Sunset"));
    
    // Draw setting sun
    display.fillCircle(64, sunY, 15, SH110X_WHITE);
    
    // Draw ocean waves horizon
    display.fillRect(0, 50, 128, 14, SH110X_BLACK); // Mask below horizon
    for (int x = 0; x < 128; x+=8) {
        display.drawLine(x, 50, x+4, 48, SH110X_WHITE);
        display.drawLine(x+4, 48, x+8, 50, SH110X_WHITE);
        // Reflection on water
        if (sunY < 60 && x > 40 && x < 80) {
            if (random(0,2) == 0) display.drawLine(x+2, 53 + random(0,5), x+6, 53 + random(0,5), SH110X_WHITE);
        }
    }
    
    // Draw stars fading in
    if (starAlpha > 30) {
        if (random(0, 100) < starAlpha) display.drawPixel(20, 15, SH110X_WHITE);
        if (random(0, 100) < starAlpha) display.drawPixel(100, 20, SH110X_WHITE);
        if (random(0, 100) < starAlpha) display.drawPixel(40, 25, SH110X_WHITE);
        if (random(0, 100) < starAlpha) display.drawPixel(85, 10, SH110X_WHITE);
    }
    
    display.display();
}

void drawGrowAnimation() {
    static unsigned long lastFrame = 0;
    static int stage = 0;
    if (millis() - lastFrame < 50) return;
    lastFrame = millis();
    stage++;
    if (stage > 120) stage = 0;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(2, 0);
    display.print(F("GROWTH"));

    // Ground layer
    display.fillRect(0, 58, 128, 6, SH110X_WHITE);
    for(int i=0; i<128; i+=4) if(i%8!=0) display.drawPixel(i, 59, SH110X_BLACK);

    // Stem growth curve
    int maxStem = min(stage, 60);
    for (int i = 0; i < maxStem; i++) {
        int x = 64 + (int)(sin(i * 0.1) * 4.0);
        int y = 58 - i;
        display.drawPixel(x, y, SH110X_WHITE);
        display.drawPixel(x+1, y, SH110X_WHITE);
        if (i < 30) display.drawPixel(x-1, y, SH110X_WHITE); // Thicker base
    }

    // Leaves
    if (stage > 20) {
        int leaf1 = min(stage - 20, 15);
        int bx1 = 64 + (int)(sin(15 * 0.1) * 4.0);
        display.drawLine(bx1, 58-15, bx1 - leaf1, 58 - 15 - leaf1/2, SH110X_WHITE);
        display.drawLine(bx1, 58-16, bx1 - leaf1, 58 - 16 - leaf1/2, SH110X_WHITE);
    }
    if (stage > 35) {
        int leaf2 = min(stage - 35, 12);
        int bx2 = 64 + (int)(sin(30 * 0.1) * 4.0);
        display.drawLine(bx2, 58-30, bx2 + leaf2, 58 - 30 - leaf2/2, SH110X_WHITE);
        display.drawLine(bx2, 58-31, bx2 + leaf2, 58 - 31 - leaf2/2, SH110X_WHITE);
    }

    // Blooming Flower
    if (stage > 60) {
        int flowerSize = min(stage - 60, 20);
        int fx = 64 + (int)(sin(maxStem * 0.1) * 4.0);
        int fy = 58 - maxStem;
        
        // Petals
        for (int p = 0; p < 8; p++) {
            float angle = p * (3.14159f / 4.0f) + (stage * 0.05f); // Rotating petals
            int px = fx + (int)(cos(angle) * (flowerSize/2));
            int py = fy + (int)(sin(angle) * (flowerSize/2));
            display.drawLine(fx, fy, px, py, SH110X_WHITE);
            display.drawCircle(px, py, flowerSize/6, SH110X_WHITE);
        }
        // Center
        display.fillCircle(fx, fy, flowerSize/5, SH110X_BLACK);
        display.drawCircle(fx, fy, flowerSize/5, SH110X_WHITE);
    }
    
    // Sun rays in background
    if (stage > 10) {
        int rayPhase = stage % 20;
        display.drawCircle(110, 15, 6, SH110X_WHITE);
        for(int r=0; r<4; r++) {
            float ra = (r * 1.57f) + (rayPhase * 0.1f);
            display.drawLine(110 + cos(ra)*8, 15 + sin(ra)*8, 110 + cos(ra)*14, 15 + sin(ra)*14, SH110X_WHITE);
        }
    }
    
    display.display();
}

void drawWaterAnimation() {
    static unsigned long lastFrame = 0;
    static int dropY = -10;
    static int ripples[3] = {0, -15, -30}; // Ripple radii
    
    if (millis() - lastFrame < 40) return;
    lastFrame = millis();

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(2, 0);
    display.print(F("IRRIGATION"));

    // Draw Drop
    if (dropY < 48) {
        dropY += 6;
        // Droplet shape
        display.fillCircle(64, dropY, 3, SH110X_WHITE);
        display.fillTriangle(61, dropY, 67, dropY, 64, dropY-6, SH110X_WHITE);
    } else {
        dropY = -20; // Reset drop
    }

    // Ripples
    for (int i = 0; i < 3; i++) {
        ripples[i] += 2;
        if (ripples[i] > 40) ripples[i] = 0;
        if (ripples[i] > 0) {
            // Ellipse for 3D perspective ripple
            int rx = ripples[i] * 1.5;
            int ry = ripples[i] * 0.4;
            
            // Draw ellipse manually since Adafruit GFX doesn't have drawEllipse
            for(int a=0; a<360; a+=10) {
                float rad = a * 3.14159f / 180.0f;
                int x = 64 + rx * cos(rad);
                int y = 52 + ry * sin(rad);
                if (random(0,10) > 2) display.drawPixel(x, y, SH110X_WHITE); // Dashed ripple
            }
        }
    }
    
    // Background Sprinkler arc
    static int arcPhase = 0;
    arcPhase += 10;
    for (int i = 0; i < 15; i++) {
        float rrad = (180 + i*6) * 3.14159f / 180.0f;
        int px = 20 + 30 * cos(rrad);
        int py = 64 + 30 * sin(rrad) + (int)(sin((arcPhase+i*10)*0.1)*3.0);
        if(py < 64) display.drawPixel(px, py, SH110X_WHITE);
    }

    display.display();
}

void drawNightAnimation() {
    static unsigned long lastFrame = 0;
    static int starX = -20, starY = -20;
    if (millis() - lastFrame < 50) return;
    lastFrame = millis();

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(2, 0);
    display.print(F("NIGHT"));

    // Detailed Crescent Moon
    display.fillCircle(100, 24, 16, SH110X_WHITE);
    display.fillCircle(94, 20, 14, SH110X_BLACK); // Inner cutout
    // Moon craters
    display.drawCircle(106, 22, 2, SH110X_BLACK);
    display.drawCircle(110, 30, 3, SH110X_BLACK);
    display.drawPixel(102, 34, SH110X_BLACK);

    // Multi-layer Parallax Mountains
    // Back mountains
    display.fillTriangle(0, 64, 30, 35, 60, 64, SH110X_WHITE);
    display.fillTriangle(40, 64, 70, 40, 100, 64, SH110X_WHITE);
    display.fillTriangle(2, 65, 30, 38, 58, 65, SH110X_BLACK); // Hollow out
    display.fillTriangle(42, 65, 70, 43, 98, 65, SH110X_BLACK); // Hollow out
    
    // Front mountains
    display.fillTriangle(10, 64, 50, 45, 90, 64, SH110X_WHITE);
    display.fillTriangle(70, 64, 110, 30, 150, 64, SH110X_WHITE);
    
    // Twinkling stars
    for(int i=0; i<25; i++) {
        int x = (i * 47) % 128;
        int y = (i * 23) % 45;
        if (random(0, 100) > 10) {
            if (i % 3 == 0) {
                display.drawLine(x-1, y, x+1, y, SH110X_WHITE);
                display.drawLine(x, y-1, x, y+1, SH110X_WHITE);
            } else {
                display.drawPixel(x, y, SH110X_WHITE);
            }
        }
    }

    // Shooting star with trail
    if (starX < 0 && random(0, 30) == 1) {
        starX = random(40, 120);
        starY = random(0, 20);
    }
    if (starX >= 0) {
        display.drawLine(starX, starY, starX + 20, starY - 15, SH110X_WHITE);
        display.drawLine(starX+1, starY, starX + 15, starY - 10, SH110X_WHITE); // Thick head
        starX -= 6;
        starY += 4;
        if (starY > 64) starX = -20;
    }
    display.display();
}

void drawSyncAnimation() {
    static unsigned long lastFrame = 0;
    static float angleX = 0.0f, angleY = 0.0f, angleZ = 0.0f;
    if (millis() - lastFrame < 40) return;
    lastFrame = millis();
    
    angleX += 0.05f;
    angleY += 0.07f;
    angleZ += 0.03f;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(2, 0);
    display.print(F("SYNCING"));

    // 3D Cube Vertices
    float cube[8][3] = {
        {-1,-1,-1}, {1,-1,-1}, {1,1,-1}, {-1,1,-1},
        {-1,-1,1},  {1,-1,1},  {1,1,1},  {-1,1,1}
    };
    int edges[12][2] = {
        {0,1}, {1,2}, {2,3}, {3,0},
        {4,5}, {5,6}, {6,7}, {7,4},
        {0,4}, {1,5}, {2,6}, {3,7}
    };

    int proj2d[8][2];
    
    // Rotate and Project
    for (int i = 0; i < 8; i++) {
        float x = cube[i][0];
        float y = cube[i][1];
        float z = cube[i][2];

        // X rotation
        float xy = cos(angleX)*y - sin(angleX)*z;
        float xz = sin(angleX)*y + cos(angleX)*z;
        y = xy; z = xz;

        // Y rotation
        float yx = cos(angleY)*x + sin(angleY)*z;
        float yz = -sin(angleY)*x + cos(angleY)*z;
        x = yx; z = yz;

        // Z rotation
        float zx = cos(angleZ)*x - sin(angleZ)*y;
        float zy = sin(angleZ)*x + cos(angleZ)*y;
        x = zx; y = zy;

        // Orthographic projection scaled to screen
        proj2d[i][0] = 64 + (int)(x * 20);
        proj2d[i][1] = 36 + (int)(y * 20);
    }

    // Draw Cube Edges
    for (int i = 0; i < 12; i++) {
        display.drawLine(proj2d[edges[i][0]][0], proj2d[edges[i][0]][1],
                         proj2d[edges[i][1]][0], proj2d[edges[i][1]][1], SH110X_WHITE);
    }
    
    // Animated transmission waves
    static int wave = 0;
    wave++;
    if (wave > 20) wave = 0;
    display.drawCircle(64, 36, 30 + wave, SH110X_WHITE);
    
    // Data packets at bottom
    display.drawRect(10, 58, 108, 6, SH110X_WHITE);
    int pLen = (millis() / 20) % 108;
    display.fillRect(10, 58, pLen, 6, SH110X_WHITE);

    display.display();
}

void drawOledPage() {

    display.clearDisplay();

    if (activeAnimation > 0) {
        if (millis() - animStartTime > ANIM_DURATION) {
            activeAnimation = 0; // Animation finished
            
            // Fix Ghosting: Force complete I2C flush when switching from animation back to static pages
            display.clearDisplay();
            display.display(); 
        } else {
            switch(activeAnimation) {
                case 1: drawRainAnimation(); break;
                case 2: drawHotAnimation(); break;
                case 3: drawSunriseAnimation(); break;
                case 4: drawSunsetAnimation(); break;
                case 5: drawGrowAnimation(); break;
                case 6: drawWaterAnimation(); break;
                case 7: drawNightAnimation(); break;
                case 8: drawSyncAnimation(); break;
            }
            return; // EXIT EARLY SO WE DON'T DRAW THE NORMAL PAGE OVER IT
        }
    }

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

            display.setCursor(0, 28);
            display.print(F("Humid : "));
            if ((ahtValid || dhtValid) && humidity >= 0.0) {
                display.print(humidity, 1);
                display.print(F(" %RH"));
            } else {
                display.print(F("--"));
            }
            
            display.setCursor(0, 40);
            display.print(F("VPD   : "));
            if ((ahtValid || dhtValid) && vpd >= 0.0) {
                display.print(vpd, 2);
                display.print(F(" kPa"));
            } else {
                display.print(F("--"));
            }

            display.setCursor(0, 52);
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
                display.print(rainIntensity);
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

        case 5:
            display.setCursor(0, 16);
            display.print(F("SD Card Module:"));
            display.setCursor(0, 32);
            if (sdMounted) {
                display.print(F("Status: MOUNTED"));
                display.setCursor(0, 48);
                display.print(F("Size  : "));
                display.print((unsigned long)sdCardSizeMB);
                display.print(F(" MB"));
            } else {
                display.print(F("Status: ERROR"));
                display.setCursor(0, 48);
                display.print(F("Check CS 15 Pins"));
            }
            break;
    }

    display.display();
}

// ---------------------------------------------------------------------------------
// 🚀 ARDUINO SETUP
// ---------------------------------------------------------------------------------

void startCaptivePortal() {
    Serial.println(F("[WIFI] Starting AP + STA Mode for background scanning..."));
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("AgriShield-Setup");
    
    dnsServer.start(53, "*", WiFi.softAPIP());

    server.on("/", HTTP_GET, []() {
        server.send(200, "text/html", getCaptivePortalHtml());
    });

    server.on("/save-id", HTTP_POST, []() {
        String newDevice = server.arg("device");
        if (newDevice.length() > 0) preferences.putString("deviceId", newDevice);
        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/save-node", HTTP_POST, []() {
        String newSsid = server.arg("ssid");
        String newPass = server.arg("pass");
        String newApi = server.arg("api");

        if (newSsid.length() > 0) {
            preferences.putString("ssid", newSsid);
            preferences.putString("pass", newPass);
            if(newApi.length() > 0) preferences.putString("api", newApi);
        }
        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/save-adv", HTTP_POST, []() {
        String newMin = server.arg("min");
        String newSec = server.arg("sec");
        String newInterval = server.arg("interval");
        String newTempOff = server.arg("tempOff");
        String newSleepInt = server.arg("sleepInt");
        String newDaySleepInt = server.arg("daySleepInt");

        if (newMin.length() > 0 || newSec.length() > 0) {
            int totalSec = (newMin.toInt() * 60) + newSec.toInt();
            preferences.putInt("screenTimeout", totalSec);
        }
        if (newInterval.length() > 0) preferences.putULong("uploadInterval", (unsigned long)newInterval.toInt());
        if (newTempOff.length() > 0) preferences.putFloat("tempOffset", newTempOff.toFloat());
        if (newSleepInt.length() > 0) preferences.putInt("nightSleepMin", newSleepInt.toInt());
        if (newDaySleepInt.length() > 0) preferences.putInt("daySleepMin", newDaySleepInt.toInt());

        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/settime", HTTP_GET, []() {
        server.enableCORS(true);
        if (server.hasArg("epoch")) {
            uint32_t epoch = server.arg("epoch").toInt();
            if (epoch > 1000000000) {
                struct timeval tv = { .tv_sec = (time_t)epoch, .tv_usec = 0 };
                settimeofday(&tv, NULL);
                rtcEpoch = epoch;
                preferences.begin("agrishield", false);
                preferences.putUInt("last_epoch", epoch);
                preferences.end();
                server.send(200, "text/plain", "Time synced successfully!");
                return;
            }
        }

        String d = server.arg("d");
        String t = server.arg("t");
        if(d.length() > 0 && t.length() > 0) {
            struct tm tm;
            int yr, mn, dy, h, m, s;
            sscanf(d.c_str(), "%d-%d-%d", &yr, &mn, &dy);
            sscanf(t.c_str(), "%d:%d:%d", &h, &m, &s);
            tm.tm_year = yr - 1900;
            tm.tm_mon = mn - 1;
            tm.tm_mday = dy;
            tm.tm_hour = h;
            tm.tm_min = m;
            tm.tm_sec = s;
            time_t t_of_day = mktime(&tm);
            struct timeval tv = { .tv_sec = t_of_day, .tv_usec = 0 };
            settimeofday(&tv, NULL);
            rtcEpoch = (uint32_t)t_of_day;
            preferences.begin("agrishield", false);
            preferences.putUInt("last_epoch", rtcEpoch);
            preferences.end();
            server.send(200, "text/plain", "OK");
            return;
        }
        server.send(400, "text/plain", "Bad format");
    });

    server.on("/status", HTTP_GET, []() {
        String json = "{";
        json += "\"t\":" + String(temperature, 1) + ",";
        json += "\"h\":" + String(humidity, 1) + ",";
        json += "\"l\":" + String(lightLux) + ",";
        json += "\"p\":" + String(activePage) + ",";
        json += "\"a\":" + String(activeAnimation) + ",";
        json += "\"pr\":" + String(pressurehPa, 1) + ",";
        json += "\"sm\":" + String(soilMoisture, 1) + ",";
        json += "\"rn\":" + (isRaining ? String("true") : String("false")) + ",";
        json += "\"bp\":" + String(batteryPercent) + ",";
        json += "\"bv\":" + String(batteryVoltage, 2) + ",";
        json += "\"wf\":\"" + (wifiConnected ? WiFi.SSID() : String("DISCONNECTED")) + "\",";
        json += "\"bt\":\"" + (btConnected ? String("CONNECTED") : String("READY")) + "\",";
        json += "\"sd\":\"" + (sdMounted ? String("MOUNTED") : String("FAILED")) + "\",";
        json += "\"sz\":" + String((unsigned long)sdCardSizeMB) + ",";
        json += "\"su\":" + String(sdUsedMB, 4) + ",";
        json += "\"sc\":" + String((millis() - lastScreenActiveTime) / 1000);
        json += "}";
        server.enableCORS(true);
        server.send(200, "application/json", json);
    });

    server.on("/download-logs", HTTP_GET, []() {
        if (!sdMounted) {
            server.enableCORS(true);
            server.send(500, "text/plain", "SD Card not mounted.");
            return;
        }
        File logFile = SD.open("/telemetry_log.txt", FILE_READ);
        if (!logFile) {
            server.enableCORS(true);
            server.send(404, "text/plain", "Log file not found.");
            return;
        }
        server.enableCORS(true);
        server.sendHeader("Content-Disposition", "attachment; filename=agrishield_telemetry_logs.txt");
        server.streamFile(logFile, "text/plain");
        logFile.close();
    });

    server.on("/download-archive", HTTP_GET, []() {
        if (!sdMounted) {
            server.enableCORS(true);
            server.send(500, "text/plain", "SD Card not mounted.");
            return;
        }
        File archiveFile = SD.open("/archive_log.txt", FILE_READ);
        if (!archiveFile) {
            server.enableCORS(true);
            server.send(404, "text/plain", "Archive file not found.");
            return;
        }
        server.enableCORS(true);
        server.sendHeader("Content-Disposition", "attachment; filename=agrishield_archive_logs.txt");
        server.streamFile(archiveFile, "text/plain");
        archiveFile.close();
    });


    server.on("/api/shutdown", HTTP_GET, []() { 
        server.send(200,"text/plain","Shutting Down..."); 
        delay(500); 
        powerOffModules();
        
        // Keep internal pullup active during deep sleep so it doesn't float LOW and instantly wake up!
        rtc_gpio_init((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY);
        rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1);
        
        esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON_1, 0); // Wake when Button 1 is pressed (LOW)
        esp_deep_sleep_start(); 
    });
    server.on("/api/strict_offline", HTTP_GET, []() { 
        bool state = true;
        if(server.hasArg("state")) {
            state = server.arg("state") == "1";
        }
        preferences.putBool("offlineMode", state);
        server.enableCORS(true);
        server.send(200,"text/plain", state ? "Strict Offline Enabled..." : "Online Mode Enabled...");
        delay(500); 
        ESP.restart(); 
    });

    server.on("/reset",      HTTP_GET, []() { server.send(200,"text/plain","Rebooting..."); delay(500); ESP.restart(); });
    server.on("/screen-on",  HTTP_GET, []() { display.oled_command(0xAF); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/screen-off", HTTP_GET, []() { display.oled_command(0xAE); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/page-next",  HTTP_GET, []() { if(activeAnimation==0){activePage=(activePage%TOTAL_PAGES)+1; drawOledPage();} server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/page-prev",  HTTP_GET, []() { if(activeAnimation==0){activePage=activePage>1?activePage-1:TOTAL_PAGES; drawOledPage();} server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-rain",    HTTP_GET, []() { activeAnimation=1; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-hot",     HTTP_GET, []() { activeAnimation=2; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sunrise", HTTP_GET, []() { activeAnimation=3; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sunset",  HTTP_GET, []() { activeAnimation=4; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-grow",    HTTP_GET, []() { activeAnimation=5; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-water",   HTTP_GET, []() { activeAnimation=6; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-night",   HTTP_GET, []() { activeAnimation=7; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sync",    HTTP_GET, []() { activeAnimation=8; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });

    server.enableCORS(true);
    server.begin();
    // Removed while(true) blocking loop!
}

void powerOffModules() {
    Serial.println(F("🔌 [POWER] Shutting down modules, Wi-Fi & Radios for Deep Sleep..."));

    // 1. Shut down OLED display
    display.oled_command(0xAE); // Turn off OLED
    
    // 2. Shut down Status/Heartbeat LED
    pinMode(LED_HEARTBEAT, OUTPUT);
    digitalWrite(LED_HEARTBEAT, LOW);
    gpio_hold_en((gpio_num_t)LED_HEARTBEAT);

    // 3. Shut down WebServer and Wi-Fi Radio cleanly
    server.close();
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();
    delay(20);

    // 4. Shut down Bluetooth Radio
#if ENABLE_BLUETOOTH
    btStop();
    esp_bt_controller_disable();
#endif

    // 5. End I2C and SPI buses to release line drivers
    Wire.end();
    SD.end();
    SPI.end();
    
    // ⚡ 6. Cut OFF power to all 6 supporting sensors (0mA Draw) & Lock Pin LOW during Deep Sleep
    pinMode(PIN_SENSOR_POWER, OUTPUT);
    digitalWrite(PIN_SENSOR_POWER, LOW);
    
    rtc_gpio_init((gpio_num_t)PIN_SENSOR_POWER);
    rtc_gpio_set_direction((gpio_num_t)PIN_SENSOR_POWER, RTC_GPIO_MODE_OUTPUT_ONLY);
    rtc_gpio_set_level((gpio_num_t)PIN_SENSOR_POWER, 0);
    rtc_gpio_pullup_dis((gpio_num_t)PIN_SENSOR_POWER);
    rtc_gpio_pulldown_en((gpio_num_t)PIN_SENSOR_POWER);
    rtc_gpio_hold_en((gpio_num_t)PIN_SENSOR_POWER);
    gpio_hold_en((gpio_num_t)PIN_SENSOR_POWER); // 🔒 Lock digital GPIO 4 output driver LOW during Deep Sleep

    // ⚡ 7. Clamp I2C SDA (GPIO 21) & SCL (GPIO 22) to LOW to prevent Parasitic Back-Powering!
    // Sensor ICs receive parasitic current via SDA/SCL pull-ups if left HIGH during sleep.
    pinMode(21, OUTPUT);
    digitalWrite(21, LOW);
    gpio_hold_en(GPIO_NUM_21);

    pinMode(22, OUTPUT);
    digitalWrite(22, LOW);
    gpio_hold_en(GPIO_NUM_22);

    // ⚡ 8. Clamp DHT data line & SD Card SPI lines to GND
    pinMode(DHTPIN, OUTPUT);
    digitalWrite(DHTPIN, LOW);
    gpio_hold_en((gpio_num_t)DHTPIN);

    pinMode(SD_CS, OUTPUT);
    digitalWrite(SD_CS, LOW);
    gpio_hold_en((gpio_num_t)SD_CS);

    pinMode(MOSI, OUTPUT);
    digitalWrite(MOSI, LOW);
    gpio_hold_en((gpio_num_t)MOSI);

    pinMode(MISO, INPUT_PULLDOWN);

    pinMode(SCK, OUTPUT);
    digitalWrite(SCK, LOW);
    gpio_hold_en((gpio_num_t)SCK);

    gpio_deep_sleep_hold_en(); // Retain pin hold states during deep sleep
}

// ---------------------------------------------------------------------------------
// 💾 UNIFIED OFFLINE STORAGE & BLACKBOX LOGGER (Applies in ALL Situations)
// ---------------------------------------------------------------------------------
void logTelemetryToOfflineQueue(const String& jsonPayload) {
    if (!sdMounted) return;

    // 1. Permanent Blackbox Archive (Always preserves complete historical records)
    File archive = SD.open("/archive_log.txt", FILE_APPEND);
    if (archive) {
        archive.println(jsonPayload);
        archive.close();
    }

    // 2. Active Offline Sync Queue (Holds non-sent records until Wi-Fi is online)
    File queueFile = SD.open("/telemetry_log.txt", FILE_APPEND);
    if (queueFile) {
        queueFile.println(jsonPayload);
        queueFile.close();
        Serial.print(F("💾 [SD LOGGED] "));
        Serial.println(jsonPayload);
    }
}

void setup() {

    // ⚡ CPU Frequency Scaling to save power early!
#if ENABLE_BLUETOOTH
    setCpuFrequencyMhz(160); // Bluetooth needs >=160MHz for timing-critical packets
#else
    setCpuFrequencyMhz(80);  // Scale down to 80MHz to save up to 60% CPU power
#endif

    Serial.begin(115200);
    delay(50);

#if !ENABLE_BLUETOOTH
    // Reclaim ~40KB of internal DRAM by releasing the Bluetooth controller stack
    esp_bt_controller_mem_release(ESP_BT_MODE_BTDM);
    Serial.println(F("[BT] Reclaimed 40KB BT DRAM to system heap."));
#endif

    // ⚡ 1. FIRST: Release global deep sleep hold so hardware pin pads can respond immediately!
    gpio_deep_sleep_hold_dis();
    
    // ⚡ 2. SECOND: Release digital pad & RTC hold on GPIO 4 (Sensor Power), LEDs, and I2C/SPI pins
    gpio_hold_dis((gpio_num_t)PIN_SENSOR_POWER);
    rtc_gpio_hold_dis((gpio_num_t)PIN_SENSOR_POWER);
    rtc_gpio_deinit((gpio_num_t)PIN_SENSOR_POWER);

    gpio_hold_dis((gpio_num_t)LED_HEARTBEAT);

    gpio_hold_dis(GPIO_NUM_21);
    gpio_hold_dis(GPIO_NUM_22);

    // Deinit wakeup button RTC configuration to restore standard input interrupts
    rtc_gpio_deinit((gpio_num_t)PIN_BUTTON_1);

    gpio_hold_dis((gpio_num_t)DHTPIN);
    gpio_hold_dis((gpio_num_t)SD_CS);
    gpio_hold_dis((gpio_num_t)MOSI);
    gpio_hold_dis((gpio_num_t)SCK);

    // ⚡ 3. THIRD: Turn ON Sensor Power via GPIO 4 for AHT20, BH1750, BMP280, DHT22, Soil & Rain
    pinMode(PIN_SENSOR_POWER, OUTPUT);
    digitalWrite(PIN_SENSOR_POWER, HIGH);
    lowPowerDelay(250); // 250ms voltage stabilization delay for sensor ICs to wake up

    // Initialize ADC Vref eFuse calibration characters
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adc_chars);

    // 🔋 Read resting battery voltage early (before Wi-Fi or Bluetooth modems startup and sag the line)
    readBattery();

    // ⚡ FIX: Initialize timezone offset IMMEDIATELY so the RTC keeps Local Time across Deep Sleep reboots even when Offline!
    configTime(gmtOffset_sec, daylightOffset_sec, "pool.ntp.org", "time.nist.gov", "time.google.com");

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
    
    // ⚡ Attach Hardware Interrupts for Buttons (FALLING edge = button pressed to GND)
    attachInterrupt(digitalPinToInterrupt(PIN_BUTTON_1), isrBtn1, FALLING);
    attachInterrupt(digitalPinToInterrupt(PIN_BUTTON_2), isrBtn2, FALLING);
    
    pinMode(PIN_CHARGE, INPUT_PULLUP);
    pinMode(PIN_RAIN_DIGITAL, INPUT); // GPIO 39 is input-only and has NO internal pull-up!
    // 1. Check Wakeup Reason - determine what woke us from deep sleep
    esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
    if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) {
        // Button 1 pressed to wake up from shutdown mode
        Serial.println(F("[WAKEUP] Button 1 pressed during sleep! (EXT0)"));
        buttonWakeup = true;        // flag: user explicitly woke device
    } else if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) {
        // Scheduled night timer wakeup for sensor read
        Serial.println(F("[WAKEUP] Night Sleep Timer elapsed. Quick sensor check..."));
        nightSleepCycle = true;
    } else if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT1) {
        // USER pressed physical button during deep sleep
        Serial.println(F("[WAKEUP] Button pressed during sleep! Showing status screen..."));
        nightSleepCycle = true;     // still in night context
        buttonWakeup = true;        // flag: user explicitly woke device
    }

    // pinMode(LED_HEARTBEAT, OUTPUT);

    // digitalWrite(LED_HEARTBEAT, HIGH);

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
    SPI.begin(14, 12, 13, 15);
    lowPowerDelay(100);

    if (SD.begin(SD_CS) && SD.cardType() != CARD_NONE) {
        sdMounted = true;
        sdCardSizeMB = SD.cardSize() / (1024 * 1024);
        sdUsedMB = (double)SD.usedBytes() / (1024.0 * 1024.0); // ⚡ Cache once at boot (avoids blocking per-cycle calls)
        Serial.printf("✅ SD Card Initialized Successfully! Size: %llu MB, Used: %.3f MB\n", (unsigned long long)sdCardSizeMB, sdUsedMB);
        
        File archive = SD.open("/archive_log.txt", FILE_APPEND);
        if (archive) {
            archive.println(F("--- AgriShield Node Bootup Logging ---"));
            archive.close();
        }
    } else {
        sdMounted = false;
        Serial.println(F("❌ SD Card Not Detected or Initialization Failed!"));
    }

    // 5. Initialize I2C Bus
    Wire.begin(21, 22);
    Wire.setClock(400000); // Increase I2C speed to 400kHz (Fast Mode) for GPIO 21 and 22
    lowPowerDelay(500); // Wait for devices to power up, matching sample code!
    // scanI2CBus(); // Temporarily disabled because this scanner loop can lock up some cheap I2C sensors!

    // 6. Initialize OLED (1.3" SH1106 via Adafruit SH110X library)
    if (!display.begin(0x3C, true)) {
        Serial.println(F("⚠️ OLED SH1106 Init Failed! Check SDA 21 / SCL 22"));
    } else {
        Serial.println(F("✅ 1.3\" OLED SH1106 Display Detected!"));
        
        bool showAnimation = (buttonWakeup || setupMode);
        if (showAnimation) {
            // Show a premium 2-second boot progress animation
            for (int i = 0; i <= 100; i += 5) {
                display.clearDisplay();
                display.setTextSize(1);
                display.setTextColor(SH110X_WHITE, SH110X_BLACK);
                
                // Draw Title
                display.setCursor(12, 10);
                display.print(F("AgriShield AI Node"));
                
                // Draw status
                display.setCursor(12, 28);
                display.print(F("Booting System..."));
                
                // Draw loading bar border
                display.drawRect(12, 45, 104, 8, SH110X_WHITE);
                // Fill loading bar
                display.fillRect(14, 47, map(i, 0, 100, 0, 100), 4, SH110X_WHITE);
                
                display.display();
                delay(80); // 20 frames * 80ms = 1.6 seconds
            }
        } else {
            // Quiet/fast boot for scheduled/timer checks (minimizes active time/power draw)
            display.clearDisplay();
            display.setTextSize(1);
            display.setTextColor(SH110X_WHITE, SH110X_BLACK);
            display.setCursor(10, 20);
            display.println(F("AgriShield AI Node"));
            display.setCursor(10, 38);
            display.println(F("Initializing..."));
            display.display();
            lowPowerDelay(100);
        }
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
    lowPowerDelay(200); // Give BH1750 extra time to wake up after other sensors
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
    WiFi.setSleep(true); // ⚡ Enable Wi-Fi Modem Sleep for significant power saving
    WiFi.setAutoReconnect(true);

    preferences.begin("agrishield", false);
    if (preferences.isKey("deviceId")) deviceId = preferences.getString("deviceId");
    if (preferences.isKey("screenTimeout")) screenTimeoutSec = preferences.getInt("screenTimeout");
    if (preferences.isKey("nightSleepMin")) sleepIntervalMin = preferences.getInt("nightSleepMin");
    if (preferences.isKey("daySleepMin")) daySleepIntervalMin = preferences.getInt("daySleepMin");
    if (preferences.isKey("uploadInterval")) uploadIntervalMs = preferences.getULong("uploadInterval");
    if (preferences.isKey("tempOffset")) tempOffset = preferences.getFloat("tempOffset");
    if (preferences.isKey("offlineMode")) offlineMode = preferences.getBool("offlineMode");

    // ⚡ RTC / FLASH TIME RESTORATION: Accurately restore offline clock
    time_t bootTime = time(nullptr);
    if (bootTime > 1000000000) {
        // System clock was already successfully advanced across sleep by ESP32 internal RTC
        rtcEpoch = (uint32_t)bootTime;

        // 🌡️ Software temperature-compensated drift correction for offline operation:
        // The internal RC oscillator drifts with temperature: coefficient is ~ -0.12%/°C.
        // Formula: driftSeconds = lastSleepSec * (rtcSleepTemp - 25.0) * -0.0012.
        // We adjust bootTime by subtracting driftSeconds to keep the offline clock perfectly on time.
        if (lastSleepSec > 0 && rtcSleepTemp > 0 && rtcSleepTemp != 25.0f) {
            float tempDiff = rtcSleepTemp - 25.0f;
            float driftFactor = tempDiff * -0.0012f; // -1200 ppm per °C
            int32_t driftSeconds = (int32_t)((float)lastSleepSec * driftFactor);
            if (driftSeconds != 0 && abs(driftSeconds) < 60) { // Safety ceiling: max 60s per cycle
                bootTime -= driftSeconds;
                struct timeval tv = { .tv_sec = bootTime, .tv_usec = 0 };
                settimeofday(&tv, NULL);
                rtcEpoch = (uint32_t)bootTime;
                Serial.printf("🌡️ [DRIFT COMP] Adjusted clock by %d seconds (Temp: %.1f°C, Drift factor: %.6f)\n", -driftSeconds, rtcSleepTemp, driftFactor);
            }
        }

        struct tm timeinfo;
        localtime_r(&bootTime, &timeinfo);
        char timeBuf[32];
        strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M:%S IST", &timeinfo);
        Serial.printf("⏳ [RTC TIME] System clock successfully maintained by ESP32 internal RTC: %s (Epoch: %u)\n", timeBuf, rtcEpoch);
    } else if (rtcEpoch > 1000000000) {
        // Fallback: If ESP32 internal RTC lost the time but RTC RAM survived
        struct timeval tv = { .tv_sec = (time_t)rtcEpoch, .tv_usec = 0 };
        settimeofday(&tv, NULL);
        struct tm timeinfo;
        time_t tEpoch = (time_t)rtcEpoch;
        localtime_r(&tEpoch, &timeinfo);
        char timeBuf[32];
        strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M:%S IST", &timeinfo);
        Serial.printf("⏳ [RTC TIME] Restored Offline Clock from RTC RAM: %s (Epoch: %u)\n", timeBuf, rtcEpoch);
    } else if (preferences.isKey("last_epoch")) {
        // Cold boot fallback: Restore last saved epoch from NVS flash
        uint32_t savedEpoch = preferences.getUInt("last_epoch", 0);
        if (savedEpoch > 1000000000) {
            rtcEpoch = savedEpoch;
            struct timeval tv = { .tv_sec = (time_t)savedEpoch, .tv_usec = 0 };
            settimeofday(&tv, NULL);
            struct tm timeinfo;
            time_t tEpoch = (time_t)savedEpoch;
            localtime_r(&tEpoch, &timeinfo);
            char timeBuf[32];
            strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M:%S IST", &timeinfo);
            Serial.printf("⏳ [NVS TIME] Restored Offline System Clock from Flash: %s (Epoch: %u)\n", timeBuf, savedEpoch);
        }
    }

    // --- STRICT OFFLINE SLEEP OVERRIDE ---
    if (offlineMode) {
        sleepIntervalMin = 5;
        daySleepIntervalMin = 5;
        Serial.println(F("[OFFLINE] Enforcing 5-minute Deep Sleep Cycle for Strict Offline Mode."));
    }

    if (preferences.isKey("ssid")) {
        savedSSID = preferences.getString("ssid");
        savedPass = preferences.getString("pass");
        if (preferences.isKey("api")) {
            savedApiUrl = preferences.getString("api");
        }
    } else {
        savedSSID = WIFI_SSID;
        savedPass = WIFI_PASS;
    }

    if (!offlineMode && savedSSID.length() > 0) {
        WiFi.setTxPower(WIFI_POWER_15dBm); // ⚡ Increase RF transmit power to 15dBm (stronger range, connects fast!)
        
        bool shouldBlockForWifi = (!buttonWakeup && !setupMode && (daySleepIntervalMin > 0 || nightSleepCycle));
        if (shouldBlockForWifi) {
            Serial.print(F("[WIFI] Scheduled Wakeup: Connecting to: "));
            Serial.println(savedSSID);
            WiFi.begin(savedSSID.c_str(), savedPass.c_str());
            
            int attempts = 0;
            while (WiFi.status() != WL_CONNECTED && attempts < 20) { // ⚡ 10-second timeout (20 attempts * 500ms)
                lowPowerDelay(500); // Save energy during connection waits
                Serial.print(".");
                attempts++;
            }
            
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println(F("\n[WIFI] Failed to connect in 10s! Falling back to offline operations..."));
                wifiConnected = false;
            } else {
                wifiConnected = true;
                Serial.println(F("\n[WIFI] Connected!"));
                Serial.print(F("ESP32 IP: "));
                Serial.println(WiFi.localIP());

                // Determine API URL for this network
                bool foundInKnown = false;
                for (int i = 0; i < KNOWN_WIFI_COUNT; i++) {
                    if (String(KNOWN_WIFI_NETWORKS[i].ssid) == savedSSID) {
                        if (String(KNOWN_WIFI_NETWORKS[i].api_url).length() > 0) {
                            currentApiBaseUrl = KNOWN_WIFI_NETWORKS[i].api_url;
                            foundInKnown = true;
                            break;
                        }
                    }
                }
                if (!foundInKnown && savedApiUrl.length() > 0 && !savedApiUrl.startsWith("http://127.0.0.1")) {
                    currentApiBaseUrl = savedApiUrl;
                }
                Serial.println("🌐 [API] Target Backend: " + currentApiBaseUrl);

                if (!MDNS.begin("esp32-agrishield-client")) {
                    Serial.println("Error setting up MDNS responder!");
                } else {
                    Serial.println("mDNS responder started.");
                }

                // 🚀 Immediately Flush & Sync All Offline Records to Cloud Server
                syncAllOfflineRecordsNow();
            }
        } else {
            // Interactive Wakeup: Start Wi-Fi in the background without blocking!
            Serial.print(F("[WIFI] Interactive Wakeup: Connecting in background to: "));
            Serial.println(savedSSID);
            WiFi.begin(savedSSID.c_str(), savedPass.c_str());
            wifiConnected = false; // Will resolve dynamically in the background loop!
        }
    } else {
        if (!offlineMode) {
            Serial.println(F("[WIFI] No credentials found. Starting AP..."));
            setupMode = true;
        }
    }

    // ⚡ FIX: If the user explicitly wakes up the device via the hardware button while in Offline Mode, 
    // we MUST start the Wi-Fi AP (Captive Portal) so they can connect to the Node Control Panel and disable it!
    if (buttonWakeup) {
        Serial.println(F("[WAKEUP] Manual button override! Forcing Wi-Fi AP Mode for Node Control Panel access."));
        setupMode = true;
    }

    // --- FAST OFFLINE DAY/NIGHT SLEEP PATH ---
    // If device was sleeping on timer and Wi-Fi is unavailable, take quick reading, log JSON to SD, and sleep immediately
    if ((daySleepIntervalMin > 0 || nightSleepCycle) && WiFi.status() != WL_CONNECTED && !setupMode && !buttonWakeup) {
        int targetSleep = nightSleepCycle ? sleepIntervalMin : daySleepIntervalMin;
        Serial.printf("[OFFLINE] Running fast sensor capture and returning to %d min deep sleep...\n", targetSleep);
        
        delay(200);
        readAllSensors();

        String isoTs = getIsoTimestamp();
        String jsonPayload = String("{\"device_id\":\"") + deviceId + String("\"") +
                             (isoTs.length() > 0 ? String(",\"timestamp\":\"") + isoTs + String("\"") : String("")) +
                             String(",\"temperature\":") + (ahtValid || dhtValid ? String(temperature, 1) : String("null")) +
                             String(",\"humidity\":") + (ahtValid || dhtValid ? String(humidity, 1) : String("null")) +
                             String(",\"vpd\":") + (ahtValid || dhtValid ? String(vpd, 2) : String("null")) +
                             String(",\"pressure\":") + (bmp280Valid ? String(pressurehPa, 1) : String("null")) +
                             String(",\"soil_moisture\":") + (soilValid ? String(soilMoisture, 1) : String("null")) +
                             String(",\"rain_detected\":") + (rainValid ? (isRaining ? String("true") : String("false")) : String("false")) +
                             String(",\"rain_intensity\":\"") + (rainValid ? rainIntensity : String("--")) + String("\"") +
                             String(",\"light_lux\":") + (bh1750Valid && lightLux >= 0 ? String(lightLux) : String("null")) +
                             String(",\"battery_percentage\":") + (batteryValid ? String(batteryPercent) : String("null")) +
                             String(",\"battery_voltage\":") + (batteryValid ? String(batteryVoltage, 2) : String("null")) +
                             String(",\"sd_card_status\":\"mounted\"") +
                             String(",\"sd_total_mb\":") + String((unsigned long)sdCardSizeMB) + String(",\"sd_used_mb\":") + String(sdUsedMB, 4) +
                             String(",\"sleep_interval_min\":") + String(targetSleep) +
                             String(",\"is_night_mode\":") + (nightSleepCycle ? String("true") : String("false")) +
                             String(",\"bluetooth_connected\":false") +
                             String("}");

        // Log to unified offline queue & blackbox archive
        logTelemetryToOfflineQueue(jsonPayload);

        // ⚡ PERSIST TIME TO RTC RAM before sleeping:
        // rtcEpoch stores the current time() value (IST-shifted epoch due to configTime gmtOffset=19800).
        // On next wakeup: rtcEpoch += lastSleepSec restores the clock accurately.
        // getIsoTimestamp() uses localtime_r() on time() which already returns IST — correct.
        lastSleepSec = (uint32_t)targetSleep * 60;
        time_t curTime = time(nullptr);
        struct tm _ct; localtime_r(&curTime, &_ct);
        if (_ct.tm_year > 100) { // only save if clock is valid (year > 2000)
            rtcEpoch = (uint32_t)curTime;
            // Also update NVS with true UTC epoch
            uint32_t utcForNvs = (uint32_t)curTime;
            if (utcForNvs > 1786000000UL) preferences.putUInt("last_epoch", utcForNvs);
        }
        Serial.printf("[SLEEP] Fast Offline Mode: Entering Deep Sleep for %d minutes...\n", targetSleep);
        powerOffModules();
        rtc_gpio_init((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY);
        rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1);
        esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON_1), ESP_EXT1_WAKEUP_ALL_LOW);
        esp_sleep_enable_timer_wakeup((uint64_t)targetSleep * 60000000ULL);
        esp_deep_sleep_start();
    }

    if (setupMode) {
        startCaptivePortal();
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

    const char* headerKeys[] = {"X-API-Key"};
    server.collectHeaders(headerKeys, 1);
    
    server.enableCORS(true); // Globally enable CORS for all routes

    server.on("/", HTTP_GET, []() {
      server.sendHeader("Connection", "close");
      server.send(200, "text/html", getCaptivePortalHtml());
    });
    server.on("/ota", HTTP_GET, []() {
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
    server.on("/save-id", HTTP_POST, []() {
        String newDevice = server.arg("device");
        if (newDevice.length() > 0) preferences.putString("deviceId", newDevice);
        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/save-node", HTTP_POST, []() {
        String newSsid = server.arg("ssid");
        String newPass = server.arg("pass");
        String newApi = server.arg("api");

        if (newSsid.length() > 0) {
            preferences.putString("ssid", newSsid);
            preferences.putString("pass", newPass);
            if(newApi.length() > 0) preferences.putString("api", newApi);
        }
        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/save-adv", HTTP_POST, []() {
        String newMin = server.arg("min");
        String newSec = server.arg("sec");
        String newInterval = server.arg("interval");
        String newTempOff = server.arg("tempOff");
        String newSleepInt = server.arg("sleepInt");
        String newDaySleepInt = server.arg("daySleepInt");

        if (newMin.length() > 0 || newSec.length() > 0) {
            int totalSec = (newMin.toInt() * 60) + newSec.toInt();
            preferences.putInt("screenTimeout", totalSec);
        }
        if (newInterval.length() > 0) preferences.putULong("uploadInterval", (unsigned long)newInterval.toInt());
        if (newTempOff.length() > 0) preferences.putFloat("tempOffset", newTempOff.toFloat());
        if (newSleepInt.length() > 0) preferences.putInt("nightSleepMin", newSleepInt.toInt());
        if (newDaySleepInt.length() > 0) preferences.putInt("daySleepMin", newDaySleepInt.toInt());

        server.send(200, "text/html", "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='2;url=/'><style>body{font-family:sans-serif;background:#0a0f1e;color:#10b981;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head><body><h2>&#9989; Saved!</h2><p style='color:#94a3b8'>Rebooting device...<br>Returning to panel in 5s</p></body></html>");
        delay(1000);
        ESP.restart();
    });

    server.on("/settime", HTTP_GET, []() {
        if(!isAuthorized()) return;
        server.enableCORS(true);
        if (server.hasArg("epoch")) {
            uint32_t epoch = server.arg("epoch").toInt();
            if (epoch > 1000000000) {
                struct timeval tv = { .tv_sec = (time_t)epoch, .tv_usec = 0 };
                settimeofday(&tv, NULL);
                rtcEpoch = epoch;
                preferences.begin("agrishield", false);
                preferences.putUInt("last_epoch", epoch);
                preferences.end();
                server.send(200, "text/plain", "Time synced successfully!");
                return;
            }
        }

        String d = server.arg("d");
        String t = server.arg("t");
        if(d.length() > 0 && t.length() > 0) {
            struct tm tm;
            int yr, mn, dy, h, m, s;
            sscanf(d.c_str(), "%d-%d-%d", &yr, &mn, &dy);
            sscanf(t.c_str(), "%d:%d:%d", &h, &m, &s);
            tm.tm_year = yr - 1900;
            tm.tm_mon = mn - 1;
            tm.tm_mday = dy;
            tm.tm_hour = h;
            tm.tm_min = m;
            tm.tm_sec = s;
            time_t t_of_day = mktime(&tm);
            struct timeval tv = { .tv_sec = t_of_day, .tv_usec = 0 };
            settimeofday(&tv, NULL);
            rtcEpoch = (uint32_t)t_of_day;
            preferences.begin("agrishield", false);
            preferences.putUInt("last_epoch", rtcEpoch);
            preferences.end();
            server.send(200, "text/plain", "OK");
            return;
        }
        server.send(400, "text/plain", "Bad format");
    });

    server.on("/status", HTTP_GET, []() {
        if(!isAuthorized()) return;
        String json = "{";
        json += "\"t\":" + String(temperature, 1) + ",";
        json += "\"h\":" + String(humidity, 1) + ",";
        json += "\"l\":" + String(lightLux) + ",";
        json += "\"p\":" + String(activePage) + ",";
        json += "\"a\":" + String(activeAnimation) + ",";
        json += "\"pr\":" + String(pressurehPa, 1) + ",";
        json += "\"sm\":" + String(soilMoisture, 1) + ",";
        json += "\"rn\":" + (isRaining ? String("true") : String("false")) + ",";
        json += "\"bp\":" + String(batteryPercent) + ",";
        json += "\"bv\":" + String(batteryVoltage, 2) + ",";
        json += "\"wf\":\"" + (wifiConnected ? WiFi.SSID() : String("DISCONNECTED")) + "\",";
        json += "\"bt\":\"" + (btConnected ? String("CONNECTED") : String("READY")) + "\",";
        json += "\"sd\":\"" + (sdMounted ? String("MOUNTED") : String("FAILED")) + "\",";
        json += "\"sz\":" + String((unsigned long)sdCardSizeMB) + ",";
        json += "\"su\":" + String(sdUsedMB, 4) + ",";
        json += "\"sc\":" + String((millis() - lastScreenActiveTime) / 1000) + ",";
        json += "\"dsi\":" + String(daySleepIntervalMin);
        json += "}";
        server.enableCORS(true);
        server.send(200, "application/json", json);
    });

    server.on("/download-logs", HTTP_GET, []() {
        if(!isAuthorized()) return;
        if (!sdMounted) {
            server.enableCORS(true);
            server.send(500, "text/plain", "SD Card not mounted.");
            return;
        }
        File logFile = SD.open("/archive_log.txt", FILE_READ);
        if (!logFile) {
            server.enableCORS(true);
            server.send(404, "text/plain", "Log file not found.");
            return;
        }
        server.enableCORS(true);
        server.sendHeader("Content-Disposition", "attachment; filename=agrishield_telemetry_logs.txt");
        server.streamFile(logFile, "text/plain");
        logFile.close();
    });

    server.on("/api/shutdown", HTTP_GET, []() { 
        if(!isAuthorized()) return;
        server.send(200,"text/plain","Shutting Down..."); 
        delay(500); 
        powerOffModules();
        
        // Keep internal pullup active during deep sleep so it doesn't float LOW and instantly wake up!
        rtc_gpio_init((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY);
        rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1);
        rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1);
        
        esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON_1, 0); // Wake when Button 1 is pressed (LOW)
        esp_deep_sleep_start(); 
    });
    server.on("/api/strict_offline", HTTP_GET, []() { if(!isAuthorized()) return; preferences.putBool("offlineMode", true); server.send(200,"text/plain","Strict Offline Enabled..."); delay(500); ESP.restart(); });

    server.on("/reset",      HTTP_GET, []() { if(!isAuthorized()) return; server.send(200,"text/plain","Rebooting..."); delay(500); ESP.restart(); });
    server.on("/screen-on",  HTTP_GET, []() { if(!isAuthorized()) return; display.oled_command(0xAF); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/screen-off", HTTP_GET, []() { if(!isAuthorized()) return; display.oled_command(0xAE); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/page-next",  HTTP_GET, []() { if(!isAuthorized()) return; if(activeAnimation==0){activePage=(activePage%TOTAL_PAGES)+1; drawOledPage();} server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/page-prev",  HTTP_GET, []() { if(!isAuthorized()) return; if(activeAnimation==0){activePage=activePage>1?activePage-1:TOTAL_PAGES; drawOledPage();} server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-rain",    HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=1; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-hot",     HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=2; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sunrise", HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=3; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sunset",  HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=4; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-grow",    HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=5; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-water",   HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=6; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-night",   HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=7; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });
    server.on("/anim-sync",    HTTP_GET, []() { if(!isAuthorized()) return; activeAnimation=8; animStartTime=millis(); server.enableCORS(true); server.send(200,"text/plain","OK"); });

    server.enableCORS(true);
    server.begin();

    // Spawn Web Server Task on Core 0 (Isolates network handling from sensor delays)
    xTaskCreatePinnedToCore(
        webServerTaskCode, // Task function
        "WebServerTask",   // Name of task
        10000,             // Stack size (words)
        NULL,              // Task input parameter
        1,                 // Priority (1 is standard for Core 0 tasks)
        &webServerTask,    // Task handle
        0                  // Core 0 (Network core)
    );

    readAllSensors();
    drawOledPage();
    // digitalWrite(LED_HEARTBEAT, LOW);
    lastScreenActiveTime = millis();
    lastWifiRetryTime = millis(); // ⚡ Initialize retry timer to prevent immediate loop failover scans at boot
    Serial.println(F("=======================================================\n"));
}

// ---------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------
// 🕒 ISO TIMESTAMP HELPER (Indian Standard Time UTC+5:30)
// ---------------------------------------------------------------------------------
String getIsoTimestamp() {
    time_t now = time(nullptr);
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    // tm_year > 100 means year > 2000 — clock is valid and NTP-synced or RTC-restored
    if (timeinfo.tm_year > 100) {
        char buf[36];
        // configTime() already shifted the internal clock by gmtOffset_sec (19800 = +05:30)
        // so localtime_r() returns IST time — we just append the literal "+05:30" suffix
        strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+05:30", &timeinfo);
        return String(buf);
    }

    // ⚠️ FALLBACK: Clock uninitialized (no NTP, no RTC). Recover from NVS last_epoch.
    // last_epoch is stored as a raw UTC Unix epoch (seconds since 1970-01-01 00:00:00 UTC).
    // To get IST we must ADD 19800 seconds (+05:30) before converting.
    if (preferences.isKey("last_epoch")) {
        uint32_t savedUtcEpoch = preferences.getUInt("last_epoch", 0);
        uint32_t elapsed = millis() / 1000; // seconds since this boot
        uint32_t estimatedUtc = savedUtcEpoch + elapsed;
        if (estimatedUtc > 1000000000) {
            // Convert UTC epoch -> IST by adding the IST offset (19800 sec = +05:30)
            time_t istTime = (time_t)(estimatedUtc + 19800UL);
            struct tm istInfo;
            gmtime_r(&istTime, &istInfo); // use gmtime_r so no double-offset applied
            char buf[36];
            strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+05:30", &istInfo);
            Serial.printf("⚠️ [FALLBACK TIME] Using NVS epoch+elapsed: %s\n", buf);
            return String(buf);
        }
    }
    return "";
}

// ---------------------------------------------------------------------------------
// 🔄 IMMEDIATE BULK OFFLINE SYNC (Flushes all SD card offline queue records to server)
// ---------------------------------------------------------------------------------
void performOfflineSync() {
    if (!mdnsResolved) {
        IPAddress backend_ip = MDNS.queryHost(MDNS_HOSTNAME);
        if (backend_ip != INADDR_NONE) {
            currentApiBaseUrl = "http://" + backend_ip.toString() + ":8000/api/v1";
            mdnsResolved = true;
            Serial.println("✅ mDNS Resolved API URL: " + currentApiBaseUrl);
        }
    }
    if (currentApiBaseUrl == "") return;

    // 1. If /sync_queue.txt exists from an earlier interrupted sync, process it first!
    if (!SD.exists("/sync_queue.txt")) {
        if (!SD.exists("/telemetry_log.txt")) return;

        File checkFile = SD.open("/telemetry_log.txt", FILE_READ);
        if (!checkFile) return;
        if (checkFile.size() == 0) {
            checkFile.close();
            SD.remove("/telemetry_log.txt");
            return;
        }
        checkFile.close();

        // Atomically rename active queue so incoming readings continue into a fresh /telemetry_log.txt
        if (!SD.rename("/telemetry_log.txt", "/sync_queue.txt")) {
            Serial.println(F("⚠️ [SYNC] Failed to prepare sync queue!"));
            return;
        }
    }

    File syncFile = SD.open("/sync_queue.txt", FILE_READ);
    if (!syncFile) {
        Serial.println(F("⚠️ [SYNC] Unable to open sync queue!"));
        return;
    }

    Serial.println(F("\n🚀 [SYNC] Starting Immediate Bulk Offline Sync to Server..."));
    int totalUploaded = 0;
    bool syncOk = true;

    while (syncFile.available() && syncOk) {
        String payload = "";
        int linesRead = 0;
        while (syncFile.available() && linesRead < 30) {
            String line = syncFile.readStringUntil('\n');
            line.trim();
            if (line.length() > 0 && line.startsWith("{") && line.endsWith("}")) {
                payload += line + "\n";
                linesRead++;
            }
        }

        if (linesRead > 0 && payload.length() > 0) {
            HTTPClient http;
            String bulkUrl = currentApiBaseUrl + "/iot/telemetry/bulk";
            http.begin(bulkUrl);
            http.setTimeout(10000);
            http.addHeader("Content-Type", "application/json-lines");
            http.addHeader("Connection", "close");
            int httpCode = http.POST(payload);
            if (httpCode == 200 || httpCode == 201) {
                totalUploaded += linesRead;
                Serial.printf("✅ [SYNC] Uploaded batch of %d records (Total: %d) -> Code 201 OK\n", linesRead, totalUploaded);
            } else {
                String errStr = http.errorToString(httpCode);
                Serial.printf("❌ [SYNC] Batch failed! Server Code: %d (%s)\n", httpCode, errStr.c_str());
                syncOk = false;
            }
            http.end();
        }
        yield();
    }

    syncFile.close();

    if (syncOk) {
        SD.remove("/sync_queue.txt");
        Serial.printf("🎉 [SYNC] Offline Bulk Sync Finished! All %d historical records ingested into database.\n\n", totalUploaded);
    } else {
        Serial.println(F("⚠️ [SYNC] Sync interrupted. Records safely retained on SD for next cycle."));
    }
}

void syncAllOfflineRecordsNow() {
    if (!sdMounted || WiFi.status() != WL_CONNECTED) return;
    
    // Quick exit if there are no files to sync, without touching the sleep guard
    if (!SD.exists("/sync_queue.txt") && !SD.exists("/telemetry_log.txt")) {
        return;
    }
    
    isSyncingOfflineQueue = true; // 🔒 Block deep sleep while syncing
    performOfflineSync();
    isSyncingOfflineQueue = false; // 🔓 Allow deep sleep again
}

// ---------------------------------------------------------------------------------
// ☁️ CLOUD COMMAND QUEUE PROCESSOR
// ---------------------------------------------------------------------------------
String extractQueryParam(String url, String key) {
    String searchKey = key + "=";
    int startIdx = url.indexOf(searchKey);
    if (startIdx == -1) return "";
    startIdx += searchKey.length();
    int endIdx = url.indexOf("&", startIdx);
    if (endIdx == -1) endIdx = url.length();
    return url.substring(startIdx, endIdx);
}

void processCloudCommand(String cmd) {
    if (cmd == "") return;
    
    Serial.println("[CLOUD] Received Command: " + cmd);
    
    if (cmd == "/api/shutdown") { display.clearDisplay(); display.setCursor(0,20); display.print("Shutting Down"); display.display(); delay(500); powerOffModules(); rtc_gpio_init((gpio_num_t)PIN_BUTTON_1); rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY); rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1); rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1); esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON_1, 0); esp_deep_sleep_start(); }
    else if (cmd == "/api/strict_offline") { preferences.putBool("offlineMode", true); display.clearDisplay(); display.setCursor(0,20); display.print("Offline Mode"); display.display(); delay(500); ESP.restart(); }
    else if (cmd == "/reset") { display.clearDisplay(); display.setCursor(0,20); display.print("Rebooting..."); display.display(); delay(500); ESP.restart(); }
    else if (cmd == "/screen-on") { display.oled_command(0xAF); screenIsOn = true; manualScreenOff = false; }
    else if (cmd == "/screen-off") { display.oled_command(0xAE); screenIsOn = false; manualScreenOff = true; }
    else if (cmd == "/page-next") { if(activeAnimation==0){activePage=(activePage%TOTAL_PAGES)+1; drawOledPage();} }
    else if (cmd == "/page-prev") { if(activeAnimation==0){activePage=activePage>1?activePage-1:TOTAL_PAGES; drawOledPage();} }
    else if (cmd == "/anim-rain") { activeAnimation=1; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-hot") { activeAnimation=2; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-sunrise") { activeAnimation=3; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-sunset") { activeAnimation=4; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-grow") { activeAnimation=5; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-water") { activeAnimation=6; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-night") { activeAnimation=7; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/anim-sync") { activeAnimation=8; animStartTime=millis(); if(!screenIsOn){display.oled_command(0xAF); screenIsOn=true; manualScreenOff=false;} }
    else if (cmd == "/api/erase-logs") { 
        if (sdMounted) { 
            SD.remove("/telemetry_log.txt"); 
            Serial.println("🗑️ [SD] Offline queue log erased via Cloud Command!"); 
        } 
    }
    else if (cmd.startsWith("/save-adv")) {
        String minStr = extractQueryParam(cmd, "min");
        String secStr = extractQueryParam(cmd, "sec");
        String sleepIntStr = extractQueryParam(cmd, "sleepInt");
        String daySleepIntStr = extractQueryParam(cmd, "daySleepInt");
        String intervalStr = extractQueryParam(cmd, "interval");
        String tempOffStr = extractQueryParam(cmd, "tempOff");
        if (minStr != "" && secStr != "") preferences.putInt("screenTimeout", minStr.toInt() * 60 + secStr.toInt());
        if (sleepIntStr != "") preferences.putInt("nightSleepMin", sleepIntStr.toInt());
        if (daySleepIntStr != "") preferences.putInt("daySleepMin", daySleepIntStr.toInt());
        if (intervalStr != "") preferences.putULong("uploadInterval", (unsigned long)intervalStr.toInt());
        if (tempOffStr != "") preferences.putFloat("tempOffset", tempOffStr.toFloat());
        delay(500);
        ESP.restart();
    }
    else if (cmd.startsWith("/save-node")) {
        String ssid = server.urlDecode(extractQueryParam(cmd, "ssid"));
        String pass = server.urlDecode(extractQueryParam(cmd, "pass"));
        String api = server.urlDecode(extractQueryParam(cmd, "api"));
        if (ssid != "") {
            preferences.putString("ssid", ssid);
            preferences.putString("pass", pass);
            if (api != "") preferences.putString("api", api);
            delay(500);
            ESP.restart();
        }
    }
}

// ---------------------------------------------------------------------------------
// 🔄 ARDUINO LOOP
// ---------------------------------------------------------------------------------
void loop() {
    yield();
    
    updateStatusLeds();
    unsigned long currentMillis = millis();

    // ⚡ Background Wi-Fi Connection Checker
    bool currentlyConnected = (WiFi.status() == WL_CONNECTED);
    if (currentlyConnected && !wifiConnected) {
        wifiConnected = true;
        Serial.println(F("\n[WIFI] Connected in background!"));
        Serial.print(F("ESP32 IP: "));
        Serial.println(WiFi.localIP());

        // Determine API URL for this network
        bool foundInKnown = false;
        for (int i = 0; i < KNOWN_WIFI_COUNT; i++) {
            if (String(KNOWN_WIFI_NETWORKS[i].ssid) == savedSSID) {
                if (String(KNOWN_WIFI_NETWORKS[i].api_url).length() > 0) {
                    currentApiBaseUrl = KNOWN_WIFI_NETWORKS[i].api_url;
                    foundInKnown = true;
                    break;
                }
            }
        }
        if (!foundInKnown && savedApiUrl.length() > 0 && !savedApiUrl.startsWith("http://127.0.0.1")) {
            currentApiBaseUrl = savedApiUrl;
        }
        Serial.println("🌐 [API] Target Backend: " + currentApiBaseUrl);

        if (!MDNS.begin("esp32-agrishield-client")) {
            Serial.println("Error setting up MDNS responder!");
        } else {
            Serial.println("mDNS responder started.");
            MDNS.begin("agrishield");
        }

        // 🚀 Immediately Flush & Sync All Offline Records in background
        syncAllOfflineRecordsNow();
    } else if (!currentlyConnected && wifiConnected) {
        wifiConnected = false;
        Serial.println(F("[WIFI] Background connection lost."));
    }

    if (wifiConnected) {
        wifiDisconnectTimer = 0;
        if (setupMode) {
            setupMode = false;
            WiFi.softAPdisconnect(true);
            WiFi.mode(WIFI_STA);
        }
    }

    // 1. MANUAL PUSH BUTTON PAGE SWITCH ONLY (GPIO 26 & GPIO 27)
    static unsigned long lastPressTime = 0;

    int curBtn1 = digitalRead(PIN_BUTTON_1);
    int curBtn2 = digitalRead(PIN_BUTTON_2);

    
    if (screenTimeoutSec > 0) {
        if (currentMillis - lastScreenActiveTime > (unsigned long)screenTimeoutSec * 1000 && activeAnimation == 0) {
            if (screenIsOn) {
                display.oled_command(0xAE); // Turn off
                screenIsOn = false;
            }
        } else {
            if (!screenIsOn && !manualScreenOff) {
                display.oled_command(0xAF); // Turn on
                screenIsOn = true;
            }
        }
    } else {
        if (!screenIsOn && !manualScreenOff) {
            display.oled_command(0xAF);
            screenIsOn = true;
        }
    }

    // Process Captive Portal requests in the background
    if (setupMode) {
        dnsServer.processNextRequest();
    }

    bool btn1Pressed = (curBtn1 == LOW);
    bool btn2Pressed = (curBtn2 == LOW);

    static bool prevBtn1Pressed = false;
    static bool prevBtn2Pressed = false;
    
    // ⚡ FIX: Use hardware interrupt flags to catch quick taps that happen while the CPU is frozen by Wi-Fi timeouts!
    bool btn1JustPressed = (btn1Pressed && !prevBtn1Pressed) || flagBtn1QuickTap;
    bool btn2JustPressed = (btn2Pressed && !prevBtn2Pressed) || flagBtn2QuickTap;
    if (flagBtn1QuickTap) flagBtn1QuickTap = false;
    if (flagBtn2QuickTap) flagBtn2QuickTap = false;
    
    static unsigned long btn1PressStart = 0;
    if (btn1Pressed) {
        if (!prevBtn1Pressed) btn1PressStart = currentMillis;
        else if (currentMillis - btn1PressStart > 3000) {
            offlineMode = !offlineMode;
            preferences.putBool("offlineMode", offlineMode);
            display.clearDisplay();
            display.setTextSize(1);
            display.setTextColor(SH110X_WHITE);
            display.setCursor(0, 30);
            display.print(offlineMode ? "STRICT OFFLINE ON" : "STRICT OFFLINE OFF");
            display.display();
            delay(2000);
            ESP.restart();
        }
    }

    prevBtn1Pressed = btn1Pressed;
    prevBtn2Pressed = btn2Pressed;


    if (activeAnimation == 0 && currentMillis > 3000) {
        if (btn1JustPressed && (currentMillis - lastPressTime > 100)) {
            lastPressTime = currentMillis;
            lastScreenActiveTime = currentMillis;
            manualScreenOff = false;
            activePage = (activePage % TOTAL_PAGES) + 1; // Forward
            drawOledPage();
            Serial.printf("[BUTTON] Forward to Page %d\n", activePage);
        } else if (btn2JustPressed && (currentMillis - lastPressTime > 100)) {
            lastPressTime = currentMillis;
            lastScreenActiveTime = currentMillis;
            manualScreenOff = false;
            activePage = activePage - 1; // Backward
            if (activePage < 1) activePage = TOTAL_PAGES;
            drawOledPage();
            Serial.printf("[BUTTON] Backward to Page %d\n", activePage);
        }
    }

    // 1.5 OLED Auto-Refresh (Every 30 seconds)
    static unsigned long lastOledRefresh = 0;
    if (currentMillis - lastOledRefresh >= 30000) {
        lastOledRefresh = currentMillis;
        readAllSensors();
        if (activeAnimation == 0 && screenIsOn) {
            drawOledPage();
        }
    }

    // 1.6 Cloud Command Queue Poller (Every 3 seconds)
    static unsigned long lastCloudPoll = 0;
    if (wifiConnected && (currentMillis - lastCloudPoll >= 3000)) {
        lastCloudPoll = currentMillis;
        String cmd = ApiManager::pollCloudCommand();
        if (cmd != "") {
            processCloudCommand(cmd);
        }
    }

    // 2. Wi-Fi Auto-Failover Retry Loop
    if (!wifiConnected) {
        if (wifiDisconnectTimer == 0) wifiDisconnectTimer = currentMillis;
        if (!setupMode && !offlineMode && (currentMillis - wifiDisconnectTimer > 60000)) {
            Serial.println(F("[WiFi] 60s Timeout reached! Activating AP Fallback Mode..."));
            setupMode = true;
            startCaptivePortal();
        }

        if (currentMillis - lastWifiRetryTime >= 20000) { // ⚡ 20-second interval allows active background handshakes to complete cleanly
            lastWifiRetryTime = currentMillis;
            
            if (!offlineMode && savedSSID.length() > 0) {
                if (setupMode) {
                    // We are in AP_STA mode. Do NOT disconnect, just politely ask STA to reconnect in the background!
                    Serial.printf("[WiFi Failover] Scanning for hotspot '%s' in background...\n", savedSSID.c_str());
                    WiFi.begin(savedSSID.c_str(), savedPass.c_str());
                } else {
                    // Normal STA mode retry
                    WiFi.disconnect(true, true);
                    delay(100);
                    WiFi.mode(WIFI_STA);
                    delay(100);
                    mdnsResolved = false;
                    Serial.printf("[WiFi Failover] Retrying connection to '%s'...\n", savedSSID.c_str());
                    WiFi.setTxPower(WIFI_POWER_15dBm);
                    WiFi.begin(savedSSID.c_str(), savedPass.c_str());
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
                WiFi.setTxPower(WIFI_POWER_15dBm);
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
    bool readyToSleep = (daySleepIntervalMin > 0 && screenTimeoutSec > 0 && currentMillis - lastScreenActiveTime >= ((unsigned long)screenTimeoutSec * 1000));
    if (currentMillis - lastTelemetryUpload >= uploadIntervalMs || (!hasUploadedTelemetry && currentMillis > 5000) || (readyToSleep && !hasUploadedTelemetry)) {
        lastTelemetryUpload = currentMillis;
        hasUploadedTelemetry = true;
        readAllSensors();

        // ⚡ CONTINUOUS TIME CHECKPOINT: Persist valid EPOCH to Flash (always save raw UTC epoch)
        // IMPORTANT: time(nullptr) returns POSIX UTC seconds regardless of gmtOffset_sec
        // We do NOT add 19800 here — last_epoch must always be a pure UTC epoch
        time_t curEpoch = time(nullptr);
        struct tm _check; localtime_r(&curEpoch, &_check);
        if (_check.tm_year > 100) {
            // time(nullptr) returns a pure UTC epoch. We save it directly to NVS and RTC RAM.
            uint32_t trueUtcEpoch = (uint32_t)curEpoch;
            if (trueUtcEpoch > 1786000000UL) { // sanity: after ~2026-07-01
                preferences.putUInt("last_epoch", trueUtcEpoch); // save real UTC
                rtcEpoch = trueUtcEpoch; // RTC RAM keeps pure UTC epoch
                Serial.printf("💾 [EPOCH SAVE] UTC=%u stored to NVS\n", trueUtcEpoch);
            }
        }

        // 🛡️ On Wi-Fi: Guard against sending stale pre-NTP timestamps on the very first post.
        // If NTP hasn't confirmed yet (clock still showing year < 2026), wait briefly.
        if (wifiConnected) {
            time_t _t = time(nullptr); struct tm _tm; localtime_r(&_t, &_tm);
            if (_tm.tm_year < 126) { // tm_year 126 = 2026
                Serial.println(F("⏳ [NTP GUARD] Clock not NTP-synced yet, waiting 4s for SNTP..."));
                delay(4000);
            }
        }

        String isoTs = getIsoTimestamp();
        String jsonPayload = String("{\"device_id\":\"") + deviceId + String("\"") +
                             (isoTs.length() > 0 ? String(",\"timestamp\":\"") + isoTs + String("\"") : String("")) +
                             String(",\"temperature\":") + (ahtValid || dhtValid ? String(temperature, 1) : String("null")) +
                             String(",\"humidity\":") + (ahtValid || dhtValid ? String(humidity, 1) : String("null")) +
                             String(",\"vpd\":") + (ahtValid || dhtValid ? String(vpd, 2) : String("null")) +
                             String(",\"pressure\":") + (bmp280Valid ? String(pressurehPa, 1) : String("null")) +
                             String(",\"soil_moisture\":") + (soilValid ? String(soilMoisture, 1) : String("null")) +
                             String(",\"rain_detected\":") + (rainValid ? (isRaining ? String("true") : String("false")) : String("false")) +
                             String(",\"rain_intensity\":\"") + (rainValid ? rainIntensity : String("--")) + String("\"") +
                             String(",\"light_lux\":") + (bh1750Valid && lightLux >= 0 ? String(lightLux) : String("null")) +
                             String(",\"battery_percentage\":") + (batteryValid ? String(batteryPercent) : String("null")) +
                             String(",\"battery_voltage\":") + (batteryValid ? String(batteryVoltage, 2) : String("null")) +
                             String(",\"sd_card_status\":") + (sdMounted ? String("\"mounted\"") : String("\"unmounted\"")) +
                             String(",\"sd_total_mb\":") + (sdMounted ? String((unsigned long)sdCardSizeMB) : String("0")) +
                             String(",\"sd_used_mb\":") + (sdMounted ? String(sdUsedMB, 4) : String("0")) +
                             String(",\"sleep_interval_min\":") + String(isNightMode ? sleepIntervalMin : (daySleepIntervalMin > 0 ? daySleepIntervalMin : (int)(uploadIntervalMs / 60000))) +
                             String(",\"is_night_mode\":") + (isNightMode ? String("true") : String("false")) +
                             String(",\"bluetooth_connected\":") + (btConnected ? String("true") : String("false")) +
                             String("}");

        Serial.println(F("\n--- 🌾 AGRI SHIELD LIVE TELEMETRY ---"));
        Serial.print(F("Temp    : ")); if (ahtValid || dhtValid) Serial.print(temperature, 1); else Serial.print(F("--")); Serial.println(F(" C"));
        Serial.print(F("Humid   : ")); if (ahtValid || dhtValid) Serial.print(humidity, 1); else Serial.print(F("--")); Serial.println(F(" %RH"));
        Serial.print(F("VPD     : ")); if (ahtValid || dhtValid) Serial.print(vpd, 2); else Serial.print(F("--")); Serial.println(F(" kPa"));
        Serial.print(F("Light   : ")); if (bh1750Valid && lightLux >= 0) Serial.print(lightLux); else Serial.print(F("--")); Serial.println(F(" Lux"));
        Serial.print(F("Soil    : ")); if (soilValid) Serial.print(soilMoisture, 1); else Serial.print(F("--")); Serial.println(F(" %"));
        Serial.print(F("Rain    : ")); if (rainValid) { Serial.print(rainIntensity); Serial.print(F(" (ADC: ")); Serial.print(analogRead(PIN_RAIN_ANALOG)); Serial.println(F(")")); } else Serial.println(F("--"));
        Serial.print(F("Press   : ")); if (bmp280Valid) Serial.print(pressurehPa, 1); else Serial.print(F("--")); Serial.println(F(" hPa"));
        Serial.print(F("Battery : ")); if (batteryValid) { Serial.print(batteryPercent); Serial.print(F("% (")); Serial.print(batteryVoltage, 2); Serial.print(F("V)")); } else Serial.print(F("--")); Serial.println();
        Serial.print(F("JSON    : ")); Serial.println(jsonPayload);
        Serial.println(F("-------------------------------------\n"));

        if (sdMounted) {
            // 1. Permanent Blackbox Archive (Always save full record history)
            File archive = SD.open("/archive_log.txt", FILE_APPEND);
            if (archive) {
                archive.println(jsonPayload);
                archive.close();
            }
            
            // 2. Offline Queue (Save to queue when offline to sync later upon reconnect)
            if (!wifiConnected || currentApiBaseUrl == "") {
                File file = SD.open("/telemetry_log.txt", FILE_APPEND);
                if (file) {
                    file.println(jsonPayload);
                    file.close();
                }
                Serial.println(F("💾 Saved to SD Card (Offline Mode Queue)"));
            } else {
                Serial.println(F("💾 Saved to SD Card (Blackbox Archive)"));
            }
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
            http.setTimeout(1500);
            http.setReuse(false);
            http.addHeader("Content-Type", "application/json");
            http.addHeader("Connection", "close");
            int httpResponseCode = http.POST(jsonPayload);
            if (httpResponseCode > 0) {
                if (httpResponseCode == 200 || httpResponseCode == 201) {
                    Serial.printf("📡 HTTP POST Success! Code: %d OK\n", httpResponseCode);
                    // ⚡ Refresh SD used space cache every 10 uploads (not every cycle — SD.usedBytes() is slow)
                    if (sdMounted && (++sdUsedMbRefreshCounter % 10 == 0)) {
                        sdUsedMB = (double)SD.usedBytes() / (1024.0 * 1024.0);
                    }
                    syncAllOfflineRecordsNow(); // 🚀 Flush any previously accumulated backlog!

                    // ❤️ Send Heartbeat so Node Control Panel can auto-detect this device
                    String localIp = WiFi.localIP().toString();
                    String hbPayload = String("{\"device_id\":\"") + deviceId + 
                                       String("\",\"ip\":\"") + localIp + 
                                       String("\",\"battery\":") + (batteryValid ? String(batteryPercent) : String("null")) +
                                       String(",\"uptime\":") + String((unsigned long)(millis()/1000)) +
                                       String(",\"heap\":") + String((unsigned long)ESP.getFreeHeap()) +
                                       String(",\"wifi\":true}");
                    HTTPClient hbHttp;
                    hbHttp.begin(currentApiBaseUrl + "/devices/heartbeat");
                    hbHttp.setTimeout(1000);
                    hbHttp.setReuse(false);
                    hbHttp.addHeader("Content-Type", "application/json");
                    hbHttp.addHeader("Connection", "close");
                    int hbCode = hbHttp.POST(hbPayload);
                    if (hbCode == 200) Serial.printf("❤️ Heartbeat Sent! IP: %s\n", localIp.c_str());
                    hbHttp.end();

                } else {
                    Serial.printf("⚠️ HTTP POST Failed! Code: %d\n", httpResponseCode);
                    Serial.println(http.getString());
                    // Live upload failed, save to offline queue for retry
                    logTelemetryToOfflineQueue(jsonPayload);
                }
            } else {
                String errStr = http.errorToString(httpResponseCode);
                Serial.printf("⚠️ HTTP POST Failed! Error: %s\n", errStr.c_str());
                // Network error, save to offline queue for retry
                logTelemetryToOfflineQueue(jsonPayload);
            }
            http.end(); // Free resources immediately
            yield();
        }
    }

    // 🔄 Autonomous Periodic Offline Queue Sync Check (every 30 seconds if Wi-Fi is connected)
    static unsigned long lastOfflineSyncCheck = 0;
    if (wifiConnected && (currentMillis - lastOfflineSyncCheck >= 30000)) {
        lastOfflineSyncCheck = currentMillis;
        syncAllOfflineRecordsNow();
    }

    // --- AUTONOMOUS DAY/NIGHT & ANIMATION LOGIC ---
    // isNightMode is a global bool (declared at top of file)
    static unsigned long nightModeTriggerTime = 0;
    static unsigned long lastAutoAnimTime = 0;

    if (bh1750Valid) {
        if (lightLux >= 0 && lightLux < 10 && !isNightMode) {
            // Confirm with 3 consecutive low-lux readings over 3 minutes before sleeping
            static int darkReadingCount = 0;
            static unsigned long firstDarkTime = 0;
            
            if (darkReadingCount == 0) {
                firstDarkTime = currentMillis;
                Serial.println(F("[MODE] Low light detected. Confirming (needs 3 readings or 3 min)..."));
            }
            darkReadingCount++;
            Serial.printf("[MODE] Dark reading #%d (%.0f Lux)\n", darkReadingCount, lightLux);
            
            // Enter night mode after 3 confirmed readings OR 3 minutes, whichever comes first
            if (darkReadingCount >= 3 || (currentMillis - firstDarkTime) >= 180000) {
                isNightMode = true;
                nightModeTriggerTime = currentMillis;
                darkReadingCount = 0;
                Serial.println(F("[MODE] Night Mode CONFIRMED! ESP32 will sleep after animation..."));
            }
        } else if (lightLux >= 10) {
            // Reset dark reading counter whenever light is detected
            static int darkReadingCount = 0;
            darkReadingCount = 0;
        }
        
        if (lightLux >= 30 && isNightMode) {
            isNightMode = false;
            Serial.println(F("[MODE] Day Mode Activated!"));
            activeAnimation = 3; // Sunrise
            animStartTime = currentMillis;
        }
    }

    if (isNightMode && !isSyncingOfflineQueue) {
        if (currentMillis - nightModeTriggerTime > 10000) {
            // Trigger Night Animation
            if (activeAnimation != 7) {
                activeAnimation = 7;
                animStartTime = millis();
                if (!screenIsOn) {
                    display.oled_command(0xAF); // Turn OLED ON to show animation!
                    screenIsOn = true;
                }
                drawOledPage();
            }
            
            // Wait for animation to finish then sleep
            if (millis() - animStartTime > 4500) {
                Serial.printf("[SLEEP] Night Mode: Entering Deep Sleep for %d minutes...\n", sleepIntervalMin);
                powerOffModules();
                
                // Enable wakeup sources:
                // 1. Physical button press (EXT1 on GPIO 26) - instant wake
                rtc_gpio_init((gpio_num_t)PIN_BUTTON_1);
                rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY);
                rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1);
                rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1);
                esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON_1), ESP_EXT1_WAKEUP_ALL_LOW);
                // 2. Scheduled timer
                esp_sleep_enable_timer_wakeup((uint64_t)sleepIntervalMin * 60000000ULL);
                
                esp_deep_sleep_start();
            }
        }
    } else {
        // DAYTIME LOGIC
        // 1. Force screen to stay on (override screenTimeoutSec) ONLY if day sleep is disabled!
        if (daySleepIntervalMin == 0) {
            lastScreenActiveTime = currentMillis; 
        }
        
        // 2. Autonomous Animations (debounce every 15 seconds)
        if (currentMillis - lastAutoAnimTime > 15000 && activeAnimation == 0) {
            if (rainValid && isRaining && (rainIntensity == "MEDIUM" || rainIntensity == "HEAVY")) {
                static unsigned long lastRainAnim = 0;
                if (currentMillis - lastRainAnim > 300000) { // 5 Minutes (300,000 ms)
                    activeAnimation = 1; // Rain
                    animStartTime = currentMillis;
                    lastAutoAnimTime = currentMillis;
                    lastRainAnim = currentMillis;
                }
            } else if (ahtValid && temperature > 35.0) {
                activeAnimation = 2; // Hot
                animStartTime = currentMillis;
                lastAutoAnimTime = currentMillis;
            }
        }
        
        // 3. Day Sleep Logic
        if (daySleepIntervalMin > 0 && currentMillis > 15000 && hasUploadedTelemetry && !isSyncingOfflineQueue) {
            // Only sleep if the screen has timed out! (Allows user to configure it if they wake it up)
            if (currentMillis - lastScreenActiveTime >= ((unsigned long)screenTimeoutSec * 1000)) {
                Serial.printf("[SLEEP] Day Mode: Entering Deep Sleep for %d minutes...\n", daySleepIntervalMin);
                powerOffModules();
                
                rtc_gpio_init((gpio_num_t)PIN_BUTTON_1);
                rtc_gpio_set_direction((gpio_num_t)PIN_BUTTON_1, RTC_GPIO_MODE_INPUT_ONLY);
                rtc_gpio_pullup_en((gpio_num_t)PIN_BUTTON_1);
                rtc_gpio_pulldown_dis((gpio_num_t)PIN_BUTTON_1);
                esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON_1), ESP_EXT1_WAKEUP_ALL_LOW);
                esp_sleep_enable_timer_wakeup((uint64_t)daySleepIntervalMin * 60000000ULL);
                
                esp_deep_sleep_start();
            }
        }
    }
}
