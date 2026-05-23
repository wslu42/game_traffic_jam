(function () {
const { GAME_HEIGHT, GAME_WIDTH, LANE_COUNT, MAX_SPEED, state, WIN_DISTANCE } = window.TrafficDash;
const ROAD_WIDTH = GAME_WIDTH * 0.68;
const ROAD_LEFT = (GAME_WIDTH - ROAD_WIDTH) / 2;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const PLAYER_Y = GAME_HEIGHT - 172;

function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    draw() {
      context.save();
      if (state.shakeTimer > 0) {
        context.translate(Math.sin(performance.now() / 22) * 4, 0);
      }
      drawScene(context);
      context.restore();
    }
  };
}

function updateHud(elements) {
  elements.distanceValue.textContent = `${state.distance.toFixed(2)} mi`;
  elements.speedValue.textContent = `${state.speed} / ${MAX_SPEED}`;
  elements.patienceValue.textContent = `${Math.ceil(state.patience)}`;
  elements.statusValue.textContent = state.status;

  if (state.mode === "won" || state.mode === "lost") {
    elements.overlay.classList.remove("overlay--hidden");
    elements.overlayBadge.textContent = state.mode === "won" ? "Arrived" : "Traffic Jam";
    elements.overlayTitle.textContent = state.mode === "won" ? "You Win!" : "Try Again";
    elements.overlayText.textContent = state.mode === "won"
      ? "You reached 10 miles with patience to spare."
      : "Your patience hit 0 before the road opened up.";
  } else {
    elements.overlay.classList.add("overlay--hidden");
  }
}

function drawScene(context) {
  drawBackground(context);
  drawRoad(context);
  drawRoadsideDetails(context);
  drawTraffic(context);
  drawItems(context);
  drawPlayer(context);
  drawWeather(context);
  drawDistanceRibbon(context);
}

function drawBackground(context) {
  const sky = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  sky.addColorStop(0, "#8ee7ff");
  sky.addColorStop(0.58, "#d9f8ff");
  sky.addColorStop(0.58, "#56c96f");
  sky.addColorStop(1, "#36a85c");
  context.fillStyle = sky;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawCloud(context, 80, 92, 1);
  drawCloud(context, 440, 150, 0.82);
  drawHill(context, -80, 520, 260, "#6bd178");
  drawHill(context, 342, 500, 290, "#46b96a");
}

function drawRoad(context) {
  context.fillStyle = "#384656";
  roundRect(context, ROAD_LEFT - 18, -20, ROAD_WIDTH + 36, GAME_HEIGHT + 40, 28);
  context.fill();

  context.fillStyle = "#586575";
  roundRect(context, ROAD_LEFT, -20, ROAD_WIDTH, GAME_HEIGHT + 40, 26);
  context.fill();

  context.fillStyle = "#ffd34e";
  context.fillRect(ROAD_LEFT + 18, 0, 10, GAME_HEIGHT);
  context.fillRect(ROAD_LEFT + ROAD_WIDTH - 28, 0, 10, GAME_HEIGHT);

  for (let lane = 1; lane < LANE_COUNT; lane += 1) {
    const x = ROAD_LEFT + LANE_WIDTH * lane;
    drawDashedLaneLine(context, x);
  }
}

function drawDashedLaneLine(context, x) {
  context.fillStyle = "rgba(255, 255, 255, 0.84)";
  const dashHeight = 52;
  const gap = 44;
  for (let y = -dashHeight + state.roadOffset; y < GAME_HEIGHT + dashHeight; y += dashHeight + gap) {
    roundRect(context, x - 5, y, 10, dashHeight, 5);
    context.fill();
  }
}

function drawRoadsideDetails(context) {
  const offset = state.roadOffset;
  for (let y = -80 + offset; y < GAME_HEIGHT + 100; y += 165) {
    drawTree(context, 52, y);
    drawTree(context, 492, y + 74);
  }
}

function drawTraffic(context) {
  for (const vehicle of state.traffic) {
    const x = laneCenter(vehicle.lane);
    drawVehicle(context, x, vehicle.y, vehicle.width, vehicle.height, vehicle.color, vehicle.emoji, false, vehicle.wobble);
  }
}

function drawItems(context) {
  for (const item of state.items) {
    const x = laneCenter(item.lane);
    if (item.type === "coffee") {
      drawCoffee(context, x, item.y, item.spin);
    } else {
      drawCone(context, x, item.y);
    }
  }
}

function drawPlayer(context) {
  const x = laneCenter(state.lane);
  const bump = state.playerBumpTimer > 0 ? Math.sin(performance.now() / 28) * 4 : 0;
  drawVehicle(context, x + bump, PLAYER_Y, 76, 108, "#ff615c", "🚘", true, 0);
}

