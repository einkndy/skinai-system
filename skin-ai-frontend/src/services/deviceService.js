import { API_URL } from "../config";

export const CAMERA_DEVICE_TYPE = "camera";
export const DEFAULT_CAMERA_DEVICE_ID = "ESP_CAM_01";

const PROXY_ACTIONS = new Set(["stream"]);

export const isCameraDevice = (device) =>
  (device?.device_type || "").trim().toLowerCase() === CAMERA_DEVICE_TYPE;

export const isEspDeviceConnected = (device) =>
  device?.status === "online" ||
  device?.connected === true ||
  device?.online === true ||
  device?.is_online === true ||
  device?.active === true;

export const selectCameraDevice = (devices = []) => {
  if (!Array.isArray(devices)) return null;

  const cameraDevices = devices.filter(isCameraDevice);

  return (
    cameraDevices.find(
      (device) =>
        device.device_id === DEFAULT_CAMERA_DEVICE_ID &&
        isEspDeviceConnected(device)
    ) ||
    cameraDevices.find(isEspDeviceConnected) ||
    null
  );
};

const getCameraDeviceId = (device) => {
  if (!isCameraDevice(device) || !device?.device_id) return "";

  return device.device_id;
};

export const getDeviceProxyUrl = (device, action) => {
  const deviceId = getCameraDeviceId(device);

  if (!deviceId || !PROXY_ACTIONS.has(action)) return "";

  return `${API_URL}/devices/${encodeURIComponent(deviceId)}/${action}-proxy`;
};

export const getDeviceStreamUrl = (device) => getDeviceProxyUrl(device, "stream");

export const getDeviceTriggerUrl = (device) => {
  const deviceId = getCameraDeviceId(device);

  if (!deviceId) return "";

  return `${API_URL}/devices/${encodeURIComponent(deviceId)}/capture-trigger`;
};

export const getLatestDeviceCaptureUrl = (afterTimestamp) => {
  const afterQuery =
    afterTimestamp !== undefined && afterTimestamp !== null
      ? `after=${encodeURIComponent(afterTimestamp)}&`
      : "";

  return `${API_URL}/device-capture/latest-image?${afterQuery}t=${Date.now()}`;
};

export const getLatestDeviceCapturePollingUrl = () =>
  getLatestDeviceCaptureUrl();
