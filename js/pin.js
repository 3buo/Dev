// js/pin.js — PIN de la bóveda con PBKDF2 (WebCrypto). Nunca se guarda en claro.
const ITER = 150000;
const enc = new TextEncoder();
const bufToB64 = (buf) => { let s = ''; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); };
const b64ToBuf = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { salt: bufToB64(salt), hash: bufToB64(bits), iterations: ITER };
}

export async function verifyPin(pin, record) {
  if (!record?.hash) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBuf(record.salt), iterations: record.iterations || ITER }, key, 256);
  return bufToB64(bits) === record.hash;
}
// Requiere contexto seguro (https o localhost): WebCrypto lo exige.
