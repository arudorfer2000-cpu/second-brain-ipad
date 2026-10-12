import test from 'node:test'; import assert from 'node:assert/strict';
import * as C from '../src/crypto.js';
test('validate secrets', () => {
  assert.equal(C.validateSecret('123456').ok, true);
  assert.equal(C.validateSecret('12345').ok, false);
  assert.equal(C.validateSecret('1234567').ok, false);
  assert.equal(C.validateSecret('short').ok, false);
  assert.equal(C.validateSecret('a long passphrase here').ok, true);
  assert.equal(C.validateSecret('x'.repeat(129)).ok, false);
  assert.equal(C.validateSecret('x'.repeat(128)).ok, true);
});
test('create, unlock, wrong secret, recovery, seal/open, change', async () => {
  const { master, meta, recoveryKey } = await C.createVault('482913');
  assert.ok(recoveryKey.length >= 39);
  const m2 = await C.unlock(meta, '482913'); assert.deepEqual(Array.from(m2), Array.from(master));
  assert.equal(await C.unlock(meta, '482914'), null);
  const m3 = await C.unlockWithRecovery(meta, recoveryKey.toLowerCase()); assert.deepEqual(Array.from(m3), Array.from(master));
  assert.equal(await C.unlockWithRecovery(meta, 'AAAA-BBBB'), null);
  const rec = await C.seal(master, { title: 'Secret title', text: 'body' });
  assert.ok(!JSON.stringify(rec).includes('Secret'));
  assert.deepEqual(await C.open(master, rec), { title: 'Secret title', text: 'body' });
  const meta2 = await C.changeSecret(meta, master, 'a new long passphrase');
  assert.equal(await C.unlock(meta2, '482913'), null);
  assert.deepEqual(Array.from(await C.unlock(meta2, 'a new long passphrase')), Array.from(master));
  // NFKC: full-width digits equal ASCII digits
  const v = await C.createVault('１２３４５６'); assert.ok(await C.unlock(v.meta, '123456'));
});
