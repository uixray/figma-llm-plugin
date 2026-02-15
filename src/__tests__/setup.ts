/**
 * Jest setup file
 * Mocks Figma API for testing
 */

// Silence console during tests to reduce noise
const noop = () => {};
console.log = noop;
console.warn = noop;
console.debug = noop;
console.info = noop;
