// Backstage test backend uses Array.prototype.toSorted (ES2023); Node 18 lacks it.
if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value<T>(this: readonly T[], compareFn?: (a: T, b: T) => number): T[] {
      return [...this].sort(compareFn);
    },
    configurable: true,
    writable: true,
  });
}

export {};
