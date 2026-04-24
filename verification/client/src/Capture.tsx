import { useRef, useState, type ChangeEvent } from "react";

import { captureFrame, fileToJpegB64, useCamera } from "./camera";

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

export default function Capture() {
  const [stage, setStage] = useState<Stage>("form");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errorMsg, setErrorMsg] = useState("");
  const [imageB64, setImageB64] = useState("");

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
      setErrorMsg("Please fill all fields.");
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
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
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
  }

  return (
    <>
      {stage === "form" && (
        <div className="card">
          <label>
            Name
            <input
              value={fields.display_name}
              onChange={(e) => update("display_name", e.target.value)}
            />
          </label>
          <label>
            Student ID
            <input
              value={fields.identity_code}
              onChange={(e) => update("identity_code", e.target.value)}
            />
          </label>
          <label>
            School Email
            <input
              value={fields.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </label>
          <label>
            Department
            <input
              value={fields.department}
              onChange={(e) => update("department", e.target.value)}
            />
          </label>
          {errorMsg && <p className="error">{errorMsg}</p>}
          <button onClick={proceedFromForm}>Next</button>
        </div>
      )}

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
            <button onClick={submit}>Submit</button>
          </div>
        </div>
      )}

      {stage === "submitting" && (
        <div className="card">
          <p>Submitting…</p>
        </div>
      )}

      {stage === "done" && (
        <div className="card">
          <h2>Thank you for your effort</h2>
          <button onClick={restart}>Capture another</button>
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
