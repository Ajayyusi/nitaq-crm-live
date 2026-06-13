import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import connectDB from "@/lib/db";
import { getSettings } from "@/models/Settings";
import LoginForm from "./LoginForm";

async function fetchAcademyName(): Promise<string> {
  try {
    await connectDB();
    const s = await getSettings();
    return s.academyNameEn || "Nitaq Academy";
  } catch {
    return "Nitaq Academy";
  }
}

export default async function LoginPage() {
  const academyName = await fetchAcademyName();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#1B5E20",
      }}
    >
      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.07,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />
      {/* Glow orb */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "20%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, #4CAF50, transparent)",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 480, margin: "0 16px" }}>
        <div
          style={{
            background: "white",
            borderRadius: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "40px 40px 32px", borderBottom: "1px solid #E8F5E9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#1B5E20",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 1,
                  flexShrink: 0,
                }}
              >
                NA
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2E7D32", margin: 0 }}>
                  {academyName}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#0D1F0E", margin: 0 }}>
                  Internal CRM
                </p>
              </div>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0D1F0E", margin: "0 0 4px" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "#5A7A5B", margin: 0 }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Form — Suspense boundary for useSearchParams */}
          <Suspense
            fallback={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#2E7D32" }} />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          {/* Footer */}
          <div style={{ padding: "16px 40px", background: "#F8FAF8", borderTop: "1px solid #E8F5E9" }}>
            <p style={{ fontSize: 12, textAlign: "center", color: "#5A7A5B", margin: 0 }}>
              {academyName} · Confidential
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
