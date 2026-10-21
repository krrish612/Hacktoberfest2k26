import assert from "node:assert/strict";
import test from "node:test";
import { confirmOutcome } from "./confirm.ts";

const FALLBACK = "Something went wrong. Please try again.";

test("a successful confirm closes the dialog with no message", () => {
  assert.deepEqual(confirmOutcome({ ok: true, error: null }), { close: true, error: null });
});

test("a failed delete stays open so the reason is readable", () => {
  const outcome = confirmOutcome({ ok: false, error: "That gear record is locked." });
  assert.deepEqual(outcome, { close: false, error: "That gear record is locked." });
});

test("a failed delete with no reason still stays open and explains itself", () => {
  const outcome = confirmOutcome({ ok: false, error: null });
  assert.deepEqual(outcome, { close: false, error: FALLBACK });
});
