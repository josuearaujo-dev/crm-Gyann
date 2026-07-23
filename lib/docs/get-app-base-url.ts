import { headers } from "next/headers"

export async function getAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }

  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host")

  if (!host) {
    return "https://seu-dominio.com"
  }

  const protocol = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}
