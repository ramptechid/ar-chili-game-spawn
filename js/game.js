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

const TARGET_SCORE        = 10;
const PLAY_AGAIN_COOLDOWN = 5;
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
const XR_MAX_ACTIVE_OBJECTS = 38;
const XR_INITIAL_OBJECTS = 28;
const XR_SIZE_MIN = 0.14;
const XR_SIZE_MAX = 0.3;
const XR_DISTANCE_MIN = 1.2;
const XR_DISTANCE_MAX = 4.2;
const XR_NEAR_SCALE_DISTANCE = 0.85;
const XR_FAR_SCALE_DISTANCE = 4.2;
const XR_APPROACH_SCALE_BOOST = 0.9;
const XR_CATCH_ANIM_MS = 480;
const XR_FADEIN_MS = 320;
const XR_EXPIRE_MS = 520;
const XR_EXPIRE_STAGGER_MIN = 520;
const XR_EXPIRE_STAGGER_MAX = 1250;
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
  alt: "Green Chili",
  isTarget: true,
  minSize: 38,
  maxSize: 74
};

const DECOY_ASSETS = [
  {
    src: "assets/images/bintang.png",
    alt: "Star Decoy",
    minSize: 34,
    maxSize: 68
  },
  {
    src: "assets/images/kotak-tinggi.png",
    alt: "Tall Box Decoy",
    minSize: 38,
    maxSize: 78
  },
  {
    src: "assets/images/persegi-panjang.png",
    alt: "Rectangle Decoy",
    minSize: 44,
    maxSize: 86
  },
  {
    src: "assets/images/segi-enam.png",
    alt: "Hexagon Decoy",
    minSize: 36,
    maxSize: 72
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
let xrActive = false;
let xrSession = null;
let xrRefSpace = null;
let xrGl = null;
let xrProgram = null;
let xrPositionBuffer = null;
let xrUvBuffer = null;
let xrTextures = new Map();
let xrObjects = [];
let xrLastPose = null;
let xrLastView = null;
let xrLastViewProjection = null;
let xrLastRefillAt = 0;
let xrSpawnInterval = null;
let nextXRExpireAt = 0;
let voiceActive = false;
let voiceStream = null;
let voiceRecognition = null;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceLoopId = null;
let lastVoiceCatchAt = 0;

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
   DEVICE ORIENTATION (world-anchor chilies)
========================= */

async function startOrientationTracking() {
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

/* =========================
   WEBXR AR
========================= */

async function startXRSession() {
  if (!navigator.xr || !xrCanvas) return false;

  try {
    if (!xrGl) {
      xrGl = xrCanvas.getContext("webgl", {
        xrCompatible: true,
        alpha: true,
        antialias: false
      });
    }

    if (!xrGl) return false;

    xrCanvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      xrTextures.clear();
    }, { once: true });

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: {
        root: document.body
      }
    });

    await xrGl.makeXRCompatible();
    xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(xrSession, xrGl, {
        alpha: true,
        antialias: false
      })
    });

    try {
      xrRefSpace = await xrSession.requestReferenceSpace("local");
    } catch {
      xrRefSpace = await xrSession.requestReferenceSpace("local-floor");
    }

    setupXRRenderer();
    await loadXRTextures();

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
    attribute vec2 a_position;
    attribute vec2 a_uv;
    uniform mat4 u_matrix;
    varying vec2 v_uv;

    void main() {
      v_uv = a_uv;
      gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    }
  `);
  const fragmentShader = createXRShader(xrGl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_alpha;
    varying vec2 v_uv;

    void main() {
      vec4 color = texture2D(u_texture, v_uv);
      gl_FragColor = vec4(color.rgb, color.a * u_alpha);
    }
  `);

  xrProgram = xrGl.createProgram();
  xrGl.attachShader(xrProgram, vertexShader);
  xrGl.attachShader(xrProgram, fragmentShader);
  xrGl.linkProgram(xrProgram);

  xrPositionBuffer = xrGl.createBuffer();
  xrGl.bindBuffer(xrGl.ARRAY_BUFFER, xrPositionBuffer);
  xrGl.bufferData(
    xrGl.ARRAY_BUFFER,
    new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
      -0.5,  0.5,
       0.5,  0.5
    ]),
    xrGl.STATIC_DRAW
  );

  xrUvBuffer = xrGl.createBuffer();
  xrGl.bindBuffer(xrGl.ARRAY_BUFFER, xrUvBuffer);
  xrGl.bufferData(
    xrGl.ARRAY_BUFFER,
    new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]),
    xrGl.STATIC_DRAW
  );

  xrGl.enable(xrGl.BLEND);
  xrGl.blendFunc(xrGl.SRC_ALPHA, xrGl.ONE_MINUS_SRC_ALPHA);
}

