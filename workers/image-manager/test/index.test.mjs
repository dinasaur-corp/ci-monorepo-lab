import assert from "node:assert/strict";
import test from "node:test";
import { respond } from "../src/handler.js";

test("image-manager responds", () => {
  assert.equal(respond("/").worker, "image-manager");
});
