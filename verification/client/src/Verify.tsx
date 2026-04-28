import { useRef, useState, type ChangeEvent } from "react";
import { captureFrame, fileToJpegB64, useCamera } from "./camera";
import { JsonViewer } from "./JsonViewer";

type Stage = "camera" | "preview" | "submitting" | "result" | "error";

type MatchedIdentity = {
  identity_id: string;
  identity_code: string;
  display_name: string;
  email: string;
  department: string;
};

type FaceResult = {
  image_index: number;
  face_index: number;
  bbox: [number, number, number, number];
  match_found: boolean;
  identity: MatchedIdentity | null;
  confidence: number;
  det_score: number;
};

type ImageError = {
  image_index: number;
  code: string;
  message: string;
};

type VerifyData = {
  total_images: number;
  total_faces: number;
  matched: number;
  unmatched: number;
  results: FaceResult[];
  image_errors: ImageError[];
};

const API_BASE = (import.meta as any).env?.VITE_API_URL;
const VERIFY_URL = `${API_BASE}/verify`;

export default function Verify() {
  const [stage, setStage] = useState<Stage>("camera");
  const [errorMsg, setErrorMsg] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [result, setResult] = useState<VerifyData | null>(null);
  const [rawResponse, setRawResponse] = useState<null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useCamera(videoRef, stage === "camera", (msg) => {
    setErrorMsg(msg);
    setStage("error");
  });

  function capture() {
    if (!videoRef.current) return;
    setImageB64(captureFrame(videoRef.current));
    setStage("preview");
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

  async function submit() {
    setStage("submitting");
    try {
      const r = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [imageB64] }),
      });
      const body = await r.json().catch(() => ({}));
      setRawResponse(body);
      if (!r.ok) {
        setErrorMsg(
          body.message || body.detail || `Request failed (${r.status})`
        );
        setStage("error");
        return;
      }
      setResult(body.data as VerifyData);
      setStage("result");
    } catch (e) {
      setErrorMsg(`Network error: ${String(e)}`);
      setStage("error");
    }
  }

  function restart() {
    setStage("camera");
    setImageB64("");
    setResult(null);
    setErrorMsg("");
    setRawResponse(null);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {stage === "camera" && (
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Verify Identity
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              Capture or upload a face to match against the database.
            </p>
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
            <p className="text-sm text-stone-500 mt-1">
              Confirm the image before running verification.
            </p>
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
              Verify
            </button>
          </div>
        </div>
      )}

      {stage === "submitting" && (
        <div className="p-12 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-500">Running verification…</p>
        </div>
      )}

      {stage === "result" && result && (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-stone-900">
                {result.total_faces}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">Faces</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {result.matched}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">Matched</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-500">
                {result.unmatched}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">Unmatched</p>
            </div>
          </div>

          <div className="space-y-2">
            {result.results.map((face) => (
              <div
                key={`${face.image_index}-${face.face_index}`}
                className={`rounded-lg p-4 border ${
                  face.match_found
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-900">
                    Face #{face.face_index}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      face.match_found
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {face.match_found ? "Match" : "No Match"}
                  </span>
                </div>
                {face.identity && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-sm font-medium text-stone-900">
                      {face.identity.display_name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-xs font-medium">
                        {face.identity.identity_code}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-medium">
                        {face.identity.email}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
                        {face.identity.department}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex gap-4 text-xs text-stone-400">
                  <span>
                    Confidence:{" "}
                    <span className="text-stone-600">
                      {face.confidence.toFixed(4)}
                    </span>
                  </span>
                  <span>
                    Det:{" "}
                    <span className="text-stone-600">
                      {face.det_score.toFixed(4)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {result.image_errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Image Errors
              </p>
              {result.image_errors.map((err) => (
                <div
                  key={err.image_index}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                >
                  <p className="text-xs text-yellow-700 font-medium">
                    {err.code}
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    {err.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          <JsonViewer data={rawResponse} />

          <button
            onClick={restart}
            className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
          >
            Verify Another
          </button>
        </div>
      )}

      {stage === "error" && (
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-700">Error</p>
            <p className="text-sm text-red-600 mt-1">
              {errorMsg || "Something went wrong."}
            </p>
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
