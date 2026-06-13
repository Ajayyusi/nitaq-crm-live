import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import { trainerStatuses, tamamStatuses, contractStatuses, paymentTypes } from "@/models/Teacher";
import { serializeTrainer } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

const allowedStatuses = new Set<string>(trainerStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim();

    const query: Record<string, unknown> = {};
    if (status && allowedStatuses.has(status)) query.status = status;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ fullName: regex }, { phone: regex }, { specialisation: regex }];
    }

    const trainers = await Teacher.find(query).sort({ fullName: 1 }).lean();
    return NextResponse.json({ trainers: trainers.map(serializeTrainer) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load trainers.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const body = await request.json();
    const fullName = clean(body.fullName);
    const phone = clean(body.phone);
    if (!fullName) throw new Error("Full name is required.");
    if (!phone) throw new Error("Phone is required.");

    const trainer = await Teacher.create({
      fullName,
      fullNameAr: clean(body.fullNameAr) || undefined,
      phone,
      email: clean(body.email) || undefined,
      emiratesId: clean(body.emiratesId) || undefined,
      nationality: clean(body.nationality) || undefined,
      specialisation: clean(body.specialisation) || undefined,
      qualifications: clean(body.qualifications) || undefined,
      tamamStatus: tamamStatuses.includes(clean(body.tamamStatus) as any)
        ? clean(body.tamamStatus)
        : "Not Registered",
      tamamNumber: clean(body.tamamNumber) || undefined,
      contractStatus: contractStatuses.includes(clean(body.contractStatus) as any)
        ? clean(body.contractStatus)
        : "No Contract",
      contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : undefined,
      contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : undefined,
      paymentRate: body.paymentRate ? Number(body.paymentRate) : undefined,
      paymentType: paymentTypes.includes(clean(body.paymentType) as any)
        ? clean(body.paymentType)
        : "Per Session",
      status: allowedStatuses.has(clean(body.status)) ? clean(body.status) : "Active",
      notes: clean(body.notes) || undefined,
    });

    return NextResponse.json({ trainer: serializeTrainer(trainer) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create trainer.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
