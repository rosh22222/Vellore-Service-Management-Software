import assert from "node:assert/strict";
import { test } from "node:test";
import { optionalDate, nonNegativeNumber, requiredText, money } from "../src/lib/format";
import { warrantyStatus } from "../src/lib/warranty";
import { suggestedInvoiceNumber } from "../src/lib/invoice-number";
import { businessRange, dateInput, dateBoundary } from "../src/lib/business-date";

test("daily reports and form defaults use India time on UTC hosts", () => {
  const now = new Date("2026-10-03T19:00:00Z");
  assert.equal(dateInput(now), "2026-10-04");
  const range = businessRange("today", undefined, undefined, now);
  assert.equal(range.start.toISOString(), "2026-10-03T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-04T18:29:59.999Z");
  assert.equal(dateBoundary("2026-02-31"), undefined);
});

test("warranty covers the entire expiry date in India", () => {
  const expiry = new Date("2026-10-04T00:00:00+05:30");
  assert.equal(warrantyStatus(expiry, new Date("2026-10-04T23:59:59+05:30")), "UNDER_WARRANTY");
  assert.equal(warrantyStatus(expiry, new Date("2026-10-05T00:00:00+05:30")), "OUT_OF_WARRANTY");
  assert.equal(warrantyStatus(null), "UNKNOWN");
});
test("date parsing rejects impossible calendar dates and malformed input", () => {
  assert.throws(() => optionalDate("2026-02-31"));
  assert.throws(() => optionalDate("bad-date"));
  assert(optionalDate("2024-02-29") instanceof Date);
  assert.equal(optionalDate(""), null);
});
test("money and required field validation reject invalid data", () => {
  for (const value of ["-1", "Infinity", "NaN"]) assert.throws(() => nonNegativeNumber(value, "Amount"));
  assert.equal(nonNegativeNumber("0", "Amount"), 0);
  assert.throws(() => requiredText("  ", "PIN Code"));
  assert.throws(() => requiredText("1234", "Code", 3));
  assert.match(money(1200.5), /1,200.50/);
});
test("invoice numbering considers all rows and ignores custom suffixes", async () => {
  const rows = Array.from({ length: 1100 }, (_, index) => ({ billNumber: `VFE-INV-${index + 1}` }));
  rows.push({ billNumber: "VFE-INV-9999-CUSTOM" });
  const source = { billDetail: { findMany: async () => rows } } as unknown as Parameters<typeof suggestedInvoiceNumber>[0];
  assert.equal(await suggestedInvoiceNumber(source), "VFE-INV-1101");
});
