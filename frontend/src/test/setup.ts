import "@testing-library/jest-dom/vitest";

// Radix UI (e.g. Tooltip) uses ResizeObserver internally, which jsdom doesn't provide
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
