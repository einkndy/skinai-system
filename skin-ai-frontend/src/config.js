const config = {

  // BACKEND PRODUCTION
  API_BASE_URL: "https://skinai-backend-pb4j.onrender.com",

  // BACKEND LOCAL
  LOCAL_API_URL: "http://127.0.0.1:8000",

  // ESP32 LOCAL NETWORK
  ESP32_IP: "10.148.246.163",
  ESP32_STREAM_PORT: 81,

};

export const API_URL = import.meta.env.VITE_API_URL || config.LOCAL_API_URL;

export const ESP32_IP = config.ESP32_IP;

export const ESP_IP = `http://${config.ESP32_IP}`;

export const STREAM_URL = `http://${config.ESP32_IP}:${config.ESP32_STREAM_PORT}/stream`;

export const CAPTURE_URL = `${ESP_IP}/capture`;

export default config;