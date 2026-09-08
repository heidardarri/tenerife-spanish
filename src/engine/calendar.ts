import { TOTAL_WEEKS } from '../data/curriculum';

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export interface CalendarInfo {
  today: string;
  dayNumber: number; // 1-based day of the course
  daysRemaining: number; // until departure
  totalDays: number;
  /** Curriculum week the calendar says the learner should be in, 1..15. */
  calendarWeek: number;
  /** Days per curriculum week after stretching/compressing to the time available. */
  daysPerWeek: number;
  /** Immersion mode starts 7 days before departure. */
  immersion: boolean;
  departed: boolean;
}

export function calendarInfo(startDate: string, departureDate: string, today: string): CalendarInfo {
  const totalDays = Math.max(TOTAL_WEEKS, daysBetween(startDate, departureDate));
  const dayNumber = Math.max(1, daysBetween(startDate, today) + 1);
  const daysRemaining = daysBetween(today, departureDate);
  const daysPerWeek = totalDays / TOTAL_WEEKS;
  const calendarWeek = Math.min(TOTAL_WEEKS, Math.max(1, Math.floor((dayNumber - 1) / daysPerWeek) + 1));
  return {
    today,
    dayNumber,
    daysRemaining,
    totalDays,
    calendarWeek,
    daysPerWeek,
    immersion: daysRemaining <= 7,
    departed: daysRemaining < 0,
  };
}
