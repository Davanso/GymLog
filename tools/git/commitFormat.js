export const commitEmojis = {
  feat: ['✨', ':sparkles:'],
  fix: ['🐛', ':bug:'],
  docs: ['📚', ':books:'],
  style: ['💎', ':gem:'],
  refactor: ['♻️', ':recycle:'],
  perf: ['⚡', ':zap:'],
  test: ['🚨', ':rotating_light:'],
  chore: ['🔧', ':wrench:'],
  'chore(release)': ['🚀', ':rocket:'],
  'chore(deps)': ['🔗', ':link:'],
  build: ['📦', ':package:'],
  ci: ['👷', ':construction_worker:'],
  release: ['🚀', ':rocket:'],
  security: ['🔒', ':lock:'],
  i18n: ['🌐', ':globe_with_meridians:'],
  breaking: ['💥', ':boom:'],
  config: ['⚙️', ':gear:'],
  add: ['➕', ':heavy_plus_sign:'],
  remove: ['➖', ':heavy_minus_sign:'],
};

function parseHeader(header) {
  const match =
    /^(?<type>[a-z][a-z0-9]*)(?:\((?<scope>[a-z0-9][a-z0-9._/-]*)\))?(?<breaking>!)?:\s+(?<subject>.*)$/.exec(
      header,
    );
  if (!match) return null;
  const { type, scope, subject } = match.groups;
  const emoji = (commitEmojis[`${type}(${scope})`] ?? commitEmojis[type])?.[0];
  return emoji ? { emoji, subject, prefix: header.slice(0, header.indexOf(':') + 1) } : null;
}

const tokens = [...new Set(Object.values(commitEmojis).flat())]
  .flatMap((token) => [token, token.replaceAll('\uFE0F', '')])
  .sort((a, b) => b.length - a.length);

export function normalizeMessage(message) {
  const end = message.search(/[\r\n]/);
  const header = end === -1 ? message : message.slice(0, end);
  const rest = end === -1 ? '' : message.slice(end);
  const parsed = parseHeader(header);
  if (!parsed) return message;
  let subject = parsed.subject.trim();
  // Replace existing mapped emojis/codes so retries never duplicate the prefix.
  for (;;) {
    const token = tokens.find((item) => subject === item || subject.startsWith(`${item} `));
    if (!token) break;
    subject = subject.slice(token.length).trimStart();
  }
  if (!subject) return message;
  return `${parsed.prefix} ${parsed.emoji} ${subject}${rest}`;
}

export function validateHeader(header = '') {
  const parsed = parseHeader(header);
  const description = parsed?.subject.startsWith(`${parsed.emoji} `)
    ? parsed.subject.slice(parsed.emoji.length + 1).trim()
    : '';
  const valid = Boolean(description) && header.length <= 100 && !description.endsWith('.');
  return [
    valid,
    'Use tipo(escopo opcional): emoji descrição, com o emoji da tabela, até 100 caracteres e sem ponto final. Ex.: feat: ✨ adicionar treino',
  ];
}
