import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
const aimArea = document.querySelector(".aim-area");
const chiliSlots = Array.from(document.querySelectorAll(".chili-slot"));
const CHILI_HUD_ACTIVE_SRC = "assets/ui/chili_hud_active.png";
const CHILI_HUD_INACTIVE_SRC = "assets/ui/chili_hud_inactive.png";

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
const XR_MAX_ACTIVE_OBJECTS = 24;
const XR_INITIAL_OBJECTS = 12;
const XR_MIN_VISIBLE_OBJECTS = 6;
const XR_INITIAL_SPAWN_DELAY_MIN = 140;
const XR_INITIAL_SPAWN_DELAY_MAX = 320;
const XR_SPAWN_DELAY_MIN = 760;
const XR_SPAWN_DELAY_MAX = 1350;
const XR_LIFETIME_MIN = 30000;
const XR_LIFETIME_MAX = 60000;
const XR_SIZE_MIN = 0.24;
const XR_SIZE_MAX = 0.34;
const XR_DISTANCE_MIN = 2.4;
const XR_DISTANCE_MAX = 4.8;
const XR_HEIGHT_MIN = -0.32;
const XR_HEIGHT_MAX = 0.28;
const XR_MIN_OBJECT_SPACING = 0.72;
const XR_SPAWN_ATTEMPTS = 36;
const XR_FRONT_SPAWN_ARC = Math.PI / 2.25;
const XR_NEAR_VIEW_SPAWN_ARC = Math.PI / 3.7;
const XR_PERIPHERAL_SPAWN_CHANCE = 0.16;
const XR_TARGET_SPAWN_RATIO = 0.2;
const XR_MIN_TARGET_OBJECTS = 2;
const XR_MAX_TARGET_RATIO = 0.28;
const XR_CATCH_ANIM_MS = 480;
const XR_FADEIN_MS = 320;
const XR_EXPIRE_MS = 520;
const XR_EXPIRE_STAGGER_MIN = 520;
const XR_EXPIRE_STAGGER_MAX = 1250;
const XR_NORMALIZED_MODEL_SIZE = 3.0;
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
  modelSrc: "assets/models/Cabe.glb",
  alt: "Green Chili",
  isTarget: true,
  minSize: 38,
  maxSize: 74
};

const DECOY_ASSETS = [
  {
    src: "assets/images/bintang.png",
    modelSrc: "assets/models/Alarm_Clock.glb",
    alt: "Alarm Clock Decoy",
    minSize: 34,
    maxSize: 68
  },
  {
    src: "assets/images/kotak-tinggi.png",
    modelSrc: "assets/models/Ball.glb",
    alt: "Ball Decoy",
    minSize: 38,
    maxSize: 78
  },
  {
    src: "assets/images/persegi-panjang.png",
    modelSrc: "assets/models/Barbel_3Kg.glb",
    alt: "Barbell Decoy",
    minSize: 44,
    maxSize: 86
  },
  {
    src: "assets/images/segi-enam.png",
    modelSrc: "assets/models/Bedside_Table_001.glb",
    alt: "Bedside Table Decoy",
    minSize: 36,
    maxSize: 72
  },
  {
    src: "assets/images/bintang.png",
    modelSrc: "assets/models/Horn.glb",
    alt: "Horn Decoy",
    minSize: 38,
    maxSize: 78
  },
  {
    src: "assets/images/kotak-tinggi.png",
    modelSrc: "assets/models/Plane.glb",
    alt: "Plane Decoy",
    minSize: 42,
    maxSize: 82
  },
  {
    src: "assets/images/persegi-panjang.png",
    modelSrc: "assets/models/Sun_Glasses.glb",
    alt: "Sun Glasses Decoy",
    minSize: 44,
    maxSize: 84
  },
  {
    src: "assets/images/segi-enam.png",
    modelSrc: "assets/models/Table.glb",
    alt: "Table Decoy",
    minSize: 42,
    maxSize: 82
  },
  {
    src: "assets/images/bintang.png",
    modelSrc: "assets/models/Tea_Pot.glb",
    alt: "Tea Pot Decoy",
    minSize: 38,
    maxSize: 78
  }
];

// Pixels per 1° of phone rotation
const PX_PER_DEG_H = window.innerWidth  / 28;
const PX_PER_DEG_V = window.innerHeight / 36;

// Exponential smoothing factor for orientation (lower = smoother, less shake)
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

// Three.js / WebXR state
let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let xrHeadLight = null;
const gltfLoader = new GLTFLoader();

let xrActive = false;
let xrSession = null;
let xrModels = new Map();
let xrObjects = [];
let xrLastCamera = null;
let xrLastRefillAt = 0;
let xrSpawnInterval = null;
let xrSpawnTimeout = null;
let xrInitialSpawnTimeouts = [];
let nextXRExpireAt = 0;

// Voice state
let voiceActive = false;
let voiceStream = null;
let voiceRecognition = null;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceLoopId = null;
let lastVoiceCatchAt = 0;
let voiceMeterResetTimeout = null;

// Device orientation for world-anchoring chilies (fallback mode)
let orientationActive = false;
let baseGamma     = null;
let baseBeta      = null;
let rawGamma      = 0;
let rawBeta       = 0;
let smoothGamma   = 0;
let smoothBeta    = 0;
let orientLoopId  = null;

document.body.classList.add("intro-mode");
setBrowserScreen("intro", "replace");

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
window.addEventListener("popstate", handleBrowserBack);
window.addEventListener("resize", handleViewportResize);

/* =========================
   DEVICE ORIENTATION (world-anchor chilies)
========================= */

