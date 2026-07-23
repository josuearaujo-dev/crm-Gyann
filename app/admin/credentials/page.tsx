import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminCredentialsManager } from "@/components/admin/credentials-manager"
import { isCoexistenceFeatureEnabled } from "@/lib/whatsapp-credentials"

export default async function AdminCredentialsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

  if (!profile?.is_super_admin) {
    redirect("/dashboard")
  }

  // Get all tenants
  const { data: tenants } = await supabase.from("tenants").select("*").order("name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credenciais</h1>
        <p className="text-muted-foreground">Gerencie as credenciais de API, WhatsApp e MKTZAP por empresa</p>
      </div>

      <AdminCredentialsManager
        tenants={tenants || []}
        coexistenceFeatureEnabled={isCoexistenceFeatureEnabled()}
      />
    </div>
  )
}
