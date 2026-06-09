"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Database } from "lucide-react";

const ERRORS: Record<string, { msg: string; isDB?: boolean }> = {
  db_error: {
    msg: "Cannot connect to the database. Your IP may not be whitelisted in MongoDB Atlas.",
    isDB: true,
  },
  CredentialsSignin: { msg: "Invalid email or password. Please try again." },
  invalid_credentials: { msg: "Invalid email or password. Please try again." },
  default: { msg: "Something went wrong. Please try again." },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorCode("");
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (result?.error) {
      // NextAuth v5 puts the custom code in the error string
      const code = result.code ?? result.error;
      setErrorCode(code);
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  const err = ERRORS[errorCode] ?? (errorCode ? ERRORS.default : null);

  return (
    <form onSubmit={handleSubmit} className="px-10 py-8 space-y-5">
      {/* Email */}
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "#0D1F0E" }}>
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5A7A5B" }} />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nitaqacademy.com"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none transition-all"
            style={{ border: "1.5px solid #D4E6D4", background: "#F8FAF8", color: "#0D1F0E" }}
            onFocus={(e) => (e.target.style.borderColor = "#2E7D32")}
            onBlur={(e) => (e.target.style.borderColor = "#D4E6D4")}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "#0D1F0E" }}>
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5A7A5B" }} />
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border outline-none transition-all"
            style={{ border: "1.5px solid #D4E6D4", background: "#F8FAF8", color: "#0D1F0E" }}
            onFocus={(e) => (e.target.style.borderColor = "#2E7D32")}
            onBlur={(e) => (e.target.style.borderColor = "#D4E6D4")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity hover:opacity-70"
            style={{ color: "#5A7A5B" }}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          className="rounded-xl p-4 text-sm font-medium space-y-2"
          style={{ background: err.isDB ? "#FFF3E0" : "#FFEBEE", color: err.isDB ? "#E65100" : "#C62828" }}
        >
          <div className="flex items-start gap-2.5">
            {err.isDB ? <Database className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>{err.msg}</span>
          </div>
          {err.isDB && (
            <p className="text-xs ml-6.5" style={{ color: "#BF360C" }}>
              Go to{" "}
              <strong>atlas.mongodb.com</strong>
              {" → "}<strong>Network Access</strong>
              {" → "}<strong>Add IP Address</strong>
              {" → "}Add your current IP or <code>0.0.0.0/0</code> for development.
              Then visit <strong>/setup</strong> to load initial data.
            </p>
          )}
          {!err.isDB && errorCode && (
            <p className="text-xs ml-6.5" style={{ color: "#B71C1C" }}>
              First time? Go to <strong>/setup</strong> to load seed data and get login credentials.
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
        style={{ background: loading ? "#4CAF50" : "#2E7D32" }}
        onMouseEnter={(e) => !loading && ((e.target as HTMLButtonElement).style.background = "#1B5E20")}
        onMouseLeave={(e) => !loading && ((e.target as HTMLButtonElement).style.background = "#2E7D32")}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign In"
        )}
      </button>

      <p className="text-center text-xs" style={{ color: "#5A7A5B" }}>
        First time?{" "}
        <a href="/setup" className="font-bold underline" style={{ color: "#2E7D32" }}>
          Go to setup
        </a>{" "}
        to load demo data.
      </p>
    </form>
  );
}

export default function LoginPage() {
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

      {/* Card */}
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
                  Nitaq Academy
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
              Nitaq Academy CRM · Sharjah, UAE · Confidential
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
