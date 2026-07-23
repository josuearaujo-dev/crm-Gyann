import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TenantsTable } from "@/components/admin/tenants-table"

export default async function AdminTenantsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase.from("tenants").select("*").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Empresas</h1>
        <p className="text-muted-foreground">Gerencie as empresas (tenants) do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Empresas</CardTitle>
          <CardDescription>Lista de empresas cadastradas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <TenantsTable tenants={tenants || []} />
        </CardContent>
      </Card>
    </div>
  )
}
