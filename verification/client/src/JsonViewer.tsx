import { useState } from "react";

export function JsonViewer({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-stone-200 pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors w-full text-left select-none"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 shrink-0 ${open ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 6l8 4-8 4V6z" />
        </svg>
        Raw Response
      </button>
      {open && (
        <pre className="mt-3 bg-stone-50 border border-stone-200 p-4 text-xs font-mono text-stone-700 overflow-x-auto max-h-72 overflow-y-auto leading-relaxed whitespace-pre">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
