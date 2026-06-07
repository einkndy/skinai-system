const toConfidence = (value = 0) => {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) return 0;
  return numberValue > 1 ? numberValue / 100 : numberValue;
};

const getSessionDate = (session) => {
  const date = new Date(session?.exam_date || session?.created_at || 0);

  return Number.isNaN(date.getTime()) ? null : date;
};

const sortSessions = (sessions = []) =>
  [...sessions].sort((a, b) => {
    const aDate = getSessionDate(a)?.getTime() || 0;
    const bDate = getSessionDate(b)?.getTime() || 0;

    return aDate - bDate;
  });

const getDaysBetween = (start, end) => {
  if (!start || !end) return null;

  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const getSkinStability = (first, latest) => {
  const oilyDiff = Math.abs(Number(latest?.oily || 0) - Number(first?.oily || 0));
  const dryDiff = Math.abs(Number(latest?.dry_skin || 0) - Number(first?.dry_skin || 0));
  const combinationDiff = Math.abs(
    Number(latest?.combination_skin || 0) - Number(first?.combination_skin || 0)
  );

  return Math.max(0, 1 - (oilyDiff + dryDiff + combinationDiff) / 1.2);
};

export const getConditionStatus = (sessions = []) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const first = orderedSessions[0];
  const latest = orderedSessions[orderedSessions.length - 1];
  const previous = orderedSessions[orderedSessions.length - 2] || first;
  const latestConfidence = toConfidence(latest?.confidence);
  const previousConfidence = toConfidence(previous?.confidence);
  const confidenceDelta = latestConfidence - previousConfidence;
  const totalDelta = latestConfidence - toConfidence(first?.confidence);
  const latestDate = getSessionDate(latest);
  const previousDate = getSessionDate(previous);
  const intervalDays = getDaysBetween(previousDate, latestDate);
  const skinTypeChanged =
    Boolean(previous?.dominant_skin_type && latest?.dominant_skin_type) &&
    previous.dominant_skin_type !== latest.dominant_skin_type;
  const stableMetrics = first && latest ? getSkinStability(first, latest) >= 0.72 : false;

  if (!latest) {
    return {
      label: "Perlu Pemantauan",
      tone: "blue",
      trend: "stable",
      description: "Belum ada data pemeriksaan yang cukup untuk membaca perkembangan.",
    };
  }

  if (orderedSessions.length < 2 || latestConfidence < 0.6 || intervalDays > 45) {
    return {
      label: "Perlu Pemantauan",
      tone: "blue",
      trend: "stable",
      description:
        latestConfidence < 0.6
          ? "Kualitas pemeriksaan terakhir perlu diperkuat dengan scan ulang."
          : "Data pemantauan perlu dilengkapi dengan pemeriksaan berkala.",
    };
  }

  if (confidenceDelta <= -0.08 || (skinTypeChanged && confidenceDelta < -0.03)) {
    return {
      label: "Menurun",
      tone: "red",
      trend: "down",
      description: "Perkembangan terakhir menunjukkan penurunan kualitas atau konsistensi hasil.",
    };
  }

  if ((confidenceDelta >= 0.05 && stableMetrics) || totalDelta >= 0.1) {
    return {
      label: "Meningkat",
      tone: "green",
      trend: "up",
      description: "Kondisi pemantauan menunjukkan arah perkembangan yang lebih baik.",
    };
  }

  if (Math.abs(confidenceDelta) <= 0.07 && !skinTypeChanged) {
    return {
      label: "Stabil",
      tone: "yellow",
      trend: "stable",
      description: "Kondisi kulit relatif konsisten dibanding pemeriksaan sebelumnya.",
    };
  }

  return {
    label: "Perlu Pemantauan",
    tone: "blue",
    trend: "stable",
    description: "Ada perubahan hasil yang perlu dipantau pada sesi berikutnya.",
  };
};

