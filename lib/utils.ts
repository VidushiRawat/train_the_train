import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');

/** 1044 -> "17:24". Wraps past midnight. */
export function formatTimeOfDay(minutesSinceMidnight: number) {
  const total = ((Math.round(minutesSinceMidnight) % 1440) + 1440) % 1440;
  return `${pad(total / 60)}:${pad(total % 60)}`;
}

/** 59535 -> "16:32:15". Wraps past midnight. */
export function formatClock(secondsSinceMidnight: number) {
  const total = ((Math.floor(secondsSinceMidnight) % 86400) + 86400) % 86400;
  return `${pad(total / 3600)}:${pad((total % 3600) / 60)}:${pad(total % 60)}`;
}

/** 14 -> "+14 min", 0 -> "on time". */
export function formatDelay(minutes: number) {
  if (minutes <= 0) return 'on time';
  return `+${minutes} min`;
}

export function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}
