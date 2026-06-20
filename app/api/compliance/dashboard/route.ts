import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import LearnerProfile from "@/models/LearnerProfile";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  const [profiles, riskCounts] = await Promise.all([
    LearnerProfile.find({ isActive: true })
      .select("fullName riskStatus riskNotes photoOnFile documents enrollmentId updatedAt")
      .lean(),
    LearnerProfile.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$riskStatus", count: { $sum: 1 } } },
    ]),
  ]);

  const total = profiles.length;

  // Count missing required docs
  const required = ["Emirates ID", "Passport", "Visa"];
  let missingDocCount = 0;
  let docCompletionSum = 0;

  const highRisk: { id: string; fullName: string; riskStatus: string; missingDocs: string[] }[] = [];

  for (const p of profiles) {
    const docMap = new Map(
      (p.documents ?? []).map((d: any) => [d.docType, d.status])
    );
    const missingDocs: string[] = [];
    for (const t of required) {
      if (docMap.get(t) !== "Present") missingDocs.push(t);
    }
    if (!p.photoOnFile) missingDocs.push("Photo");

    if (missingDocs.length > 0) missingDocCount++;

    const presentCount = 4 - missingDocs.length;
    docCompletionSum += Math.round((presentCount / 4) * 100);

    if (p.riskStatus === "High") {
      highRisk.push({
        id: (p as any)._id.toString(),
        fullName: p.fullName,
        riskStatus: p.riskStatus,
        missingDocs,
      });
    }
  }

  const avgDocCompletion = total > 0 ? Math.round(docCompletionSum / total) : 100;
  const riskMap: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
  for (const r of riskCounts) riskMap[r._id as string] = r.count;

  // Centre health score: penalise for missing docs (40%) and risk (60%)
  const docScore = avgDocCompletion;
  const riskScore =
    total > 0
      ? Math.round(
          ((riskMap.Low * 100 + riskMap.Medium * 60 + riskMap.High * 0) / total)
        )
      : 100;
  const healthScore = Math.round(docScore * 0.4 + riskScore * 0.6);

  return NextResponse.json({
    total,
    active: total,
    missingDocCount,
    avgDocCompletion,
    riskCounts: riskMap,
    highRisk,
    healthScore,
  });
}
