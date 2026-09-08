#pragma once
// Global Debug Mode
#define DEBUG_MODE 1 // 0=OFF, 1=INFO, 2=VERBOSE

// Multi-WiFi Configuration Struct
struct KnownWiFi {
    const char* ssid;
    const char* password;
    const char* api_url;
};

// Global Local Backend URL
#define LOCAL_API_URL "http://10.87.104.146:8000/api/v1"

// Add all your Wi-Fi networks here - they will all connect to the local backend!
const KnownWiFi KNOWN_WIFI_NETWORKS[] = {
    {"vivot4pro", "12345678900", LOCAL_API_URL},    // Mobile Phone Hotspot
    {"unknown", "reddygariabbayi", LOCAL_API_URL},  // Laptop's Hotspot / Home Wi-Fi
    {"", "", LOCAL_API_URL}                         // Farm Backup
};

const int KNOWN_WIFI_COUNT = sizeof(KNOWN_WIFI_NETWORKS) / sizeof(KNOWN_WIFI_NETWORKS[0]);

// Legacy single Wi-Fi fallbacks
#define WIFI_SSID KNOWN_WIFI_NETWORKS[0].ssid
#define WIFI_PASS KNOWN_WIFI_NETWORKS[0].password

// Backend URL
#define MDNS_HOSTNAME "agrishield-api"
#define FALLBACK_API_BASE_URL LOCAL_API_URL
#define DEVICE_ID "ESP32-NODE-ALPHA"

// Display Language ("EN" = English, "HI" = Hindi, "TE" = Telugu, "TA" = Tamil)
#define DISPLAY_LANGUAGE "EN"

// Test Selector (Phase 1)
#define RUN_TEST_MODE 0 // 0=Production, 1=OLED, 2=DHT, 3=BH1750
