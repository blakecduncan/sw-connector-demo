import { Buffer } from "buffer";

// Provide Node.js Buffer globally for libraries expecting it in a browser context.
// Vite tree-shakes this efficiently; it only adds when Buffer is referenced.
// Ensure this runs before other imports that rely on Buffer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Buffer === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = Buffer;
}
