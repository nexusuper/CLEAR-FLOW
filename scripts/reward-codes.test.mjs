import assert from 'node:assert/strict';
import { CODE_TTL_MINUTES, CODE_MAX_ATTEMPTS, generateCode, hashCode } from '../lib/reward-codes.js';

assert.equal(CODE_TTL_MINUTES, 10);
assert.equal(CODE_MAX_ATTEMPTS, 5);

const h1 = hashCode('09171234567', '123456');
assert.equal(h1, hashCode('09171234567', '123456'));      // deterministic
assert.notEqual(h1, hashCode('09990001111', '123456'));   // salted by phone
assert.notEqual(h1, hashCode('09171234567', '654321'));   // depends on code
assert.match(h1, /^[0-9a-f]{64}$/);                        // sha256 hex

for (let i = 0; i < 50; i++) {
  assert.match(generateCode(), /^\d{6}$/);                 // always 6 digits
}

console.log('reward-codes.test.mjs: all assertions passed');
