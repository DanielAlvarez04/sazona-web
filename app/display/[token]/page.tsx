import { CustomerDisplay } from "@/components/pos/customer-display"

/** Pantalla pública frente al cliente (monitor o tablet). */
export default async function DisplayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return <CustomerDisplay token={token} />
}
