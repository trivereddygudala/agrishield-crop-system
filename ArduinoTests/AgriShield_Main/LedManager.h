#pragma once
#include <Arduino.h>

// ==========================================
// 6 LED Custom Hardware Pin Definitions
// All LEDs use 220Ω series resistors
// ==========================================
#define LED_WHITE_PIN   2   // GPIO 2  - White LED (Power ON / 5-Second Heartbeat Blink)
#define LED_GREEN_PIN   17  // GPIO 17 - Green LED (Wi-Fi Connected Solid ON / OFF when Disconnected)
#define LED_BLUE_PIN    5   // GPIO 5  - Blue LED (Bluetooth Connected Solid ON / OFF when Disconnected)
#define LED_YELLOW_PIN  18  // GPIO 18 - Yellow LED (Frontend / Cloud Data Transmission Flash)
#define LED_PAGE_PIN    19  // GPIO 19 - Page Switch Feedback LED (Pulses 150ms on Push Button press)
#define LED_RED_PIN     25  // GPIO 25 - RED Alert Indicator LED (Low Battery <20%, Sensor Disconnect, Alarms)

// LED Status Patterns
enum class LedPattern {
    OFF,              // All LEDs off
    BOOTING,          // Blue blink slow
    WIFI_CONNECTING,  // Blue blink fast
    WIFI_CONNECTED,   // Blue solid
    DATA_UPLOAD,      // Green blink
    DATA_SUCCESS,     // Green solid (brief)
    SENSOR_ERROR,     // Red blink
    CRITICAL_ERROR,   // Red solid
    LOW_BATTERY,      // Red slow blink
    CHARGING,         // Green pulse
    ALL_OK            // Green solid
};

class LedManager {
public:
    static void init();
    static void update();   // Call in loop() — handles non-blocking 6 LED logic
    static void setPattern(LedPattern pattern);
    
    // Direct control for 6 custom LEDs
    static void setWhite(bool on);
    static void setGreen(bool on);
    static void setBlue(bool on);
    static void setYellow(bool on);
    static void setPage(bool on);
    static void setRed(bool on);

    static void pulseYellow(uint32_t durationMs = 200);
    static void pulsePageLed(uint32_t durationMs = 150);
    
    static void allOff();
    static void allOn();
    static void runTestSequence();

private:
    static LedPattern _currentPattern;
    static unsigned long _lastToggle;
    static bool _toggleState;
};
