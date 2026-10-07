const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'main.js'), 'utf8');
const wordScope = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, 'words.js'), 'utf8'), wordScope);

function record(speed) {
  const time = 2000 / speed;
  return { time, trace: [{ time: 0, distance: 0 }, { time, distance: 2000 }] };
}

test('independent word bank supports additions, optional sentences and a single-word round', () => {
  const g = game({ words: [{ word: ' APPLE ', sentence: 'An apple a day.' }, { word: 'apple' }, null, { word: '' }] });
  g.start(); g.tick(3.01);
  for (let i = 0; i < 4; i++) {
    assert.equal(g.word(), 'apple'); g.submit('apple'); g.tick(.5);
  }
  assert.equal(g.node('correct').textContent, 4);
  g.node('sentence').listeners.click();
  assert.equal(g.word(), 'apple. An apple a day.');
  const optional = game({ words: [{ word: 'banana' }] }); optional.start(); optional.tick(3.01);
  optional.node('sentence').listeners.click();
  assert.ok(optional.word().startsWith('banana.'));
  for (const words of [[], null, [{ word: 3 }]]) {
    const empty = game({ words }); empty.start(); empty.tick(4);
    assert.match(empty.node('feedback').textContent, /字庫/);
    assert.equal(empty.node('answer').disabled, true);
  }
});