async function startOrientationTracking() {
  if (WEBXR_ONLY_MODE) return false;
  if (orientationActive) return;

  // iOS 13+ requires explicit permission
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
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
    // First reading — set baseline and seed smoother at this value
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

    // Exponential moving average — smooths out sensor noise
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
  if (cameraStarted && cameraStream) {
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: false
    });

    cameraStream = stream;
    cameraView.srcObject = stream;
    cameraStarted = true;

    return true;
  } catch (error) {
    console.error("Camera error:", error);

    showAppNotice(
      "Camera Needed",
      "Camera access is required to play this game. Please allow camera access."
    );

    return false;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  cameraStream = null;
  cameraStarted = false;
  cameraView.srcObject = null;
}

function handleViewportResize() {
  if (!threeRenderer) return;

  threeRenderer.setPixelRatio(window.devicePixelRatio);
  threeRenderer.setSize(window.innerWidth, window.innerHeight, false);

  if (threeCamera) {
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
  }
}

/* =========================
   WEBXR AR (Three.js)
========================= */

async function startXRSession() {
  if (!navigator.xr || !xrCanvas) return false;

  try {
    // Create renderer once and reuse across sessions
    if (!threeRenderer) {
      threeRenderer = new THREE.WebGLRenderer({
        canvas: xrCanvas,
        alpha: true,
        antialias: true
      });
      threeRenderer.setPixelRatio(window.devicePixelRatio);
      threeRenderer.setSize(window.innerWidth, window.innerHeight, false);
      threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
      threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      threeRenderer.toneMappingExposure = 1.18;
      threeRenderer.xr.enabled = true;
    }

    // Fresh scene each session
    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      20
    );

    setupThreeLighting();

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: document.body }
    });

    await threeRenderer.xr.setSession(xrSession);

    await loadXRModels();

    xrObjects = [];
    xrLastCamera = null;
    xrActive = true;
    document.body.classList.add("xr-mode");

    xrSession.addEventListener("end", () => {
      stopXRSession(false);
      if (!gameRunning) return;

      if (score >= TARGET_SCORE) {
        endGame();
        return;
      }

      resetToIntro(false);
    });

    threeRenderer.setAnimationLoop(onXRFrame);
    return true;
  } catch (error) {
    console.warn("WebXR AR unavailable:", error.name, error.message);
    stopXRSession(false);
    return false;
  }
}

function setupThreeLighting() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  threeScene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x4c6b44, 1.4);
  threeScene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(1.8, 3.2, 1.6);
  threeScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe8ff, 0.85);
  fillLight.position.set(-2.2, 1.4, -1.4);
  threeScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xeaffd0, 1.05);
  rimLight.position.set(-0.8, 1.9, 2.4);
  threeScene.add(rimLight);

  xrHeadLight = new THREE.PointLight(0xffffff, 1.35, 6.5, 1.2);
  xrHeadLight.position.set(0, 0, 0);
  threeScene.add(xrHeadLight);
}

async function loadXRModels() {
  const assets = [TARGET_ASSET, ...DECOY_ASSETS];
  await Promise.all(assets.map((asset) => loadXRModel(asset.modelSrc)));
}

async function loadXRModel(src) {
  if (xrModels.has(src)) return xrModels.get(src);

  return new Promise((resolve, reject) => {
    gltfLoader.load(src, (gltf) => {
      const model = gltf.scene;

      // Normalize longest dimension to XR_NORMALIZED_MODEL_SIZE
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      model.scale.multiplyScalar(XR_NORMALIZED_MODEL_SIZE / maxDim);

      // Center the model at origin
      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // Pre-enable transparency so fade animations work on clones
      model.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((mat) => {
          mat.transparent = true;
          mat.side = THREE.DoubleSide;
          mat.envMapIntensity = Math.max(mat.envMapIntensity || 0, 1.15);
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.needsUpdate = true;
        });
      });

      const group = new THREE.Group();
      group.add(model);
      xrModels.set(src, group);
      resolve(group);
    }, undefined, reject);
  });
}

function onXRFrame(time, frame) {
  if (!xrActive || !frame) return;

  updateXRObjectAnimations();
  expireXRObjects(time);

  threeRenderer.render(threeScene, threeCamera);

  // Cache after render — Three.js updates the XR camera inside renderer.render()
  xrLastCamera = threeRenderer.xr.getCamera();
  updateXRHeadLight();
  maintainXRSpawnDensity(time);
}

function updateXRHeadLight() {
  if (!xrHeadLight || !xrLastCamera) return;

  const matrix = xrLastCamera.matrixWorld.elements;
  xrHeadLight.position.set(matrix[12], matrix[13] + 0.08, matrix[14]);
}

function maintainXRSpawnDensity(time) {
  if (!gameRunning || !xrActive || !xrLastCamera) return;
  if (getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;

  if (getVisibleXRObjectCount() < XR_MIN_VISIBLE_OBJECTS) {
    refillXRCurrentView(time);
  }
}

function updateXRObjectAnimations() {
  const now = performance.now();

  xrObjects.forEach((object) => {
    if (object.caught) return;

    let alpha = 1;

    if (object.catching) {
      const t = clamp((now - object.catchStartAt) / XR_CATCH_ANIM_MS, 0, 1);
      alpha = 1 - t;
    } else if (object.expiring) {
      const t = clamp((now - object.expireStartedAt) / XR_EXPIRE_MS, 0, 1);
      alpha = 1 - t;
    } else if (object.fadeIn) {
      const t = clamp((now - object.fadeInStart) / XR_FADEIN_MS, 0, 1);
      alpha = t;
      if (t >= 1) object.fadeIn = false;
    }

    if (!object.mesh) return;
    object.mesh.visible = alpha > 0.01;
    if (object.mesh.visible) setObjectOpacity(object.mesh, alpha);
  });
}

function setObjectOpacity(obj, alpha) {
  obj.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    mats.forEach((mat) => { mat.opacity = alpha; });
  });
}

