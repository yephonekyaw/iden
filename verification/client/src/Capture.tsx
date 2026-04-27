import { useRef, useState, type ChangeEvent } from "react";
import { captureFrame, fileToJpegB64, useCamera } from "./camera";
import { JsonViewer } from "./JsonViewer";

type Stage = "form" | "camera" | "preview" | "submitting" | "done" | "error";

type Fields = {
  display_name: string;
  identity_code: string;
  email: string;
  department: string;
};

const API_BASE = (import.meta as any).env?.VITE_API_URL;
const CAPTURE_URL = `${API_BASE}/capture`;

const EMPTY_FIELDS: Fields = {
  display_name: "",
  identity_code: "",
  email: "",
  department: "",
};

const FIELD_META: {
  key: keyof Fields;
  label: string;
  type: string;
  placeholder: string;
}[] = [
  { key: "display_name", label: "Full Name", type: "text", placeholder: "e.g. Jane Smith" },
  { key: "identity_code", label: "Student ID", type: "text", placeholder: "e.g. STU-00123" },
  { key: "email", label: "School Email", type: "email", placeholder: "e.g. jane@university.edu" },
  { key: "department", label: "Department", type: "text", placeholder: "e.g. Computer Science" },
];

export default function Capture() {
  const [stage, setStage] = useState<Stage>("form");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errorMsg, setErrorMsg] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useCamera(videoRef, stage === "camera", (msg) => {
    setErrorMsg(msg);
    setStage("error");
  });

  function update<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const b64 = await fileToJpegB64(file);
      setImageB64(b64);
      setStage("preview");
    } catch (err) {
      setErrorMsg(String(err instanceof Error ? err.message : err));
      setStage("error");
    }
  }

  function proceedFromForm() {
    if (!fields.display_name || !fields.identity_code || !fields.email || !fields.department) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    setErrorMsg("");
    setStage("camera");
  }

  function capture() {
    if (!videoRef.current) return;
    setImageB64(captureFrame(videoRef.current));
    setStage("preview");
  }

  async function submit() {
    setStage("submitting");
    try {
      const r = await fetch(CAPTURE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, image_base64: imageB64 }),
      });
      const body = await r.json().catch(() => ({}));
      setRawResponse(body);
      if (!r.ok) {
        setErrorMsg(body.message || body.detail || `Request failed (${r.status})`);
        setStage("error");
        return;
      }
      setStage("done");
    } catch (e) {
      setErrorMsg(`Network error: ${String(e)}`);
      setStage("error");
    }
  }

  function restart() {
    setStage("form");
    setFields(EMPTY_FIELDS);
    setImageB64("");
    setErrorMsg("");
    setRawResponse(null);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {stage === "form" && (
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Enroll Identity</h2>
            <p className="text-sm text-stone-500 mt-1">Register a new identity in the system.</p>
          </div>

          <div className="space-y-3">
            {FIELD_META.map(({ key, label, type, placeholder }) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  {label}
                </span>
                <input
                  type={type}
                  value={fields[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  className="mt-1.5 w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-stone-400 transition-shadow"
                />
              </label>
            ))}
          </div>

          {errorMsg && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            onClick={proceedFromForm}
            className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer"
          >
            Continue →
          </button>
        </div>
      )}

      {stage === "camera" && (
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Capture Face</h2>
            <p className="text-sm text-stone-500 mt-1">Position your face in the frame.</p>
          </div>
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-lg bg-stone-100 aspect-video object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={capture}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
            >
              Capture
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
            >
              Upload Photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
        </div>
      )}

      {stage === "preview" && (
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Preview</h2>
            <p className="text-sm text-stone-500 mt-1">Review your photo before submitting.</p>
          </div>
          <img
            src={`data:image/jpeg;base64,${imageB64}`}
            alt="captured face"
            className="w-full rounded-lg object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStage("camera")}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
            >
              Retake
            </button>
            <button
              onClick={submit}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {stage === "submitting" && (
        <div className="p-12 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-500">Submitting identity…</p>
        </div>
      )}

      {stage === "done" && (
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-stone-900">Identity Enrolled</h2>
              <p className="text-sm text-stone-500 mt-1">
                {fields.display_name} has been registered successfully.
              </p>
            </div>
          </div>

          {rawResponse && <JsonViewer data={rawResponse} />}

          <button
            onClick={restart}
            className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
          >
            Enroll Another
          </button>
        </div>
      )}

      {stage === "error" && (
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-700">Error</p>
            <p className="text-sm text-red-600 mt-1">{errorMsg || "Something went wrong."}</p>
          </div>
          {rawResponse && <JsonViewer data={rawResponse} />}
          <button
            onClick={restart}
            className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