function game({ storage = JSON.stringify({ best: 2000 / 27, ...record(24), previous: record(27) }), supported = true, storageFails = false, reducedMotion = false, spriteFails = false, audioFails = false, words = wordScope.window.SPELLING_WORDS } = {}) {
  let now = 0, frame;
  const nodes = new Map(), utterances = [], audioPlays = [], audioLoads = [];
  let rendered = { cars: [], stripes: [], checks: [], labels: [], sprites: [] };
  const drawing = new Proxy({}, {
    get: (target, method) => (...args) => {
      if (method === 'translate') rendered.cars.push(args[0]);
      if (method === 'fillRect' && args[2] === 48 && args[3] === 3) rendered.stripes.push(args[0]);
      if (method === 'fillRect' && args[2] === 16 && args[3] === 15.625) rendered.checks.push({ x: args[0], color: target.fillStyle });
      if (method === 'fillText') rendered.labels.push(args);
      if (method === 'drawImage') rendered.sprites.push(args.slice(1));
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  function stepFrame(milliseconds) {
    rendered = { cars: [], stripes: [], checks: [], labels: [], sprites: [] };
    now += milliseconds; frame(now);
  }
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', innerHTML: '', disabled: true, hidden: true,
      children: [], attributes: {}, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      focus() {}, blur() {}, select() {},
      replaceChildren() { this.children = []; this.textContent = ''; },
      append(child) { this.children.push(child); }, getContext() { return drawing; },
    });
    return nodes.get(id);
  }
  const document = { hidden: false, listeners: {}, getElementById: node, createElement: () => node(Symbol()), addEventListener(type, fn) { this.listeners[type] = fn; } };
  const synth = { getVoices: () => [], addEventListener() {}, cancel() {}, speak(utterance) { utterances.push(utterance); } };
  const localStorage = {
    getItem() { if (storageFails) throw new Error('blocked'); return storage; },
    setItem(key, value) { if (storageFails) throw new Error('blocked'); storage = value; },
  };
  class Utterance { constructor(text) { this.text = text; } }
  class AudioMock {
    constructor(src) { this.src = src; this.currentTime = 0; this.muted = false; this.preload = ''; }
    load() { audioLoads.push(this.src); }
    pause() {}
    play() {
      audioPlays.push(this.src);
      const chain = {
        then(fn) { if (!audioFails) fn(); return chain; },
        catch(fn) { if (audioFails) fn(new Error('audio failed')); return chain; },
      };
      return chain;
    }
  }
  vm.runInNewContext(source, {
    document, window: { SPELLING_WORDS: words, ...(supported ? { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance } : {}) },
    Image: class { complete = true; naturalWidth = spriteFails ? 0 : 1254; },
    Audio: AudioMock,
    SpeechSynthesisUtterance: Utterance, localStorage, performance: { now: () => now },
    matchMedia: () => ({ matches: reducedMotion }), requestAnimationFrame(fn) { frame = fn; },
  });
  return {
    node, document, utterances, audioPlays, audioLoads, saved: () => JSON.parse(storage),
    start() { node('start').listeners.click(); },
    tick(seconds) { for (let i = 0; i < Math.round(seconds * 100); i++) stepFrame(10); },
    render: () => rendered,
    submit(value) { node('answer').value = value; node('answer-form').listeners.submit({ preventDefault() {} }); },
    word() {
      const source = audioPlays.at(-1);
      if (source && /\/Audio\//.test(source)) return source.split('/').at(-1).split('?')[0].replace(/-sentence\.mp3$|\.mp3$/, '');
      return utterances.at(-1)?.text;
    },
  };
}

test('scooter poses follow answer pulses and sprint, with a fixed ground anchor', () => {
  const g = game(); g.start(); g.tick(3.01);
  assert.deepEqual(g.render().sprites.at(-1).slice(0, 2), [0, 0]);
  g.submit(g.word()); g.tick(.01);
  assert.deepEqual(g.render().sprites.at(-1).slice(0, 2), [627, 0]);
  g.tick(.4);
  assert.deepEqual(g.render().sprites.at(-1).slice(0, 2), [0, 627]);
  g.tick(.4);
  assert.deepEqual(g.render().sprites.at(-1).slice(0, 2), [0, 0]);
  for (let i = 0; i < 2; i++) { g.submit(g.word()); g.tick(.5); }
  assert.deepEqual(g.render().sprites.at(-1).slice(0, 2), [627, 627]);
  const quiet = game({ reducedMotion: true }); quiet.start(); quiet.tick(3.01);
  quiet.submit(quiet.word()); quiet.tick(.01);
  assert.deepEqual(quiet.render().sprites.at(-1).slice(0, 2), [0, 0]);
  const failed = game({ spriteFails: true }); failed.start(); failed.tick(3.01);
  assert.equal(failed.render().sprites.length, 0);
  assert.equal(failed.render().cars.length, 3);
});

test('all seven words appear once per round; normalization, retry, and three-answer nitro work', () => {
  const g = game(); g.start(); g.tick(3.01);
  const words = [];
  g.submit('wrong'); assert.equal(g.node('answer').attributes['aria-invalid'], 'true');
  for (let i = 0; i < 7; i++) {
    const word = g.word(); words.push(word);
    g.submit(` ${word.toUpperCase()} `);
    assert.equal(g.node('correct').textContent, i + 1);
    g.submit(word); assert.equal(g.node('correct').textContent, i + 1);
    if (i === 2) assert.equal(g.node('nitro').value, 3);
    g.tick(.5);
  }
  assert.deepEqual(words.slice().sort(), ['always', 'first', 'laugh', 'please', 'their', 'these', 'very']);
  assert.notEqual(g.word(), words.at(-1));
  g.tick(150);
  assert.equal(g.node('results').hidden, false);
  assert.match(g.node('result-stats').textContent, /88%/);
  assert.equal(g.node('review').children[0].textContent, words[0]);
  assert.equal(g.saved().trace.at(-1).distance, 2000);
  assert.ok(g.saved().trace.every((n, i, a) => !i || n.distance >= a[i - 1].distance));
});

test('fourth correct answer keeps nitro active until its three-second duration expires', () => {
  const g = game(); g.start(); g.tick(3.01);
  for (let i = 0; i < 3; i++) { g.submit(g.word()); g.tick(.5); }
  assert.equal(g.node('nitro').attributes['aria-label'], '衝刺中');
  g.submit(g.word());
  assert.equal(g.node('streak').textContent, 4);
  assert.equal(g.node('nitro').value, 3);
  assert.match(g.node('feedback').textContent, /衝刺中/);
  g.tick(.5);
  assert.equal(g.node('banner').textContent, '');
  g.tick(2.1);
  assert.equal(g.node('nitro').value, 1);
  assert.equal(g.node('nitro').attributes['aria-label'], '衝刺能量');
});

test('answer rewards move the road and opponents continuously rather than teleporting', () => {
  const g = game(); g.start(); g.tick(3.01);
  const before = g.render(), beforeDistance = g.node('distance').innerHTML;
  g.submit(g.word());
  assert.equal(g.node('distance').innerHTML, beforeDistance);
  g.tick(.01);
  const after = g.render();
  assert.ok(Math.abs(after.cars[0] - before.cars[0]) < 1);
  assert.ok(Math.abs(after.stripes[0] - before.stripes[0]) < 1);
  g.tick(1.2);
  assert.ok(parseInt(g.node('distance').innerHTML, 10) >= 100);
});

test('restarting discards pending answer rewards', () => {
  const g = game(); g.start(); g.tick(3.01); g.submit(g.word());
  g.start(); g.tick(3.01); g.tick(1.2);
  assert.ok(parseInt(g.node('distance').innerHTML, 10) < 20);
});

test('fast answers move the player forward and let trailing opponents leave the viewport', () => {
  const g = game(); g.start(); g.tick(3.01);
  for (let i = 0; i < 8; i++) { g.submit(g.word()); g.tick(.5); }
  assert.ok(g.render().cars[2] > 400);
  assert.ok(g.render().cars[0] < -45);
  assert.ok(g.render().cars[1] < -45);
  assert.ok(g.render().labels.some(([label]) => /^< \d+ m$/.test(label)));
  const before = g.render().cars[0];
  g.submit(g.word()); g.tick(.5);
  assert.ok(g.render().cars[0] < before);
});

test('a faster last-run opponent exits ahead with a distance marker', () => {
  const trace = Array.from({ length: 21 }, (_, i) => ({ time: i, distance: i * 100 }));
  const g = game({ storage: JSON.stringify({ best: 20, time: 20, trace }) });
  g.start(); g.tick(3.01); g.tick(9);
  assert.ok(g.render().cars[0] > 1245);
  assert.ok(g.render().labels.some(([label]) => /^> \d+ m$/.test(label)));
});

test('camera acceleration never reverses road movement', () => {
  const g = game(); g.start(); g.tick(3.01);
  for (let i = 0; i < 3; i++) { g.submit(g.word()); g.tick(.5); }
  g.submit(g.word());
  for (let i = 0; i < 30; i++) {
    const before = g.render().stripes[0]; g.tick(.01);
    const after = g.render().stripes[0];
    const leftward = ((before - after) % 100 + 100) % 100;
    assert.ok(leftward < 5);
  }
});

test('fixed finish line scrolls with road markings and crossing ends the race', () => {
  const g = game(); g.start(); g.tick(3.01);
  assert.equal(g.render().checks.length, 0);
  g.tick(100);
  assert.equal(g.render().checks.length, 48);
  assert.equal(new Set(g.render().checks.map((square) => square.color)).size, 2);
  const approaching = g.render().checks[0].x;
  assert.ok(approaching > g.render().cars[2]);
  const stripe = g.render().stripes[0];
  g.tick(.1);
  assert.ok(g.render().checks[0].x < approaching);
  assert.ok(Math.abs((g.render().checks[0].x - approaching) - (g.render().stripes[0] - stripe)) < 1e-8);
  g.tick(33.3);
  const finalScore = g.node('distance').innerHTML;
  const lineAtFinish = g.render().checks[0].x;
  g.tick(1);
  assert.ok(g.render().checks[0].x < lineAtFinish);
  assert.ok(g.render().checks[0].x < g.render().cars[2]);
  assert.equal(g.node('distance').innerHTML, finalScore);
  g.start(); g.tick(.01);
  assert.equal(g.render().checks.length, 0);
});

test('reduced motion keeps player and road still and finishes at 2000 meters', () => {
  const g = game({ reducedMotion: true }); g.start(); g.tick(3.01);
  g.submit(g.word()); g.tick(1);
  assert.equal(g.render().cars[2], 320);
  g.tick(150);
  assert.equal(g.node('results').hidden, false);
  const scene = g.render();
  g.tick(1);
  assert.equal(g.render().stripes[0], scene.stripes[0]);
  assert.equal(g.render().cars[2], 320);
});

test('opponents finish independently; player crossing ends input and restart uses last race', () => {
  const g = game(); g.start(); g.tick(3.01); g.tick(100);
  assert.equal(g.node('answer').disabled, false);
  assert.equal(g.node('results').hidden, true);
  assert.equal(g.node('challenger-state').textContent, '已完賽');
  const opponentX = g.render().cars[1], lineX = g.render().checks[0].x;
  assert.ok(Math.abs(opponentX - lineX) < 1e-8);
  g.tick(30);
  assert.equal(g.node('results').hidden, true);
  g.tick(4);
  assert.equal(g.node('answer').disabled, true);
  assert.match(g.node('result-title').textContent, /🥉 第 3 名/);
  assert.equal(g.node('distance').innerHTML, '2000<span>m</span>');
  const last = g.saved(); g.submit('these'); assert.equal(g.node('correct').textContent, 0);
  g.start(); assert.equal(g.node('results').hidden, true);
  g.tick(.01);
  assert.equal(g.node('opponent-state').textContent, '');
  g.tick(3.01); g.submit(g.word());
  assert.equal(g.node('correct').textContent, 1);
  assert.ok(last.best > 0);
});

test('backgrounding pauses the clock and resumes pronunciation', () => {
  const g = game(); g.start(); g.tick(3.01); g.tick(5);
  const time = g.node('time').innerHTML;
  g.document.hidden = true; g.document.listeners.visibilitychange(); g.tick(20);
  assert.equal(g.node('time').innerHTML, time);
  const count = g.audioPlays.length;
  g.document.hidden = false; g.document.listeners.visibilitychange();
  assert.equal(g.audioPlays.length, count + 1);
});

test('fast player wins before opponents, exact finish time persists and ghost replays', () => {
  const g = game(); g.start(); g.tick(3.01);
  for (let i = 0; i < 100 && !g.node('answer').disabled; i++) { g.submit(g.word()); g.tick(.5); }
  assert.equal(g.node('results').hidden, false);
  assert.match(g.node('result-title').textContent, /🥇 第 1 名/);
  const record = g.saved();
  assert.ok(record.time < 2000 / 27);
  assert.equal(record.best, record.time);
  assert.equal(record.trace.at(-1).time, record.time);
  const replay = game({ storage: JSON.stringify(record) }); replay.start(); replay.tick(3.01);
  replay.tick(.01);
  assert.equal(replay.node('opponent-state').textContent, '');
  replay.tick(record.time + .5);
  assert.equal(replay.node('results').hidden, true);
  assert.equal(replay.node('opponent-state').textContent, '已完賽');
});

test('fixed audio works without speech synthesis and failed audio still has a guarded fallback', () => {
  const fixed = game({ supported: false }); fixed.start(); fixed.tick(3.01);
  assert.equal(fixed.node('answer').disabled, false);
  assert.ok(fixed.audioPlays.at(-1).includes('.mp3?v=2.0.5'));

  const noAudio = game({ supported: false, words: [{ word: 'plain' }] }); noAudio.start(); noAudio.tick(70);
  assert.match(noAudio.node('feedback').textContent, /無法播放/);
  assert.equal(noAudio.node('answer').disabled, true);

  const failed = game({ audioFails: true }); failed.start(); failed.tick(3.01);
  assert.ok(failed.utterances.length);
  failed.utterances.at(-1).onerror({ error: 'synthesis-failed' }); failed.tick(70);
  assert.equal(failed.node('answer').disabled, true);
  assert.match(failed.node('feedback').textContent, /無法播放/);
});

test('unavailable or corrupt storage does not prevent completing a race', () => {
  for (const options of [{ storageFails: true }, { storage: '{bad' }, { storage: JSON.stringify({ best: 3, trace: [0, -1] }) }]) {
    const g = game(options); g.start(); g.tick(3.01); g.tick(150);
    assert.equal(g.node('results').hidden, false);
  }
});

test('history rolls only on completion and replays the last two races after reload', () => {
  const g = game({ storage: null }); g.start(); g.tick(3.01);
  assert.equal(g.render().cars.length, 1);
  assert.equal(g.node('challenger-state').textContent, '無紀錄');
  for (let i = 0; i < 100 && !g.node('answer').disabled; i++) { g.submit(g.word()); g.tick(.5); }
  const first = g.saved();
  assert.equal(first.previous, null);
  g.start(); g.tick(3.01); g.tick(1); g.start(); g.tick(3.01);
  assert.equal(g.render().cars.length, 2);
  assert.equal(g.saved().time, first.time);
  g.tick(150);
  const second = g.saved();
  assert.deepEqual(second.previous, { time: first.time, trace: first.trace });
  const reload = game({ storage: JSON.stringify(second) }); reload.start(); reload.tick(3.01);
  assert.equal(reload.render().cars.length, 3);
  reload.tick(first.time + .1);
  assert.equal(reload.node('challenger-state').textContent, '已完賽');
  assert.equal(reload.node('opponent-state').textContent, '');
  for (let i = 0; i < 100 && !reload.node('answer').disabled; i++) { reload.submit(reload.word()); reload.tick(.5); }
  assert.deepEqual(reload.saved().previous, { time: second.time, trace: second.trace });
});

test('a legacy single race loads without inventing a second opponent; corrupt older history is ignored', () => {
  for (const previous of [undefined, { time: 1, trace: [null] }]) {
    const g = game({ storage: JSON.stringify({ best: 50, ...record(100), previous }) });
    g.start(); g.tick(3.01);
    assert.equal(g.render().cars.length, 2);
    assert.equal(g.node('challenger-state').textContent, '無紀錄');
  }
});


test('fixed word and sentence audio are preloaded before the race', () => {
  const g = game();
  assert.equal(g.audioLoads.length, 14);
  assert.ok(g.audioLoads.every((source) => /\.mp3\?v=2\.0\.5$/.test(source)));
});

test('keyboard mode keeps answer focus while replaying and submitting', () => {
  const g = game(); let focuses = 0;
  g.node('answer').focus = () => { focuses++; };
  let prevented = 0;
  g.start(); g.tick(3.01);
  g.node('keyboard-mode').listeners.click();
  const beforeReplay = focuses;
  g.node('replay').listeners.pointerdown({ preventDefault() { prevented++; } });
  g.node('replay').listeners.click();
  assert.equal(prevented, 1);
  assert.ok(focuses > beforeReplay);
  const beforeSubmit = focuses;
  g.submit(g.word());
  assert.ok(focuses > beforeSubmit);
});


test('letter pad is the default and stays mutually exclusive with the system keyboard', () => {
  const g = game();
  assert.equal(g.node('letter-pad').hidden, false);
  assert.equal(g.node('answer').readOnly, true);
  assert.equal(g.node('answer').attributes.inputmode, 'none');
  assert.equal(g.node('letter-mode').attributes['aria-pressed'], 'true');
  assert.equal(g.node('keyboard-mode').attributes['aria-pressed'], 'false');

  let focuses = 0, blurs = 0;
  g.node('answer').focus = () => { focuses++; };
  g.node('answer').blur = () => { blurs++; };
  g.start(); g.tick(3.01);
  assert.equal(focuses, 0);
  assert.ok(blurs >= 1);

  g.node('keyboard-mode').listeners.click();
  assert.equal(g.node('letter-pad').hidden, true);
  assert.equal(g.node('answer').readOnly, false);
  assert.equal(g.node('answer').attributes.inputmode, 'text');
  assert.equal(g.node('keyboard-mode').attributes['aria-pressed'], 'true');
  assert.ok(focuses >= 1);

  g.node('letter-mode').listeners.click();
  assert.equal(g.node('letter-pad').hidden, false);
  assert.equal(g.node('answer').readOnly, true);
  assert.equal(g.node('answer').attributes.inputmode, 'none');
  assert.ok(blurs >= 2);
});

test('letter pad enters and deletes letters without needing keyboard focus', () => {
  const g = game(); g.start(); g.tick(3.01);
  const pad = g.node('letter-pad');
  assert.equal(pad.children.length, 27);
  const t = pad.children.find((button) => button.textContent === 't');
  const h = pad.children.find((button) => button.textContent === 'h');
  const backspace = pad.children.at(-1);
  t.listeners.click(); h.listeners.click();
  assert.equal(g.node('answer').value, 'th');
  backspace.listeners.click();
  assert.equal(g.node('answer').value, 't');
});


test('letter pad uses lowercase labels and two sizes from current word-bank frequency', () => {
  const g = game();
  const pad = g.node('letter-pad');
  const byLetter = (letter) => pad.children.find((button) => button.textContent === letter);
  assert.equal(byLetter('e').attributes['data-frequency'], '6');
  assert.equal(byLetter('e').attributes['data-size'], 'large');
  assert.equal(byLetter('s').attributes['data-size'], 'large');
  assert.equal(byLetter('a').attributes['data-size'], 'large');
  assert.equal(byLetter('t').attributes['data-size'], 'large');
  assert.equal(byLetter('h').attributes['data-size'], 'large');
  assert.equal(byLetter('r').attributes['data-size'], 'large');
  assert.equal(byLetter('l').attributes['data-size'], 'large');
  assert.equal(byLetter('i').attributes['data-size'], 'small');
  assert.equal(byLetter('z').attributes['data-frequency'], '0');
  assert.equal(byLetter('z').attributes['data-size'], 'small');
});


test('letter pad layout contract keeps six stable columns per full row', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, 'style.css'), 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(12,/);
  assert.match(css, /#letter-pad button \{[^}]*grid-column:\s*span 2/s);
  assert.match(css, /nth-child\(25\)[^}]*grid-column:\s*1 \/ span 2/s);
  assert.match(css, /nth-child\(26\)[^}]*grid-column:\s*3 \/ span 2/s);
  assert.match(css, /nth-child\(27\)[^}]*grid-column:\s*5 \/ span 2/s);
});