function spawnXRObject(nearView = false) {
  if (!xrLastCamera || getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;

  const asset = getSpawnAssetXR();

  // Pull camera position and orientation from Three.js matrix (column-major)
  const cameraMatrix = xrLastCamera.matrixWorld.elements;
  const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];

  const spawnPose = getXRSpawnPose(cameraMatrix, cameraPosition, nearView);
  if (!spawnPose) return;

  const templateGroup = xrModels.get(asset.modelSrc);
  if (!templateGroup) return;

  // Deep-clone the template and give each mesh its own cloned material
  const mesh = templateGroup.clone(true);
  mesh.traverse((child) => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0;
        c.side = THREE.DoubleSide;
        c.envMapIntensity = Math.max(c.envMapIntensity || 0, 1.15);
        c.needsUpdate = true;
        return c;
      });
    } else {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0;
      child.material.side = THREE.DoubleSide;
      child.material.envMapIntensity = Math.max(child.material.envMapIntensity || 0, 1.15);
      child.material.needsUpdate = true;
    }
  });

  const size = randF(XR_SIZE_MIN, XR_SIZE_MAX);
  mesh.scale.setScalar(size);
  mesh.position.set(
    spawnPose.position[0],
    spawnPose.position[1],
    spawnPose.position[2]
  );
  mesh.rotation.y = spawnPose.yaw;

  threeScene.add(mesh);

  const now = performance.now();
  xrObjects.push({
    asset,
    isTarget: !!asset.isTarget,
    position: Object.freeze(spawnPose.position),
    size,
    yaw: spawnPose.yaw,
    createdAt: now,
    lifetime: randomNumber(XR_LIFETIME_MIN, XR_LIFETIME_MAX),
    caught: false,
    catching: false,
    expiring: false,
    fadeIn: true,
    fadeInStart: now,
    mesh
  });
}

function getXRSpawnPose(cameraMatrix, cameraPosition, nearView = false) {
  const forward = getHorizontalCameraForward(cameraMatrix);
  const right = [forward[1], -forward[0]];
  let bestPose = null;
  let bestSpacing = -Infinity;
  const spawnArc = nearView ? XR_NEAR_VIEW_SPAWN_ARC : XR_FRONT_SPAWN_ARC;

  for (let i = 0; i < XR_SPAWN_ATTEMPTS; i++) {
    const usePeripheral = !nearView && Math.random() < XR_PERIPHERAL_SPAWN_CHANCE;
    const localAngle = usePeripheral
      ? randF(-Math.PI, Math.PI)
      : randF(-spawnArc, spawnArc);
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

    if (spacing >= XR_MIN_OBJECT_SPACING) {
      return {
        position,
        yaw: Math.atan2(-direction[0], -direction[1])
      };
    }

    if (spacing > bestSpacing) {
      bestSpacing = spacing;
      bestPose = {
        position,
        yaw: Math.atan2(-direction[0], -direction[1])
      };
    }
  }

  return bestSpacing > XR_MIN_OBJECT_SPACING * 0.62 ? bestPose : null;
}

function getHorizontalCameraForward(cameraMatrix) {
  const fwdX = -cameraMatrix[8];
  const fwdZ = -cameraMatrix[10];
  const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ);

  if (fwdLen <= 0.001) {
    return [0, -1];
  }

  return [fwdX / fwdLen, fwdZ / fwdLen];
}

function getNearestXRObjectDistance(position) {
  const activeObjects = xrObjects.filter(
    (o) => !o.caught && !o.catching && !o.expiring
  );

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
  const targetCount = xrObjects.filter(
    (o) => o.isTarget && !o.caught && !o.catching && !o.expiring
  ).length;

  if (DECOY_ASSETS.length === 0 || shouldSpawnTargetAssetXR(activeCount, targetCount)) {
    return TARGET_ASSET;
  }

  return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
}

function shouldSpawnTargetAssetXR(activeCount, targetCount) {
  if (targetCount < XR_MIN_TARGET_OBJECTS) return true;

  const maxTargetCount = Math.max(
    XR_MIN_TARGET_OBJECTS + 1,
    Math.ceil(activeCount * XR_MAX_TARGET_RATIO)
  );

  if (targetCount >= maxTargetCount) return false;

  return Math.random() < XR_TARGET_SPAWN_RATIO;
}

function expireXRObjects(time) {
  const now = performance.now();

  if (now >= nextXRExpireAt) {
    const nextExpiredObject = xrObjects
      .filter(
        (o) =>
          !o.caught &&
          !o.catching &&
          !o.expiring &&
          now - o.createdAt >= o.lifetime
      )
      .sort((a, b) => (a.createdAt + a.lifetime) - (b.createdAt + b.lifetime))[0];

    if (nextExpiredObject) {
      nextExpiredObject.expiring = true;
      nextExpiredObject.expireStartedAt = now;
      nextXRExpireAt = now + randomNumber(XR_EXPIRE_STAGGER_MIN, XR_EXPIRE_STAGGER_MAX);
    }
  }

  const surviving = [];
  xrObjects.forEach((object) => {
    let keep = true;
    if (object.caught) {
      keep = false;
    } else if (object.catching && now - object.catchStartAt >= XR_CATCH_ANIM_MS + 60) {
      keep = false;
    } else if (object.expiring && now - object.expireStartedAt >= XR_EXPIRE_MS + 60) {
      keep = false;
    }

    if (!keep) {
      if (object.mesh && threeScene) threeScene.remove(object.mesh);
    } else {
      surviving.push(object);
    }
  });

  xrObjects = surviving;
}

