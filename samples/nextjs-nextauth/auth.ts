import NextAuth from "next-auth";

/**
 * The entire integration.
 *
 * This is stock Auth.js with its generic OIDC provider. There is no IDEN
 * adapter, no custom fetch, no patched endpoint — the `issuer` is discovered,
 * and everything else follows from the metadata IDEN publishes at
 * `/.well-known/openid-configuration`.
 *
 * That is the claim this sample exists to make. "Standards-compliant" is easy
 * to say; a library that has never heard of IDEN working against it without a
 * line of glue is the proof.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "iden",
      name: "IDEN",
      type: "oidc",
      issuer: process.env.IDEN_ISSUER,
      clientId: process.env.IDEN_CLIENT_ID,
      clientSecret: process.env.IDEN_CLIENT_SECRET,
      // `offline_access` is what asks for a refresh token (OIDC Core §11).
      // Drop it and sign-in still works; the session simply ends when the
      // access token expires.
      authorization: { params: { scope: "openid profile email offline_access" } },
      // Auth.js requires PKCE, a nonce and state be checked. So does IDEN, of
      // every client — which is why neither end needs configuring for it.
      checks: ["pkce", "state", "nonce"],
    },
  ],
  callbacks: {
    // Auth.js keeps nothing from the provider by default. These two carry the
    // claims through to the page so the sample has something to show.
    jwt({ token, profile, account }) {
      if (profile) {
        token.acr = profile.acr;
        token.amr = profile.amr;
        token.sid = profile.sid;
      }
      if (account?.expires_at) token.expiresAt = account.expires_at;
      return token;
    },
    session({ session, token }) {
      return Object.assign(session, {
        acr: token.acr,
        amr: token.amr,
        sid: token.sid,
        expiresAt: token.expiresAt,
      });
    },
  },
});
