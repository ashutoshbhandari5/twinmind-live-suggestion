import "@testing-library/jest-dom/vitest";

// jsdom does not implement layout-related DOM APIs. Stub the ones we use.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function (): void {
    /* no-op in tests */
  };
}
