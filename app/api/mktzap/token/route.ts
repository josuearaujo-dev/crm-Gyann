import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMktzapToken } from "@/lib/mktzap"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    const tenantId = profile.tenant_id

    // Busca credenciais MKTZAP do tenant
    const { data: credentials, error: credError } = await supabase
      .from("mktzap_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single()

    if (credError || !credentials) {
      return NextResponse.json(
        { error: "Credenciais MKTZAP não configuradas para esta empresa" },
        { status: 404 },
      )
    }

    const token = await getMktzapToken(credentials.company_id, credentials.client_key, tenantId)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[mktzap] Error in token API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao buscar token MKTZAP" },
      { status: 500 },
    )
  }
}
