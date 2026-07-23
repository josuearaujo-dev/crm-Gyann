import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ErrorLogsTable from "@/components/admin/error-logs-table"

export default async function ErrorLogsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile?.is_super_admin) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logs de Erros</h1>
        <p className="text-muted-foreground">Visualize e monitore erros do sistema</p>
      </div>

      <ErrorLogsTable />
    </div>
  )
}
