#include "ApiManager.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "SystemData.h"
#include "Logger.h"
#include "JsonManager.h"
#include "PreferencesManager.h"
#include "Config.h"
#include "ErrorManager.h"
#include "ErrorCodes.h"
#include "MemoryManager.h"
#include "LanguageManager.h"
#include <ESPmDNS.h>

String ApiManager::currentApiBaseUrl = FALLBACK_API_BASE_URL;

void ApiManager::init() {
    Logger::info("Initializing mDNS Auto-Discovery...");
    if (!MDNS.begin("esp32-agrishield-client")) {
        Logger::error("Error setting up mDNS responder!");
    } else {
        Logger::info("Resolving backend via mDNS: " + String(MDNS_HOSTNAME));
        IPAddress backend_ip = MDNS.queryHost(MDNS_HOSTNAME);
        if (backend_ip != INADDR_NONE) {
            currentApiBaseUrl = "http://" + backend_ip.toString() + ":8000/api/v1";
            Logger::info("mDNS Success! Backend found at: " + currentApiBaseUrl);
        } else {
            Logger::warning("mDNS failed to resolve " + String(MDNS_HOSTNAME) + ". Using fallback.");
        }
    }
}

String ApiManager::performHttpRequest(String endpoint, String payload, String method, uint16_t* outCode) {
    uint32_t heapBefore = MemoryManager::getFreeHeap();
    HTTPClient http;
    String fullUrl = currentApiBaseUrl + endpoint;
    
    if (fullUrl.startsWith("https://")) {
        WiFiClientSecure *client = new WiFiClientSecure;
        if(client) {
            client->setInsecure(); // Skip certificate validation
            http.begin(*client, fullUrl);
        } else {
            http.begin(fullUrl);
        }
    } else {
        http.begin(fullUrl);
    }
    
    http.setTimeout(8000); // 8000ms for reliable cloud & internet latency
    http.setReuse(false);
    
    String token = PreferencesManager::loadDeviceToken();
    if (token != "") {
        http.addHeader("Authorization", "Bearer " + token);
    }
    
    http.addHeader("Content-Type", "application/json");
    
    int httpCode;
    if (method == "POST") {
        httpCode = http.POST(payload);
    } else {
        httpCode = http.GET();
    }
    
    *outCode = httpCode;
    String response = "";
    if (httpCode > 0) {
        response = http.getString();
    }
    http.end();
    
    uint32_t heapAfter = MemoryManager::getFreeHeap();
    if (heapBefore != heapAfter) {
        // Logger::warning("HTTP Memory Leak Delta: " + String(heapBefore - heapAfter) + "B"); // Disable flood
    }
    return response;
}

String ApiManager::performRetriedHttpRequest(String endpoint, String payload, String method, uint16_t* outCode) {
    int maxRetries = 3;
    int retryDelay = 1000;
    
    for (int i = 0; i < maxRetries; i++) {
        String resp = performHttpRequest(endpoint, payload, method, outCode);
        if (*outCode == 200 || *outCode == 201) {
            return resp;
        }
        Logger::warning("HTTP " + method + " " + endpoint + " failed (Code: " + String(*outCode) + "). Retrying " + String(i+1) + "/3");
        delay(retryDelay);
        retryDelay *= 2; // Exponential backoff
    }
    return "";
}

bool ApiManager::checkHealth() {
    unsigned long start = millis();
    uint16_t code;
    performRetriedHttpRequest("/health", "", "GET", &code);
    unsigned long latency = millis() - start;
    
    SD_Network net = SystemData::getNetwork();
    net.apiHealthy = (code == 200);
    net.apiLatency = latency;
    net.lastResponseCode = code;
    SystemData::setNetwork(net);
    
    if (code != 200) {
        ErrorManager::throwError(E801);
        return false;
    }
    return true;
}

bool ApiManager::registerDevice() {
    if (PreferencesManager::hasDeviceToken()) {
        Logger::info("Device already registered.");
        return true;
    }
    
    Logger::info("Registering Device...");
    String payload = JsonManager::buildRegistrationJson();
    uint16_t code;
    String resp = performRetriedHttpRequest("/devices/register", payload, "POST", &code);
    
    SD_Network net = SystemData::getNetwork();
    net.lastResponseCode = code;
    
    if (code == 200 || code == 201) {
        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, resp);
        if (!err && doc.containsKey("token")) {
            PreferencesManager::saveDeviceToken(doc["token"].as<String>());
            Logger::info("Device Registered Successfully.");
            net.deviceRegistered = true;
            SystemData::setNetwork(net);
            return true;
        }
    }
    
    Logger::error("Device Registration Failed.");
    ErrorManager::throwError(E802);
    SystemData::setNetwork(net);
    return false;
}

