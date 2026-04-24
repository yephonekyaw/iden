import { useRef, useState, type ChangeEvent } from "react";

import { captureFrame, fileToJpegB64, useCamera } from "./camera";

type Stage = "camera" | "preview" | "submitting" | "result" | "error";

type MatchedIdentity = {
  identity_id: string;
  identity_code: string;
  display_name: string;
  confidence: number;
};

type FaceResult = {
  face_index: number;
  bbox: [number, number, number, number];
  match_found: boolean;
  identity: MatchedIdentity | null;
  confidence: number;
};

type VerifyData = {
  total_faces: number;
  matched: number;
  unmatched: number;
  results: FaceResult[];
};

const API_BASE = (import.meta as any).env?.VITE_API_URL;
const VERIFY_URL = `${API_BASE}/verify`;

export default function Verify() {
  const [stage, setStage] = useState<Stage>("camera");
  const [errorMsg, setErrorMsg] = useState("");
  const [imageB64, setImageB64] = useState("");
  const [result, setResult] = useState<VerifyData | null>(null);

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
        body: JSON.stringify({ image_base64: imageB64 }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrorMsg(body.message || body.detail || `Request failed (${r.status})`);
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
  }

  return (
    <>
      {stage === "camera" && (
        <div className="card">
          <video ref={videoRef} playsInline muted />
          <div className="row">
            <button onClick={capture}>Capture</button>
            <button
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden-file"
            onChange={onFilePicked}
          />
        </div>
      )}

      {stage === "preview" && (
        <div className="card">
          <img src={`data:image/jpeg;base64,${imageB64}`} alt="captured face" />
          <div className="row">
            <button className="secondary" onClick={() => setStage("camera")}>
              Retake
            </button>
            <button onClick={submit}>Verify</button>
          </div>
        </div>
      )}

      {stage === "submitting" && (
        <div className="card">
          <p>Verifying…</p>
        </div>
      )}

      {stage === "result" && result && (
        <div className="card">
          <img src={`data:image/jpeg;base64,${imageB64}`} alt="verified face" />
          <p>
            <strong>{result.total_faces}</strong> face
            {result.total_faces === 1 ? "" : "s"} detected —{" "}
            <strong>{result.matched}</strong> matched,{" "}
            <strong>{result.unmatched}</strong> unmatched
          </p>
          <ul className="results">
            {result.results.map((face) => (
              <li key={face.face_index} className={face.match_found ? "match" : "no-match"}>
                <div>
                  <strong>Face #{face.face_index}</strong> —{" "}
                  {face.match_found ? "match" : "no match"} (confidence{" "}
                  {face.confidence.toFixed(4)})
                </div>
                {face.identity && (
                  <div className="identity">
                    {face.identity.display_name} ({face.identity.identity_code})
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button onClick={restart}>Verify another</button>
        </div>
      )}

      {stage === "error" && (
        <div className="card">
          <p className="error">{errorMsg || "Something went wrong."}</p>
          <button onClick={restart}>Start over</button>
        </div>
      )}
    </>
  );
}
