const isValidId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getFlowState = () => {
  try {
    return JSON.parse(sessionStorage.getItem("skinai_flow_audit") || "{}");
  } catch (error) {
    console.error("FLOW AUDIT STATE ERROR", error);
    return {};
  }
};

const setFlowState = (nextState) => {
  sessionStorage.setItem(
    "skinai_flow_audit",
    JSON.stringify({
      ...getFlowState(),
      ...nextState,
    })
  );
};

export const markSaveFlow = ({ payload, response }) => {
  const historyId = response?.history_id;
  const patientId = response?.patient_id;
  const sessionNumber = response?.session_number;

  if (!isValidId(historyId) || !isValidId(patientId) || !isValidId(sessionNumber)) {
    console.error("FLOW TEST INVALID SAVE", {
      payload,
      response,
    });
    return false;
  }

  setFlowState({
    historyId: Number(historyId),
    patientId: Number(patientId),
    sessionNumber: Number(sessionNumber),
    kodePasien: payload?.kode_pasien,
    mode: sessionNumber > 1 ? "tracking" : "baru",
    savedAt: Date.now(),
    resultLoaded: false,
    rekamMedisLoaded: false,
    detailLoaded: false,
  });

  console.log("FLOW TEST OK", {
    stage: "save",
    history_id: Number(historyId),
    patient_id: Number(patientId),
    session_number: Number(sessionNumber),
    redirect_expected: `/result/${historyId}`,
  });

  return true;
};

export const markResultFlow = (result) => {
  const state = getFlowState();

  if (
    Number(result?.id) !== Number(state.historyId) ||
    Number(result?.patient_id) !== Number(state.patientId) ||
    Number(result?.session_number) !== Number(state.sessionNumber)
  ) {
    return false;
  }

  setFlowState({
    resultLoaded: true,
  });

  console.log("FLOW TEST OK", {
    stage: "result",
    history_id: result.id,
    patient_id: result.patient_id,
    session_number: result.session_number,
    backend_result: true,
  });

  return true;
};

export const markRekamMedisFlow = (rows) => {
  const state = getFlowState();
  const matched = rows?.some(
    (item) =>
      Number(item.id) === Number(state.historyId) &&
      Number(item.patient_id) === Number(state.patientId)
  );

  if (!matched) {
    return false;
  }

  setFlowState({
    rekamMedisLoaded: true,
  });

  console.log("FLOW TEST OK", {
    stage: "rekam-medis",
    history_id: state.historyId,
    patient_id: state.patientId,
    refresh_persisted: true,
  });

  return true;
};

export const markDetailFlow = (patientData) => {
  const state = getFlowState();
  const sessions = patientData?.sessions || [];
  const matchedSession = sessions.find(
    (session) =>
      Number(session.id) === Number(state.historyId) &&
      Number(session.patient_id) === Number(state.patientId)
  );
  const sessionNumbers = sessions.map((session) => Number(session.session_number));
  const sessionNumbersSequential = sessionNumbers.every(
    (sessionNumber, index) => sessionNumber === index + 1
  );

  if (!matchedSession || !sessionNumbersSequential) {
    return false;
  }

  setFlowState({
    detailLoaded: true,
  });

  console.log("FLOW TEST OK", {
    stage: "detail-pasien",
    history_id: matchedSession.id,
    patient_id: state.patientId,
    session_number: matchedSession.session_number,
    timeline_count: sessions.length,
    timeline_incremented: sessions.length >= Number(matchedSession.session_number),
    session_numbers_sequential: true,
  });

  return true;
};


