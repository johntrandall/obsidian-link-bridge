// Run: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildObsidianUri } = require('../public/obsidian.js');

test('Advanced URI link that opens a new tab', () => {
  const r = buildObsidianUri('#vault=events&filepath=events%2F_events.base&openmode=tab');
  assert.equal(r.uri, 'obsidian://advanced-uri?vault=events&filepath=events%2F_events.base&openmode=tab');
  assert.equal(r.target, 'events/_events.base');
});

test('core obsidian://open link', () => {
  const r = buildObsidianUri('#vault=Notes&file=inbox%2FMy%20Note');
  assert.equal(r.uri, 'obsidian://open?vault=Notes&file=inbox%2FMy%20Note');
});

test('spaces, plus signs and unicode survive', () => {
  const r = buildObsidianUri('#vault=My%20Vault&filepath=' + encodeURIComponent('a+b/Café — x.md'));
  assert.equal(r.target, 'a+b/Café — x.md');
  assert.equal(r.uri, 'obsidian://advanced-uri?vault=My%20Vault&filepath=' + encodeURIComponent('a+b/Café — x.md'));
});

test('command and write parameters are refused', () => {
  assert.match(buildObsidianUri('#vault=v&filepath=x.md&commandid=app%3Areload').error, /refused: commandid/);
  assert.match(buildObsidianUri('#vault=v&filepath=x.md&data=hi&mode=overwrite').error, /refused: data, mode/);
  assert.match(buildObsidianUri('#vault=v&file=x&openmode=tab').error, /refused: openmode/);
});

test('no note, empty, repeated or broken input is refused', () => {
  assert.ok(buildObsidianUri('').error);
  assert.ok(buildObsidianUri('#vault=v').error);
  assert.ok(buildObsidianUri('#vault=v&filepath=a&filepath=b').error);
  assert.ok(buildObsidianUri('#vault=v&filepath=%E0%A4%A').error);
  assert.ok(buildObsidianUri('#filepath=').error);
  assert.match(buildObsidianUri('#filepath=&filepath=x.md').error, /repeats/);
  assert.ok(buildObsidianUri('#vault=v&file=').error);
  assert.match(buildObsidianUri('#filepath=x.md&__proto__=1').error, /refused: __proto__/);
});

test('result is always an obsidian:// URI with a fixed action', () => {
  const r = buildObsidianUri('#filepath=javascript%3Aalert(1)');
  assert.ok(r.uri.startsWith('obsidian://advanced-uri?'));
});
