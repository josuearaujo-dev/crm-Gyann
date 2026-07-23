"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Search, RefreshCw, Eye } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ErrorLog {
  id: string
  tenant_id: string | null
  user_id: string | null
  error_type: string
  error_message: string
  error_stack: string | null
  context: Record<string, unknown> | null
  endpoint: string | null
  method: string | null
  status_code: number | null
  created_at: string
}

export default function ErrorLogsTable() {
  const [logs, setLogs] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null)

  const supabase = createClient()

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(100)

      if (typeFilter !== "all") {
        query = query.eq("error_type", typeFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error("Error fetching logs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [typeFilter])

  const filteredLogs = logs.filter(
    (log) =>
      log.error_message.toLowerCase().includes(search.toLowerCase()) ||
      log.error_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.endpoint && log.endpoint.toLowerCase().includes(search.toLowerCase())),
  )

  const errorTypes = Array.from(new Set(logs.map((log) => log.error_type)))

  const getErrorBadge = (type: string) => {
    const colors: Record<string, string> = {
      WHATSAPP_SEND_FAILED: "bg-red-500",
      TEMPLATE_NOT_FOUND: "bg-orange-500",
      DATABASE_INSERT_ERROR: "bg-yellow-500",
      WEBHOOK_ERROR: "bg-purple-500",
      SEND_MESSAGES_ERROR: "bg-red-600",
    }
    return colors[type] || "bg-gray-500"
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Últimos 100 Erros</CardTitle>
            <Button onClick={fetchLogs} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por mensagem, tipo ou endpoint..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {errorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum erro encontrado</div>
              ) : (
                <div className="divide-y">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <Badge className={`${getErrorBadge(log.error_type)} text-white`}>{log.error_type}</Badge>
                            {log.endpoint && (
                              <Badge variant="outline">
                                {log.method} {log.endpoint}
                              </Badge>
                            )}
                            {log.status_code && <Badge variant="secondary">{log.status_code}</Badge>}
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{log.error_message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Erro</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {selectedLog && (
              <div className="space-y-4 p-4">
                <div>
                  <h4 className="font-semibold mb-2">Tipo</h4>
                  <Badge className={`${getErrorBadge(selectedLog.error_type)} text-white`}>
                    {selectedLog.error_type}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Mensagem</h4>
                  <p className="text-sm bg-muted p-3 rounded">{selectedLog.error_message}</p>
                </div>

                {selectedLog.error_stack && (
                  <div>
                    <h4 className="font-semibold mb-2">Stack Trace</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{selectedLog.error_stack}</pre>
                  </div>
                )}

                {selectedLog.endpoint && (
                  <div>
                    <h4 className="font-semibold mb-2">Endpoint</h4>
                    <p className="text-sm">
                      {selectedLog.method} {selectedLog.endpoint}
                    </p>
                  </div>
                )}

                {selectedLog.context && (
                  <div>
                    <h4 className="font-semibold mb-2">Contexto Adicional</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.context, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Data/Hora</h4>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
