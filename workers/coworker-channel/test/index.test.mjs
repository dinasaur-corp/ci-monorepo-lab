import assert from "node:assert/strict";
import test from "node:test";
import { respond } from "../src/handler.js";

test("coworker-channel responds", () => {
  assert.equal(respond("/").worker, "coworker-channel");
});