test('letter pad keeps fixed left anchors while frequency changes button width', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, 'style.css'), 'utf8');
  assert.match(css, /#letter-pad button \{[^}]*justify-self:\s*start/s);
  assert.match(css, /data-size="small"[^}]*width:\s*72%/s);
  assert.match(css, /data-size="large"[^}]*width:\s*100%/s);
  assert.match(css, /nth-child\(25\)[^}]*grid-column:\s*1 \/ span 2/s);
  assert.match(css, /nth-child\(26\)[^}]*grid-column:\s*3 \/ span 2/s);
  assert.match(css, /nth-child\(27\)[^}]*grid-column:\s*5 \/ span 2/s);
});


test('letter pad uses pill corners, large backspace, and grays letters absent from the word bank', () => {
  const g = game();
  const pad = g.node('letter-pad');
  const byLetter = (letter) => pad.children.find((button) => button.textContent === letter);
  const backspace = pad.children.at(-1);

  assert.equal(byLetter('e').attributes['data-present'], 'true');
  assert.equal(byLetter('z').attributes['data-present'], 'false');
  assert.equal(backspace.attributes['data-size'], 'large');
  assert.equal(backspace.attributes['data-present'], 'true');

  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, 'style.css'), 'utf8');
  assert.match(css, /#letter-pad button \{[^}]*border-radius:\s*999px/s);
  assert.match(css, /data-present="false"[^}]*color:\s*#9aa7a2/s);
});
