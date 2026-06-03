/**
 * Escapes a string for use as a CSS class name selector.
 *
 * Characters that are not [a-zA-Z0-9-] are replaced with
 * `\` + hex code + space (the space terminates the escape sequence,
 * preventing the next character from being consumed as part of the code).
 *
 * Examples:
 *   escapeForCssClass('package.json')  → 'package\\2e json'
 *   escapeForCssClass('7z')            → '\\37 z'
 *   escapeForCssClass('node_modules')  → 'node\\5f modules'
 */
export function escapeForCssClass(name: string): string {
  let result = '';
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    const code = name.charCodeAt(i);
    if (
      (code >= 48 && code <= 57) ||  // 0-9
      (code >= 65 && code <= 90) ||  // A-Z
      (code >= 97 && code <= 122) || // a-z
      code === 45                     // hyphen
    ) {
      result += ch;
    } else {
      result += '\\' + code.toString(16) + ' ';
    }
  }
  return result;
}
