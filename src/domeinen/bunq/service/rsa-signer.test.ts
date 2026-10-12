import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createRsaSigner, publicKeyToPem } from './rsa-signer';

/**
 * Checked against Node's own OpenSSL: if Node reads the key and accepts the signature, bunq's
 * server (which uses the same standards) will too.
 */
describe('createRsaSigner', () => {
  const signer = createRsaSigner((length) => new Uint8Array(randomBytes(length)));
  let keys: { publicKeyPem: string; privateKey: string };

  beforeAll(async () => {
    keys = await signer.generateKeyPair();
  }, 60_000);

  it('makes a 2048-bit RSA public key in the PEM format bunq expects', () => {
    const publicKey = createPublicKey(keys.publicKeyPem);

    expect(keys.publicKeyPem).toMatch(
      /^-----BEGIN PUBLIC KEY-----\n[\s\S]+\n-----END PUBLIC KEY-----\n$/,
    );
    expect(publicKey.asymmetricKeyType).toBe('rsa');
    expect(publicKey.asymmetricKeyDetails?.modulusLength).toBe(2048);
  });

  it('signs the exact body with SHA-256 and PKCS #1 v1.5', async () => {
    const body = '{"secret":"api-key","description":"Mieruka – €"}';

    const signature = await signer.sign(keys.privateKey, body);

    const publicKey = createPublicKey(keys.publicKeyPem);
    expect(
      verify('sha256', Buffer.from(body, 'utf8'), publicKey, Buffer.from(signature, 'base64')),
    ).toBe(true);
    expect(
      verify('sha256', Buffer.from(`${body} `), publicKey, Buffer.from(signature, 'base64')),
    ).toBe(false);
  });

  it('refuses a damaged private key', async () => {
    await expect(signer.sign('{"n":"abc"}', 'body')).rejects.toThrow('damaged');
  });
});

describe('publicKeyToPem', () => {
  it('encodes the modulus and exponent so they read back unchanged', () => {
    // A modulus with the high bit set needs a leading zero byte in DER.
    const n = (1n << 2047n) + 12345n;
    const jwk = createPublicKey(publicKeyToPem(n, 65537n)).export({ format: 'jwk' });

    expect(BigInt(`0x${Buffer.from(jwk.n ?? '', 'base64url').toString('hex')}`)).toBe(n);
    expect(jwk.e).toBe('AQAB');
  });
});
