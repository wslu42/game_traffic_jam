const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'main.js'), 'utf8');

function game({ storage = null, supported = true, storageFails = false } = {}) {
  let now = 0, frame;
  const nodes = new Map(), utterances = [];
  const drawing = new Proxy({}, { get: () => () => {}, set: () => true });
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
    SpeechSynthesisUtterance: Utterance, localStorage, performance: { now: () => now },
    matchMedia: () => ({ matches: false }), requestAnimationFrame(fn) { frame = fn; },
  });
  return {
    node, document, utterances, saved: () => JSON.parse(storage),
    start() { node('start').listeners.click(); },
    tick(seconds) { for (let i = 0; i < Math.round(seconds * 100); i++) { now += 10; frame(now); } },
    submit(value) { node('answer').value = value; node('answer-form').listeners.submit({ preventDefault() {} }); },
    word() { return utterances.at(-1).text; },
  };
}

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
