import assert from 'node:assert/strict';
import {
  classifyPickupTime, addDays, computeAllowedDeliveryWindow, validateSchedule,
} from '../lib/scheduling.js';

// classifyPickupTime
assert.equal(classifyPickupTime('06:00'), 'morning');
assert.equal(classifyPickupTime('10:59'), 'morning');
assert.equal(classifyPickupTime('11:00'), null);
assert.equal(classifyPickupTime('12:59'), null);
assert.equal(classifyPickupTime('13:00'), 'afternoon');
assert.equal(classifyPickupTime('17:00'), 'afternoon');
assert.equal(classifyPickupTime('17:01'), null);
assert.equal(classifyPickupTime('05:59'), null);
assert.equal(classifyPickupTime('not-a-time'), null);

// addDays
assert.equal(addDays('2026-07-03', 1), '2026-07-04');
assert.equal(addDays('2026-07-31', 1), '2026-08-01');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');

// computeAllowedDeliveryWindow
assert.deepEqual(
  computeAllowedDeliveryWindow({ pickupDate: '2026-07-03', pickupTime: '09:00' }),
  { date: '2026-07-03', minTime: '13:00', maxTime: '17:00' }
);
assert.deepEqual(
  computeAllowedDeliveryWindow({ pickupDate: '2026-07-03', pickupTime: '14:30' }),
  { date: '2026-07-04', minTime: '07:00', maxTime: '18:00' }
);
assert.equal(computeAllowedDeliveryWindow({ pickupDate: '2026-07-03', pickupTime: '11:30' }), null);

// validateSchedule: delivery-only order
assert.deepEqual(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-03', deliveryTime: '10:00', today: '2026-07-03',
  }),
  { ok: true }
);
// delivery-only: date in the past
assert.equal(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-02', deliveryTime: '10:00', today: '2026-07-03',
  }).ok,
  false
);
// delivery-only: time outside 7-18
assert.equal(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-03', deliveryTime: '19:00', today: '2026-07-03',
  }).ok,
  false
);

// validateSchedule: refill, morning pickup, valid same-day afternoon delivery
assert.deepEqual(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '09:00',
    deliveryDate: '2026-07-03', deliveryTime: '14:00', today: '2026-07-03',
  }),
  { ok: true }
);
// refill, morning pickup, delivery date wrong (next day instead of same day)
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '09:00',
    deliveryDate: '2026-07-04', deliveryTime: '14:00', today: '2026-07-03',
  }).ok,
  false
);
// refill, afternoon pickup, valid next-day delivery
assert.deepEqual(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '14:00',
    deliveryDate: '2026-07-04', deliveryTime: '08:00', today: '2026-07-03',
  }),
  { ok: true }
);
// refill, afternoon pickup, same-day delivery attempted (violates invariant + window)
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '14:00',
    deliveryDate: '2026-07-03', deliveryTime: '16:00', today: '2026-07-03',
  }).ok,
  false
);
// refill: pickup time in the gap
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '12:00',
    deliveryDate: '2026-07-03', deliveryTime: '14:00', today: '2026-07-03',
  }).ok,
  false
);
// refill: pickup date in the past
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-02', pickupTime: '09:00',
    deliveryDate: '2026-07-02', deliveryTime: '14:00', today: '2026-07-03',
  }).ok,
  false
);
// invariant: delivery must be strictly after pickup even if someone forges a same-window-looking pair across dates
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-04', pickupTime: '09:00',
    deliveryDate: '2026-07-03', deliveryTime: '14:00', today: '2026-07-03',
  }).ok,
  false
);

console.log('scheduling.test.mjs: all assertions passed');
