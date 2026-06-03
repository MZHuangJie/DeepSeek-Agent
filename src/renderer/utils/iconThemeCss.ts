import { escapeForCssClass } from './cssEscape';

/* ================================================================
   TypeScript interfaces matching VS Code's IconThemeDocument schema
   ================================================================ */

export interface IconFontDefinition {
  id: string;
  src: Array<{ path: string; format: string }>;
  weight: string;
  style: string;
  size?: string;
}

export interface IconDefinition {
  fontCharacter: string;
  fontColor?: string;
  fontSize?: string;
  fontId?: string;
}

export interface IconThemeLightOverride {
  iconDefinitions?: Record<string, Partial<IconDefinition>>;
}

export interface IconThemeDocument {
  id: string;
  label: string;
  description?: string;
  fonts: IconFontDefinition[];
  iconDefinitions: Record<string, IconDefinition>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  light?: IconThemeLightOverride;
}

/* ================================================================
   CSS Generation — port of VS Code's processIconThemeDocument()
   ================================================================ */

const SCOPE = '.show-file-icons';
const BASE_FONT_SIZE_PX = 13;

/**
 * Normalizes a font-size value to a percentage (relative to 13px base),
 * matching VS Code's tryNormalizeFontSize().
 *   - "14px" → "108%"
 *   - "150%" → "150%"  (pass-through)
 */
function normalizeFontSize(size: string | undefined): string {
  if (!size) return '150%';
  if (size.endsWith('px')) {
    const value = parseInt(size, 10);
    if (!isNaN(value)) {
      return Math.round((value / BASE_FONT_SIZE_PX) * 100) + '%';
    }
  }
  return size;
}

function buildIconRule(selector: string, def: IconDefinition): string {
  const parts: string[] = [];
  parts.push(`${selector} {`);
  parts.push(`  content: '${def.fontCharacter}';`);
  if (def.fontColor) {
    parts.push(`  color: ${def.fontColor};`);
  }
  if (def.fontId) {
    parts.push(`  font-family: '${def.fontId}';`);
  }
  if (def.fontSize) {
    parts.push(`  font-size: ${normalizeFontSize(def.fontSize)};`);
  }
  parts.push('}');
  return parts.join('\n');
}

/**
 * Generates a complete CSS stylesheet string from an icon theme document.
 * The returned CSS should be injected into a <style> element in <head>.
 */
export function generateIconThemeCss(theme: IconThemeDocument): string {
  const rules: string[] = [];
  const defaultFont = theme.fonts[0];
  const fontId = defaultFont?.id ?? 'seti';

  // ---- @font-face declarations ----
  for (const font of theme.fonts) {
    const srcEntries = font.src
      .map(s => `url('${s.path}') format('${s.format}')`)
      .join(', ');
    rules.push(
      '@font-face {',
      `  font-family: '${font.id}';`,
      `  src: ${srcEntries};`,
      `  font-weight: ${font.weight};`,
      `  font-style: ${font.style};`,
      '  font-display: block;',
      '}',
    );
  }

  // ---- Base rules (matching VS Code's iconlabel.css) ----
  // VS Code keeps font-family + font-size in the base rule from the theme,
  // and all layout properties come from iconlabel.css.
  const defaultFontSize = normalizeFontSize(defaultFont?.size);

  // Base layout (matches .monaco-icon-label::before in iconlabel.css)
  rules.push(
    `${SCOPE} .file-icon::before,`,
    `${SCOPE} .folder-icon::before {`,
    `  font-family: '${fontId}';`,
    `  font-size: ${defaultFontSize};`,
    '  display: inline-block;',
    '  width: 16px;',
    '  height: 22px;',
    '  line-height: inherit !important;',
    '  vertical-align: top;',
    '  flex-shrink: 0;',
    '  -webkit-font-smoothing: antialiased;',
    '  -moz-osx-font-smoothing: grayscale;',
    '}',
  );

  // Default file icon
  const defaultFileId = theme.file ?? '_file';
  const defaultFileDef = theme.iconDefinitions[defaultFileId];
  if (defaultFileDef) {
    rules.push(buildIconRule(`${SCOPE} .file-icon::before`, defaultFileDef));
  }

  // Default folder icon
  const defaultFolderId = theme.folder ?? '_folder';
  const defaultFolderDef = theme.iconDefinitions[defaultFolderId];
  if (defaultFolderDef) {
    rules.push(buildIconRule(`${SCOPE} .folder-icon::before`, defaultFolderDef));
  }

  // ---- Extension-based rules ----
  for (const [ext, iconId] of Object.entries(theme.fileExtensions)) {
    const def = theme.iconDefinitions[iconId];
    if (!def) continue;
    const escapedExt = escapeForCssClass(ext);
    rules.push(
      buildIconRule(
        `${SCOPE} .${escapedExt}-ext-file-icon.ext-file-icon.file-icon::before`,
        def,
      ),
    );
  }

  // ---- Filename-based rules (AFTER extensions for source-order priority) ----
  // Use 3-class compound selectors to match specificity of extension rules
  // (.xxx-ext-file-icon.ext-file-icon.file-icon), ensuring source-order override.
  for (const [name, iconId] of Object.entries(theme.fileNames)) {
    const def = theme.iconDefinitions[iconId];
    if (!def) continue;
    const escapedName = escapeForCssClass(name);
    rules.push(
      buildIconRule(
        `${SCOPE} .${escapedName}-name-file-icon.name-file-icon.file-icon::before`,
        def,
      ),
    );
  }

  // ---- Folder-name rules ----
  for (const [folderName, iconId] of Object.entries(theme.folderNames)) {
    const def = theme.iconDefinitions[iconId];
    if (!def) continue;
    const escapedName = escapeForCssClass(folderName);
    rules.push(
      buildIconRule(
        `${SCOPE} .${escapedName}-name-folder-icon.name-folder-icon.folder-icon::before`,
        def,
      ),
    );
  }

  // ---- Light theme overrides ----
  if (theme.light?.iconDefinitions) {
    const lightPrefix = '[data-theme="light"] ';
    for (const [iconId, overrides] of Object.entries(theme.light.iconDefinitions)) {
      const baseDef = theme.iconDefinitions[iconId];
      const def: IconDefinition = { ...baseDef, ...overrides };
      if (!def.fontCharacter) continue;

      // Override default file
      if (iconId === defaultFileId) {
        rules.push(buildIconRule(lightPrefix + `${SCOPE} .file-icon::before`, def));
      }
      // Override default folder
      if (iconId === defaultFolderId) {
        rules.push(buildIconRule(lightPrefix + `${SCOPE} .folder-icon::before`, def));
      }

      // Override extension rules
      for (const [ext, mappedId] of Object.entries(theme.fileExtensions)) {
        if (mappedId !== iconId) continue;
        const escapedExt = escapeForCssClass(ext);
        rules.push(
          buildIconRule(
            lightPrefix + `${SCOPE} .${escapedExt}-ext-file-icon.ext-file-icon.file-icon::before`,
            def,
          ),
        );
      }

      // Override filename rules (3-class selector to match specificity)
      for (const [name, mappedId] of Object.entries(theme.fileNames)) {
        if (mappedId !== iconId) continue;
        const escapedName = escapeForCssClass(name);
        rules.push(
          buildIconRule(
            lightPrefix + `${SCOPE} .${escapedName}-name-file-icon.name-file-icon.file-icon::before`,
            def,
          ),
        );
      }
    }
  }

  return rules.join('\n');
}
