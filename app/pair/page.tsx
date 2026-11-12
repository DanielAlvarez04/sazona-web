import { PairDeviceForm } from "@/components/pos/pair-device-form"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Ruta pública que abre el QR para vincular una caja. */
export default async function PairPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const raw = params.code
  const code = typeof raw === "string" ? raw : ""

  return <PairDeviceForm code={code} />
}
