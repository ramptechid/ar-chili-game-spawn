/* =========================
   API CONFIG
========================= */

const API_BASE_URL = "https://cabeijo-api.ramptech.online";

const SAVE_SCORE_API = `${API_BASE_URL}/save_score.php`;
const GET_LEADERBOARD_API = `${API_BASE_URL}/get_leaderboard.php`;
const API_TIMEOUT_MS = 15000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error("API returned an invalid JSON response.");
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || `API request failed (${response.status}).`);
    }

    return data || {};
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("API request timed out. Please check your local XAMPP API.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* =========================
   ELEMENTS
========================= */

const cameraView = document.getElementById("cameraView");
const xrCanvas = document.getElementById("xrCanvas");
const gameArea = document.getElementById("gameArea");

const introScreen = document.getElementById("introScreen");
const resultScreen = document.getElementById("resultScreen");
const gameHud = document.getElementById("gameHud");

const startBtn = document.getElementById("startBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const shareBtn = document.getElementById("shareBtn");
const catchBtn = document.getElementById("catchBtn");

const saveScoreBtn = document.getElementById("saveScoreBtn");
const saveScoreModal = document.getElementById("saveScoreModal");
const closeSaveModalBtn = document.getElementById("closeSaveModalBtn");
const submitScoreBtn = document.getElementById("submitScoreBtn");

const playerNameInput = document.getElementById("playerNameInput");
const playerEmailInput = document.getElementById("playerEmailInput");
const modalScoreText = document.getElementById("modalScoreText");
const saveMessage = document.getElementById("saveMessage");
const topFiveInfo = document.getElementById("topFiveInfo");

const appNotice = document.getElementById("appNotice");
const appNoticeTitle = document.getElementById("appNoticeTitle");
const appNoticeText = document.getElementById("appNoticeText");
const closeAppNoticeBtn = document.getElementById("closeAppNoticeBtn");

const scoreText = document.getElementById("scoreText");
const timerText = document.getElementById("timerText");
const finalScoreText = document.getElementById("finalScoreText");
const leaderboardList = document.getElementById("leaderboardList");

/* =========================
   GAME CONFIG
========================= */

const TARGET_SCORE        = 5;
const PLAY_AGAIN_COOLDOWN = 5;
const WEBXR_ONLY_MODE = true;
const CHILI_LIFETIME_MIN  = 3600;
const CHILI_LIFETIME_MAX  = 12500;
const CHILI_EXPIRE_STAGGER_MIN = 460;
const CHILI_EXPIRE_STAGGER_MAX = 1100;
const NEXT_CHILI_OVERLAP_MIN = 900;
const NEXT_CHILI_OVERLAP_MAX = 2400;
const MAX_ACTIVE_CHILIES = 32;
const INITIAL_CHILI_COUNT = 26;
const SPAWN_REFILL_INTERVAL = 420;
const MIN_VISIBLE_CHILIES = 10;
const VIEW_REFILL_COOLDOWN = 450;
const OFFSCREEN_EXPIRE_MS = 900;
const OFFSCREEN_MARGIN = 140;
const XR_MAX_ACTIVE_OBJECTS = 26;
const XR_INITIAL_OBJECTS = 18;
const XR_INITIAL_SPAWN_DELAY_MIN = 140;
const XR_INITIAL_SPAWN_DELAY_MAX = 320;
const XR_SPAWN_DELAY_MIN = 900;
const XR_SPAWN_DELAY_MAX = 1700;
const XR_LIFETIME_MIN = Infinity;
const XR_LIFETIME_MAX = Infinity;

// UKURAN 3D DIPERBESAR DI SINI (0.8 - 1.4)
const XR_SIZE_MIN = 0.80;  
const XR_SIZE_MAX = 1.40;  

const XR_DISTANCE_MIN = 2.4;
const XR_DISTANCE_MAX = 5.2;
const XR_HEIGHT_MIN = -0.4;
const XR_HEIGHT_MAX = 0.55;
const XR_MIN_OBJECT_SPACING = 0.9;
const XR_SPAWN_ATTEMPTS = 24;
const XR_TARGET_SPAWN_RATIO = 0.16;
const XR_MIN_TARGET_OBJECTS = 2;
const XR_MAX_TARGET_RATIO = 0.24;
const XR_CATCH_ANIM_MS = 480;
const XR_FADEIN_MS = 320;
const XR_EXPIRE_MS = 520;
const XR_EXPIRE_STAGGER_MIN = 520;
const XR_EXPIRE_STAGGER_MAX = 1250;

// PENCAHAYAAN MATERIAL AGAR WARNA KELUAR
const XR_MATERIAL_EXPOSURE = 2.0; 
const XR_MATERIAL_MIN_COLOR = 0.36;
const XR_MATERIAL_BLACK_FLOOR = 0.06;

const CHILI_SIZE_MIN = 34;
const CHILI_SIZE_MAX = 82;
const WORLD_RANGE_H = 24;
const WORLD_RANGE_V = 16;
const MIN_CHILI_SCREEN_DISTANCE = 36;
const DEPTH_MIN = 0.58;
const DEPTH_MAX = 1.1;
const TARGET_SPAWN_RATIO = 0.2;
const MIN_TARGET_CHILIES = 1;
const VOICE_CATCH_COOLDOWN_MS = 850;
const SHOUT_RMS_THRESHOLD = 0.18;

const TARGET_ASSET = {
  src: "assets/images/chili-green.png",
  modelSrc: "assets/models/chili_green_low_poly.glb",
  alt: "Green Chili",
  isTarget: true,
  minSize: 38,
  maxSize: 74
};

const DECOY_ASSETS = [
  { src: "assets/images/bintang.png", modelSrc: "assets/models/Alarm_Clock.glb", alt: "Alarm Clock Decoy", minSize: 34, maxSize: 68 },
  { src: "assets/images/kotak-tinggi.png", modelSrc: "assets/models/Ball.glb", alt: "Ball Decoy", minSize: 38, maxSize: 78 },
  { src: "assets/images/persegi-panjang.png", modelSrc: "assets/models/Barbel_3Kg.glb", alt: "Barbell Decoy", minSize: 44, maxSize: 86 },
  { src: "assets/images/segi-enam.png", modelSrc: "assets/models/Bedside_Table_001.glb", alt: "Bedside Table Decoy", minSize: 36, maxSize: 72 },
  { src: "assets/images/bintang.png", modelSrc: "assets/models/Horn.glb", alt: "Horn Decoy", minSize: 38, maxSize: 78 },
  { src: "assets/images/kotak-tinggi.png", modelSrc: "assets/models/Plane.glb", alt: "Plane Decoy", minSize: 42, maxSize: 82 },
  { src: "assets/images/persegi-panjang.png", modelSrc: "assets/models/Sun_Glasses.glb", alt: "Sun Glasses Decoy", minSize: 44, maxSize: 84 },
  { src: "assets/images/segi-enam.png", modelSrc: "assets/models/Table.glb", alt: "Table Decoy", minSize: 42, maxSize: 82 },
  { src: "assets/images/bintang.png", modelSrc: "assets/models/Tea_Pot.glb", alt: "Tea Pot Decoy", minSize: 38, maxSize: 78 }
];

// Pixels per 1° of phone rotation
const PX_PER_DEG_H = window.innerWidth  / 28;
const PX_PER_DEG_V = window.innerHeight / 36;

// Exponential smoothing factor for orientation
const ORIENT_SMOOTH = 0.2;
const ORIENT_DEADZONE = 0.035;

/* =========================
   STATE
========================= */

let score = 0;
let elapsedTime = 0;
let gameRunning = false;
let scoreSaved = false;

let timerInterval = null;
let spawnInterval = null;
let spawnTimeouts = [];
let playAgainCooldownInterval = null;
let lastViewRefillAt = 0;
let nextChiliExpireAt = 0;

let cameraStarted = false;
let cameraStream = null;
let xrActive = false;
let xrSession = null;
let xrRefSpace = null;
let xrGl = null;
let xrProgram = null;
let xrModels = new Map();
let xrObjects = [];
let xrLastPose = null;
let xrLastView = null;
let xrLastViewProjection = null;
let xrLastRefillAt = 0;
let xrSpawnInterval = null;
let xrSpawnTimeout = null;
let xrInitialSpawnTimeouts = [];
let nextXRExpireAt = 0;
let voiceActive = false;
let voiceStream = null;
let voiceRecognition = null;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceLoopId = null;
let lastVoiceCatchAt = 0;

let orientationActive = false;
let baseGamma     = null;
let baseBeta      = null;
let rawGamma      = 0;
let rawBeta       = 0;
let smoothGamma   = 0;
let smoothBeta    = 0;
let orientLoopId  = null;

document.body.classList.add("intro-mode");

/* =========================
   EVENTS
========================= */

startBtn.addEventListener("click", startGame);
playAgainBtn.addEventListener("click", resetToIntro);
shareBtn.addEventListener("click", shareScoreImage);
catchBtn.addEventListener("click", catchChiliByMarker);

saveScoreBtn.addEventListener("click", openSaveScoreModal);
closeSaveModalBtn.addEventListener("click", closeSaveScoreModal);
submitScoreBtn.addEventListener("click", submitScore);
closeAppNoticeBtn.addEventListener("click", closeAppNotice);

/* =========================
   DEVICE ORIENTATION
========================= */

async function startOrientationTracking() {
  if (WEBXR_ONLY_MODE) return false;
  if (orientationActive) return;

  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== "granted") return;
    } catch (e) {
      return;
    }
  }

  orientationActive = true;
  baseGamma = null;
  baseBeta = null;
  window.addEventListener("deviceorientation", handleOrientation, true);
}

