import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import type { Session } from "next-auth";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { Topbar } from "../src/components/topbar";

// The test runner preserves classic JSX; Next.js provides its own JSX runtime.
Object.defineProperty(globalThis, "React", { configurable: true, value: React });

function renderHeader(role: Session["user"]["role"]) {
  const user: Session["user"] = {
    id: "header-test-user",
    name: "Test User",
    role,
    technicianId: role === "TECHNICIAN" ? "header-test-technician" : null,
    canAssignTechnician: false,
    canGenerateBills: false,
  };
  return new JSDOM(renderToStaticMarkup(React.createElement(
    ImageConfigContext.Provider,
    { value: { ...imageConfigDefault, localPatterns: [{ pathname: "/avatar.png" }] } },
    React.createElement(Topbar, { user }),
  )));
}

test("owner and office headers link Add Bills directly to New Bill Details", () => {
  for (const role of ["ADMIN", "OFFICE_STAFF"] as const) {
    const dom = renderHeader(role);
    try {
      const header = dom.window.document.querySelector("header")!;
      const link = header.querySelector('a[href="/bill-details/new"]');
      assert.equal(link?.textContent, "Add Bills");
      assert.equal(header.querySelector('a[href="/complaints/new"]')?.textContent, "New Complaint");
      assert(header.querySelector('button[aria-label="Log out"]'));
      if (role === "ADMIN") assert.match(header.textContent!, /D SATHYAN/);
    } finally {
      dom.window.close();
    }
  }
});

test("technician header keeps logout without exposing the office-only bill shortcut", () => {
  const dom = renderHeader("TECHNICIAN");
  try {
    const header = dom.window.document.querySelector("header")!;
    assert.equal(header.querySelector('a[href="/bill-details/new"]'), null);
    assert.equal(header.querySelector('a[href="/complaints/new"]'), null);
    assert(header.querySelector('button[aria-label="Log out"]'));
  } finally {
    dom.window.close();
  }
});

test("owner header shows the supplied avatar beside the owner name", () => {
  const dom = renderHeader("ADMIN");
  try {
    const image = dom.window.document.querySelector('header img[alt="D SATHYAN profile photo"]');
    assert(image);
    const source = new URL(image.getAttribute("src")!, "http://localhost");
    assert.match(source.searchParams.get("url")!, /^\/avatar\.png\?v=[a-f0-9]{16}$/);
  } finally {
    dom.window.close();
  }
});

test("other users keep their initials instead of the owner's photograph", () => {
  for (const role of ["OFFICE_STAFF", "TECHNICIAN"] as const) {
    const dom = renderHeader(role);
    try {
      assert.equal(dom.window.document.querySelector("header img"), null);
      assert.match(dom.window.document.querySelector("header")!.textContent!, /T/);
    } finally {
      dom.window.close();
    }
  }
});
