import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { test } from 'node:test';

const sourceRoots = ['api', 'server', 'src', 'tools', 'tests', 'docs', 'database/seeds'];
const camelCase = /^[a-z][a-zA-Z0-9]*(?:\.spec)?$/;

function files(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('project files use camelCase and tests use the .spec suffix', () => {
  for (const file of sourceRoots.flatMap(files)) {
    const extension = extname(file);
    const name = basename(file, extension);
    assert.match(name, camelCase, file);
    if (file.startsWith(`tests${process.platform === 'win32' ? '\\' : '/'}`))
      assert.match(name, /\.spec$/, file);
  }
});

test('every React component has a colocated stylesheet', () => {
  for (const file of files('src/components').filter((path) => path.endsWith('.tsx'))) {
    const stylesheet = file.replace(/\.tsx$/, '.css');
    assert.ok(files('src/components').includes(stylesheet), `${file} precisa de ${stylesheet}`);
  }
});
