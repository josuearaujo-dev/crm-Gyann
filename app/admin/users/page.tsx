import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersTable } from "@/components/admin/users-table"

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, tenant:tenants(id, name)")
    .order("created_at", { ascending: false })

  const { data: tenants } = await supabase.from("tenants").select("id, name").eq("is_active", true).order("name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Gerencie os usuários e suas permissões</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários</CardTitle>
          <CardDescription>Lista de usuários cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable profiles={profiles || []} tenants={tenants || []} />
        </CardContent>
      </Card>
    </div>
  )
}
