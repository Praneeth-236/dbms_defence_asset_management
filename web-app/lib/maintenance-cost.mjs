const DECIMAL_15_2 = /^\d+(?:\.\d{1,2})?$/;

export function isDecimal15Scale2(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > 16 || !DECIMAL_15_2.test(normalized)) return false;
  const integerDigits = normalized.split(".")[0].replace(/^0+/, "");
  return integerDigits.length <= 13;
}
