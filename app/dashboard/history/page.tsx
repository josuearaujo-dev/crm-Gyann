import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessagesMonitor } from "@/components/dashboard/messages-monitor"
import { MESSAGES_INITIAL_LIMIT } from "@/lib/messages-utils"
import { CheckCircle, Clock, Eye, Send, XCircle } from "lucide-react"

export default async function HistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()

  if (!profile?.tenant_id) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Monitoramento de Mensagens</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o status de todas as mensagens enviadas</p>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Você precisa estar vinculado a uma empresa para ver as mensagens.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { count: totalInDatabase } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_INITIAL_LIMIT)

  const stats = {
    total: messages?.length || 0,
    pending: messages?.filter((m) => m.status === "pending").length || 0,
    sent: messages?.filter((m) => m.status === "sent").length || 0,
    delivered: messages?.filter((m) => m.status === "delivered").length || 0,
    read: messages?.filter((m) => m.status === "read").length || 0,
    failed: messages?.filter((m) => m.status === "failed").length || 0,
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Monitoramento de Mensagens</h1>
        <p className="text-sm text-muted-foreground">Acompanhe o status de todas as mensagens enviadas</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Send className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">Total</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
              <span className="text-xs sm:text-sm text-muted-foreground">Pendente</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Send className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
              <span className="text-xs sm:text-sm text-muted-foreground">Enviado</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
              <span className="text-xs sm:text-sm text-muted-foreground">Entregue</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.delivered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
              <span className="text-xs sm:text-sm text-muted-foreground">Lido</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.read}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
              <span className="text-xs sm:text-sm text-muted-foreground">Falhou</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{stats.failed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg">Mensagens Enviadas</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Clique em uma mensagem para ver o histórico de status
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <MessagesMonitor messages={messages || []} totalInDatabase={totalInDatabase ?? 0} />
        </CardContent>
      </Card>
    </div>
  )
}
