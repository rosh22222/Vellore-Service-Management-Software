import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { EquipmentSelect } from "../src/components/equipment-select";
import { ActionForm } from "../src/components/action-form";
import { Button } from "../src/components/ui/button";
import { ComplaintForm } from "../src/components/complaint-form";
import { BillDetailForm, type BillEditDefaults } from "../src/components/bill-detail-form";
import { equipmentLabel } from "../src/lib/equipment-label";
import { isLoading, isPageNavigation, startLoading } from "../src/lib/loading-feedback";
import { requiredEmail } from "../src/lib/technician-validation";
import { NavigationFeedback } from "../src/components/navigation-feedback";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { DownloadLink } from "../src/components/download-link";
import { ConfirmSubmitButton } from "../src/components/confirm-submit-button";
import { AutoDismissNotice } from "../src/components/auto-dismiss-notice";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/brands", pretendToBeVisual: true });
for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLFormElement: dom.window.HTMLFormElement, FormData: dom.window.FormData, requestAnimationFrame: (callback: FrameRequestCallback) => { callback(0); return 1; } })) Object.defineProperty(globalThis, key, { configurable: true, value });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("loading stays active until every operation completes; only real in-app page links trigger it", () => {
  const stop1 = startLoading(), stop2 = startLoading(); assert.equal(isLoading(), true);
  stop1(); stop1(); assert.equal(isLoading(), true); stop2(); assert.equal(isLoading(), false);
  const anchor = document.createElement("a"); anchor.href = "/complaints/new";
  const event = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
  assert.equal(isPageNavigation(anchor, new URL("http://localhost/brands"), event), true);
  assert.equal(isPageNavigation(anchor, new URL(anchor.href), event), false);
  assert.equal(isPageNavigation(anchor, new URL("http://localhost/brands"), { ...event, ctrlKey: true }), false);
  for (const href of ["/brands#details", "/api/reports/export", "https://example.com/"]) { anchor.href = href; assert.equal(isPageNavigation(anchor, new URL("http://localhost/brands"), event), false); }
});

test("page navigation, back navigation and GET filters show progress until the route commits", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const link = document.createElement("a"); link.href = "/complaints"; link.textContent = "Complaints"; document.body.append(link);
  link.addEventListener("click", event => event.preventDefault());
  const route = (path: string, query = "") => React.createElement(PathnameContext.Provider, { value: path }, React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) }, React.createElement(NavigationFeedback)));
  try {
    await act(async () => root.render(route("/brands")));
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    assert(container.querySelector('[role="status"]')); assert.equal(isLoading(), true);
    let endAction!: () => void;
    await act(async () => { endAction = startLoading(); root.render(route("/complaints")); });
    assert.equal(isLoading(), true, "Route completion must not hide an unrelated running action");
    await act(async () => endAction()); assert.equal(container.querySelector('[role="status"]'), null);
    await act(async () => window.dispatchEvent(new dom.window.PopStateEvent("popstate")));
    assert(container.querySelector('[role="status"]'));
    await act(async () => root.render(route("/brands"))); assert.equal(isLoading(), false);
    await act(async () => window.dispatchEvent(new dom.window.PopStateEvent("popstate")));
    assert.equal(isLoading(), false, "Back/forward between anchors on the same page must not leave a permanent spinner");
    const form = document.createElement("form"); form.method = "get"; document.body.append(form);
    await act(async () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(isLoading(), true);
    await act(async () => root.render(route("/brands", "q=filter"))); assert.equal(isLoading(), false);
    form.remove();
  } finally { await act(async () => root.unmount()); container.remove(); link.remove(); }
});

