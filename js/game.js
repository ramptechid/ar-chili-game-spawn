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

const GAME_DURATION       = 60;
const PLAY_AGAIN_COOLDOWN = 5;
const CHILI_LIFETIME_MIN  = 5000;
const CHILI_LIFETIME_MAX  = 9000;
const NEXT_CHILI_OVERLAP_MIN = 1200;
const NEXT_CHILI_OVERLAP_MAX = 2200;

// Pixels per 1° of phone rotation
const PX_PER_DEG_H = window.innerWidth  / 28;
const PX_PER_DEG_V = window.innerHeight / 36;
const AIM_MOVE_LIMIT_X = window.innerWidth * 0.42;
const AIM_MOVE_LIMIT_Y = window.innerHeight * 0.30;

// Exponential smoothing factor for orientation (lower = smoother, less shake)
const ORIENT_SMOOTH = 0.08;

/* =========================
   STATE
========================= */

let score = 0;
let timeLeft = GAME_DURATION;
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
    smoothGamma += ORIENT_SMOOTH * (rawGamma - smoothGamma);
    smoothBeta  += ORIENT_SMOOTH * (rawBeta  - smoothBeta);

    repositionChilies();
    orientLoopId = requestAnimationFrame(loop);
  }

  orientLoopId = requestAnimationFrame(loop);
}

function repositionChilies() {
  if (baseGamma === null) return;

  updateAimMarker();
  autoCollectChiliByMarker();
}

function updateAimMarker() {
  const target = document.querySelector(".aim-area");

  if (!target || baseGamma === null || baseBeta === null) return;

  const startX = window.innerWidth / 2;
  const startY = window.innerHeight * 0.46;
  const offsetX = clamp((smoothGamma - baseGamma) * PX_PER_DEG_H, -AIM_MOVE_LIMIT_X, AIM_MOVE_LIMIT_X);
  const offsetY = clamp((smoothBeta - baseBeta) * PX_PER_DEG_V, -AIM_MOVE_LIMIT_Y, AIM_MOVE_LIMIT_Y);

  target.style.left = `${startX + offsetX}px`;
  target.style.top = `${startY + offsetY}px`;
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

  startOrientationTracking();
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
  timeLeft = GAME_DURATION;
  scoreSaved = false;

  scoreText.textContent = score;
  timerText.textContent = timeLeft;
  finalScoreText.textContent = score;

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.remove("hidden");

  gameArea.innerHTML = "";
  resetAimMarker();

  clearInterval(timerInterval);
  clearSpawnTimers();
}

function runTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!gameRunning) return;

    timeLeft--;

    if (timeLeft < 0) {
      timeLeft = 0;
    }

    timerText.textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function runSpawner() {
  clearSpawnTimers();
  scheduleNextChili(600, true);
}

