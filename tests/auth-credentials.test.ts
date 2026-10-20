import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import {
  authenticateCredentials,
  type LoginAccount,
} from "../src/lib/auth-credentials";

// Test-only credentials; never use or record a real account password here.
const password = "Example-test-password-42";
const passwordHash = bcrypt.hashSync(password, 4);
const owner: LoginAccount = {
  id: "test-owner",
  name: "Test Owner",
  email: "owner@example.test",
  passwordHash,
  role: "ADMIN",
  isActive: true,
  canAssignTechnician: true,
  canGenerateBills: true,
  technician: null,
};

test("email and username sign-in use a normalized case-insensitive lookup", async () => {
  for (const [input, normalized] of [
    ["  OWNER@EXAMPLE.TEST  ", "owner@example.test"],
    ["  ADMIN  ", "admin"],
  ]) {
    const user = await authenticateCredentials({ username: input, password }, async (where) => {
      assert.deepEqual(where, {
        OR: [
          { username: { equals: normalized, mode: "insensitive" } },
          { email: { equals: normalized, mode: "insensitive" } },
        ],
      });
      return [owner];
    });
    assert.equal(user?.id, owner.id);
    assert.equal(user?.role, "ADMIN");
    assert.equal(user?.canAssignTechnician, true);
    assert.equal(user?.canGenerateBills, true);
    assert.equal(user?.technicianId, null);
    assert.equal("passwordHash" in user!, false);
  }
});

test("missing, blank and malformed credentials never query accounts", async () => {
  const lookup = async () => { throw new Error("Unexpected account lookup"); };
  for (const input of [
    undefined,
    {},
    { username: "admin" },
    { password },
    { username: "   ", password },
    { username: "admin", password: "" },
    { username: ["admin"], password },
    { username: "admin", password: 123 },
  ]) assert.equal(await authenticateCredentials(input, lookup), null);
});

test("incorrect password, unknown or disabled account cannot sign in", async () => {
  assert.equal(await authenticateCredentials({ username: "admin", password: "incorrect" }, async () => [owner]), null);
  assert.equal(await authenticateCredentials({ username: "unknown", password }, async () => []), null);
  assert.equal(await authenticateCredentials({ username: "admin", password }, async () => [{ ...owner, isActive: false }]), null);
});

test("email/username collisions are rejected instead of selecting an account", async () => {
  const other = { ...owner, id: "another-account", role: "OFFICE_STAFF" as const };
  assert.equal(await authenticateCredentials({ username: "admin", password }, async () => [owner, other]), null);
});

test("only technicians with an active linked profile can sign in", async () => {
  const technician = { ...owner, role: "TECHNICIAN" as const };
  for (const profile of [null, { id: "test-tech", isActive: false }]) {
    assert.equal(await authenticateCredentials({ username: "tech", password }, async () => [{ ...technician, technician: profile }]), null);
  }
  const user = await authenticateCredentials({ username: "tech", password }, async () => [{
    ...technician, technician: { id: "test-tech", isActive: true },
  }]);
  assert.equal(user?.role, "TECHNICIAN");
  assert.equal(user?.technicianId, "test-tech");
});

test("password comparison preserves case and whitespace", async () => {
  const spaced = "  MixedCase-test-password  ";
  const account = { ...owner, passwordHash: bcrypt.hashSync(spaced, 4) };
  assert.equal((await authenticateCredentials({ username: "admin", password: spaced }, async () => [account]))?.id, owner.id);
  for (const incorrect of [spaced.trim(), spaced.toLowerCase()]) {
    assert.equal(await authenticateCredentials({ username: "admin", password: incorrect }, async () => [account]), null);
  }
});