export const getSessionQualityStatus = (session = {}) => {
  const confidence = toConfidence(session.confidence);

  if (confidence >= 0.71) {
    return {
      label: "Sangat Baik",
      tone: "blue",
      description: "Foto dan pembacaan model sangat kuat untuk mendukung evaluasi.",
    };
  }

  if (confidence >= 0.51) {
    return {
      label: "Baik",
      tone: "green",
      description: "Hasil cukup kuat untuk digunakan sebagai acuan pemeriksaan.",
    };
  }

  if (confidence >= 0.31) {
    return {
      label: "Cukup",
      tone: "yellow",
      description: "Hasil masih dapat digunakan sebagai indikasi awal, namun kualitas foto dapat ditingkatkan agar hasil analisis lebih optimal.",
    };
  }

  return {
    label: "Rendah",
    tone: "red",
    description: "Kualitas foto perlu ditingkatkan. Disarankan melakukan scan ulang dengan pencahayaan dan posisi wajah yang lebih stabil.",
  };
};

export const generateMonitoringInsight = (sessions = []) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const first = orderedSessions[0];
  const latest = orderedSessions[orderedSessions.length - 1];
  const previous = orderedSessions[orderedSessions.length - 2] || first;

  if (!latest) {
    return ["Belum ada data pemeriksaan yang cukup untuk membuat wawasan pemantauan."];
  }

  if (orderedSessions.length < 2) {
    return [
      "Sesi awal sudah tersimpan. Pemeriksaan berikutnya akan membantu membaca pola perkembangan kulit pasien dengan lebih jelas.",
    ];
  }

  const oilyDelta = Number(latest.oily || 0) - Number(previous.oily || 0);
  const dryDelta = Number(latest.dry_skin || 0) - Number(previous.dry_skin || 0);
  const oilyDeltaFromFirst = Number(latest.oily || 0) - Number(first.oily || 0);
  const dryDeltaFromFirst = Number(latest.dry_skin || 0) - Number(first.dry_skin || 0);
  const intervalDays = getDaysBetween(getSessionDate(previous), getSessionDate(latest));
  const insights = [];
  const formatDelta = (value) => `${Math.abs(Math.round(value * 100))}%`;

  if (oilyDeltaFromFirst <= -0.05) {
    insights.push(
      `Produksi minyak menurun ${formatDelta(oilyDeltaFromFirst)} dibanding sesi awal.`
    );
  }

  if (oilyDeltaFromFirst >= 0.05) {
    insights.push(
      `Produksi minyak meningkat ${formatDelta(oilyDeltaFromFirst)} dibanding sesi awal.`
    );
  }

  if (dryDeltaFromFirst <= -0.05) {
    insights.push(
      `Kondisi kulit menunjukkan tingkat kekeringan ${formatDelta(dryDeltaFromFirst)} lebih rendah dibanding sesi awal.`
    );
  }

  if (dryDeltaFromFirst >= 0.05) {
    insights.push(
      `Kondisi kulit menunjukkan tingkat kekeringan ${formatDelta(dryDeltaFromFirst)} lebih tinggi dibanding sesi awal.`
    );
  }

  if (previous.dominant_skin_type !== latest.dominant_skin_type) {
    insights.push(
      `Jenis kulit dominan berubah dari ${previous.dominant_skin_type} menjadi ${latest.dominant_skin_type}. Perubahan ini perlu dikonfirmasi pada sesi berikutnya.`
    );
  }

  if (intervalDays !== null && intervalDays > 30) {
    insights.push(
      "Interval pemeriksaan cukup panjang. Pemantauan akan lebih konsisten bila sesi dilakukan dalam jadwal yang lebih teratur."
    );
  }

  if (insights.length === 0 && oilyDelta <= -0.03) {
    insights.push("Produksi minyak menurun dibanding sesi sebelumnya.");
  }

  if (insights.length === 0 && dryDelta <= -0.03) {
    insights.push("Tingkat kekeringan kulit menurun dibanding sesi sebelumnya.");
  }

  if (insights.length === 0) {
    insights.push(
      "Kondisi kulit menunjukkan pola yang stabil dibanding pemeriksaan sebelumnya, tanpa perubahan klinis yang mencolok."
    );
  }

  return insights;
};