function stopOrientationTracking() {
  if (!orientationActive) return;
  orientationActive = false;
  window.removeEventListener("deviceorientation", handleOrientation, true);
  if (orientLoopId !== null) {
    cancelAnimationFrame(orientLoopId);
    orientLoopId = null;
  }
  baseGamma = null;
  baseBeta  = null;
}

function handleOrientation(event) {
  if (!gameRunning) return;

  const gamma = event.gamma ?? 0;
  const beta  = event.beta  ?? 0;

  if (baseGamma === null) {
    baseGamma   = gamma;
    baseBeta    = beta;
    smoothGamma = gamma;
    smoothBeta  = beta;
    rawGamma    = gamma;
    rawBeta     = beta;
    startOrientationLoop();
    return;
  }

  rawGamma = gamma;
  rawBeta  = beta;
}

function startOrientationLoop() {
  if (orientLoopId !== null) return;

  function loop() {
    if (!gameRunning || !orientationActive) {
      orientLoopId = null;
      return;
    }
    smoothGamma = smoothAngle(smoothGamma, rawGamma);
    smoothBeta  = smoothAngle(smoothBeta, rawBeta);

    repositionChilies();
    orientLoopId = requestAnimationFrame(loop);
  }
  orientLoopId = requestAnimationFrame(loop);
}

function repositionChilies() {
  if (baseGamma === null) return;

  document.querySelectorAll(".chili").forEach((chili) => {
    if (chili.dataset.caught === "true") return;
    if (chili.dataset.wg === undefined) return;

    projectWorldChili(chili);
    updateOffscreenExpiry(chili);
  });

  refillCurrentViewIfNeeded();
}

function projectWorldChili(chili) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  const wg = parseFloat(chili.dataset.wg);
  const wb = parseFloat(chili.dataset.wb);
  const hs = parseFloat(chili.dataset.hs);
  const deltaGamma = wg - smoothGamma;
  const deltaBeta = wb - smoothBeta;

  chili.style.left = `${cx - deltaGamma * PX_PER_DEG_H - hs}px`;
  chili.style.top = `${cy - deltaBeta * PX_PER_DEG_V - hs}px`;
  updateChili3DStyle(chili, deltaGamma, deltaBeta);
}

function updateChili3DStyle(chili, deltaGamma, deltaBeta) {
  const depth = parseFloat(chili.dataset.depth || "1");
  const angularDistance = Math.sqrt(deltaGamma * deltaGamma + deltaBeta * deltaBeta);
  const centerFactor = clamp(1 - angularDistance / 22, 0, 1);
  const visualScale = depth * (0.86 + centerFactor * 0.22);
  const brightness = (0.76 + visualScale * 0.2).toFixed(2);
  const saturate = (0.82 + visualScale * 0.22).toFixed(2);
  const shadowY = Math.round(8 + visualScale * 12);
  const shadowBlur = Math.round(14 + visualScale * 20);
  const shadowAlpha = (0.22 + visualScale * 0.28).toFixed(2);

  chili.style.scale = visualScale.toFixed(3);
  chili.style.zIndex = Math.round(visualScale * 100);
  chili.style.filter = `brightness(${brightness}) saturate(${saturate}) drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha}))`;
}

function updateOffscreenExpiry(chili) {
  if (chili.classList.contains("chili-expire")) return;

  const rect = chili.getBoundingClientRect();
  const isVisible = isRectInViewport(rect, OFFSCREEN_MARGIN);

  if (isVisible) {
    delete chili.dataset.offscreenSince;
    return;
  }

  const now = Date.now();
  if (chili.dataset.offscreenSince === undefined) {
    chili.dataset.offscreenSince = now;
    return;
  }
  if (now - Number(chili.dataset.offscreenSince) >= OFFSCREEN_EXPIRE_MS) {
    expireChili(chili);
  }
}

function refillCurrentViewIfNeeded() {
  if (!gameRunning || baseGamma === null) return;
  if (Date.now() - lastViewRefillAt < VIEW_REFILL_COOLDOWN) return;
  if (getVisibleChiliCount() >= MIN_VISIBLE_CHILIES) return;
  if (getActiveChiliCount() >= MAX_ACTIVE_CHILIES) return;

  lastViewRefillAt = Date.now();
  spawnChili(true);
}

function resetAimMarker() {
  const target = document.querySelector(".aim-area");
  if (!target) return;
  target.style.left = "";
  target.style.top = "";
}

/* =========================
   CAMERA
========================= */

async function startCamera() {
  if (cameraStarted && cameraStream) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    cameraStream = stream;
    cameraView.srcObject = stream;
    cameraStarted = true;
    return true;
  } catch (error) {
    showAppNotice("Camera Needed", "Camera access is required to play this game. Please allow camera access.");
    return false;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
  cameraStream = null;
  cameraStarted = false;
  cameraView.srcObject = null;
}

/* =========================
   WEBXR AR
========================= */

async function startXRSession() {
  if (!navigator.xr || !xrCanvas) return false;

  try {
    if (!xrGl) {
      xrGl = xrCanvas.getContext("webgl", { xrCompatible: true, alpha: true, antialias: false, depth: true });
    }
    if (!xrGl) return false;

    xrCanvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      xrModels.clear();
    }, { once: true });

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: document.body }
    });

    await xrGl.makeXRCompatible();
    xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(xrSession, xrGl, { alpha: true, antialias: false, depth: true })
    });

    try {
      xrRefSpace = await xrSession.requestReferenceSpace("local-floor");
    } catch {
      xrRefSpace = await xrSession.requestReferenceSpace("local");
    }

    setupXRRenderer();
    await loadXRModels();

    xrObjects = [];
    xrActive = true;
    document.body.classList.add("xr-mode");

    xrSession.addEventListener("end", () => {
      stopXRSession(false);
      if (gameRunning) endGame();
    });

    xrSession.requestAnimationFrame(onXRFrame);
    return true;
  } catch (error) {
    console.warn("WebXR AR unavailable:", error.name, error.message);
    stopXRSession(false);
    return false;
  }
}

