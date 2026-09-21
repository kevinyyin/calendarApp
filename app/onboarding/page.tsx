import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="animate-rise-in flex w-full max-w-xs flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome</h1>
          <p className="text-base leading-relaxed text-muted">
            One last step — pick a username so friends can send you requests.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
