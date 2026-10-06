import assert from "node:assert/strict";
import test from "node:test";
import { respond } from "../src/handler.js";

test("router responds", () => {
  assert.equal(respond("/").worker, "router");
});
