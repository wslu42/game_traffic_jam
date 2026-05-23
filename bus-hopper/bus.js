(function () {
const BUS_COLORS = ["#ffd23f", "#ffc33a", "#ffe066", "#ffb84d"];
const LANE_Y = [286, 360, 434];

function createStartingBuses() {
  return [
    createBus(70, LANE_Y[1], 260, 0, 0),
    createBus(430, LANE_Y[0], 245, 0, 1),
    createBus(780, LANE_Y[2], 270, 0, 2)
  ];
}

function createBus(x, y, width, difficulty, index) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const speed = direction * randomBetween(12 + difficulty * 5, 58 + difficulty * 12);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    x,
    y,
    width,
    height: 72,
    velocityX: index === 0 ? 0 : speed,
    color: BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)],
    laneIndex: LANE_Y.indexOf(y),
    wobble: Math.random() * Math.PI * 2
  };
}

function updateBuses(buses, deltaSeconds, cameraX, difficulty) {
  for (const bus of buses) {
    bus.x += bus.velocityX * deltaSeconds;
    bus.wobble += deltaSeconds * 3;

    const laneLeft = cameraX - 220;
    const laneRight = cameraX + 1320;
    if (bus.x < laneLeft || bus.x + bus.width > laneRight) {
      bus.velocityX *= -1;
      bus.x = Math.max(laneLeft, Math.min(laneRight - bus.width, bus.x));
    }

    if (Math.abs(bus.velocityX) > 0) {
      bus.velocityX += Math.sign(bus.velocityX) * deltaSeconds * difficulty * 1.2;
    }
  }
}

function ensureFutureBuses(buses, farthestX, difficulty) {
  let rightEdge = buses.reduce((max, bus) => Math.max(max, bus.x + bus.width), farthestX);
  while (rightEdge < farthestX + 1280) {
    const gap = randomBetween(
      Math.max(120, 230 - difficulty * 10),
      Math.max(230, 390 - difficulty * 8)
    );
    const width = randomBetween(210, Math.max(230, 290 - difficulty * 4));
    const lane = Math.floor(Math.random() * LANE_Y.length);
    const bus = createBus(rightEdge + gap, LANE_Y[lane], width, difficulty, buses.length);
    buses.push(bus);
    rightEdge = bus.x + bus.width;
  }
}

function removeOldBuses(buses, cameraX) {
  return buses.filter((bus) => bus.x + bus.width > cameraX - 420);
}

function drawBus(context, bus, cameraX) {
  const screenX = bus.x - cameraX;
  const bob = Math.sin(bus.wobble) * 1.4;
  const y = bus.y + bob;

  context.fillStyle = "rgba(23, 48, 75, 0.18)";
  roundRect(context, screenX + 18, y + bus.height - 3, bus.width - 36, 17, 9);
  context.fill();

  context.fillStyle = bus.color;
  roundRect(context, screenX, y, bus.width, bus.height, 14);
  context.fill();

  context.fillStyle = "#f7b42c";
  roundRect(context, screenX + 18, y - 20, bus.width * 0.42, 28, 10);
  context.fill();

  context.fillStyle = "#17304b";
  context.font = "900 16px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("SCHOOL", screenX + 25, y + 18);

  context.fillStyle = "#c7f2ff";
  const windowCount = Math.max(3, Math.floor(bus.width / 62));
  for (let i = 0; i < windowCount; i += 1) {
    roundRect(context, screenX + 88 + i * 48, y + 13, 34, 24, 6);
    context.fill();
  }

  context.fillStyle = "#17304b";
  context.fillRect(screenX + 8, y + 44, bus.width - 16, 6);

  drawWheel(context, screenX + 45, y + 68);
  drawWheel(context, screenX + bus.width - 45, y + 68);
}

function drawWheel(context, x, y) {
  context.fillStyle = "#17304b";
  context.beginPath();
  context.arc(x, y, 17, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d8e7ef";
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fill();
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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

window.BusHopperBus = {
  LANE_Y,
  createStartingBuses,
  updateBuses,
  ensureFutureBuses,
  removeOldBuses,
  drawBus
};
}());
