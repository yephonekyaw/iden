import { useState } from "react";
import Capture from "./Capture";
import Verify from "./Verify";

type Page = "capture" | "verify";

export default function App() {
  const [page, setPage] = useState<Page>("capture");

  return (
    <div className="app">
      <h1>IDEN Verification</h1>
      <nav className="tabs">
        <button
          className={page === "capture" ? "" : "secondary"}
          onClick={() => setPage("capture")}
        >
          Capture
        </button>
        <button
          className={page === "verify" ? "" : "secondary"}
          onClick={() => setPage("verify")}
        >
          Verify
        </button>
      </nav>
      {page === "capture" ? <Capture /> : <Verify />}
    </div>
  );
}
