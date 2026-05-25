import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Camera, CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { AnimatedPage, AnalysisTimeline, ButtonSpinner, EmptyState, LoadingScreen, ProgressAI, StatusBadge } from "../components/ui";
import {
  predictSkin,
  getPatients,
  getDevices
} from "../services/api";
import { getHistory, saveHistory } from "../services/HistoryService";
import { markSaveFlow } from "../services/flowAudit";
import {
  API_URL,
  ESP_IP,
  ESP32_IP,
  STREAM_URL,
  CAPTURE_URL,
} from "../config";
import {
  showAiOffline,
  showError,
  showWarning,
} from "../services/alertService";

export default function AnalisisBaru() {
  const [cameraOnline, setCameraOnline] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [espLatency, setEspLatency] = useState(null);
  const [espRetryCount, setEspRetryCount] = useState(0);
  const location = useLocation();


  const [liveMode, setLiveMode] = useState(true);

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    nama: "",
    tanggal: "",
    tipe: "sekali",
  });

  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [capturedImage, setCapturedImage] = useState("");
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [confirmingPhoto, setConfirmingPhoto] = useState(false);
  const [espReconnecting, setEspReconnecting] = useState(false);
  const [espChecking, setEspChecking] = useState(false);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);
  const [previewMode, setPreviewMode] = useState("stream");
  const [selectedImage, setSelectedImage] = useState("");
  const [confirmedImage, setConfirmedImage] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [isPhotoConfirmed, setIsPhotoConfirmed] = useState(false);
  const [confirmedFile, setConfirmedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [aiMessage, setAiMessage] = useState("Mendeteksi struktur wajah...");
  const [estimate, setEstimate] = useState(5);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [pendingHistoryPayload, setPendingHistoryPayload] = useState(null);
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedHistoryId, setSavedHistoryId] = useState(null);
  const [savingResult, setSavingResult] = useState(false);
  const [emailPasien, setEmailPasien] = useState("");

  const analysisSteps = [
    "Deteksi Area Wajah",
    "Analisis Tekstur Kulit",
    "Identifikasi Pori & Jerawat",
    "Klasifikasi Jenis Kulit",
    "Menyusun Rekomendasi Perawatan",
  ];

  const aiMessages = [
    "Mendeteksi struktur wajah...",
    "Menganalisis tekstur kulit...",
    "Mengidentifikasi pori dan jerawat...",
    "Mengklasifikasi jenis kulit...",
    "Menyusun rekomendasi perawatan...",
  ];

  const [modePasien, setModePasien] = useState("baru");

  const [patients, setPatients] = useState([]);

  const [selectedPatient, setSelectedPatient] = useState(null);

  const [namaPasien, setNamaPasien] = useState("");

  const [paketType, setPaketType] = useState("basic");

  const [sourceMode, setSourceMode] = useState("esp32");
  const [internalCamOn, setInternalCamOn] = useState(false);
  const videoRef = useRef(null);
  const espStreamRef = useRef(null);
  const captureTimeoutRef = useRef(null);
  const progressTimeoutRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const imageObjectUrlRef = useRef(null);
  const streamBaseUrlRef = useRef("");
  const streamRefreshTimerRef = useRef(null);
  const streamHealthTimerRef = useRef(null);
  const captureFlashTimerRef = useRef(null);
  const captureSuccessTimerRef = useRef(null);
  const reconnectSuccessNotifiedRef = useRef(false);
  const reconnectInFlightRef = useRef(false);
  const lastReconnectAttemptRef = useRef(0);
  const lastHardwareCaptureRef = useRef("");
  const manualCaptureInFlightRef = useRef(false);

  const revokeImageObjectUrl = () => {
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = null;
    }
  };

  const stopInternalCamera = () => {
    const stream = videoRef.current?.srcObject;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      console.log("CAMERA CLEANUP OK");
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setInternalCamOn(false);
  };

  const startInternalCamera = async () => {
    try {
      stopInternalCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setInternalCamOn(true);
    } catch (error) {
      console.error("INTERNAL CAMERA ERROR:", error);
      toast.error("Kamera internal gagal diakses");
      showError("Kamera internal tidak diizinkan / tidak tersedia.");
    }
  };

  const captureInternalCamera = () => {
    if (captureLoading) return;

    const video = videoRef.current;

    if (!video || !video.srcObject) {
      showWarning("Kamera belum aktif.");
      return;
    }

    setCaptureLoading(true);
    triggerCaptureFlash();
    playShutterSound();

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const imgData = canvas.toDataURL("image/png");
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.png", {
        type: "image/png",
      });

      setImageFile(file);
      setSelectedImage(imgData);
      setConfirmedImage(imgData);
      setIsAnalyzing(false);
      setProgress(0);
      setActiveStep(0);
      setAiMessage(aiMessages[0]);
      setEstimate(5);
      setAnalysisComplete(false);
      triggerCaptureSuccess();
      setCaptureLoading(false);
    });

    setImage(imgData);
    setSelectedImage(imgData);
    setConfirmedImage(imgData);
    setIsAnalyzing(false);
    setProgress(0);
    setActiveStep(0);
    setAiMessage(aiMessages[0]);
    setEstimate(5);
    setAnalysisComplete(false);

    stopInternalCamera();
    toast.success("Foto kamera internal berhasil diambil");
  };

  const switchToEsp32 = () => {
    stopInternalCamera();
    revokeImageObjectUrl();
    setImage(null);
    setPreviewMode("stream");
    setCapturedImage("");
    setSelectedImage("");
    setConfirmedImage("");
    setResultImage("");
    setShowCapturePreview(false);
    setIsPhotoConfirmed(false);
    setIsAnalyzing(false);
    setProgress(0);
    setActiveStep(0);
    setAiMessage(aiMessages[0]);
    setEstimate(5);
    setAnalysisComplete(false);
    setSourceMode("esp32");
    checkEspConnection({ force: true });
  };
  const switchToUpload = () => {
    stopInternalCamera();
    revokeImageObjectUrl();
    setImage(null);
    setConfirmedImage("");
    setResultImage("");
    setIsAnalyzing(false);
    setProgress(0);
    setActiveStep(0);
    setAiMessage(aiMessages[0]);
    setEstimate(5);
    setAnalysisComplete(false);
    setSourceMode("upload");
  };

  const createEspCaptureFromBlob = (
    blob,
    sourceLabel = "ESP32",
    successMessage = "Capture ESP32 berhasil",
    options = {}
  ) => {
    if (!blob?.size) {
      throw new Error("Capture blob kosong");
    }

    const {
      fileName = "esp32-capture.jpg",
      syncPreviewImage = false,
    } = options;

    revokeImageObjectUrl();
    const objectUrl = URL.createObjectURL(blob);
    imageObjectUrlRef.current = objectUrl;

    const file = new File([blob], fileName, {
      type: blob.type || "image/jpeg",
    });

    setConfirmedFile(file);
    setImageFile(file);
    setCapturedImage(objectUrl);
    setShowCapturePreview(true);
    setSelectedImage(objectUrl);
    setConfirmedImage(objectUrl);

    if (syncPreviewImage) {
      setImage(objectUrl);
      setResultImage("");
    }

    triggerCaptureSuccess();

    console.log(
      "CAPTURE SUCCESS",
      sourceLabel,
      blob.type,
      blob.size
    );
    toast.success(successMessage);
  };

  const ensureCapturedFile = async () => {
    if (confirmedFile) return confirmedFile;
    if (imageFile) return imageFile;

    if (!capturedImage) {
      throw new Error("Preview capture belum tersedia");
    }

    const blob = await fetchCaptureBlob(capturedImage);
    const file = new File([blob], "esp32-confirmed-capture.jpg", {
      type: blob.type || "image/jpeg",
    });

    setConfirmedFile(file);
    setImageFile(file);
    return file;
  };

  const triggerCaptureFlash = () => {
    setCaptureFlash(true);

    if (captureFlashTimerRef.current) {
      clearTimeout(captureFlashTimerRef.current);
    }

    captureFlashTimerRef.current = window.setTimeout(() => {
      setCaptureFlash(false);
      captureFlashTimerRef.current = null;
    }, 220);
  };

  const triggerCaptureSuccess = () => {
    setCaptureSuccess(true);

    if (captureSuccessTimerRef.current) {
      clearTimeout(captureSuccessTimerRef.current);
    }

    captureSuccessTimerRef.current = window.setTimeout(() => {
      setCaptureSuccess(false);
      captureSuccessTimerRef.current = null;
    }, 1100);
  };

  const playShutterSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) return;

      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.11);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      window.setTimeout(() => audioContext.close?.(), 180);
    } catch {
      // Optional UX sound only; capture must continue when browser audio is blocked.
    }
  };

  const captureEspStreamFrame = () =>
    new Promise((resolve, reject) => {
      const img = espStreamRef.current;

      if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
        reject(new Error("Stream frame belum siap"));
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob?.size) {
            resolve(blob);
            return;
          }

          reject(new Error("Canvas capture kosong"));
        }, "image/jpeg", 0.92);
      } catch (error) {
        reject(error);
      }
    });

  const loadCaptureImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error("Capture image timeout"));
      }, 7000);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(url);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Capture image gagal dimuat"));
      };

      img.src = url;
    });

  const fetchCaptureBlob = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Capture HTTP ${response.status}`);
      }

      return await response.blob();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getLatestDeviceCaptureUrl = (afterTimestamp) =>
    `${API_URL}/device-capture/latest-image?after=${afterTimestamp}&t=${Date.now()}`;

  const isCaptureBlobTooDark = async (blob) => {
    const objectUrl = URL.createObjectURL(blob);

    try {
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      const sampleWidth = 48;
      const sampleHeight = 36;
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

      const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
      let total = 0;

      for (let index = 0; index < data.length; index += 4) {
        total += (data[index] + data[index + 1] + data[index + 2]) / 3;
      }

      const averageBrightness = total / (data.length / 4);
      console.log("CAPTURE BRIGHTNESS:", averageBrightness);

      return averageBrightness < 35;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const fetchFreshDeviceCaptureBlob = async (afterTimestamp) => {
    let lastError = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const latestCaptureUrl = getLatestDeviceCaptureUrl(afterTimestamp);
        return {
          blob: await fetchCaptureBlob(latestCaptureUrl),
          url: latestCaptureUrl,
        };
      } catch (error) {
        lastError = error;
        await wait(700);
      }
    }

    throw lastError || new Error("Capture baru belum tersedia");
  };

  const callCaptureTrigger = async (triggerUrl) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${triggerUrl}${triggerUrl.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Trigger HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Function to capture image from ESP32-CAM
  const handleEspCapture = async () => {
    if (captureLoading || manualCaptureInFlightRef.current) return;

    const activeDevice = await getActiveEspDevice();
    const triggerUrl = getDeviceTriggerUrl(activeDevice);
    const captureStartedAt = Date.now() / 1000;

    if (!triggerUrl) {
      console.log("CAPTURE TRIGGER URL NOT FOUND");
      toast.error("Kamera belum tersedia");
      return;
    }

    try {
      manualCaptureInFlightRef.current = true;
      setCaptureLoading(true);
      setCapturedImage("");
      setShowCapturePreview(false);
      triggerCaptureFlash();
      playShutterSound();

      setCapturing(true);
      console.log("MANUAL CAPTURE START");
      console.log("TRIGGER ENDPOINT CALLED", triggerUrl);

      await callCaptureTrigger(triggerUrl);

      console.log("WAITING HARDWARE IMAGE");

      const latestCapture = await fetchFreshDeviceCaptureBlob(captureStartedAt);

      if (await isCaptureBlobTooDark(latestCapture.blob)) {
        throw new Error("Capture terbaru terlalu gelap");
      }

      lastHardwareCaptureRef.current = await createHardwareCaptureKey(latestCapture.blob);
      createEspCaptureFromBlob(
        latestCapture.blob,
        "manual-capture-trigger",
        "Foto baru berhasil ditangkap",
        {
          fileName: "hardware-capture.jpg",
          syncPreviewImage: true,
        }
      );
      setPreviewMode("capture");

    } catch (err) {
      console.log(
        "CAPTURE ERROR",
        err
      );
      toast.error("Koneksi ESP32 sedang dipulihkan");
      setStreamError(true);
      setEspReconnecting(true);
    } finally {
      setCaptureLoading(false);
      setCapturing(false);
      manualCaptureInFlightRef.current = false;
      const streamUrl = getDeviceStreamUrl(activeDevice);

      if (streamUrl) {
        setStableLiveSrc(streamUrl);
      }
    }
  };

  const renderEspOfflineCard = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 p-5">
      <div className="camera-empty-state w-full max-w-sm">
        <EmptyState
          title="Kamera belum tersedia"
          subtitle="Koneksi ESP32 sedang dipulihkan. Pastikan perangkat menyala dan berada di jaringan yang sama."
          icon={<WifiOff size={24} />}
        />

        <button
          onClick={checkEspConnection}
          disabled={espChecking}
          className="btn-premium mt-4 h-12 w-full rounded-2xl bg-blue-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          {espChecking ? <ButtonSpinner /> : <RefreshCw size={18} />}
          {espChecking ? "Menghubungkan..." : "Coba Sambungkan"}
        </button>
      </div>
    </div>
  );

  const [streamError, setStreamError] = useState(false);
  const [liveSrc, setLiveSrc] = useState("");

  const normalizeEspBaseUrl = (value) => {
    if (!value) return "";

    const rawValue = String(value).trim().replace(/\/+$/, "");

    if (!rawValue) return "";

    return rawValue.startsWith("http://") || rawValue.startsWith("https://")
      ? rawValue
      : `http://${rawValue}`;
  };

  const buildEspUrl = (value, fallbackPath = "") => {
    if (!value) return "";

    const normalizedValue = normalizeEspBaseUrl(value);

    if (!normalizedValue) return "";

    if (
      normalizedValue.endsWith("/stream") ||
      normalizedValue.endsWith("/capture") ||
      normalizedValue.endsWith("/jpg") ||
      normalizedValue.endsWith("/capture.jpg")
    ) {
      return normalizedValue;
    }

    return `${normalizedValue}${fallbackPath}`;
  };

  const getDeviceProxyUrl = (device, action) => {
    const deviceId = device?.device_id || "ESP_CAM_01";

    return `${API_URL}/devices/${encodeURIComponent(deviceId)}/${action}-proxy`;
  };

  const setStableLiveSrc = (streamUrl) => {
    if (!streamUrl) return;

    if (streamBaseUrlRef.current === streamUrl && liveSrc) {
      return;
    }

    streamBaseUrlRef.current = streamUrl;
    setLiveSrc(streamUrl);
  };

  const debounceStreamRefresh = (streamUrl, delay = 900) => {
    if (!streamUrl) return;

    if (streamRefreshTimerRef.current) {
      clearTimeout(streamRefreshTimerRef.current);
    }

    streamRefreshTimerRef.current = window.setTimeout(() => {
      streamRefreshTimerRef.current = null;
      streamBaseUrlRef.current = streamUrl;
      setLiveSrc(`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}refresh=${Date.now()}`);
    }, delay);
  };

  useEffect(() => {
    const setupStream = async () => {
      const device = await getActiveEspDevice();

      if (!device) return;

      const stream =
        getDeviceStreamUrl(device);

      console.log("SET STREAM:", stream);
      setStableLiveSrc(stream);
    };

    setupStream();
  }, []);

  /* =========================
    NEXT STEP
  ========================= */
  const handleNext = () => {

    if (
      modePasien === "baru" &&
      !namaPasien
    ) {
      showWarning("Lengkapi nama pasien");
      return;
    }

    if (
      modePasien === "tracking" &&
      !selectedPatient
    ) {
      showWarning("Pilih pasien tracking");
      return;
    }

    if (!formData.tanggal) {
      showWarning("Lengkapi tanggal pemeriksaan");
      return;
    }

    setStep(2);
  };

  /* =========================
    UPLOAD IMAGE
  ========================= */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];

    if (file) {
      revokeImageObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      imageObjectUrlRef.current = objectUrl;

      setImage(objectUrl);
      setSelectedImage(objectUrl);
      setConfirmedImage(objectUrl);
      setImageFile(file);
      setIsAnalyzing(false);
      setProgress(0);
      setActiveStep(0);
      setAiMessage(aiMessages[0]);
      setEstimate(5);
      setAnalysisComplete(false);
    }
  };

  const runAnalysisProgress = async () => {
    const progressPoints = [10, 25, 40, 60, 80, 100];

    for (let index = 0; index < progressPoints.length; index += 1) {
      await wait(650);

      const stepIndex = Math.min(index, analysisSteps.length - 1);
      const nextProgress = progressPoints[index];
      console.log("PROGRESS:", nextProgress);

      setProgress(nextProgress);
      setActiveStep(stepIndex);
      setAiMessage(aiMessages[stepIndex]);
      setEstimate((prev) => (prev > 1 ? prev - 1 : 1));
    }

    setAnalysisComplete(true);
    setAiMessage("Pemeriksaan selesai");
    await wait(500);
  };

  /* =========================
    ANALYZE
  ========================= */
  const handleAnalyze = async (analysisFile = confirmedFile || imageFile) => {
    if (isAnalyzing) return;

    const finalImage = confirmedImage || selectedImage || image;

    console.log("CONFIRMED IMAGE", confirmedFile);
    console.log("ANALYZE IMAGE", analysisFile);

    if (!analysisFile) {
      showWarning("Ambil gambar terlebih dahulu.");
      return;
    }

    if (!finalImage) {
      showWarning("Foto final belum dikonfirmasi.");
      return;
    }

    try {
      console.log("ANALYSIS START");
      setResultImage(finalImage);

      setIsAnalyzing(true);
      setProgress(0);
      setActiveStep(0);
      setAiMessage(aiMessages[0]);
      setEstimate(5);
      setAnalysisComplete(false);
      setStep(3);

      const [aiResult] = await Promise.all([
        predictSkin(analysisFile),
        runAnalysisProgress(),
      ]);

      console.log("PREDICT RESPONSE:", aiResult);
      console.log("PREDICT SUCCESS", aiResult);
      console.log("HASIL PEMERIKSAAN:", aiResult);

      const payload = {
        nama_pasien:
          modePasien === "tracking"
            ? selectedPatient?.nama_pasien
            : namaPasien,

        kode_pasien:
          modePasien === "tracking"
            ? selectedPatient?.kode_pasien
            : `PSN-${Date.now()}`,

        paket_type:
          modePasien === "tracking"
            ? selectedPatient?.paket_type
            : paketType,

        email_pasien:
          modePasien === "tracking"
            ? selectedPatient?.email
            : emailPasien.trim().toLowerCase(),

        tanggal: formData.tanggal,

        image_path: aiResult.image_path,

        dominant_skin_type: aiResult.dominant,

        confidence: aiResult.confidence,

        oily: aiResult.predictions.berminyak || 0,

        dry_skin: aiResult.predictions.kering || 0,

        combination_skin:
          aiResult.predictions.kombinasi || 0,

        normal_skin:
          aiResult.predictions.normal || 0,

        sensitive_skin:
          aiResult.predictions.sensitif || 0,

        ingredients: aiResult.ingredients || [],

        products: aiResult.products || [],

        tips: aiResult.tips || [],
      };

      setAnalysisResult(aiResult);
      setPendingHistoryPayload(payload);
      setResultImage(finalImage);
      setSavedHistoryId(null);
      setIsAnalyzing(false);
      setProgress(100);
      setEstimate(1);

      if (Number(aiResult.confidence || 0) < 0.6) {
        toast.warning("Tingkat akurasi pemeriksaan rendah");
      }

      toast.success("Pemeriksaan wajah selesai");
      setStep(4);

    } catch (error) {
      console.error(error);

      if (error.code === "ANALYSIS_OFFLINE") {
        showAiOffline();
      } else {
        showError("Analisis gagal");
      }

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = null;
      }

      setIsAnalyzing(false);
      setProgress(0);
      setActiveStep(0);
      setAiMessage(aiMessages[0]);
      setEstimate(5);
      setAnalysisComplete(false);
    }
  };

  const resetAiState = () => {
    setAnalysisResult(null);
    setPendingHistoryPayload(null);
    setResultImage("");
    setSavedHistoryId(null);
    setIsAnalyzing(false);
    setProgress(0);
    setActiveStep(0);
    setAiMessage(aiMessages[0]);
    setEstimate(5);
    setAnalysisComplete(false);
  };

  const handleSaveResult = async () => {
    if (savingResult) return;

    const confidenceValue = Number(analysisResult?.confidence);

    if (
      modePasien === "tracking" &&
      !selectedPatient
    ) {
      showError("Pilih pasien sebelum menyimpan hasil.");
      return;
    }

    if (
      modePasien === "baru" &&
      !pendingHistoryPayload?.nama_pasien
    ) {
      showError("Nama pasien wajib diisi sebelum menyimpan.");
      return;
    }

    if (!analysisResult || !pendingHistoryPayload) {
      showError("Belum ada hasil pemeriksaan untuk disimpan.");
      return;
    }

    if (!Number.isFinite(confidenceValue)) {
      showError("Tingkat akurasi hasil pemeriksaan tidak valid.");
      return;
    }

    if (!resultImage) {
      showError("Gambar hasil pemeriksaan belum tersedia.");
      return;
    }

    if (!pendingHistoryPayload.image_path) {
      showError("Path gambar hasil pemeriksaan belum tersedia.");
      return;
    }

    if (savedHistoryId) {
      showWarning("Hasil ini sudah tersimpan di rekam medis.");
      return;
    }

    try {
      setShowSavePopup(true);
      console.log("SAVE HISTORY PAYLOAD", pendingHistoryPayload);
      setSavingResult(true);

      const response = await saveHistory(pendingHistoryPayload);

      console.log("SAVE HISTORY RESPONSE", response);

      try {
        const refreshedRecords = await getHistory();
        console.log("MEDICAL RECORD DATA", refreshedRecords);
      } catch (refreshError) {
        console.error("REFRESH MEDICAL RECORD ERROR:", refreshError);
      }

      markSaveFlow({
        payload: pendingHistoryPayload,
        response,
      });

      setSavedHistoryId(response.history_id);

      toast.success("Hasil tersimpan ke rekam medis");

      if (response.account_created && response.account_info) {
        await Swal.fire({
          icon: "success",
          title: "AKUN PASIEN BERHASIL DIBUAT",
          text: `Username: ${response.account_info.username}\nEmail: ${response.account_info.email}\nPassword default: ${response.account_info.password}\n\nSimpan informasi login ini.`,
          confirmButtonText: "Saya sudah simpan",
          confirmButtonColor: "#2563eb",
        });
      }
    } catch (error) {
      console.error(error);
      showError("Gagal menyimpan rekam medis");
    } finally {
      setShowSavePopup(false);
      setSavingResult(false);
    }
  };

  const handleAnalyzeAgain = () => {
    resetAiState();
    setSelectedImage("");
    setStep(2);
  };

  const handleDeleteResult = () => {
    resetAiState();
    revokeImageObjectUrl();
    setImage(null);
    setImageFile(null);
    setCapturedImage("");
    setSelectedImage("");
    setConfirmedImage("");
    setConfirmedFile(null);
    setIsPhotoConfirmed(false);
    setShowCapturePreview(false);
    setPreviewMode("stream");
    setStep(2);
  };

  const handleBackToCapture = () => {
    setStep(2);
  };

  const loadPatients = async () => {

    try {

      const data = await getPatients();

      console.log("PATIENT DROPDOWN DATA", data);

      setPatients(data);

      const targetPatientId = location.state?.patientId;

      if (targetPatientId) {
        const patient = data.find(
          (item) => String(item.id) === String(targetPatientId)
        );

        if (patient) {
          setModePasien("tracking");
          setSelectedPatient(patient);
          setFormData((prev) => ({
            ...prev,
            tanggal: prev.tanggal || new Date().toISOString().slice(0, 10),
          }));
        }
      }

    } catch (error) {

      console.error(error);

    }

  };

  useEffect(() => {
    console.log("RESULT IMAGE:", resultImage);
    console.log("CURRENT STEP:", step);
    console.log("SAVE POPUP:", showSavePopup);
  }, [resultImage, step, showSavePopup]);

  useEffect(() => {

    loadPatients();
    console.log("ESP32 IP ACTIVE:", ESP32_IP);
    console.log("STREAM URL:", STREAM_URL);
    console.log("CAPTURE URL:", CAPTURE_URL);
    console.log("OLD FLOW REMOVED");
  }, []);
  /* =========================
    ESP32 CONNECTION MANAGER
  ========================= */
  const isEspDeviceConnected = (device) =>
    device?.status === "online" ||
    device?.connected === true ||
    device?.online === true ||
    device?.is_online === true ||
    device?.active === true;

  const getActiveEspDevice = async () => {
    const data = await getDevices();
    console.log("ESP RAW RESPONSE:", data);

    return (
      data.find(
        (item) =>
          item.device_id === "ESP_CAM_01" &&
          isEspDeviceConnected(item)
      ) ||
      data.find(
        (item) =>
          item.status === "online" &&
          item.device_type?.toLowerCase().includes("cam")
      ) ||
      data.find((item) => item.status === "online") ||
      null
    );
  };

  const getDeviceStreamUrl = (device) => {
    if (!device) return "";

    if (device.stream_url) {
      return buildEspUrl(device.stream_url, "/stream");
    }

    if (device.ip_address) {
      return buildEspUrl(device.ip_address, "/stream");
    }

    if (ESP_IP) {
      return STREAM_URL;
    }

    return getDeviceProxyUrl(device, "stream");
  };

  const getDeviceCaptureUrl = (device) => {
    if (!device) return "";

    if (device.capture_url) {
      return buildEspUrl(device.capture_url, "/capture");
    }

    if (device.ip_address) {
      return buildEspUrl(device.ip_address, "/capture");
    }

    if (ESP_IP) {
      return CAPTURE_URL;
    }

    return getDeviceProxyUrl(device, "capture");
  };

  const getDeviceTriggerUrl = (device) => {
    const getEspBaseUrl = (value) => {
      const normalizedValue = normalizeEspBaseUrl(value);

      if (!normalizedValue) return "";

      return normalizedValue.replace(
        /\/(?:stream|capture|jpg|capture\.jpg|capture-trigger)$/i,
        ""
      );
    };

    const directBaseUrl =
      getEspBaseUrl(device?.capture_trigger_url) ||
      getEspBaseUrl(device?.capture_url) ||
      getEspBaseUrl(device?.stream_url) ||
      getEspBaseUrl(device?.ip_address) ||
      getEspBaseUrl(ESP_IP);

    return directBaseUrl ? `${directBaseUrl}/capture-trigger` : "";
  };

  const getLatestDeviceCapturePollingUrl = () =>
    `${API_URL}/device-capture/latest-image?t=${Date.now()}`;

  const createHardwareCaptureKey = async (blob) => {
    const sample = await blob.slice(0, Math.min(blob.size, 512)).arrayBuffer();
    const bytes = new Uint8Array(sample);
    let hash = 0;

    for (let index = 0; index < bytes.length; index += 1) {
      hash = (hash * 31 + bytes[index]) >>> 0;
    }

    return `${blob.size}|${blob.type || "image/jpeg"}|${hash}`;
  };

  const detectLatestHardwareCapture = async ({ initializeOnly = false } = {}) => {
    const blob = await fetchCaptureBlob(getLatestDeviceCapturePollingUrl());
    const captureKey = await createHardwareCaptureKey(blob);

    if (!captureKey || captureKey === lastHardwareCaptureRef.current) return;

    if (initializeOnly || !lastHardwareCaptureRef.current) {
      lastHardwareCaptureRef.current = captureKey;
      return;
    }

    if (
      modePasien === "baru" &&
      !pendingHistoryPayload?.email_pasien
    ) {
      showError("Email pasien wajib diisi untuk membuat akun user.");
      return;
    }

    console.log("HARDWARE IMAGE DETECTED");

    lastHardwareCaptureRef.current = captureKey;
    createEspCaptureFromBlob(
      blob,
      "hardware-button",
      "Foto baru berhasil ditangkap",
      {
        fileName: "hardware-capture.jpg",
        syncPreviewImage: true,
      }
    );
    setPreviewMode("capture");
    setCapturing(false);
    console.log("HARDWARE PREVIEW READY");
    console.log("HARDWARE CAPTURE SUCCESS");
  };

  const checkEspConnection = async ({ force = false } = {}) => {
    const startedAt = performance.now();
    const now = Date.now();

    if (reconnectInFlightRef.current) {
      return cameraOnline;
    }

    if (!force && now - lastReconnectAttemptRef.current < 2500) {
      return cameraOnline;
    }

    try {
      reconnectInFlightRef.current = true;
      lastReconnectAttemptRef.current = now;
      setEspChecking(true);
      const device = await getActiveEspDevice();
      const isConnected = isEspDeviceConnected(device);
      const streamUrl = getDeviceStreamUrl(device);
      console.log("DEVICE:", device);
      console.log("STREAM URL:", device?.stream_url);
      console.log("CAPTURE URL:", device?.capture_url);
      console.log("STREAM:", streamUrl);

      if (isConnected) {
        setCameraOnline(true);
        setStreamError(false);
        setEspReconnecting(false);
        setLastHeartbeatAt(Date.now());

        if (reconnectSuccessNotifiedRef.current) {
          toast.success("Kamera berhasil terhubung kembali");
          reconnectSuccessNotifiedRef.current = false;
        }

        setStableLiveSrc(streamUrl);
      } else {
        setCameraOnline(false);
        setEspReconnecting(true);
        setStreamError(true);
      }

      setEspLatency(isConnected ? Math.round(performance.now() - startedAt) : null);

      return isConnected;
    } catch (error) {
      setCameraOnline(false);
      setEspReconnecting(true);
      setStreamError(true);
      setEspLatency(null);
      setEspRetryCount((prev) => prev + 1);
      console.error("ESP32 CONNECTION ERROR:", error);

      return false;
    } finally {
      setEspChecking(false);
      reconnectInFlightRef.current = false;
    }
  };

  useEffect(() => {
    let disposed = false;

    checkEspConnection({ force: true });

    const retryTimer = setInterval(() => {
      if (!disposed && sourceMode === "esp32") {
    checkEspConnection({ force: true });
      }
    }, 30000);

    return () => {
      disposed = true;
      clearInterval(retryTimer);
      console.log("STREAM CLEANUP OK");
    };
  }, [sourceMode]);

  useEffect(() => {
    if (step !== 2 || sourceMode !== "esp32" || showCapturePreview) {
      return undefined;
    }

    let disposed = false;

    detectLatestHardwareCapture({ initializeOnly: true }).catch((error) => {
      console.error("HARDWARE CAPTURE INIT ERROR:", error);
    });

    const hardwareCaptureTimer = window.setInterval(() => {
      if (disposed) return;

      detectLatestHardwareCapture().catch((error) => {
        console.error("HARDWARE CAPTURE POLL ERROR:", error);
      });
    }, 1800);

    return () => {
      disposed = true;
      clearInterval(hardwareCaptureTimer);
    };
  }, [sourceMode, step, showCapturePreview]);

  useEffect(() => {
    if (sourceMode !== "esp32" || step !== 2) {
      return undefined;
    }

    streamHealthTimerRef.current = window.setInterval(() => {
      const heartbeatAge = lastHeartbeatAt ? Date.now() - lastHeartbeatAt : Infinity;

      if (heartbeatAge > 15000 && !captureLoading) {
        checkEspConnection();
      }
    }, 12000);

    return () => {
      if (streamHealthTimerRef.current) {
        clearInterval(streamHealthTimerRef.current);
        streamHealthTimerRef.current = null;
      }
    };
  }, [sourceMode, step, lastHeartbeatAt, captureLoading]);

  useEffect(() => {
    let timer;
    let attempts = 0;

    if (step === 2 && liveMode && streamError) {
      setEspReconnecting(true);
      reconnectSuccessNotifiedRef.current = true;
      toast.warning("ESP32_CAM_01 mencoba reconnect");

      timer = setInterval(() => {
        attempts += 1;

        if (attempts > 5) {
          clearInterval(timer);
          setCameraOnline(false);
          setEspReconnecting(false);
          return;
        }

        checkEspConnection();
      }, 3000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
        console.log("STREAM CLEANUP OK");
      }
    };
  }, [step, liveMode, streamError]);


  useEffect(() => {
    if (step === 2) {
      setLiveMode(true);
      setImage(null);
      setPreviewMode("stream");
      setCapturedImage("");
      setSelectedImage("");
      setShowCapturePreview(false);
      setIsPhotoConfirmed(false);
      setCapturing(false);
        checkEspConnection();
    }
  }, [step]);

  useEffect(() => {
    if (
      sourceMode === "internal" &&
      videoRef.current &&
      internalCamOn
    ) {
      videoRef.current.play().catch(() => { });
    }
  }, [sourceMode, internalCamOn]);

  useEffect(() => {
    if (step === 2 && sourceMode === "internal" && !internalCamOn) {
      startInternalCamera();
    }
  }, [sourceMode, step]);

  useEffect(() => {
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = null;
      }

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (streamRefreshTimerRef.current) {
        clearTimeout(streamRefreshTimerRef.current);
        streamRefreshTimerRef.current = null;
      }

      if (captureFlashTimerRef.current) {
        clearTimeout(captureFlashTimerRef.current);
        captureFlashTimerRef.current = null;
      }

      if (streamHealthTimerRef.current) {
        clearInterval(streamHealthTimerRef.current);
        streamHealthTimerRef.current = null;
      }

      if (captureSuccessTimerRef.current) {
        clearTimeout(captureSuccessTimerRef.current);
        captureSuccessTimerRef.current = null;
      }

      revokeImageObjectUrl();
      stopInternalCamera();
      console.log("STREAM CLEANUP OK");
    };
  }, []);

  /* ======================= STEP INDICATOR ===================== */
  const renderAiLiveStatus = () => (
    <div className="ai-live-status">
      {analysisComplete ? (
        <>
          <div className="complete-title">{"\u2713"} Analisis selesai</div>

          <div>{"\u2713"} Model berhasil memproses data</div>

          <div>{"\u2713"} Menyimpan hasil pasien</div>
        </>
      ) : (
        <>
          <div>
            {"\u{1F7E2}"} {aiMessage}
          </div>

          <div className="estimate">Estimasi: {estimate} detik</div>
        </>
      )}
    </div>
  );

  const normalizeSkinType = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/_/g, " ")
      .trim();

  const skinType = normalizeSkinType(analysisResult?.dominant);
  const confidencePercent = Math.round((analysisResult?.confidence || 0) * 100);
  const accuracyLevel =
    confidencePercent >= 80
      ? "Tinggi"
      : confidencePercent >= 60
      ? "Sedang"
      : "Perlu Review";

  const skinDescriptionMap = {
    berminyak:
      "Kulit wajah terdeteksi cenderung berminyak dengan produksi sebum yang lebih aktif pada area wajah.",
    kering:
      "Kulit wajah terdeteksi cenderung kering dan membutuhkan hidrasi lebih stabil untuk menjaga skin barrier.",
    normal:
      "Kulit wajah terdeteksi berada pada kondisi normal dengan keseimbangan minyak dan hidrasi yang cukup baik.",
    sensitif:
      "Kulit wajah menunjukkan indikasi sensitif sehingga perlu perawatan yang lembut dan minim iritasi.",
    kombinasi:
      "Kulit wajah terdeteksi kombinasi dengan area tertentu lebih berminyak dan area lain cenderung kering.",
  };

  const recommendationMap = {
    berminyak: [
      "Gunakan gentle cleanser dengan oil control.",
      "Pilih pelembap ringan non-comedogenic.",
    ],
    kering: [
      "Gunakan moisturizer yang fokus pada hidrasi.",
      "Tambahkan hydrating skincare untuk menjaga skin barrier.",
    ],
    normal: [
      "Pertahankan maintenance routine yang konsisten.",
      "Gunakan sunscreen dan cleanser lembut setiap hari.",
    ],
    sensitif: [
      "Hindari produk tinggi alkohol atau fragrance.",
      "Gunakan calming skincare yang lembut.",
    ],
    kombinasi: [
      "Gunakan cleanser lembut dan pelembap ringan.",
      "Sesuaikan treatment untuk area T-zone dan area kering.",
    ],
  };

  const resultDescription =
    skinDescriptionMap[skinType] ||
    "Hasil Pemeriksaan berhasil mendeteksi kondisi kulit dan dapat digunakan sebagai bahan evaluasi perawatan.";

  const resultRecommendations =
    recommendationMap[skinType] || [
      "Gunakan rutinitas perawatan yang lembut dan konsisten.",
      "Pantau perubahan kulit pada sesi analisis berikutnya.",
    ];
  const analysisTimeline = analysisSteps.map((title, index) => ({
    id: index,
    title,
    status:
      analysisComplete || progress >= 100 || index < activeStep
        ? "completed"
        : index === activeStep && isAnalyzing
        ? "processing"
        : "waiting",
  }));

  const confidenceBadgeClass =
    confidencePercent >= 80
      ? "bg-emerald-100 text-emerald-700"
      : confidencePercent >= 60
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  const getPredictionValue = (key) => {
    const value = Number(analysisResult?.predictions?.[key] || 0);

    if (!Number.isFinite(value)) return 0;

    return value;
  };

  const formatHeartbeatText = () => {
    if (!lastHeartbeatAt) return "Heartbeat belum tersedia";

    const seconds = Math.max(0, Math.round((Date.now() - lastHeartbeatAt) / 1000));

    if (seconds < 60) return `Heartbeat ${seconds} detik lalu`;
    return `Heartbeat ${Math.round(seconds / 60)} menit lalu`;
  };

  const espStatus = espReconnecting
    ? "reconnecting"
    : cameraOnline && liveSrc
    ? "camera ready"
    : cameraOnline
    ? "online"
    : streamError
    ? "offline"
    : "connecting";

  const skinMetrics = [
    {
      label: "Berminyak",
      value: getPredictionValue("berminyak"),
      color: "from-blue-500 to-cyan-400",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      label: "Kering",
      value: getPredictionValue("kering"),
      color: "from-orange-400 to-amber-300",
      bg: "bg-orange-50",
      text: "text-orange-600",
    },
    {
      label: "Kombinasi",
      value: getPredictionValue("kombinasi"),
      color: "from-purple-500 to-fuchsia-400",
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
  ];

  const normalizeList = (value, fallback = []) => {
    if (Array.isArray(value)) return value.filter(Boolean);

    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }

    return fallback;
  };

  const recommendationGroups = [
    {
      title: "Ingredients",
      description: "Kandungan aktif yang direkomendasikan",
      value: normalizeList(analysisResult?.ingredients),
      chip: "bg-blue-100 text-blue-700",
      accent: "bg-blue-500",
    },
    {
      title: "Produk",
      description: "Format produk perawatan yang sesuai",
      value: normalizeList(analysisResult?.products),
      chip: "bg-emerald-100 text-emerald-700",
      accent: "bg-emerald-500",
    },
    {
      title: "Tips",
      description: "Panduan ringan untuk rutinitas pasien",
      value: normalizeList(analysisResult?.tips, resultRecommendations),
      chip: "bg-orange-100 text-orange-700",
      accent: "bg-orange-500",
    },
  ];

  return (
    <AnimatedPage>
    <div className="page-enter min-h-full min-w-0">
      {/* PROGRESS STEP */}
      <div className="premium-card mb-8 bg-white rounded-3xl shadow p-4 sm:p-5 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">

          {[
            "Identitas",
            "Capture",
            "Proses Analisis",
            "Hasil Pemeriksaan",
          ].map((item, index) => {
            const current = index + 1;

            return (
              <div
                key={item}
                className={`rounded-2xl py-4 font-semibold text-sm transition-all duration-500
            ${step > current
                    ? "bg-green-500 text-white shadow-md"
                    : step === current
                      ? "bg-blue-600 text-white shadow-xl scale-105"
                      : "bg-gray-100 text-gray-400"
                  }`}
              >
                {step > current ? "✓ " : ""}
                {item}
              </div>
            );
          })}

        </div>
      </div>

      {/* ===================================
            STEP 1
        =================================== */}
      {step === 1 && (
          <div className="premium-card bg-white rounded-3xl shadow p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-10 min-w-0">

          <div className="text-center">
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900">
              Analisis Baru
            </h1>

            <p className="text-slate-500 mt-2">
              Input data pasien sebelum melakukan pemindaian wajah
            </p>
          </div>

          <div className="premium-card bg-white rounded-3xl sm:rounded-[32px] p-4 sm:p-8 shadow-xl border border-slate-100">

            <div className="mb-7 sm:mb-9">
              <h2 className="text-xl font-bold text-slate-800">
                Data Pasien
              </h2>

              <p className="text-slate-400 text-sm">
                Pilih mode pemeriksaan pasien
              </p>
            </div>

            {/* MODE */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-10">

              <button
                type="button"
                onClick={() => setModePasien("baru")}
                className={`px-5 py-3 rounded-2xl font-semibold transition ${modePasien === "baru"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                Pasien Baru
              </button>

              <button
                type="button"
                onClick={() => setModePasien("tracking")}
                className={`px-5 py-3 rounded-2xl font-semibold transition ${modePasien === "tracking"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                Tracking Existing
              </button>

            </div>

            {/* PASIEN BARU */}
            {modePasien === "baru" && (

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7 min-w-0">

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Nama Pasien
                  </label>

                  <input
                    type="text"
                    placeholder="Masukkan nama pasien"
                    value={namaPasien}
                    onChange={(e) => setNamaPasien(e.target.value)}
                    className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Email Pasien
                  </label>

                  <input
                    type="email"
                    placeholder="pasien@email.com"
                    value={emailPasien}
                    onChange={(e) => setEmailPasien(e.target.value)}
                    className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Paket Pemeriksaan
                  </label>

                  <select
                    value={paketType}
                    onChange={(e) => setPaketType(e.target.value)}
                    className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="basic">
                      Basic (1x Analisis)
                    </option>

                    <option value="tracking">
                      Paket Tracking
                    </option>
                  </select>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">
                      Tanggal Pemeriksaan
                    </label>

                    <input
                      type="date"
                      value={formData.tanggal}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tanggal: e.target.value,
                        }))
                      }
                      className="
                        w-full
                        mt-2
                        px-4
                        py-3
                        rounded-2xl
                        border
                        border-slate-200
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500
                      "
                    />
                  </div>
                </div>

              </div>
            )}

            {/* TRACKING */}
            {modePasien === "tracking" && (

              <div>
                <div className="mt-5">
                  <label className="text-sm font-semibold text-slate-600">
                    Tanggal Pemeriksaan
                  </label>

                  <input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tanggal: e.target.value,
                      }))
                    }
                    className="
                      w-full
                      mt-2
                      px-4
                      py-3
                      rounded-2xl
                      border
                      border-slate-200
                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-500
                    "
                  />
                </div>

                <label className="text-sm font-semibold text-slate-600">
                  Pilih Pasien
                </label>

                <select
                  value={selectedPatient?.id || ""}
                  onChange={(e) => {

                    const patient = patients.find(
                      (p) => p.id == e.target.value
                    );

                    setSelectedPatient(patient);

                  }}
                  className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >

                  <option value="">
                    -- Pilih Pasien --
                  </option>

                  {patients.map((p) => (

                    <option
                      key={p.id}
                      value={p.id}
                    >
                      {p.nama_pasien} - {p.kode_pasien}
                    </option>

                  ))}

                </select>
                {/* INFO PANEL */}
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">

                  <h3 className="text-xl font-bold text-slate-800 mb-5">
                    Informasi Pemeriksaan
                  </h3>

                  {modePasien === "baru" ? (

                    <div className="space-y-4 text-sm">

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Paket Dipilih
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          {paketType === "tracking"
                            ? "Paket Tracking"
                            : "Basic Package"}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Total Sesi
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          {paketType === "tracking"
                            ? "Multi Session"
                            : "1x Pemeriksaan"}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Fitur Pemeriksaan
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          Skin Tracking + History
                        </p>
                      </div>

                    </div>

                  ) : (

                    <div className="space-y-4 text-sm">

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Pasien Tracking
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          {selectedPatient?.nama_pasien || "-"}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Kode Pasien
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          {selectedPatient?.kode_pasien || "-"}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4">
                        <p className="text-slate-400">
                          Paket Aktif
                        </p>

                        <p className="font-bold text-slate-800 mt-1">
                          {selectedPatient?.paket_type || "-"}
                        </p>
                      </div>

                    </div>

                  )}

                </div>
              </div>
            )}

          </div>

          <div className="text-center">
            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-8 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
            >
              Lanjut ke Pemindaian
            </button>
          </div>

        </div>
      )}

      {/* ===================================
  STEP 2 FINAL MULTI SOURCE CAMERA
  GANTI STEP 2 LAMA DENGAN INI
  =================================== */}
      {step === 2 && (
        <div className="space-y-6">

          {/* HEADER */}
          <div className="premium-card bg-white rounded-3xl shadow p-4 sm:p-6 min-w-0">
            <h2 className="text-3xl font-bold text-slate-800">
              Pilih Sumber Kamera
            </h2>

            <p className="text-slate-500 mt-2">
              Gunakan ESP32-CAM atau Kamera Internal.
            </p>
          </div>

          {/* MODE BUTTON */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">

            <button
              onClick={switchToEsp32}
              className={`btn-premium h-14 rounded-2xl font-bold ${sourceMode === "esp32"
                ? "bg-blue-600 text-white"
                : "bg-white"
                }`}
            >
              📡 ESP32 CAM
            </button>

            <button
              onClick={async () => {
                setSourceMode("internal");
                setImage(null);
                setSelectedImage("");
                setConfirmedImage("");
                setResultImage("");
                setConfirmedFile(null);
                await startInternalCamera();
              }}
              className={`btn-premium h-14 rounded-2xl font-bold ${sourceMode === "internal"
                ? "bg-blue-600 text-white"
                : "bg-white"
                }`}
            >
              💻 Kamera Internal
            </button>


          </div>

          {/* CONTENT */}
          <div className="grid grid-cols-1 lg:grid-cols-[0.78fr_1fr] gap-6 min-w-0">

            {/* PREVIEW */}
            <div className="premium-card bg-white rounded-3xl shadow p-4 sm:p-5 min-w-0">

              <h2 className="text-2xl sm:text-3xl font-bold mb-5">
                Preview Kamera
              </h2>

              <div className="h-[300px] min-[380px]:h-[360px] sm:h-[460px] rounded-3xl overflow-hidden border bg-slate-50 flex items-center justify-center min-w-0">

                {/* ESP32 */}
                {sourceMode === "esp32" && (
                  cameraOnline ? (
                    <>
                      {console.log("ROTATE FIX ACTIVE")}
                      <div
                        className="
                          relative
                          w-full
                          h-full
                          overflow-hidden
                          rounded-2xl
                          bg-black
                          flex
                          items-center
                          justify-center
                        "
                      >
                        {previewMode === "capture" && image ? (
                          <img
                            src={image}
                            alt="captured"
                            className="
                              image-fade
                              w-full
                              h-full
                              object-cover
                              rounded-xl
                            "
                            loading="lazy"
                            decoding="async"
                          />
                        ) : liveSrc && !showCapturePreview ? (
                          <>
                          <img
                            ref={espStreamRef}
                            key="esp-stream"
                            src={liveSrc}
                            alt="esp stream"
                            className="
                              image-fade
                              w-full
                              h-full
                              object-cover
                              rounded-xl
                            "
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: "100%",
                              height: "100%",
                            }}
                            onLoad={() => {
                              console.log("STREAM OK");
                              setStreamError(false);
                              setEspReconnecting(false);
                              setCameraOnline(true);
                              setLastHeartbeatAt(Date.now());
                            }}
                            onError={() => {
                              console.log("STREAM ERROR");
                              setStreamError(true);
                              setEspReconnecting(true);
                              debounceStreamRefresh(streamBaseUrlRef.current || liveSrc);
                            }}
                          />
                          <div className="camera-smart-overlay">
                            <div className="camera-target-box" />
                            <div className="camera-scan-line" />
                            <span className="camera-dot dot-a" />
                            <span className="camera-dot dot-b" />
                            <span className="camera-dot dot-c" />
                            <div className="camera-helper-text">Posisikan wajah di tengah</div>
                            <div className="brightness-indicator">Pencahayaan stabil</div>
                          </div>
                          </>
                        ) : (
                          <div className="camera-loading-state">
                            <div className="camera-loading-ring" />
                            <div className="text-sm font-semibold text-slate-300">
                              {captureLoading
                                ? "Menyiapkan capture..."
                                : "Preview stream dijeda"}
                            </div>
                          </div>
                        )}
                        {captureLoading && (
                          <div className="capture-loading-overlay">
                            <div className="camera-loading-ring" />
                            <span>Mengambil foto...</span>
                          </div>
                        )}
                        {captureSuccess && (
                          <div className="capture-success-badge">
                            <CheckCircle2 size={18} />
                            Foto siap
                          </div>
                        )}
                        {captureFlash && <div className="capture-flash" />}
                      </div>
                    </>
                  ) : espReconnecting ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 p-5">
                      <div className="w-full max-w-sm">
                        <LoadingScreen
                          compact
                          title="Menghubungkan Kamera"
                          subtitle="Koneksi ESP32 sedang dipulihkan. Preview akan muncul lagi setelah perangkat stabil."
                        />
                      </div>
                    </div>
                  ) : (
                    renderEspOfflineCard()
                  )
                )}

                {sourceMode === "internal" && (
                  image ? (
                    <div className="scan-container">
                      <img src={image} alt="capture" className="scan-image image-fade" loading="lazy" decoding="async" />

                      {isAnalyzing && (
                        <div className="scan-overlay">
                          <div className="scanner-frame ai-pulse"></div>
                          <div className="scanner-line"></div>
                          <span className="scan-point point-1"></span>
                          <span className="scan-point point-2"></span>
                          <span className="scan-point point-3"></span>
                          <span className="scan-point point-4"></span>

                          {renderAiLiveStatus()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {internalCamOn && (
                        <div className="camera-smart-overlay">
                          <div className="camera-target-box" />
                          <div className="camera-scan-line" />
                          <span className="camera-dot dot-a" />
                          <span className="camera-dot dot-b" />
                          <span className="camera-dot dot-c" />
                          <div className="camera-helper-text">Posisikan wajah di tengah</div>
                          <div className="brightness-indicator">Pencahayaan stabil</div>
                        </div>
                      )}
                      {captureFlash && <div className="capture-flash" />}
                      {captureLoading && (
                        <div className="capture-loading-overlay">
                          <div className="camera-loading-ring" />
                          <span>Mengambil foto...</span>
                        </div>
                      )}
                      {captureSuccess && (
                        <div className="capture-success-badge">
                          <CheckCircle2 size={18} />
                          Foto siap
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* UPLOAD */}
                {sourceMode === "upload" && (
                  image ? (
                    <div className="scan-container">
                      <img src={image} alt="upload" className="scan-image image-fade" loading="lazy" decoding="async" />

                      {isAnalyzing && (
                        <div className="scan-overlay">
                          <div className="scanner-frame ai-pulse"></div>
                          <div className="scanner-line"></div>
                          <span className="scan-point point-1"></span>
                          <span className="scan-point point-2"></span>
                          <span className="scan-point point-3"></span>
                          <span className="scan-point point-4"></span>

                          {renderAiLiveStatus()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      Belum ada gambar
                    </div>
                  )
                )}

              </div>
            </div>

            {/* ACTION */}
            <div className="premium-card bg-white rounded-3xl shadow p-4 sm:p-6 lg:p-8 flex flex-col justify-center min-w-0">

              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Panel Kontrol
              </h2>

              <p className="text-gray-500 mb-8">
                Pilih sumber gambar lalu lakukan pemeriksaan kulit.
              </p>

              {/* ESP32 */}
              {sourceMode === "esp32" && (
                <>
                  <div
                    className={`
                      rounded-2xl
                      border
                      p-4
                      mb-4
                      ${
                        espReconnecting
                          ? "bg-amber-50 border-amber-100 text-amber-700"
                          : cameraOnline
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                          : "bg-red-50 border-red-100 text-red-700"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">
                            {espReconnecting
                              ? "ESP32 Reconnecting"
                              : cameraOnline
                              ? "ESP32 Online"
                              : "ESP32 Tidak Terhubung"}
                          </p>
                          <StatusBadge status={espStatus} />
                        </div>

                        <p className="text-xs opacity-80 mt-1">
                          {cameraOnline
                            ? `${formatHeartbeatText()} - Latency ${espLatency ?? "-"} ms`
                            : "Periksa WiFi dan IP"}
                        </p>
                      </div>

                      <div className="text-xs font-semibold">
                        Retry: {espRetryCount}
                      </div>
                    </div>
                  </div>

                  {!image && (
                    <>
                    <button
                      onClick={handleEspCapture}
                      disabled={!cameraOnline || captureLoading || espChecking}
                      className="btn-premium h-14 rounded-2xl bg-blue-600 text-white font-bold w-full disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 touch-manipulation"
                    >
                      {captureLoading || espChecking ? (
                        <ButtonSpinner />
                      ) : (
                        <Camera size={19} />
                      )}
                      {captureLoading
                        ? "Mengambil Foto..."
                        : espChecking
                          ? "Mengecek Kamera..."
                        : "Capture Manual"}
                    </button>
                    <p className="mt-2 text-center text-xs font-medium text-slate-400">
                      Atau gunakan tombol fisik perangkat
                    </p>
                    </>
                  )}

                  {image && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <button
                        onClick={() => {
                          const fileForAnalysis = confirmedFile || imageFile;

                          if (!fileForAnalysis) {
                            showWarning("Foto ESP32 belum siap untuk dianalisis.");
                            return;
                          }

                          handleAnalyze(fileForAnalysis);
                        }}
                        className="btn-premium h-14 rounded-2xl bg-purple-600 text-white font-bold w-full"
                      >
                        Gunakan Foto
                      </button>

                      <button
                        onClick={() => {
                          setPreviewMode(
                            "stream"
                          );

                          revokeImageObjectUrl();
                          setCapturedImage("");
                          setImage(null);
                          setImageFile(null);
                          setSelectedImage("");
                          setConfirmedImage("");
                          setResultImage("");
                          setConfirmedFile(null);
                          setIsPhotoConfirmed(false);
                          setShowCapturePreview(
                            false
                          );
                          setCapturing(false);
                          setProgress(0);
                          setActiveStep(0);
      checkEspConnection({ force: true });
                        }}
                        className="btn-premium h-14 rounded-2xl bg-orange-500 text-white font-bold w-full"
                      >
                        Ambil Ulang
                      </button>
                    </div>
                  )}

                  {!cameraOnline && (
                    <button
                      onClick={checkEspConnection}
                      disabled={espChecking}
                      className="btn-premium mt-4 h-12 rounded-2xl bg-slate-800 text-white font-bold w-full inline-flex items-center justify-center gap-2 touch-manipulation"
                    >
                      {espChecking ? <ButtonSpinner /> : <RefreshCw size={18} />}
                      {espChecking ? "Menghubungkan..." : "Retry Koneksi"}
                    </button>
                  )}
                </>
              )}

              {sourceMode === "internal" && (
                image ? (
                  <button
                    onClick={() => {
                      setImage(null);
                      startInternalCamera();
                    }}
                    className="btn-premium h-14 rounded-2xl bg-orange-500 text-white font-bold inline-flex items-center justify-center gap-2 touch-manipulation"
                  >
                    🔄 Capture Lagi
                  </button>
                ) : (
                  <button
                    onClick={captureInternalCamera}
                    disabled={captureLoading}
                    className="btn-premium h-14 rounded-2xl bg-slate-900 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation"
                  >
                    {captureLoading && <ButtonSpinner />}
                    {captureLoading ? "Mengambil Foto..." : "📷 Capture Webcam"}
                  </button>
                )
              )}


              {/* ANALYZE */}
              {image && sourceMode !== "esp32" && (
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="btn-premium mt-4 h-14 rounded-2xl bg-purple-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isAnalyzing && <ButtonSpinner />}
                  {isAnalyzing ? "Menganalisis..." : "🤖 Analisis Sekarang"}
                </button>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ===================================
            STEP 3
        =================================== */}
      {/* ===================================================
    STEP 3 = PROSES ANALISIS PREMIUM LOADING SCAN
    GANTI seluruh bagian STEP 3 lama dengan ini
  =================================================== */}

      {step === 3 && (
        <div className="premium-card bg-white rounded-3xl shadow p-4 sm:p-8 lg:p-10 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-w-0">

            {/* IMAGE SCAN */}
            <div className="h-[260px] min-[380px]:h-[300px] sm:h-[460px] flex items-center justify-center">

              {image ? (
                <div className="scan-container">
                  <img src={image} alt="preview" className="scan-image image-fade" loading="lazy" decoding="async" />

                  {isAnalyzing && (
                    <div className="scan-overlay">
                      <div className="scanner-frame ai-pulse"></div>
                      <div className="scanner-line"></div>
                      <span className="scan-point point-1"></span>
                      <span className="scan-point point-2"></span>
                      <span className="scan-point point-3"></span>
                      <span className="scan-point point-4"></span>

                      {renderAiLiveStatus()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-lg">
                  Menunggu gambar...
                </div>
              )}
            </div>

            {/* RIGHT SIDE */}
            <div className="space-y-6">

              <div>
                <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">
                  Menganalisis Wajah...
                </h2>

                <p className="text-gray-500 text-base sm:text-lg">
                  Sistem sedang memproses data kulit menggunakan
                  Sistem Analisis Kulit Berbasis Monitoring Digital.
                </p>
              </div>

              <ProgressAI
                progress={progress}
                currentStep={aiMessage}
                estimatedTime={`Estimasi ${estimate} detik`}
              />

              {isAnalyzing && (
                <LoadingScreen
                  compact
                  title="Analisis Berjalan"
                  subtitle="Model sedang membaca tekstur kulit dan menyiapkan hasil."
                />
              )}

              <AnalysisTimeline steps={analysisTimeline} />

              {/* STATUS BOX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="bg-blue-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Model</p>
                  <p className="font-bold text-blue-600">
                    Sistem Pemeriksaan
                  </p>
                </div>

                <div className="bg-green-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Device</p>
                  <p className="font-bold text-green-600">
                    ESP32-CAM Online
                  </p>
                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {step === 4 && analysisResult && (
        <div className="min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-6 lg:gap-8 items-start">
            <div className="min-w-0">
              <div className="relative w-full h-[320px] min-[380px]:h-[380px] sm:h-[560px] overflow-hidden rounded-3xl sm:rounded-[32px] bg-black shadow-sm">
                {resultImage && (
                  <img
                    src={resultImage}
                    alt="hasil pemeriksaan"
                    className="
                      image-fade
                      w-full
                      h-full
                      object-cover
                    "
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>

            </div>

            <div className="premium-card bg-white rounded-3xl sm:rounded-[32px] shadow-sm p-4 sm:p-7 min-w-0">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-blue-600">
                    Hasil Pemeriksaan
                  </p>
                  <h2 className="mt-2 text-3xl sm:text-5xl font-bold text-slate-900 capitalize leading-tight break-words">
                    {analysisResult.dominant || "-"}
                  </h2>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold ${confidenceBadgeClass}`}>
                      Tingkat Akurasi {confidencePercent}%
                    </span>

                    <span className="px-3 sm:px-4 py-2 rounded-2xl bg-slate-100 text-xs sm:text-sm font-bold text-slate-700">
                      {accuracyLevel}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4 border border-slate-100">
                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Nama Pasien
                      </p>
                      <p className="mt-1 font-bold text-slate-800">
                        {pendingHistoryPayload?.nama_pasien || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Kode
                      </p>
                      <p className="mt-1 font-bold text-slate-800">
                        {pendingHistoryPayload?.kode_pasien || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Paket
                      </p>
                      <p className="mt-1 font-bold text-slate-800 capitalize">
                        {pendingHistoryPayload?.paket_type || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Tanggal Analisis
                      </p>
                      <p className="mt-1 font-bold text-slate-800">
                        {pendingHistoryPayload?.tanggal || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      SK
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">
                      Kondisi Kulit
                    </h3>
                  </div>

                  <p className="mt-3 text-slate-600 leading-relaxed">
                    {resultDescription}
                  </p>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      Rx
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">
                      Rekomendasi
                    </h3>
                  </div>

                  <ul className="mt-3 space-y-2.5">
                    {resultRecommendations.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-slate-700"
                      >
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:flex lg:flex-wrap gap-3 lg:justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveResult}
                    disabled={Boolean(savedHistoryId) || savingResult}
                    className="btn-premium w-full lg:w-auto px-5 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {savingResult && <ButtonSpinner />}
                    {savingResult ? "Menyimpan..." : savedHistoryId ? "Tersimpan" : "Simpan Rekam Medis"}
                  </button>

                  <button
                    type="button"
                    onClick={handleAnalyzeAgain}
                    className="btn-premium w-full lg:w-auto px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  >
                    Analisis Ulang
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteResult}
                    className="btn-premium w-full lg:w-auto px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold"
                  >
                    Hapus
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToCapture}
                    className="btn-premium w-full lg:w-auto px-5 py-3 rounded-2xl bg-slate-600 hover:bg-slate-700 text-white font-bold"
                  >
                    Kembali
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Hasil Pemeriksaan Kulit
                </h2>

                <p className="text-sm text-slate-400 mt-1">
                  Komposisi hasil pemeriksaan berdasarkan foto yang dianalisis
                </p>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold capitalize">
                {analysisResult?.dominant || "-"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {skinMetrics.map((metric) => {
                const percentage = Math.round(
                  metric.value <= 1 ? metric.value * 100 : metric.value
                );

                return (
                  <div
                    key={metric.label}
                    className="premium-card rounded-3xl border border-slate-100 bg-slate-50 p-5"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-sm text-slate-400 font-semibold">
                          Parameter
                        </p>

                        <h3 className="text-xl font-bold text-slate-800 mt-1">
                          {metric.label}
                        </h3>
                      </div>

                      <div
                        className={`w-12 h-12 rounded-2xl ${metric.bg} ${metric.text} flex items-center justify-center font-bold`}
                      >
                        {percentage}%
                      </div>
                    </div>

                    <div className="w-full h-3 rounded-full bg-white overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${metric.color}`}
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                      />
                    </div>

                    <p className="text-xs text-slate-400 mt-3">
                      Dibaca dari sistem klasifikasi kulit wajah.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                Rekomendasi Perawatan
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Rekomendasi hybrid berdasarkan jenis kulit dominan dan tingkat akurasi
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendationGroups.map((group) => (
                <div
                  key={group.title}
                  className="premium-card relative overflow-hidden bg-slate-50 rounded-3xl p-5 border border-slate-100"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${group.accent}`} />

                  <h3 className="text-lg font-bold text-slate-800">
                    {group.title}
                  </h3>

                  <p className="text-sm text-slate-400 mt-1 mb-4">
                    {group.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {group.value.length ? (
                      group.value.map((item, index) => (
                        <span
                          key={`${group.title}-${index}`}
                          className={`px-3 py-1.5 rounded-full ${group.chip} text-xs font-bold`}
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">
                        Belum ada rekomendasi.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCapturePreview === true && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800">
              Preview Hasil Capture
            </h2>

            <div className="mt-5 h-64 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="preview hasil capture"
                  className="
                    image-fade
                    w-full
                    h-full
                    object-cover
                    rounded-xl
                  "
                  loading="lazy"
                  decoding="async"
                  onLoad={() => {
                    console.log(
                      "CAPTURE PREVIEW OK"
                    );
                  }}
                  onError={() => {
                    console.log(
                      "CAPTURE PREVIEW ERROR",
                      capturedImage
                    );
                  }}
                />
              ) : (
                <div className="text-sm font-semibold text-slate-300">
                  Menyiapkan preview...
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode(
                    "stream"
                  );

                  revokeImageObjectUrl();
                  setCapturedImage("");

                  setImage(null);
                  setImageFile(null);
                  setConfirmedFile(null);

                  setSelectedImage("");
                  setConfirmedImage("");

                  setShowCapturePreview(false);

                  setCapturing(false);
                }}
                className="h-12 rounded-2xl bg-orange-500 text-white font-bold"
              >
                Ambil Ulang
              </button>

              <button
                type="button"
                disabled={confirmingPhoto}
                onClick={async () => {
                  if (!capturedImage) {
                    console.log(
                      "NO CAPTURE"
                    );

                    return;
                  }

                  try {
                    setConfirmingPhoto(true);
                    const finalFile = await ensureCapturedFile();

                    if (!finalFile) {
                      throw new Error("File final tidak tersedia");
                    }

                    console.log(
                      "PHOTO CONFIRMED"
                    );

                    setPreviewMode(
                      "capture"
                    );

                    setImage(
                      capturedImage
                    );

                    setSelectedImage(
                      capturedImage
                    );

                    setConfirmedImage(
                      capturedImage
                    );

                    setResultImage(
                      capturedImage
                    );

                    setShowCapturePreview(
                      false
                    );

                    setIsPhotoConfirmed(
                      true
                    );

                    setCapturing(false);
                    toast.success("Foto berhasil dikonfirmasi");
                  } catch (error) {
                    console.error("CONFIRM PHOTO ERROR:", error);
                    toast.error("Foto gagal dikonfirmasi, coba ambil ulang");
                  } finally {
                    setConfirmingPhoto(false);
                  }
                }}
                className="h-12 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {confirmingPhoto && <ButtonSpinner />}
                {confirmingPhoto ? "Mengonfirmasi..." : "Gunakan Foto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}


