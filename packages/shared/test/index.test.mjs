import assert from "node:assert/strict";
import test from "node:test";
import { describe } from "../src/index.js";

test("shared describes itself", () => {
  assert.equal(describe(), "@lab/shared");
});
