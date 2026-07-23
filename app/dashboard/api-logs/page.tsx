import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ClientApiMessageLog } from "@/lib/types"
import { WhatsAppErrorDetailsView } from "@/components/dashboard/whatsapp-error-details"

function statusBadge(status: ClientApiMessageLog["status"]) {
  if (status === "success") {
    return <Badge className="bg-emerald-600">enviado</Badge>
  }

  if (status === "validation_error") {
    return <Badge variant="secondary">validação</Badge>
  }

  return <Badge variant="destructive">falhou</Badge>
}

export default async function ClientApiLogsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single()
  const tenantId = profile?.tenant_id

  if (!tenantId) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Você precisa estar vinculado a uma empresa para ver os logs.</p>
        </CardContent>
      </Card>
    )
  }

  const { data: logs } = await supabase
    .from("client_api_message_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500)

  const typedLogs = (logs || []) as ClientApiMessageLog[]
  const successCount = typedLogs.filter((log) => log.status === "success").length
  const failedCount = typedLogs.filter((log) => log.status === "failed").length
  const validationCount = typedLogs.filter((log) => log.status === "validation_error").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logs API Cliente</h1>
        <p className="text-muted-foreground">Todas as tentativas de envio pela API externa (/api/v1/messages)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enviadas</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{successCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Falhas no envio</CardDescription>
            <CardTitle className="text-2xl text-destructive">{failedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erros de validação</CardDescription>
            <CardTitle className="text-2xl">{validationCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tentativas de envio</CardTitle>
          <CardDescription>{typedLogs.length} registro(s) carregado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Credencial</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>WhatsApp ID</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhum log encontrado. Execute a migration 030 no Supabase.
                    </TableCell>
                  </TableRow>
                ) : (
                  typedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{log.credential_name || "—"}</TableCell>
                      <TableCell>{log.template_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{log.recipient_phone || "—"}</TableCell>
                      <TableCell>{log.external_id || "—"}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="max-w-[260px] text-xs text-destructive">
                        {log.error_message || "—"}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        {log.whatsapp_message_id || "—"}
                      </TableCell>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer text-sm text-primary">Ver</summary>
                          <div className="mt-2 space-y-2 max-w-md">
                            <WhatsAppErrorDetailsView
                              errorMessage={log.error_message}
                              errorDetails={log.error_details}
                            />
                            <p className="text-xs text-muted-foreground">
                              Parâmetros: {JSON.stringify(log.parameters || {})}
                            </p>
                            {log.payload && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Payload enviado</p>
                                <pre className="rounded-md bg-muted p-2 text-xs overflow-x-auto">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
