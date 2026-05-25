import { toast } from "sonner";

export const showWarning = (message) => {
  toast.warning(message || "Data belum lengkap");
};

export const showSuccess = (message) => {
  toast.success(message || "Berhasil");
};

export const showError = (message) => {
  toast.error(message || "Terjadi kesalahan");
};

export const showAiOffline = () => {
  toast.error("Server analisis sedang offline. Coba lagi setelah model aktif.");
};

export const showLoading = (message) => {
  toast.loading(message || "Sistem sedang menganalisis...");
};

export const confirmSave = async () => {
  return true;
};

export const showSaving = () => {
  toast.loading("Menyimpan hasil rekam medis...");
};

export const showCompleteFlow = () => {
  toast.success("Pemeriksaan berhasil disimpan. Menyiapkan halaman hasil...");
  return Promise.resolve();
};

export const closeAlert = () => {
  toast.dismiss();
};


