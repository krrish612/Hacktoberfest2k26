import assert from "node:assert/strict";
import { test } from "node:test";

import { formatMoney, maskSerial } from "./format.ts";

test("formatMoney never throws on an empty or unknown currency code", () => {
  assert.doesNotThrow(() => formatMoney(2499, "US"));
  assert.doesNotThrow(() => formatMoney(2499, ""));
  assert.doesNotThrow(() => formatMoney(2499, null));
  assert.match(formatMoney(2499, "US"), /2,499/);
  assert.match(formatMoney(2499, ""), /2,499/);
});

test("formatMoney still formats a real currency and a missing amount", () => {
  assert.match(formatMoney(2499, "usd"), /2,499/);
  assert.equal(formatMoney(null, "USD"), "Not recorded");
});

test("maskSerial masks a serial with four or fewer characters entirely", () => {
  assert.equal(maskSerial("AB12"), "••••");
  assert.equal(maskSerial("A"), "•");
});

test("maskSerial keeps the last four of a longer serial", () => {
  assert.equal(maskSerial("SN-1234-5678"), "•••• •••• 5678");
  assert.equal(maskSerial(null), "Not recorded");
});
