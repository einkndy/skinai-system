# SkinAI IoT Deployment

Sprint B.1 deployment plan only. No physical wiring is included in this sprint.

## Deployment Flow

```text
Upload firmware via USB satu kali
↓
simpan SSID/password
↓
cabut USB
↓
power adaptor
↓
auto connect WiFi
↓
heartbeat
↓
dashboard online
```

## Firmware Units

### ESP32 Controller

Path:

```text
skin-ai-iot/esp32-controller/controller.ino
```

Boot sequence:

1. Start serial monitor.
2. Print `IOT CONTRACT READY`.
3. Connect to WiFi.
4. Send `POST /devices/heartbeat`.
5. Wait for button trigger.
6. Trigger ESP32-CAM capture endpoint.

### ESP32-CAM

Path:

```text
skin-ai-iot/esp32-cam/espcam.ino
```

Boot sequence:

1. Start serial monitor.
2. Print `IOT CONTRACT READY`.
3. Connect to WiFi.
4. Send `POST /devices/heartbeat`.
5. Start `POST /capture`.
6. Start `GET /stream`.

## Backend Readiness

Required backend endpoints:

```text
POST /devices/heartbeat
GET /devices/{device_id}/status
GET /devices
```

Expected dashboard state:

```text
ESP_CAM_01 online
ESP_CTRL_01 online
```

## Notes

- SSID/password storage is planned for the firmware implementation sprint.
- Button pin mapping is intentionally left blank.
- Camera board pin mapping is intentionally left blank.
- The stable SkinAI flow `predict → save → result` is not changed by this contract.
