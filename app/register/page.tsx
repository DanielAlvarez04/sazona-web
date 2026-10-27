import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth-shell"
import { RegisterForm } from "@/components/register-form"
import { getCurrentUser } from "@/lib/session"

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect(user.onboarded ? "/dashboard" : "/onboarding")
  }

  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  )
}
