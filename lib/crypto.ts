const ALGORITHM = 'AES-GCM';

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }

  const keyBytes = Uint8Array.from(
    Buffer.from(secret, 'base64')
  );

  if (keyBytes.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 32 bytes'
    );
  }

  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    {
      name: ALGORITHM,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(
  data: unknown
): Promise<string> {
  const key = await getKey();

  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const plaintext = new TextEncoder().encode(
    JSON.stringify(data)
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintext)
  );

  return JSON.stringify({
    iv: Buffer.from(iv).toString('base64'),
    data: Buffer.from(encrypted).toString('base64'),
  });
}

export async function decryptJson<T>(
  payload: string
): Promise<T> {
  const key = await getKey();

  const { iv, data } = JSON.parse(payload);

  const ivBytes = Uint8Array.from(
    Buffer.from(iv, 'base64')
  );

  const encryptedBytes = Uint8Array.from(
    Buffer.from(data, 'base64')
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: toArrayBuffer(ivBytes),
    },
    key,
    toArrayBuffer(encryptedBytes)
  );

  return JSON.parse(
    new TextDecoder().decode(decrypted)
  ) as T;
}