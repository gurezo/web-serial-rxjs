/**
 * Exhaustiveness helper for internal switch statements.
 *
 * @deprecated Not part of the canonical public API. Define a local helper in
 *   application code, or use `switch (state.status)` with
 *   {@link SerialSessionStatus}. Still available in v4; will be removed from
 *   public exports in a future major (v5+).
 * @internal
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
