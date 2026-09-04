import { defineConfig } from 'oxfmt';

export default defineConfig({
  $schema: './node_modules/oxfmt/configuration_schema.json',
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 100,
  singleQuote: true,
  tabWidth: 2,
  ignorePatterns: [
    'coverage',
    'dist',
    'distServer',
    'node_modules',
    'playwright-report',
    'static',
    'test-results',
    'terraform',
    '*.html',
    '*.md',
    '*.yml',
  ],
  sortPackageJson: false,
});