export const calculateHealthScore = (sessions = []) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const first = orderedSessions[0];
  const latest = orderedSessions[orderedSessions.length - 1];
  const previous = orderedSessions[orderedSessions.length - 2] || first;

  if (!latest) {
    return {
      score: 0,
      label: "Perlu Pemantauan",
      tone: "blue",
    };
  }

  const latestConfidence = toConfidence(latest.confidence);
  const confidenceScore = latestConfidence * 40;
  const trendScore = Math.max(
    0,
    Math.min(25, 15 + (latestConfidence - toConfidence(previous?.confidence)) * 120)
  );
  const stabilityScore = first && latest ? getSkinStability(first, latest) * 20 : 10;
  const latestDate = getSessionDate(latest);
  const firstDate = getSessionDate(first);
  const intervalDays = getDaysBetween(firstDate, latestDate);
  const consistencyScore =
    orderedSessions.length >= 3
      ? 15
      : orderedSessions.length === 2 && intervalDays !== null && intervalDays <= 45
      ? 11
      : 7;
  const score = Math.round(
    Math.max(0, Math.min(100, confidenceScore + trendScore + stabilityScore + consistencyScore))
  );

  if (score >= 85) return { score, label: "Sangat Baik", tone: "green" };
  if (score >= 70) return { score, label: "Baik", tone: "blue" };
  if (score >= 55) return { score, label: "Sedang", tone: "yellow" };
  return { score, label: "Perlu Pemantauan", tone: "red" };
};

const splitCareValue = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getSkinTypeText = (session = {}) =>
  String(session.dominant_skin_type || session.hasil_prediksi || "kulit").toLowerCase();

export const generateSmartRecommendations = (sessions = [], currentSession = null) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const latest = currentSession || orderedSessions[orderedSessions.length - 1] || {};
  const previous =
    orderedSessions
      .filter((session) => session?.id !== latest?.id)
      .slice(-1)[0] || orderedSessions[orderedSessions.length - 2];
  const conditionStatus = getConditionStatus(orderedSessions.length ? orderedSessions : [latest]);
  const skinType = getSkinTypeText(latest);
  const baseIngredients = splitCareValue(latest.ingredients);
  const baseProducts = splitCareValue(latest.products);
  const baseTips = splitCareValue(latest.tips);
  const recommendations = [];

  const primaryCopy = skinType.includes("kering")
    ? "Fokus utama adalah menjaga skin barrier dan hidrasi agar kulit tidak semakin terasa kering."
    : skinType.includes("berminyak") || skinType.includes("oily")
    ? "Fokus utama adalah mengontrol minyak tanpa membuat kulit terasa tertarik atau terlalu kering."
    : skinType.includes("kombinasi")
    ? "Fokus utama adalah menyeimbangkan area berminyak dan area yang lebih mudah kering."
    : "Fokus utama adalah mempertahankan rutinitas dasar yang lembut dan konsisten.";

  recommendations.push({
    priority: "utama",
    title: "Prioritas Perawatan",
    tone: "blue",
    items: [
      primaryCopy,
      baseIngredients.length
        ? `Pertahankan kandungan seperti ${baseIngredients.slice(0, 3).join(", ")} sesuai toleransi kulit.`
        : "Gunakan pembersih lembut, pelembap ringan, dan sunscreen harian sebagai dasar perawatan.",
    ],
  });

  recommendations.push({
    priority: "tambahan",
    title: "Dukungan Rutinitas",
    tone: "green",
    items: [
      baseProducts.length
        ? `Produk yang paling relevan saat ini: ${baseProducts.slice(0, 3).join(", ")}.`
        : "Tambahkan produk pendukung secara bertahap, satu perubahan dalam satu waktu agar respons kulit mudah dipantau.",
      baseTips.length
        ? baseTips[0]
        : "Jaga pola tidur, hidrasi, dan hindari mengganti terlalu banyak produk sekaligus.",
    ],
  });

  const monitoringCopy =
    "Gunakan hasil pemeriksaan sebagai acuan awal dan lakukan sesi berikutnya untuk melihat konsistensi perubahan kulit.";

  const statusCopy =
    conditionStatus.label === "Menurun"
      ? "Jika hasil pemantauan menurun, hindari eksperimen produk agresif dan prioritaskan rutinitas yang menenangkan."
    : conditionStatus.label === "Meningkat"
      ? "Jika hasil pemantauan membaik, pertahankan rutinitas yang berjalan dan evaluasi kembali pada jadwal berikutnya."
    : conditionStatus.label === "Stabil"
      ? "Saat kondisi stabil, perubahan produk besar belum diperlukan kecuali ada keluhan baru."
      : "Pantau respons kulit pada sesi berikutnya sebelum mengambil keputusan perawatan yang lebih intens.";

  recommendations.push({
    priority: "pemantauan",
    title: "Arahan Pemantauan",
    tone: conditionStatus.tone,
    items: [monitoringCopy, statusCopy],
  });

  if (previous?.dominant_skin_type && latest?.dominant_skin_type && previous.dominant_skin_type !== latest.dominant_skin_type) {
    recommendations[2].items.push(
      `Jenis kulit berubah dari ${previous.dominant_skin_type} ke ${latest.dominant_skin_type}; validasi ulang akan membantu memastikan perubahan ini konsisten.`
    );
  }

  return recommendations;
};

