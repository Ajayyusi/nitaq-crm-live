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

/*
 * The hero mark: a plate extruded from the ground, holding a recessed dial.
 * It is the design system's whole thesis in one object — raised, inset, and
 * a single stroke of accent — so the sign-in screen teaches the language
 * before anyone reaches a dashboard.
 */
function HeroMark() {
  return (
    <div className="grid h-56 w-56 place-items-center rounded-full bg-face shadow-neo">
      <div className="grid h-40 w-40 place-items-center rounded-full bg-well shadow-neo-inset">
        <svg viewBox="0 0 120 120" className="h-32 w-32" aria-hidden>
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--edge-strong)"
            strokeWidth="3"
            opacity="0.5"
          />
          {/* One stroke of accent — 72% of the ring, opening at the top */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="217 302"
            transform="rotate(-125 60 60)"
          />
          <text
            x="60"
            y="58"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="21"
            fontWeight="800"
            letterSpacing="-0.5"
            fontFamily="inherit"
          >
            Nitaq
          </text>
          <text
            x="60"
            y="76"
            textAnchor="middle"
            fill="var(--faint)"
            fontSize="8"
            fontWeight="700"
            letterSpacing="3"
            fontFamily="inherit"
          >
            ACADEMY
          </text>
        </svg>
      </div>
    </div>
  );
}

export default async function LoginPage() {
  const academyName = await fetchAcademyName();

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel p-4 text-ink sm:p-8">
      <div className="grid w-full max-w-4xl items-center gap-12 lg:grid-cols-[1fr_420px]">
        {/* Statement panel */}
        <div className="hidden flex-col items-start gap-8 lg:flex">
          <HeroMark />
          <div>
            <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">
              Everything the
              <br />
              academy runs on.
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-7 text-dim">
              Admissions, classes, money and compliance on one surface —
              reconciled and ready before you ask.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="placard">{academyName}</span>
            <span className="h-px w-8 bg-edge-strong" aria-hidden />
            <span className="placard">Sharjah</span>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="overflow-hidden rounded-neo bg-face shadow-neo">
          <div className="border-b border-edge px-8 pb-6 pt-8">
            <p className="placard">{academyName}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-ink">Sign in</h2>
            <p className="mt-1.5 text-sm text-dim">Authorized staff only</p>
          </div>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
          <div className="border-t border-edge bg-well px-8 py-4">
            <p className="placard text-center">{academyName} · Confidential</p>
          </div>
        </div>
      </div>
    </div>
  );
}
