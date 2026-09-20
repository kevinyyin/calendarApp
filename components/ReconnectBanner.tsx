import { signIn } from "@/lib/auth";

export function ReconnectBanner() {
  return (
    <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <span>Your Google Calendar connection has expired.</span>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="font-medium underline">
          Reconnect
        </button>
      </form>
    </div>
  );
}
