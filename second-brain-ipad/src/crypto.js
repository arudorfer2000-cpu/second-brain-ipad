// Vault crypto: Argon2id key derivation + XChaCha20-Poly1305. Runs fully on the device.
import sodiumLib from 'libsodium-wrappers-sumo';
let sodium;
export async function ready() { if (!sodium) { await sodiumLib.ready; sodium = sodiumLib; } return sodium; }
const OPS = 3, MEM = 64 * 1024 * 1024; // 64 MB: strong enough, safe on an iPad
export function normalizeSecret(s) { return String(s).normalize('NFKC'); }
export function validateSecret(s) {
  const n = normalizeSecret(s);
  if (/^\d{6}$/.test(n)) return { ok: true, kind: 'passcode' };
  if (n.length >= 10 && n.length <= 128 && !/^\d+$/.test(n)) return { ok: true, kind: 'passphrase' };
  return { ok: false, error: 'Use exactly 6 digits, or a passphrase of 10 to 128 characters.' };
}
const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
const unb64 = (s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);
function derive(secret, salt, ops = OPS, mem = MEM) {
  return sodium.crypto_pwhash(32, normalizeSecret(secret), salt, ops, mem, sodium.crypto_pwhash_ALG_ARGON2ID13);
}
function aeadSeal(key, bytes, ad) {
  const n = sodium.randombytes_buf(24);
  const c = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(bytes, ad || null, null, n, key);
  return { n: b64(n), c: b64(c) };
}
function aeadOpen(key, rec, ad) {
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, unb64(rec.c), ad || null, unb64(rec.n), key);
}
const RK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function recoveryText(bytes) { // 32 symbols (160 bits of entropy) in 8 groups of 4
  let out = ''; for (const b of bytes) out += RK_ALPHABET[b & 31]; // 5 bits of each byte
  // symbol = 5 random bits
  return out.match(/.{1,4}/g).join('-');
}
function recoveryKey(text) { return sodium.crypto_generichash(32, 'sbipad-recovery:' + text.replace(/[^A-Z2-9]/gi, '').toUpperCase()); }
export async function createVault(secret) {
  await ready();
  const v = validateSecret(secret); if (!v.ok) throw new Error(v.error);
  const master = sodium.randombytes_buf(32);
  const salt = sodium.randombytes_buf(16);
  const pass = derive(secret, salt);
  const rkText = recoveryText(sodium.randombytes_buf(32));
  const meta = { v: 1, kdf: { ops: OPS, mem: MEM }, salt: b64(salt), wrapped: aeadSeal(pass, master, 'master'), recovery: aeadSeal(recoveryKey(rkText), master, 'master') };
  return { master, meta, recoveryKey: rkText };
}
export async function unlock(meta, secret) {
  await ready();
  try { return aeadOpen(derive(secret, unb64(meta.salt), meta.kdf.ops, meta.kdf.mem), meta.wrapped, 'master'); } catch { return null; }
}
export async function unlockWithRecovery(meta, text) {
  await ready();
  try { return aeadOpen(recoveryKey(text), meta.recovery, 'master'); } catch { return null; }
}
export async function changeSecret(meta, master, newSecret) {
  await ready();
  const v = validateSecret(newSecret); if (!v.ok) throw new Error(v.error);
  const salt = sodium.randombytes_buf(16);
  return { ...meta, kdf: { ops: OPS, mem: MEM }, salt: b64(salt), wrapped: aeadSeal(derive(newSecret, salt), master, 'master') };
}
export async function newRecovery(meta, master) {
  await ready();
  const text = recoveryText(sodium.randombytes_buf(32));
  return { meta: { ...meta, recovery: aeadSeal(recoveryKey(text), master, 'master') }, recoveryKey: text };
}
export async function seal(master, obj) { await ready(); return aeadSeal(master, sodium.from_string(JSON.stringify(obj)), 'note'); }
export async function open(master, rec) { await ready(); return JSON.parse(sodium.to_string(aeadOpen(master, rec, 'note'))); }
export async function randomId() { await ready(); return sodium.to_hex(sodium.randombytes_buf(12)); }
export async function sealBytes(master, bytes) { await ready(); const n = sodium.randombytes_buf(24); return { n, c: sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(bytes, 'file', null, n, master) }; }
export async function openBytes(master, rec) { await ready(); return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, rec.c, 'file', rec.n, master); }
export async function toB64(u8) { await ready(); return b64(u8); }
export async function fromB64(s) { await ready(); return unb64(s); }
