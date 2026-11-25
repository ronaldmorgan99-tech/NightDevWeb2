const controlCharPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Removes every `<...>` run (from a `<` to the next `>`), the same result as
 * `value.replace(/<[^>]*>/g, '')`, but in linear time. The regex backtracks
 * quadratically on input like "<<<<<<..." with no closing `>` (CodeQL ReDoS).
 */
export function stripHtmlTags(value: string): string {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open === -1) break;
    const close = value.indexOf('>', open + 1);
    if (close === -1) break;
    out += value.slice(index, open);
    index = close + 1;
  }
  return out + value.slice(index);
}

export function sanitizeUserText(value: string): string {
  return stripHtmlTags(value.replace(controlCharPattern, ''))
    .replace(/\r\n/g, '\n')
    .trim();
}
