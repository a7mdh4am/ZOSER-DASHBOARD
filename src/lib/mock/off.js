// Stands in for the dummy API when it's switched off (production builds, see
// vite.config.js): api.js then talks to the real server and never calls this.
export function mockFetch() {
  throw new Error("The dummy API is switched off in this build");
}
