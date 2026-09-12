/**
 * The building.
 *
 * Three doors, each harder to open than the last, and every requirement is
 * declarative: this file is the policy. The server reads it and does what it
 * says, which is the only way a reader can check the two against each other.
 *
 * One scope per door rather than one scope for "doors" is the modelling
 * decision worth noticing. IDEN has no resource-instance permissions — there is
 * no way to say "may open door 7 but not door 12" — so a door that needs its
 * own answer needs its own scope. That is fine for a building and wrong for a
 * system with ten thousand documents; the line is roughly whether a human could
 * name them all.
 */

export interface Door {
  id: string;
  name: string;
  blurb: string;
  /** The permission the access token has to carry. */
  scope: string;
  /**
   * Minimum assurance level, when the door wants more than "signed in".
   *
   * IDEN derives `acr` from the factors actually used, so `iden:loa:2` means
   * two of them. A door asking for this is asking a different question from the
   * scope check: not *may you*, but *how sure are we it is you*.
   */
  acr?: string;
  /** Seconds. How recently they must have authenticated. RFC 9470. */
  maxAge?: number;
}

export const DOORS: Door[] = [
  {
    id: "front",
    name: "Front door",
    blurb: "The lobby. Everybody who works here gets through this one.",
    scope: "door:front:open",
  },
  {
    id: "lab",
    name: "Lab",
    blurb: "Benches, instruments, and something expensive that is mid-run.",
    scope: "door:lab:open",
  },
  {
    id: "server",
    name: "Server room",
    blurb: "Where the building's own doors are controlled from. Aptly.",
    scope: "door:server:open",
    acr: "iden:loa:2",
    maxAge: 300,
  },
];

export const doorById = (id: string): Door | undefined =>
  DOORS.find((door) => door.id === id);

/** Every scope this API defines, which is also what `setup.ts` registers. */
export const ALL_SCOPES = DOORS.map((door) => door.scope);
