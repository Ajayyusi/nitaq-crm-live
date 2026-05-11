"use client";

import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { Save, Shield, BookOpen, DollarSign, Globe } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    academyName: "Nitaq Academy",
    currency: "AED",
    timezone: "Asia/Dubai",
    defaultSessionDuration: "60",
    contactEmail: "",
    contactPhone: "",
    address: "",
    vatNumber: "",
    enableNotifications: true,
    requireApproval: false,
  });

  async function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="System configuration and preferences"
        actions={
          <button onClick={save} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Settings"}
          </button>
        }
      />

      <div className="p-6 max-w-2xl space-y-5">
        {/* Academy Info */}
        <Section icon={Globe} title="Academy Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Academy Name"><input value={form.academyName} onChange={(e) => setForm((f) => ({ ...f, academyName: e.target.value }))} className={cls} /></F>
            <F label="Contact Email"><input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="admin@nitaq.com" className={cls} /></F>
            <F label="Contact Phone"><input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="+971..." className={cls} /></F>
            <F label="VAT Number"><input value={form.vatNumber} onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))} placeholder="100XXXXXXXXX" className={cls} /></F>
          </div>
          <F label="Address">
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} placeholder="Full address..." className={cls} />
          </F>
        </Section>

        {/* Finance */}
        <Section icon={DollarSign} title="Finance & Currency">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Default Currency">
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={cls}>
                <option value="AED">AED — UAE Dirham</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="SAR">SAR — Saudi Riyal</option>
              </select>
            </F>
            <F label="Timezone">
              <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} className={cls}>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
              </select>
            </F>
          </div>
        </Section>

        {/* Academic */}
        <Section icon={BookOpen} title="Academic Defaults">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Default Session Duration (min)">
              <select value={form.defaultSessionDuration} onChange={(e) => setForm((f) => ({ ...f, defaultSessionDuration: e.target.value }))} className={cls}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </F>
          </div>
        </Section>

        {/* System */}
        <Section icon={Shield} title="System Preferences">
          <div className="space-y-3">
            <Toggle
              label="Enable Notifications"
              description="Receive in-app notifications for important events"
              checked={form.enableNotifications}
              onChange={(v) => setForm((f) => ({ ...f, enableNotifications: v }))}
            />
            <Toggle
              label="Require Allocation Approval"
              description="Allocations must be approved before becoming active"
              checked={form.requireApproval}
              onChange={(v) => setForm((f) => ({ ...f, requireApproval: v }))}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-blue-600" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