function createXRShader(type, source) {
  const shader = xrGl.createShader(type);
  xrGl.shaderSource(shader, source);
  xrGl.compileShader(shader);
  return shader;
}

async function loadXRTextures() {
  const assets = [TARGET_ASSET, ...DECOY_ASSETS];
  await Promise.all(assets.map((asset) => loadXRTexture(asset.src)));
}

function loadXRTexture(src) {
  if (xrTextures.has(src)) return Promise.resolve(xrTextures.get(src));

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const texture = xrGl.createTexture();
      xrGl.bindTexture(xrGl.TEXTURE_2D, texture);
      xrGl.texImage2D(xrGl.TEXTURE_2D, 0, xrGl.RGBA, xrGl.RGBA, xrGl.UNSIGNED_BYTE, image);
      xrGl.texParameteri(xrGl.TEXTURE_2D, xrGl.TEXTURE_WRAP_S, xrGl.CLAMP_TO_EDGE);
      xrGl.texParameteri(xrGl.TEXTURE_2D, xrGl.TEXTURE_WRAP_T, xrGl.CLAMP_TO_EDGE);
      xrGl.texParameteri(xrGl.TEXTURE_2D, xrGl.TEXTURE_MIN_FILTER, xrGl.LINEAR);
      xrGl.texParameteri(xrGl.TEXTURE_2D, xrGl.TEXTURE_MAG_FILTER, xrGl.LINEAR);
      xrTextures.set(src, texture);
      resolve(texture);
    };
    image.onerror = reject;
    image.src = src;
  });
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
  refillXRCurrentView(time);

  for (const xrView of pose.views) {
    const viewport = layer.getViewport(xrView);
    xrGl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    renderXRObjects(xrView);
  }
}

function renderXRObjects(view) {
  xrGl.useProgram(xrProgram);

  const positionLocation = xrGl.getAttribLocation(xrProgram, "a_position");
  xrGl.bindBuffer(xrGl.ARRAY_BUFFER, xrPositionBuffer);
  xrGl.enableVertexAttribArray(positionLocation);
  xrGl.vertexAttribPointer(positionLocation, 2, xrGl.FLOAT, false, 0, 0);

  const uvLocation = xrGl.getAttribLocation(xrProgram, "a_uv");
  xrGl.bindBuffer(xrGl.ARRAY_BUFFER, xrUvBuffer);
  xrGl.enableVertexAttribArray(uvLocation);
  xrGl.vertexAttribPointer(uvLocation, 2, xrGl.FLOAT, false, 0, 0);

  const matrixLocation = xrGl.getUniformLocation(xrProgram, "u_matrix");
  const alphaLocation = xrGl.getUniformLocation(xrProgram, "u_alpha");
  const textureLocation = xrGl.getUniformLocation(xrProgram, "u_texture");
  const viewProjection = multiplyMat4(view.projectionMatrix, view.transform.inverse.matrix);
  const cameraMatrix = view.transform.matrix;
  const now = performance.now();

  xrObjects.forEach((object) => {
    if (object.caught) return;

    let alpha = 1;
    let scale = 1;

    if (object.catching) {
      const t = clamp((now - object.catchStartAt) / XR_CATCH_ANIM_MS, 0, 1);
      alpha = 1 - t;
      scale = 1 - t * 0.5;
    } else if (object.expiring) {
      const t = clamp((now - object.expireStartedAt) / XR_EXPIRE_MS, 0, 1);
      alpha = 1 - t;
      scale = 1 - t * 0.45;
    } else if (object.fadeIn) {
      const t = clamp((now - object.fadeInStart) / XR_FADEIN_MS, 0, 1);
      alpha = t;
      scale = 0.55 + t * 0.45;
      if (t >= 1) object.fadeIn = false;
    }

    if (alpha <= 0.01) return;

    scale *= getXRApproachScale(object, cameraMatrix);
    const modelMatrix = makeBillboardMatrix(object, cameraMatrix, scale);
    const matrix = multiplyMat4(viewProjection, modelMatrix);

    xrGl.activeTexture(xrGl.TEXTURE0);
    xrGl.bindTexture(xrGl.TEXTURE_2D, xrTextures.get(object.asset.src));
    xrGl.uniform1i(textureLocation, 0);
    xrGl.uniform1f(alphaLocation, alpha);
    xrGl.uniformMatrix4fv(matrixLocation, false, matrix);
    xrGl.drawArrays(xrGl.TRIANGLE_STRIP, 0, 4);
  });
}

