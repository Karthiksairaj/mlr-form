export type LogTone = 'blue' | 'cyan' | 'green' | 'magenta' | 'red' | 'yellow' | 'dim';

const ansiCodes: Record<LogTone, number> = {
  blue: 34,
  cyan: 36,
  green: 32,
  magenta: 35,
  red: 31,
  yellow: 33,
  dim: 90
};

function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined || process.env.FORCE_COLOR === '0') return false;
  return process.env.FORCE_COLOR !== undefined || Boolean(process.stdout.isTTY);
}

export function terminalColor(text: string, tone: LogTone): string {
  return colorEnabled() ? `\u001B[${ansiCodes[tone]}m${text}\u001B[0m` : text;
}