function scheduleNextChili(delay, nearView = false) {
  spawnTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  spawnTimeouts = [];

  const timeoutId = setTimeout(() => {
    spawnTimeouts = spawnTimeouts.filter((id) => id !== timeoutId);
    if (gameRunning) spawnChili(nearView);
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

  finalScoreText.textContent = score;

  scoreSaved = false;
  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.remove("hidden");
  startPlayAgainCooldown();

  loadLeaderboard();

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
  timeLeft = GAME_DURATION;
  scoreSaved = false;

  scoreText.textContent = score;
  timerText.textContent = timeLeft;
  finalScoreText.textContent = score;

  topFiveInfo.classList.add("hidden");
  saveScoreBtn.classList.remove("hidden");
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
  const size  = randomNumber(60, 92);
  const hs    = size / 2;
  // depth: 0.45 = far/small/dark, 1.2 = near/big/bright
  const depth = randF(0.45, 1.2);

  const chili = document.createElement("img");
  chili.src       = "assets/images/chili-green.png";
  chili.className = "chili";
  chili.alt       = "Green Chili";
  chili.style.width  = `${size}px`;
  chili.style.rotate = `${randomNumber(-35, 35)}deg`;
  chili.style.zIndex = Math.round(depth * 10);
  chili.dataset.caught = "false";
  chili.dataset.hs     = hs;
  chili.dataset.depth  = depth.toFixed(3);

  const topLimit    = 160;
  const bottomLimit = window.innerHeight - 200;
  const leftLimit   = 20;
  const rightLimit  = window.innerWidth - size - 20;

  if (bottomLimit <= topLimit || rightLimit <= leftLimit) return;

  chili.style.left = `${randomNumber(leftLimit, rightLimit)}px`;
  chili.style.top  = `${randomNumber(topLimit,  bottomLimit)}px`;

  chili.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (!gameRunning || chili.dataset.caught === "true") return;
    const rect = chili.getBoundingClientRect();
    collectChili(chili, rect.left, rect.top);
  });

  gameArea.appendChild(chili);

  // Apply depth-based 3D illusion after spawn pop animation completes
  setTimeout(() => {
    if (!chili.parentElement) return;
    const brightness  = (0.78 + depth * 0.22).toFixed(2);
    const saturate    = (0.80 + depth * 0.25).toFixed(2);
    const shadowY     = Math.round(depth * 14);
    const shadowBlur  = Math.round(depth * 20);
    const shadowAlpha = (0.18 + depth * 0.45).toFixed(2);
    chili.style.scale     = depth.toFixed(3);
    chili.style.filter    = `brightness(${brightness}) saturate(${saturate}) drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha}))`;
  }, 300);

  const duration = randomNumber(CHILI_LIFETIME_MIN, CHILI_LIFETIME_MAX);
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

function autoCollectChiliByMarker() {
  if (!gameRunning) return;

  const targetHit = findChiliInMarker();

  if (targetHit) {
    collectChili(targetHit.chili, targetHit.x, targetHit.y);
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

  chilies.forEach((chili) => {
    if (chili.dataset.caught === "true") return;

    const chiliRect = chili.getBoundingClientRect();
    const chiliCenterX = chiliRect.left + chiliRect.width / 2;
    const chiliCenterY = chiliRect.top + chiliRect.height / 2;

    const distance = getDistance(targetCenterX, targetCenterY, chiliCenterX, chiliCenterY);

    if (distance <= catchRadius && distance < closestDist) {
      closestDist = distance;
      closestChili = chili;
      closestX = chiliRect.left;
      closestY = chiliRect.top;
    }
  });

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

  score++;
  scoreText.textContent = score;

  createHitEffect(x, y);
  createPlusOne(x, y);

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
    const result = await fetchJson(GET_LEADERBOARD_API);

    if (!result.success) {
      renderLeaderboard([]);
      return;
    }

    renderLeaderboard(result.leaderboard || []);
  } catch (error) {
    console.error("Leaderboard error:", error);
    renderLeaderboard([]);
  }
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

/* =========================
   SAVE SCORE API
========================= */

function openSaveScoreModal() {
  modalScoreText.textContent = score;
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

async function submitScore() {
  const playerName = playerNameInput.value.trim();
  const playerEmail = playerEmailInput.value.trim().toLowerCase();

  if (playerName === "") {
    saveMessage.textContent = "Please enter your name.";
    saveMessage.className = "save-message error";
    return;
  }

  if (playerEmail === "") {
    saveMessage.textContent = "Please enter your email.";
    saveMessage.className = "save-message error";
    return;
  }

  if (!isValidEmail(playerEmail)) {
    saveMessage.textContent = "Please enter a valid email address.";
    saveMessage.className = "save-message error";
    return;
  }

  submitScoreBtn.disabled = true;
  submitScoreBtn.textContent = "Saving...";

  saveMessage.textContent = "";
  saveMessage.className = "save-message";

  try {
    const result = await fetchJson(SAVE_SCORE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: playerName,
        email: playerEmail,
        score: Number(score)
      })
    });

    if (!result.success) {
      saveMessage.textContent = result.message || "Failed to save score.";
      saveMessage.className = "save-message error";
      return;
    }

    scoreSaved = true;

    if (result.email_sent) {
      saveMessage.textContent = "Score saved! Please check your email for your QR Code.";
    } else {
      saveMessage.textContent = "Score saved, but email could not be sent. Please contact the game admin.";
    }

    saveMessage.className = "save-message success";

    saveScoreBtn.classList.add("hidden");

    if (result.is_top_five) {
      topFiveInfo.textContent = "Your score made it into the Top 5!";
      topFiveInfo.classList.remove("hidden");
    } else {
      topFiveInfo.classList.add("hidden");
    }

    await loadLeaderboard();

    setTimeout(() => {
      closeSaveScoreModal();
    }, 1200);
  } catch (error) {
    console.error("Save score error:", error);
    saveMessage.textContent = error.message || "Connection error. Please try again.";
    saveMessage.className = "save-message error";
  } finally {
    submitScoreBtn.disabled = false;
    submitScoreBtn.textContent = "Save";
  }
}

/* =========================
   SHARE SCORE IMAGE
========================= */

async function shareScoreImage() {
  try {
    const imageBlob = await createScoreImageBlob(score);

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
        text: `I collected ${score} green chilies in Green Chili Hunt!`,
        files: [file]
      });

      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Green Chili Hunt Score",
        text: `I collected ${score} green chilies in Green Chili Hunt!`
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
    ctx.fillText("My Final Score", 540, 545);

    ctx.font = "900 230px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(scoreValue.toString(), 540, 815);

    drawChiliIcon(ctx, 540, 1065);

    ctx.font = "500 44px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    ctx.fillText("Can you beat my score?", 540, 1290);

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
