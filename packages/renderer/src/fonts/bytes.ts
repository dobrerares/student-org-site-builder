// Base64 -> bytes. Uses the platform `atob` (Node 18+ and every browser),
// never Node's `Buffer` (ADR 0004 keeps this package runtime-agnostic so the
// same code runs in the build pipeline and the editor preview iframe).

/** Decode a base64 string to its raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
