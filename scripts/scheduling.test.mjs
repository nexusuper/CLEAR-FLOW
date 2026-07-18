import assert from 'node:assert/strict';
import {
  classifyPickupTime, addDays, computeAllowedDeliveryWindow, validateSchedule, isStoreOpenDay, nextOpenDay,
} from '../lib/scheduling.js';

// classifyPickupTime — store hours 08:00-12:00 and 13:00-17:00
assert.equal(classifyPickupTime('08:00'), 'morning');
assert.equal(classifyPickupTime('12:00'), 'morning');
assert.equal(classifyPickupTime('12:01'), null);
assert.equal(classifyPickupTime('12:59'), null);
assert.equal(classifyPickupTime('13:00'), 'afternoon');
assert.equal(classifyPickupTime('17:00'), 'afternoon');
assert.equal(classifyPickupTime('17:01'), null);
assert.equal(classifyPickupTime('07:59'), null);
assert.equal(classifyPickupTime('not-a-time'), null);

// isStoreOpenDay / nextOpenDay — 2026-07-05 is a Sunday
assert.equal(isStoreOpenDay('2026-07-03'), true); // Friday
assert.equal(isStoreOpenDay('2026-07-04'), true); // Saturday
assert.equal(isStoreOpenDay('2026-07-05'), false); // Sunday
assert.equal(isStoreOpenDay('2026-07-06'), true); // Monday
assert.equal(nextOpenDay('2026-07-04'), '2026-07-06'); // Saturday -> skip Sunday -> Monday

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
  { date: '2026-07-04', minTime: '08:00', maxTime: '17:00' }
);
// afternoon pickup on Saturday -> next open day skips Sunday, lands Monday
assert.deepEqual(
  computeAllowedDeliveryWindow({ pickupDate: '2026-07-04', pickupTime: '14:30' }),
  { date: '2026-07-06', minTime: '08:00', maxTime: '17:00' }
);
assert.equal(computeAllowedDeliveryWindow({ pickupDate: '2026-07-03', pickupTime: '12:30' }), null);

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
// delivery-only: time in the closed lunch gap
assert.equal(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-03', deliveryTime: '12:30', today: '2026-07-03',
  }).ok,
  false
);
// delivery-only: time outside 8-17
assert.equal(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-03', deliveryTime: '19:00', today: '2026-07-03',
  }).ok,
  false
);
// delivery-only: Sunday date rejected
assert.equal(
  validateSchedule({
    hasEmptyContainers: false, pickupDate: null, pickupTime: null,
    deliveryDate: '2026-07-05', deliveryTime: '10:00', today: '2026-07-03',
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
// refill, afternoon pickup, valid next-day delivery (morning window)
assert.deepEqual(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '14:00',
    deliveryDate: '2026-07-04', deliveryTime: '08:00', today: '2026-07-03',
  }),
  { ok: true }
);
// refill, afternoon pickup, next-day delivery in the closed lunch gap
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '14:00',
    deliveryDate: '2026-07-04', deliveryTime: '12:30', today: '2026-07-03',
  }).ok,
  false
);
// refill, afternoon pickup on Saturday, next open day (Monday) required
assert.deepEqual(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-04', pickupTime: '14:00',
    deliveryDate: '2026-07-06', deliveryTime: '08:00', today: '2026-07-03',
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
    hasEmptyContainers: true, pickupDate: '2026-07-03', pickupTime: '12:30',
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
// refill: pickup date is a Sunday, rejected
assert.equal(
  validateSchedule({
    hasEmptyContainers: true, pickupDate: '2026-07-05', pickupTime: '09:00',
    deliveryDate: '2026-07-05', deliveryTime: '14:00', today: '2026-07-03',
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
