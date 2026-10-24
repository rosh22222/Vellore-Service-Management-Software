import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { PhoneInput } from "../src/components/ui/phone-input";
import { PinCodeInput } from "../src/components/ui/pin-code-input";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

for (const [key, value] of Object.entries({
  React,
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Event: dom.window.Event,
})) Object.defineProperty(globalThis, key, { configurable: true, value });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("phone inputs keep only ten numeric digits", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(PhoneInput, { name: "mobile", required: true })));
  try {
    const input = container.querySelector("input")!;
    assert.equal(input.type, "tel");
    assert.equal(input.inputMode, "numeric");
    assert.equal(input.maxLength, 10);
    assert.equal(input.minLength, 10);
    assert.equal(input.pattern, "[0-9]{10}");

    await act(async () => {
      input.value = "+91 98765-ab432109";
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(input.value, "9198765432");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("PIN Code inputs keep only six numeric digits", async () => {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(PinCodeInput, { name: "pinCode", required: true })));
  try {
    const input = container.querySelector("input")!;
    assert.equal(input.type, "text");
    assert.equal(input.inputMode, "numeric");
    assert.equal(input.maxLength, 6);
    assert.equal(input.minLength, 6);
    assert.equal(input.pattern, "[0-9]{6}");

    await act(async () => {
      input.value = "632A-00199";
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(input.value, "632001");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