function runXRSpawner() {
  clearInterval(xrSpawnInterval);

  for (let i = 0; i < XR_INITIAL_OBJECTS; i++) {
    setTimeout(() => {
      if (gameRunning && xrActive) spawnXRObject(false);
    }, 300 + i * randomNumber(120, 260));
  }

  xrSpawnInterval = setInterval(() => {
    if (!gameRunning || !xrActive) return;

    if (getActiveXRObjectCount() < XR_MAX_ACTIVE_OBJECTS) {
      spawnXRObject(false);
    }
  }, SPAWN_REFILL_INTERVAL);
}

function spawnXRObject(nearView = true) {
  if (!xrLastPose || getActiveXRObjectCount() >= XR_MAX_ACTIVE_OBJECTS) return;

  const asset = getSpawnAssetXR();
  const cameraMatrix = xrLastPose.transform.matrix;
  const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];

  // Horizontal camera forward (ignore tilt/pitch)
  const fwdX = -cameraMatrix[8];
  const fwdZ = -cameraMatrix[10];
  const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ);
  const nfX = fwdLen > 0.001 ? fwdX / fwdLen : 0;
  const nfZ = fwdLen > 0.001 ? fwdZ / fwdLen : -1;
  const nrX = nfZ;
  const nrZ = -nfX;

  // Near = front 180° arc, full = 360° around player
  const angle = nearView
    ? randF(-Math.PI / 2, Math.PI / 2)
    : randF(0, Math.PI * 2);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const dirX = nfX * ca + nrX * sa;
  const dirZ = nfZ * ca + nrZ * sa;

  const distance = randF(XR_DISTANCE_MIN, XR_DISTANCE_MAX);

  // Spread objects vertically: floor (-1.5m), mid, ceiling (+1.8m)
  const heightZone = Math.random();
  let heightOffset;
  if (heightZone < 0.28) {
    heightOffset = randF(-1.6, -0.8);  // low / floor level
  } else if (heightZone < 0.56) {
    heightOffset = randF(-0.3, 0.4);   // eye level / middle
  } else {
    heightOffset = randF(0.7, 1.8);    // high / above head
  }

  const size = randF(XR_SIZE_MIN, XR_SIZE_MAX);
  const now = performance.now();

  // Position is fully anchored in world space — player must move to find objects
  xrObjects.push({
    asset,
    isTarget: !!asset.isTarget,
    position: [
      cameraPosition[0] + dirX * distance,
      cameraPosition[1] + heightOffset,
      cameraPosition[2] + dirZ * distance
    ],
    size,
    createdAt: now,
    lifetime: randomNumber(9000, 18000),
    caught: false,
    catching: false,
    expiring: false,
    fadeIn: true,
    fadeInStart: now
  });
}

function getSpawnAssetXR() {
  const activeCount = getActiveXRObjectCount();
  const targetCount = xrObjects.filter((object) => object.isTarget && !object.caught && !object.catching && !object.expiring).length;

  if (DECOY_ASSETS.length === 0 || shouldSpawnTargetAsset(activeCount, targetCount)) {
    return TARGET_ASSET;
  }

  return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
}

