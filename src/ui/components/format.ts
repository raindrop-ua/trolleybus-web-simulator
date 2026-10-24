export function clockText(seconds: number) {
  const date = Math.floor(seconds) % 86400;
  return [Math.floor(date / 3600), Math.floor((date % 3600) / 60), date % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
export function deviationText(seconds: number) {
  if (Math.abs(seconds) < 5) return 'On time';
  const rounded = Math.round(Math.abs(seconds));
  return `${seconds > 0 ? '+' : '−'}${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