function setupXRRenderer() {
  const vertexShader = createXRShader(xrGl.VERTEX_SHADER, `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec4 a_color;
    uniform mat4 u_matrix;
    uniform mat4 u_model;
    varying float v_light;
    varying vec4 v_color;

    void main() {
      vec3 normal = normalize(mat3(u_model) * a_normal);
      vec3 lightDir = normalize(vec3(0.35, 0.8, 0.45));
      // LIGHTING DITINGKATKAN AGAR WARNA LEBIH "KELUAR"
      v_light = 1.3 + max(dot(normal, lightDir), 0.0) * 1.5;
      v_color = a_color;
      gl_Position = u_matrix * vec4(a_position, 1.0);
    }
  `);
  
  const fragmentShader = createXRShader(xrGl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec4 u_color;
    uniform float u_alpha;
    varying float v_light;
    varying vec4 v_color;

    void main() {
      vec4 color = u_color * v_color;
      vec3 displayColor = pow(clamp(color.rgb * v_light, 0.0, 1.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(displayColor, color.a * u_alpha);
    }
  `);

  xrProgram = xrGl.createProgram();
  xrGl.attachShader(xrProgram, vertexShader);
  xrGl.attachShader(xrProgram, fragmentShader);
  xrGl.linkProgram(xrProgram);

  xrGl.enable(xrGl.DEPTH_TEST);
  xrGl.depthFunc(xrGl.LEQUAL);
  xrGl.enable(xrGl.BLEND);
  xrGl.blendFunc(xrGl.SRC_ALPHA, xrGl.ONE_MINUS_SRC_ALPHA);
}

function createXRShader(type, source) {
  const shader = xrGl.createShader(type);
  xrGl.shaderSource(shader, source);
  xrGl.compileShader(shader);
  return shader;
}

async function loadXRModels() {
  const assets = [TARGET_ASSET, ...DECOY_ASSETS];
  await Promise.all(assets.map((asset) => loadXRModel(asset.modelSrc)));
}

async function loadXRModel(src) {
  if (xrModels.has(src)) return xrModels.get(src);
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Unable to load 3D model: ${src}`);
  const model = createXRModelFromGlb(await response.arrayBuffer());
  xrModels.set(src, model);
  return model;
}

function createXRModelFromGlb(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const magic = dataView.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("Invalid GLB file.");

  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < arrayBuffer.byteLength) {
    const chunkLength = dataView.getUint32(offset, true);
    const chunkType = dataView.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunk = arrayBuffer.slice(chunkStart, chunkStart + chunkLength);

    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(chunk).trim());
    } else if (chunkType === 0x004e4942) {
      bin = chunk;
    }
    offset = chunkStart + chunkLength;
  }

  const materials = (json.materials || []).map((material) => getXRMaterialColor(material));
  const primitives = [];
  const parsedPrimitives = [];

  (json.meshes || []).forEach((mesh) => {
    (mesh.primitives || []).forEach((primitive) => {
      const positions = readGlbAccessor(json, bin, primitive.attributes.POSITION);
      const normals = primitive.attributes.NORMAL !== undefined
        ? readGlbAccessor(json, bin, primitive.attributes.NORMAL)
        : new Float32Array(positions.length);
      const colors = primitive.attributes.COLOR_0 !== undefined
        ? readGlbAccessorInfo(json, bin, primitive.attributes.COLOR_0)
        : null;
      const indices = primitive.indices !== undefined
        ? readGlbAccessor(json, bin, primitive.indices)
        : null;

      parsedPrimitives.push({ positions, normals, colors, indices, material: primitive.material });
    });
  });

  const bounds = getXRModelBounds(parsedPrimitives);

  parsedPrimitives.forEach((primitive) => {
    const positions = normalizeXRPositions(primitive.positions, bounds);
    const positionBuffer = xrGl.createBuffer();
    xrGl.bindBuffer(xrGl.ARRAY_BUFFER, positionBuffer);
    xrGl.bufferData(xrGl.ARRAY_BUFFER, positions, xrGl.STATIC_DRAW);

    const normalBuffer = xrGl.createBuffer();
    xrGl.bindBuffer(xrGl.ARRAY_BUFFER, normalBuffer);
    xrGl.bufferData(xrGl.ARRAY_BUFFER, primitive.normals, xrGl.STATIC_DRAW);

    let colorBuffer = null;
    if (primitive.colors) {
      colorBuffer = xrGl.createBuffer();
      xrGl.bindBuffer(xrGl.ARRAY_BUFFER, colorBuffer);
      xrGl.bufferData(xrGl.ARRAY_BUFFER, primitive.colors.values, xrGl.STATIC_DRAW);
    }

    let indexBuffer = null;
    if (primitive.indices) {
      indexBuffer = xrGl.createBuffer();
      xrGl.bindBuffer(xrGl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      xrGl.bufferData(xrGl.ELEMENT_ARRAY_BUFFER, primitive.indices, xrGl.STATIC_DRAW);
    }

    primitives.push({
      positionBuffer, normalBuffer, colorBuffer,
      colorComponentCount: primitive.colors?.componentCount || 4,
      colorComponentType: primitive.colors ? getXRAttributeType(primitive.colors.values) : xrGl.FLOAT,
      colorNormalized: primitive.colors?.normalized || false,
      indexBuffer,
      indexType: getXRIndexType(primitive.indices),
      count: primitive.indices ? primitive.indices.length : positions.length / 3,
      color: materials[primitive.material] || new Float32Array([0.85, 1, 0.45, 1])
    });
  });

  return { primitives };
}

function getXRMaterialColor(material) {
  const factor = material?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
  const color = [
    factor[0] ?? 1, factor[1] ?? 1, factor[2] ?? 1
  ].map((channel) => clamp(channel * XR_MATERIAL_EXPOSURE, 0, 1));
  const alpha = factor[3] ?? 1;
  const maxChannel = Math.max(color[0], color[1], color[2]);

  if (maxChannel <= 0.001) {
    return new Float32Array([XR_MATERIAL_BLACK_FLOOR, XR_MATERIAL_BLACK_FLOOR, XR_MATERIAL_BLACK_FLOOR, alpha]);
  }

  if (maxChannel < XR_MATERIAL_MIN_COLOR) {
    const boost = XR_MATERIAL_MIN_COLOR / maxChannel;
    color[0] = clamp(color[0] * boost, 0, 1);
    color[1] = clamp(color[1] * boost, 0, 1);
    color[2] = clamp(color[2] * boost, 0, 1);
  }
  return new Float32Array([color[0], color[1], color[2], alpha]);
}

function getXRModelBounds(primitives) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  primitives.forEach((primitive) => {
    for (let i = 0; i < primitive.positions.length; i += 3) {
      min[0] = Math.min(min[0], primitive.positions[i]);
      min[1] = Math.min(min[1], primitive.positions[i + 1]);
      min[2] = Math.min(min[2], primitive.positions[i + 2]);
      max[0] = Math.max(max[0], primitive.positions[i]);
      max[1] = Math.max(max[1], primitive.positions[i + 1]);
      max[2] = Math.max(max[2], primitive.positions[i + 2]);
    }
  });

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const longestSide = Math.max(size[0], size[1], size[2], 0.0001);

  return {
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    scale: 1 / longestSide
  };
}

function normalizeXRPositions(positions, bounds) {
  const normalized = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    normalized[i] = (positions[i] - bounds.center[0]) * bounds.scale;
    normalized[i + 1] = (positions[i + 1] - bounds.center[1]) * bounds.scale;
    normalized[i + 2] = (positions[i + 2] - bounds.center[2]) * bounds.scale;
  }
  return normalized;
}

function getXRIndexType(indices) {
  if (!indices) return xrGl.UNSIGNED_SHORT;
  if (indices instanceof Uint32Array) return xrGl.UNSIGNED_INT;
  if (indices instanceof Uint8Array) return xrGl.UNSIGNED_BYTE;
  return xrGl.UNSIGNED_SHORT;
}

function getXRAttributeType(values) {
  if (values instanceof Float32Array) return xrGl.FLOAT;
  if (values instanceof Uint8Array) return xrGl.UNSIGNED_BYTE;
  if (values instanceof Int8Array) return xrGl.BYTE;
  if (values instanceof Uint16Array) return xrGl.UNSIGNED_SHORT;
  if (values instanceof Int16Array) return xrGl.SHORT;
  return xrGl.FLOAT;
}

function readGlbAccessor(json, bin, accessorIndex) {
  return readGlbAccessorInfo(json, bin, accessorIndex).values;
}

function readGlbAccessorInfo(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentCount = getGlbAccessorComponentCount(accessor.type);
  const TypedArray = getGlbAccessorArrayType(accessor.componentType);
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  return {
    values: new TypedArray(bin, byteOffset, accessor.count * componentCount),
    componentCount, componentType: accessor.componentType, normalized: !!accessor.normalized
  };
}

function getGlbAccessorComponentCount(type) {
  switch (type) {
    case "SCALAR": return 1; case "VEC2": return 2; case "VEC3": return 3; case "VEC4": return 4;
    default: throw new Error(`Unsupported GLB accessor type: ${type}`);
  }
}

