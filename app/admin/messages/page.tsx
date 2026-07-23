import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminMessagesTable } from "@/components/admin/messages-table"

export default async function AdminMessagesPage() {
  const supabase = await createClient()

  const { data: messages } = await supabase
    .from("messages")
    .select("*, tenant:tenants(name)")
    .order("created_at", { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground">Visão geral de todas as mensagens do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Mensagens</CardTitle>
          <CardDescription>Últimas 200 mensagens de todos os tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminMessagesTable messages={messages || []} />
        </CardContent>
      </Card>
    </div>
  )
}
