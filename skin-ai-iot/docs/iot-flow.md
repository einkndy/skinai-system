# SkinAI IoT Flow

Sprint B.1 defines the communication contract only. Physical wiring and pin mapping are intentionally not implemented yet.

## Device Flow

```text
Button
↓
ESP32 utama
↓
trigger
ESP32-CAM
↓
capture
↓
backend
↓
predict
↓
save
↓
dashboard
```

## Devices

### ESP32 Controller

```json
{
  "device_id": "ESP_CTRL_01",
  "device_type": "controller",
  "firmware_version": "1.0.0",
  "location": "SkinAI Unit A"
}
```

Responsibilities:

- Connect to WiFi.
- Send heartbeat to backend.
- Auto-register through heartbeat.
- Receive button trigger.
- Trigger ESP32-CAM capture.

### ESP32-CAM

```json
{
  "device_id": "ESP_CAM_01",
  "device_type": "camera",
  "firmware_version": "1.0.0",
  "location": "SkinAI Unit A"
}
```

Responsibilities:

- Connect to WiFi.
- Send heartbeat to backend.
- Auto-register through heartbeat.
- Expose capture endpoint.
- Expose stream endpoint.

## Backend Endpoints

### `POST /devices/heartbeat`

Registers a device if `device_id` is new, otherwise updates the device status and `last_seen`.

Controller payload:

```json
{
  "device_id": "ESP_CTRL_01",
  "device_type": "controller",
  "firmware_version": "1.0.0",
  "location": "SkinAI Unit A"
}
```

Camera payload:

```json
{
  "device_id": "ESP_CAM_01",
  "device_type": "camera",
  "firmware_version": "1.0.0",
  "location": "SkinAI Unit A"
}
```

Expected backend logs:

```text
DEVICE REGISTERED
DEVICE HEARTBEAT OK
```

### `GET /devices/{device_id}/status`

Returns current identity and status for one device.

### `GET /devices`

Returns all registered devices for the Dashboard Device System.

## Device Endpoints

### `POST /capture`

Exposed by ESP32-CAM. The controller can call this endpoint to trigger still image capture.

### `GET /stream`

Exposed by ESP32-CAM. The frontend can use this endpoint for live preview.

## Sprint B.1 Completion Log

```text
IOT CONTRACT READY
```
