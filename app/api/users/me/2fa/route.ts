import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/api-auth";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

/** GET — current 2FA status */
export async function GET() {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const user = await User.findById(authed.id).select("twoFactorEnabled").lean();
  return NextResponse.json({ enabled: !!user?.twoFactorEnabled });
}

/**
 * POST — manage 2FA. Body: { action: "setup" | "verify" | "disable", ... }
 *  setup:   generates a pending secret, returns QR data-URL + manual key
 *  verify:  { code } — confirms the pending secret and enables 2FA
 *  disable: { password, code } — turns 2FA off (requires both factors)
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  // Throttle code guessing: 10 attempts / 15 min per user
  const { ok } = rateLimit(`2fa:${authed.id}`, 10, 15 * 60 * 1000);
  if (!ok) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });

  try {
    await connectDB();
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "setup") {
      const secret = generateTotpSecret();
      await User.updateOne({ _id: authed.id }, { $set: { twoFactorPendingSecret: secret } });
      const uri = totpUri(secret, authed.email || authed.name);
      const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
      return NextResponse.json({ qrDataUrl, manualKey: secret });
    }

    if (action === "verify") {
      const user = await User.findById(authed.id).select("+twoFactorPendingSecret");
      if (!user?.twoFactorPendingSecret) {
        return NextResponse.json({ message: "No setup in progress — start again." }, { status: 400 });
      }
      if (!verifyTotp(user.twoFactorPendingSecret, String(body.code ?? ""))) {
        return NextResponse.json({ message: "Invalid code. Check your authenticator app and try again." }, { status: 400 });
      }
      user.twoFactorSecret = user.twoFactorPendingSecret;
      user.twoFactorPendingSecret = undefined;
      user.twoFactorEnabled = true;
      await user.save();
      logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "User", entityId: authed.id, entityLabel: authed.name, detail: "2FA enabled" });
      return NextResponse.json({ enabled: true, message: "Two-factor authentication is now ON." });
    }

    if (action === "disable") {
      const user = await User.findById(authed.id).select("+password +twoFactorSecret");
      if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });
      if (!user.twoFactorEnabled) return NextResponse.json({ message: "2FA is not enabled." }, { status: 400 });

      const passwordOk = await bcrypt.compare(String(body.password ?? ""), user.password);
      if (!passwordOk) return NextResponse.json({ message: "Wrong password." }, { status: 400 });
      if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, String(body.code ?? ""))) {
        return NextResponse.json({ message: "Invalid authenticator code." }, { status: 400 });
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorPendingSecret = undefined;
      await user.save();
      logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "User", entityId: authed.id, entityLabel: authed.name, detail: "2FA disabled" });
      return NextResponse.json({ enabled: false, message: "Two-factor authentication is OFF." });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "2FA operation failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