test("equipment options omit tracking IDs and expose the complete selected product without clipping", async () => {
  const label = equipmentLabel({ name: "A very long treadmill equipment name that cannot fit into the dropdown", modelNumber: "MODEL-123456789", serialNumber: "SERIAL-ABCDEFGHIJK" });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(EquipmentSelect, { name: "equipmentId", required: true, options: [{ value: "internal-machine-id", label }] })));
    const select = container.querySelector("select")!;
    assert.equal(select.required, true); assert.equal(select.checkValidity(), false);
    await act(async () => { select.value = "internal-machine-id"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(select.title, label); assert.equal(select.selectedOptions[0].title, label);
    assert.equal(container.querySelector('[aria-live="polite"]')!.textContent, label);
    assert(!select.selectedOptions[0].textContent!.includes("internal-machine-id"));
    assert.equal(equipmentLabel({ name: "Dumbbell", modelNumber: null, serialNumber: null }), "Dumbbell");
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("brand success is specific, resets its input and disappears after three seconds; errors persist", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    let finish: (() => void) | undefined;
    const action = () => new Promise<void>(resolve => { finish = resolve; });
    await act(async () => root.render(React.createElement(ActionForm, { action, successMessage: "Brand Added", successDuration: 3000, resetOnSuccess: true, children: [React.createElement("input", { key: "field", name: "name", required: true }), React.createElement(Button, { key: "button", children: "Add Brand" })] })));
    container.querySelector("input")!.value = "Test Brand";
    await act(async () => { container.querySelector("form")!.requestSubmit(); });
    assert.equal(isLoading(), true); assert.equal(container.querySelector("button")!.disabled, true);
    assert.equal(container.querySelector("button")!.textContent, "Add Brand", "The full-screen loader handles progress without replacing the button label");
    await act(async () => { finish!(); });
    assert.equal(isLoading(), false); assert.equal(container.querySelector('[role="status"]')!.textContent!.trim(), "Brand Added");
    assert.equal(container.querySelector("input")!.value, "", "Adding a brand clears the name for the next entry");
    await act(async () => t.mock.timers.tick(2999)); assert(container.querySelector('[role="status"]'));
    await act(async () => t.mock.timers.tick(1)); assert.equal(container.querySelector('[role="status"]'), null);
    await act(async () => root.render(React.createElement(ActionForm, { action: async () => { throw new Error("Brand already exists."); }, successDuration: 3000, children: React.createElement("button", null, "Save") })));
    await act(async () => container.querySelector("form")!.requestSubmit());
    await act(async () => t.mock.timers.tick(4000));
    const errorDialog = document.querySelector('[role="alertdialog"]')!;
    assert.match(errorDialog.textContent!, /Brand already exists/);
    assert(errorDialog.parentElement!.className.includes("fixed"), "Action error must be centered in a modal overlay");
    const close = errorDialog.querySelector<HTMLButtonElement>('button[aria-label="Close message"]')!;
    await act(async () => close.click());
    assert.equal(document.querySelector('[role="alertdialog"]'), null);
  } finally { await act(async () => root.unmount()); container.remove(); t.mock.timers.reset(); }
});

test("all success notices disappear after three seconds by default", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement("div", null,
      React.createElement(AutoDismissNotice, null, "Profile updated"),
      React.createElement(ActionForm, { action: async () => {}, children: React.createElement(Button, null, "Update") }),
    )));
    assert.match(container.textContent!, /Profile updated/);
    await act(async () => container.querySelector("form")!.requestSubmit());
    assert.match(container.textContent!, /Changes saved successfully/);
    await act(async () => t.mock.timers.tick(2999));
    assert.match(container.textContent!, /Profile updated/);
    await act(async () => t.mock.timers.tick(1));
    assert(!container.textContent!.includes("Profile updated"));
    assert(!container.textContent!.includes("Changes saved successfully"));
  } finally { await act(async () => root.unmount()); container.remove(); t.mock.timers.reset(); }
});

test("delete actions use the custom confirmation dialog instead of browser confirm", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  let deletions = 0;
  const originalConfirm = window.confirm;
  window.confirm = () => { throw new Error("Browser confirmation must not be used"); };
  try {
    await act(async () => root.render(React.createElement(ActionForm, {
      action: async () => { deletions++; },
      children: React.createElement(ConfirmSubmitButton, { message: "Delete this test record?", children: "Delete Record" }),
    })));
    await act(async () => container.querySelector("button")!.click());
    const dialog = document.querySelector('[role="alertdialog"]')!;
    assert(dialog);
    assert.match(dialog.textContent!, /Are you sure\?/);
    assert.match(dialog.textContent!, /Delete this test record/);
    assert.equal(deletions, 0);
    const cancel = [...dialog.querySelectorAll("button")].find(button => button.textContent === "Cancel")!;
    await act(async () => cancel.click());
    assert.equal(document.querySelector('[role="alertdialog"]'), null);

    await act(async () => container.querySelector("button")!.click());
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(button => button.textContent?.trim() === "Delete")!;
    await act(async () => confirm.click());
    assert.equal(deletions, 1);
    assert.equal(document.querySelector('[role="alertdialog"]'), null);
  } finally {
    window.confirm = originalConfirm;
    await act(async () => root.unmount());
    container.remove();
  }
});

