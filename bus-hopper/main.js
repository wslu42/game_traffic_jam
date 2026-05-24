(function () {
const { lerp, rectsOverlap, resolvePlatformLanding } = window.BusHopperPhysics;
const { createStartingBuses, updateBuses, ensureFutureBuses, removeOldBuses, drawBus } = window.BusHopperBus;
const { createPlayer, updatePlayer, drawPlayer } = window.BusHopperPlayer;

const WIDTH = 960;
const HEIGHT = 540;
const GAME_SPEED_SCALE = 1;
const FINISH_SCORE = 650;
const FINISH_X = FINISH_SCORE * 8;
const elements = {
  canvas: document.querySelector("#gameCanvas"),
  scoreValue: document.querySelector("#scoreValue"),
  bestValue: document.querySelector("#bestValue"),
  modeValue: document.querySelector("#modeValue"),
  modeButton: document.querySelector("#modeButton"),
  muteButton: document.querySelector("#muteButton"),
  restartButton: document.querySelector("#restartButton"),
  playButton: document.querySelector("#playButton"),
  jumpButton: document.querySelector("#jumpButton"),
  overlay: document.querySelector("#overlay"),
  overlayKicker: document.querySelector("#overlayKicker"),
  overlayTitle: document.querySelector("#overlayTitle"),
  overlayText: document.querySelector("#overlayText")
};

const context = setupCanvas(elements.canvas);
const audio = createAudio();
let game = createGame();
let lastFrame = performance.now();
let lastJumpInputTime = 0;

setupControls();
requestAnimationFrame(loop);

function createGame() {
  const buses = createStartingBuses();
  const player = createPlayer();
  player.landOn(buses[0]);
  const best = readBestScore();
  return {
    mode: "title",
    lateMode: false,
    player,
    buses,
    cameraX: 0,
    score: 0,
    best,
    difficulty: 0,
    birds: [],
    nextBirdX: 900,
    particles: [],
    principalX: -180,
    muted: false,
    message: "Jump between buses, dodge birds, and reach school."
  };
}

function startGame() {
  const lateMode = game.lateMode;
  const muted = game.muted;
  const best = game.best;
  game = createGame();
  game.mode = "playing";
  game.lateMode = lateMode;
  game.muted = muted;
  game.best = best;
  elements.overlay.classList.add("is-hidden");
  updateModeButton();
}

function loop(now) {
  const deltaSeconds = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;

  if (game.mode === "playing") {
    update(deltaSeconds * GAME_SPEED_SCALE);
  }

  draw();
  updateHud();
  requestAnimationFrame(loop);
}

function update(deltaSeconds) {
  const previousBottom = game.player.y + game.player.height;
  const currentPlatform = game.buses.find((bus) => bus.id === game.player.platformId);

  game.difficulty = Math.min(12, game.score / 450);
  updateBuses(game.buses, deltaSeconds, game.cameraX, game.difficulty);
  updatePlayer(game.player, deltaSeconds, currentPlatform, game.difficulty);

  if (currentPlatform && !isPlayerAboveBus(game.player, currentPlatform)) {
    game.player.leaveGround();
  }

  if (!game.player.grounded) {
    for (const bus of game.buses) {
      if (resolvePlatformLanding(game.player, bus, previousBottom)) {
        makeParticles(game.player.x + game.player.width / 2, bus.y, "#fff3a7", 10);
        if (game.player.consumeBufferedJump()) {
          makeParticles(game.player.x + game.player.width / 2, game.player.y + game.player.height, "#ffffff", 8);
          audio.play("jump");
        }
        break;
      }
    }
  }

  const targetCamera = game.player.x - 270;
  game.cameraX = lerp(game.cameraX, targetCamera, Math.min(1, deltaSeconds * 3.8));
  ensureFutureBuses(game.buses, game.cameraX + WIDTH, game.difficulty);
  game.buses = removeOldBuses(game.buses, game.cameraX);

  game.score = Math.max(game.score, Math.floor(game.player.x / 8));
  updateBirds(deltaSeconds);
  updateParticles(deltaSeconds);
  updatePrincipal(deltaSeconds);
  checkBirdCollisions();

  if (game.player.y > HEIGHT + 80) {
    endGame("Game Over", "You slipped into traffic. Try another hop!");
  } else if (game.player.x >= FINISH_X) {
    makeCelebrationParticles(FINISH_X, 230);
    endGame("You Made It!", "You reached school before the bell finished ringing.", "win");
  }
}

function updateBirds(deltaSeconds) {
  while (game.nextBirdX < game.cameraX + WIDTH + 650 && game.nextBirdX < FINISH_X - 450) {
    game.birds.push(createBird(game.nextBirdX));
    game.nextBirdX += randomBetween(760, 1020);
  }

  for (const bird of game.birds) {
    bird.x += bird.velocityX * deltaSeconds;
    bird.wingTime += deltaSeconds * 9;
  }

  game.birds = game.birds.filter((bird) => bird.x > game.cameraX - 180);
}

function createBird(x) {
  return {
    x,
    y: randomBetween(112, 238),
    width: 48,
    height: 30,
    velocityX: randomBetween(-52, -34),
    wingTime: Math.random() * Math.PI * 2
  };
}

function checkBirdCollisions() {
  const playerRect = {
    x: game.player.x + 8,
    y: game.player.y + 5,
    width: game.player.width - 16,
    height: game.player.height - 10
  };

  for (const bird of game.birds) {
    const birdRect = {
      x: bird.x - bird.width / 2,
      y: bird.y - bird.height / 2,
      width: bird.width,
      height: bird.height
    };

    if (rectsOverlap(playerRect, birdRect)) {
      makeParticles(game.player.x + game.player.width / 2, game.player.y + 18, "#ffe066", 14);
      endGame("Bird Bonk!", "A hallway bird crossed your route. Try a lower hop!");
      return;
    }
  }
}

function updatePrincipal(deltaSeconds) {
  if (!game.lateMode) return;

  const chaseSpeed = 92 + game.difficulty * 11 + Math.max(0, game.player.idleTimer - 0.4) * 110;
  game.principalX += chaseSpeed * deltaSeconds;
  game.principalX = Math.min(game.principalX, game.player.x - 36);

  if (game.player.x - game.principalX < 42) {
    endGame("Caught!", "The principal caught you waiting around.");
  }
}

function endGame(title, text, soundName = "gameover") {
  if (game.mode !== "playing") return;
  game.mode = "gameover";
  game.best = Math.max(game.best, game.score);
  writeBestScore(game.best);
  elements.overlay.classList.remove("is-hidden");
  elements.overlayKicker.textContent = soundName === "win" ? "At school" : "Bell rings";
  elements.overlayTitle.textContent = title;
  elements.overlayText.textContent = `${text} Score: ${game.score}`;
  elements.playButton.textContent = "Play Again";
  if (soundName === "win") {
    elements.overlay.classList.add("overlay--win");
  } else {
    elements.overlay.classList.remove("overlay--win");
  }
  audio.play(soundName);
}

function jump() {
  if (game.mode !== "playing") {
    startGame();
  }

  if (game.player.requestJump()) {
    makeParticles(game.player.x + game.player.width / 2, game.player.y + game.player.height, "#ffffff", 8);
    audio.play("jump");
  }
}

function jumpFromButton(event) {
  event.preventDefault();
  const now = performance.now();
  if (now - lastJumpInputTime < 90) return;
  lastJumpInputTime = now;
  jump();
}

function setupControls() {
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      jump();
    }
    if (event.key === "Enter" && game.mode !== "playing") {
      startGame();
    }
  });

  elements.playButton.addEventListener("click", startGame);
  elements.restartButton.addEventListener("click", () => {
    startGame();
    elements.restartButton.blur();
  });
  elements.restartButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startGame();
    elements.restartButton.blur();
  });
  elements.jumpButton.addEventListener("pointerdown", jumpFromButton);
  elements.jumpButton.addEventListener("touchstart", jumpFromButton, { passive: false });
  elements.jumpButton.addEventListener("click", jumpFromButton);
  elements.canvas.addEventListener("pointerdown", jumpFromButton);
  elements.canvas.addEventListener("touchstart", jumpFromButton, { passive: false });

  elements.modeButton.addEventListener("click", () => {
    game.lateMode = !game.lateMode;
    updateModeButton();
  });

  elements.muteButton.addEventListener("click", () => {
    game.muted = !game.muted;
    elements.muteButton.textContent = game.muted ? "🔇" : "🔊";
    elements.muteButton.setAttribute("aria-pressed", String(game.muted));
  });
}

