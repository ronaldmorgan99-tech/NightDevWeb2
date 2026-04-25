const htmlTagPattern = /<[^>]*>/g;
const controlCharPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeUserText(value: string): string {
  return value
    .replace(controlCharPattern, '')
    .replace(htmlTagPattern, '')
    .replace(/\r\n/g, '\n')
    .trim();
}
