import type { Session } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";

/**
 * Auth.js's default `session` callback (see
 * @auth/core/lib/init.js#defaultCallbacks.session) only copies `name`,
 * `email`, and `image` onto `session.user` — it drops `id`. Server actions
 * and pages in this app (e.g. app/onboarding/actions.ts) need
 * `session.user.id` to look up/update the current user's row, so this
 * callback adds it back from the `user` record the database session
 * strategy passes in.
 *
 * Kept in its own module (rather than inlined in lib/auth.ts) so it can be
 * unit-tested as a pure function without loading next-auth's runtime or a
 * real database adapter.
 */
export async function sessionCallback({
  session,
  user,
}: {
  session: Session;
  user: AdapterUser;
}): Promise<Session> {
  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
    },
  };
}
