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
const NEXT_CHILI_OVERLAP_MIN = 900;
const NEXT_CHILI_OVERLAP_MAX = 2400;
const MAX_ACTIVE_CHILIES = 18;
const INITIAL_CHILI_COUNT = 14;
const SPAWN_REFILL_INTERVAL = 520;
const CHILI_SIZE_MIN = 34;
const CHILI_SIZE_MAX = 82;
const WORLD_RANGE_H = 24;
const WORLD_RANGE_V = 16;
const MIN_CHILI_SCREEN_DISTANCE = 36;
const DEPTH_MIN = 0.58;
const DEPTH_MAX = 1.1;
const TARGET_SPAWN_RATIO = 0.12;
const MIN_TARGET_CHILIES = 1;

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

let cameraStarted = false;
let cameraStream = null;

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
  });
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
   GAME FLOW
========================= */

async function startGame() {
  const cameraReady = await startCamera();
  if (!cameraReady) return;

  await startOrientationTracking();
  resetGameData();

  document.body.classList.remove("intro-mode");
  document.body.classList.remove("result-mode");
  document.body.classList.add("game-mode");

  introScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  gameHud.classList.remove("hidden");

  gameRunning = true;

  runTimer();
  runSpawner();
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
}

function endGame() {
  if (!gameRunning) return;

  gameRunning = false;

  clearInterval(timerInterval);
  clearSpawnTimers();

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

  gameArea.innerHTML = "";
  resetAimMarker();

  stopOrientationTracking();
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
    const centerGamma = nearView ? smoothGamma : baseGamma;
    const centerBeta = nearView ? smoothBeta : baseBeta;
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
      expireChili(chili);
    }
  }, duration);
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

function getActiveTargetCount() {
  return document.querySelectorAll('.chili[data-target="true"]:not(.chili-expire)').length;
}

function getSpawnAsset() {
  const activeCount = getActiveChiliCount();
  const targetCount = getActiveTargetCount();
  const desiredTargetCount = Math.max(
    MIN_TARGET_CHILIES,
    Math.round((activeCount + 1) * TARGET_SPAWN_RATIO)
  );

  if (targetCount < desiredTargetCount) {
    return TARGET_ASSET;
  }

  if (DECOY_ASSETS.length === 0) {
    return TARGET_ASSET;
  }

  return DECOY_ASSETS[randomNumber(0, DECOY_ASSETS.length - 1)];
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

/* =========================
   CATCH LOGIC
========================= */

function catchChiliByMarker() {
  if (!gameRunning) return;

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
      <span class="leaderboard-name">No score yet</span>
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

  const row = document.createElement("div");
  row.className = "leaderboard-item";
  row.innerHTML = `
    <span class="leaderboard-rank">10x</span>
    <span class="leaderboard-name">Completed in</span>
    <span class="leaderboard-score">${formatElapsedTime(elapsedTime)}</span>
  `;

  leaderboardList.appendChild(row);
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