function refillXRCurrentView(time) {
  if (time - xrLastRefillAt < VIEW_REFILL_COOLDOWN) return;
  if (getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;

  xrLastRefillAt = time;
  spawnXRObject(true);
}

function getActiveXRObjectCount() {
  return xrObjects.filter((o) => !o.caught && !o.catching && !o.expiring).length;
}

function getVisibleXRObjectCount() {
  return xrObjects.filter(
    (o) => !o.caught && !o.catching && !o.expiring && isXRObjectInView(o)
  ).length;
}

function isXRObjectInView(object) {
  if (!xrLastCamera) return true;

  const ndc = projectXRPoint(object.position);
  return (
    ndc &&
    Math.abs(ndc.x) <= 1.25 &&
    Math.abs(ndc.y) <= 1.25 &&
    ndc.z >= -1 &&
    ndc.z <= 1
  );
}

function catchXRObjectByMarker() {
  if (!xrActive || !xrLastCamera) return false;

  let closest = null;
  let closestDist = Infinity;
  let closestTarget = null;
  let closestTargetDist = Infinity;
  const radius = 0.22;

  xrObjects.forEach((object) => {
    if (object.caught || object.catching || object.expiring) return;

    const ndc = projectXRPoint(object.position);
    if (!ndc || ndc.z < -1 || ndc.z > 1) return;

    const distance = Math.sqrt(ndc.x * ndc.x + ndc.y * ndc.y);
    if (distance > radius) return;

    if (object.isTarget && distance < closestTargetDist) {
      closestTarget = object;
      closestTargetDist = distance;
    }

    if (distance < closestDist) {
      closest = object;
      closestDist = distance;
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
      setTimeout(() => {
        endGame();
      }, XR_CATCH_ANIM_MS + 80);
    }
  } else {
    showMissEffect();
  }
}

function runXRSpawner() {
  clearXRSpawnTimers();

  let initialDelay = 350;

  for (let i = 0; i < XR_INITIAL_OBJECTS; i++) {
    const timeoutId = setTimeout(() => {
      xrInitialSpawnTimeouts = xrInitialSpawnTimeouts.filter((id) => id !== timeoutId);
      if (gameRunning && xrActive) spawnXRObject(i < XR_MIN_VISIBLE_OBJECTS);
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

    if (gameRunning && xrActive && getActiveXRObjectCount() < XR_MAX_ACTIVE_OBJECTS) {
      spawnXRObject(false);
    }

    if (gameRunning && xrActive) {
      scheduleNextXRSpawn();
    }
  }, delay);
}

function clearXRSpawnTimers() {
  clearInterval(xrSpawnInterval);
  clearTimeout(xrSpawnTimeout);
  xrInitialSpawnTimeouts.forEach((id) => clearTimeout(id));
  xrSpawnInterval = null;
  xrSpawnTimeout = null;
  xrInitialSpawnTimeouts = [];
}

function clearXRObjects() {
  if (threeScene) {
    xrObjects.forEach((obj) => {
      if (obj.mesh) threeScene.remove(obj.mesh);
    });
  }

  xrObjects = [];
  xrLastRefillAt = 0;
  nextXRExpireAt = 0;
}

function stopXRSession(endSession = true) {
  xrActive = false;
  stopCamera();

  clearXRSpawnTimers();

  clearXRObjects();
  xrLastCamera = null;

  document.body.classList.remove("xr-mode");

  if (threeRenderer) {
    threeRenderer.setAnimationLoop(null);
  }

  if (xrSession && endSession) {
    xrSession.end().catch(() => {});
  }

  xrSession = null;
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
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
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

  voiceRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (isIjoCommand(transcript)) {
        triggerVoiceCatch();
        break;
      }
    }
  };

  voiceRecognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      voiceRecognition = null;
    }
  };

  voiceRecognition.onend = () => {
    if (gameRunning && voiceActive && voiceRecognition) {
      try {
        voiceRecognition.start();
      } catch (error) {
        // Browser may still be closing the previous recognition session.
      }
    }
  };

  try {
    voiceRecognition.start();
  } catch (error) {
    voiceRecognition = null;
  }
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
    updateVoiceMeter(rms);

    if (rms >= SHOUT_RMS_THRESHOLD) {
      triggerVoiceCatch();
    }

    voiceLoopId = requestAnimationFrame(loop);
  }

  voiceLoopId = requestAnimationFrame(loop);
}

function triggerVoiceCatch() {
  const now = Date.now();

  if (!gameRunning || now - lastVoiceCatchAt < VOICE_CATCH_COOLDOWN_MS) return;

  lastVoiceCatchAt = now;
  setVoiceMeterLevel(1);
  catchChiliByMarker();
}