window.BusHopperPressJump = jumpFromButton;

function updateModeButton() {
  elements.modeValue.textContent = game.lateMode ? "Late" : "Normal";
  elements.modeButton.textContent = game.lateMode ? "Normal Mode" : "Late Mode";
}

function updateHud() {
  elements.scoreValue.textContent = String(game.score);
  elements.bestValue.textContent = String(game.best);
  elements.modeValue.textContent = game.lateMode ? "Late" : "Normal";
}

function draw() {
  drawBackground();
  drawSchoolScene();
  drawTrafficLanes();
  drawFinishLine();
  for (const bus of game.buses) {
    drawBus(context, bus, game.cameraX);
  }
  drawBirds();
  drawParticles();
  if (game.lateMode) {
    drawPrincipal();
  }
  drawPlayer(context, game.player, game.cameraX);
  drawDifficultyRibbon();
}

function drawBackground() {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#8ee7ff");
  sky.addColorStop(0.62, "#d8f8ff");
  sky.addColorStop(0.62, "#54cd70");
  sky.addColorStop(1, "#34a85d");
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawCloud(118 - (game.cameraX * 0.12) % 1160, 76, 1);
  drawCloud(680 - (game.cameraX * 0.08) % 1160, 122, 0.82);

  for (let i = -1; i < 8; i += 1) {
    const x = i * 170 - (game.cameraX * 0.28) % 170;
    drawBuilding(x, 170, 92, 132, i);
  }
}