export const generateMonitoringReminder = (sessions = []) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const latest = orderedSessions[orderedSessions.length - 1];
  const status = getConditionStatus(orderedSessions);
  const confidence = toConfidence(latest?.confidence);

  if (!latest || confidence < 0.6 || status.label === "Menurun") {
    return {
      days: 7,
      urgency: "segera",
      tone: "red",
      title: "Pemeriksaan ulang dalam 7 hari",
      message:
        "Disarankan pemeriksaan ulang dalam 7 hari agar kualitas data dan arah perkembangan kulit dapat dikonfirmasi.",
    };
  }

  if (confidence < 0.8 || status.label === "Perlu Pemantauan") {
    return {
      days: 14,
      urgency: "penting",
      tone: "yellow",
      title: "Pemeriksaan ulang dalam 14 hari",
      message:
        "Pemantauan lanjutan dalam 14 hari membantu memastikan hasil tetap konsisten dan tidak dipengaruhi kondisi scan.",
    };
  }

  return {
    days: 30,
    urgency: "rutin",
    tone: "blue",
    title: "Pemeriksaan ulang dalam 30 hari",
    message:
      "Kondisi pemantauan cukup baik. Pemeriksaan rutin dalam 30 hari sudah memadai untuk menjaga kontinuitas data.",
  };
};

export const generatePatientActivityFeed = (sessions = []) => {
  const orderedSessions = sortSessions(sessions).filter(Boolean);
  const latest = orderedSessions[orderedSessions.length - 1];
  const status = getConditionStatus(orderedSessions);
  const feed = [];

  if (!latest) return feed;

  feed.push({
    type: "scan",
    tone: "blue",
    title: "Pemeriksaan baru selesai",
    description: `Sesi ${latest.session_number || orderedSessions.length} tersimpan dengan hasil ${latest.dominant_skin_type || "-"}.`,
    date: latest.exam_date || latest.created_at,
  });

  feed.push({
    type: "status",
    tone: status.tone,
    title: "Hasil pemantauan diperbarui",
    description: `Status kondisi saat ini: ${status.label}.`,
    date: latest.exam_date || latest.created_at,
  });

  if (toConfidence(latest.confidence) < 0.6) {
    feed.push({
      type: "warning",
      tone: "red",
      title: "Pemeriksaan ulang disarankan",
      description: "Disarankan scan ulang dengan pencahayaan dan posisi wajah yang lebih stabil.",
      date: latest.exam_date || latest.created_at,
    });
  }

  if (orderedSessions.length > 1) {
    feed.push({
      type: "session",
      tone: "green",
      title: "Sesi baru ditambahkan",
      description: `Total pemantauan pasien kini berisi ${orderedSessions.length} sesi pemeriksaan.`,
      date: latest.exam_date || latest.created_at,
    });
  }

  return feed.slice(0, 4);
};
