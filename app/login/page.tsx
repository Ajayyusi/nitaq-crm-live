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

/* A calm cockpit gauge, needle at rest — the login page's one instrument. */
function HeroGauge() {
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 24; i++) {
    const major = i % 2 === 0;
    ticks.push(
      <line
        key={i}
        x1="90"
        y1={major ? "14" : "17"}
        x2="90"
        y2="24"
        stroke={major ? "var(--dim)" : "var(--bezel-strong)"}
        strokeWidth={major ? 1.5 : 1}
        transform={`rotate(${i * 15} 90 90)`}
      />
    );
  }
  return (
    <svg viewBox="0 0 180 180" className="h-56 w-56" aria-hidden>
      <circle cx="90" cy="90" r="86" fill="var(--face)" stroke="var(--bezel-strong)" strokeWidth="2" />
      <circle cx="90" cy="90" r="78" fill="none" stroke="var(--bezel)" strokeWidth="1" />
      {ticks}
      <text x="90" y="64" textAnchor="middle" fill="var(--dim)" fontSize="9" letterSpacing="3" fontFamily="inherit">
        OPERATIONS
      </text>
      <line x1="90" y1="90" x2="138" y2="52" stroke="var(--phos)" strokeWidth="3" strokeLinecap="round" />
      <line x1="90" y1="90" x2="70" y2="106" stroke="var(--phos)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="90" cy="90" r="5" fill="var(--phos)" />
      <text x="90" y="128" textAnchor="middle" fill="var(--ink)" fontSize="13" fontWeight="bold" letterSpacing="1" fontFamily="inherit">
        NITAQ
      </text>
    </svg>
  );
}

export default async function LoginPage() {
  const academyName = await fetchAcademyName();

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-panel p-4 text-ink">
      <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Statement panel */}
        <div className="hidden flex-col items-start gap-6 lg:flex">
          <HeroGauge />
          <div>
            <h1 className="text-3xl font-bold uppercase leading-tight tracking-[0.06em] text-ink">
              Trust your
              <br />
              instruments
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-dim">
              Admissions, classes, money, and compliance on one panel —
              cross-checked, reconciled, and ready before you ask.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="placard">{academyName}</span>
            <span className="h-px w-8 bg-bezel-strong" aria-hidden />
            <span className="placard">Sharjah</span>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="face overflow-hidden">
          <div className="border-b border-bezel px-8 pb-6 pt-8">
            <p className="placard">{academyName}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-dim">Operations panel · authorized staff only</p>
          </div>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-phos" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
          <div className="border-t border-bezel bg-well px-8 py-3.5">
            <p className="placard text-center">{academyName} · Confidential</p>
          </div>
        </div>
      </div>
    </div>
  );
}
