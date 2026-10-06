import assert from "node:assert/strict";
import test from "node:test";
import { describe } from "../src/index.js";

test("config describes itself", () => {
  assert.equal(describe(), "@lab/config");
});
