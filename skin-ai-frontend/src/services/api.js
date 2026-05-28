import axios from "axios";
import { API_URL } from "../config";

const api = axios.create({
    baseURL: API_URL,

    timeout: 15000,

    headers: {
        "ngrok-skip-browser-warning": "true",
    },
});

api.interceptors.request.use((config) => {

  const adminSession = JSON.parse(localStorage.getItem("adminSession"));

  if (adminSession?.token) {
    config.headers.Authorization = `Bearer ${adminSession.token}`;
  }

  return config;
});

export const predictSkin = async (imageFile) => {
    try {
        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await api.post("/predict", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        const data = response.data;

        if (data?.status === "error") {
            const error = new Error(data.message || "Model analisis belum tersedia");
            error.code = "ANALYSIS_OFFLINE";
            error.payload = data;
            throw error;
        }

        return data;

    } catch (error) {

        console.error(error);

        if (!error.code) {
            error.code = "ANALYSIS_OFFLINE";
        }

        throw error;
    }
};

export const getPatients = async () => {
    const response = await api.get(`/patients`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat pasien");
    }

    if (!Array.isArray(response.data)) {
        throw new Error("Format data pasien dari backend tidak valid");
    }

    return response.data;
};

export const getModelStatus = async () => {
    const response = await api.get(`/model-status`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat status model");
    }

    return response.data;
};

export const getActivityLogs = async (limit = 8) => {
    const response = await api.get(`/activity-logs`, {
        params: {
            limit,
        },
    });

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat activity log");
    }

    if (!Array.isArray(response.data)) {
        throw new Error("Format activity log dari backend tidak valid");
    }

    return response.data;
};

export const getDevices = async () => {
    const response = await api.get(`/devices`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat status device");
    }

    if (!Array.isArray(response.data)) {
        throw new Error("Format data device dari backend tidak valid");
    }

    return response.data;
};

export const getDeviceArchitecture = async () => {
    const response = await api.get(`/devices/architecture`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat arsitektur device");
    }

    return response.data;
};


