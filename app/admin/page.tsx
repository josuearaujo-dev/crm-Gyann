import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, MessageSquare, CheckCircle } from "lucide-react"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { count: totalTenants } = await supabase.from("tenants").select("*", { count: "exact", head: true })

  const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true })

  const { count: totalMessages } = await supabase.from("messages").select("*", { count: "exact", head: true })

  const { count: deliveredMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("status", ["delivered", "read"])

  const stats = [
    {
      title: "Empresas",
      value: totalTenants || 0,
      icon: Building2,
      color: "text-primary",
    },
    {
      title: "Usuários",
      value: totalUsers || 0,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Total Mensagens",
      value: totalMessages || 0,
      icon: MessageSquare,
      color: "text-amber-500",
    },
    {
      title: "Entregues/Lidas",
      value: deliveredMessages || 0,
      icon: CheckCircle,
      color: "text-green-500",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-muted-foreground">Visão geral do sistema multi-tenant</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