function getGlbAccessorArrayType(componentType) {
  switch (componentType) {
    case 5120: return Int8Array; case 5121: return Uint8Array; case 5122: return Int16Array;
    case 5123: return Uint16Array; case 5125: return Uint32Array; case 5126: return Float32Array;
    default: throw new Error(`Unsupported GLB component type: ${componentType}`);
  }
}

function onXRFrame(time, frame) {
  if (!xrSession || !xrRefSpace) return;
  xrSession.requestAnimationFrame(onXRFrame);
  const pose = frame.getViewerPose(xrRefSpace);
  if (!pose) return;

  xrLastPose = pose;
  const layer = xrSession.renderState.baseLayer;
  xrGl.bindFramebuffer(xrGl.FRAMEBUFFER, layer.framebuffer);
  xrGl.clearColor(0, 0, 0, 0);
  xrGl.clear(xrGl.COLOR_BUFFER_BIT | xrGl.DEPTH_BUFFER_BIT);

  const view = pose.views[0];
  xrLastView = view;
  xrLastViewProjection = multiplyMat4(view.projectionMatrix, view.transform.inverse.matrix);

  expireXRObjects(time);

  for (const xrView of pose.views) {
    const viewport = layer.getViewport(xrView);
    xrGl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    renderXRObjects(xrView);
  }
}

function renderXRObjects(view) {
  xrGl.useProgram(xrProgram);
  const positionLocation = xrGl.getAttribLocation(xrProgram, "a_position");
  const normalLocation = xrGl.getAttribLocation(xrProgram, "a_normal");
  const vertexColorLocation = xrGl.getAttribLocation(xrProgram, "a_color");
  const matrixLocation = xrGl.getUniformLocation(xrProgram, "u_matrix");
  const modelLocation = xrGl.getUniformLocation(xrProgram, "u_model");
  const alphaLocation = xrGl.getUniformLocation(xrProgram, "u_alpha");
  const colorLocation = xrGl.getUniformLocation(xrProgram, "u_color");
  const viewProjection = multiplyMat4(view.projectionMatrix, view.transform.inverse.matrix);
  const now = performance.now();

  xrObjects.forEach((object) => {
    if (object.caught) return;
    let alpha = 1, scale = 1;

    if (object.catching) {
      alpha = 1 - clamp((now - object.catchStartAt) / XR_CATCH_ANIM_MS, 0, 1);
    } else if (object.expiring) {
      alpha = 1 - clamp((now - object.expireStartedAt) / XR_EXPIRE_MS, 0, 1);
    } else if (object.fadeIn) {
      const t = clamp((now - object.fadeInStart) / XR_FADEIN_MS, 0, 1);
      alpha = t;
      if (t >= 1) object.fadeIn = false;
    }

    if (alpha <= 0.01) return;

    const modelMatrix = makeXRObjectMatrix(object, scale);
    const matrix = multiplyMat4(viewProjection, modelMatrix);
    const model = xrModels.get(object.asset.modelSrc);
    if (!model) return;

    xrGl.uniform1f(alphaLocation, alpha);
    xrGl.uniformMatrix4fv(matrixLocation, false, matrix);
    xrGl.uniformMatrix4fv(modelLocation, false, modelMatrix);

    model.primitives.forEach((p) => {
      xrGl.bindBuffer(xrGl.ARRAY_BUFFER, p.positionBuffer);
      xrGl.enableVertexAttribArray(positionLocation);
      xrGl.vertexAttribPointer(positionLocation, 3, xrGl.FLOAT, false, 0, 0);

      xrGl.bindBuffer(xrGl.ARRAY_BUFFER, p.normalBuffer);
      xrGl.enableVertexAttribArray(normalLocation);
      xrGl.vertexAttribPointer(normalLocation, 3, xrGl.FLOAT, false, 0, 0);

      if (p.colorBuffer) {
        xrGl.bindBuffer(xrGl.ARRAY_BUFFER, p.colorBuffer);
        xrGl.enableVertexAttribArray(vertexColorLocation);
        xrGl.vertexAttribPointer(vertexColorLocation, p.colorComponentCount, p.colorComponentType, p.colorNormalized, 0, 0);
      } else {
        xrGl.disableVertexAttribArray(vertexColorLocation);
        xrGl.vertexAttrib4f(vertexColorLocation, 1, 1, 1, 1);
      }
      xrGl.uniform4fv(colorLocation, p.color);

      if (p.indexBuffer) {
        xrGl.bindBuffer(xrGl.ELEMENT_ARRAY_BUFFER, p.indexBuffer);
        xrGl.drawElements(xrGl.TRIANGLES, p.count, p.indexType, 0);
      } else {
        xrGl.drawArrays(xrGl.TRIANGLES, 0, p.count);
      }
    });
  });
}

function runXRSpawner() {
  clearInterval(xrSpawnInterval);
  clearTimeout(xrSpawnTimeout);
  xrInitialSpawnTimeouts.forEach((tid) => clearTimeout(tid));
  xrSpawnInterval = null;
  xrSpawnTimeout = null;
  xrInitialSpawnTimeouts = [];

  let initialDelay = 350;
  for (let i = 0; i < XR_INITIAL_OBJECTS; i++) {
    const timeoutId = setTimeout(() => {
      xrInitialSpawnTimeouts = xrInitialSpawnTimeouts.filter((id) => id !== timeoutId);
      if (gameRunning && xrActive) spawnXRObject(false);
    }, initialDelay);
    xrInitialSpawnTimeouts.push(timeoutId);
    initialDelay += randomNumber(XR_INITIAL_SPAWN_DELAY_MIN, XR_INITIAL_SPAWN_DELAY_MAX);
  }
  scheduleNextXRSpawn(initialDelay + randomNumber(600, 1100));
}

function scheduleNextXRSpawn(delay = randomNumber(XR_SPAWN_DELAY_MIN, XR_SPAWN_DELAY_MAX)) {
  clearTimeout(xrSpawnTimeout);
  xrSpawnTimeout = setTimeout(() => {
    xrSpawnTimeout = null;
    if (gameRunning && xrActive && getActiveXRObjectCount() < XR_MAX_ACTIVE_OBJECTS) spawnXRObject(false);
    if (gameRunning && xrActive) scheduleNextXRSpawn();
  }, delay);
}

function spawnXRObject(nearView = false) {
  if (!xrLastPose || getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;
  const asset = getSpawnAssetXR();
  const cameraMatrix = xrLastPose.transform.matrix;
  const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
  const spawnPose = getXRSpawnPose(cameraMatrix, cameraPosition, nearView);
  if (!spawnPose) return;

  const size = randF(XR_SIZE_MIN, XR_SIZE_MAX);
  const now = performance.now();
  xrObjects.push({
    asset,
    isTarget: !!asset.isTarget,
    position: Object.freeze(spawnPose.position),
    size,
    yaw: spawnPose.yaw,
    createdAt: now,
    lifetime: XR_LIFETIME_MIN,
    caught: false, catching: false, expiring: false,
    fadeIn: false, fadeInStart: now
  });
}

function getXRSpawnPose(cameraMatrix, cameraPosition, nearView = false) {
  const forward = getHorizontalCameraForward(cameraMatrix);
  const right = [forward[1], -forward[0]];
  let bestPose = null;
  let bestSpacing = -Infinity;

  for (let i = 0; i < XR_SPAWN_ATTEMPTS; i++) {
    const localAngle = nearView ? randF(-Math.PI / 2.6, Math.PI / 2.6) : randF(0, Math.PI * 2);
    const distance = randF(XR_DISTANCE_MIN, XR_DISTANCE_MAX);
    const direction = [
      forward[0] * Math.cos(localAngle) + right[0] * Math.sin(localAngle),
      forward[1] * Math.cos(localAngle) + right[1] * Math.sin(localAngle)
    ];
    const position = [
      cameraPosition[0] + direction[0] * distance,
      cameraPosition[1] + randF(XR_HEIGHT_MIN, XR_HEIGHT_MAX),
      cameraPosition[2] + direction[1] * distance
    ];
    const spacing = getNearestXRObjectDistance(position);

    if (spacing >= XR_MIN_OBJECT_SPACING) return { position, yaw: Math.atan2(-direction[0], -direction[1]) };
    if (spacing > bestSpacing) {
      bestSpacing = spacing;
      bestPose = { position, yaw: Math.atan2(-direction[0], -direction[1]) };
    }
  }
  return bestSpacing > XR_MIN_OBJECT_SPACING * 0.62 ? bestPose : null;
}

function getHorizontalCameraForward(cameraMatrix) {
  const fwdX = -cameraMatrix[8];
  const fwdZ = -cameraMatrix[10];
  const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ);
  if (fwdLen <= 0.001) return [0, -1];
  return [fwdX / fwdLen, fwdZ / fwdLen];
}

