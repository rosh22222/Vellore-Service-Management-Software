import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");

const base = process.env.QA_BASE_URL || "http://localhost:3000";
const parsedBase = new URL(base);
assert(
  ["localhost", "127.0.0.1"].includes(parsedBase.hostname),
  "Live smoke checks may target only the local application server.",
);
assert(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET is required.");

const db = new PrismaClient();
const results = [];

async function check(path, cookie, expectedType = "text/html") {
  const started = performance.now();
  let response;
  try {
    response = await fetch(new URL(path, base), {
      headers: cookie ? { cookie } : undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new Error(`${path} request failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const elapsed = Math.round(performance.now() - started);
  if (process.env.QA_VERBOSE === "1")
    console.log(`${path}\t${elapsed}ms\t${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  assert(
    contentType.includes(expectedType),
    `${path} returned unexpected content type ${contentType}`,
  );
  const body = Buffer.from(await response.arrayBuffer());
  if (expectedType === "text/html") {
    const html = body.toString("utf8");
    assert(!html.includes("Action could not be completed"), `${path} rendered an action error`);
    assert(!html.includes("Application error"), `${path} rendered an application error`);
    assert(!html.includes('"digest"'), `${path} rendered a server error digest`);
  }
  results.push({ path, status: response.status, elapsed, expectedType });
}

try {
  const user = await db.user.findFirst({
    where: { isActive: true, role: { in: ["ADMIN", "OFFICE_STAFF"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      canAssignTechnician: true,
      canGenerateBills: true,
      technician: { select: { id: true } },
    },
  });
  assert(user, "An active office account is required for the live smoke check.");

  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60 * 60,
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      technicianId: user.technician?.id ?? null,
      canAssignTechnician: user.canAssignTechnician,
      canGenerateBills: user.canGenerateBills,
    },
  });
  const cookie = `next-auth.session-token=${encodeURIComponent(token)}`;

  await check("/login", null);
  const anonymous = await fetch(new URL("/dashboard", base), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  assert([302, 303, 307, 308].includes(anonymous.status), "Anonymous dashboard access was not redirected");

  const staticPages = [
    "/dashboard",
    "/customers",
    "/customers/new",
    "/equipment",
    "/equipment/new",
    "/bill-details",
    "/bill-details/new",
    "/complaints",
    "/complaints/new",
    "/assignments",
    "/teams",
    "/technicians",
    "/technicians/new",
    "/service-history",
    "/service-collections",
    "/reports",
    "/settings",
    "/brands",
    "/users",
  ];
  for (const path of staticPages) await check(path, cookie);

  const [customer, equipment, bill, complaint, technician, service] = await Promise.all([
    db.customer.findFirst({ select: { id: true } }),
    db.customerEquipment.findFirst({ select: { id: true } }),
    db.billDetail.findFirst({ select: { id: true, items: { take: 1, select: { id: true } } } }),
    db.serviceComplaint.findFirst({ select: { id: true } }),
    db.technician.findFirst({ select: { id: true } }),
    db.serviceRecord.findFirst({ select: { id: true } }),
  ]);

  const dynamicPages = [
    customer && `/customers/${customer.id}`,
    customer && `/customers/${customer.id}/edit`,
    equipment && `/equipment/${equipment.id}`,
    equipment && `/equipment/${equipment.id}/edit`,
    bill && `/bill-details/${bill.id}`,
    bill && `/bill-details/${bill.id}/edit`,
    bill?.items[0] && `/bill-details/${bill.id}/items/${bill.items[0].id}/edit`,
    complaint && `/complaints/${complaint.id}`,
    technician && `/technicians/${technician.id}`,
    technician && `/technicians/${technician.id}/edit`,
    service && `/service-history/${service.id}`,
  ].filter(Boolean);
  for (const path of dynamicPages) await check(path, cookie);

  await check("/api/reports/export?format=csv", cookie, "text/csv");
  await check("/api/reports/export?format=pdf", cookie, "application/pdf");
  if (service) await check(`/api/service-reports/${service.id}`, cookie, "application/pdf");
  await check("/vellore-logo-transparent.png", null, "image/png");
  await check("/avatar.png", null, "image/png");
  await check("/treadmill-hero.svg", null, "image/svg+xml");

  const pageResults = results.filter((result) => result.expectedType === "text/html");
  const orderedPageTimes = pageResults.map((result) => result.elapsed).sort((a, b) => a - b);
  const averagePageMs = Math.round(
    orderedPageTimes.reduce((total, elapsed) => total + elapsed, 0) /
      Math.max(1, orderedPageTimes.length),
  );
  const medianPageMs = orderedPageTimes.length
    ? orderedPageTimes[Math.floor(orderedPageTimes.length / 2)]
    : 0;
  const p95PageMs = orderedPageTimes.length
    ? orderedPageTimes[Math.min(orderedPageTimes.length - 1, Math.ceil(orderedPageTimes.length * 0.95) - 1)]
    : 0;
  const slowest = [...pageResults].sort((a, b) => b.elapsed - a.elapsed).slice(0, 5);
  console.log(
    JSON.stringify(
      {
        passed: results.length,
        anonymousProtection: true,
        dynamicPagesTested: dynamicPages.length,
        pagePerformance: {
          pagesMeasured: pageResults.length,
          averageMs: averagePageMs,
          medianMs: medianPageMs,
          p95Ms: p95PageMs,
        },
        slowest,
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
