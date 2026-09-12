import { prisma } from "@/lib/db";

export type BusinessHoursConfig = {
  timezone: string;
  activeDays: number[];
  weekdayStart: string;
  weekdayEnd: string;
  saturdayStart: string;
  saturdayEnd: string;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: "America/Bogota",
  activeDays: [1, 2, 3, 4, 5, 6],
  weekdayStart: "06:00",
  weekdayEnd: "19:00",
  saturdayStart: "07:00",
  saturdayEnd: "14:00",
};

function parseTime(value: string, fallback: string) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseTime(fallback, "06:00");
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
}

function localClock(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[get("weekday")] ?? 0,
    minutes: Number(get("hour") || 0) * 60 + Number(get("minute") || 0),
  };
}

export async function loadBusinessHours(): Promise<BusinessHoursConfig> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["workStart", "workEnd", "saturdayStart", "saturdayEnd", "awayMessageConfig"] } },
  });
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  let away: any = {};
  try { away = JSON.parse(settings.awayMessageConfig || "{}"); } catch {}

  return {
    timezone: String(away.timezone || DEFAULT_BUSINESS_HOURS.timezone),
    activeDays: Array.isArray(away.activeDays)
      ? away.activeDays.map(Number).filter((day: number) => day >= 0 && day <= 6)
      : DEFAULT_BUSINESS_HOURS.activeDays,
    weekdayStart: settings.workStart || DEFAULT_BUSINESS_HOURS.weekdayStart,
    weekdayEnd: settings.workEnd || DEFAULT_BUSINESS_HOURS.weekdayEnd,
    saturdayStart: settings.saturdayStart || DEFAULT_BUSINESS_HOURS.saturdayStart,
    saturdayEnd: settings.saturdayEnd || DEFAULT_BUSINESS_HOURS.saturdayEnd,
  };
}

export function isBusinessOpen(config: BusinessHoursConfig, date = new Date()) {
  const clock = localClock(config.timezone, date);
  if (!config.activeDays.includes(clock.day)) return false;

  const saturday = clock.day === 6;
  const start = parseTime(saturday ? config.saturdayStart : config.weekdayStart, saturday ? "07:00" : "06:00");
  const end = parseTime(saturday ? config.saturdayEnd : config.weekdayEnd, saturday ? "14:00" : "19:00");
  if (start === end) return true;
  return start < end
    ? clock.minutes >= start && clock.minutes < end
    : clock.minutes >= start || clock.minutes < end;
}

export async function getBusinessHoursStatus(date = new Date()) {
  const config = await loadBusinessHours();
  return { config, open: isBusinessOpen(config, date) };
}
