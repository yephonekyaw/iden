import { useState } from "react";
import Capture from "./Capture";
import Verify from "./Verify";

type Page = "capture" | "verify";

export default function App() {
  const [page, setPage] = useState<Page>("capture");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <span className="font-bold text-lg tracking-wide text-stone-900">IDEN</span>
          <span className="text-stone-300">·</span>
          <span className="text-amber-600 text-sm font-medium">Verification</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="bg-stone-100 p-1 rounded-lg flex gap-1">
          {(["capture", "verify"] as Page[]).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-150 capitalize cursor-pointer ${
                page === p
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {page === "capture" ? <Capture /> : <Verify />}
      </main>
    </div>
  );
}
