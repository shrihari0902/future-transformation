// Canonical JSON stringification (RFC 8785 style / deterministic)
export function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate device ECDSA P-256 keypair
export async function generateDeviceKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // Extractable so public key and persistent private key can be saved in local IndexedDB
    ['sign', 'verify']
  );

  const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const public_key_spki = arrayBufferToBase64(spkiBuffer);

  return {
    keyPair,
    public_key_spki,
  };
}

// Import public key from SPKI Base64
export async function importPublicKeyFromSpki(spkiBase64) {
  const buffer = base64ToArrayBuffer(spkiBase64);
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

// Sign canonical payload with ECDSA P-256 private key
export async function signPayload(privateKey, payload) {
  const canonical = canonicalStringify(payload);
  const data = new TextEncoder().encode(canonical);

  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signatureBuffer);
}

// Verify payload signature with ECDSA P-256 public key
export async function verifySignature(publicKeyOrSpki, payload, signatureBase64) {
  try {
    let publicKey = publicKeyOrSpki;
    if (typeof publicKeyOrSpki === 'string') {
      publicKey = await importPublicKeyFromSpki(publicKeyOrSpki);
    }

    const canonical = canonicalStringify(payload);
    const data = new TextEncoder().encode(canonical);
    const sigBuffer = base64ToArrayBuffer(signatureBase64);

    return await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      sigBuffer,
      data
    );
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// Compute SHA-256 hex digest
export async function computeSha256Hex(textOrObj) {
  const text = typeof textOrObj === 'string' ? textOrObj : canonicalStringify(textOrObj);
  const data = new TextEncoder().encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
