import { keygen, PKCS1_SHA256, type PrivateKey } from 'micro-rsa-dsa-dh/rsa.js';
import type { RandomBytes } from '@/shared/platform/ports';

/**
 * The key pair of an installation and the signatures bunq asks for (docs/decisions/0018). A port,
 * so the slow key generation can be replaced by a native one without touching the rest.
 */
export type RequestSigner = {
  /** A fresh 2048-bit RSA key pair. `privateKey` is an opaque string, stored as is. */
  generateKeyPair(): Promise<{ publicKeyPem: string; privateKey: string }>;
  /** Base64 of the RSA PKCS #1 v1.5 SHA-256 signature over the UTF-8 bytes of `data`. */
  sign(privateKey: string, data: string): Promise<string>;
};

const KEY_BITS = 2048;

function toBase64(bytes: ArrayLike<number>): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function hexToBigInt(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

// DER, just enough for an RSA SubjectPublicKeyInfo (RFC 5280 and RFC 8017, appendix A.1.1).
function derLength(length: number): number[] {
  if (length < 0x80) {
    return [length];
  }
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 0x100)) {
    bytes.unshift(rest % 0x100);
  }
  return [0x80 | bytes.length, ...bytes];
}

function der(tag: number, content: number[]): number[] {
  return [tag, ...derLength(content.length), ...content];
}

function derInteger(value: bigint): number[] {
  const hex = value.toString(16);
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = (padded.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
  // A set high bit would make the integer negative.
  return der(0x02, (bytes[0] ?? 0) >= 0x80 ? [0x00, ...bytes] : bytes);
}

const RSA_ENCRYPTION = [
  0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
];

/** The public key as PEM ("BEGIN PUBLIC KEY"), the format bunq asks for at installation. */
export function publicKeyToPem(n: bigint, e: bigint): string {
  const rsaPublicKey = der(0x30, [...derInteger(n), ...derInteger(e)]);
  const spki = der(0x30, [...der(0x30, RSA_ENCRYPTION), ...der(0x03, [0x00, ...rsaPublicKey])]);
  const lines = toBase64(spki).match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
}

function serializePrivateKey(key: { n: bigint; d: bigint }): string {
  return JSON.stringify({ n: key.n.toString(16), d: key.d.toString(16) });
}

function parsePrivateKey(value: string): PrivateKey {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('n' in parsed) ||
    !('d' in parsed) ||
    typeof parsed.n !== 'string' ||
    typeof parsed.d !== 'string'
  ) {
    throw new Error('The stored private key is damaged');
  }
  // Without `e` the library signs without blinding. Blinding protects against someone timing
  // signatures over messages they choose; here the app only signs its own request bodies, a few
  // times a week. It would also need a global `crypto.getRandomValues`, which React Native lacks.
  return { n: hexToBigInt(parsed.n), d: hexToBigInt(parsed.d) };
}

/**
 * RSA in plain TypeScript (micro-rsa-dsa-dh, BigInt). Signing is quick; generating a key takes
 * seconds on a phone and blocks the JS thread meanwhile, so it happens once, when connecting.
 */
export function createRsaSigner(randomBytes: RandomBytes): RequestSigner {
  return {
    async generateKeyPair() {
      const { publicKey, privateKey } = keygen(KEY_BITS, undefined, randomBytes);
      return {
        publicKeyPem: publicKeyToPem(publicKey.n, publicKey.e),
        privateKey: serializePrivateKey(privateKey),
      };
    },

    async sign(privateKey, data) {
      const signature = PKCS1_SHA256.sign(
        parsePrivateKey(privateKey),
        new TextEncoder().encode(data),
      );
      return toBase64(signature);
    },
  };
}
