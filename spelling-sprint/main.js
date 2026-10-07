(() => {
  'use strict';
  const WORDS = [
    { word: 'these', sentence: 'These are my shoes.' },
    { word: 'their', sentence: 'Their car is red.' },
    { word: 'always', sentence: 'I always brush my teeth.' },
    { word: 'first', sentence: 'You are first in line.' },
    { word: 'very', sentence: 'I am very happy.' },
    { word: 'please', sentence: 'Please open the door.' },
    { word: 'laugh', sentence: 'That joke makes me laugh.' },
  ];
  const SECONDS = 60;
  const STORAGE_KEY = 'spellingSprint.v1';
  const $ = (id) => document.getElementById(id);
  const canvas = $('race');
  const ctx = canvas.getContext('2d');
  const synth = window.speechSynthesis;
  const speechAvailable = Boolean(synth && window.SpeechSynthesisUtterance);
  let saved = null;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Number.isFinite(data.best) && data.best >= 0 && Array.isArray(data.trace) &&
      data.trace.length === 61 && data.trace.every((n, i, a) => Number.isFinite(n) && n >= 0 && n < 100000 && (!i || n >= a[i - 1]))) saved = data;
  } catch { /* Storage may be unavailable in private browsing. */ }
  let state = 'ready', elapsed = 0, distance = 0, speed = 15, boost = 0;
  let rewards = [];
  let correct = 0, attempts = 0, streak = 0, question = 0, current = null;
  let queue = [], missed = new Set(), trace = [0], previous = performance.now();
  let countdown = 0, promptTime = 0, advanceAt = 0, feedbackUntil = 0;
  let voice = null, speechFailed = false, speechVersion = 0;
  let opponentTrace = saved ? saved.trace : null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function chooseVoice() {
    const voices = synth ? synth.getVoices() : [];
    voice = voices.find((v) => v.lang === 'en-US' && v.localService) || voices.find((v) => /^en[-_]/i.test(v.lang)) || null;
  }
  chooseVoice();
  if (synth) synth.addEventListener('voiceschanged', chooseVoice);

  function speak(text) {
    if (!speechAvailable) return;
    const version = ++speechVersion;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;
    if (voice) utterance.voice = voice;
    utterance.onerror = (event) => {
      if (version !== speechVersion) return;
      if (!['canceled', 'interrupted'].includes(event.error)) {
        speechFailed = true;
        if (state === 'racing') {
          state = 'audio-error';
          setInputEnabled(false);
          $('start').textContent = '重新開始';
          $('feedback').textContent = '發音無法播放，請確認裝置的英文語音與音量後重試。';
          $('banner').textContent = 'AUDIO UNAVAILABLE';
        }
      }
    };
    synth.speak(utterance);
  }

  function setInputEnabled(enabled) {
    ['answer', 'submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = !enabled; });
  }

  function shuffledWords() {
    const bag = WORDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (current && bag[0].word === current.word) [bag[0], bag[1]] = [bag[1], bag[0]];
    return bag;
  }

  function nextQuestion() {
    if (!queue.length) queue = shuffledWords();
    current = queue.shift();
    question++;
    promptTime = elapsed;
    advanceAt = 0;
    $('question').textContent = `第 ${question} 題`;
    $('answer').value = '';
    $('answer').removeAttribute('aria-invalid');
    setInputEnabled(true);
    $('answer').focus({ preventScroll: true });
    speak(current.word);
  }

  function start() {
    speechVersion++;
    if (synth) synth.cancel();
    if (!speechAvailable) {
      $('feedback').textContent = '此瀏覽器不支援英文發音，請改用支援語音的瀏覽器。';
      return;
    }
    state = 'countdown'; elapsed = 0; distance = 0; speed = 15; boost = 0;
    rewards = [];
    correct = 0; attempts = 0; streak = 0; question = 0; current = null;
    queue = []; missed = new Set(); trace = [0]; advanceAt = 0; feedbackUntil = 0; speechFailed = false;
    countdown = 3; previous = performance.now();
    opponentTrace = saved ? saved.trace : null;
    $('results').hidden = true;
    $('start').textContent = '重新開始';
    $('answer').value = '';
    $('answer').removeAttribute('aria-invalid');
    $('question').textContent = '準備起跑';
    $('feedback').textContent = '準備好了！';
    // Keep the mobile keyboard open across the countdown and subsequent questions.
    $('answer').disabled = false;
    $('answer').focus({ preventScroll: true });
    ['submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = true; });
    chooseVoice();
    speak('Ready.');
    $('opponent').innerHTML = `<i class="mint"></i>${saved ? '上次的你' : '電腦車'}`;
    updateHud();
  }

  function finish() {
    state = 'finished';
    speechVersion++;
    if (synth) synth.cancel();
    setInputEnabled(false);
    $('answer').blur();
    while (trace.length < 61) trace.push(distance);
    const previousBest = saved ? saved.best : 0;
    const lastDistance = saved ? saved.trace[60] : 60 * 24;
    $('result-title').textContent = distance >= lastDistance ? '漂亮完賽！' : '完賽！再挑戰一次';
    $('result-distance').textContent = `${Math.floor(distance)} m`;
    $('result-stats').textContent = `答對 ${correct} 題 · 正確率 ${attempts ? Math.round(correct / attempts * 100) : 0}%`;
    $('result-record').textContent = `${distance > previousBest ? '新紀錄！' : '最佳紀錄'} ${Math.floor(Math.max(previousBest, distance))} m`;
    $('review').replaceChildren();
    missed.forEach((word) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = word;
      button.title = `播放 ${word}`;
      button.addEventListener('click', () => speak(word));
      $('review').append(button);
    });
    if (!missed.size) $('review').textContent = attempts ? '沒有拼錯的字，做得好！' : '下一場再試試看！';
    saved = { best: Math.max(previousBest, distance), trace };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
    catch { $('result-record').textContent += '（此裝置無法儲存紀錄）'; }
    $('results').hidden = false;
    $('feedback').textContent = '比賽結束！';
    $('question').textContent = 'FINISH';
    $('banner').textContent = 'FINISH!';
    updateHud();
  }

  $('start').addEventListener('click', start);
  $('replay').addEventListener('click', () => { if (state === 'racing' && current) { speak(current.word); $('answer').focus({ preventScroll: true }); } });
  $('sentence').addEventListener('click', () => { if (state === 'racing' && current) { speak(`${current.word}. ${current.sentence}`); $('answer').focus({ preventScroll: true }); } });
  $('answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (state !== 'racing' || advanceAt || elapsed >= SECONDS || document.hidden) return;
    const answer = $('answer').value.trim().toLowerCase();
    if (!answer) return;
    attempts++;
    if (answer !== current.word) {
      streak = 0; missed.add(current.word);
      $('feedback').textContent = '再試一次，或聽聽例句。';
      $('answer').setAttribute('aria-invalid', 'true');
      $('answer').select();
    } else {
      correct++; streak++;
      const quick = Math.max(0, 8 - (elapsed - promptTime));
      rewards.push({ distance: 45 + quick * 5, elapsed: 0 });
      speed = Math.min(52, speed + 5);
      if (streak % 3 === 0) boost = 3;
      $('feedback').textContent = streak % 3 === 0 ? '連對三題！氮氣加速！' : boost > 0 ? '答對了！氮氣加速中！' : '答對了！加速！';
      $('answer').removeAttribute('aria-invalid');
      ['submit', 'replay', 'sentence'].forEach((id) => { $(id).disabled = true; });
      advanceAt = elapsed + 0.45;
    }
    feedbackUntil = elapsed + 2;
    updateHud();
  });

  function ghostDistance() {
    if (!opponentTrace) return elapsed * 24;
    const second = Math.min(59, Math.floor(elapsed));
    return opponentTrace[second] + (opponentTrace[second + 1] - opponentTrace[second]) * (elapsed - second);
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
    $('time').innerHTML = `${Math.ceil(Math.max(0, SECONDS - elapsed))}<span>s</span>`;
    $('distance').innerHTML = `${Math.floor(distance)}<span>m</span>`;
    $('correct').textContent = correct;
    $('streak').textContent = streak;
    $('nitro').value = boost > 0 ? 3 : streak % 3;
    $('nitro').setAttribute('aria-label', boost > 0 ? '氮氣加速中' : '氮氣能量');
  }

  function car(x, y, color, boosting, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    if (boosting) { ctx.fillStyle = '#ffc947'; ctx.beginPath(); ctx.moveTo(-39, -10); ctx.lineTo(-75 - Math.random() * 20, 0); ctx.lineTo(-39, 10); ctx.fill(); }
    ctx.fillStyle = '#192a2d';
    for (const yy of [-23, 15]) { ctx.fillRect(-29, yy, 19, 8); ctx.fillRect(17, yy, 19, 8); }
    ctx.fillStyle = color; ctx.fillRect(-42, -19, 88, 38);
    ctx.fillStyle = '#e0f7ff'; ctx.fillRect(-9, -14, 28, 28);
    ctx.fillStyle = '#314b59'; ctx.fillRect(17, -13, 7, 26);
    ctx.fillStyle = '#fff3bf'; ctx.fillRect(39, -14, 5, 8); ctx.fillRect(39, 6, 5, 8);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-36, -3, 24, 6);
    ctx.restore();
  }

  function draw(now) {
    const w = 1200, h = 430;
    ctx.fillStyle = '#91d7e8'; ctx.fillRect(0, 0, w, h);
    const scroll = reducedMotion ? 0 : distance * 1.3;
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
    const ghost = ghostDistance(), rival = elapsed * 27;
    const position = (d) => Math.max(70, Math.min(1125, 320 + (d - distance) * .7));
    car(position(ghost), 167, '#169e88', false, .8);
    car(position(rival), 336, '#f4cd45', false);
    const bob = state === 'racing' && !reducedMotion ? Math.sin(now / 65) * 1.4 : 0;
    car(320, 251 + bob, '#d93850', boost > 0 && !reducedMotion);
    ctx.fillStyle = '#20302d'; ctx.font = 'bold 14px system-ui'; ctx.fillText('SPELLING CIRCUIT / 60 SEC', 20, 415);
  }

  document.addEventListener('visibilitychange', () => {
    previous = performance.now();
    if (document.hidden && synth) synth.cancel();
    if (!document.hidden && state === 'racing' && current && !advanceAt) speak(current.word);
  });

  function frame(now) {
    const dt = Math.max(0, (now - previous) / 1000);
    previous = now;
    if (!document.hidden) {
      if (state === 'countdown') {
        countdown -= dt;
        $('banner').textContent = countdown > 0 ? String(Math.ceil(countdown)) : 'GO!';
        if (countdown <= 0) {
          if (speechFailed) { state = 'audio-error'; setInputEnabled(false); $('feedback').textContent = '發音無法播放，請確認英文語音後重試。'; }
          else { state = 'racing'; nextQuestion(); }
        }
      } else if (state === 'racing') {
        const step = Math.min(dt, SECONDS - elapsed);
        elapsed += step;
        distance += step * speed + Math.min(step, boost) * 35;
        advanceRewards(step);
        boost = Math.max(0, boost - step);
        speed = Math.max(15, speed - step * 1.5);
        while (trace.length <= Math.floor(elapsed)) trace.push(distance);
        if (elapsed >= SECONDS) finish();
        else {
          if (advanceAt && elapsed >= advanceAt) nextQuestion();
          if (elapsed > feedbackUntil) $('feedback').textContent = '聽到了嗎？';
          $('banner').textContent = boost > 0 ? 'NITRO!' : elapsed >= 50 ? 'FINAL SPRINT!' : '';
        }
        updateHud();
      }
    }
    draw(now);
    requestAnimationFrame(frame);
  }
  if (!speechAvailable) $('feedback').textContent = '此瀏覽器不支援英文發音。';
  requestAnimationFrame(frame);
})();
