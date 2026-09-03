"use strict";

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split("-");
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeValue(value) {
  if (!value || typeof value !== "string") return null;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { hours, minutes };
}

export function buildShiftDateTime(fecha, hora) {
  const dateValue = parseDateValue(fecha);
  const timeValue = parseTimeValue(hora);
  if (!dateValue || !timeValue) return null;

  const result = new Date(dateValue);
  result.setHours(timeValue.hours, timeValue.minutes, 0, 0);
  return result;
}

export function getShiftWindow(shift) {
  const start = buildShiftDateTime(shift.fecha, shift.hora_inicio);
  const end = buildShiftDateTime(shift.fecha, shift.hora_fin);

  if (!start || !end) return null;

  if (end <= start) {
    const overnightEnd = new Date(end);
    overnightEnd.setDate(overnightEnd.getDate() + 1);
    return { start, end: overnightEnd };
  }

  return { start, end };
}

export function isShiftCurrent(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now >= window.start && now <= window.end;
}

export function isShiftPast(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now > window.end;
}

export function isShiftFuture(shift, now = new Date()) {
  const window = getShiftWindow(shift);
  if (!window) return false;
  return now < window.start;
}
