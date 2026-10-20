import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import { LoginPasswordInput } from "../src/components/login-password-input";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Event: dom.window.Event,
})) Object.defineProperty(globalThis, key, { configurable: true, value });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderPassword(disabled = false, controlled = true) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let submissions = 0;
  function Form() {
    const [value, setValue] = useState("");
    return React.createElement("form", { onSubmit: (event) => { event.preventDefault(); submissions++; } },
      React.createElement(LoginPasswordInput, {
        id: "test-password", name: "password", disabled, value: controlled ? value : undefined,
        onChange: (event) => setValue(event.currentTarget.value),
      }),
    );
  }
  await act(async () => root.render(React.createElement(Form)));
  return {
    input: container.querySelector("input")!,
    button: container.querySelector("button")!,
    form: container.querySelector("form")!,
    submissions: () => submissions,
    cleanup: async () => { await act(async () => root.unmount()); container.remove(); },
  };
}

test("password eye reveals and hides the entered value without clearing or submitting it", async () => {
  const view = await renderPassword();
  try {
    assert.equal(view.input.type, "password");
    assert.equal(view.button.getAttribute("aria-label"), "Show password");
    assert.equal(view.button.type, "button");
    const entered = "VFE-component-test-only!";
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(view.input, entered);
      view.input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    view.input.focus();
    view.input.setSelectionRange(3, 9);

    await act(async () => view.button.click());
    assert.equal(view.input.type, "text");
    assert.equal(view.input.value, entered);
    assert.equal(view.button.getAttribute("aria-label"), "Hide password");
    assert.equal(view.button.getAttribute("aria-pressed"), "true");
    assert.equal(document.activeElement, view.input);
    assert.equal(view.input.selectionStart, 3);
    assert.equal(view.input.selectionEnd, 9);
    assert.equal(new dom.window.FormData(view.form).get("password"), entered);

    await act(async () => view.button.click());
    assert.equal(view.input.type, "password");
    assert.equal(view.input.value, entered);
    assert.equal(view.button.getAttribute("aria-label"), "Show password");
    assert.equal(view.button.getAttribute("aria-pressed"), "false");
    assert.equal(view.submissions(), 0);
  } finally { await view.cleanup(); }
});

test("disabled password visibility control cannot reveal or submit during sign-in", async () => {
  const view = await renderPassword(true);
  try {
    assert.equal(view.input.disabled, true);
    assert.equal(view.button.disabled, true);
    await act(async () => view.button.click());
    assert.equal(view.input.type, "password");
    assert.equal(view.submissions(), 0);
  } finally { await view.cleanup(); }
});

test("revealing a browser-filled password preserves values without an input event", async () => {
  const view = await renderPassword(false, false);
  try {
    const filled = "VFE-autofill-test-only!";
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(view.input, filled);
    await act(async () => view.button.click());
    assert.equal(view.input.type, "text");
    assert.equal(view.input.value, filled);
    await act(async () => view.button.click());
    assert.equal(view.input.type, "password");
    assert.equal(new dom.window.FormData(view.form).get("password"), filled);
    assert.equal(view.submissions(), 0);
  } finally { await view.cleanup(); }
});
