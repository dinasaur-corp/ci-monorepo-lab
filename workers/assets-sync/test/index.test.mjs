import assert from "node:assert/strict";
import test from "node:test";
import { respond } from "../src/handler.js";

test("assets-sync responds", () => {
  assert.equal(respond("/").worker, "assets-sync");
});
