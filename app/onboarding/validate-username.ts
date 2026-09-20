// Kept in its own module (no "use server") because it's a plain synchronous
// function — app/onboarding/actions.ts needs a file-level "use server"
// directive so setUsername can be imported into the client-side
// OnboardingForm via useActionState, and every export from a "use server"
// file must be an async Server Function, which a validator like this isn't.
export function validateUsername(
  username: string,
): { ok: true } | { ok: false; error: string } {
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }
  return { ok: true };
}