function drawVehicle(context, x, y, width, height, color, emoji, isPlayer, wobble) {
  const tilt = Math.sin(wobble) * 1.4;
  context.save();
  context.translate(x, y);
  context.rotate((tilt * Math.PI) / 180);

  context.fillStyle = "rgba(18, 42, 62, 0.24)";
  roundRect(context, -width / 2 + 5, height / 2 - 8, width - 10, 20, 10);
  context.fill();

  context.fillStyle = color;
  roundRect(context, -width / 2, -height / 2, width, height, 18);
  context.fill();

  context.fillStyle = isPlayer ? "#fff6b8" : "#d9f8ff";
  roundRect(context, -width * 0.32, -height * 0.3, width * 0.64, height * 0.28, 10);
  context.fill();

  context.fillStyle = "#263847";
  roundRect(context, -width * 0.39, height * 0.24, width * 0.22, height * 0.16, 8);
  context.fill();
  roundRect(context, width * 0.17, height * 0.24, width * 0.22, height * 0.16, 8);
  context.fill();

  context.font = `${Math.floor(width * 0.43)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, 0, 2);

  context.restore();
}

function drawCoffee(context, x, y, spin) {
  context.save();
  context.translate(x, y);
  context.rotate(Math.sin(spin) * 0.18);
  context.fillStyle = "rgba(18, 42, 62, 0.2)";
  context.beginPath();
  context.ellipse(4, 31, 24, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fffdf5";
  roundRect(context, -18, -18, 36, 42, 8);
  context.fill();
  context.strokeStyle = "#8a5a2b";
  context.lineWidth = 5;
  context.strokeRect(18, -8, 13, 18);
  context.fillStyle = "#8a5a2b";
  context.fillRect(-12, -10, 24, 9);
  context.fillStyle = "#ff7aa8";
  context.font = "24px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("+", 0, 13);
  context.restore();
}

function drawCone(context, x, y) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(18, 42, 62, 0.18)";
  context.beginPath();
  context.ellipse(4, 30, 26, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ff8a2a";
  context.beginPath();
  context.moveTo(0, -28);
  context.lineTo(25, 24);
  context.lineTo(-25, 24);
  context.closePath();
  context.fill();
  context.fillStyle = "#fffdf5";
  context.fillRect(-12, 2, 24, 7);
  context.fillStyle = "#d65d16";
  roundRect(context, -30, 22, 60, 12, 5);
  context.fill();
  context.restore();
}

function drawWeather(context) {
  if (state.weather === "cloudy") {
    context.fillStyle = "rgba(255, 255, 255, 0.24)";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  if (state.weather === "drizzle") {
    context.strokeStyle = "rgba(255, 255, 255, 0.44)";
    context.lineWidth = 2;
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 67 + state.roadOffset * 2) % GAME_WIDTH;
      const y = (i * 97 + state.roadOffset * 5) % GAME_HEIGHT;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - 10, y + 24);
      context.stroke();
    }
  }
}

function drawDistanceRibbon(context) {
  const progress = Math.min(1, state.distance / WIN_DISTANCE);
  context.fillStyle = "rgba(255, 253, 245, 0.92)";
  roundRect(context, 28, 24, GAME_WIDTH - 56, 28, 8);
  context.fill();
  context.fillStyle = "#34c759";
  roundRect(context, 34, 30, (GAME_WIDTH - 68) * progress, 16, 6);
  context.fill();
  context.fillStyle = "#14324a";
  context.font = "800 15px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("10 mile picnic stop", GAME_WIDTH / 2, 38);
}

function drawCloud(context, x, y, scale) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = "rgba(255, 255, 255, 0.86)";
  context.beginPath();
  context.arc(-35, 9, 26, 0, Math.PI * 2);
  context.arc(-8, -4, 33, 0, Math.PI * 2);
  context.arc(28, 8, 27, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHill(context, x, y, radius, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, Math.PI, Math.PI * 2);
  context.lineTo(x + radius, GAME_HEIGHT);
  context.lineTo(x - radius, GAME_HEIGHT);
  context.closePath();
  context.fill();
}

function drawTree(context, x, y) {
  context.fillStyle = "#7a4d24";
  roundRect(context, x - 7, y + 18, 14, 38, 5);
  context.fill();
  context.fillStyle = "#1f9b5f";
  context.beginPath();
  context.arc(x, y + 8, 28, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#34c759";
  context.beginPath();
  context.arc(x - 13, y, 21, 0, Math.PI * 2);
  context.arc(x + 14, y - 1, 21, 0, Math.PI * 2);
  context.fill();
}

function laneCenter(lane) {
  return ROAD_LEFT + LANE_WIDTH * (lane + 0.5);
}

function roundRect(context, x, y, width, height, radius) {
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

window.TrafficDashRender = {
  createRenderer,
  updateHud
};
}());
