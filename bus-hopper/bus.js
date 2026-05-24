(function () {
const BUS_COLORS = ["#ffd23f", "#ffc33a", "#ffe066", "#ffb84d"];
const LANE_Y = [286, 360, 434];
const MAX_SAFE_GAP = 165;
const MIN_READABLE_GAP = 95;
const BUS_VARIANTS = [
  { windows: 1, width: 150 },
  { windows: 2, width: 205 },
  { windows: 3, width: 260 },
  { windows: 4, width: 315 },
  { windows: 5, width: 370 }
];

function createStartingBuses() {
  return [
    createBus(70, LANE_Y[1], BUS_VARIANTS[3], 0, 0),
    createBus(505, LANE_Y[1], BUS_VARIANTS[2], 0, 1),
    createBus(910, LANE_Y[0], BUS_VARIANTS[4], 0, 2)
  ];
}

function createBus(x, y, variant, difficulty, index) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const speed = direction * randomBetween(4 + difficulty * 0.4, 11 + difficulty * 0.8);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    x,
    homeX: x,
    y,
    width: variant.width,
    height: 72,
    windows: variant.windows,
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

    const laneLeft = bus.homeX - 22;
    const laneRight = bus.homeX + 22;
    if (bus.x < laneLeft || bus.x > laneRight) {
      bus.velocityX *= -1;
      bus.x = Math.max(laneLeft, Math.min(laneRight, bus.x));
    }

    if (Math.abs(bus.velocityX) > 0) {
      bus.velocityX = Math.sign(bus.velocityX) * Math.min(Math.abs(bus.velocityX), 18 + difficulty);
    }
  }
}

function ensureFutureBuses(buses, farthestX, difficulty) {
  buses.sort((a, b) => a.homeX - b.homeX);
  let lastBus = buses[buses.length - 1];
  let rightEdge = lastBus ? lastBus.homeX + lastBus.width : farthestX;
  let lastLane = lastBus ? lastBus.laneIndex : 1;
  const spawnUntil = farthestX + 860;

  while (rightEdge < spawnUntil && buses.length < 8) {
    const lane = chooseNextLane(lastLane);
    const variant = chooseBusVariant(lastLane, lane, difficulty);
    const gap = chooseReachableGap(lastLane, lane, difficulty, variant);
    const bus = createBus(rightEdge + gap, LANE_Y[lane], variant, difficulty, buses.length);
    buses.push(bus);
    lastLane = lane;
    rightEdge = bus.homeX + bus.width;
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
  context.font = `${bus.windows <= 1 ? 13 : 16}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(bus.windows <= 1 ? "BUS" : "SCHOOL", screenX + 20, y + 18);

  context.fillStyle = "#c7f2ff";
  for (let i = 0; i < bus.windows; i += 1) {
    const startX = screenX + Math.max(60, bus.width - bus.windows * 44 - 16);
    roundRect(context, startX + i * 44, y + 13, 32, 24, 6);
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

function chooseNextLane(lastLane) {
  const nearbyLane = Math.random() < 0.78
    ? [lastLane - 1, lastLane + 1].filter((lane) => lane >= 0 && lane < LANE_Y.length)
    : [0, 1, 2].filter((lane) => lane !== lastLane);
  const options = nearbyLane.length > 0 ? nearbyLane : [lastLane];
  return options[Math.floor(Math.random() * options.length)];
}

function chooseReachableGap(fromLane, toLane, difficulty, nextVariant) {
  const verticalChange = LANE_Y[toLane] - LANE_Y[fromLane];
  const isUphill = verticalChange < 0;
  const isBigLaneChange = Math.abs(toLane - fromLane) > 1;

  let maxGap = MAX_SAFE_GAP - difficulty * 2;
  let minGap = 105;

  if (isUphill) {
    maxGap -= 28;
    minGap -= 12;
  }

  if (isBigLaneChange) {
    maxGap -= 30;
  }

  if (nextVariant.windows <= 2) {
    maxGap -= 24;
    minGap -= 10;
  }

  if (nextVariant.windows === 1) {
    maxGap -= 18;
  }

  maxGap = Math.max(MIN_READABLE_GAP + 35, maxGap);
  minGap = Math.max(MIN_READABLE_GAP, Math.min(minGap, maxGap - 25));

  return randomBetween(minGap, maxGap);
}

function chooseBusVariant(fromLane, toLane, difficulty) {
  const verticalChange = LANE_Y[toLane] - LANE_Y[fromLane];
  const isUphill = verticalChange < 0;
  const earlyGame = difficulty < 2.5;
  const candidates = BUS_VARIANTS.filter((variant) => {
    if (isUphill) return variant.windows >= 3;
    if (earlyGame) return variant.windows >= 2;
    return true;
  });
  return candidates[Math.floor(Math.random() * candidates.length)];
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
