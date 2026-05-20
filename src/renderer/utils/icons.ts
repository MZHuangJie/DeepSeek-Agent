export interface FileIconInfo {
  text: string;
  color: string;
  bg?: string;
}

export function getFileIconInfo(name: string): FileIconInfo {
  const lower = name.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';

  // specific filenames first
  if (lower === 'package.json') return { text: '{ }', color: '#e5c07b' };
  if (lower === 'tsconfig.json') return { text: '{ }', color: '#4fc1ff' };
  if (lower === '.gitignore') return { text: '◆', color: '#808080' };
  if (lower === '.npmrc' || lower === 'npm') return { text: 'npm', color: '#e8423f' };
  if (lower === 'dockerfile') return { text: '🐳', color: '#2496ed' };
  if (lower === 'makefile') return { text: 'Mk', color: '#d4d4d4' };
  if (lower === 'readme.md') return { text: 'M↓', color: '#519aba' };

  // by extension
  const map: Record<string, FileIconInfo> = {
    ts: { text: 'TS', color: '#4fc1ff' },
    tsx: { text: 'TS', color: '#4fc1ff' },
    js: { text: 'JS', color: '#f1e05a' },
    jsx: { text: 'JS', color: '#f1e05a' },
    mjs: { text: 'JS', color: '#f1e05a' },
    json: { text: '{ }', color: '#4fc1ff' },
    css: { text: '#', color: '#42a5f5' },
    scss: { text: 'S', color: '#f06292' },
    sass: { text: 'S', color: '#f06292' },
    less: { text: 'less', color: '#2b4c7e' },
    html: { text: '<>', color: '#e44d26' },
    htm: { text: '<>', color: '#e44d26' },
    xml: { text: '<>', color: '#ff6600' },
    svg: { text: 'SVG', color: '#ffca28' },
    png: { text: '🖼', color: '#c586c0' },
    jpg: { text: '🖼', color: '#c586c0' },
    jpeg: { text: '🖼', color: '#c586c0' },
    gif: { text: '🖼', color: '#c586c0' },
    webp: { text: '🖼', color: '#c586c0' },
    ico: { text: '🖼', color: '#c586c0' },
    md: { text: 'M↓', color: '#519aba' },
    mdx: { text: 'M↓', color: '#519aba' },
    py: { text: 'PY', color: '#ffd845' },
    pyc: { text: 'PY', color: '#ffd845' },
    rs: { text: 'RS', color: '#dea584' },
    go: { text: 'GO', color: '#00add8' },
    java: { text: 'JA', color: '#b07219' },
    c: { text: 'C', color: '#555555' },
    cpp: { text: 'C+', color: '#f34b7d' },
    h: { text: 'H', color: '#a8b9cc' },
    cs: { text: 'C#', color: '#178600' },
    php: { text: 'PHP', color: '#4f5d95' },
    rb: { text: 'RB', color: '#701516' },
    swift: { text: 'SW', color: '#ffac45' },
    kt: { text: 'KT', color: '#a97bff' },
    dart: { text: 'DT', color: '#00b4ab' },
    lua: { text: 'lua', color: '#000080' },
    sh: { text: 'SH', color: '#89e051' },
    bash: { text: 'SH', color: '#89e051' },
    zsh: { text: 'SH', color: '#89e051' },
    ps1: { text: 'PS', color: '#012456' },
    sql: { text: 'SQL', color: '#dad8d8' },
    yaml: { text: 'YML', color: '#f71e8a' },
    yml: { text: 'YML', color: '#f71e8a' },
    toml: { text: 'TOML', color: '#9c4121' },
    ini: { text: 'ini', color: '#d1d5da' },
    env: { text: 'ENV', color: '#f1e05a' },
    lock: { text: '🔒', color: '#f1e05a' },
    log: { text: 'LOG', color: '#d1d5da' },
    dockerfile: { text: '🐳', color: '#2496ed' },
    gitignore: { text: '◆', color: '#808080' },
    gitattributes: { text: '◆', color: '#808080' },
    editorconfig: { text: 'Ed', color: '#fefefe' },
    eslintignore: { text: 'Es', color: '#4b32c3' },
    prettierrc: { text: 'Pr', color: '#f7b93e' },
    babelrc: { text: 'B', color: '#f9dc3e' },
    webpack: { text: 'Wp', color: '#8dd6f9' },
    vite: { text: 'V', color: '#646cff' },
  };

  return map[ext] || { text: ext.slice(0, 3).toUpperCase(), color: '#d4d4d4' };
}
