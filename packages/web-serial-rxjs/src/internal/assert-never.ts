/**
 * Exhaustiveness helper for internal switch statements.
 *
 * @deprecated Not part of the canonical public API. Define a local helper in
 *   application code, or use `switch (state.status)` with
 *   {@link SerialSessionStatus}. Will be removed from public exports in the
 *   next major version.
 * @internal
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
