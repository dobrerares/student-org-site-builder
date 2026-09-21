/**
 * Global vitest setup.
 *
 * React 18+ only flushes updates synchronously inside `act(...)` when the
 * runtime is told it is in a test environment. `@testing-library/react`
 * sets this flag around its own helpers, but tests that drive a root
 * directly (`createRoot` + `act`) need it set globally — otherwise React
 * logs "The current testing environment is not configured to support
 * act(...)" and effects flush unpredictably.
 *
 * Harmless for the Preact renderer's tests, which never read the flag.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
