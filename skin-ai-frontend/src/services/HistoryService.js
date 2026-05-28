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

  const adminData = JSON.parse(localStorage.getItem("admin"));

  if (adminData?.token) {
    config.headers.Authorization = `Bearer ${adminData.token}`;
  }

  return config;
});

const getErrorMessage = (error, fallback) => {
  return (
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
};

const assertBackendReady = (data, fallback) => {
  if (data?.status === "error") {
    throw new Error(data.message || fallback);
  }
};

export const getHistory = async () => {
  try {
    const response = await api.get(`/history`);

    assertBackendReady(response.data, "Gagal memuat history");

    if (!Array.isArray(response.data)) {
      throw new Error("Format data history dari backend tidak valid");
    }

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat history"));
  }
};

export const saveHistory = async (payload) => {
  try {
    const response = await api.post(`/save-history`, payload);

    assertBackendReady(response.data, "Gagal menyimpan history");

    console.log("SAVE HISTORY RESPONSE", response.data);

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal menyimpan history"));
  }
};

export const getHistoryById = async (id) => {
  try {
    const response = await api.get(`/history/${id}`);

    assertBackendReady(response.data, "Gagal memuat hasil");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat hasil"));
  }
};

export const getPatientById = async (id) => {
  try {
    const response = await api.get(`/patient/${id}`);

    assertBackendReady(response.data, "Gagal memuat pasien");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat pasien"));
  }
};

export const deleteHistory = async (id) => {
  try {
    const response = await api.delete(`/delete-history/${id}`);

    assertBackendReady(response.data, "Gagal menghapus history");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal menghapus history"));
  }
};

export const getUserDashboard = async () => {
  try {
    const response = await api.get(`/user/dashboard`);

    assertBackendReady(response.data, "Gagal memuat dashboard user");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat dashboard user"));
  }
};

export const getUserHistory = async () => {
  try {
    const response = await api.get(`/user/history`);

    assertBackendReady(response.data, "Gagal memuat riwayat user");

    if (!Array.isArray(response.data)) {
      throw new Error("Format data riwayat user dari backend tidak valid");
    }

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat riwayat user"));
  }
};

export const getUserHistoryById = async (id) => {
  try {
    const response = await api.get(`/user/history/${id}`);

    assertBackendReady(response.data, "Gagal memuat detail riwayat user");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat detail riwayat user"));
  }
};

export const getUserProfile = async () => {
  try {
    const response = await api.get(`/user/profile`);

    assertBackendReady(response.data, "Gagal memuat profile user");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal memuat profile user"));
  }
};

export const updateUserProfile = async (payload) => {
  try {
    const response = await api.put(`/user/profile`, payload);

    assertBackendReady(response.data, "Gagal menyimpan profile user");

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Gagal menyimpan profile user"));
  }
};


