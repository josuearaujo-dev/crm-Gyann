import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function MktzapLogsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
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
    .from("mktzap_messages")
    .select("*, mktzap_templates(name, mktzap_id)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500)

  // Carrega os dados de quem enviou (sent_by) em uma segunda consulta, para evitar problemas de join
  const senderIds = Array.from(
    new Set((logs || []).map((log: any) => String(log.sent_by || "").trim()).filter((id) => !!id)),
  )

  let senderMap: Record<string, { full_name: string | null; email: string | null }> = {}

  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", senderIds)

    senderMap =
      (senders || []).reduce(
        (acc: Record<string, { full_name: string | null; email: string | null }>, sender: any) => {
          acc[sender.id] = {
            full_name: sender.full_name ?? null,
            email: sender.email ?? null,
          }
          return acc
        },
        {},
      ) || {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logs MKTZAP</h1>
        <p className="text-muted-foreground">Histórico completo dos retornos de envio do MKTZAP</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retornos de Envio</CardTitle>
          <CardDescription>{logs?.length || 0} registro(s) carregado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>ID File</TableHead>
                  <TableHead>ID Pax Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem ID</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  (logs || []).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {senderMap[String(log.sent_by || "")]?.full_name ||
                          senderMap[String(log.sent_by || "")]?.email ||
                          "—"}
                      </TableCell>
                      <TableCell>{log.mktzap_templates?.name || "—"}</TableCell>
                      <TableCell>{log.id_file || "—"}</TableCell>
                      <TableCell>{log.id_pax_servico || "—"}</TableCell>
                      <TableCell>
                        {log.status === "sent" ? (
                          <Badge className="bg-emerald-600">enviado</Badge>
                        ) : (
                          <Badge variant="destructive">falhou</Badge>
                        )}
                      </TableCell>
                      <TableCell>{log.mktzap_message_id || "—"}</TableCell>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer text-sm text-primary">Ver retorno</summary>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Erro: {log.error_message || "—"}
                            </p>
                            <pre className="rounded-md bg-muted p-2 text-xs overflow-x-auto">
{JSON.stringify(log.response || {}, null, 2)}
                            </pre>
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
