/**
 * Exhaustiveness helper for internal switch statements.
 *
 * @internal
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
