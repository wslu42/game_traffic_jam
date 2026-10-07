const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'main.js'), 'utf8');

function game({ storage = null, supported = true, storageFails = false, reducedMotion = false, spriteFails = false } = {}) {
  let now = 0, frame;
  const nodes = new Map(), utterances = [];
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
  vm.runInNewContext(source, {
    document, window: supported ? { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance } : {},
    Image: class { complete = true; naturalWidth = spriteFails ? 0 : 1254; },
    SpeechSynthesisUtterance: Utterance, localStorage, performance: { now: () => now },
    matchMedia: () => ({ matches: reducedMotion }), requestAnimationFrame(fn) { frame = fn; },
  });
  return {
    node, document, utterances, saved: () => JSON.parse(storage),
    start() { node('start').listeners.click(); },
    tick(seconds) { for (let i = 0; i < Math.round(seconds * 100); i++) stepFrame(10); },
    render: () => rendered,
    submit(value) { node('answer').value = value; node('answer-form').listeners.submit({ preventDefault() {} }); },
    word() { return utterances.at(-1).text; },
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
  g.tick(60);
  assert.equal(g.node('results').hidden, false);
  assert.match(g.node('result-stats').textContent, /88%/);
  assert.equal(g.node('review').children[0].textContent, words[0]);
  assert.equal(g.saved().trace.length, 61);
  assert.ok(g.saved().trace.every((n, i, a) => !i || n >= a[i - 1]));
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
  assert.equal(g.node('banner').textContent, 'SPRINT!');
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
  for (let i = 0; i < 12; i++) { g.submit(g.word()); g.tick(.5); }
  assert.ok(g.render().cars[2] > 400);
  assert.ok(g.render().cars[0] < -45);
  assert.ok(g.render().cars[1] < -45);
  assert.ok(g.render().labels.some(([label]) => /^< \d+ m$/.test(label)));
  const before = g.render().cars[0];
  g.submit(g.word()); g.tick(.5);
  assert.ok(g.render().cars[0] < before);
});

test('a faster last-run opponent exits ahead with a distance marker', () => {
  const trace = Array.from({ length: 61 }, (_, i) => i * 100);
  const g = game({ storage: JSON.stringify({ best: 6000, trace }) });
  g.start(); g.tick(3.01); g.tick(15);
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

test('finish line approaches, is crossed after time expires, and leaves scored distance unchanged', () => {
  const g = game(); g.start(); g.tick(3.01); g.tick(49);
  assert.equal(g.render().checks.length, 0);
  g.tick(5);
  assert.equal(g.render().checks.length, 48);
  assert.equal(new Set(g.render().checks.map((square) => square.color)).size, 2);
  const approaching = g.render().checks[0].x;
  assert.ok(approaching > g.render().cars[2]);
  g.tick(3);
  assert.ok(g.render().checks[0].x < approaching);
  g.tick(3.1);
  const finalScore = g.node('distance').innerHTML;
  const lineAtFinish = g.render().checks[0].x;
  g.tick(1);
  assert.ok(g.render().checks[0].x < lineAtFinish);
  assert.ok(g.render().checks[0].x < g.render().cars[2]);
  assert.equal(g.node('distance').innerHTML, finalScore);
  g.start(); g.tick(.01);
  assert.equal(g.render().checks.length, 0);
});

test('reduced motion keeps the player and post-finish scene still', () => {
  const g = game({ reducedMotion: true }); g.start(); g.tick(3.01);
  g.submit(g.word()); g.tick(1);
  assert.equal(g.render().cars[2], 320);
  g.tick(60);
  const line = g.render().checks[0].x;
  assert.ok(line < 320);
  g.tick(1);
  assert.equal(g.render().checks[0].x, line);
});

test('60 seconds ends the race, blocks late answers, and restart resets counters with last-run opponent', () => {
  const g = game(); g.start(); g.tick(3.01); g.tick(60.1);
  assert.equal(g.node('answer').disabled, true);
  const last = g.saved(); g.submit('these'); assert.equal(g.node('correct').textContent, 0);
  g.start(); assert.equal(g.node('results').hidden, true);
  assert.match(g.node('opponent').innerHTML, /上次的你/);
  g.tick(3.01); g.submit(g.word());
  assert.equal(g.node('correct').textContent, 1);
  assert.ok(last.best > 0);
});

test('backgrounding pauses the clock and resumes pronunciation', () => {
  const g = game(); g.start(); g.tick(3.01); g.tick(5);
  const time = g.node('time').innerHTML;
  g.document.hidden = true; g.document.listeners.visibilitychange(); g.tick(20);
  assert.equal(g.node('time').innerHTML, time);
  const count = g.utterances.length;
  g.document.hidden = false; g.document.listeners.visibilitychange();
  assert.equal(g.utterances.length, count + 1);
});

test('missing speech and synthesis failures do not run an unanswerable race', () => {
  const unsupported = game({ supported: false }); unsupported.start(); unsupported.tick(70);
  assert.match(unsupported.node('feedback').textContent, /不支援/);
  const g = game(); g.start(); g.tick(3.01);
  g.utterances.at(-1).onerror({ error: 'synthesis-failed' }); g.tick(70);
  assert.equal(g.node('answer').disabled, true);
  assert.match(g.node('feedback').textContent, /無法播放/);
  const old = g.utterances.at(-1); g.start(); g.tick(3.01);
  old.onerror({ error: 'synthesis-failed' });
  assert.equal(g.node('answer').disabled, false);
});

test('unavailable or corrupt storage does not prevent completing a race', () => {
  for (const options of [{ storageFails: true }, { storage: '{bad' }, { storage: JSON.stringify({ best: 3, trace: [0, -1] }) }]) {
    const g = game(options); g.start(); g.tick(3.01); g.tick(60.1);
    assert.equal(g.node('results').hidden, false);
  }
});
