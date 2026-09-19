import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/onboarding" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-6 py-3 text-white"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