function getNearestXRObjectDistance(position) {
  const activeObjects = xrObjects.filter((object) => !object.caught && !object.catching && !object.expiring);
  if (activeObjects.length === 0) return Infinity;
  return activeObjects.reduce((nearest, object) => {
    const dx = object.position[0] - position[0];
    const dy = object.position[1] - position[1];
    const dz = object.position[2] - position[2];
    return Math.min(nearest, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }, Infinity);
}

function getSpawnAssetXR() {
  const activeCount = getActiveXRObjectCount();
  const targetCount = xrObjects.filter((o) => o.isTarget && !o.caught && !o.catching && !o.expiring).length;
  if (DECOY_ASSETS.length === 0 || shouldSpawnTargetAssetXR(activeCount, targetCount)) return TARGET_ASSET;
  return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
}

function shouldSpawnTargetAssetXR(activeCount, targetCount) {
  if (targetCount < XR_MIN_TARGET_OBJECTS) return true;
  const maxTargetCount = Math.max(XR_MIN_TARGET_OBJECTS + 1, Math.ceil(activeCount * XR_MAX_TARGET_RATIO));
  if (targetCount >= maxTargetCount) return false;
  return Math.random() < XR_TARGET_SPAWN_RATIO;
}

function expireXRObjects(time) {
  if (!Number.isFinite(XR_LIFETIME_MIN)) return;
  const now = performance.now();
  if (now >= nextXRExpireAt) {
    const nextExpiredObject = xrObjects
      .filter((o) => !o.caught && !o.catching && !o.expiring && now - o.createdAt >= o.lifetime)
      .sort((a, b) => (a.createdAt + a.lifetime) - (b.createdAt + b.lifetime))[0];
    if (nextExpiredObject) {
      nextExpiredObject.expiring = true;
      nextExpiredObject.expireStartedAt = now;
      nextXRExpireAt = now + randomNumber(XR_EXPIRE_STAGGER_MIN, XR_EXPIRE_STAGGER_MAX);
    }
  }
  xrObjects = xrObjects.filter((o) => {
    if (o.caught) return false;
    if (o.catching) return performance.now() - o.catchStartAt < XR_CATCH_ANIM_MS + 60;
    if (o.expiring) return performance.now() - o.expireStartedAt < XR_EXPIRE_MS + 60;
    return true;
  });
}

function refillXRCurrentView(time) {
  if (time - xrLastRefillAt < VIEW_REFILL_COOLDOWN) return;
  if (getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;
  xrLastRefillAt = time;
  spawnXRObject(false);
}

function getActiveXRObjectCount() {
  return xrObjects.filter((o) => !o.caught && !o.catching && !o.expiring).length;
}

function getVisibleXRObjectCount() {
  return xrObjects.filter((o) => !o.caught && !o.catching && !o.expiring && isXRObjectInView(o)).length;
}

function isXRObjectInView(object) {
  if (!xrLastViewProjection) return true;
  const ndc = projectXRPoint(object.position, xrLastViewProjection);
  return ndc && Math.abs(ndc.x) <= 1.25 && Math.abs(ndc.y) <= 1.25 && ndc.z >= -1 && ndc.z <= 1;
}

function catchXRObjectByMarker() {
  if (!xrActive || !xrLastViewProjection) return false;
  let closest = null, closestDist = Infinity;
  let closestTarget = null, closestTargetDist = Infinity;
  const radius = 0.22;

  xrObjects.forEach((object) => {
    if (object.caught || object.catching || object.expiring) return;
    const ndc = projectXRPoint(object.position, xrLastViewProjection);
    if (!ndc || ndc.z < -1 || ndc.z > 1) return;
    const distance = Math.sqrt(ndc.x * ndc.x + ndc.y * ndc.y);
    if (distance > radius) return;

    if (object.isTarget && distance < closestTargetDist) {
      closestTarget = object; closestTargetDist = distance;
    }
    if (distance < closestDist) {
      closest = object; closestDist = distance;
    }
  });

  const object = closestTarget || closest;
  if (!object) {
    showMissEffect();
    return true;
  }
  collectXRObject(object);
  return true;
}

function collectXRObject(object) {
  if (!gameRunning || object.caught || object.catching) return;
  object.catching = true;
  object.catchStartAt = performance.now();

  if (object.isTarget) {
    score++;
    updateScoreText();
    createHitEffect(window.innerWidth / 2, window.innerHeight / 2);
    createPlusOne(window.innerWidth / 2, window.innerHeight / 2);

    if (score >= TARGET_SCORE) {
      setTimeout(() => { endGame(); }, XR_CATCH_ANIM_MS + 80);
    }
  } else {
    showMissEffect();
  }
}

function stopXRSession(endSession = true) {
  xrActive = false;
  stopCamera();
  clearInterval(xrSpawnInterval);
  clearTimeout(xrSpawnTimeout);
  xrInitialSpawnTimeouts.forEach((tid) => clearTimeout(tid));
  xrSpawnInterval = null;
  xrSpawnTimeout = null;
  xrInitialSpawnTimeouts = [];
  xrObjects = [];
  xrLastPose = null;
  xrLastView = null;
  xrLastViewProjection = null;
  xrLastRefillAt = 0;
  nextXRExpireAt = 0;
  document.body.classList.remove("xr-mode");

  if (xrGl) {
    if (xrProgram) { xrGl.deleteProgram(xrProgram); xrProgram = null; }
    xrModels.forEach((model) => {
      model.primitives.forEach((p) => {
        xrGl.deleteBuffer(p.positionBuffer); xrGl.deleteBuffer(p.normalBuffer);
        if (p.colorBuffer) xrGl.deleteBuffer(p.colorBuffer);
        if (p.indexBuffer) xrGl.deleteBuffer(p.indexBuffer);
      });
    });
    xrModels.clear();
    xrGl = null;
  }
  if (xrSession && endSession) xrSession.end().catch(() => {});
  xrSession = null;
  xrRefSpace = null;
}

/* =========================
   VOICE CATCH
========================= */

async function startVoiceCatch() {
  if (voiceActive) return;
  voiceActive = true;
  lastVoiceCatchAt = 0;
  startSpeechCatch();

  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    voiceAudioContext = new AudioContextClass();
    const source = voiceAudioContext.createMediaStreamSource(voiceStream);
    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 1024;
    source.connect(voiceAnalyser);
    startShoutLoop();
  } catch (error) {
    console.warn("Voice catch unavailable:", error);
  }
}

function startSpeechCatch() {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return;

  voiceRecognition = new SpeechRecognitionClass();
  voiceRecognition.lang = "id-ID";
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  
  // SUPPORT MULTIPLE ALTERNATIVES LIKE REACT
  voiceRecognition.maxAlternatives = 3;

  voiceRecognition.onresult = (event) => {
    let triggered = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
        for (let j = 0; j < Math.min(event.results[i].length, 3); j++) {
            const transcript = event.results[i][j].transcript;
            if (isIjoCommand(transcript)) {
                if (!triggered) {
                    triggerVoiceCatch();
                    triggered = true;
                }
                break;
            }
        }
    }
  };

  voiceRecognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") voiceRecognition = null;
  };

  voiceRecognition.onend = () => {
    if (gameRunning && voiceActive && voiceRecognition) {
      try { voiceRecognition.start(); } catch (error) {}
    }
  };

  try { voiceRecognition.start(); } catch (error) { voiceRecognition = null; }
}