bool ApiManager::sendHeartbeat() {
    Logger::debug("Sending Heartbeat...");
    String payload = JsonManager::buildHeartbeatJson();
    uint16_t code;
    performRetriedHttpRequest("/devices/heartbeat", payload, "POST", &code);
    
    SD_Network net = SystemData::getNetwork();
    net.lastResponseCode = code;
    if (code == 200) {
        net.lastHeartbeat = millis();
        SystemData::setNetwork(net);
        return true;
    }
    ErrorManager::throwError(E803);
    SystemData::setNetwork(net);
    return false;
}

bool ApiManager::postTelemetry(String payload) {
    Logger::info("Uploading Telemetry...");
    uint16_t code;
    String resp = performRetriedHttpRequest("/iot/telemetry", payload, "POST", &code);
    
    SD_Network net = SystemData::getNetwork();
    net.lastResponseCode = code;
    if (code == 200 || code == 201) {
        net.lastTelemetry = millis();
        SystemData::setNetwork(net);
        Logger::info("Telemetry Upload Successful.");

        if (resp != "") {
            StaticJsonDocument<256> doc;
            DeserializationError err = deserializeJson(doc, resp);
            if (!err && doc.containsKey("display_language")) {
                String lang = doc["display_language"].as<String>();
                LanguageManager::setLanguageByCode(lang);
                Logger::info("Display language synchronized to: " + lang);
            }
        }
        return true;
    }
    ErrorManager::throwError(E804);
    SystemData::setNetwork(net);
    return false;
}

bool ApiManager::downloadConfig() {
    String endpoint = "/devices/" + String(DEVICE_ID) + "/config";
    uint16_t code;
    String resp = performRetriedHttpRequest(endpoint, "", "GET", &code);
    
    SD_Network net = SystemData::getNetwork();
    net.lastResponseCode = code;
    if (code == 200) {
        net.lastConfigSync = millis();
        SystemData::setNetwork(net);
        Logger::info("Configuration synced successfully.");
        return true;
    }
    ErrorManager::throwError(E805);
    SystemData::setNetwork(net);
    return false;
}

bool ApiManager::checkOTA() {
    String endpoint = "/devices/" + String(DEVICE_ID) + "/ota";
    uint16_t code;
    String resp = performRetriedHttpRequest(endpoint, "", "GET", &code);
    
    SD_Network net = SystemData::getNetwork();
    net.lastResponseCode = code;
    if (code == 200) {
        net.lastOTAQuery = millis();
        SystemData::setNetwork(net);
        Logger::info("OTA Metadata retrieved.");
        return true;
    }
    ErrorManager::throwError(E806);
    SystemData::setNetwork(net);
    return false;
}

String ApiManager::pollCloudCommand() {
    String endpoint = "/devices/poll-commands/" + String(DEVICE_ID);
    
    // Fast single-try request to avoid blocking the ESP32 main loop
    HTTPClient http;
    String fullUrl = currentApiBaseUrl + endpoint;
    http.begin(fullUrl);
    http.setTimeout(500); // ⚡ FIX: 500ms MAX timeout so the physical push buttons don't freeze!
    http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Connection", "close");
    
    int code = http.GET();
    String resp = "";
    if (code > 0) {
        resp = http.getString();
    }
    http.end();
    
    if (code == 200 && resp.length() > 0) {
        // Simple JSON parsing just for the command string
        // Expected: {"command": "/anim-rain"} or {"command": null}
        if (resp.indexOf("\"command\":null") == -1 && resp.indexOf("\"command\": null") == -1) {
            int startIdx = resp.indexOf("\"command\":\"");
            if (startIdx != -1) {
                startIdx += 11;
                int endIdx = resp.indexOf("\"", startIdx);
                if (endIdx != -1) {
                    return resp.substring(startIdx, endIdx);
                }
            }
        }
    }
    return "";
}
