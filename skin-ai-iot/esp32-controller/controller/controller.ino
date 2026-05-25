/*
  SkinAI ESP32 Controller
  // Sprint B.2 heartbeat firmware
  // Sprint B.3 device communication preparation

  Scope:
  - Connect WiFi otomatis.
  - Auto register device via POST /devices/heartbeat.
  - Kirim heartbeat tiap 10 detik.
  - Berjalan tanpa USB permanen setelah firmware di-upload.
  - Simulasi trigger Serial2 tiap 15 detik.

  Not implemented in Sprint B.2:
  - GPIO button wiring.
  - Serial antar device.

  Not implemented in Sprint B.3:
  - Button.
  - GPIO fisik.
  - Upload gambar.
  - Capture kamera.
  - Stream.
  - AI predict.
  - Backend save.
*/

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "DIRECTOR ROOM";
const char* WIFI_PASSWORD = "rahasiaein3211";

const char* API_URL = "10.148.246.97:8000";
const char* HEARTBEAT_ENDPOINT = "/devices/heartbeat";
const char* ESP32_CAM_IP = "10.148.246.163";
const char* CAPTURE_TRIGGER_ENDPOINT = "/capture-trigger";

const char* DEVICE_ID = "ESP_CTRL_01";
const char* DEVICE_TYPE = "controller";
const char* FIRMWARE_VERSION = "1.0.0";
const char* DEVICE_LOCATION = "SkinAI Unit A";

const unsigned long HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long WIFI_RETRY_DELAY_MS = 1000;

const int SERIAL2_RX = 16;
const int SERIAL2_TX = 17;

const int BUTTON_PIN = 13;
bool lastButtonState = HIGH;
bool stableButtonState = HIGH;
unsigned long lastButtonDebounceAt = 0;

unsigned long lastHeartbeatAt = 0;
bool deviceRegistered = false;
const unsigned long BUTTON_DEBOUNCE_MS = 75;

String heartbeatUrl() {
  return String("http://") + API_URL + HEARTBEAT_ENDPOINT;
}

String heartbeatPayload() {
  return String("{") +
    "\"device_id\":\"" + DEVICE_ID + "\"," +
    "\"device_type\":\"" + DEVICE_TYPE + "\"," +
    "\"firmware_version\":\"" + FIRMWARE_VERSION + "\"," +
    "\"location\":\"" + DEVICE_LOCATION + "\"" +
  "}";
}

String captureTriggerUrl() {
  return String("http://") + ESP32_CAM_IP + CAPTURE_TRIGGER_ENDPOINT;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    Serial.println("WIFI RETRY...");
    delay(WIFI_RETRY_DELAY_MS);
  }

  Serial.println("WIFI CONNECTED");
  Serial.println(WiFi.localIP());
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  HTTPClient http;
  http.begin(heartbeatUrl());
  http.addHeader("Content-Type", "application/json");

  int statusCode = http.POST(heartbeatPayload());

  Serial.print("HEARTBEAT STATUS: ");
  Serial.println(statusCode);

  if (statusCode >= 200 && statusCode < 300) {
    if (!deviceRegistered) {
      Serial.println("DEVICE REGISTERED");
      deviceRegistered = true;
    }

    Serial.println("HEARTBEAT SENT");
  } else {
    Serial.println("SERVER OFFLINE");
  }

  http.end();
}

void sendTrigger() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  HTTPClient http;
  String url = captureTriggerUrl();

  Serial.println("TRIGGER REQUEST SENT");
  Serial.println(url);

  http.begin(url);
  int statusCode = http.GET();

  if (statusCode >= 200 && statusCode < 300) {
    Serial.println("ESP32-CAM RESPONSE OK");
    Serial.println(http.getString());
  } else {
    Serial.println("TRIGGER FAILED");
  }

  http.end();
}

void readCameraResponse() {
  if (!Serial2.available()) {
    return;
  }

  String response = Serial2.readStringUntil('\n');
  response.trim();

  if (response.length() > 0) {
    Serial.println(response);
  }
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, SERIAL2_RX, SERIAL2_TX);
  delay(300);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  connectWifi();
  sendHeartbeat();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  unsigned long now = millis();

  if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAt = now;
    sendHeartbeat();
  }

  bool currentButtonState = digitalRead(BUTTON_PIN);

  if (currentButtonState != lastButtonState) {
    lastButtonDebounceAt = now;
  }

  if ((now - lastButtonDebounceAt) > BUTTON_DEBOUNCE_MS) {
    if (currentButtonState != stableButtonState) {
      stableButtonState = currentButtonState;

      if (stableButtonState == LOW) {
        Serial.println("BUTTON PRESSED");
        sendTrigger();
      }
    }
  }

  lastButtonState = currentButtonState;

  readCameraResponse();
}