function stopVoiceCatch() {
  voiceActive = false;
  setVoiceMeterLevel(0);

  if (voiceRecognition) {
    voiceRecognition.onend = null;
    voiceRecognition.onerror = null;
    voiceRecognition.onresult = null;
    try {
      voiceRecognition.stop();
    } catch (error) {
      // Some browsers throw if recognition is already stopped.
    }
  }
  voiceRecognition = null;

  if (voiceLoopId !== null) {
    cancelAnimationFrame(voiceLoopId);
    voiceLoopId = null;
  }

  if (voiceStream) {
    voiceStream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  voiceStream = null;

  if (voiceAudioContext) {
    voiceAudioContext.close().catch(() => {});
  }
  voiceAudioContext = null;
  voiceAnalyser = null;
}

function updateVoiceMeter(rms) {
  const floor = 0.025;
  const level = clamp((rms - floor) / (SHOUT_RMS_THRESHOLD - floor), 0, 1);
  setVoiceMeterLevel(level);
}

function setVoiceMeterLevel(level) {
  const normalizedLevel = clamp(level, 0, 1);

  if (voiceMeterResetTimeout !== null) {
    clearTimeout(voiceMeterResetTimeout);
    voiceMeterResetTimeout = null;
  }

  if (aimArea) {
    aimArea.style.setProperty("--voice-level", normalizedLevel.toFixed(3));
    aimArea.style.setProperty("--voice-sweep", `${(normalizedLevel * 360).toFixed(1)}deg`);
  }

  if (normalizedLevel >= 1 && gameRunning) {
    voiceMeterResetTimeout = setTimeout(() => {
      if (gameRunning) setVoiceMeterLevel(0);
    }, 180);
  }
}

/* =========================
   GAME FLOW
========================= */

function setBrowserScreen(screen, mode = "replace") {
  if (!window.history?.[`${mode}State`]) return;

  try {
    window.history[`${mode}State`]({ screen }, "", window.location.href);
  } catch (error) {
    // Some embedded browsers limit history writes; gameplay should continue.
  }
}

function handleBrowserBack(event) {
  if (gameRunning) {
    resetToIntro(false);
    setBrowserScreen("intro", "replace");
    return;
  }

  if (!saveScoreModal.classList.contains("hidden")) {
    closeSaveScoreModal();
  }

  const browserScreen = event?.state?.screen;

  if (browserScreen !== "result" || score < TARGET_SCORE) {
    resetToIntro(false);
  }
}

async function startGame() {
  stopOrientationTracking();
  stopCamera();

  const xrReady = await startXRSession();

  if (!xrReady) {
    showAppNotice(
      "WebXR AR Required",
      "This hunt now runs in real WebXR AR only. Open it on Android Chrome through HTTPS, then allow AR/camera access."
    );
    return;
  }

  resetGameData();

  document.body.classList.remove("intro-mode");
  document.body.classList.remove("result-mode");
  document.body.classList.add("game-mode");

  introScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  gameHud.classList.remove("hidden");

  gameRunning = true;
  setBrowserScreen("game", "push");

  startVoiceCatch();
  runTimer();

  runXRSpawner();
}

function resetGameData() {
  score = 0;
  elapsedTime = 0;
  scoreSaved = false;

  updateScoreText();
  timerText.textContent = formatHudTime(elapsedTime);
  finalScoreText.textContent = formatHudTime(elapsedTime);

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  shareBtn.disabled = false;
  renderLeaderboard([]);

  gameArea.innerHTML = "";
  resetAimMarker();
  setVoiceMeterLevel(0);

  clearInterval(timerInterval);
  clearSpawnTimers();
}

function runTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!gameRunning) return;

    elapsedTime++;
    timerText.textContent = formatHudTime(elapsedTime);
  }, 1000);
}

function runSpawner() {
  clearSpawnTimers();

  for (let i = 0; i < INITIAL_CHILI_COUNT; i++) {
    scheduleNextChili(260 + i * randomNumber(90, 230), i < 1);
  }

  spawnInterval = setInterval(() => {
    if (!gameRunning) return;

    if (getActiveChiliCount() < MAX_ACTIVE_CHILIES) {
      scheduleNextChili(randomNumber(80, 360), false);
    }
  }, SPAWN_REFILL_INTERVAL);
}

function scheduleNextChili(delay, nearView = false) {
  const timeoutId = setTimeout(() => {
    spawnTimeouts = spawnTimeouts.filter((id) => id !== timeoutId);
    if (gameRunning && getActiveChiliCount() < MAX_ACTIVE_CHILIES) {
      spawnChili(nearView);
    }
  }, delay);

  spawnTimeouts.push(timeoutId);
}

function clearSpawnTimers() {
  clearInterval(spawnInterval);
  spawnInterval = null;

  spawnTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  spawnTimeouts = [];
  lastViewRefillAt = 0;
  nextChiliExpireAt = 0;
}

function endGame() {
  if (!gameRunning) return;

  if (score < TARGET_SCORE) {
    resetToIntro();
    return;
  }

  gameRunning = false;

  clearInterval(timerInterval);
  clearSpawnTimers();
  stopVoiceCatch();

  gameArea.innerHTML = "";
  resetAimMarker();
  setVoiceMeterLevel(0);
  gameHud.classList.add("hidden");

  finalScoreText.textContent = formatHudTime(elapsedTime);

  scoreSaved = false;
  topFiveInfo.classList.add("hidden");
  resultScreen.classList.remove("save-score-open");
  saveScoreBtn.classList.remove("hidden");
  shareBtn.disabled = false;
  startPlayAgainCooldown();

  loadLeaderboard();

  stopOrientationTracking();
  clearXRSpawnTimers();
  clearXRObjects();

  document.body.classList.remove("game-mode");
  document.body.classList.add("result-mode");
  setBrowserScreen("result", "replace");

  resultScreen.classList.add("active");
}

function resetToIntro(updateHistory = true) {
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

  score = 0;
  elapsedTime = 0;
  scoreSaved = false;

  updateScoreText();
  timerText.textContent = formatHudTime(elapsedTime);
  finalScoreText.textContent = formatHudTime(elapsedTime);

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  closeSaveScoreModal();

  resultScreen.classList.remove("active");
  gameHud.classList.add("hidden");
  introScreen.classList.add("active");

  document.body.classList.remove("game-mode");
  document.body.classList.remove("result-mode");
  document.body.classList.add("intro-mode");

  if (updateHistory) {
    setBrowserScreen("intro", "replace");
  }
}

function startPlayAgainCooldown() {
  let cooldownLeft = PLAY_AGAIN_COOLDOWN;

  clearPlayAgainCooldown();

  playAgainBtn.disabled = true;
  playAgainBtn.textContent = `MAIN LAGI (${cooldownLeft})`;

  playAgainCooldownInterval = setInterval(() => {
    cooldownLeft--;

    if (cooldownLeft <= 0) {
      clearPlayAgainCooldown();
      return;
    }

    playAgainBtn.textContent = `MAIN LAGI (${cooldownLeft})`;
  }, 1000);
}

function clearPlayAgainCooldown() {
  clearInterval(playAgainCooldownInterval);
  playAgainCooldownInterval = null;

  playAgainBtn.disabled = false;
  playAgainBtn.textContent = "MAIN LAGI";
}

/* =========================
   CHILI SPAWNING
========================= */