function startShoutLoop() {
  if (!voiceAnalyser) return;
  const buffer = new Uint8Array(voiceAnalyser.fftSize);

  function loop() {
    if (!gameRunning || !voiceActive || !voiceAnalyser) {
      voiceLoopId = null;
      return;
    }
    voiceAnalyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const value = (buffer[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / buffer.length);
    if (rms >= SHOUT_RMS_THRESHOLD) triggerVoiceCatch();
    
    voiceLoopId = requestAnimationFrame(loop);
  }
  voiceLoopId = requestAnimationFrame(loop);
}

function triggerVoiceCatch() {
  const now = Date.now();
  if (!gameRunning || now - lastVoiceCatchAt < VOICE_CATCH_COOLDOWN_MS) return;
  lastVoiceCatchAt = now;
  catchChiliByMarker();
}

function stopVoiceCatch() {
  voiceActive = false;

  if (voiceRecognition) {
    voiceRecognition.onend = null;
    voiceRecognition.onerror = null;
    voiceRecognition.onresult = null;
    try { voiceRecognition.stop(); } catch (error) {}
  }
  voiceRecognition = null;

  if (voiceLoopId !== null) {
    cancelAnimationFrame(voiceLoopId);
    voiceLoopId = null;
  }
  if (voiceStream) {
    voiceStream.getTracks().forEach((track) => track.stop());
  }
  voiceStream = null;

  if (voiceAudioContext) voiceAudioContext.close().catch(() => {});
  voiceAudioContext = null;
  voiceAnalyser = null;
}

/* =========================
   GAME FLOW
========================= */

async function startGame() {
  stopOrientationTracking();
  stopCamera();
  const xrReady = await startXRSession();

  if (!xrReady) {
    showAppNotice("WebXR AR Required", "This hunt runs in WebXR AR. Open Android Chrome via HTTPS, then allow AR/camera access.");
    return;
  }

  resetGameData();
  document.body.classList.remove("intro-mode", "result-mode");
  document.body.classList.add("game-mode");
  introScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  gameHud.classList.remove("hidden");

  gameRunning = true;
  startVoiceCatch();
  runTimer();
  runXRSpawner();
}

function resetGameData() {
  score = 0; elapsedTime = 0; scoreSaved = false;
  updateScoreText();
  timerText.textContent = formatElapsedTime(elapsedTime);
  finalScoreText.textContent = formatElapsedTime(elapsedTime);
  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  shareBtn.disabled = false;
  renderLeaderboard([]);
  gameArea.innerHTML = "";
  resetAimMarker();
  clearInterval(timerInterval);
  clearSpawnTimers();
}

function runTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    elapsedTime++;
    timerText.textContent = formatElapsedTime(elapsedTime);
  }, 1000);
}

function runSpawner() {
  clearSpawnTimers();
  for (let i = 0; i < INITIAL_CHILI_COUNT; i++) {
    scheduleNextChili(260 + i * randomNumber(90, 230), i < 1);
  }
  spawnInterval = setInterval(() => {
    if (!gameRunning) return;
    if (getActiveChiliCount() < MAX_ACTIVE_CHILIES) scheduleNextChili(randomNumber(80, 360), false);
  }, SPAWN_REFILL_INTERVAL);
}

function scheduleNextChili(delay, nearView = false) {
  const timeoutId = setTimeout(() => {
    spawnTimeouts = spawnTimeouts.filter((id) => id !== timeoutId);
    if (gameRunning && getActiveChiliCount() < MAX_ACTIVE_CHILIES) spawnChili(nearView);
  }, delay);
  spawnTimeouts.push(timeoutId);
}

function clearSpawnTimers() {
  clearInterval(spawnInterval); spawnInterval = null;
  spawnTimeouts.forEach((tid) => clearTimeout(tid));
  spawnTimeouts = []; lastViewRefillAt = 0; nextChiliExpireAt = 0;
}

function endGame() {
  if (!gameRunning) return;
  gameRunning = false;
  clearInterval(timerInterval);
  clearSpawnTimers();
  stopVoiceCatch();
  gameArea.innerHTML = "";
  resetAimMarker();
  gameHud.classList.add("hidden");

  finalScoreText.textContent = formatElapsedTime(elapsedTime);
  scoreSaved = false;
  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.remove("hidden");
  shareBtn.disabled = false;
  startPlayAgainCooldown();
  loadLeaderboard();

  stopOrientationTracking();
  stopXRSession();
  stopCamera();

  document.body.classList.remove("game-mode");
  document.body.classList.add("result-mode");
  resultScreen.classList.add("active");
}

function resetToIntro() {
  gameRunning = false;
  clearPlayAgainCooldown();
  clearInterval(timerInterval);
  clearSpawnTimers();
  stopVoiceCatch();
  gameArea.innerHTML = "";
  resetAimMarker();
  stopOrientationTracking();
  stopXRSession();
  stopCamera();

  score = 0; elapsedTime = 0; scoreSaved = false;
  updateScoreText();
  timerText.textContent = formatElapsedTime(elapsedTime);
  finalScoreText.textContent = formatElapsedTime(elapsedTime);
  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  closeSaveScoreModal();

  resultScreen.classList.remove("active");
  gameHud.classList.add("hidden");
  introScreen.classList.add("active");

  document.body.classList.remove("game-mode", "result-mode");
  document.body.classList.add("intro-mode");
}

function startPlayAgainCooldown() {
  let cooldownLeft = PLAY_AGAIN_COOLDOWN;
  clearPlayAgainCooldown();
  playAgainBtn.disabled = true;
  playAgainBtn.textContent = `Play Again (${cooldownLeft})`;
  playAgainCooldownInterval = setInterval(() => {
    cooldownLeft--;
    if (cooldownLeft <= 0) { clearPlayAgainCooldown(); return; }
    playAgainBtn.textContent = `Play Again (${cooldownLeft})`;
  }, 1000);
}

function clearPlayAgainCooldown() {
  clearInterval(playAgainCooldownInterval);
  playAgainCooldownInterval = null;
  playAgainBtn.disabled = false;
  playAgainBtn.textContent = "Play Again";
}

