import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminTemplatesManager } from "@/components/admin/templates-manager"

export default async function AdminTemplatesPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">Gerencie os templates de mensagem por empresa</p>
      </div>

      <AdminTemplatesManager tenants={tenants || []} />
    </div>
  )
}
