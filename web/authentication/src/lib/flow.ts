"use client";

export type AuthMethod = "pwd" | "otp" | "face";

export type FlowState = {
  challenge: string;
  client_id: string;
  email?: string;
  amr: AuthMethod[];
  needs_step_up: boolean;
  consented?: boolean;
};

const KEY = "iden.flow";

export function readFlow(): FlowState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as FlowState) : null;
}

export function writeFlow(next: FlowState) {
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function updateFlow(patch: Partial<FlowState>): FlowState {
  const current = readFlow();
  const next = { ...(current ?? blank()), ...patch } as FlowState;
  writeFlow(next);
  return next;
}

export function clearFlow() {
  window.sessionStorage.removeItem(KEY);
}

export function addAmr(method: AuthMethod): FlowState {
  const current = readFlow() ?? blank();
  const set = new Set(current.amr);
  set.add(method);
  return updateFlow({ amr: Array.from(set) });
}

export function acrFromAmr(amr: AuthMethod[]): "iden:loa:1" | "iden:loa:2" | "iden:loa:3" {
  const hasFace = amr.includes("face");
  const count = amr.length;
  if (hasFace && count >= 2) return "iden:loa:3";
  if (count >= 2) return "iden:loa:2";
  return "iden:loa:1";
}

export function meetsRequired(
  amr: AuthMethod[],
  required: "iden:loa:1" | "iden:loa:2" | "iden:loa:3"
): boolean {
  const order = { "iden:loa:1": 1, "iden:loa:2": 2, "iden:loa:3": 3 } as const;
  return order[acrFromAmr(amr)] >= order[required];
}

function blank(): FlowState {
  return {
    challenge: cryptoChallenge(),
    client_id: "attende-prod",
    amr: [],
    needs_step_up: false,
  };
}

function cryptoChallenge(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