function spawnChili(nearView = false) {
  if (getActiveChiliCount() >= MAX_ACTIVE_CHILIES) return;

  if (orientationActive && baseGamma === null) {
    scheduleNextChili(250, nearView);
    return;
  }

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
    const centerGamma = smoothGamma;
    const centerBeta = smoothBeta;
    const spawnPosition = getSpacedWorldSpawn(centerGamma, centerBeta, rangeH, rangeV);

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

  chili.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  gameArea.appendChild(chili);

  if (baseGamma !== null) {
    projectWorldChili(chili);
  }

  setTimeout(() => {
    if (!chili.parentElement) return;
    if (chili.dataset.wg !== undefined) {
      projectWorldChili(chili);
      return;
    }

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
    if (chili.parentElement && chili.dataset.caught !== "true") {
      queueChiliExpire(chili);
    }
  }, duration);
}

function queueChiliExpire(chili) {
  if (!gameRunning || !chili.parentElement) return;
  if (chili.dataset.caught === "true" || chili.classList.contains("chili-expire")) return;

  const now = performance.now();

  if (now < nextChiliExpireAt) {
    setTimeout(() => {
      queueChiliExpire(chili);
    }, nextChiliExpireAt - now + randomNumber(30, 160));
    return;
  }

  nextChiliExpireAt = now + randomNumber(CHILI_EXPIRE_STAGGER_MIN, CHILI_EXPIRE_STAGGER_MAX);
  expireChili(chili);
}

function expireChili(chili) {
  chili.classList.add("chili-expire");
  setTimeout(() => {
    if (chili.parentElement) chili.remove();
  }, 380);
}

function getActiveChiliCount() {
  return document.querySelectorAll(".chili:not(.chili-expire)").length;
}

function getVisibleChiliCount() {
  let visibleCount = 0;

  document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
    if (chili.dataset.caught === "true") return;

    if (isRectInViewport(chili.getBoundingClientRect(), 40)) {
      visibleCount++;
    }
  });

  return visibleCount;
}

function getActiveTargetCount() {
  return document.querySelectorAll('.chili[data-target="true"]:not(.chili-expire)').length;
}

function getSpawnAsset() {
  const activeCount = getActiveChiliCount();
  const targetCount = getActiveTargetCount();

  if (DECOY_ASSETS.length === 0 || shouldSpawnTargetAsset(activeCount, targetCount)) {
    return TARGET_ASSET;
  }

  return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
}

function shouldSpawnTargetAsset(activeCount, targetCount) {
  if (targetCount < MIN_TARGET_CHILIES) return true;

  const maxTargetCount = Math.max(
    MIN_TARGET_CHILIES + 1,
    Math.ceil(activeCount * (TARGET_SPAWN_RATIO + 0.12))
  );

  if (targetCount >= maxTargetCount) return false;

  return Math.random() < TARGET_SPAWN_RATIO;
}

function getSpacedWorldSpawn(centerGamma, centerBeta, rangeH, rangeV) {
  let best = null;
  let bestDistance = -Infinity;

  for (let i = 0; i < 24; i++) {
    const candidate = {
      wg: centerGamma + randF(-rangeH, rangeH),
      wb: centerBeta + randF(-rangeV, rangeV)
    };
    const distance = getNearestChiliScreenDistance(candidate.wg, candidate.wb);

    if (distance >= MIN_CHILI_SCREEN_DISTANCE) {
      return candidate;
    }

    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best || {
    wg: centerGamma + randF(-rangeH, rangeH),
    wb: centerBeta + randF(-rangeV, rangeV)
  };
}

function getNearestChiliScreenDistance(wg, wb) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const x = cx - (wg - smoothGamma) * PX_PER_DEG_H;
  const y = cy - (wb - smoothBeta) * PX_PER_DEG_V;
  let nearest = Infinity;

  document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
    if (chili.dataset.caught === "true") return;

    const rect = chili.getBoundingClientRect();
    const chiliX = rect.left + rect.width / 2;
    const chiliY = rect.top + rect.height / 2;
    nearest = Math.min(nearest, getDistance(x, y, chiliX, chiliY));
  });

  return nearest;
}

