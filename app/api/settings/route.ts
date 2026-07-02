import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import connectDB from "@/lib/db";
import Settings, { getSettings } from "@/models/Settings";

/** Public — no auth required. Returns all non-sensitive settings for branding. */
export async function GET() {
  try {
    await connectDB();
    const s = await getSettings();
    return NextResponse.json({
      academyNameEn:  s.academyNameEn,
      academyNameAr:  s.academyNameAr,
      phone:          s.phone,
      whatsappNumber: s.whatsappNumber,
      email:          s.email,
      website:        s.website,
      address:        s.address,
      city:           s.city,
      logoBase64:     s.logoBase64 ?? "",
      currency:       s.currency,
      vatEnabled:     s.vatEnabled,
      vatRate:        s.vatRate,
      vatNumber:      s.vatNumber,
      receiptPrefix:  s.receiptPrefix,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

/** Admin only — updates any subset of settings fields. */
export async function PATCH(request: NextRequest) {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const allowed = [
      "academyNameEn", "academyNameAr", "phone", "whatsappNumber",
      "email", "website", "address", "city", "logoBase64",
      "currency", "vatEnabled", "vatRate", "vatNumber", "receiptPrefix",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "vatEnabled") updates[key] = Boolean(body[key]);
        else if (key === "vatRate") updates[key] = Number(body[key]) || 5;
        else if (key === "logoBase64") updates[key] = String(body[key]); // don't trim base64
        else updates[key] = String(body[key]).trim();
      }
    }

    const s = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      { upsert: true, new: true }
    );

    // Return the same whitelisted shape as GET — never the raw document
    return NextResponse.json({
      success: true,
      settings: {
        academyNameEn:  s.academyNameEn,
        academyNameAr:  s.academyNameAr,
        phone:          s.phone,
        whatsappNumber: s.whatsappNumber,
        email:          s.email,
        website:        s.website,
        address:        s.address,
        city:           s.city,
        logoBase64:     s.logoBase64 ?? "",
        currency:       s.currency,
        vatEnabled:     s.vatEnabled,
        vatRate:        s.vatRate,
        vatNumber:      s.vatNumber,
        receiptPrefix:  s.receiptPrefix,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
