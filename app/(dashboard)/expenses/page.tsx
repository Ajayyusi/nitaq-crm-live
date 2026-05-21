export default function ExpensesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Nitaq Academy</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Expenses</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Capture operating costs, payment methods, suppliers, and expense categories.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Expenses Workspace</h2>
        <p className="mt-1 text-sm text-slate-500">This module is ready for the next implementation phase.</p>
        <div className="mt-5 grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div>
            <p className="text-sm font-medium text-slate-900">Placeholder module</p>
            <p className="mt-2 max-w-md text-sm text-slate-500">Static Phase 1 foundation only. Data models, authentication, and workflows will be added later.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
