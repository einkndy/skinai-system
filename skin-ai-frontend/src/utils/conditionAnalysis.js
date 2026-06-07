export const CONDITION_PROBABILITY_ITEMS = [
  { key: "jerawat", label: "Jerawat" },
  { key: "komedo", label: "Komedo" },
  { key: "kerutan", label: "Kerutan" },
  { key: "flek_hitam", label: "Flek Hitam" },
  { key: "pori_pori_besar", label: "Pori Besar" },
];

export const parseConditionPredictions = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const getConditionPercentValue = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return 0;

  const percent = number <= 1 ? number * 100 : number;

  return Math.max(0, Math.min(Math.round(percent), 100));
};

export const formatConditionPercent = (value) => `${getConditionPercentValue(value)}%`;

export const formatConditionLabel = (value) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) return "-";

  const configured = CONDITION_PROBABILITY_ITEMS.find((item) => item.key === rawValue);

  if (configured) return configured.label;

  return rawValue
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const buildFaceCondition = (record = {}) => {
  const directCondition = record?.condition;

  if (directCondition?.dominant_condition || directCondition?.predictions) {
    return {
      dominant_condition: directCondition.dominant_condition || null,
      confidence: directCondition.confidence ?? null,
      predictions: parseConditionPredictions(directCondition.predictions) || {},
    };
  }

  const predictions = parseConditionPredictions(record?.condition_predictions);

  if (record?.dominant_condition || record?.condition_confidence != null || predictions) {
    return {
      dominant_condition: record?.dominant_condition || null,
      confidence: record?.condition_confidence ?? null,
      predictions: predictions || {},
    };
  }

  return null;
};

export const getFaceConditionStatus = (sessions = []) => {
  const withCondition = sessions
    .map((session) => ({
      session,
      condition: buildFaceCondition(session),
    }))
    .filter((item) => item.condition);

  if (!withCondition.length) {
    return {
      label: "Belum Tersedia",
      trend: "flat",
      tone: "slate",
      description: "Data kondisi wajah belum tersimpan pada sesi ini.",
    };
  }

  const latest = withCondition.at(-1);
  const previous = withCondition.length > 1 ? withCondition.at(-2) : null;
  const latestConfidence = Number(latest.condition.confidence || 0);
  const previousConfidence = Number(previous?.condition?.confidence || latestConfidence);
  const delta = latestConfidence - previousConfidence;
  const dominantLabel = formatConditionLabel(latest.condition.dominant_condition);

  if (!previous) {
    return {
      label: "Data Baru",
      trend: "flat",
      tone: "blue",
      description: `Kondisi wajah terakhir terbaca sebagai ${dominantLabel}.`,
    };
  }

  if (Math.abs(delta) < 0.05) {
    return {
      label: "Stabil",
      trend: "flat",
      tone: "blue",
      description: `Kondisi wajah ${dominantLabel} relatif stabil dibanding sesi sebelumnya.`,
    };
  }

  if (delta > 0) {
    return {
      label: "Keyakinan Naik",
      trend: "up",
      tone: "green",
      description: `Tingkat akurasi kondisi wajah ${dominantLabel} meningkat dibanding sesi sebelumnya.`,
    };
  }

  return {
    label: "Perlu Pantau",
    trend: "down",
    tone: "orange",
    description: `Tingkat akurasi kondisi wajah ${dominantLabel} menurun dibanding sesi sebelumnya.`,
  };
};
