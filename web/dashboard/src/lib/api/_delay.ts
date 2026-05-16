export function delay<T>(value: T, ms = 0): Promise<T> {
  if (ms === 0) return Promise.resolve(value);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
