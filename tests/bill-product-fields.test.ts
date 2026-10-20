import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { BillProductFields } from "../src/components/bill-product-fields";
import { QUANTITY_REQUIRED_MESSAGE } from "../src/lib/bill-quantity";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, Event: dom.window.Event })) Object.defineProperty(globalThis, key, { configurable: true, value });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("quantity 5 renders five separate serial fields and preserves the first entered serial", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement("form", null, React.createElement(BillProductFields, { namePrefix: "items.0.", brandOptions: ["QA brand"] }))));
    const quantity = container.querySelector<HTMLInputElement>('input[name="items.0.quantity"]')!;
    assert.equal(quantity.value, "", "New products must ask for an explicit quantity");
    assert.equal(container.querySelector<HTMLSelectElement>('select[name="items.0.quantityUnit"]')!.value, "UNIT");
    const serial = container.querySelector<HTMLInputElement>('input[name="items.0.serialNumber"]')!;
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(serial, "SERIAL-1"); serial.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setter.call(quantity, "5"); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    assert.equal(quantity.step, "1"); assert.equal(quantity.min, "1");
    const serials = [...container.querySelectorAll<HTMLInputElement>('input[name*="serialNumber"], input[name*="unitSerialNumbers"]')];
    assert.equal(serials.length, 5); assert.equal(serials[0].value, "SERIAL-1");
    assert.equal(new Set(serials.map(input => input.name)).size, 5);
    assert(serials.every(input => !input.required));
    for (const [index, input] of serials.entries()) input.value = `SERIAL-${index + 1}`;
    const data = new dom.window.FormData(container.querySelector("form")!);
    assert.equal(data.get("items.0.quantity"), "5");
    assert.equal(data.get("items.0.quantityUnit"), "UNIT");
    assert.equal(data.get("items.0.unitSerialNumbers.4"), "SERIAL-5");
    assert.match(container.textContent!, /Individual Machines \(5\)/);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("Kg selection accepts decimal weight, changes the price label and omits all serial inputs", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement("form", null, React.createElement(BillProductFields, { namePrefix: "items.1.", brandOptions: ["QA"], defaults: { itemName: "Dumbbells", brand: "QA", unitPrice: 100 } }))));
    const unit = container.querySelector<HTMLSelectElement>('select[name="items.1.quantityUnit"]')!;
    await act(async () => { unit.value = "KG"; unit.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    const quantity = container.querySelector<HTMLInputElement>('input[name="items.1.quantity"]')!;
    assert.equal(unit.closest("label"), quantity.closest("label"), "Unit/Kg dropdown belongs inside the Quantity field");
    assert.equal(quantity.closest("label")!.htmlFor, quantity.id);
    assert.equal(quantity.step, "0.01"); assert.equal(quantity.min, "0.01"); assert.equal(quantity.required, true);
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(quantity, "5000.25"); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    assert.equal(container.querySelectorAll('input[name*="serialNumber"],input[name*="unitSerialNumbers"]').length, 0);
    assert.match(container.textContent!, /Price per Kg/);
    assert.equal(container.querySelector("form")!.checkValidity(), true);
    const data = new dom.window.FormData(container.querySelector("form")!);
    assert.equal(data.get("items.1.quantityUnit"), "KG"); assert.equal(data.get("items.1.quantity"), "5000.25");
    assert.equal(data.has("items.1.serialNumber"), false);
    await act(async () => { setter.call(quantity, "2.555"); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    assert.equal(quantity.checkValidity(), false);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("toggling Unit/Kg preserves typed serial drafts and does not silently round a weight into a unit count", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(BillProductFields, { defaults: { quantity: 3 } })));
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    const serial = container.querySelector<HTMLInputElement>('input[name="unitSerialNumbers.2"]')!;
    await act(async () => { setter.call(serial, "SERIAL-THREE"); serial.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    const unit = container.querySelector<HTMLSelectElement>('select[name="quantityUnit"]')!;
    await act(async () => { unit.value = "KG"; unit.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(container.querySelectorAll('input[name*="erialNumber"]').length, 0);
    await act(async () => { unit.value = "UNIT"; unit.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(container.querySelector<HTMLInputElement>('input[name="unitSerialNumbers.2"]')!.value, "SERIAL-THREE");
    await act(async () => { unit.value = "KG"; unit.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    let quantity = container.querySelector<HTMLInputElement>('input[name="quantity"]')!;
    await act(async () => { setter.call(quantity, "2.5"); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    await act(async () => { unit.value = "UNIT"; unit.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    quantity = container.querySelector<HTMLInputElement>('input[name="quantity"]')!;
    assert.equal(quantity.value, "2.5"); assert.equal(quantity.checkValidity(), false);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("saved Kg products reopen in Kg mode with their weight and concurrency token intact", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    const token = { equipmentId: "group-1", equipmentCode: "QA-1", serialNumber: null, updatedAt: "2026-10-16T00:00:00.000Z" };
    await act(async () => root.render(React.createElement("form", null, React.createElement(BillProductFields, { defaults: { quantity: "25.50", quantityUnit: "KG", units: [token] } }))));
    assert.equal(container.querySelector<HTMLSelectElement>('select[name="quantityUnit"]')!.value, "KG");
    assert.equal(container.querySelector<HTMLInputElement>('input[name="quantity"]')!.value, "25.50");
    assert.equal(container.querySelectorAll('input[name*="erialNumber"]').length, 0);
    const data = new dom.window.FormData(container.querySelector("form")!);
    assert.equal(data.get("existingUnits"), `${token.equipmentId}:${token.updatedAt}`);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("editing an existing product preserves its saved quantity and machine identifiers", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement("form", null, React.createElement(BillProductFields, { defaults: { quantity: 3, serialNumber: "OLD-1" } }))));
    const quantity = container.querySelector<HTMLInputElement>('input[name="quantity"]')!;
    assert.equal(quantity.value, "3");
    assert.equal(quantity.required, true);
    assert.equal(container.querySelector<HTMLInputElement>('input[name="serialNumber"]')!.value, "OLD-1");
    assert.equal(container.querySelectorAll('input[name^="unitSerialNumbers."]').length, 2);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("blank quantity is starred, blocks submission, and clears its message after correction", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  let submissions = 0;
  try {
    await act(async () => root.render(React.createElement("form", { onSubmit: (event: React.FormEvent) => { event.preventDefault(); submissions++; } }, React.createElement(BillProductFields, { namePrefix: "items.0.", brandOptions: ["QA brand"], defaults: { itemName: "Treadmill", brand: "QA brand", unitPrice: 100 } }))));
    const form = container.querySelector("form")!;
    const quantity = container.querySelector<HTMLInputElement>('input[name="items.0.quantity"]')!;
    const star = quantity.closest("label")!.querySelector('span[aria-hidden="true"]');
    assert.equal(star?.textContent, "*");
    assert(star?.className.includes("text-[#DC2626]"));
    assert.equal(quantity.required, true);
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(quantity, ""); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    assert.equal(quantity.validity.valueMissing, true);
    await act(async () => form.requestSubmit());
    assert.equal(submissions, 0);
    assert.equal(quantity.validationMessage, QUANTITY_REQUIRED_MESSAGE);
    await act(async () => { setter.call(quantity, "5"); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    assert.equal(quantity.validationMessage, "");
    assert.equal(form.checkValidity(), true);
    await act(async () => form.requestSubmit());
    assert.equal(submissions, 1);
    for (const value of ["0", "1.5", "101"]) {
      await act(async () => { setter.call(quantity, value); quantity.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
      await act(async () => form.requestSubmit());
      assert.equal(submissions, 1, `Invalid quantity ${value} must not submit`);
    }
  } finally { await act(async () => root.unmount()); container.remove(); }
});