function expireXRObjects(time) {
  const now = performance.now();

  if (now >= nextXRExpireAt) {
    const nextExpiredObject = xrObjects
      .filter((object) => !object.caught && !object.catching && !object.expiring && now - object.createdAt >= object.lifetime)
      .sort((a, b) => (a.createdAt + a.lifetime) - (b.createdAt + b.lifetime))[0];

    if (nextExpiredObject) {
      nextExpiredObject.expiring = true;
      nextExpiredObject.expireStartedAt = now;
      nextXRExpireAt = now + randomNumber(XR_EXPIRE_STAGGER_MIN, XR_EXPIRE_STAGGER_MAX);
    }
  }

  xrObjects = xrObjects.filter((object) => {
    if (object.caught) return false;
    if (object.catching) return performance.now() - object.catchStartAt < XR_CATCH_ANIM_MS + 60;
    if (object.expiring) return performance.now() - object.expireStartedAt < XR_EXPIRE_MS + 60;
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
  return xrObjects.filter((object) => !object.caught && !object.catching && !object.expiring).length;
}

function getVisibleXRObjectCount() {
  return xrObjects.filter((object) => !object.caught && !object.catching && !object.expiring && isXRObjectInView(object)).length;
}

function isXRObjectInView(object) {
  if (!xrLastViewProjection) return true;

  const ndc = projectXRPoint(object.position, xrLastViewProjection);
  return ndc && Math.abs(ndc.x) <= 1.25 && Math.abs(ndc.y) <= 1.25 && ndc.z >= -1 && ndc.z <= 1;
}

function catchXRObjectByMarker() {
  if (!xrActive || !xrLastViewProjection) return false;

  let closest = null;
  let closestDist = Infinity;
  let closestTarget = null;
  let closestTargetDist = Infinity;
  const radius = 0.22;

  xrObjects.forEach((object) => {
    if (object.caught || object.catching || object.expiring) return;

    const ndc = projectXRPoint(object.position, xrLastViewProjection);
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

function stopXRSession(endSession = true) {
  xrActive = false;
  clearInterval(xrSpawnInterval);
  xrSpawnInterval = null;
  xrObjects = [];
  xrLastPose = null;
  xrLastView = null;
  xrLastViewProjection = null;
  xrLastRefillAt = 0;
  nextXRExpireAt = 0;
  document.body.classList.remove("xr-mode");

  if (xrGl) {
    if (xrProgram) { xrGl.deleteProgram(xrProgram); xrProgram = null; }
    if (xrPositionBuffer) { xrGl.deleteBuffer(xrPositionBuffer); xrPositionBuffer = null; }
    if (xrUvBuffer) { xrGl.deleteBuffer(xrUvBuffer); xrUvBuffer = null; }
    xrTextures.forEach((tex) => xrGl.deleteTexture(tex));
    xrTextures.clear();
    xrGl = null;
  }

  if (xrSession && endSession) {
    xrSession.end().catch(() => {});
  }

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
  catchChiliByMarker();
}

function stopVoiceCatch() {
  voiceActive = false;

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

/* =========================
   GAME FLOW
========================= */

async function startGame() {
  const xrReady = await startXRSession();

  if (!xrReady) {
    const cameraReady = await startCamera();
    if (!cameraReady) return;

    await startOrientationTracking();
  }

  resetGameData();

  document.body.classList.remove("intro-mode");
  document.body.classList.remove("result-mode");
  document.body.classList.add("game-mode");

  introScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  gameHud.classList.remove("hidden");

  gameRunning = true;

  startVoiceCatch();
  runTimer();

  if (xrReady) {
    runXRSpawner();
  } else {
    runSpawner();
  }
}

function resetGameData() {
  score = 0;
  elapsedTime = 0;
  scoreSaved = false;

  updateScoreText();
  timerText.textContent = formatElapsedTime(elapsedTime);
  finalScoreText.textContent = formatElapsedTime(elapsedTime);

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  renderLocalResult();

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
  saveScoreBtn.classList.add("hidden");
  startPlayAgainCooldown();

  renderLocalResult();

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

  score = 0;
  elapsedTime = 0;
  scoreSaved = false;

  updateScoreText();
  timerText.textContent = formatElapsedTime(elapsedTime);
  finalScoreText.textContent = formatElapsedTime(elapsedTime);

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.add("hidden");
  closeSaveScoreModal();

  resultScreen.classList.remove("active");
  gameHud.classList.add("hidden");
  introScreen.classList.add("active");

  document.body.classList.remove("game-mode");
  document.body.classList.remove("result-mode");
  document.body.classList.add("intro-mode");
}

function startPlayAgainCooldown() {
  let cooldownLeft = PLAY_AGAIN_COOLDOWN;

  clearPlayAgainCooldown();

  playAgainBtn.disabled = true;
  playAgainBtn.textContent = `Play Again (${cooldownLeft})`;

  playAgainCooldownInterval = setInterval(() => {
    cooldownLeft--;

    if (cooldownLeft <= 0) {
      clearPlayAgainCooldown();
      return;
    }

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
  renderLocalResult();
}

function renderLeaderboard(leaderboard) {
  leaderboardList.innerHTML = "";

  if (!leaderboard || leaderboard.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "leaderboard-item";
    emptyRow.innerHTML = `
      <span class="leaderboard-rank">-</span>
      <span class="leaderboard-name">No results yet</span>
      <span class="leaderboard-score">0</span>
    `;

    leaderboardList.appendChild(emptyRow);
    return;
  }

  leaderboard.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";

    const safeName = escapeHtml(item.name || "Player");
    const safeScore = Number(item.total_score || 0);

    row.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-name">${safeName}</span>
      <span class="leaderboard-score">${safeScore}</span>
    `;

    leaderboardList.appendChild(row);
  });
}

function renderLocalResult() {
  leaderboardList.innerHTML = "";

  const dummyLeaderboard = [
    { name: "Ava", time: 18 },
    { name: "Noah", time: 23 },
    { name: "Mia", time: 29 },
    { name: "Liam", time: 35 },
    { name: "You", time: elapsedTime || 42 }
  ].sort((a, b) => a.time - b.time).slice(0, 5);

  dummyLeaderboard.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";
    row.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-name">${escapeHtml(item.name)}</span>
      <span class="leaderboard-score">${formatElapsedTime(item.time)}</span>
    `;

    leaderboardList.appendChild(row);
  });
}

/* =========================
   SAVE SCORE API
========================= */

function openSaveScoreModal() {
  modalScoreText.textContent = formatElapsedTime(elapsedTime);
  playerNameInput.value = "";
  playerEmailInput.value = "";
  saveMessage.textContent = "";
  saveMessage.className = "save-message";

  saveScoreModal.classList.remove("hidden");

  setTimeout(() => {
    playerNameInput.focus();
  }, 100);
}

function closeSaveScoreModal() {
  saveScoreModal.classList.add("hidden");
}

function showAppNotice(title, message) {
  appNoticeTitle.textContent = title;
  appNoticeText.textContent = message;
  appNotice.classList.remove("hidden");
}

function closeAppNotice() {
  appNotice.classList.add("hidden");
}

function submitScore() {
  saveMessage.textContent = "Online score saving is disabled for now.";
  saveMessage.className = "save-message error";
}

/* =========================
   SHARE SCORE IMAGE
========================= */

async function shareScoreImage() {
  try {
    const resultTime = formatElapsedTime(elapsedTime);
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
        text: `I collected 10 green chilies in ${resultTime}!`,
        files: [file]
      });

      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Green Chili Hunt Score",
        text: `I collected 10 green chilies in ${resultTime}!`
      });

      return;
    }

    downloadScoreImage(imageBlob);
  } catch (error) {
    console.error("Share error:", error);
    showAppNotice(
      "Share Unavailable",
      "Share is not available on this browser."
    );
  }
}

function createScoreImageBlob(scoreValue) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");

    canvas.width = 1080;
    canvas.height = 1920;

    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1c5a21");
    gradient.addColorStop(0.5, "#071a0b");
    gradient.addColorStop(1, "#020502");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(202, 255, 114, 0.12)";
    ctx.beginPath();
    ctx.arc(540, 360, 330, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(202, 255, 114, 0.08)";
    ctx.beginPath();
    ctx.arc(130, 1600, 290, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "900 76px Arial";
    ctx.fillStyle = "#caff72";
    ctx.textAlign = "center";
    ctx.fillText("GREEN CHILI HUNT", 540, 320);

    ctx.font = "400 44px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillText("Time to collect 10 chilies", 540, 545);

    ctx.font = "900 230px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(scoreValue.toString(), 540, 815);

    drawChiliIcon(ctx, 540, 1065);

    ctx.font = "500 44px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    ctx.fillText("Can you beat my time?", 540, 1290);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundRect(ctx, 150, 1420, 780, 145, 42);
    ctx.fill();

    ctx.font = "700 38px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Play now and collect green chilies!", 540, 1508);

    ctx.font = "400 30px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillText("Share your score", 540, 1695);

    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

function drawChiliIcon(ctx, x, y) {
  ctx.save();

  ctx.translate(x, y);
  ctx.rotate(-0.35);

  ctx.fillStyle = "#55e85b";
  ctx.beginPath();
  ctx.moveTo(-115, 40);
  ctx.bezierCurveTo(-40, 110, 95, 60, 115, -35);
  ctx.bezierCurveTo(30, 25, -35, 15, -115, 40);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(20, -5, 55, 18, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8ad34a";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-20, -30);
  ctx.quadraticCurveTo(-30, -95, 35, -115);
  ctx.stroke();

  ctx.restore();
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

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
}

function addVec3(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2]
  ];
}

function scaleVec3(vector, scale) {
  return [
    vector[0] * scale,
    vector[1] * scale,
    vector[2] * scale
  ];
}

function multiplyMat4(a, b) {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }

  return out;
}

