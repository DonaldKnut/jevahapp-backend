/**
 * Type declaration for @clerk/backend when the package has no bundled types.
 */
declare module "@clerk/backend" {
  export function verifyToken(token: string, options?: unknown): Promise<{ sub: string }>;
}
