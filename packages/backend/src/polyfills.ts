// Backstage backend-app-api uses Array.prototype.toSorted (ES2023); polyfill for Node 18.
if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value<T>(this: readonly T[], compareFn?: (a: T, b: T) => number): T[] {
      return [...this].sort(compareFn);
    },
    configurable: true,
    writable: true,
  });
}
