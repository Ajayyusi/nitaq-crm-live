"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Database } from "lucide-react";

const ERRORS: Record<string, { msg: string; isDB?: boolean }> = {
  db_error: {
    msg: "Service temporarily unavailable. Please try again in a moment.",
    isDB: true,
  },
  CredentialsSignin:    { msg: "Invalid email or password. Please try again." },
  invalid_credentials:  { msg: "Invalid email or password. Please try again." },
  too_many_attempts:    { msg: "Too many login attempts. Please wait 15 minutes and try again." },
  otp_invalid:          { msg: "Wrong authenticator code. Check your app and try again." },
  default:              { msg: "Something went wrong. Please try again." },
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Accept only same-origin paths. If NextAuth ever embeds an absolute
  // callbackUrl pointing to the old root domain, this strips it.
  const rawCallback = searchParams.get("callbackUrl") ?? "";
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
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
      ...(otp ? { otp: otp.trim() } : {}),
      redirect: false,
    });
    if (result?.error) {
      const code = result.code ?? result.error;
      if (code === "otp_required") {
        // Password was correct — reveal the authenticator-code step
        setOtpStep(true);
        setErrorCode("");
      } else {
        setErrorCode(code);
        if (code !== "otp_invalid") { setOtpStep(false); setOtp(""); }
      }
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  const err = ERRORS[errorCode] ?? (errorCode ? ERRORS.default : null);

  return (
    <form onSubmit={handleSubmit} className="px-10 py-8 space-y-5">
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

      {otpStep && (
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "#0D1F0E" }}>
            Authenticator Code
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            className="w-full px-4 py-3 text-center text-lg font-bold tracking-[0.5em] rounded-xl border outline-none transition-all"
            style={{ border: "1.5px solid #D4E6D4", background: "#F8FAF8", color: "#0D1F0E" }}
            onFocus={(e) => (e.target.style.borderColor = "#2E7D32")}
            onBlur={(e) => (e.target.style.borderColor = "#D4E6D4")}
          />
          <p className="mt-1.5 text-xs" style={{ color: "#5A7A5B" }}>
            Open your authenticator app (Google Authenticator, Authy…) and enter the 6-digit code.
          </p>
        </div>
      )}

      {err && (
        <div
          className="rounded-xl p-4 text-sm font-medium space-y-2"
          style={{ background: err.isDB ? "#FFF3E0" : "#FFEBEE", color: err.isDB ? "#E65100" : "#C62828" }}
        >
          <div className="flex items-start gap-2.5">
            {err.isDB
              ? <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>{err.msg}</span>
          </div>
          {err.isDB && (
            <p className="text-xs ml-6" style={{ color: "#BF360C" }}>
              Go to <strong>atlas.mongodb.com</strong> → <strong>Network Access</strong> → Add your IP or <code>0.0.0.0/0</code>.
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
        style={{ background: loading ? "#4CAF50" : "#2E7D32" }}
        onMouseEnter={(e) => !loading && ((e.target as HTMLButtonElement).style.background = "#1B5E20")}
        onMouseLeave={(e) => !loading && ((e.target as HTMLButtonElement).style.background = "#2E7D32")}
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : otpStep ? "Verify Code" : "Sign In"}
      </button>
    </form>
  );
}
