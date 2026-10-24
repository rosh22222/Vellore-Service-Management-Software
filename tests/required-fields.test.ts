import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { Field, Input, Select, Textarea } from "../src/components/ui/form";
import { indianPinCode, nonNegativeNumber, phoneNumber, requiredText } from "../src/lib/format";

Object.defineProperty(globalThis, "React", { configurable: true, value: React });

test("required input, select and textarea controls have red stars and reject blank values", () => {
  for (const control of [
    React.createElement(Input, { name: "name", required: true }),
    React.createElement(Select, { name: "customer", required: true }, React.createElement("option", { value: "" }, "Select customer")),
    React.createElement(Textarea, { name: "problem", required: true }),
  ]) {
    // Also catches future controls whose Field accidentally omits `required`.
    const html = renderToStaticMarkup(React.createElement("form", null, React.createElement(Field, { label: "Important detail", children: React.createElement("div", null, control) })));
    const dom = new JSDOM(html);
    try {
      const star = dom.window.document.querySelector('label > span > span[aria-hidden="true"]');
      assert.equal(star?.textContent, "*");
      assert(star?.className.includes("text-[#DC2626]"));
      assert.equal(dom.window.document.querySelector("form")!.checkValidity(), false);
    } finally { dom.window.close(); }
  }
});

test("optional fields do not show a star or prevent saving when blank", () => {
  const html = renderToStaticMarkup(React.createElement("form", null,
    React.createElement(Field, { label: "Serial number", children: React.createElement(Input, { name: "serialNumber" }) }),
    React.createElement(Field, { label: "Notes", children: React.createElement(Textarea, { name: "notes" }) }),
    React.createElement(Field, { label: "Initial assignment note", required: false, children: React.createElement(Input, { name: "reason", required: false }) }),
  ));
  const dom = new JSDOM(html);
  try {
    assert.equal(dom.window.document.querySelectorAll('label > span > span[aria-hidden="true"]').length, 0);
    assert.equal(dom.window.document.querySelector("form")!.checkValidity(), true);
  } finally { dom.window.close(); }
});

test("reassignment reason is mandatory only when reassigning an existing technician", () => {
  for (const isReassignment of [false, true]) {
    const html = renderToStaticMarkup(React.createElement("form", null, React.createElement(Field, {
      label: "Reason / Note", required: isReassignment,
      children: React.createElement(Input, { name: "reason", required: isReassignment }),
    })));
    const dom = new JSDOM(html);
    try {
      assert.equal(Boolean(dom.window.document.querySelector('label > span > span[aria-hidden="true"]')), isReassignment);
      assert.equal(dom.window.document.querySelector("form")!.checkValidity(), !isReassignment);
    } finally { dom.window.close(); }
  }
});

test("required values are rejected server-side and an explicit zero service amount remains valid", () => {
  for (const label of ["Company name", "Customer type", "Service amount", "Collection amount", "Unit price", "Technician"]) {
    for (const value of [null, "", "   "]) assert.throws(() => requiredText(value, label), { message: `${label} is required.` });
  }
  assert.equal(nonNegativeNumber(requiredText("0", "Service amount"), "Service amount"), 0);
  assert.equal(phoneNumber("9876543210", "Mobile number"), "9876543210");
  assert.equal(phoneNumber("", "Alternate mobile", false), null);
  for (const invalid of ["987654321", "98765432101", "98765 43210", "+919876543210", "abcdefghij"])
    assert.throws(() => phoneNumber(invalid, "Mobile number"), {
      message: "Mobile number must contain exactly 10 digits.",
    });
  assert.equal(indianPinCode("632001"), "632001");
  for (const invalid of ["", "63200", "6320019", "632 001", "ABCDEF"])
    assert.throws(() => indianPinCode(invalid), {
      message: invalid ? "PIN Code must contain exactly 6 digits." : "PIN Code is required.",
    });
});

test("every starred Field in application forms also marks its editable control required", () => {
  const failures: string[] = [];
  let audited = 0;
  function scanDirectory(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scanDirectory(path);
      else if (entry.name.endsWith(".tsx")) scanFile(path);
    }
  }
  function requiredAttribute(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
    return node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === "required");
  }
  function scanFile(path: string) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Field" && requiredAttribute(node.openingElement)) {
        audited++;
        const controls: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
        function findControls(child: ts.Node) {
          const opening = ts.isJsxElement(child) ? child.openingElement : ts.isJsxSelfClosingElement(child) ? child : undefined;
          if (opening && ["Input", "PhoneInput", "PinCodeInput", "Select", "EquipmentSelect", "Textarea", "input", "select", "textarea"].includes(opening.tagName.getText(source))) controls.push(opening);
          ts.forEachChild(child, findControls);
        }
        ts.forEachChild(node, findControls);
        if (!controls.length || controls.some(control => !requiredAttribute(control))) {
          failures.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  scanDirectory(join(process.cwd(), "src"));
  assert(audited >= 50, "Audit must cover all application forms");
  assert.deepEqual(failures, [], "A red star must be backed by required input validation");
});
