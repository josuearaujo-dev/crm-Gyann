import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateApiSecret,
  generateClientId,
  getSecretPrefix,
  hashApiSecret,
} from "@/lib/client-api-auth"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role, is_super_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
  }

  if (!profile.is_super_admin && profile.role !== "admin" && profile.role !== "manager") {
    return NextResponse.json({ error: "Sem permissão para gerenciar credenciais da API" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("client_api_credentials")
    .select("id, tenant_id, name, client_id, secret_prefix, is_active, last_used_at, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ credentials: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role, is_super_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
  }

  if (!profile.is_super_admin && profile.role !== "admin" && profile.role !== "manager") {
    return NextResponse.json({ error: "Sem permissão para gerenciar credenciais da API" }, { status: 403 })
  }

  const body = await request.json()
  const name = typeof body.name === "string" ? body.name.trim() : ""

  if (!name) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
  }

  const clientId = generateClientId()
  const apiSecret = generateApiSecret()

  const { data, error } = await supabase
    .from("client_api_credentials")
    .insert({
      tenant_id: profile.tenant_id,
      name,
      client_id: clientId,
      secret_hash: hashApiSecret(apiSecret),
      secret_prefix: getSecretPrefix(apiSecret),
      is_active: true,
    })
    .select("id, tenant_id, name, client_id, secret_prefix, is_active, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    credential: data,
    clientId,
    apiSecret,
    message: "Guarde o apiSecret com segurança. Ele não será exibido novamente.",
  })
}
