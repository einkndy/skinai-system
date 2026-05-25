import axios from "axios";
import { API_URL } from "../config";

export const predictSkin = async (imageFile) => {
    try {
        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await fetch(`${API_URL}/predict`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (data?.status === "error") {
            const error = new Error(data.message || "Model analisis belum tersedia");
            error.code = "ANALYSIS_OFFLINE";
            error.payload = data;
            throw error;
        }

        if (!response.ok) {
            const error = new Error(data?.message || "Gagal menjalankan analisis");
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
    const response = await axios.get(`${API_URL}/patients`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat pasien");
    }

    if (!Array.isArray(response.data)) {
        throw new Error("Format data pasien dari backend tidak valid");
    }

    return response.data;
};

export const getModelStatus = async () => {
    const response = await axios.get(`${API_URL}/model-status`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat status model");
    }

    return response.data;
};

export const getActivityLogs = async (limit = 8) => {
    const response = await axios.get(`${API_URL}/activity-logs`, {
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
    const response = await axios.get(`${API_URL}/devices`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat status device");
    }

    if (!Array.isArray(response.data)) {
        throw new Error("Format data device dari backend tidak valid");
    }

    return response.data;
};

export const getDeviceArchitecture = async () => {
    const response = await axios.get(`${API_URL}/devices/architecture`);

    if (response.data?.status === "error") {
        throw new Error(response.data.message || "Gagal memuat arsitektur device");
    }

    return response.data;
};


