import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: Request) {
  try {
    const adminClient = getAdminClient()

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: "Apenas super admins podem criar usuários" }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, full_name, tenant_id, id_mktzap, role, is_super_admin } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name || "",
      },
    })

    if (authError) {
      console.error("[v0] Error creating user:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Falha ao criar usuário" }, { status: 500 })
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: full_name || null,
        tenant_id: tenant_id || null,
        id_mktzap: id_mktzap || null,
        role: role || "user",
        is_super_admin: is_super_admin || false,
      })
      .eq("id", authData.user.id)

    if (profileError) {
      console.error("[v0] Error updating profile:", profileError)
      // User was created but profile update failed - still return success
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    })
  } catch (error) {
    console.error("[v0] Error in create-user API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno do servidor" },
      { status: 500 },
    )
  }
}
