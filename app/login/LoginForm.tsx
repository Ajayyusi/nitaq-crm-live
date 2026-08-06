"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Database } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ERRORS: Record<string, { msg: string; isDB?: boolean }> = {
  db_error: {
    msg: "Service temporarily unavailable. Please try again in a moment — if it persists, contact your administrator.",
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
    <form onSubmit={handleSubmit} className="space-y-4 px-8 py-6">
      <Field label="Email address" htmlFor="login-email">
        <div className="relative">
          <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nitaqacademy.com"
            className="ps-9"
          />
        </div>
      </Field>

      <Field label="Password" htmlFor="login-password">
        <div className="relative">
          <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="ps-9 pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint transition hover:text-dim"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {otpStep && (
        <Field
          label="Authenticator code"
          htmlFor="login-otp"
          help="Open your authenticator app (Google Authenticator, Authy…) and enter the 6-digit code."
        >
          <Input
            id="login-otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            className="readout text-center text-lg font-bold tracking-[0.5em]"
          />
        </Field>
      )}

      {err && (
        <div
          role="alert"
          className={`flex items-start gap-2.5 rounded-ctl border px-3.5 py-3 text-sm font-semibold ${
            err.isDB
              ? "border-caution/30 bg-[var(--lamp-caution-bg)] text-caution"
              : "border-alert/30 bg-[var(--lamp-alert-bg)] text-alert"
          }`}
        >
          {err.isDB
            ? <Database className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />}
          <span>{err.msg}</span>
        </div>
      )}

      <Button type="submit" variant="solid" size="lg" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : otpStep ? (
          "Verify code"
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
