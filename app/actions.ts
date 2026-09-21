"use server";

import { signOut } from "@/lib/auth";

// A standalone module-level server action, not an inline `"use server"`
// closure inside NavBar's JSX: NavBar is a Client Component (it needs
// usePathname for the active-link state), and an inline server action
// defined directly inside a Client Component's render is not the
// well-supported pattern — only a top-of-file "use server" module,
// imported like any other function, is.
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
