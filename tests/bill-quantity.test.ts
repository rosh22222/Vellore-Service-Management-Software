import assert from "node:assert/strict";
import { test } from "node:test";
import { machineQuantity, productQuantity, productQuantityLabel, readQuantityUnit, trackedProductCount, QUANTITY_REQUIRED_MESSAGE, validateMachineSerials } from "../src/lib/bill-quantity";
import { submitWithFeedback } from "../src/actions/form-feedback";

test("missing quantity asks the user to fill it in", () => {
  for (const value of [null, undefined, "", "   "]) {
    assert.throws(() => machineQuantity(value), { message: QUANTITY_REQUIRED_MESSAGE });
  }
});

test("server feedback returns the missing-quantity prompt instead of a database error", async () => {
  const result = await submitWithFeedback(async data => { machineQuantity(data.get("quantity")); }, new FormData());
  assert.deepEqual(result, { ok: false, message: QUANTITY_REQUIRED_MESSAGE });
});

test("machine quantities accept whole counts, not fractional or unbounded quantities", () => {
  for (const value of [1, "5", "5.00", 100]) assert.equal(machineQuantity(value), Number(value));
  for (const value of [0, -1, 1.5, "NaN", Infinity, 101, true, false, [1]]) assert.throws(() => machineQuantity(value), /whole number/);
});

test("optional serials allow several unknown machines but reject duplicate identities", () => {
  assert.doesNotThrow(() => validateMachineSerials([null, null, undefined, "", "S-01"]));
  assert.throws(() => validateMachineSerials(["S-01", "s-01"]), /repeated/);
  assert.throws(() => validateMachineSerials(["s".repeat(121)]), /at most 120/);
});

test("Unit is the default and unsupported quantity units cannot be saved", () => {
  for (const value of [null, undefined, "UNIT"]) assert.equal(readQuantityUnit(value), "UNIT");
  assert.equal(readQuantityUnit("KG"), "KG");
  for (const value of ["", "kg", "LITRE", true]) assert.throws(() => readQuantityUnit(value), /select Unit or Kg/);
});

test("Kg permits positive weights with two decimals, without treating kilograms as machine counts", () => {
  for (const value of [0.01, "0.25", "25.5", 5000.25]) assert.equal(productQuantity(value, "KG"), Number(value));
  for (const value of [0, -1, "0.001", 1.234, "NaN", Infinity, true, 10000000000]) assert.throws(() => productQuantity(value, "KG"), /Quantity in Kg/);
  for (const value of [null, undefined, "", "   "]) assert.throws(() => productQuantity(value, "KG"), { message: QUANTITY_REQUIRED_MESSAGE });
  assert.equal(trackedProductCount({ quantity: 5000.25, quantityUnit: "KG" }), 1);
  assert.equal(trackedProductCount({ quantity: 5, quantityUnit: "UNIT" }), 5);
  assert.throws(() => trackedProductCount({ quantity: 2.5, quantityUnit: "UNIT" }), /whole number/);
  assert.equal(productQuantityLabel("25.50", "KG"), "25.5 Kg");
  assert.equal(productQuantityLabel(1, "UNIT"), "1 Unit");
  assert.equal(productQuantityLabel(5, "UNIT"), "5 Units");
});
