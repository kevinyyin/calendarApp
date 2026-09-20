import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex max-w-xs flex-col items-center gap-1 text-center">
        <h1 className="text-xl font-semibold text-foreground">Welcome</h1>
        <p className="text-sm text-muted">
          One last step — pick a username so friends can send you requests.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}