/* =========================
   CHILI SPAWNING (Standard / Legacy) 
========================= */
function spawnChili(nearView = false) {
    if (getActiveChiliCount() >= MAX_ACTIVE_CHILIES) return;
    if (orientationActive && baseGamma === null) { scheduleNextChili(250, nearView); return; }
    const spawnAsset = getSpawnAsset();
    const size  = randomNumber(spawnAsset.minSize || CHILI_SIZE_MIN, spawnAsset.maxSize || CHILI_SIZE_MAX);
    const hs    = size / 2;
    const depth = randF(DEPTH_MIN, DEPTH_MAX);
  
    const chili = document.createElement("img");
    chili.src       = spawnAsset.src;
    chili.className = "chili";
    chili.alt       = spawnAsset.alt;
    chili.style.width  = `${size}px`;
    chili.style.rotate = `${randomNumber(-35, 35)}deg`;
    chili.style.zIndex = Math.round(depth * 10);
    chili.dataset.caught = "false";
    chili.dataset.hs     = hs;
    chili.dataset.depth  = depth.toFixed(3);
    chili.dataset.target = spawnAsset.isTarget ? "true" : "false";
  
    if (baseGamma !== null) {
      const rangeH = nearView ? 10 : WORLD_RANGE_H;
      const rangeV = nearView ? 7 : WORLD_RANGE_V;
      const spawnPosition = getSpacedWorldSpawn(smoothGamma, smoothBeta, rangeH, rangeV);
      chili.dataset.wg = spawnPosition.wg;
      chili.dataset.wb = spawnPosition.wb;
      projectWorldChili(chili);
    } else {
      const topLimit    = 160;
      const bottomLimit = window.innerHeight - 200;
      const leftLimit   = 20;
      const rightLimit  = window.innerWidth - size - 20;
      if (bottomLimit <= topLimit || rightLimit <= leftLimit) return;
      const spawnPosition = getSpacedScreenSpawn(leftLimit, rightLimit, topLimit, bottomLimit);
      chili.style.left = `${spawnPosition.x}px`;
      chili.style.top  = `${spawnPosition.y}px`;
    }
  
    chili.addEventListener("pointerdown", (e) => e.stopPropagation());
    gameArea.appendChild(chili);
    if (baseGamma !== null) projectWorldChili(chili);
  
    setTimeout(() => {
      if (!chili.parentElement) return;
      if (chili.dataset.wg !== undefined) { projectWorldChili(chili); return; }
      const brightness = (0.78 + depth * 0.2).toFixed(2);
      const saturate = (0.82 + depth * 0.22).toFixed(2);
      const shadowY = Math.round(8 + depth * 12);
      const shadowBlur = Math.round(14 + depth * 20);
      const shadowAlpha = (0.22 + depth * 0.28).toFixed(2);
      chili.style.scale = depth.toFixed(3);
      chili.style.filter = `brightness(${brightness}) saturate(${saturate}) drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha}))`;
    }, 300);
  
    const duration = randomNumber(CHILI_LIFETIME_MIN, CHILI_LIFETIME_MAX) + randomNumber(0, 1800);
    const overlap = randomNumber(NEXT_CHILI_OVERLAP_MIN, NEXT_CHILI_OVERLAP_MAX);
    scheduleNextChili(Math.max(900, duration - overlap), false);
    setTimeout(() => {
      if (chili.parentElement && chili.dataset.caught !== "true") queueChiliExpire(chili);
    }, duration);
}
function queueChiliExpire(chili) { /* ... omitted slightly for space ... legacy usage */
   if (!gameRunning || !chili.parentElement) return;
   if (chili.dataset.caught === "true" || chili.classList.contains("chili-expire")) return;
   const now = performance.now();
   if (now < nextChiliExpireAt) { setTimeout(() => queueChiliExpire(chili), nextChiliExpireAt - now + randomNumber(30, 160)); return; }
   nextChiliExpireAt = now + randomNumber(CHILI_EXPIRE_STAGGER_MIN, CHILI_EXPIRE_STAGGER_MAX);
   expireChili(chili);
}
function expireChili(chili) { chili.classList.add("chili-expire"); setTimeout(() => { if (chili.parentElement) chili.remove(); }, 380); }
function getActiveChiliCount() { return document.querySelectorAll(".chili:not(.chili-expire)").length; }
function getVisibleChiliCount() {
    let count = 0;
    document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
        if (chili.dataset.caught === "true") return;
        if (isRectInViewport(chili.getBoundingClientRect(), 40)) count++;
    });
    return count;
}
function getActiveTargetCount() { return document.querySelectorAll('.chili[data-target="true"]:not(.chili-expire)').length; }
function getSpawnAsset() {
    const activeCount = getActiveChiliCount();
    const targetCount = getActiveTargetCount();
    if (DECOY_ASSETS.length === 0 || shouldSpawnTargetAsset(activeCount, targetCount)) return TARGET_ASSET;
    return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
}
function shouldSpawnTargetAsset(activeCount, targetCount) {
    if (targetCount < MIN_TARGET_CHILIES) return true;
    const maxTargetCount = Math.max(MIN_TARGET_CHILIES + 1, Math.ceil(activeCount * (TARGET_SPAWN_RATIO + 0.12)));
    if (targetCount >= maxTargetCount) return false;
    return Math.random() < TARGET_SPAWN_RATIO;
}
function getSpacedWorldSpawn(centerGamma, centerBeta, rangeH, rangeV) {
    let best = null, bestDistance = -Infinity;
    for (let i = 0; i < 24; i++) {
        const candidate = { wg: centerGamma + randF(-rangeH, rangeH), wb: centerBeta + randF(-rangeV, rangeV) };
        const distance = getNearestChiliScreenDistance(candidate.wg, candidate.wb);
        if (distance >= MIN_CHILI_SCREEN_DISTANCE) return candidate;
        if (distance > bestDistance) { best = candidate; bestDistance = distance; }
    }
    return best || { wg: centerGamma + randF(-rangeH, rangeH), wb: centerBeta + randF(-rangeV, rangeV) };
}
function getNearestChiliScreenDistance(wg, wb) {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const x = cx - (wg - smoothGamma) * PX_PER_DEG_H, y = cy - (wb - smoothBeta) * PX_PER_DEG_V;
    let nearest = Infinity;
    document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
        if (chili.dataset.caught === "true") return;
        const rect = chili.getBoundingClientRect();
        nearest = Math.min(nearest, getDistance(x, y, rect.left + rect.width / 2, rect.top + rect.height / 2));
    });
    return nearest;
}
function getSpacedScreenSpawn(leftLimit, rightLimit, topLimit, bottomLimit) {
    let best = null, bestDistance = -Infinity;
    for (let i = 0; i < 24; i++) {
        const candidate = { x: randomNumber(leftLimit, rightLimit), y: randomNumber(topLimit, bottomLimit) };
        const distance = getNearestChiliPointDistance(candidate.x, candidate.y);
        if (distance >= MIN_CHILI_SCREEN_DISTANCE) return candidate;
        if (distance > bestDistance) { best = candidate; bestDistance = distance; }
    }
    return best || { x: randomNumber(leftLimit, rightLimit), y: randomNumber(topLimit, bottomLimit) };
}
function getNearestChiliPointDistance(x, y) {
    let nearest = Infinity;
    document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
        if (chili.dataset.caught === "true") return;
        const rect = chili.getBoundingClientRect();
        nearest = Math.min(nearest, getDistance(x, y, rect.left + rect.width / 2, rect.top + rect.height / 2));
    });
    return nearest;
}
function isRectInViewport(rect, margin = 0) {
    return (rect.right >= -margin && rect.left <= window.innerWidth + margin && rect.bottom >= -margin && rect.top <= window.innerHeight + margin);
}

function findChiliInMarker() {
  const target = document.querySelector(".aim-area");
  const chilies = document.querySelectorAll(".chili:not(.chili-expire)");
  if (!target || chilies.length === 0) return null;
  const targetRect = target.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const catchRadius = targetRect.width * 0.52;

  let closestChili = null, closestDist = Infinity, closestX = 0, closestY = 0;
  let closestTarget = null, closestTargetDist = Infinity, closestTargetX = 0, closestTargetY = 0;

  chilies.forEach((chili) => {
    if (chili.dataset.caught === "true") return;
    const chiliRect = chili.getBoundingClientRect();
    const distance = getDistance(targetCenterX, targetCenterY, chiliRect.left + chiliRect.width / 2, chiliRect.top + chiliRect.height / 2);

    if (distance <= catchRadius && chili.dataset.target === "true" && distance < closestTargetDist) {
      closestTargetDist = distance; closestTarget = chili; closestTargetX = chiliRect.left; closestTargetY = chiliRect.top;
    }
    if (distance <= catchRadius && distance < closestDist) {
      closestDist = distance; closestChili = chili; closestX = chiliRect.left; closestY = chiliRect.top;
    }
  });
  if (closestTarget) return { chili: closestTarget, x: closestTargetX, y: closestTargetY };
  if (closestChili) return { chili: closestChili, x: closestX, y: closestY };
  return null;
}

function collectChili(chili, x, y) {
  if (!gameRunning || !chili || !chili.parentElement || chili.dataset.caught === "true") return;
  resetMissEffect();
  chili.dataset.caught = "true";
  
  if (chili.dataset.target === "true") {
    score++;
    updateScoreText();
    createHitEffect(x, y);
    createPlusOne(x, y);
    if (score >= TARGET_SCORE) { setTimeout(() => { endGame(); }, 320); }
  } else { showMissEffect(); }

  scheduleNextChili(randomNumber(350, 850), false);
  chili.classList.add("chili-caught");
  setTimeout(() => { if (chili.parentElement) chili.remove(); }, 280);
}

function showMissEffect() {
  const target = document.querySelector(".aim-area");
  if (target) {
    target.classList.remove("miss");
    void target.offsetWidth;
    target.classList.add("miss");
    setTimeout(() => { target.classList.remove("miss"); }, 300);
  }
}
function resetMissEffect() {
  const target = document.querySelector(".aim-area");
  if (target) target.classList.remove("miss");
}

function createHitEffect(x, y) {
  const effect = document.createElement("div");
  effect.className = "hit-effect";
  effect.style.left = `${x - 8}px`; effect.style.top = `${y - 8}px`;
  gameArea.appendChild(effect);
  setTimeout(() => { effect.remove(); }, 500);
}
function createPlusOne(x, y) {
  const plus = document.createElement("div");
  plus.className = "plus-one"; plus.textContent = "+1";
  plus.style.left = `${x + 22}px`; plus.style.top = `${y - 12}px`;
  gameArea.appendChild(plus);
  setTimeout(() => { plus.remove(); }, 700);
}

/* =========================
   LEADERBOARD & APIs
========================= */

