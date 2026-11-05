const DECIMAL_10_2 = /^-?\d+(?:\.\d{1,2})?$/;
const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isDecimal10Scale2(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > 12 || !DECIMAL_10_2.test(normalized)) return false;
  const integerDigits = normalized.replace(/^-/, "").split(".")[0].replace(/^0+/, "");
  return integerDigits.length <= 8;
}

export function isDateTimeLocal(value) {
  if (typeof value !== "string") return false;
  const match = DATETIME_LOCAL.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && hour <= 23
    && minute <= 59;
}

export function toMySqlDateTime(value) {
  if (!isDateTimeLocal(value)) return null;
  return `${value.replace("T", " ")}:00`;
}