function drawTrafficLanes() {
  context.fillStyle = "#596775";
  context.fillRect(0, 350, WIDTH, 190);
  context.fillStyle = "#455360";
  context.fillRect(0, 470, WIDTH, 70);

  context.strokeStyle = "rgba(255, 255, 255, 0.7)";
  context.lineWidth = 6;
  context.setLineDash([34, 28]);
  context.lineDashOffset = -game.cameraX * 0.6;
  context.beginPath();
  context.moveTo(0, 410);
  context.lineTo(WIDTH, 410);
  context.stroke();
  context.setLineDash([]);

  for (let i = -2; i < 9; i += 1) {
    const x = i * 170 - (game.cameraX * 0.72) % 170;
    drawTinyTraffic(x, 497, i);
  }
}

function drawDifficultyRibbon() {
  context.fillStyle = "rgba(255, 253, 244, 0.9)";
  roundRect(20, 18, 220, 28, 8);
  context.fill();
  context.fillStyle = "#ff8f3d";
  roundRect(26, 24, Math.min(208, game.difficulty * 17), 16, 6);
  context.fill();
  context.fillStyle = "#17304b";
  context.font = "900 14px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("School rush meter", 130, 32);
}

function drawFinishLine() {
  const x = FINISH_X - game.cameraX;
  if (x < -80 || x > WIDTH + 180) return;

  context.fillStyle = "#fffdf4";
  roundRect(x - 30, 232, 60, 160, 8);
  context.fill();
  context.fillStyle = "#17304b";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      if ((row + col) % 2 === 0) {
        context.fillRect(x - 27 + col * 27, 238 + row * 18, 27, 18);
      }
    }
  }

  context.fillStyle = "#3478f6";
  roundRect(x - 104, 193, 208, 44, 8);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("WELCOME!", x, 215);
}

function drawSchoolScene() {
  const x = FINISH_X - game.cameraX;
  if (x < -460 || x > WIDTH + 260) return;

  context.fillStyle = "rgba(23, 48, 75, 0.14)";
  context.beginPath();
  context.ellipse(x + 165, 358, 245, 24, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffcf6e";
  roundRect(x + 22, 176, 286, 176, 10);
  context.fill();

  context.fillStyle = "#ffb84d";
  roundRect(x - 18, 226, 84, 126, 8);
  context.fill();
  roundRect(x + 264, 226, 84, 126, 8);
  context.fill();

  context.fillStyle = "#e65d5d";
  context.beginPath();
  context.moveTo(x + 12, 176);
  context.lineTo(x + 165, 98);
  context.lineTo(x + 318, 176);
  context.closePath();
  context.fill();

  context.fillStyle = "#fffdf4";
  roundRect(x + 93, 122, 144, 50, 8);
  context.fill();
  context.fillStyle = "#17304b";
  context.font = "900 22px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("SCHOOL", x + 165, 147);

  context.fillStyle = "#8ee7ff";
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      roundRect(x + 84 + col * 45, 202 + row * 44, 28, 26, 5);
      context.fill();
    }
  }

  context.fillStyle = "#734a2a";
  roundRect(x + 133, 278, 64, 74, 8);
  context.fill();
  context.fillStyle = "#ffd23f";
  context.beginPath();
  context.arc(x + 184, 315, 4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#34c759";
  roundRect(x - 66, 332, 470, 30, 8);
  context.fill();

  context.strokeStyle = "#17304b";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(x + 356, 164);
  context.lineTo(x + 356, 332);
  context.stroke();
  context.fillStyle = "#ff7ba6";
  context.beginPath();
  context.moveTo(x + 356, 166);
  context.lineTo(x + 420, 188);
  context.lineTo(x + 356, 210);
  context.closePath();
  context.fill();

  context.fillStyle = "#fffdf4";
  roundRect(x + 12, 366, 300, 38, 8);
  context.fill();
  context.fillStyle = "#17304b";
  context.font = "900 18px system-ui, sans-serif";
  context.fillText("Stage Clear: Made it to school!", x + 162, 385);
}

