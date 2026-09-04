import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeMessage } from './commit-format.js';

const path = process.argv[2];
if (!path) throw new Error('Informe o caminho do arquivo da mensagem de commit.');
const original = readFileSync(path, 'utf8');
const normalized = normalizeMessage(original);
if (normalized !== original) writeFileSync(path, normalized, 'utf8');
