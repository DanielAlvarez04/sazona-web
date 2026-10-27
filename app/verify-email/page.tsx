import { AuthShell } from "@/components/auth-shell"
import { VerifyEmailStatus } from "@/components/verify-email-status"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const token = first((await searchParams).token)

  return (
    <AuthShell>
      <VerifyEmailStatus token={token} />
    </AuthShell>
  )
}
