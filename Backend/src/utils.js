export function nowIso() {
  return new Date().toISOString();
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  return items[randomInt(0, items.length - 1)];
}

export function createId(prefix) {
  const value = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return `${prefix}-${value}`;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}