function getSpacedScreenSpawn(leftLimit, rightLimit, topLimit, bottomLimit) {
  let best = null;
  let bestDistance = -Infinity;

  for (let i = 0; i < 24; i++) {
    const candidate = {
      x: randomNumber(leftLimit, rightLimit),
      y: randomNumber(topLimit, bottomLimit)
    };
    const distance = getNearestChiliPointDistance(candidate.x, candidate.y);

    if (distance >= MIN_CHILI_SCREEN_DISTANCE) {
      return candidate;
    }

    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best || {
    x: randomNumber(leftLimit, rightLimit),
    y: randomNumber(topLimit, bottomLimit)
  };
}

function getNearestChiliPointDistance(x, y) {
  let nearest = Infinity;

  document.querySelectorAll(".chili:not(.chili-expire)").forEach((chili) => {
    if (chili.dataset.caught === "true") return;

    const rect = chili.getBoundingClientRect();
    const chiliX = rect.left + rect.width / 2;
    const chiliY = rect.top + rect.height / 2;
    nearest = Math.min(nearest, getDistance(x, y, chiliX, chiliY));
  });

  return nearest;
}

function isRectInViewport(rect, margin = 0) {
  return (
    rect.right >= -margin &&
    rect.left <= window.innerWidth + margin &&
    rect.bottom >= -margin &&
    rect.top <= window.innerHeight + margin
  );
}

/* =========================
   CATCH LOGIC
========================= */

function catchChiliByMarker() {
  if (!gameRunning) return;

  if (xrActive && catchXRObjectByMarker()) {
    return;
  }

  const targetHit = findChiliInMarker();

  if (targetHit) {
    collectChili(targetHit.chili, targetHit.x, targetHit.y);
  } else {
    showMissEffect();
  }
}

function findChiliInMarker() {
  const target = document.querySelector(".aim-area");
  const chilies = document.querySelectorAll(".chili:not(.chili-expire)");

  if (!target || chilies.length === 0) {
    return null;
  }

  const targetRect = target.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const catchRadius = targetRect.width * 0.52;

  let closestChili = null;
  let closestDist = Infinity;
  let closestX = 0;
  let closestY = 0;
  let closestTarget = null;
  let closestTargetDist = Infinity;
  let closestTargetX = 0;
  let closestTargetY = 0;

  chilies.forEach((chili) => {
    if (chili.dataset.caught === "true") return;

    const chiliRect = chili.getBoundingClientRect();
    const chiliCenterX = chiliRect.left + chiliRect.width / 2;
    const chiliCenterY = chiliRect.top + chiliRect.height / 2;

    const distance = getDistance(targetCenterX, targetCenterY, chiliCenterX, chiliCenterY);

    if (distance <= catchRadius && chili.dataset.target === "true" && distance < closestTargetDist) {
      closestTargetDist = distance;
      closestTarget = chili;
      closestTargetX = chiliRect.left;
      closestTargetY = chiliRect.top;
    }

    if (distance <= catchRadius && distance < closestDist) {
      closestDist = distance;
      closestChili = chili;
      closestX = chiliRect.left;
      closestY = chiliRect.top;
    }
  });

  if (closestTarget) {
    return {
      chili: closestTarget,
      x: closestTargetX,
      y: closestTargetY
    };
  }

  if (closestChili) {
    return {
      chili: closestChili,
      x: closestX,
      y: closestY
    };
  }

  return null;
}

function collectChili(chili, x, y) {
  if (!gameRunning) return;
  if (!chili || !chili.parentElement) return;
  if (chili.dataset.caught === "true") return;

  resetMissEffect();

  chili.dataset.caught = "true";
  const isTarget = chili.dataset.target === "true";

  if (isTarget) {
    score++;
    updateScoreText();

    createHitEffect(x, y);
    createPlusOne(x, y);

    if (score >= TARGET_SCORE) {
      setTimeout(() => {
        endGame();
      }, 320);
    }
  } else {
    showMissEffect();
  }

  scheduleNextChili(randomNumber(350, 850), false);

  chili.classList.add("chili-caught");
  setTimeout(() => {
    if (chili.parentElement) chili.remove();
  }, 280);
}

function showMissEffect() {
  const target = document.querySelector(".aim-area");

  if (target) {
    target.classList.remove("miss");
    void target.offsetWidth;
    target.classList.add("miss");

    setTimeout(() => {
      target.classList.remove("miss");
    }, 300);
  }
}

function resetMissEffect() {
  const target = document.querySelector(".aim-area");

  if (target) {
    target.classList.remove("miss");
  }
}

function createHitEffect(x, y) {
  const effect = document.createElement("div");

  effect.className = "hit-effect";
  effect.style.left = `${x - 8}px`;
  effect.style.top = `${y - 8}px`;

  gameArea.appendChild(effect);

  setTimeout(() => {
    effect.remove();
  }, 500);
}

function createPlusOne(x, y) {
  const plus = document.createElement("div");

  plus.className = "plus-one";
  plus.textContent = "+1";
  plus.style.left = `${x + 22}px`;
  plus.style.top = `${y - 12}px`;

  gameArea.appendChild(plus);

  setTimeout(() => {
    plus.remove();
  }, 700);
}

/* =========================
   LEADERBOARD API
========================= */

async function loadLeaderboard() {
  try {
    const data = await fetchJson(GET_LEADERBOARD_API);
    const leaderboard = normalizeLeaderboardResponse(data);
    renderLeaderboard(leaderboard);
  } catch (error) {
    console.warn("Leaderboard unavailable:", error);
    renderLeaderboardUnavailable();
  }
}

function renderLeaderboard(leaderboard) {
  leaderboardList.innerHTML = "";

  for (let index = 0; index < 5; index++) {
    const item = leaderboard?.[index];
    const row = document.createElement("div");
    row.className = "leaderboard-item";

    const safeName = item
      ? escapeHtml(item.name || item.player_name || "Player")
      : "-";
    const scoreValue = Number(item?.total_score ?? item?.score ?? item?.time_seconds ?? item?.time ?? 0);
    const safeScore = item ? formatHudTime(scoreValue) : "--:--";

    row.innerHTML = `
      <span class="leaderboard-rank">${index + 1}</span>
      <span class="leaderboard-name">${safeName}</span>
      <span class="leaderboard-score">${safeScore}</span>
    `;

    leaderboardList.appendChild(row);
  }
}

function normalizeLeaderboardResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.leaderboard)) return data.leaderboard;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function renderLeaderboardUnavailable() {
  leaderboardList.innerHTML = "";

  for (let index = 0; index < 5; index++) {
    const row = document.createElement("div");
    row.className = "leaderboard-item";
    row.innerHTML = `
      <span class="leaderboard-rank">${index + 1}</span>
      <span class="leaderboard-name">${index === 0 ? "Leaderboard belum tersedia" : "-"}</span>
      <span class="leaderboard-score">--:--</span>
    `;

    leaderboardList.appendChild(row);
  }
}

/* =========================
   SAVE SCORE API
========================= */

function openSaveScoreModal() {
  modalScoreText.textContent = formatHudTime(elapsedTime);
  playerNameInput.value = "";
  playerEmailInput.value = "";
  saveMessage.textContent = "";
  saveMessage.className = "save-message";

  resultScreen.classList.add("save-score-open");
  saveScoreModal.classList.remove("hidden");

  setTimeout(() => {
    playerNameInput.focus();
  }, 100);
}

function closeSaveScoreModal() {
  saveScoreModal.classList.add("hidden");
  resultScreen.classList.remove("save-score-open");
}

