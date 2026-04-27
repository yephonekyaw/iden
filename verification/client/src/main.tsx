import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// @ts-ignore TS2882: side-effect stylesheet import is resolved by the bundler
import "./main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