function getXRApproachScale(object, cameraMatrix) {
  const dx = object.position[0] - cameraMatrix[12];
  const dy = object.position[1] - cameraMatrix[13];
  const dz = object.position[2] - cameraMatrix[14];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const range = XR_FAR_SCALE_DISTANCE - XR_NEAR_SCALE_DISTANCE;
  const closeness = clamp((XR_FAR_SCALE_DISTANCE - distance) / range, 0, 1);

  return 1 + closeness * XR_APPROACH_SCALE_BOOST;
}

function makeBillboardMatrix(object, cameraMatrix, scale = 1) {
  const size = object.size * scale;
  const right = [cameraMatrix[0], cameraMatrix[1], cameraMatrix[2]];
  const up = [cameraMatrix[4], cameraMatrix[5], cameraMatrix[6]];
  const forward = [cameraMatrix[8], cameraMatrix[9], cameraMatrix[10]];

  return new Float32Array([
    right[0] * size, right[1] * size, right[2] * size, 0,
    up[0] * size, up[1] * size, up[2] * size, 0,
    forward[0] * size, forward[1] * size, forward[2] * size, 0,
    object.position[0], object.position[1], object.position[2], 1
  ]);
}

function projectXRPoint(point, viewProjection) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const clipX = viewProjection[0] * x + viewProjection[4] * y + viewProjection[8] * z + viewProjection[12];
  const clipY = viewProjection[1] * x + viewProjection[5] * y + viewProjection[9] * z + viewProjection[13];
  const clipZ = viewProjection[2] * x + viewProjection[6] * y + viewProjection[10] * z + viewProjection[14];
  const clipW = viewProjection[3] * x + viewProjection[7] * y + viewProjection[11] * z + viewProjection[15];

  if (clipW <= 0.0001) return null;

  return {
    x: clipX / clipW,
    y: clipY / clipW,
    z: clipZ / clipW
  };
}

function updateScoreText() {
  scoreText.textContent = `${Math.min(score, TARGET_SCORE)}/${TARGET_SCORE}`;
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

// Random float in [min, max]
function randF(min, max) {
  return Math.random() * (max - min) + min;
}
