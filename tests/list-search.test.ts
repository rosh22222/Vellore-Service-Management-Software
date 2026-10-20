import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchForm } from "../src/components/ui/search-form";

Object.defineProperty(globalThis, "React", { configurable: true, value: React });

test("shared list search preserves active filters and resets pagination", () => {
  const html = renderToStaticMarkup(
    React.createElement(SearchForm, {
      query: "treadmill",
      label: "Search service complaints",
      placeholder: "Search complaints...",
      resetHref: "/complaints?status=OPEN",
      hiddenFields: { status: "OPEN", page: undefined },
    }),
  );

  assert.match(html, /role="search"/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="status" value="OPEN"/);
  assert.doesNotMatch(html, /name="page"/);
  assert.match(html, /href="\/complaints\?status=OPEN"/);
});

test("complaints and service history use the customer-style search bar", () => {
  for (const path of [
    "src/app/(dashboard)/complaints/page.tsx",
    "src/app/(dashboard)/service-history/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /<SearchForm/);
    assert.match(source, /hiddenFields=\{preservedSearchFields\}/);
    assert.match(source, /<input type="hidden" name="q" value=\{params\.q\}/);
  }
});
