import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import FollowUp from "@/models/FollowUp";
import User from "@/models/User";
import { getNextSequence } from "@/models/Counter";
const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
};

export async function POST() {
  const user = await requireAuth(["admin"]);
  if (user instanceof NextResponse) return user;

  try {
    await connectDB();

    // ── Migrate legacy "staff" role → "sales" ─────────────────────────────
    const migrated = await User.updateMany(
      { role: "staff" },
      { $set: { role: "sales" } }
    );

    // ── Skip sample data if it already exists ──────────────────────────────
    const leadCount = await Lead.countDocuments();
    if (leadCount > 0) {
      return NextResponse.json({
        message: `${migrated.modifiedCount} legacy "staff" user(s) migrated to "sales". Sample data already exists — skipping.`,
      });
    }

    // ── Leads (15) ────────────────────────────────────────────────────────
    const leadsData = [
      { fullName: "Fatima Al Hashimi", phone: "+971501234567", source: "Instagram", course: "Digital Marketing Mastery", stage: "Interested", notes: "Saw our Reel, wants weekend batch. Asked about group discount.", nextFollowUpDate: daysFromNow(1) },
      { fullName: "Mohammed Al Zaabi", phone: "+971509876543", source: "WhatsApp", course: "AI for Professionals", stage: "Contacted", notes: "CEO of small firm, wants 3-person corporate enrollment.", nextFollowUpDate: today() },
      { fullName: "Layla Nasser", phone: "+971551112233", source: "Referral", course: "Excel & Power BI", stage: "Lead", notes: "Referred by Sara Al Mansoori. Works in finance.", nextFollowUpDate: daysFromNow(2) },
      { fullName: "Ahmed Saeed Al Kaabi", phone: "+971504445566", source: "Walk-in", course: "Cybersecurity Essentials", stage: "Enrolled" },
      { fullName: "Hessa Al Marri", phone: "+971557778899", source: "Google Maps", course: "Language Training", stage: "Lost", notes: "Found a cheaper option in Ajman." },
      { fullName: "Khalid Al Rashidi", phone: "+971506667777", source: "WhatsApp", course: "Web Development", stage: "Interested", notes: "Fresh graduate, looking for evening classes.", nextFollowUpDate: today() },
      { fullName: "Noura Bint Hamdan", phone: "+971523334444", source: "Paid Ads", course: "Sales & Negotiation", stage: "Contacted", notes: "Sales manager at Al Futtaim, looking for team training.", nextFollowUpDate: daysFromNow(-1) },
      { fullName: "Saeed Al Blooshi", phone: "+971505556666", source: "Instagram", course: "CyberShield Program", stage: "Lead", nextFollowUpDate: daysFromNow(3) },
      { fullName: "Mariam Al Suwaidi", phone: "+971558889999", source: "Referral", course: "Supportive Education - Maths", stage: "Interested", notes: "For her son, 14 years old, struggling with grade 9 maths." },
      { fullName: "Abdullah Al Mansoori", phone: "+971507778888", source: "Walk-in", course: "General Academic Support", stage: "Enrolled" },
      { fullName: "Reem Al Ketbi", phone: "+971521113333", source: "Google Maps", course: "Digital Marketing Mastery", stage: "Paid" },
      { fullName: "Omar Khalil", phone: "+971509990000", source: "WhatsApp", course: "Excel & Power BI", stage: "Lead", nextFollowUpDate: daysFromNow(-2) },
      { fullName: "Aisha Bint Mohammed", phone: "+971556667777", source: "Instagram", course: "Language Training", stage: "Interested", notes: "Wants intensive English business writing." },
      { fullName: "Hassan Al Dhaheri", phone: "+971503331111", source: "Paid Ads", course: "AI for Professionals", stage: "Contacted", nextFollowUpDate: daysFromNow(1) },
      { fullName: "Shaikha Al Mazrouei", phone: "+971527772222", source: "Referral", course: "Supportive Education - English", stage: "Lost", notes: "Enrolled with competitor in Dubai." },
    ];
    for (const d of leadsData) {
      const seq = await getNextSequence("lead");
      await Lead.create({ leadId: `L-${String(seq).padStart(3, "0")}`, ...d });
    }

    // ── Enrollments ────────────────────────────────────────────────────────
    const enrollmentsData = [
      { fullName: "Ahmed Saeed Al Kaabi", phone: "+971504445566", course: "Cybersecurity Essentials", status: "Active", paymentStatus: "Instalment 1 Paid", totalFee: 2500, amountPaid: 1250, batchName: "Batch A", format: "In-Person", startDate: new Date("2026-06-01") },
      { fullName: "Reem Al Ketbi", phone: "+971521113333", course: "Digital Marketing Mastery", status: "Active", paymentStatus: "Paid Full", totalFee: 1800, amountPaid: 1800, batchName: "Batch A", format: "Online", startDate: new Date("2026-05-15") },
      { fullName: "Abdullah Al Mansoori", phone: "+971507778888", course: "General Academic Support", status: "Active", paymentStatus: "Paid Full", totalFee: 900, amountPaid: 900, batchName: "Batch B", format: "In-Person", startDate: new Date("2026-05-20") },
      { fullName: "Sara Mahmoud", phone: "+971503334444", course: "Digital Marketing Mastery", status: "Completed", paymentStatus: "Paid Full", totalFee: 1800, amountPaid: 1800, batchName: "Batch Prev", format: "Online", startDate: new Date("2026-03-01"), endDate: new Date("2026-05-31") },
      { fullName: "Khalid Al Rashidi Jr", phone: "+971506669999", course: "Excel & Power BI", status: "Active", paymentStatus: "Overdue", totalFee: 1200, amountPaid: 0, batchName: "Batch A", format: "In-Person", startDate: new Date("2026-06-01") },
    ];
    for (const d of enrollmentsData) {
      const seq = await getNextSequence("enrollment");
      await Enrollment.create({ enrollmentId: `E-${String(seq).padStart(3, "0")}`, ...d });
    }

    // ── Payments ───────────────────────────────────────────────────────────
    const paymentsData = [
      { studentName: "Ahmed Saeed Al Kaabi", course: "Cybersecurity Essentials", amount: 1250, paymentType: "Instalment 1 of 2", paymentMethod: "Bank Transfer", status: "Received", datePaid: new Date("2026-06-01") },
      { studentName: "Reem Al Ketbi", course: "Digital Marketing Mastery", amount: 1800, paymentType: "Full Payment", paymentMethod: "Card", status: "Received", datePaid: new Date("2026-05-15") },
      { studentName: "Abdullah Al Mansoori", course: "General Academic Support", amount: 900, paymentType: "Full Payment", paymentMethod: "Cash", status: "Received", datePaid: new Date("2026-05-20") },
      { studentName: "Sara Mahmoud", course: "Digital Marketing Mastery", amount: 1800, paymentType: "Full Payment", paymentMethod: "Card", status: "Received", datePaid: new Date("2026-03-01") },
      { studentName: "Ahmed Saeed Al Kaabi", course: "Cybersecurity Essentials", amount: 1250, paymentType: "Instalment 2 of 2", paymentMethod: "Bank Transfer", status: "Pending", dueDate: new Date("2026-07-01") },
      { studentName: "Khalid Al Rashidi Jr", course: "Excel & Power BI", amount: 1200, paymentType: "Full Payment", paymentMethod: "Cash", status: "Overdue", dueDate: new Date("2026-06-05") },
    ];
    for (const d of paymentsData) {
      const seq = await getNextSequence("payment");
      await Payment.create({ paymentId: `P-${String(seq).padStart(3, "0")}`, ...d });
    }

    // ── Follow-Ups ─────────────────────────────────────────────────────────
    const followUpsData = [
      { contactName: "Mohammed Al Zaabi", phone: "+971509876543", course: "AI for Professionals", followUpDate: today(), type: "WhatsApp Message", status: "Pending", notes: "Send corporate package pricing", assignedTo: "Muzzamil Al Farsi" },
      { contactName: "Khalid Al Rashidi", phone: "+971506667777", course: "Web Development", followUpDate: today(), type: "Phone Call", status: "Pending", notes: "Confirm evening batch availability", assignedTo: "Sara Al Mansoori" },
      { contactName: "Noura Bint Hamdan", phone: "+971523334444", course: "Sales & Negotiation", followUpDate: daysFromNow(-1), type: "Send Brochure", status: "Pending", notes: "Team training quote — overdue", assignedTo: "Muzzamil Al Farsi" },
      { contactName: "Omar Khalil", phone: "+971509990000", course: "Excel & Power BI", followUpDate: daysFromNow(-2), type: "WhatsApp Message", status: "Pending", notes: "No response — try calling", assignedTo: "Sara Al Mansoori" },
      { contactName: "Fatima Al Hashimi", phone: "+971501234567", course: "Digital Marketing Mastery", followUpDate: daysFromNow(1), type: "Phone Call", status: "Pending", notes: "Confirm weekend batch registration", assignedTo: "Sara Al Mansoori" },
      { contactName: "Hassan Al Dhaheri", phone: "+971503331111", course: "AI for Professionals", followUpDate: daysFromNow(1), type: "Send Pricing", status: "Pending", notes: "Send schedule and enrolment form", assignedTo: "Muzzamil Al Farsi" },
      { contactName: "Layla Nasser", phone: "+971551112233", course: "Excel & Power BI", followUpDate: daysFromNow(2), type: "WhatsApp Message", status: "Pending", notes: "First contact — introduce courses", assignedTo: "Sara Al Mansoori" },
      { contactName: "Mariam Al Suwaidi", phone: "+971558889999", course: "Supportive Education - Maths", followUpDate: daysFromNow(3), type: "Phone Call", status: "Pending", notes: "Discuss assessment session", assignedTo: "Muzzamil Al Farsi" },
    ];
    for (const d of followUpsData) {
      await FollowUp.create(d);
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    const expensesData = [
      { category: "Rent", amount: 8000, expenseDate: new Date("2026-06-01"), payee: "Al Nahda Properties LLC", description: "Monthly rent — June 2026" },
      { category: "Marketing", amount: 1500, expenseDate: new Date("2026-06-03"), payee: "Meta Business Suite", description: "Instagram & Facebook campaigns — June" },
      { category: "Supplies", amount: 350, expenseDate: new Date("2026-06-05"), payee: "Office World Sharjah", description: "Stationery and printing" },
      { category: "Utilities", amount: 620, expenseDate: new Date("2026-06-01"), payee: "SEWA", description: "Electricity and water — June 2026" },
      { category: "Salaries", amount: 15000, expenseDate: new Date("2026-06-01"), payee: "Payroll — June 2026", description: "Staff salaries" },
    ];
    for (const d of expensesData) {
      const seq = await getNextSequence("expense");
      await Expense.create({ expenseId: `EXP-${String(seq).padStart(3, "0")}`, ...d });
    }

    return NextResponse.json({
      message: `Seed complete: 3 staff accounts, ${leadsData.length} leads, ${enrollmentsData.length} enrollments, ${paymentsData.length} payments, ${followUpsData.length} follow-ups, ${expensesData.length} expenses.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
