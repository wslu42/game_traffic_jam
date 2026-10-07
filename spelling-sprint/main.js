(() => {
  'use strict';
  const WORDS = Array.isArray(window.SPELLING_WORDS) ? window.SPELLING_WORDS
    .filter((entry) => entry && typeof entry.word === 'string' && entry.word.trim() && entry.word.trim().length <= 24)
    .map((entry) => ({
      word: entry.word.trim().toLowerCase(),
      sentence: typeof entry.sentence === 'string' ? entry.sentence.trim() : '',
      audio: typeof entry.audio === 'string' ? entry.audio.trim() : '',
      sentenceAudio: typeof entry.sentenceAudio === 'string' ? entry.sentenceAudio.trim() : '',
    }))
    .filter((entry, index, entries) => entries.findIndex((other) => other.word === entry.word) === index) : [];
  const RACE_DISTANCE = 2000;
  const TRACK_SCALE = 1.3;
  const STORAGE_KEY = `spellingSprint.race.v2.${RACE_DISTANCE}`;
  const $ = (id) => document.getElementById(id);
  const canvas = $('race');
  const ctx = canvas.getContext('2d');
  const scooterSheet = new Image();
  scooterSheet.src = './scooter-sprites.png?v=2.0.5';
  const greenSheet = new Image(), yellowSheet = new Image();
  greenSheet.src = './scooter-green.png?v=2.0.5';
  yellowSheet.src = './scooter-yellow.png?v=2.0.5';
  // Normalized wheel-midpoint anchors keep the generated poses on the same ground.
  const poses = [
    { sx: 0, sy: 0, ax: 313, ay: 589 },
    { sx: 627, sy: 0, ax: 323, ay: 589 },
    { sx: 0, sy: 627, ax: 330, ay: 555 },
    { sx: 627, sy: 627, ax: 341, ay: 555 },
  ];
  const synth = window.speechSynthesis;
  const speechAvailable = Boolean(synth && window.SpeechSynthesisUtterance);
  const mediaAvailable = typeof Audio === 'function';
  const audioCache = new Map();
  let currentAudio = null;
  function cachedAudio(source) {
    if (!mediaAvailable || !source) return null;
    if (!audioCache.has(source)) {
      const audio = new Audio(`${source}?v=2.0.5`);
      audio.preload = 'auto';
      if (typeof audio.load === 'function') audio.load();
      audioCache.set(source, audio);
    }
    return audioCache.get(source);
  }
  WORDS.forEach((entry) => {
    cachedAudio(entry.audio);
    cachedAudio(entry.sentenceAudio);
  });
  const fixedAudioAvailable = mediaAvailable && WORDS.some((entry) => entry.audio);
  let saved = null;
  function validRace(data) {
    return Boolean(data && Number.isFinite(data.time) && data.time > 0 &&
      data.time < 1000 && Array.isArray(data.trace) && data.trace.length >= 2 && data.trace.length <= 1002 &&
      data.trace[0]?.time === 0 && data.trace[0]?.distance === 0 &&
      data.trace.at(-1)?.time === data.time && data.trace.at(-1)?.distance === RACE_DISTANCE &&
      data.trace.every((n, i, a) => n && Number.isFinite(n.time) && Number.isFinite(n.distance) &&
        n.time >= 0 && n.distance >= 0 && n.distance <= RACE_DISTANCE &&
        (!i || (n.time > a[i - 1].time && n.distance >= a[i - 1].distance))));
  }
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (validRace(data) && Number.isFinite(data.best) && data.best > 0) {
      saved = { ...data, previous: validRace(data.previous) ? data.previous : null };
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
  let state = 'ready', elapsed = 0, distance = 0, speed = 15, boost = 0;
  let inputMode = 'letters';
  const letterButtons = [];
  const letterPad = $('letter-pad');
  const letterFrequency = new Map();
  for (const entry of WORDS) {
    for (const letter of entry.word) {
      if (/^[a-z]$/.test(letter)) letterFrequency.set(letter, (letterFrequency.get(letter) || 0) + 1);
    }
  }
  const usedFrequencies = [...letterFrequency.values()];
  const largeLetterThreshold = usedFrequencies.length
    ? Math.ceil(usedFrequencies.reduce((sum, count) => sum + count, 0) / usedFrequencies.length)
    : Infinity;
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const frequency = letterFrequency.get(letter) || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = letter;
    button.setAttribute('aria-label', `字母 ${letter}`);
    button.setAttribute('data-frequency', String(frequency));
    button.setAttribute('data-size', frequency >= largeLetterThreshold ? 'large' : 'small');
    button.setAttribute('data-present', frequency > 0 ? 'true' : 'false');
    button.disabled = true;
    button.addEventListener('click', () => {
      if (state !== 'racing' || advanceAt || $('answer').value.length >= 24) return;
      $('answer').value += letter;
      $('answer').removeAttribute('aria-invalid');
    });
    letterPad.append(button);
    letterButtons.push(button);
  }
  const backspaceButton = document.createElement('button');
  backspaceButton.type = 'button';
  backspaceButton.textContent = '⌫';
  backspaceButton.setAttribute('aria-label', '刪除最後一個字母');
  backspaceButton.setAttribute('data-size', 'large');
  backspaceButton.setAttribute('data-present', 'true');
  backspaceButton.disabled = true;
  backspaceButton.addEventListener('click', () => {
    if (state !== 'racing' || advanceAt) return;
    $('answer').value = $('answer').value.slice(0, -1);
    $('answer').removeAttribute('aria-invalid');
  });
  letterPad.append(backspaceButton);
  letterButtons.push(backspaceButton);

  function focusAnswer() {
    if (inputMode === 'keyboard' && (state === 'countdown' || state === 'racing')) {
      $('answer').focus({ preventScroll: true });
    }
  }

  function applyInputMode(mode) {
    inputMode = mode === 'keyboard' ? 'keyboard' : 'letters';
    const letters = inputMode === 'letters';
    $('letter-mode').setAttribute('aria-pressed', String(letters));
    $('keyboard-mode').setAttribute('aria-pressed', String(!letters));
    letterPad.hidden = !letters;
    $('answer').readOnly = letters;
    $('answer').setAttribute('inputmode', letters ? 'none' : 'text');
    $('answer').placeholder = letters ? '拼字' : '輸入';
    if (letters) $('answer').blur();
    else focusAnswer();
  }
  applyInputMode('letters');
  let rewards = [];
  let playerX = 320, finishTime = 0;
  let correct = 0, attempts = 0, streak = 0, question = 0, current = null;
  let queue = [], missed = new Set(), trace = [{ time: 0, distance: 0 }], previous = performance.now();
  let countdown = 0, promptTime = 0, advanceAt = 0, feedbackUntil = 0;
  let voice = null, speechFailed = false, speechVersion = 0;
  let opponentTrace = saved ? saved.trace : null;
  let challengerTrace = saved?.previous?.trace || null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function chooseVoice() {
    const voices = synth ? synth.getVoices() : [];
    voice = voices.find((v) => v.lang === 'en-US' && v.localService) || voices.find((v) => /^en[-_]/i.test(v.lang)) || null;
  }
  chooseVoice();
  if (synth) synth.addEventListener('voiceschanged', chooseVoice);

  function failSpeech(version) {
    if (version !== speechVersion) return;
    speechFailed = true;
    if (state === 'racing') {
      state = 'audio-error';
      setInputEnabled(false);
      $('start').textContent = '重新開始';
      $('feedback').textContent = '發音無法播放，請確認裝置音量後重試。';
      $('banner').textContent = '';
    }
  }

  function stopSpeech() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (synth) synth.cancel();
  }

  function browserSpeak(text, version) {
    if (!speechAvailable) {
      failSpeech(version);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;
    if (voice) utterance.voice = voice;
    utterance.onerror = (event) => {
      if (!['canceled', 'interrupted'].includes(event.error)) failSpeech(version);
    };
    synth.speak(utterance);
  }

  function primeFixedAudio() {
    for (const audio of audioCache.values()) {
      const muted = audio.muted;
      audio.muted = true;
      const attempt = audio.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = muted;
        }).catch(() => { audio.muted = muted; });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = muted;
      }
    }
  }

  function speak(text, source = '') {
    const version = ++speechVersion;
    stopSpeech();
    const audio = cachedAudio(source);
    if (!audio) {
      browserSpeak(text, version);
      return;
    }
    currentAudio = audio;
    audio.currentTime = 0;
    let fallbackUsed = false;
    const fallback = () => {
      if (fallbackUsed || version !== speechVersion) return;
      fallbackUsed = true;
      if (currentAudio === audio) currentAudio = null;
      browserSpeak(text, version);
    };
    audio.onended = () => {
      if (version === speechVersion && currentAudio === audio) currentAudio = null;
    };
    audio.onerror = fallback;
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(fallback);
  }

  function setInputEnabled(enabled) {
    ['answer', 'submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = !enabled; });
    letterButtons.forEach((button) => { button.disabled = !enabled; });
  }

  function shuffledWords() {
    const bag = WORDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag.length > 1 && current && bag[0].word === current.word) [bag[0], bag[1]] = [bag[1], bag[0]];
    return bag;
  }

  function nextQuestion() {
    if (!queue.length) queue = shuffledWords();
    current = queue.shift();
    question++;
    promptTime = elapsed;
    advanceAt = 0;
    $('question').textContent = `第${question}題`;
    $('answer').value = '';
    $('answer').removeAttribute('aria-invalid');
    setInputEnabled(true);
    focusAnswer();
    speak(current.word, current.audio);
  }

  function start() {
    if (!WORDS.length) {
      $('feedback').textContent = '字庫沒有可用的單字，請檢查 words.js。';
      return;
    }
    speechVersion++;
    stopSpeech();
    if (!fixedAudioAvailable && !speechAvailable) {
      $('feedback').textContent = '此瀏覽器無法播放英文發音。';
      return;
    }
    state = 'countdown'; elapsed = 0; distance = 0; speed = 15; boost = 0;
    rewards = [];
    playerX = 320; finishTime = 0;
    correct = 0; attempts = 0; streak = 0; question = 0; current = null;
    queue = []; missed = new Set(); trace = [{ time: 0, distance: 0 }]; advanceAt = 0; feedbackUntil = 0; speechFailed = false;
    countdown = 3; previous = performance.now();
    opponentTrace = saved ? saved.trace : null;
    challengerTrace = saved?.previous?.trace || null;
    $('results').hidden = true;
    $('cockpit').hidden = false;
    $('start').textContent = '重新開始';
    $('answer').value = '';
    $('answer').removeAttribute('aria-invalid');
    $('question').textContent = '準備';
    $('feedback').textContent = '';
    $('answer').disabled = false;
    if (inputMode === 'keyboard') focusAnswer();
    else $('answer').blur();
    ['submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = true; });
    letterButtons.forEach((button) => { button.disabled = true; });
    chooseVoice();
    primeFixedAudio();
    updateHud();
  }

  function finish() {
    state = 'finished';
    speechVersion++;
    stopSpeech();
    setInputEnabled(false);
    $('answer').blur();
    trace.push({ time: elapsed, distance: RACE_DISTANCE });
    const previousBest = saved ? saved.best : Infinity;
    const place = 1 + [opponentTrace, challengerTrace].filter((record) => record && record.at(-1).time < elapsed).length;
    const placeIcon = ['', '🥇', '🥈', '🥉'][place] || '🏁';
    $('result-title').textContent = `${placeIcon} 第 ${place} 名`;
    $('result-distance').textContent = `${elapsed.toFixed(2)} s`;
    $('result-stats').textContent = `答對 ${correct} 題 · 正確率 ${attempts ? Math.round(correct / attempts * 100) : 0}%`;
    $('result-record').textContent = `${elapsed < previousBest ? '新紀錄！' : '最佳紀錄'} ${Math.min(previousBest, elapsed).toFixed(2)} s`;
    $('review').replaceChildren();
    missed.forEach((word) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = word;
      button.title = `播放 ${word}`;
      const entry = WORDS.find((item) => item.word === word);
      button.addEventListener('click', () => speak(word, entry?.audio));
      $('review').append(button);
    });
    if (!missed.size) $('review').textContent = attempts ? '沒有錯字' : '尚未作答';
    saved = { best: Math.min(previousBest, elapsed), time: elapsed, trace,
      previous: saved ? { time: saved.time, trace: saved.trace } : null };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
    catch { $('result-record').textContent += '（此裝置無法儲存紀錄）'; }
    $('results').hidden = false;
    $('cockpit').hidden = true;
    $('feedback').textContent = '';
    $('banner').textContent = '';
    updateHud();
  }

  $('start').addEventListener('click', start);
  ['submit', 'replay', 'sentence'].forEach((id) => {
    $(id).addEventListener('pointerdown', (event) => event.preventDefault());
  });
  $('letter-mode').addEventListener('click', () => applyInputMode('letters'));
  $('keyboard-mode').addEventListener('click', () => applyInputMode('keyboard'));
  $('replay').addEventListener('click', () => { if (state === 'racing' && current) { speak(current.word, current.audio); focusAnswer(); } });
  $('sentence').addEventListener('click', () => { if (state === 'racing' && current) { speak(`${current.word}. ${current.sentence}`, current.sentenceAudio); focusAnswer(); } });
  $('answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (state !== 'racing' || advanceAt || distance >= RACE_DISTANCE || document.hidden) return;
    const answer = $('answer').value.trim().toLowerCase();
    if (!answer) return;
    attempts++;
    if (answer !== current.word) {
      streak = 0; missed.add(current.word);
      $('feedback').textContent = '再試一次';
      $('answer').setAttribute('aria-invalid', 'true');
      $('answer').select();
    } else {
      correct++; streak++;
      const quick = Math.max(0, 8 - (elapsed - promptTime));
      rewards.push({ distance: 45 + quick * 5, elapsed: 0 });
      speed = Math.min(52, speed + 5);
      if (streak % 3 === 0) boost = 3;
      $('feedback').textContent = boost > 0 ? '答對 · 衝刺中' : '答對';
      $('answer').removeAttribute('aria-invalid');
      ['submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = true; });
      advanceAt = elapsed + 0.45;
    }
    feedbackUntil = elapsed + 2;
    focusAnswer();
    updateHud();
  });

  function ghostDistance(time = elapsed, record = opponentTrace) {
    if (!record) return 0;
    if (time >= record.at(-1).time) return RACE_DISTANCE;
    const index = record.findIndex((sample) => sample.time > time);
    const a = record[index - 1], b = record[index];
    return a.distance + (b.distance - a.distance) * (time - a.time) / (b.time - a.time);
  }

  function advanceRewards(step) {
    // Deliver each answer's distance over a smooth 1.2-second acceleration pulse.
    const progress = (time) => {
      const t = Math.min(1, time / 1.2);
      return t * t * (3 - 2 * t);
    };
    for (const reward of rewards) {
      distance += reward.distance * (progress(reward.elapsed + step) - progress(reward.elapsed));
      reward.elapsed += step;
    }
    rewards = rewards.filter((reward) => reward.elapsed < 1.2);
  }

  function updateHud() {
    $('time').innerHTML = `${elapsed.toFixed(1)}<span>s</span>`;
    $('distance').innerHTML = `${Math.floor(distance)}<span>m</span>`;
    $('correct').textContent = correct;
    $('streak').textContent = streak;
    $('nitro').value = boost > 0 ? 3 : streak % 3;
    $('nitro').setAttribute('aria-label', boost > 0 ? '衝刺中' : '衝刺能量');
  }

  function scooter(x, y, color, boosting, alpha = 1, pose = 0, sheet = scooterSheet) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    if (sheet.complete && sheet.naturalWidth) {
      const p = poses[boosting ? 3 : pose], scale = .135;
      ctx.drawImage(sheet, p.sx / 1254 * sheet.naturalWidth, p.sy / 1254 * sheet.naturalWidth,
        sheet.naturalWidth / 2, sheet.naturalWidth / 2,
        -p.ax * scale, 8 - p.ay * scale, 627 * scale, 627 * scale);
    } else {
      // Keep a recognizable scooter visible while the PNG loads or if it fails.
      ctx.strokeStyle = color; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(25, 0);
      ctx.lineTo(18, -48); ctx.lineTo(8, -48); ctx.stroke();
      ctx.fillStyle = '#192a2d';
      for (const wheel of [-25, 25]) { ctx.beginPath(); ctx.arc(wheel, 3, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  function opponentScooter(d, visualDistance, y, color, alpha = 1, sheet = scooterSheet) {
    const x = playerX + (d - visualDistance) * TRACK_SCALE;
    const pose = d < RACE_DISTANCE && state === 'racing' && !reducedMotion ? [1, 2, 0, 0][Math.floor(elapsed * 3) % 4] : 0;
    scooter(x, y, color, false, alpha, pose, sheet);
    if (x < -45 || x > 1245) {
      const ahead = x > 1245;
      const fontSize = Math.max(15, 12 * 1200 / (canvas.clientWidth || 1200));
      const width = fontSize * 7 + 30;
      const labelX = ahead ? 1200 - width - 12 : 12;
      ctx.fillStyle = '#20302d'; ctx.fillRect(labelX, y - fontSize * .8, width, fontSize * 1.6);
      ctx.fillStyle = color; ctx.fillRect(labelX + 8, y - fontSize * .3, fontSize * .6, fontSize * .6);
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${fontSize}px system-ui`;
      ctx.fillText(d >= RACE_DISTANCE ? '已完賽' : `${ahead ? '>' : '<'} ${Math.round(Math.abs(d - visualDistance))} m`, labelX + fontSize + 15, y + fontSize * .35);
    }
  }

  function finishLine(x) {
    if (x < -100 || x > 1260) return;
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#20302d' : '#ffffff';
        ctx.fillRect(x + col * 16, 126 + row * 15.625, 16, 15.625);
      }
    }
    const size = Math.max(17, 10 * 1200 / (canvas.clientWidth || 1200));
    ctx.fillStyle = '#20302d'; ctx.fillRect(x - 24, 118 - size * 1.4, size * 5.8, size * 1.4);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${size}px system-ui`;
    ctx.fillText('終點', x - 8, 110);
  }

  function draw(now) {
    const w = 1200, h = 430;
    ctx.fillStyle = '#91d7e8'; ctx.fillRect(0, 0, w, h);
    const coast = state === 'finished' && !reducedMotion ? 80 * (1 - Math.exp(-finishTime / .65)) : 0;
    const visualDistance = distance + coast;
    const scroll = reducedMotion ? (state === 'finished' ? RACE_DISTANCE * TRACK_SCALE : 0) : visualDistance * TRACK_SCALE - (playerX - 320);
    ctx.fillStyle = '#f7fffc';
    for (let i = 0; i < 6; i++) { const x = ((i * 260 - scroll * .12) % 1560 + 1560) % 1560 - 150; ctx.fillRect(x, 40, 80, 12); ctx.fillRect(x + 25, 28, 35, 12); }
    ctx.fillStyle = '#51af75'; ctx.fillRect(0, 95, w, 335);
    ctx.fillStyle = '#318552';
    for (let i = 0; i < 9; i++) { const x = ((i * 180 - scroll * .4) % 1620 + 1620) % 1620 - 100; ctx.beginPath(); ctx.moveTo(x, 96); ctx.lineTo(x + 65, 57); ctx.lineTo(x + 130, 96); ctx.fill(); }
    ctx.fillStyle = '#f5f6ec'; ctx.fillRect(0, 114, w, 274);
    for (let i = 0; i < 32; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#d93850'; ctx.fillRect(i * 40 - scroll % 80, 118, 40, 8); ctx.fillRect(i * 40 - scroll % 80, 376, 40, 8); }
    ctx.fillStyle = '#465353'; ctx.fillRect(0, 126, w, 250);
    ctx.fillStyle = '#bccac6';
    for (const y of [210, 294]) for (let i = 0; i < 14; i++) ctx.fillRect(i * 100 - scroll % 100, y, 48, 3);
    // Finish and road markings share one world-to-screen transform.
    finishLine(320 + RACE_DISTANCE * TRACK_SCALE - scroll);
    const raceTime = elapsed + (state === 'finished' ? finishTime : 0);
    for (const [record, id] of [[opponentTrace, 'opponent-state'], [challengerTrace, 'challenger-state']]) {
      $(id).textContent = !record ? '無紀錄' : raceTime >= record.at(-1).time ? '已完賽' : '';
    }
    if (opponentTrace) opponentScooter(ghostDistance(raceTime), visualDistance, 167, '#169e88', 1, greenSheet);
    if (challengerTrace) opponentScooter(ghostDistance(raceTime, challengerTrace), visualDistance, 336, '#f4cd45', 1, yellowSheet);
    const pulse = rewards.length ? rewards[rewards.length - 1].elapsed : 1.2;
    const pose = state === 'racing' && !reducedMotion ? pulse < .4 ? 1 : pulse < .8 ? 2 : 0 : 0;
    scooter(playerX, 251, '#d93850', state === 'racing' && boost > 0 && !reducedMotion, 1, pose);
  }

  document.addEventListener('visibilitychange', () => {
    previous = performance.now();
    if (document.hidden) stopSpeech();
    if (!document.hidden && state === 'racing' && current && !advanceAt) speak(current.word, current.audio);
  });

  function frame(now) {
    const dt = Math.max(0, (now - previous) / 1000);
    previous = now;
    if (!document.hidden) {
      if (state === 'countdown') {
        countdown -= dt;
        $('banner').textContent = countdown > 0 ? String(Math.ceil(countdown)) : '';
        if (countdown <= 0) {
          if (speechFailed) { state = 'audio-error'; setInputEnabled(false); $('feedback').textContent = '發音無法播放，請確認英文語音後重試。'; }
          else { state = 'racing'; nextQuestion(); }
        }
      } else if (state === 'racing') {
        const step = dt;
        const previousDistance = distance;
        const previousElapsed = elapsed;
        elapsed += step;
        distance += step * speed + Math.min(step, boost) * 35;
        advanceRewards(step);
        const targetX = reducedMotion ? 320 : 320 + Math.min(200, (speed - 15 + (boost > 0 ? 35 : 0)) * 2.5);
        const cameraShift = (targetX - playerX) * (1 - Math.exp(-step / .4));
        playerX += Math.min(cameraShift, (distance - previousDistance) * TRACK_SCALE * .65);
        boost = Math.max(0, boost - step);
        speed = Math.max(15, speed - step * 1.5);
        if (distance >= RACE_DISTANCE) {
          elapsed = previousElapsed + step * (RACE_DISTANCE - previousDistance) / (distance - previousDistance);
          distance = RACE_DISTANCE;
          finish();
        }
        else {
          if (elapsed - trace.at(-1).time >= 1) trace.push({ time: elapsed, distance });
          if (advanceAt && elapsed >= advanceAt) nextQuestion();
          if (elapsed > feedbackUntil) $('feedback').textContent = '';
          $('banner').textContent = distance >= RACE_DISTANCE - 200 ? '最後 200 公尺' : '';
        }
        updateHud();
      } else if (state === 'finished') {
        finishTime += dt;
      }
    }
    draw(now);
    requestAnimationFrame(frame);
  }
  if (!fixedAudioAvailable && !speechAvailable) $('feedback').textContent = '此瀏覽器無法播放英文發音。';
  requestAnimationFrame(frame);
})();
