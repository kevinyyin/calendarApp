import jwt from "jsonwebtoken";

// NOTE ON SCOPE: this token is minted with `role: "authenticated"` and sent to
// the browser (via session.supabaseAccessToken) so the client can subscribe to
// Supabase Realtime as the signed-in user. That is safe *today* only because
// every `public` schema table either has no RLS policies granting `authenticated`
// broad access, or (like `events`) has a narrowly-scoped policy built on a
// security-definer helper. Anyone adding a new `to authenticated` RLS policy
// elsewhere in this schema should keep in mind that this token reaches the
// browser and must not be trusted with more than the intended row-level access.
export function createSupabaseRealtimeToken(userId: string): string | undefined {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Don't throw: this is called from lib/auth.ts's session callback on every
    // session resolution, which proxy.ts wraps around every non-static
    // route. Throwing here would 500 the entire app if this env var is ever
    // missing in a deploy, just to lose the (non-essential) realtime feature.
    // Callers must treat `undefined` as "no realtime token available" —
    // RealtimeMergedView/createBrowserSupabaseClient already fall back to an
    // unauthenticated client in that case.
    return undefined;
  }
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
    },
    secret,
    { expiresIn: "1h" },
  );
}
