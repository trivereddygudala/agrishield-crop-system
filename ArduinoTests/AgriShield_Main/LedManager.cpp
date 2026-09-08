#include "LedManager.h"
#include "SystemData.h"
#include "Logger.h"

// Static member initialization
LedPattern LedManager::_currentPattern = LedPattern::OFF;
unsigned long LedManager::_lastToggle = 0;
bool LedManager::_toggleState = false;

static unsigned long _lastHeartbeat = 0;
static unsigned long _yellowOffTime = 0;
static unsigned long _pageLedOffTime = 0;

void LedManager::init() {
    /*
    pinMode(LED_WHITE_PIN, OUTPUT);
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_BLUE_PIN, OUTPUT);
    pinMode(LED_YELLOW_PIN, OUTPUT);
    pinMode(LED_PAGE_PIN, OUTPUT);
    pinMode(LED_RED_PIN, OUTPUT);
    
    digitalWrite(LED_WHITE_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(LED_BLUE_PIN, LOW);
    digitalWrite(LED_YELLOW_PIN, LOW);
    digitalWrite(LED_PAGE_PIN, LOW);
    digitalWrite(LED_RED_PIN, LOW);
    */

    // Allow PWM hardware time to settle
    delay(10);
    Logger::info("LedManager Initialized (White:GPIO2, Green:GPIO17, Blue:GPIO5, Yellow:GPIO18, Page:GPIO19, RED:GPIO25).");
}

void LedManager::setWhite(bool on)  { /* digitalWrite(LED_WHITE_PIN, on ? HIGH : LOW); */ }
void LedManager::setGreen(bool on)  { /* digitalWrite(LED_GREEN_PIN, on ? HIGH : LOW); */ }
void LedManager::setBlue(bool on)   { /* digitalWrite(LED_BLUE_PIN, on ? HIGH : LOW); */ }
void LedManager::setYellow(bool on) { /* digitalWrite(LED_YELLOW_PIN, on ? HIGH : LOW); */ }
void LedManager::setPage(bool on)   { /* digitalWrite(LED_PAGE_PIN, on ? HIGH : LOW); */ }
void LedManager::setRed(bool on)    { /* digitalWrite(LED_RED_PIN, on ? HIGH : LOW); */ }

void LedManager::pulseYellow(uint32_t durationMs) {
    // digitalWrite(LED_YELLOW_PIN, HIGH);
    _yellowOffTime = millis() + durationMs;
}

void LedManager::pulsePageLed(uint32_t durationMs) {
    // digitalWrite(LED_PAGE_PIN, HIGH);
    _pageLedOffTime = millis() + durationMs;
}

void LedManager::allOff() {
    setWhite(false);
    setGreen(false);
    setBlue(false);
    setYellow(false);
    setPage(false);
    setRed(false);
}

void LedManager::allOn() {
    setWhite(true);
    setGreen(true);
    setBlue(true);
    setYellow(true);
    setPage(true);
    setRed(true);
}

void LedManager::setPattern(LedPattern pattern) {
    _currentPattern = pattern;
    if (pattern == LedPattern::DATA_UPLOAD) {
        pulseYellow(300);
    }
}

void LedManager::update() {
    unsigned long now = millis();
    SD_Network net = SystemData::getNetwork();
    SD_Sensors sens = SystemData::getSensors();

    // 1. LED1: White LED - Power Supply Heartbeat (Blinks for 200ms every 5 seconds)
    if (now - _lastHeartbeat >= 5000) {
        _lastHeartbeat = now;
        // digitalWrite(LED_WHITE_PIN, HIGH);
    } else if (now - _lastHeartbeat >= 200) {
        // digitalWrite(LED_WHITE_PIN, LOW);
    }

    // 2. LED2: Green LED - Wi-Fi Status (50% Dimmed Brightness = PWM 128)
    // analogWrite(LED_GREEN_PIN, net.wifiConnected ? 128 : 0);

    // 3. LED3: Blue LED - Bluetooth Status (50% Dimmed Brightness = PWM 128)
    // analogWrite(LED_BLUE_PIN, net.bleConnected ? 128 : 0);

    // 4. LED4: Yellow LED - Data Transmit Pulse Auto Turn-OFF
    if (_yellowOffTime > 0 && now >= _yellowOffTime) {
        // digitalWrite(LED_YELLOW_PIN, LOW);
        _yellowOffTime = 0;
    }

    // 5. LED5: Page Switch LED Auto Turn-OFF
    if (_pageLedOffTime > 0 && now >= _pageLedOffTime) {
        // digitalWrite(LED_PAGE_PIN, LOW);
        _pageLedOffTime = 0;
    }

    // 6. LED6: RED Alert LED (GPIO 26) - Low Battery <20%, Sensor Disconnects & Field Alarms
    bool lowBattery = (sens.batteryValid && sens.batteryPercentage < 20) || (sens.batteryVoltage > 0.0 && sens.batteryVoltage < 3.4);
    bool sensorFault = (!sens.temperatureValid || !sens.humidityValid || !sens.soilValid || !sens.lightValid);
    bool criticalAlarm = (sens.soilValid && sens.soilMoisture < 15.0) || (sens.temperatureValid && (sens.temperature > 42.0 || sens.temperature < 2.0));

    if (criticalAlarm) {
        // digitalWrite(LED_RED_PIN, HIGH); // Solid RED ON for critical field emergency
    } else if (lowBattery || sensorFault) {
        bool blinkState = (now / 200) % 2 == 0;
        // digitalWrite(LED_RED_PIN, blinkState ? HIGH : LOW); // Blink RED LED (200ms ON / 200ms OFF)
    } else {
        // digitalWrite(LED_RED_PIN, LOW); // System Normal
    }
}

void LedManager::runTestSequence() {
    Logger::info("LED Test Sequence: Flashing 5 Status LEDs...");
    allOff();
    delay(200);
    setWhite(true);  delay(200); setWhite(false);
    setGreen(true);  delay(200); setGreen(false);
    setBlue(true);   delay(200); setBlue(false);
    setYellow(true); delay(200); setYellow(false);
    setPage(true);   delay(200); setPage(false);
    allOn();         delay(400); allOff();
    Logger::info("LED Test Sequence: Complete.");
}
