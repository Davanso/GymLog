import { validateHeader } from './scripts/commit-format.js';

export default {
  plugins: [{ rules: { 'project-format': ({ header }) => validateHeader(header) } }],
  rules: { 'project-format': [2, 'always'] },
};
