/* Dictado en vivo: Web Speech (interino) o segmentos MediaRecorder -> Whisper local. */
let recStream = null, waveStream = null, audioCtx = null, analyser = null, recRAF = null, recStart = 0, recTimer = null;
let segCtx = null, segSrc = null, segProc = null, segGain = null, dictRec = false;
let utter = [], utterSpeechMs = 0, utterSilMs = 0;
let recog = null, listening = false;
let pendingTx = Promise.resolve();
let fallbackRec = false;
const SIL_MS = 700, MIN_SPEECH_MS = 300, MAX_UTTER_MS = 15000, RMS_MIN = 0.012;

function toggleMic() {
  if (dictando()) { stopDictado(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && !fallbackRec) return startWebSpeech(SR);
  return startRecorder();
}

/* ---- Modo Web Speech (Chrome/Opera): interino directo en el input ---- */
function startWebSpeech(SR) {
  const base = $("prompt").value;
  recog = new SR();
  recog.lang = "es-ES"; recog.continuous = true; recog.interimResults = true;
  recog.onresult = (e) => {
    let t = "";
    for (const r of e.results) t += r[0].transcript;
    $("prompt").value = (base + " " + t).trim();
  };
  recog.onerror = (e) => {
    if (["network", "audio-capture", "service-not-allowed"].includes(e.error)) {
      fallbackRec = true;
      listening = false;
      recog.stop();
      sideMsg("El dictado del navegador falló — usando Whisper local");
      startRecorder();
    }
  };
  recog.onend = () => {
    if (listening && !fallbackRec) { try { recog.start(); } catch { listening = false; } return; }
    listening = false;
    stopWaveStream();
    $("micBtn").classList.remove("btn-danger");
    hideRecUI();
  };
  try { recog.start(); } catch { fallbackRec = true; startRecorder(); return; }
  listening = true;
  $("micBtn").classList.add("btn-danger");
  showRecUI(null);
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((s) => { if (listening) { waveStream = s; showRecUI(s); } else s.getTracks().forEach((t) => t.stop()); })
    .catch(() => {});
}

/* ---- Modo VAD (Firefox/todos): corta en los silencios, no a mitad de palabra ---- */
async function startRecorder() {
  try {
    recStream = recStream || await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    sideMsg("Sin permiso de micrófono — acéptalo en el navegador");
    return;
  }
  dictRec = true;
  utter = []; utterSpeechMs = 0; utterSilMs = 0;
  segCtx = new (window.AudioContext || window.webkitAudioContext)();
  segSrc = segCtx.createMediaStreamSource(recStream);
  segProc = segCtx.createScriptProcessor(4096, 1, 1);
  segGain = segCtx.createGain(); segGain.gain.value = 0;
  segSrc.connect(segProc); segProc.connect(segGain); segGain.connect(segCtx.destination);
  segProc.onaudioprocess = (e) => {
    if (!dictRec) return;
    const inBuf = e.inputBuffer.getChannelData(0);
    const ratio = segCtx.sampleRate / 16000;
    const frameMs = (inBuf.length / segCtx.sampleRate) * 1000;
    let sum = 0;
    for (let i = 0; i < inBuf.length; i++) sum += inBuf[i] * inBuf[i];
    const rms = Math.sqrt(sum / inBuf.length);
    if (rms > RMS_MIN) { utterSpeechMs += frameMs; utterSilMs = 0; } else { utterSilMs += frameMs; }
    if (utterSpeechMs > 0) for (let i = 0; i < inBuf.length; i += ratio) utter.push(inBuf[Math.floor(i)]);
    const utterMs = (utter.length / 16000) * 1000;
    if (utterSpeechMs >= MIN_SPEECH_MS && (utterSilMs >= SIL_MS || utterMs >= MAX_UTTER_MS)) emitUtter();
  };
  $("micBtn").classList.add("btn-danger");
  showRecUI(recStream);
  sideMsg("Escuchando…");
}

function emitUtter() {
  if (!utter.length) return;
  const blob = encodeWav(new Float32Array(utter), 16000);
  utter = []; utterSpeechMs = 0; utterSilMs = 0;
  pendingTx = pendingTx.then(() => sendChunk(blob));
}

function encodeWav(samples, rate) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

async function sendChunk(blob) {
  const fd = new FormData();
  fd.append("audio", blob, "voz.wav");
  sideMsg("Transcribiendo…");
  try {
    const r = await api("/api/voz", { method: "POST", body: fd });
    if (r.text) {
      const p = $("prompt");
      p.value = (p.value + " " + r.text).trim();
      sideMsg("Escuchando…");
    }
  } catch (e) { sideMsg("Error transcribiendo: " + e.message); }
}

function dictando() {
  return listening || dictRec;
}

/* Detiene AMBOS modos y espera a que el texto final quede en el input. */
async function stopDictado() {
  listening = false;
  dictRec = false;
  try { if (recog) recog.stop(); } catch {}
  stopWaveStream();
  /* Corta el procesamiento de audio y suelta el micrófono por completo. */
  if (utterSpeechMs >= MIN_SPEECH_MS) emitUtter();
  try { if (segProc) segProc.onaudioprocess = null; } catch {}
  try { if (segSrc) segSrc.disconnect(); if (segProc) segProc.disconnect(); if (segGain) segGain.disconnect(); } catch {}
  segSrc = segProc = segGain = null;
  if (segCtx) { segCtx.close().catch(() => {}); segCtx = null; }
  /* Deja correr el onresult final del reconocedor antes de leer el input. */
  await new Promise((r) => setTimeout(r, 400));
  await pendingTx;
  if (recStream) { recStream.getTracks().forEach((t) => t.stop()); recStream = null; }
  recog = null;
  $("micBtn").classList.remove("btn-danger");
  hideRecUI();
  sideMsg("");
}

function stopWaveStream() {
  if (waveStream) { waveStream.getTracks().forEach((t) => t.stop()); waveStream = null; }
}

/* ---- Indicador de grabación: punto, onda de volumen y cronómetro ---- */
function showRecUI(stream) {
  if (recTimer) clearInterval(recTimer);
  if (recRAF) cancelAnimationFrame(recRAF);
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  const bar = $("recBar");
  bar.classList.remove("d-none"); bar.classList.add("d-flex");
  recStart = Date.now();
  recTimer = setInterval(() => { $("recTime").textContent = fmtTime((Date.now() - recStart) / 1000); }, 500);
  if (!stream) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  src.connect(analyser);
  drawWave();
}

function drawWave() {
  if (!analyser) return;
  const c = $("recCanvas"), ctx = c.getContext("2d");
  const data = new Uint8Array(analyser.frequencyBinCount);
  recRAF = requestAnimationFrame(drawWave);
  analyser.getByteFrequencyData(data);
  ctx.clearRect(0, 0, c.width, c.height);
  const w = c.width / data.length;
  ctx.fillStyle = "#38bdf8";
  for (let i = 0; i < data.length; i++) {
    const h = Math.max(2, (data[i] / 255) * c.height);
    ctx.fillRect(i * w, (c.height - h) / 2, w * 0.7, h);
  }
}

function hideRecUI() {
  const bar = $("recBar");
  bar.classList.add("d-none"); bar.classList.remove("d-flex");
  if (recRAF) cancelAnimationFrame(recRAF);
  if (recTimer) clearInterval(recTimer);
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
}

function fmtTime(s) {
  s = Math.floor(s);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
