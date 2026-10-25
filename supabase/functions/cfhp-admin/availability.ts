export const BUFFER_MS = 10 * 60_000;
export function availableStarts(dayStart: number, closeMinute: number, durationMinutes: number, busy: {start: string; end: string}[], now: number) {
 const result: string[] = [];
 for (let minute = 450; minute + durationMinutes <= closeMinute; minute += 5) {
  const start = dayStart + minute * 60_000, end = start + durationMinutes * 60_000;
  if (start < now + 3_600_000) continue;
  if (!busy.some(block => start < Date.parse(block.end) + BUFFER_MS && end + BUFFER_MS > Date.parse(block.start))) result.push(new Date(start).toISOString());
 }
 return result;
}
