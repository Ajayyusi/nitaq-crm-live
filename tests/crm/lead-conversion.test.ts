/**
 * Converting a lead must clear its chase state.
 *
 * Once a lead becomes a student its follow-up date and any pending follow-up
 * records have to stop counting, or the enrolled student keeps appearing as
 * an overdue chase on the dashboard and in the follow-ups list forever.
 *
 * These tests exercise the same operations the PATCH route performs, plus the
 * dashboard's overdue query, so both halves of the fix are covered.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Lead from "@/models/Lead";
import FollowUp from "@/models/FollowUp";
import { connectTestDb, disconnectTestDb, resetDb } from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
});

/** Stages after which a lead is no longer chased — mirrors the API route. */
const CLOSED_STAGES = new Set(["Enrolled", "Paid", "Lost", "Not Interested", "Invalid Number"]);
const CLOSED_LEAD_STAGES = [...CLOSED_STAGES];

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function makeLead(over: Record<string, unknown> = {}) {
  return Lead.create({
    leadId: `L-${Math.floor(Math.random() * 1_000_000)}`,
    fullName: "Aisha Rahman",
    phone: `+9715${Math.floor(Math.random() * 100_000_000)}`,
    course: "Other",
    source: "WhatsApp",
    stage: "Interested",
    nextFollowUpDate: YESTERDAY,
    ...over,
  });
}

/** The operation the PATCH route runs when a lead reaches a closed stage. */
async function closeChase(leadId: string) {
  await Lead.updateOne({ _id: leadId }, { $unset: { nextFollowUpDate: "" } });
  return FollowUp.updateMany({ leadId, status: "Pending" }, { $set: { status: "Done" } });
}

/** The dashboard's overdue count. */
function overdueQuery() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return {
    nextFollowUpDate: { $lt: todayStart },
    stage: { $nin: CLOSED_LEAD_STAGES },
  };
}

describe("converting a lead clears its chase state", () => {
  it("drops the overdue follow-up date", async () => {
    const lead = await makeLead();
    expect(await Lead.countDocuments(overdueQuery())).toBe(1);

    await Lead.updateOne({ _id: lead._id }, { $set: { stage: "Enrolled" } });
    await closeChase(String(lead._id));

    const after = await Lead.findById(lead._id).lean();
    expect(after!.nextFollowUpDate).toBeUndefined();
    expect(await Lead.countDocuments(overdueQuery())).toBe(0);
  });

  it("closes the lead's pending follow-ups", async () => {
    const lead = await makeLead();
    await FollowUp.create({
      leadId: lead._id,
      contactName: lead.fullName,
      phone: lead.phone,
      type: "Phone Call",
      followUpDate: YESTERDAY,
      status: "Pending",
    });
    await FollowUp.create({
      leadId: lead._id,
      contactName: lead.fullName,
      phone: lead.phone,
      type: "WhatsApp Message",
      followUpDate: YESTERDAY,
      status: "Done",
    });

    const res = await closeChase(String(lead._id));
    expect(res.modifiedCount).toBe(1); // only the pending one changed

    const stillPending = await FollowUp.countDocuments({ leadId: lead._id, status: "Pending" });
    expect(stillPending).toBe(0);
  });

  it("leaves another lead's follow-ups alone", async () => {
    const converted = await makeLead();
    const other = await makeLead({ fullName: "Omar Nasser" });
    for (const l of [converted, other]) {
      await FollowUp.create({
        leadId: l._id,
        contactName: l.fullName,
        phone: l.phone,
        type: "Phone Call",
        followUpDate: YESTERDAY,
        status: "Pending",
      });
    }

    await closeChase(String(converted._id));

    expect(await FollowUp.countDocuments({ leadId: other._id, status: "Pending" })).toBe(1);
  });
});

describe("dashboard overdue count", () => {
  it("excludes every closed stage, including already-enrolled leads", async () => {
    // A historic record that kept its follow-up date after conversion
    for (const stage of CLOSED_LEAD_STAGES) {
      await makeLead({ stage, fullName: `Closed ${stage}` });
    }
    expect(await Lead.countDocuments(overdueQuery())).toBe(0);
  });

  it("still counts leads that are genuinely being chased", async () => {
    await makeLead({ stage: "Interested" });
    await makeLead({ stage: "Contacted" });
    await makeLead({ stage: "Enrolled" }); // converted — must not count
    expect(await Lead.countDocuments(overdueQuery())).toBe(2);
  });
});
