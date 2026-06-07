#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_camera.h>
#include <esp_http_server.h>
#include <config.h>


const char* WiFi_SSID = "Einsten321";
const char* WiFi_PASSWORD = "rahasia2026";

const char* HEARTBEAT_ENDPOINT = "/devices/heratbeat";
const char* UPLOUD_ENDPOINT = "/device-process";

const char* DEVICE_ID = "/ESP_CAM_01";
const char* DEVICE_TYPE = "/camera";
const char* FIRMWARE_VERSION ="1.0.0";
const char* DEVICE_LOCATION = "SkinAI Unit A";

const unsigned long HEARTBEAT_INTERVAL_MS = 10000;
const unsigned long WIFI_RETRY_DELAY_MS = 1000;

const int SERIAL2_RX = 14;
const int SERIAL2_TX = 15;

#devine PWDN_GPIO_NUM 32
#devine RESET_GPIO_NUM -1
#devine XCLK_GPIO_NUM 0
#devine
#devine
#devine
#devine
#devine
#devine
#devine
#devine
#devine
