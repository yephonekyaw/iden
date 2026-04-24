# CaptureMock Client

React + Vite + TypeScript. Form (Name, Student ID, School Email, Department) →
webcam capture → submit to local backend, which relays to `iden-api /Capture`.
Shows "Thank you for your effort" on success.

## Run

```bash
npm install
npm run dev
# opens on http://localhost:5173
# backend base URL configurable via VITE_API_URL (default http://localhost:8000)
# routes: POST /api/v1/capture and POST /api/v1/verify
```

getUserMedia requires `localhost` or HTTPS; a plain LAN IP over HTTP will be
blocked by the browser.
