(function () {
const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const LANE_COUNT = 3;
const WIN_DISTANCE = 10;
const MAX_SPEED = 5;
const STARTING_PATIENCE = 100;
const MAX_PATIENCE = 300;
const PATIENCE_PACK_RESTORE = 25;

const TRAFFIC_TYPES = [
  { emoji: "🚗", name: "car", width: 68, height: 92, color: "#ff7aa8" },
  { emoji: "🚙", name: "SUV", width: 76, height: 100, color: "#66d28f" },
  { emoji: "🚚", name: "truck", width: 82, height: 124, color: "#ffd34e" },
  { emoji: "🚌", name: "bus", width: 86, height: 138, color: "#4bb9ff" }
];

const MESSAGES = {
  ready: "Road trip begins",
  drive: "Cruising through traffic",
  close: "Careful, cars ahead",
  bump: "Tiny fender tap. Patience -20",
  coffee: "Patience pack! +25 patience",
  fastLane: "Bonus fast lane!",
  construction: "Construction zone ahead",
  win: "You made it to the picnic stop!",
  lose: "Patience ran out in traffic"
};

function makeInitialState() {
  return {
    lane: 1,
    targetLane: 1,
    speed: 1,
    patience: STARTING_PATIENCE,
    distance: 0,
    status: MESSAGES.ready,
    mode: "playing",
    traffic: [],
    items: [],
    weather: "sunny",
    weatherTimer: 12,
    spawnTimer: 0.8,
    itemTimer: 3.5,
    constructionTimer: 8,
    roadOffset: 0,
    playerBumpTimer: 0,
    statusTimer: 0,
    shakeTimer: 0,
    muted: false,
    soundQueue: [],
    touchRepeatTimer: 0,
    timeAlive: 0
  };
}

const state = makeInitialState();

function resetGame() {
  const muted = state.muted;
  Object.assign(state, makeInitialState(), { muted });
}

function setMuted(muted) {
  state.muted = muted;
}

function queueSound(name) {
  if (!state.muted) {
    state.soundQueue.push(name);
  }
}

function moveLane(direction) {
  if (state.mode !== "playing") return;
  const nextLane = clamp(state.targetLane + direction, 0, LANE_COUNT - 1);
  if (nextLane !== state.targetLane) {
    state.targetLane = nextLane;
    queueSound("lane");
  }
}

function changeSpeed(delta) {
  if (state.mode !== "playing") return;
  const nextSpeed = clamp(state.speed + delta, 1, MAX_SPEED);
  if (nextSpeed !== state.speed) {
    state.speed = nextSpeed;
    state.status = delta > 0 ? "Speeding up" : "Taking it easy";
    state.statusTimer = 1.1;
    queueSound(delta > 0 ? "fast" : "slow");
  }
}

function updateGame(deltaSeconds) {
  if (state.mode !== "playing") {
    state.soundQueue.length = 0;
    return;
  }

  state.timeAlive += deltaSeconds;
  state.lane = lerp(state.lane, state.targetLane, Math.min(1, deltaSeconds * 10));
  state.roadOffset = (state.roadOffset + deltaSeconds * (145 + state.speed * 95)) % 96;
  state.distance += deltaSeconds * state.speed * 0.014;

  state.spawnTimer -= deltaSeconds;
  state.itemTimer -= deltaSeconds;
  state.constructionTimer -= deltaSeconds;
  state.weatherTimer -= deltaSeconds;
  state.playerBumpTimer = Math.max(0, state.playerBumpTimer - deltaSeconds);
  state.shakeTimer = Math.max(0, state.shakeTimer - deltaSeconds);

  if (state.statusTimer > 0) {
    state.statusTimer -= deltaSeconds;
  } else {
    state.status = chooseAmbientStatus();
  }

  if (state.spawnTimer <= 0) {
    spawnTraffic();
  }

  if (state.itemTimer <= 0) {
    spawnCoffee();
  }

  if (state.constructionTimer <= 0) {
    spawnConstructionZone();
  }

  if (state.weatherTimer <= 0) {
    changeWeather();
  }

  updateTraffic(deltaSeconds);
  updateItems(deltaSeconds);
  checkTrafficCollisions();
  checkItemCollisions();
  checkEndConditions();
}

function updateTraffic(deltaSeconds) {
  const worldSpeed = 145 + state.speed * 105;
  for (const vehicle of state.traffic) {
    vehicle.y += deltaSeconds * (worldSpeed + vehicle.drift);
    vehicle.wobble += deltaSeconds * 5;
  }
  state.traffic = state.traffic.filter((vehicle) => vehicle.y < GAME_HEIGHT + 180 && !vehicle.remove);
}

function updateItems(deltaSeconds) {
  const worldSpeed = 145 + state.speed * 95;
  for (const item of state.items) {
    item.y += deltaSeconds * worldSpeed;
    item.spin += deltaSeconds * 4;
  }
  state.items = state.items.filter((item) => item.y < GAME_HEIGHT + 90 && !item.remove);
}

function spawnTraffic() {
  const density = Math.min(0.92, 0.34 + state.timeAlive / 95);
  const count = Math.random() < density * 0.42 ? 2 : 1;
  const openLanes = shuffle([0, 1, 2]);

  for (let i = 0; i < count; i += 1) {
    const lane = openLanes[i];
    if (hasRecentVehicleInLane(lane)) continue;

    const type = TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];
    state.traffic.push({
      id: cryptoRandomId(),
      lane,
      y: -160 - i * 110,
      width: type.width,
      height: type.height,
      emoji: type.emoji,
      color: type.color,
      name: type.name,
      drift: randomBetween(-18, 28),
      hit: false,
      wobble: Math.random() * Math.PI * 2
    });
  }

  const minDelay = Math.max(0.36, 1.15 - state.timeAlive / 130);
  const maxDelay = Math.max(0.58, 1.75 - state.timeAlive / 150);
  state.spawnTimer = randomBetween(minDelay, maxDelay);
}

function spawnCoffee() {
  if (Math.random() < 0.92) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    state.items.push({
      id: cryptoRandomId(),
      type: "coffee",
      lane,
      y: -90,
      radius: 30,
      spin: 0
    });
  }
  state.itemTimer = randomBetween(4, 7);
}

