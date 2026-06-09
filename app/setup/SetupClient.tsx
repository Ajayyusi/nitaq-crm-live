"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, Database, ArrowRight, Copy, Eye, EyeOff } from "lucide-react";

const ACCOUNTS = [
  { role: "Admin", email: "admin@nitaqacademy.com", password: "NitaqAdmin2026!", color: "#7B1FA2" },
  { role: "Manager", email: "muzzamil@nitaqacademy.com", password: "NitaqManager2026!", color: "#1565C0" },
  { role: "Staff", email: "staff@nitaqacademy.com", password: "NitaqStaff2026!", color: "#2E7D32" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 6px",
        borderRadius: 6,
        fontSize: 11,
        color: copied ? "#2E7D32" : "#94a3b8",
        display: "flex",
        alignItems: "center",
        gap: 3,
        transition: "color 0.15s",
      }}
      title="Copy"
    >
      <Copy style={{ width: 12, height: 12 }} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "checking" | "loading" | "done" | "error" | "already_seeded">("idle");
  const [msg, setMsg] = useState("");
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    checkDB();
  }, []);

  async function checkDB() {
    setDbOk(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.error && data.error.includes("MongoDB Atlas")) {
        setDbOk(false);
      } else if (data.message && data.message.includes("already exist")) {
        setDbOk(true);
        setStatus("already_seeded");
        setMsg(data.message);
      } else if (data.message) {
        setDbOk(true);
        setStatus("done");
        setMsg(data.message);
      } else {
        setDbOk(false);
      }
    } catch {
      setDbOk(false);
    }
  }

  async function seed() {
    setStatus("loading");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg(data.message ?? "Done!");
      setStatus("done");
      setDbOk(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Seed failed.");
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0D1F0E 0%, #1B5E20 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Card */}
        <div style={{ background: "white", borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
          {/* Header */}
          <div style={{ background: "#0D1F0E", padding: "32px 40px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#2E7D32", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16 }}>
                NA
              </div>
              <div>
                <p style={{ color: "#4CAF50", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Nitaq Academy</p>
                <p style={{ color: "white", fontWeight: 700, fontSize: 18, margin: 0 }}>Initial Setup</p>
              </div>
            </div>
            <p style={{ color: "#a3c5a4", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              This page seeds the database with demo data and creates staff accounts. Run it once to get started.
            </p>
          </div>

          <div style={{ padding: "28px 40px 36px" }}>
            {/* DB Status */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 10 }}>
                Database Connection
              </p>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                background: dbOk === null ? "#f8fafc" : dbOk ? "#E8F5E9" : "#FFF3E0",
                border: `1px solid ${dbOk === null ? "#e2e8f0" : dbOk ? "#C8E6C9" : "#FFCC80"}`,
              }}>
                {dbOk === null ? (
                  <Loader2 style={{ width: 18, height: 18, color: "#94a3b8", animation: "spin 1s linear infinite" }} />
                ) : dbOk ? (
                  <CheckCircle2 style={{ width: 18, height: 18, color: "#2E7D32", flexShrink: 0 }} />
                ) : (
                  <XCircle style={{ width: 18, height: 18, color: "#E65100", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  {dbOk === null && <p style={{ fontSize: 13, fontWeight: 600, color: "#64748b", margin: 0 }}>Checking connection…</p>}
                  {dbOk === true && <p style={{ fontSize: 13, fontWeight: 600, color: "#2E7D32", margin: 0 }}>MongoDB Atlas connected</p>}
                  {dbOk === false && (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#E65100", margin: "0 0 4px" }}>Connection failed — IP not whitelisted</p>
                      <p style={{ fontSize: 12, color: "#BF360C", margin: 0, lineHeight: 1.5 }}>
                        Go to <strong>atlas.mongodb.com</strong> → <strong>Network Access</strong> → <strong>Add IP Address</strong> → add your current IP or <code style={{ background: "#fff3e0", padding: "1px 4px", borderRadius: 4 }}>0.0.0.0/0</code>. Then refresh this page.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Seed section */}
            {dbOk !== false && (
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 10 }}>
                  Seed Data
                </p>
                {(status === "idle" || status === "checking") && (
                  <button
                    onClick={seed}
                    disabled={dbOk === null}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "#2E7D32",
                      color: "white",
                      border: "none",
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      opacity: dbOk === null ? 0.5 : 1,
                    }}
                  >
                    <Database style={{ width: 16, height: 16 }} />
                    Load Demo Data
                  </button>
                )}
                {status === "loading" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, background: "#f8fafc", borderRadius: 12, color: "#64748b", fontSize: 13 }}>
                    <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                    Creating accounts and seeding data…
                  </div>
                )}
                {(status === "done" || status === "already_seeded") && (
                  <div style={{ padding: "12px 16px", background: "#E8F5E9", borderRadius: 12, border: "1px solid #C8E6C9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 style={{ width: 16, height: 16, color: "#2E7D32", flexShrink: 0 }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1B5E20", margin: 0 }}>
                        {status === "already_seeded" ? "Already seeded — accounts exist" : "Seed complete!"}
                      </p>
                    </div>
                    {msg && <p style={{ fontSize: 12, color: "#2E7D32", margin: "4px 0 0 24px" }}>{msg}</p>}
                  </div>
                )}
                {status === "error" && (
                  <div style={{ padding: "12px 16px", background: "#FFF3E0", borderRadius: 12, border: "1px solid #FFCC80" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <XCircle style={{ width: 16, height: 16, color: "#E65100", flexShrink: 0 }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#E65100", margin: 0 }}>Seed failed</p>
                    </div>
                    <p style={{ fontSize: 12, color: "#BF360C", margin: "4px 0 0 24px" }}>{msg}</p>
                  </div>
                )}
              </div>
            )}

            {/* Login credentials */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: 0 }}>
                  Login Credentials
                </p>
                <button
                  onClick={() => setShowPw(!showPw)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                >
                  {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  {showPw ? "Hide" : "Show"} passwords
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ACCOUNTS.map((acc) => (
                  <div key={acc.email} style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: acc.color + "18", color: acc.color }}>
                        {acc.role}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{acc.email}</span>
                      <CopyButton text={acc.email} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#64748b", letterSpacing: showPw ? 0 : "0.15em" }}>
                        {showPw ? acc.password : "••••••••••••••"}
                      </span>
                      <CopyButton text={acc.password} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Go to login */}
            <a
              href="/login"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 24,
                padding: "13px",
                background: "#0D1F0E",
                color: "white",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Go to Login
              <ArrowRight style={{ width: 16, height: 16 }} />
            </a>
          </div>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 16 }}>
          Remove or restrict this page before going to production
        </p>
      </div>
    </div>
  );
}