function drawBirds() {
  for (const bird of game.birds) {
    const x = bird.x - game.cameraX;
    const wing = Math.sin(bird.wingTime) * 9;

    context.save();
    context.translate(x, bird.y);
    context.fillStyle = "rgba(23, 48, 75, 0.16)";
    context.beginPath();
    context.ellipse(4, 26, 24, 7, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#17304b";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6, 1);
    context.quadraticCurveTo(-22, -18 - wing, -38, -2);
    context.moveTo(6, 1);
    context.quadraticCurveTo(22, -18 + wing, 38, -2);
    context.stroke();

    context.fillStyle = "#ffe066";
    context.beginPath();
    context.ellipse(0, 4, 18, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ff8f3d";
    context.beginPath();
    context.moveTo(-20, 2);
    context.lineTo(-34, -4);
    context.lineTo(-34, 8);
    context.closePath();
    context.fill();
    context.fillStyle = "#17304b";
    context.beginPath();
    context.arc(8, 0, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawPrincipal() {
  const x = game.principalX - game.cameraX;
  const y = 262;
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(23, 48, 75, 0.18)";
  context.beginPath();
  context.ellipse(24, 91, 28, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#4a3a7a";
  roundRect(8, 32, 32, 52, 8);
  context.fill();
  context.fillStyle = "#ffd8a8";
  context.beginPath();
  context.arc(24, 24, 16, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#17304b";
  context.fillRect(12, 12, 24, 6);
  context.font = "900 17px system-ui, sans-serif";
  context.fillText("!", 45, 22);
  context.restore();
}

function makeParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    game.particles.push({
      x,
      y,
      velocityX: randomBetween(-120, 120),
      velocityY: randomBetween(-260, -60),
      life: randomBetween(0.35, 0.7),
      maxLife: 0.7,
      color,
      size: randomBetween(3, 7)
    });
  }
}

function makeCelebrationParticles(x, y) {
  const colors = ["#ff7ba6", "#ffd23f", "#53c6ff", "#34c759", "#fffdf4"];
  for (let i = 0; i < 45; i += 1) {
    game.particles.push({
      x: x + randomBetween(-120, 120),
      y: y + randomBetween(-90, 60),
      velocityX: randomBetween(-190, 190),
      velocityY: randomBetween(-360, -80),
      life: randomBetween(0.8, 1.45),
      maxLife: 1.45,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: randomBetween(4, 8)
    });
  }
}

function updateParticles(deltaSeconds) {
  for (const particle of game.particles) {
    particle.x += particle.velocityX * deltaSeconds;
    particle.y += particle.velocityY * deltaSeconds;
    particle.velocityY += 900 * deltaSeconds;
    particle.life -= deltaSeconds;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  for (const particle of game.particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x - game.cameraX, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function isPlayerAboveBus(player, bus) {
  return player.x + player.width > bus.x + 8 && player.x < bus.x + bus.width - 8;
}

function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function createAudio() {
  let audioContext = null;

  function ensureContext() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  window.addEventListener("pointerdown", ensureContext, { once: true });
  window.addEventListener("keydown", ensureContext, { once: true });

  return {
    play(name) {
      if (game.muted) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const map = {
        jump: [620, 0.08, "triangle", 0.045],
        gameover: [120, 0.18, "sawtooth", 0.035],
        win: [820, 0.18, "triangle", 0.05]
      };
      const sound = map[name];
      if (!sound) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = sound[0];
      oscillator.type = sound[2];
      gain.gain.setValueAtTime(sound[3], ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound[1]);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + sound[1]);
    }
  };
}

function readBestScore() {
  try {
    return Number(localStorage.getItem("busHopperBest") || 0);
  } catch (error) {
    return 0;
  }
}

function writeBestScore(score) {
  try {
    localStorage.setItem("busHopperBest", String(score));
  } catch (error) {
    // Some private browsing modes block localStorage. The run can continue.
  }
}

function drawCloud(x, y, scale) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = "rgba(255, 255, 255, 0.84)";
  context.beginPath();
  context.arc(-38, 12, 27, 0, Math.PI * 2);
  context.arc(-7, -2, 35, 0, Math.PI * 2);
  context.arc(32, 13, 29, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBuilding(x, y, width, height, index) {
  context.fillStyle = index % 2 === 0 ? "#7ab7d9" : "#9cc6df";
  roundRect(x, y, width, height, 6);
  context.fill();
  context.fillStyle = "rgba(255, 253, 244, 0.72)";
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      context.fillRect(x + 18 + col * 34, y + 18 + row * 26, 14, 12);
    }
  }
}

function drawTinyTraffic(x, y, index) {
  context.fillStyle = index % 2 === 0 ? "#ff7ba6" : "#53c6ff";
  roundRect(x, y, 70, 28, 10);
  context.fill();
  context.fillStyle = "#17304b";
  context.beginPath();
  context.arc(x + 15, y + 27, 7, 0, Math.PI * 2);
  context.arc(x + 55, y + 27, 7, 0, Math.PI * 2);
  context.fill();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
}());
