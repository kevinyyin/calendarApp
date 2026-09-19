import { auth } from "@/lib/auth";
import { setUsername } from "./actions";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        action={async (formData: FormData) => {
          "use server";
          await setUsername(formData);
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="username">Choose a username</label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          pattern="[a-zA-Z0-9_]+"
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
