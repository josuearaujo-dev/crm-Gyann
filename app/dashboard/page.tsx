import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  Megaphone,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react"

type Status = "pending" | "sent" | "delivered" | "read" | "failed"
type Period = "month" | "3m" | "6m"

const periodOptions: Array<{ value: Period; label: string; description: string }> = [
  { value: "month", label: "Mês atual", description: "Desde o primeiro dia do mês" },
  { value: "3m", label: "Últimos 3 meses", description: "Dados dos últimos 90 dias aprox." },
  { value: "6m", label: "Últimos 6 meses", description: "Dados dos últimos 180 dias aprox." },
]

const statusLabels: Record<Status, string> = {
  pending: "Pendente",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
}

const statusStyles: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  read: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function formatDate(value: string | null) {
  if (!value) return "Sem data"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getPeriodStart(period: Period) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if (period === "month") {
    date.setDate(1)
    return date
  }

  date.setMonth(date.getMonth() - (period === "3m" ? 3 : 6))
  return date
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string | string[] }>
}) {
  const resolvedSearchParams = await searchParams
  const requestedPeriod = Array.isArray(resolvedSearchParams?.periodo)
    ? resolvedSearchParams?.periodo[0]
    : resolvedSearchParams?.periodo
  const selectedPeriod: Period =
    requestedPeriod === "3m" || requestedPeriod === "6m" || requestedPeriod === "month" ? requestedPeriod : "month"
  const selectedPeriodOption = periodOptions.find((option) => option.value === selectedPeriod) || periodOptions[0]
  const periodStart = getPeriodStart(selectedPeriod)
  const periodStartIso = periodStart.toISOString()

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  // Get profile and tenant info
  const { data: profile } = await supabase.from("profiles").select("*, tenant:tenants(*)").eq("id", user.id).single()
  const tenantId = profile?.tenant_id ?? null

  if (!tenantId) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border bg-linear-to-br from-amber-50 via-background to-background p-6 sm:p-8">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline" className="border-amber-200 bg-amber-100/60 text-amber-800">
              Configuração pendente
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sua conta ainda não está vinculada a uma empresa</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Para exibir métricas corretas no dashboard, o usuário precisa estar associado a um tenant/empresa.
              Entre em contato com um administrador para concluir essa configuração.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const countMessages = (status?: Status) => {
    let query = supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStartIso)
    if (status) query = query.eq("status", status)
    return query
  }

  const countMktzapMessages = (status?: "pending" | "sent" | "failed") => {
    let query = supabase
      .from("mktzap_messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStartIso)
    if (status) query = query.eq("status", status)
    return query
  }

  const [
    totalMessagesResult,
    pendingMessagesResult,
    sentMessagesResult,
    deliveredMessagesResult,
    readMessagesResult,
    failedMessagesResult,
    totalMktzapResult,
    sentMktzapResult,
    failedMktzapResult,
    whatsappTemplatesResult,
    whatsappCredentialsResult,
    mktzapCredentialsResult,
    latestMessagesResult,
    latestMktzapResult,
  ] = await Promise.all([
    countMessages(),
    countMessages("pending"),
    countMessages("sent"),
    countMessages("delivered"),
    countMessages("read"),
    countMessages("failed"),
    countMktzapMessages(),
    countMktzapMessages("sent"),
    countMktzapMessages("failed"),
    supabase.from("message_templates").select("name, meta_status, is_active", { count: "exact" }).eq("tenant_id", tenantId),
    supabase
      .from("whatsapp_credentials")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("mktzap_credentials")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("messages")
      .select("id, template_name, recipient_phone, status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStartIso)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("mktzap_messages")
      .select("id, recipient_name, recipient_phone, status, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStartIso)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalMessages = totalMessagesResult.count || 0
  const pendingMessages = pendingMessagesResult.count || 0
  const sentMessages = sentMessagesResult.count || 0
  const deliveredMessages = deliveredMessagesResult.count || 0
  const readMessages = readMessagesResult.count || 0
  const failedMessages = failedMessagesResult.count || 0

  const totalMktzap = totalMktzapResult.count || 0
  const sentMktzap = sentMktzapResult.count || 0
  const failedMktzap = failedMktzapResult.count || 0

  const whatsappTemplates = whatsappTemplatesResult.data || []
  const approvedTemplates = whatsappTemplates.filter((template) => template.meta_status === "APPROVED").length
  const activeTemplates = whatsappTemplates.filter((template) => template.is_active).length
  const pendingTemplates = whatsappTemplates.filter((template) => template.meta_status === "PENDING").length
  const hasMktzapCredentials = (mktzapCredentialsResult.count || 0) > 0

  const effectiveDeliveredMessages = deliveredMessages + readMessages
  const whatsappDeliveryRate = percent(effectiveDeliveredMessages, totalMessages)
  const whatsappReadRate = percent(readMessages, effectiveDeliveredMessages)
  const mktzapSuccessRate = percent(sentMktzap, totalMktzap)
  const visibleMktzapMessages = hasMktzapCredentials ? totalMktzap : 0
  const visibleMktzapFailures = hasMktzapCredentials ? failedMktzap : 0
  const totalTenantMessages = totalMessages + visibleMktzapMessages

  const setupItems = [
    {
      label: "WhatsApp Oficial",
      ready: (whatsappCredentialsResult.count || 0) > 0,
      detail: `${approvedTemplates} aprovado(s), ${activeTemplates} ativo(s) para envio`,
    },
    ...(hasMktzapCredentials
      ? [
          {
            label: "MKTZAP",
            ready: true,
            detail: "Credenciais configuradas",
          },
        ]
      : []),
  ]

  const kpis = [
    {
      title: "Mensagens da empresa",
      value: totalTenantMessages,
      detail: selectedPeriodOption.label,
      icon: MessageSquare,
      color: "from-primary/15 to-primary/5 text-primary",
    },
    {
      title: "Entrega WhatsApp",
      value: `${whatsappDeliveryRate}%`,
      detail: `${effectiveDeliveredMessages} de ${totalMessages} mensagens entregues`,
      icon: CheckCircle2,
      color: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    },
    {
      title: "Leitura WhatsApp",
      value: `${whatsappReadRate}%`,
      detail: `${readMessages} de ${effectiveDeliveredMessages} mensagens entregues foram lidas`,
      icon: Eye,
      color: "from-blue-500/15 to-blue-500/5 text-blue-600",
    },
    {
      title: "Falhas",
      value: failedMessages + visibleMktzapFailures,
      detail: hasMktzapCredentials ? `${failedMessages} WhatsApp / ${failedMktzap} MKTZAP` : `${failedMessages} WhatsApp`,
      icon: AlertCircle,
      color: "from-red-500/15 to-red-500/5 text-red-600",
    },
  ]
  const latestWhatsappMessages = latestMessagesResult.data || []
  const latestMktzapMessages = hasMktzapCredentials ? latestMktzapResult.data || [] : []
  const latestActivities = [...latestWhatsappMessages, ...latestMktzapMessages].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  )

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border bg-linear-to-br from-primary/10 via-background to-background">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_340px] lg:items-center">
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Olá, {user.user_metadata?.full_name || user.email}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Indicadores filtrados para <span className="font-medium text-foreground">{profile?.tenant?.name}</span>.
                Período ativo: <span className="font-medium text-foreground">{selectedPeriodOption.label}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/messages">
                  Enviar WhatsApp
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {hasMktzapCredentials && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/mktzap">Enviar MKTZAP</Link>
                </Button>
              )}
            </div>
          </div>

          <Card className="border-primary/10 bg-background/70 shadow-sm backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Status da operação
              </CardTitle>
              <CardDescription>Configurações ativas para esta empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {setupItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge variant={item.ready ? "default" : "outline"}>{item.ready ? "Ativo" : "Pendente"}</Badge>
                </div>
              ))}
              <Button asChild variant="ghost" className="w-full justify-between">
                <Link href="/dashboard/settings">
                  Ajustar configurações
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon

          return (
            <Card key={kpi.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br p-3 ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{kpi.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {periodOptions.map((option) => (
          <Button
            key={option.value}
            asChild
            size="sm"
            variant={selectedPeriod === option.value ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
          >
            <Link href={`/dashboard?periodo=${option.value}`}>{option.label}</Link>
          </Button>
        ))}
      </div>

      <div className={`grid gap-4 ${hasMktzapCredentials ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              WhatsApp Oficial
            </CardTitle>
            <CardDescription>Envios e status da API oficial para esta empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Total" value={totalMessages} icon={Send} />
              <MiniMetric label="Entregue" value={effectiveDeliveredMessages} icon={CheckCircle2} />
              <MiniMetric label="Lido" value={readMessages} icon={Eye} />
              <MiniMetric label="Falhou" value={failedMessages} icon={XCircle} />
            </div>
            <div className="space-y-3">
              <ProgressRow label="Taxa de entrega" value={whatsappDeliveryRate} />
              <ProgressRow label="Leitura sobre entregues" value={whatsappReadRate} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TemplatePill label="Aprovados" value={approvedTemplates} />
              <TemplatePill label="Pendentes" value={pendingTemplates} />
              <TemplatePill label="Total templates" value={whatsappTemplates.length} />
            </div>
          </CardContent>
        </Card>

        {hasMktzapCredentials && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                MKTZAP
              </CardTitle>
              <CardDescription>Resumo de envios pelo canal MKTZAP desta empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric label="Total" value={totalMktzap} icon={Send} />
                <MiniMetric label="Enviado" value={sentMktzap} icon={CheckCircle2} />
                <MiniMetric label="Período" value={totalMktzap} icon={Clock3} />
                <MiniMetric label="Falhou" value={failedMktzap} icon={XCircle} />
              </div>
              <div className="space-y-3">
                <ProgressRow label="Taxa de envio" value={mktzapSuccessRate} />
                <ProgressRow label="Participação no volume" value={percent(totalMktzap, totalTenantMessages)} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Últimas atividades
            </CardTitle>
            <CardDescription>Mensagens recentes filtradas por {profile?.tenant?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestActivities
              .slice(0, 6)
              .map((message) => {
                const status = (message.status || "pending") as Status
                const isMktzap = "recipient_name" in message
                const title = isMktzap ? message.recipient_name || "Contato MKTZAP" : message.template_name

                return (
                  <div key={`${isMktzap ? "mktzap" : "wa"}-${message.id}`} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{isMktzap ? "MKTZAP" : "WhatsApp"}</Badge>
                        <p className="truncate text-sm font-medium">{title}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {message.recipient_phone} · {formatDate(message.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                      {statusLabels[status]}
                    </span>
                  </div>
                )
              })}
            {latestActivities.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium">Nenhuma mensagem enviada ainda</p>
                <p className="mt-1 text-xs text-muted-foreground">Os próximos envios desta empresa aparecerão aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fila e atenção</CardTitle>
            <CardDescription>Pontos que merecem acompanhamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AttentionItem
              icon={Clock3}
              label="WhatsApp pendente"
              value={pendingMessages}
              description="Mensagens aguardando atualização de status"
            />
            <AttentionItem
              icon={AlertCircle}
              label="Templates pendentes"
              value={pendingTemplates}
              description="Aguardando aprovação da Meta"
            />
            <AttentionItem
              icon={XCircle}
              label="Falhas totais"
              value={failedMessages + visibleMktzapFailures}
              description="Falhas nos canais desta empresa"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  )
}

function TemplatePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function AttentionItem({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  description: string
}) {
  return (
    <div className="flex gap-3 rounded-2xl border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{label}</p>
          <Badge variant={value > 0 ? "outline" : "secondary"}>{value}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
