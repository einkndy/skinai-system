/*
  SkinAI ESP32-CAM
  // Sprint B.2 heartbeat firmware
  // Sprint B.3 device communication preparation

  Scope:
  - Connect WiFi otomatis.
  - Auto register device via POST /devices/heartbeat.
  - Kirim heartbeat tiap 10 detik.
  - Berjalan tanpa USB permanen setelah firmware di-upload.
  - Listener Serial2 untuk CAPTURE_REQUEST.

  Not implemented in Sprint B.2:
  - Camera pin mapping.
  - Capture endpoint implementation.
  - Stream endpoint implementation.
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
#include "esp_camera.h"
#include "esp_http_server.h"
#include "WiFiClient.h"

const char* WIFI_SSID = "DIRECTOR ROOM";
const char* WIFI_PASSWORD = "rahasiaein3211";

const char* API_URL = "10.148.246.97:8000";
const char* HEARTBEAT_ENDPOINT = "/devices/heartbeat";
const char* UPLOAD_ENDPOINT = "/device-process";

const char* DEVICE_ID = "ESP_CAM_01";
const char* DEVICE_TYPE = "camera";
const char* FIRMWARE_VERSION = "1.0.0";
const char* DEVICE_LOCATION = "SkinAI Unit A";

const unsigned long HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long WIFI_RETRY_DELAY_MS = 1000;

const int SERIAL2_RX = 14;
const int SERIAL2_TX = 15;

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0

#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5

#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#define FLASH_LED_PIN      4

unsigned long lastHeartbeatAt = 0;
bool deviceRegistered = false;
bool cameraReady=false;
httpd_handle_t cameraHttpd = NULL;
httpd_handle_t streamHttpd = NULL;

const int CAPTURE_HTTP_PORT = 80;
const int STREAM_HTTP_PORT = 81;

static const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
static const char* STREAM_BOUNDARY = "\r\n--frame\r\n";
static const char* STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

bool uploadImage(camera_fb_t *fb);

static esp_err_t jpg_httpd_handler(httpd_req_t *req) {
  if (!cameraReady) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  camera_fb_t *fb = esp_camera_fb_get();

  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);

  esp_camera_fb_return(fb);
  return res;
}

static esp_err_t stream_handler(httpd_req_t *req) {
  if (!cameraReady) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  char partBuffer[64];
  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (res == ESP_OK) {
    camera_fb_t *fb = esp_camera_fb_get();

    if (!fb) {
      Serial.println("STREAM FRAME FAILED");
      res = ESP_FAIL;
      break;
    }

    size_t headerLength = snprintf(
      partBuffer,
      sizeof(partBuffer),
      STREAM_PART,
      fb->len
    );

    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));

    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, partBuffer, headerLength);
    }

    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    }

    esp_camera_fb_return(fb);

    if (res != ESP_OK) {
      break;
    }
  }

  return res;
}

static esp_err_t capture_trigger_handler(httpd_req_t *req) {
  Serial.println("CAPTURE TRIGGER RECEIVED");
  httpd_resp_set_type(req, "text/plain");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  if (!cameraReady) {
    Serial.println("CAPTURE FAILED");
    digitalWrite(FLASH_LED_PIN, LOW);
    Serial.println("FLASH OFF");
    httpd_resp_set_status(req, "500 Internal Server Error");
    httpd_resp_send(req, "capture_failed", HTTPD_RESP_USE_STRLEN);
    return ESP_FAIL;
  }

  Serial.println("FLASH ON");
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(150);

  Serial.println("CAPTURE START");
  camera_fb_t *fb = esp_camera_fb_get();

  if (!fb) {
    digitalWrite(FLASH_LED_PIN, LOW);
    Serial.println("CAPTURE FAILED");
    Serial.println("FLASH OFF");
    httpd_resp_set_status(req, "500 Internal Server Error");
    httpd_resp_send(req, "capture_failed", HTTPD_RESP_USE_STRLEN);
    return ESP_FAIL;
  }

  Serial.println("IMAGE CAPTURED");
  bool uploadOk = uploadImage(fb);
  esp_camera_fb_return(fb);

  digitalWrite(FLASH_LED_PIN, LOW);
  Serial.println("FLASH OFF");

  if (!uploadOk) {
    httpd_resp_set_status(req, "500 Internal Server Error");
    httpd_resp_send(req, "capture_failed", HTTPD_RESP_USE_STRLEN);
    return ESP_FAIL;
  }

  httpd_resp_send(req, "capture_upload_ok", HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}

void startCameraServer() {
  if (!cameraReady) {
    Serial.println("CAMERA SERVER SKIPPED");
    return;
  }

  if (cameraHttpd && streamHttpd) {
    return;
  }

  httpd_config_t captureConfig = HTTPD_DEFAULT_CONFIG();
  captureConfig.server_port = CAPTURE_HTTP_PORT;

  httpd_config_t streamConfig = HTTPD_DEFAULT_CONFIG();
  streamConfig.server_port = STREAM_HTTP_PORT;
  streamConfig.ctrl_port = 32769;

  httpd_uri_t captureUri = {
    .uri = "/capture",
    .method = HTTP_GET,
    .handler = jpg_httpd_handler,
    .user_ctx = NULL
  };

  httpd_uri_t streamUri = {
    .uri = "/stream",
    .method = HTTP_GET,
    .handler = stream_handler,
    .user_ctx = NULL
  };

  httpd_uri_t captureTriggerUri = {
    .uri = "/capture-trigger",
    .method = HTTP_GET,
    .handler = capture_trigger_handler,
    .user_ctx = NULL
  };

  Serial.println("START CAMERA SERVER");

  if (!cameraHttpd && httpd_start(&cameraHttpd, &captureConfig) == ESP_OK) {
    httpd_register_uri_handler(cameraHttpd, &captureUri);
    httpd_register_uri_handler(cameraHttpd, &captureTriggerUri);

    Serial.print("CAPTURE URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/capture");
    Serial.print("CAPTURE TRIGGER URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/capture-trigger");
  } else {
    Serial.println("CAPTURE SERVER FAILED");
  }

  if (!streamHttpd && httpd_start(&streamHttpd, &streamConfig) == ESP_OK) {
    httpd_register_uri_handler(streamHttpd, &streamUri);

    Serial.print("STREAM URL: http://");
    Serial.print(WiFi.localIP());
    Serial.print(":");
    Serial.print(STREAM_HTTP_PORT);
    Serial.println("/stream");
  } else {
    Serial.println("STREAM SERVER FAILED");
  }
}

String heartbeatUrl() {
  return String("http://") + API_URL + HEARTBEAT_ENDPOINT;
}

String heartbeatPayload() {
  String ip = WiFi.localIP().toString();

  return String("{") +
    "\"device_id\":\"" + DEVICE_ID + "\"," +
    "\"device_type\":\"" + DEVICE_TYPE + "\"," +
    "\"ip_address\":\"" + ip + "\"," +
    "\"stream_url\":\"http://" + ip + ":" + String(STREAM_HTTP_PORT) + "/stream\"," +
    "\"capture_url\":\"http://" + ip + "/capture\"," +
    "\"status\":\"online\"," +
    "\"firmware_version\":\"" + FIRMWARE_VERSION + "\"," +
    "\"location\":\"" + DEVICE_LOCATION + "\"" +
  "}";
}

String uploadUrl() {
  return String("http://") + API_URL + UPLOAD_ENDPOINT;
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

  String payload = heartbeatPayload();

  Serial.print("ESP32-CAM IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("HEARTBEAT PAYLOAD: ");
  Serial.println(payload);

  int statusCode = http.POST(payload);

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

bool uploadImage(camera_fb_t *fb) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  WiFiClient client;
  HTTPClient http;

  String boundary = "SkinAIBoundary";
  String head =
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  String tail =
    "\r\n--" + boundary + "--\r\n";

  int totalLength = head.length() + fb->len + tail.length();
  uint8_t *payload = (uint8_t*)malloc(totalLength);

  if (!payload) {
    Serial.println("UPLOAD FAILED");
    return false;
  }

  memcpy(payload, head.c_str(), head.length());
  memcpy(payload + head.length(), fb->buf, fb->len);
  memcpy(payload + head.length() + fb->len, tail.c_str(), tail.length());

  String url = uploadUrl();
  Serial.println("UPLOAD START");
  Serial.println(url);

  http.begin(client, url);
  http.addHeader(
    "Content-Type",
    "multipart/form-data; boundary=" + boundary
  );
  http.addHeader(
    "Content-Length",
    String(totalLength)
  );

  int code = http.POST(payload, totalLength);

  Serial.print("HTTP CODE: ");
  Serial.println(code);

  bool uploadOk = code >= 200 && code < 300;

  if (uploadOk) {
    Serial.println("UPLOAD SUCCESS");
  } else {
    Serial.println("UPLOAD FAILED");
  }

  free(payload);
  http.end();
  return uploadOk;
}

void listenSerialTrigger() {
  if (!Serial2.available()) {
    return;
  }

  String command = Serial2.readStringUntil('\n');
  command.trim();

  if(command=="CAPTURE_REQUEST"){

  Serial.println("TRIGGER RECEIVED");

  if(!cameraReady){

  Serial2.println("CAPTURE_FAILED");

  Serial.println("CAPTURE_FAILED");

  return;

  }

  camera_fb_t *fb=NULL;

  fb=esp_camera_fb_get();

  if(!fb){

  Serial2.println("CAPTURE_FAILED");

  Serial.println("CAPTURE_FAILED");

  return;

  }

  Serial.println("IMAGE CAPTURED");

  uploadImage(fb);

  esp_camera_fb_return(fb);

  Serial2.println("CAPTURE_OK");

  Serial.println("CAPTURE_OK");

  }
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, SERIAL2_RX, SERIAL2_TX);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  delay(300);

  connectWifi();

  setupCamera();

  startCameraServer();

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

  listenSerialTrigger();
}

void setupCamera() {

camera_config_t config;

config.ledc_channel=LEDC_CHANNEL_0;
config.ledc_timer=LEDC_TIMER_0;

config.pin_d0=Y2_GPIO_NUM;
config.pin_d1=Y3_GPIO_NUM;
config.pin_d2=Y4_GPIO_NUM;
config.pin_d3=Y5_GPIO_NUM;
config.pin_d4=Y6_GPIO_NUM;
config.pin_d5=Y7_GPIO_NUM;
config.pin_d6=Y8_GPIO_NUM;
config.pin_d7=Y9_GPIO_NUM;

config.pin_xclk=XCLK_GPIO_NUM;

config.pin_pclk=PCLK_GPIO_NUM;
config.pin_vsync=VSYNC_GPIO_NUM;
config.pin_href=HREF_GPIO_NUM;

config.pin_sscb_sda=SIOD_GPIO_NUM;
config.pin_sscb_scl=SIOC_GPIO_NUM;

config.pin_pwdn=PWDN_GPIO_NUM;
config.pin_reset=RESET_GPIO_NUM;

config.xclk_freq_hz=20000000;

config.pixel_format=PIXFORMAT_JPEG;

config.frame_size=FRAMESIZE_QVGA;

config.jpeg_quality=12;

config.fb_count=1;

esp_err_t err=esp_camera_init(&config);

if(err==ESP_OK){

cameraReady=true;

Serial.println("CAMERA INITIALIZED");

}
else{

Serial.println("CAMERA FAILED");

}

}