function spawnConstructionZone() {
  if (Math.random() < 0.66) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    state.items.push({
      id: cryptoRandomId(),
      type: "cone",
      lane,
      y: -100,
      radius: 32,
      spin: 0
    });
    setTemporaryStatus(MESSAGES.construction, 1.8);
  }
  state.constructionTimer = randomBetween(12, 18);
}

function checkTrafficCollisions() {
  const player = getPlayerRect();

  for (const vehicle of state.traffic) {
    if (vehicle.hit) continue;
    const trafficRect = getLaneRect(vehicle.lane, vehicle.y, vehicle.width * 0.76, vehicle.height * 0.72);
    if (rectsOverlap(player, trafficRect)) {
      vehicle.hit = true;
      vehicle.remove = true;
      state.patience = Math.max(0, state.patience - 20);
      state.speed = Math.max(1, state.speed - 1);
      state.playerBumpTimer = 0.45;
      state.shakeTimer = 0.2;
      setTemporaryStatus(MESSAGES.bump, 1.4);
      queueSound("bump");
    }
  }
}

function checkItemCollisions() {
  const player = getPlayerRect();

  for (const item of state.items) {
    if (item.remove) continue;
    const itemRect = getLaneRect(item.lane, item.y, item.radius * 1.35, item.radius * 1.35);
    if (!rectsOverlap(player, itemRect)) continue;

    item.remove = true;
    if (item.type === "coffee") {
      state.patience = Math.min(MAX_PATIENCE, state.patience + PATIENCE_PACK_RESTORE);
      setTemporaryStatus(MESSAGES.coffee, 1.6);
      queueSound("coffee");
    }

    if (item.type === "cone") {
      state.speed = Math.max(1, state.speed - 1);
      state.patience = Math.max(0, state.patience - 8);
      setTemporaryStatus("Construction slowdown. Patience -8", 1.5);
      queueSound("slow");
    }
  }
}

function checkEndConditions() {
  if (state.distance >= WIN_DISTANCE) {
    state.distance = WIN_DISTANCE;
    state.mode = "won";
    state.status = MESSAGES.win;
    queueSound("win");
  } else if (state.patience <= 0) {
    state.mode = "lost";
    state.status = MESSAGES.lose;
    queueSound("lose");
  }
}

function changeWeather() {
  const choices = ["sunny", "cloudy", "drizzle"];
  const next = choices[Math.floor(Math.random() * choices.length)];
  state.weather = next;
  state.weatherTimer = randomBetween(10, 18);
}

function chooseAmbientStatus() {
  const closeVehicle = state.traffic.some((vehicle) => {
    return vehicle.lane === state.targetLane && vehicle.y > 120 && vehicle.y < 640;
  });
  if (closeVehicle) return MESSAGES.close;
  if (state.speed >= 5) return MESSAGES.fastLane;
  if (state.weather === "drizzle") return "Light rain on the windshield";
  return MESSAGES.drive;
}

function setTemporaryStatus(text, seconds) {
  state.status = text;
  state.statusTimer = seconds;
}

function getPlayerRect() {
  return getLaneRect(state.lane, GAME_HEIGHT - 172, 68, 96);
}

function getLaneRect(lane, y, width, height) {
  const laneWidth = GAME_WIDTH * 0.68 / LANE_COUNT;
  const roadLeft = (GAME_WIDTH - GAME_WIDTH * 0.68) / 2;
  const centerX = roadLeft + laneWidth * (lane + 0.5);
  return {
    x: centerX - width / 2,
    y: y - height / 2,
    width,
    height
  };
}

function hasRecentVehicleInLane(lane) {
  return state.traffic.some((vehicle) => vehicle.lane === lane && vehicle.y < 80);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cryptoRandomId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

window.TrafficDash = {
  GAME_WIDTH,
  GAME_HEIGHT,
  LANE_COUNT,
  WIN_DISTANCE,
  MAX_SPEED,
  MAX_PATIENCE,
  state,
  resetGame,
  setMuted,
  queueSound,
  moveLane,
  changeSpeed,
  updateGame
};
}());
