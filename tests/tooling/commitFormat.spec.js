import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { commitEmojis, normalizeMessage, validateHeader } from '../../tools/git/commitFormat.js';

test('all mapped types and special scopes normalize and validate', () => {
  for (const [type, [emoji, code]] of Object.entries(commitEmojis)) {
    const expected = `${type}: ${emoji} atualizar projeto`;
    assert.equal(normalizeMessage(`${type}: atualizar projeto`), expected);
    assert.equal(normalizeMessage(`${type}: ${code} atualizar projeto`), expected);
    assert.equal(normalizeMessage(expected), expected);
    assert.equal(validateHeader(expected)[0], true);
  }
});

test('preserves scopes, breaking marker, multiline body and trailers', () => {
  const body = '\r\n\r\nDetalhes: não alterar ✨\r\n\r\nBREAKING CHANGE: novo formato\r\n';
  assert.equal(
    normalizeMessage(`feat(treinos)!: adicionar treino${body}`),
    `feat(treinos)!: ✨ adicionar treino${body}`,
  );
  assert.equal(normalizeMessage('chore(ci): ajustar pipeline'), 'chore(ci): 🔧 ajustar pipeline');
  assert.equal(normalizeMessage('feat: 🐛 ✨ adicionar treino'), 'feat: ✨ adicionar treino');
  assert.equal(normalizeMessage('Merge branch main'), 'Merge branch main');
});

test('rejects malformed headers and incorrect emojis', () => {
  for (const header of [
    'ajustes',
    'unknown: ✨ alterar',
    'feat: ✨ ',
    'feat: 🐛 alterar',
    'feat: ✨ alterar.',
    'feat: ✨ ' + 'a'.repeat(100),
    'Feat: ✨ alterar',
    'feat(UPPER): ✨ alterar',
  ]) {
    assert.equal(validateHeader(header)[0], false, header);
  }
});

test('real Husky hook normalizes valid messages and rejects invalid ones without commits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gymlog-commit-'));
  const path = join(dir, 'message.txt');
  try {
    for (const [message, expected, valid] of [
      ['feat: adicionar treino', 'feat: ✨ adicionar treino', true],
      ['chore(deps): atualizar pacotes', 'chore(deps): 🔗 atualizar pacotes', true],
      ['fix: 🐛 corrigir carga', 'fix: 🐛 corrigir carga', true],
      ['ajustes', 'ajustes', false],
      ['feat: ', 'feat: ', false],
    ]) {
      writeFileSync(path, message);
      const result = spawnSync('git', ['hook', 'run', 'commit-msg', '--', path], {
        encoding: 'utf8',
      });
      assert.equal(result.status === 0, valid, result.stdout + result.stderr);
      assert.equal(readFileSync(path, 'utf8'), expected);
    }
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});
