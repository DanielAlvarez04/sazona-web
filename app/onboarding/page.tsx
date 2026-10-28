import { redirect } from "next/navigation"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { isAdmin, requireUser } from "@/lib/session"

export default async function OnboardingPage() {
  const user = await requireUser()

  if (user.onboarded || !isAdmin(user)) {
    redirect("/dashboard")
  }

  return (
    <OnboardingFlow
      initialBusinessName={user.organizationName ?? ""}
      initialDomain={user.organizationDomain ?? ""}
      initialName={user.name ?? ""}
      initialUsername={user.username ?? ""}
      currentUsername={user.username}
    />
  )
}