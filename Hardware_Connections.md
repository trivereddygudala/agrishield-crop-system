# AgriShield Hardware Connections Reference

![AgriShield Wiring Diagram](C:\Users\trive\.gemini\antigravity-ide\brain\e18a9ba0-a397-49ef-8eb4-0dc1b6520f97\agrishield_wiring_diagram_1786070195076.png)

---

## 🔵 I²C Bus (Shared) — SDA: GPIO21 | SCL: GPIO22

> [!NOTE]
> All I²C devices share the same two wires. A 4.7kΩ pull-up resistor on SDA and SCL to 3.3V is recommended.

### AHT20 + BMP280 Combo Module
| Module Pin | ESP32 Pin | Wire Color |
|:---:|:---:|:---:|
| VCC | GPIO 4 (Sensor Power Gate) | 🔴 Red |
| GND | GND | ⚫ Black |
| SDA | GPIO 21 | 🟢 Green |
| SCL | GPIO 22 | 🔵 Blue |

### BH1750 Light Sensor
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VCC | GPIO 4 (Sensor Power Gate) | 🔴 Red |
| GND | GND | ⚫ Black |
| SDA | GPIO 21 | 🟢 Green |
| SCL | GPIO 22 | 🔵 Blue |
| ADDR | GND | Fixes I²C address to 0x23 |

### OLED Display (SH1107 128x64)
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VCC | 3.3V | 🔴 Red |
| GND | GND | ⚫ Black |
| SDA | GPIO 21 | 🟢 Green |
| SCL | GPIO 22 | 🔵 Blue |

---

## 🟠 SPI Bus — MicroSD Card Module
| Module Pin | ESP32 Pin | Wire Color |
|:---:|:---:|:---:|
| VCC | 3.3V | 🔴 Red |
| GND | GND | ⚫ Black |
| CS | GPIO 15 | 🟡 Yellow |
| SCK | GPIO 14 | 🟠 Orange |
| MISO | GPIO 12 | 🟣 Purple |
| MOSI | GPIO 13 | ⚪ White |

---

## 🟡 Analog Sensors

### Capacitive Soil Moisture Sensor
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VCC | GPIO 4 (Sensor Power Gate) | 🔴 Red |
| GND | GND | ⚫ Black |
| AOUT | GPIO 34 | ADC1_CH6 — Input only |

### Rain Sensor
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VCC | GPIO 4 (Sensor Power Gate) | 🔴 Red |
| GND | GND | ⚫ Black |
| AOUT | GPIO 35 | ADC1_CH7 — Input only |

### 18650 Battery Voltage Monitor
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VBAT (via divider) | GPIO 32 | ADC1_CH4 — Use 100kΩ+100kΩ voltage divider |
| STAT (USB Charger) | GPIO 33 | Charging status pin |

---

## 🌡️ DHT22 Temperature & Humidity (Backup)
| Module Pin | ESP32 Pin | Note |
|:---:|:---:|:---:|
| VCC | GPIO 4 (Sensor Power Gate) | 🔴 Red |
| GND | GND | ⚫ Black |
| DATA | GPIO 0 | Add 10kΩ pull-up to 3.3V |

> [!WARNING]
> GPIO 0 is a strapping pin. The DHT22 may interfere with flashing if it holds the line LOW at boot. Remove the wire before uploading code if you get upload errors.

---

## 💡 Status LEDs (All with 220Ω Series Resistor)

> [!WARNING]
> We have removed several LEDs from the design to save battery power and free up GPIO pins. Do NOT connect the Red, Orange, Blue, or Yellow LEDs as they will cause hardware conflicts with the Push Buttons and Sensor Power Gate!

| Color | GPIO | Function |
|:---:|:---:|:---|
| ⚪ White | GPIO 2 | Heartbeat — blinks every 5 seconds |
| 🟢 Green | GPIO 15 | Wi-Fi — solid ON when connected |

> [!TIP]
> Connect each LED **Anode (+)** to the GPIO pin via a 220Ω resistor. Connect the **Cathode (-)** directly to GND.

---

## 🔘 Push Buttons (Page Navigation)

| Button | GPIO | Function | Wiring |
|:---:|:---:|:---:|:---|
| BTN1 (Forward ▶) | GPIO 26 | Next OLED page / Wake from deep sleep | Between GPIO 26 and GND. Internal PULLUP enabled. |
| BTN2 (Back ◀) | GPIO 27 | Previous OLED page | Between GPIO 27 and GND. Internal PULLUP enabled. |

> [!IMPORTANT]
> **GPIO 27 is now used for BTN2.** The previous GPIO 14 was shared with the SD Card SCK pin which caused extreme glitching and blocked the Forward button. Please ensure your wiring is updated.

---

## ⚡ Power Rail Summary

| Rail | Source | Devices Powered |
|:---:|:---:|:---|
| 3.3V | ESP32 onboard regulator | All sensors, OLED, SD Card, LEDs |
| GND | Common ground | All components |
| VIN/5V | USB or 18650 Li-Ion via TP4056 | ESP32 VIN pin |

---

## 📋 Quick GPIO Reference Table

| GPIO | Function | Direction |
|:---:|:---:|:---:|
| 0 | DHT22 Data | INPUT |
| 2 | White LED (Heartbeat) | OUTPUT |
| 4 | Blue LED (Bluetooth) | OUTPUT |
| 12 | SD MISO / Yellow LED | OUTPUT/INPUT |
| 13 | SD MOSI | OUTPUT |
| 14 | SD SCK / BTN2 | OUTPUT/INPUT |
| 15 | SD CS | OUTPUT |
| 21 | I²C SDA | BIDIR |
| 22 | I²C SCL | OUTPUT |
| 25 | Not Used | - |
| 26 | BTN1 (Forward/Wake) | INPUT_PULLUP |
| 27 | BTN2 (Back) | INPUT_PULLUP |
| 32 | Battery ADC | INPUT |
| 33 | Charger STAT | INPUT |
| 34 | Soil Moisture ADC | INPUT |
| 35 | Rain Sensor ADC | INPUT |
