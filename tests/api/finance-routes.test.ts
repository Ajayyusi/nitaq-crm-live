/**
 * Money routes, tested through the REAL route handlers.
 *
 * These are the regressions the audit found in production code paths that
 * the engine-level tests could never catch:
 *  - editing a payment or expense silently dropped it from the ledger
 *  - a "Refund" was posted as money coming IN
 *  - postings into a locked period were swallowed, leaving unposted documents
 *  - Enrollment.amountPaid ignored payments recorded on the Payments page,
 *    and a double-click / lower-then-raise recorded the same money twice
 *  - deleting a registration orphaned its payments
 *  - sales could read every student's ID documents and fees via the API
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: vi.fn(async () => undefined) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import * as paymentsRoute from "@/app/api/payments/route";
import * as paymentRoute from "@/app/api/payments/[id]/route";
import * as expensesRoute from "@/app/api/expenses/route";
import * as expenseRoute from "@/app/api/expenses/[id]/route";
import * as enrollmentsRoute from "@/app/api/enrollments/route";
import * as enrollmentRoute from "@/app/api/enrollments/[id]/route";
import { Payment, Expense } from "@/models/Financial";
import Enrollment from "@/models/Enrollment";
import Teacher from "@/models/Teacher";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import JournalEntry from "@/models/accounting/JournalEntry";
import { __resetAuthCache } from "@/lib/api-auth";
import { connectTestDb, disconnectTestDb, resetDb, seedCoa, configureSettings, ACC } from "../helpers/db";
import { signInAs, signOut, req, ctx, json } from "../helpers/route";

beforeAll(async () => {
  await connectTestDb();
  await JournalEntry.init();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
  await seedCoa();
  await configureSettings({});
  await signInAs("admin");
});

const posted = (sourceId: string) => JournalEntry.find({ sourceId, status: "Posted" }).lean();

async function createPayment(body: Record<string, unknown>) {
  const res = await json<{ payment: { id: string }; message?: string }>(
    await paymentsRoute.POST(req("POST", "/api/payments", {
      studentName: "Aisha Rahman", amount: 1000, paymentMethod: "Cash", status: "Received",
      datePaid: "2026-08-10", ...body,
    }))
  );
  return res;
}

describe("payment edits keep the ledger in step", () => {
  it("changing the amount leaves exactly one posted receipt, at the new amount", async () => {
    const { body } = await createPayment({});
    const id = body.payment.id;

    const edit = await json(await paymentRoute.PATCH(
      req("PATCH", `/api/payments/${id}`, { amount: 1200, datePaid: "2026-08-10", notes: "corrected" }), ctx(id)
    ));
    expect(edit.status).toBe(200);

    const active = await posted(id);
    expect(active).toHaveLength(1);
    expect(active[0].totalDebit).toBe(1200);
    const payment = await Payment.findById(id).lean();
    expect(String(payment!.journalEntryId)).toBe(String(active[0]._id));
  });

  it("a notes-only save (the form re-sends the same date) does not reverse anything", async () => {
    const { body } = await createPayment({});
    const id = body.payment.id;
    await paymentRoute.PATCH(
      req("PATCH", `/api/payments/${id}`, { amount: 1000, datePaid: "2026-08-10", paymentMethod: "Cash", status: "Received", notes: "typo" }),
      ctx(id)
    );
    expect(await JournalEntry.countDocuments({ sourceType: "Reversal" })).toBe(0);
    expect(await posted(id)).toHaveLength(1);
  });

  it("repairs a Received payment that has no live entry on its next edit", async () => {
    const { body } = await createPayment({});
    const id = body.payment.id;
    // Simulate the old bug: entry reversed, link left behind
    await JournalEntry.updateMany({ sourceId: id }, { $set: { status: "Reversed" } });

    await paymentRoute.PATCH(req("PATCH", `/api/payments/${id}`, { notes: "any edit" }), ctx(id));
    expect(await posted(id)).toHaveLength(1);
  });

  it("deleting a payment reverses its receipt", async () => {
    const { body } = await createPayment({});
    const id = body.payment.id;
    const res = await paymentRoute.DELETE(req("DELETE", `/api/payments/${id}`), ctx(id));
    expect(res.status).toBe(200);
    expect(await Payment.countDocuments({})).toBe(0);
    expect(await posted(id)).toHaveLength(0);
    expect(await AuditLog.countDocuments({ entity: "Payment", action: "deleted" })).toBe(1);
  });
});

describe("refunds", () => {
  it("a Received refund moves money OUT of the cash account", async () => {
    const { status, body } = await createPayment({ paymentType: "Refund", amount: 300 });
    expect(status).toBe(201);
    const [entry] = await posted(body.payment.id);
    expect(entry.sourceType).toBe("Refund");
    const cash = entry.lines.find((l) => l.accountCode === ACC.cash)!;
    expect(cash.credit).toBe(300);
    expect(cash.debit).toBe(0);
  });
});

describe("validation and locked periods", () => {
  it("rejects a non-finite amount", async () => {
    const { status } = await createPayment({ amount: "Infinity" });
    expect(status).toBe(400);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("refuses a payment dated in a locked period instead of saving it unposted", async () => {
    await configureSettings({ lockDate: new Date("2026-08-31") });
    const { status, body } = await createPayment({ datePaid: "2026-08-15" });
    expect(status).toBe(400);
    expect(body.message).toMatch(/locked/);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("refuses to edit a payment whose entry sits in a locked period, and changes nothing", async () => {
    const { body } = await createPayment({ datePaid: "2026-08-10" });
    const id = body.payment.id;
    await configureSettings({ lockDate: new Date("2026-08-31") });

    const res = await paymentRoute.PATCH(req("PATCH", `/api/payments/${id}`, { amount: 5 }), ctx(id));
    expect(res.status).toBe(400);
    expect((await Payment.findById(id).lean())!.amount).toBe(1000);
    expect(await posted(id)).toHaveLength(1);
  });

  it("does not leak database error details", async () => {
    vi.spyOn(Payment, "find").mockImplementation(() => {
      throw Object.assign(new Error("connection to cluster0-shard-00.mongodb.net refused"), { name: "MongoNetworkError" });
    });
    const res = await json(await paymentsRoute.GET(req("GET", "/api/payments")));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb\.net/);
  });
});

describe("expenses", () => {
  it("editing the amount re-posts with a fresh VAT split", async () => {
    await configureSettings({ vatRate: 5 });
    const created = await json<{ expense: { id: string } }>(await expensesRoute.POST(
      req("POST", "/api/expenses", { category: "Supplies", amount: 105, vatRate: 5, expenseDate: "2026-08-10" })
    ));
    const id = created.body.expense.id;

    await expenseRoute.PATCH(req("PATCH", `/api/expenses/${id}`, { amount: 210, expenseDate: "2026-08-10" }), ctx(id));
    const active = await posted(id);
    expect(active).toHaveLength(1);
    expect(active[0].lines.find((l) => l.accountCode === ACC.inputVat)?.debit).toBe(10);
    expect(active[0].totalDebit).toBe(210);
  });

  it("refuses a cash account as the expense account", async () => {
    const res = await expensesRoute.POST(
      req("POST", "/api/expenses", { category: "Supplies", amount: 100, expenseAccountCode: ACC.cash })
    );
    expect(res.status).toBe(400);
    expect(await Expense.countDocuments({})).toBe(0);
  });

  it("refuses an input VAT rate the UAE doesn't have", async () => {
    const res = await expensesRoute.POST(req("POST", "/api/expenses", { category: "Supplies", amount: 150, vatRate: 50 }));
    expect(res.status).toBe(400);
  });
});

describe("Enrollment.amountPaid follows payments", () => {
  async function makeEnrollment(over: Record<string, unknown> = {}) {
    return Enrollment.create({
      enrollmentId: `E-${Math.floor(Math.random() * 1e6)}`, fullName: "Omar Saleh", phone: "+971500000009",
      course: "IELTS", totalFee: 5000, amountPaid: 0, ...over,
    });
  }

  it("a payment recorded on the Payments page updates the student's balance", async () => {
    const e = await makeEnrollment();
    const { body } = await createPayment({ enrollmentId: String(e._id), amount: 1000 });
    expect((await Enrollment.findById(e._id).lean())!.amountPaid).toBe(1000);

    await paymentRoute.PATCH(req("PATCH", `/api/payments/${body.payment.id}`, { amount: 1500 }), ctx(body.payment.id));
    expect((await Enrollment.findById(e._id).lean())!.amountPaid).toBe(1500);

    await paymentRoute.DELETE(req("DELETE", `/api/payments/${body.payment.id}`), ctx(body.payment.id));
    expect((await Enrollment.findById(e._id).lean())!.amountPaid).toBe(0);
  });

  it("lowering amountPaid on the enrollment is refused (it used to allow paying twice)", async () => {
    const e = await makeEnrollment({ amountPaid: 1000 });
    const res = await enrollmentRoute.PATCH(req("PATCH", `/api/enrollments/${e._id}`, { amountPaid: 0 }), ctx(String(e._id)));
    expect(res.status).toBe(409);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("a double-clicked 'record payment' on the enrollment records it once", async () => {
    const e = await makeEnrollment();
    const id = String(e._id);
    const results = await Promise.all([
      enrollmentRoute.PATCH(req("PATCH", `/api/enrollments/${id}`, { amountPaid: 500, paymentMethod: "Cash" }), ctx(id)),
      enrollmentRoute.PATCH(req("PATCH", `/api/enrollments/${id}`, { amountPaid: 500, paymentMethod: "Cash" }), ctx(id)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Payment.countDocuments({ enrollmentId: e._id })).toBe(1);
    expect(await JournalEntry.countDocuments({ sourceType: "Receipt", status: "Posted" })).toBe(1);
  });

  it("a fee change reverses the old invoice and posts the new one", async () => {
    const created = await json<{ enrollment: { id: string } }>(await enrollmentsRoute.POST(
      req("POST", "/api/enrollments", { fullName: "Omar Saleh", phone: "+971500000009", course: "IELTS", totalFee: 1000 })
    ));
    const id = created.body.enrollment.id;
    await enrollmentRoute.PATCH(req("PATCH", `/api/enrollments/${id}`, { totalFee: 2000 }), ctx(id));
    const invoices = await JournalEntry.find({ sourceType: "Invoice", sourceId: id, status: "Posted" }).lean();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].totalDebit).toBe(2000);
  });

  it("clearing a registration's trainer pay rate really clears it", async () => {
    const e = await makeEnrollment({ teacherPayRate: 150, teacherPayBasis: "Per Class" });
    const id = String(e._id);
    const res = await enrollmentRoute.PATCH(
      req("PATCH", `/api/enrollments/${id}`, { teacherPayRate: "", teacherPayBasis: "" }), ctx(id)
    );
    expect(res.status).toBe(200);
    const after = await Enrollment.findById(id).lean();
    expect(after!.teacherPayRate).toBeUndefined();
  });

  it("a registration with payments can't be deleted", async () => {
    const e = await makeEnrollment();
    await createPayment({ enrollmentId: String(e._id), amount: 100 });
    const res = await enrollmentRoute.DELETE(req("DELETE", `/api/enrollments/${e._id}`), ctx(String(e._id)));
    expect(res.status).toBe(409);
    expect(await Enrollment.countDocuments({})).toBe(1);
  });
});

describe("who can read student records", () => {
  it("sales gets 403 from the enrollments API", async () => {
    await signInAs("sales");
    const res = await enrollmentsRoute.GET(req("GET", "/api/enrollments"));
    expect(res.status).toBe(403);
  });

  it("a trainer sees their students without ID documents or fees", async () => {
    const trainer = await signInAs("trainer", { email: "layla@test.local" });
    const teacher = await Teacher.create({ fullName: "Layla", phone: "+971500000001", email: trainer.email });
    await Enrollment.create({
      enrollmentId: "E-1", fullName: "Omar", phone: "+971500000009", course: "IELTS",
      totalFee: 5000, amountPaid: 1000, emiratesId: "784-1990-1234567-1",
      teacherId: teacher._id, teacherIds: [teacher._id],
    });
    const res = await json<{ enrollments: { emiratesId: string; totalFee: number; fullName: string }[] }>(
      await enrollmentsRoute.GET(req("GET", "/api/enrollments"))
    );
    expect(res.status).toBe(200);
    expect(res.body.enrollments).toHaveLength(1);
    expect(res.body.enrollments[0].fullName).toBe("Omar");
    expect(res.body.enrollments[0].emiratesId).toBe("");
    expect(res.body.enrollments[0].totalFee).toBe(0);
  });
});

describe("requireAuth fails closed", () => {
  it("a deactivated account is refused even with a valid session", async () => {
    const u = await signInAs("finance");
    await User.updateOne({ _id: u.id }, { $set: { active: false } });
    __resetAuthCache();
    expect((await paymentsRoute.GET(req("GET", "/api/payments"))).status).toBe(401);
  });

  it("a demoted account loses access without waiting for its token to expire", async () => {
    const u = await signInAs("finance");
    await User.updateOne({ _id: u.id }, { $set: { role: "sales" } });
    __resetAuthCache();
    expect((await paymentsRoute.GET(req("GET", "/api/payments"))).status).toBe(403);
  });

  it("when the account can't be checked, the request is refused (503), not waved through", async () => {
    await signInAs("finance");
    __resetAuthCache();
    vi.spyOn(User, "findById").mockImplementation(() => {
      throw new Error("db down");
    });
    expect((await paymentsRoute.GET(req("GET", "/api/payments"))).status).toBe(503);
  });

  it("no session → 401", async () => {
    signOut();
    expect((await paymentsRoute.GET(req("GET", "/api/payments"))).status).toBe(401);
  });
});