function showAppNotice(title, message) {
  appNoticeTitle.textContent = title;
  appNoticeText.textContent = message;
  appNotice.classList.remove("hidden");
}

function closeAppNotice() {
  appNotice.classList.add("hidden");
}

async function submitScore() {
  if (scoreSaved) return;

  const name = playerNameInput.value.trim();
  const email = playerEmailInput.value.trim();

  if (!name) {
    saveMessage.textContent = "Masukkan nama kamu.";
    saveMessage.className = "save-message error";
    playerNameInput.focus();
    return;
  }

  if (!isValidEmail(email)) {
    saveMessage.textContent = "Masukkan e-mail yang valid.";
    saveMessage.className = "save-message error";
    playerEmailInput.focus();
    return;
  }

  submitScoreBtn.disabled = true;
  saveMessage.textContent = "Menyimpan skor...";
  saveMessage.className = "save-message";

  try {
    await fetchJson(SAVE_SCORE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        total_score: elapsedTime,
        time_seconds: elapsedTime,
        collected_chilies: TARGET_SCORE
      })
    });

    scoreSaved = true;
    saveMessage.textContent = "Skor berhasil disimpan.";
    saveMessage.className = "save-message success";
    saveScoreBtn.classList.add("hidden");
    shareBtn.disabled = false;
    topFiveInfo.textContent = "Skor tersimpan di leaderboard";
    topFiveInfo.classList.remove("hidden");
    await loadLeaderboard();

    setTimeout(() => {
      closeSaveScoreModal();
    }, 700);
  } catch (error) {
    console.error("Save score error:", error);
    saveMessage.textContent = error.message || "Unable to save score. Please try again.";
    saveMessage.className = "save-message error";
  } finally {
    submitScoreBtn.disabled = false;
  }
}

/* =========================
   SHARE SCORE IMAGE
========================= */

async function shareScoreImage() {
  shareBtn.disabled = true;

  try {
    closeAppNotice();

    const resultTime = formatHudTime(elapsedTime);
    const imageBlob = await createScoreImageBlob(resultTime);

    const file = new File(
      [imageBlob],
      "green-chili-hunt-score.png",
      {
        type: "image/png"
      }
    );

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Green Chili Hunt Score",
        text: `I collected ${TARGET_SCORE} green chilies in ${resultTime}!`,
        files: [file]
      });

      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Green Chili Hunt Score",
        text: `I collected ${TARGET_SCORE} green chilies in ${resultTime}!`
      });

      return;
    }

    downloadScoreImage(imageBlob);
  } catch (error) {
    if (isShareCancelError(error)) {
      return;
    }

    console.error("Share error:", error);
    showAppNotice(
      "Share Unavailable",
      "Share is not available on this browser."
    );
  } finally {
    shareBtn.disabled = false;
  }
}

function isShareCancelError(error) {
  const name = (error?.name || "").toLowerCase();
  const message = (error?.message || "").toLowerCase();

  return (
    name === "aborterror" ||
    message.includes("cancel") ||
    message.includes("abort")
  );
}

function createScoreImageBlob(scoreValue) {
  return new Promise(async (resolve) => {
    const canvas = document.createElement("canvas");

    canvas.width = 1080;
    canvas.height = 1920;

    const ctx = canvas.getContext("2d");

    try {
      const [background, logo, durationFrame, footer] = await Promise.all([
        loadImage("assets/ui/bg_share_result.png"),
        loadImage("assets/ui/logo_share_result.png"),
        loadImage("assets/ui/frame_durasi_share.png"),
        loadImage("assets/ui/footer_share.png")
      ]);

      ctx.fillStyle = "#020803";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawImageContain(ctx, background, 108, 0, 864, 1920);

      drawImageContain(ctx, logo, 187, 150, 706, 630);
      drawImageContain(ctx, durationFrame, 259, 958, 562, 285);
      drawImageContain(ctx, footer, 295, 1482, 490, 120);

      ctx.textAlign = "center";
      ctx.fillStyle = "#70ff70";
      ctx.font = "900 142px Saira, Arial, Helvetica, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(scoreValue.toString(), 540, 1128);

      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 900 34px Saira, Arial, Helvetica, sans-serif";
      ctx.fillText("YAKIN BISA LEBIH CEPET?", 540, 1432);
    } catch (error) {
      console.error("Share template render error:", error);
      ctx.fillStyle = "#041006";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#70ff70";
      ctx.font = "900 96px Arial";
      ctx.textAlign = "center";
      ctx.fillText(scoreValue.toString(), canvas.width / 2, canvas.height / 2);
    }

    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageContain(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function downloadScoreImage(blob) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "green-chili-hunt-score.png";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/* =========================
   HELPERS
========================= */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isIjoCommand(text) {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized
    .split(" ")
    .some((word) => word === "ijo" || word === "hijau");
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
}

// Projects a world-space point [x,y,z] to NDC using the cached XR camera.
// Returns {x, y, z} in [-1,1] range, or null if camera not ready.
function projectXRPoint(worldPos) {
  if (!xrLastCamera) return null;

  const vec = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(xrLastCamera);

  return { x: vec.x, y: vec.y, z: vec.z };
}

function updateScoreText() {
  scoreText.textContent = `${Math.min(score, TARGET_SCORE)}/${TARGET_SCORE}`;

  chiliSlots.forEach((slot, index) => {
    const isActive = index < score;

    slot.classList.toggle("active", isActive);
    slot.src = isActive ? CHILI_HUD_ACTIVE_SRC : CHILI_HUD_INACTIVE_SRC;
  });
}

function formatHudTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatElapsedTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function smoothAngle(current, target) {
  const delta = target - current;

  if (Math.abs(delta) <= ORIENT_DEADZONE) {
    return current;
  }

  return current + ORIENT_SMOOTH * delta;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randF(min, max) {
  return Math.random() * (max - min) + min;
}