test("new complaint exposes Technician and Office Notes, not New Equipment or its fields", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(ComplaintForm, { customers: [], equipment: [], customerTypes: ["GYM"], priorities: ["NORMAL"], sources: ["PHONE"], technicians: [{ id: "tech-1", name: "Test Technician" }], canAssign: true })));
    assert(!container.textContent!.includes("New Equipment")); assert.equal(container.querySelector('input[name="newEquipmentName"]'), null);
    const technician = container.querySelector<HTMLInputElement>('input[name="technicianIds"]');
    assert(technician);
    assert.equal(technician.disabled, false);
    assert.match(container.querySelector('textarea[name="notes"]')!.closest("label")!.textContent!, /Office Notes/);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("full bill editor prefills customer, invoice, purchase date, product, Kg and warranty in one form", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const editing: BillEditDefaults = { id: "bill-1", billDate: "2026-10-16", billVersion: "bill-version", customer: { name: "Existing Customer", type: "GYM", primaryMobile: "9000000000", alternateMobile: null, email: "customer@example.test", address: "Existing address", city: "Vellore", state: "Tamil Nadu", pinCode: "632001", gstNumber: null, notes: "Saved notes", updatedAt: "customer-version" }, products: [{ id: "item-1", itemId: "item-1", defaults: { itemName: "Dumbbells", brand: "QA", quantity: 25.5, quantityUnit: "KG", unitPrice: 100, warrantyStartDate: "2026-01-01", warrantyExpiryDate: "2027-01-01", warrantyDuration: "12 Months", units: [{ equipmentId: "eq-1", equipmentCode: "EQ-1", serialNumber: null, updatedAt: "version" }] } }] };
  try {
    await act(async () => root.render(React.createElement(BillDetailForm, { customers: [], customerTypes: ["GYM"], initialBillNumber: "INV-123", brandOptions: ["QA"], editing })));
    const data = new dom.window.FormData(container.querySelector("form")!);
    for (const [name, value] of Object.entries({ billNumber: "INV-123", billDate: "2026-10-16", newCustomerName: "Existing Customer", newCustomerEmail: "customer@example.test", "items.0.quantityUnit": "KG", "items.0.quantity": "25.5", "items.0.itemId": "item-1", "items.0.warrantyExpiryDate": "2027-01-01", "items.0.existingUnits": "eq-1:version" })) assert.equal(data.get(name), value, name);
    assert.match(container.textContent!, /Save All Changes/); assert.equal(data.get("productCount"), "1");
    const add = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Add Another Product"))!;
    await act(async () => add.click()); assert.equal(new dom.window.FormData(container.querySelector("form")!).get("productCount"), "2");
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("technician email is required, normalized and validated", () => {
  assert.equal(requiredEmail(" Technician@Example.com "), "technician@example.com");
  for (const value of [null, "", "   ", "not-an-email"]) assert.throws(() => requiredEmail(value));
});

test("report downloads show busy feedback, prevent duplicate requests and preserve the server filename", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const originalFetch = globalThis.fetch, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, originalClick = dom.window.HTMLAnchorElement.prototype.click, originalTimer = window.setTimeout;
  let finish!: (response: Response) => void, requests = 0, filename = "";
  globalThis.fetch = (() => { requests++; return new Promise<Response>(resolve => { finish = resolve; }); }) as typeof fetch;
  URL.createObjectURL = () => "blob:report"; URL.revokeObjectURL = () => {};
  window.setTimeout = (() => 1) as unknown as typeof window.setTimeout;
  dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  try {
    await act(async () => root.render(React.createElement(DownloadLink, { href: "/api/reports/export?format=csv", children: "Export CSV" })));
    const link = container.querySelector("a")!;
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    assert.equal(isLoading(), true); assert.equal(link.getAttribute("aria-busy"), "true"); assert.match(link.textContent!, /Preparing/);
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))); assert.equal(requests, 1);
    await act(async () => finish(new Response("csv data", { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="VFE-report.csv"' } })));
    assert.equal(isLoading(), false); assert.equal(filename, "VFE-report.csv"); assert.equal(link.textContent, "Export CSV");
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    await act(async () => finish(new Response("error", { status: 401 })));
    assert.equal(isLoading(), false); assert.match(document.querySelector('[role="alertdialog"]')!.textContent!, /session expired/);
  } finally {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; dom.window.HTMLAnchorElement.prototype.click = originalClick; window.setTimeout = originalTimer;
  }
});

test("PDF preview opens with a spinner immediately and receives the generated PDF when ready", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const originalFetch = globalThis.fetch, originalOpen = window.open, originalCreate = URL.createObjectURL, originalTimer = window.setTimeout;
  let finish!: (response: Response) => void, written = "", destination = "";
  const popup = { opener: {}, document: { write: (value: string) => { written = value; }, close: () => {} }, closed: false, location: { replace: (value: string) => { destination = value; } }, close: () => {} };
  window.open = () => popup as unknown as Window; globalThis.fetch = (() => new Promise<Response>(resolve => { finish = resolve; })) as typeof fetch;
  URL.createObjectURL = () => "blob:pdf-preview"; window.setTimeout = (() => 1) as unknown as typeof window.setTimeout;
  try {
    await act(async () => root.render(React.createElement(DownloadLink, { href: "/api/service-reports/test", preview: true, children: "Service Report PDF" })));
    await act(async () => container.querySelector("a")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    assert.match(written, /Preparing your report/); assert.match(written, /animation:spin/); assert.equal(popup.opener, null); assert.equal(isLoading(), true);
    await act(async () => finish(new Response("%PDF-test", { headers: { "content-type": "application/pdf" } })));
    assert.equal(destination, "blob:pdf-preview"); assert.equal(isLoading(), false);
  } finally { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; window.open = originalOpen; URL.createObjectURL = originalCreate; window.setTimeout = originalTimer; }
});
