import { validateHeader } from './tools/git/commitFormat.js';

export default {
  plugins: [{ rules: { 'project-format': ({ header }) => validateHeader(header) } }],
  rules: { 'project-format': [2, 'always'] },
};
