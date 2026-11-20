// A wish's return day as an iCalendar file (RFC 5545) for the visitor's own calendar app. It names the category
// only: calendars often sync to a cloud service, and the wish's words stay on this device (spec story 54).
import type { Wish } from './wish';

const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const compact = (date: string) => date.replaceAll('-', '');
const bytes = (text: string) => new TextEncoder().encode(text).length;

/** RFC 5545 §3.1: lines over 75 octets continue on the next line after a space, never inside a character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    if (bytes(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  return [...parts, current].join('\r\n ');
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function wishCalendar(wish: Wish, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//youju-shansi//wish//ZH', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${wish.id}@youju-shansi`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(wish.returnOn)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(wish.returnOn))}`,
    `SUMMARY:${escape(`回有据山寺还愿（${wish.category}）`)}`,
    `DESCRIPTION:${escape(`${wish.madeOn} 许的愿到了你自己定的还愿日。心愿原文只存在你许愿的那台设备上。`)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', `DESCRIPTION:${escape('今天回有据山寺还愿')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