async function loadLeaderboard() {
  try {
    const data = await fetchJson(GET_LEADERBOARD_API);
    renderLeaderboard(normalizeLeaderboardResponse(data));
  } catch (error) {
    console.warn("Leaderboard unavailable:", error);
    renderLeaderboardUnavailable();
  }
}

function renderLeaderboard(leaderboard) {
  leaderboardList.innerHTML = "";
  if (!leaderboard || leaderboard.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "leaderboard-item";
    emptyRow.innerHTML = `<span class="leaderboard-rank">-</span><span class="leaderboard-name">No results yet</span><span class="leaderboard-score">0</span>`;
    leaderboardList.appendChild(emptyRow);
    return;
  }
  leaderboard.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";
    row.innerHTML = `<span class="leaderboard-rank">#${index + 1}</span><span class="leaderboard-name">${escapeHtml(item.name || item.player_name || "Player")}</span><span class="leaderboard-score">${formatElapsedTime(Number(item.total_score ?? item.score ?? item.time_seconds ?? item.time ?? 0))}</span>`;
    leaderboardList.appendChild(row);
  });
}
function normalizeLeaderboardResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.leaderboard)) return data.leaderboard;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}
function renderLeaderboardUnavailable() {
  leaderboardList.innerHTML = `<div class="leaderboard-item"><span class="leaderboard-rank">-</span><span class="leaderboard-name">Leaderboard unavailable</span><span class="leaderboard-score">-</span></div>`;
}

function openSaveScoreModal() {
  modalScoreText.textContent = formatElapsedTime(elapsedTime);
  playerNameInput.value = ""; playerEmailInput.value = ""; saveMessage.textContent = ""; saveMessage.className = "save-message";
  saveScoreModal.classList.remove("hidden");
  setTimeout(() => { playerNameInput.focus(); }, 100);
}
function closeSaveScoreModal() { saveScoreModal.classList.add("hidden"); }
function showAppNotice(title, message) {
  appNoticeTitle.textContent = title; appNoticeText.textContent = message; appNotice.classList.remove("hidden");
}
function closeAppNotice() { appNotice.classList.add("hidden"); }

async function submitScore() {
  if (scoreSaved) return;
  const name = playerNameInput.value.trim(), email = playerEmailInput.value.trim();
  if (!name) { saveMessage.textContent = "Please enter your name."; saveMessage.className = "save-message error"; playerNameInput.focus(); return; }
  if (!isValidEmail(email)) { saveMessage.textContent = "Please enter a valid email."; saveMessage.className = "save-message error"; playerEmailInput.focus(); return; }

  submitScoreBtn.disabled = true;
  saveMessage.textContent = "Saving score..."; saveMessage.className = "save-message";

  try {
    await fetchJson(SAVE_SCORE_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, total_score: elapsedTime, time_seconds: elapsedTime, collected_chilies: TARGET_SCORE })
    });
    scoreSaved = true;
    saveMessage.textContent = "Score saved successfully."; saveMessage.className = "save-message success";
    saveScoreBtn.classList.add("hidden"); shareBtn.disabled = false;
    topFiveInfo.textContent = "Score saved to leaderboard"; topFiveInfo.classList.remove("hidden");
    await loadLeaderboard();
    setTimeout(() => { closeSaveScoreModal(); }, 700);
  } catch (error) {
    saveMessage.textContent = error.message || "Unable to save score. Please try again."; saveMessage.className = "save-message error";
  } finally { submitScoreBtn.disabled = false; }
}

async function shareScoreImage() {
  shareBtn.disabled = true;
  try {
    closeAppNotice();
    const resultTime = formatElapsedTime(elapsedTime);
    const imageBlob = await createScoreImageBlob(resultTime);
    const file = new File([imageBlob], "green-chili-hunt-score.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: "Green Chili Hunt Score", text: `I collected ${TARGET_SCORE} green chilies in ${resultTime}!`, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Green Chili Hunt Score", text: `I collected ${TARGET_SCORE} green chilies in ${resultTime}!` });
      return;
    }
    downloadScoreImage(imageBlob);
  } catch (error) {
    if (isShareCancelError(error)) return;
    showAppNotice("Share Unavailable", "Share is not available on this browser.");
  } finally { shareBtn.disabled = false; }
}

function isShareCancelError(error) {
  const name = (error?.name || "").toLowerCase(), message = (error?.message || "").toLowerCase();
  return (name === "aborterror" || message.includes("cancel") || message.includes("abort"));
}

function createScoreImageBlob(scoreValue) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1c5a21"); gradient.addColorStop(0.5, "#071a0b"); gradient.addColorStop(1, "#020502");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(202, 255, 114, 0.12)"; ctx.beginPath(); ctx.arc(540, 360, 330, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(202, 255, 114, 0.08)"; ctx.beginPath(); ctx.arc(130, 1600, 290, 0, Math.PI * 2); ctx.fill();
    ctx.font = "900 76px Arial"; ctx.fillStyle = "#caff72"; ctx.textAlign = "center"; ctx.fillText("GREEN CHILI HUNT", 540, 320);
    ctx.font = "400 44px Arial"; ctx.fillStyle = "rgba(255, 255, 255, 0.78)"; ctx.fillText(`Time to collect ${TARGET_SCORE} chilies`, 540, 545);
    ctx.font = "900 230px Arial"; ctx.fillStyle = "#ffffff"; ctx.fillText(scoreValue.toString(), 540, 815);
    drawChiliIcon(ctx, 540, 1065);
    ctx.font = "500 44px Arial"; ctx.fillStyle = "rgba(255, 255, 255, 0.84)"; ctx.fillText("Can you beat my time?", 540, 1290);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; roundRect(ctx, 150, 1420, 780, 145, 42); ctx.fill();
    ctx.font = "700 38px Arial"; ctx.fillStyle = "#ffffff"; ctx.fillText("Play now and collect green chilies!", 540, 1508);
    ctx.font = "400 30px Arial"; ctx.fillStyle = "rgba(255, 255, 255, 0.55)"; ctx.fillText("Share your score", 540, 1695);
    canvas.toBlob((blob) => { resolve(blob); }, "image/png");
  });
}

function drawChiliIcon(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
  ctx.fillStyle = "#55e85b"; ctx.beginPath(); ctx.moveTo(-115, 40); ctx.bezierCurveTo(-40, 110, 95, 60, 115, -35); ctx.bezierCurveTo(30, 25, -35, 15, -115, 40); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(20, -5, 55, 18, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8ad34a"; ctx.lineWidth = 18; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(-30, -95, 35, -115); ctx.stroke();
  ctx.restore();
}

function downloadScoreImage(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "green-chili-hunt-score.png";
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

/* =========================
   HELPERS
========================= */

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function escapeHtml(text) { return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

// EXTENDED VOICE MATCHER
function isIjoCommand(text) {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.split(" ").some((word) => 
     word.includes("ijo") || 
     word.includes("hijau") || 
     word.includes("hi") || 
     word.includes("jau") || 
     word.includes("jo") || 
     word === "i"
  );
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getDistance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1)**2 + (y2 - y1)**2); }
function addVec3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scaleVec3(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }

function multiplyMat4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function makeXRObjectMatrix(object, scale = 1) {
  const size = object.size * scale;
  const yaw = object.yaw || 0;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  // Matrix transformation
  return new Float32Array([
    cos * size, 0, -sin * size, 0,
    sin * size, 0, cos * size, 0,
    0, size, 0, 0,
    object.position[0], object.position[1], object.position[2], 1
  ]);
}

function projectXRPoint(point, vp) {
  const x = point[0], y = point[1], z = point[2];
  const clipX = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const clipY = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const clipZ = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const clipW = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];

  if (clipW <= 0.0001) return null;
  return { x: clipX / clipW, y: clipY / clipW, z: clipZ / clipW };
}

function updateScoreText() {
  scoreText.textContent = `${Math.min(score, TARGET_SCORE)}/${TARGET_SCORE}`;
}

// FORMAT TIMER JADI 0s 
function formatElapsedTime(totalSeconds) {
  return `${totalSeconds}s`;
}

function smoothAngle(current, target) {
  const delta = target - current;
  return Math.abs(delta) <= ORIENT_DEADZONE ? current : current + ORIENT_SMOOTH * delta;
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randF(min, max) { return Math.random() * (max - min) + min; }