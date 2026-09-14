/**
 * CRM, user-management and session rules, tested through REAL route handlers.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: vi.fn(async () => undefined) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import { auth } from "@/auth";
import * as leadRoute from "@/app/api/leads/[id]/route";
import * as usersRoute from "@/app/api/users/route";
import * as userRoute from "@/app/api/users/[id]/route";
import * as exportRoute from "@/app/api/export/[entity]/route";
import * as myStudentsRoute from "@/app/api/my/students/route";
import * as journalRoute from "@/app/api/accounting/journal-entries/[id]/route";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/accounting/JournalEntry";
import { createJournalEntry } from "@/lib/accounting/engine";
import { __resetAuthCache } from "@/lib/api-auth";
import { connectTestDb, disconnectTestDb, resetDb, seedCoa, configureSettings, ACC } from "../helpers/db";
import { signInAs, req, ctx, json } from "../helpers/route";

beforeAll(async () => {
  await connectTestDb();
  await Promise.all([Enrollment.init(), JournalEntry.init()]);
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
});

async function makeLead(over: Record<string, unknown> = {}) {
  return Lead.create({
    leadId: `L-${Math.floor(Math.random() * 1e6)}`, fullName: "Aisha Rahman",
    phone: `+9715${Math.floor(Math.random() * 1e8)}`, course: "Other", source: "WhatsApp", stage: "Interested",
    ...over,
  });
}

describe("lead → enrollment conversion", () => {
  it("sales can't create a registration by setting a lead to Enrolled", async () => {
    const sales = await signInAs("sales");
    const lead = await makeLead({ assignedTo: sales.name });
    const res = await leadRoute.PATCH(req("PATCH", `/api/leads/${lead._id}`, { stage: "Enrolled" }), ctx(String(lead._id)));
    expect(res.status).toBe(403);
    expect(await Enrollment.countDocuments({})).toBe(0);
    expect((await Lead.findById(lead._id).lean())!.stage).toBe("Interested");
  });

  it("two conversions of the same lead at once create ONE registration", async () => {
    await signInAs("manager");
    const lead = await makeLead();
    const id = String(lead._id);
    const results = await Promise.all([
      leadRoute.PATCH(req("PATCH", `/api/leads/${id}`, { stage: "Enrolled" }), ctx(id)),
      leadRoute.PATCH(req("PATCH", `/api/leads/${id}`, { stage: "Enrolled" }), ctx(id)),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await Enrollment.countDocuments({ leadId: lead._id })).toBe(1);
  });
});

describe("user management", () => {
  it("an admin can't change their own role", async () => {
    const admin = await signInAs("admin");
    const res = await userRoute.PATCH(req("PATCH", `/api/users/${admin.id}`, { role: "sales" }), ctx(admin.id));
    expect(res.status).toBe(400);
    expect((await User.findById(admin.id).lean())!.role).toBe("admin");
  });

  it("role changes, deactivations and creations are audited", async () => {
    await signInAs("admin");
    const created = await json<{ user: { id: string } }>(await usersRoute.POST(
      req("POST", "/api/users", { name: "New Finance", email: "fin@test.local", password: "correct-horse-1", role: "finance" })
    ));
    expect(created.status).toBe(201);
    const id = created.body.user.id;

    await userRoute.PATCH(req("PATCH", `/api/users/${id}`, { role: "accountant", active: false }), ctx(id));

    const events = await AuditLog.find({ entity: "User", entityId: id }).lean();
    expect(events.map((e) => e.action).sort()).toEqual(["created", "updated"]);
    expect(events.find((e) => e.action === "updated")!.detail).toMatch(/finance → accountant.*Deactivated/);
  });
});

describe("exports", () => {
  it("sales exports only their own leads", async () => {
    const sales = await signInAs("sales");
    await makeLead({ fullName: "Mine", assignedTo: sales.name });
    await makeLead({ fullName: "Created by me", createdBy: sales.name });
    await makeLead({ fullName: "Someone else's", assignedTo: "Another Rep" });

    const res = await json<{ rows: { fullName: string }[] }>(
      await exportRoute.GET(req("GET", "/api/export/leads"), { params: Promise.resolve({ entity: "leads" }) })
    );
    expect(res.status).toBe(200);
    expect(res.body.rows.map((r) => r.fullName).sort()).toEqual(["Created by me", "Mine"]);
    expect(await AuditLog.countDocuments({ entity: "Export", entityId: "leads" })).toBe(1);
  });
});

describe("impersonation", () => {
  it("a session opened as another user ends when the admin behind it is demoted", async () => {
    const admin = await User.create({ name: "Admin", email: "admin@test.local", password: "x".repeat(60), role: "admin" });
    const trainer = await User.create({ name: "Trainer", email: "t@test.local", password: "x".repeat(60), role: "trainer" });
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: String(trainer._id), name: "Trainer", email: "t@test.local", role: "trainer",
        impersonatedBy: "Admin", impersonatorId: String(admin._id),
      },
      expires: "2099-01-01",
    } as never);
    __resetAuthCache();
    expect((await myStudentsRoute.GET()).status).toBe(200);

    await User.updateOne({ _id: admin._id }, { $set: { role: "manager" } });
    __resetAuthCache();
    expect((await myStudentsRoute.GET()).status).toBe(401);
  });
});

describe("journal draft edits follow the same rules as new entries", () => {
  async function draft() {
    await seedCoa();
    await configureSettings({});
    await signInAs("accountant");
    return createJournalEntry({
      date: new Date("2026-08-10"), sourceType: "JV", description: "Draft", createdBy: "tester", autoPost: false,
      lines: [{ accountCode: ACC.cash, debit: 100 }, { accountCode: ACC.revenue, credit: 100 }],
    });
  }

  it("rejects a line carrying both a debit and a credit", async () => {
    const d = await draft();
    const res = await journalRoute.PATCH(req("PATCH", `/api/accounting/journal-entries/${d._id}`, {
      lines: [{ accountCode: ACC.cash, debit: 250, credit: 250 }, { accountCode: ACC.revenue, debit: 1 }],
    }), ctx(String(d._id)));
    expect(res.status).toBe(400);
  });

  it("rejects moving a draft into a locked period", async () => {
    const d = await draft();
    await configureSettings({ lockDate: new Date("2026-08-31") });
    const res = await journalRoute.PATCH(
      req("PATCH", `/api/accounting/journal-entries/${d._id}`, { date: "2026-08-20" }), ctx(String(d._id))
    );
    expect(res.status).toBe(400);
  });
});
