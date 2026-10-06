import assert from "node:assert/strict";
import test from "node:test";
import { describe } from "../src/index.js";

test("image-core describes itself", () => {
  assert.equal(describe(), "@lab/image-core");
});
