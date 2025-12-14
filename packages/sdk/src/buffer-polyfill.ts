/**
 * Buffer polyfill for browser environments
 * This ensures Buffer is available in both Node.js and browser contexts
 */

if (typeof window !== "undefined" && !window.Buffer) {
  // Browser environment - make Buffer available globally
  const { Buffer } = require("buffer");
  (window as any).Buffer = Buffer;
  (global as any).Buffer = Buffer;
}

export {};

