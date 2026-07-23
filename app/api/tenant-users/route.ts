import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    if (profile.role !== "manager") {
      return NextResponse.json({ error: "Apenas gerentes podem cadastrar usuários" }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, full_name, id_mktzap } = body as {
      email?: string
      password?: string
      full_name?: string
      id_mktzap?: string
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedPassword = String(password)
    const normalizedName = String(full_name || "").trim()
    const normalizedIdMktzap = String(id_mktzap || "").trim()

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Falha ao criar usuário" }, { status: 400 })
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: normalizedName || null,
        tenant_id: profile.tenant_id,
        role: "user",
        is_super_admin: false,
        id_mktzap: normalizedIdMktzap || null,
      })
      .eq("id", authData.user.id)

    if (profileError) {
      return NextResponse.json(
        { error: `Usuário criado, mas falhou ao configurar perfil: ${profileError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao criar usuário" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const adminClient = getAdminClient()

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    if (profile.role !== "manager") {
      return NextResponse.json({ error: "Apenas gerentes podem excluir usuários da empresa" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    if (!userId) {
      return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 })
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "Não é possível excluir a si mesmo" }, { status: 400 })
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, tenant_id, role")
      .eq("id", userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (targetProfile.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: "Só é possível excluir usuários da sua empresa" }, { status: 403 })
    }

    if (targetProfile.role !== "user") {
      return NextResponse.json(
        { error: "Só é possível excluir usuários com papel 'usuário', não gerentes ou administradores" },
        { status: 403 },
      )
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error("[tenant-users] delete error:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    const { error: profileDeleteError } = await adminClient.from("profiles").delete().eq("id", userId)

    if (profileDeleteError) {
      console.warn("[tenant-users] profile delete (optional):", profileDeleteError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao excluir usuário" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const adminClient = getAdminClient()

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    if (profile.role !== "manager") {
      return NextResponse.json({ error: "Apenas gerentes podem editar usuários da empresa" }, { status: 403 })
    }

    const body = (await request.json()) as {
      id?: string
      full_name?: string
      id_mktzap?: string
    }

    const targetUserId = String(body.id || "").trim()
    const normalizedName = String(body.full_name || "").trim()
    const normalizedIdMktzap = String(body.id_mktzap || "").trim()

    if (!targetUserId) {
      return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 })
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, tenant_id, role")
      .eq("id", targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (targetProfile.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: "Só é possível editar usuários da sua empresa" }, { status: 403 })
    }

    if (targetProfile.role !== "user") {
      return NextResponse.json(
        { error: "Só é possível editar usuários com papel 'usuário'" },
        { status: 403 },
      )
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        full_name: normalizedName || null,
        id_mktzap: normalizedIdMktzap || null,
      })
      .eq("id", targetUserId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao editar usuário" },
      { status: 500 },
    )
  }
}
