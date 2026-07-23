"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Message } from "@/lib/types"
import {
  getMessagePayloadContent,
  getMessageServiceName,
  messageMatchesSearch,
  MESSAGES_INITIAL_LIMIT,
  MESSAGES_PAGE_SIZE,
} from "@/lib/messages-utils"
import { MessageStatusBadge } from "@/components/dashboard/message-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { formatDistanceToNow, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Info, Search, History, RefreshCw, FilterX, MessageSquare } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"
import { WhatsAppErrorDetailsView } from "@/components/dashboard/whatsapp-error-details"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MessagesMonitorProps {
  messages: Message[]
  totalInDatabase: number
}

interface StatusHistory {
  id: string
  status: string
  timestamp: string
  raw_payload?: Record<string, unknown>
}

function buildFilteredQuery(
  supabase: ReturnType<typeof createBrowserClient>,
  {
    startDate,
    endDate,
    searchTerm,
    statusFilter,
  }: {
    startDate: string
    endDate: string
    searchTerm: string
    statusFilter: string
  },
) {
  let query = supabase.from("messages").select("*", { count: "exact" }).order("created_at", { ascending: false })

  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00.000Z`)
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59.999Z`)
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }
  if (searchTerm.trim()) {
    const term = `%${searchTerm.trim()}%`
    query = query.or(
      `recipient_phone.ilike.${term},template_name.ilike.${term},metadata->recordData->>servico.ilike.${term}`,
    )
  }

  return query
}

export function MessagesMonitor({ messages: initialMessages, totalInDatabase }: MessagesMonitorProps) {
  const [recentMessages, setRecentMessages] = useState(initialMessages)
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([])
  const [filteredTotal, setFilteredTotal] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [appliedSearch, setAppliedSearch] = useState("")
  const [appliedStatus, setAppliedStatus] = useState("all")
  const [appliedStartDate, setAppliedStartDate] = useState("")
  const [appliedEndDate, setAppliedEndDate] = useState("")

  const [isFilteredMode, setIsFilteredMode] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const hasActiveFilters = Boolean(appliedStartDate || appliedEndDate || appliedSearch || appliedStatus !== "all")

  const localFilteredMessages = useMemo(() => {
    return recentMessages.filter((message) => {
      const matchesSearch = messageMatchesSearch(message, appliedSearch)
      const matchesStatus = appliedStatus === "all" || message.status === appliedStatus
      return matchesSearch && matchesStatus
    })
  }, [recentMessages, appliedSearch, appliedStatus])

  const displayMessages = isFilteredMode ? filteredMessages : localFilteredMessages
  const totalItems = isFilteredMode ? filteredTotal : localFilteredMessages.length
  const totalPages = Math.max(1, Math.ceil(totalItems / MESSAGES_PAGE_SIZE))

  const paginatedMessages = isFilteredMode
    ? displayMessages
    : localFilteredMessages.slice((page - 1) * MESSAGES_PAGE_SIZE, page * MESSAGES_PAGE_SIZE)

  const fetchFilteredMessages = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      try {
        const from = (pageNum - 1) * MESSAGES_PAGE_SIZE
        const to = from + MESSAGES_PAGE_SIZE - 1

        const query = buildFilteredQuery(supabase, {
          startDate: appliedStartDate,
          endDate: appliedEndDate,
          searchTerm: appliedSearch,
          statusFilter: appliedStatus,
        }).range(from, to)

        const { data, count, error } = await query

        if (error) {
          console.error("[messages-monitor] Error fetching filtered messages:", error)
          return
        }

        setFilteredMessages(data || [])
        setFilteredTotal(count ?? 0)
      } finally {
        setLoading(false)
      }
    },
    [supabase, appliedStartDate, appliedEndDate, appliedSearch, appliedStatus],
  )

  useEffect(() => {
    if (isFilteredMode) {
      fetchFilteredMessages(page)
    }
  }, [isFilteredMode, page, fetchFilteredMessages])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleApplyFilters = () => {
    const useFullSearch = Boolean(startDate || endDate || searchTerm.trim())

    setAppliedSearch(searchTerm)
    setAppliedStatus(statusFilter)
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
    setPage(1)

    if (useFullSearch) {
      setIsFilteredMode(true)
    } else {
      setIsFilteredMode(false)
    }
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setStartDate("")
    setEndDate("")
    setAppliedSearch("")
    setAppliedStatus("all")
    setAppliedStartDate("")
    setAppliedEndDate("")
    setIsFilteredMode(false)
    setPage(1)
    setFilteredMessages([])
    setFilteredTotal(0)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      if (isFilteredMode) {
        await fetchFilteredMessages(page)
      } else {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(MESSAGES_INITIAL_LIMIT)

        if (data) {
          setRecentMessages(data)
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleViewHistory = async (message: Message) => {
    setSelectedMessage(message)
    setLoadingHistory(true)

    try {
      const { data } = await supabase
        .from("message_status_history")
        .select("*")
        .eq("message_id", message.id)
        .order("timestamp", { ascending: true })

      setStatusHistory(data || [])
    } finally {
      setLoadingHistory(false)
    }
  }

  const showInitialLimitWarning =
    !isFilteredMode && totalInDatabase > MESSAGES_INITIAL_LIMIT && recentMessages.length >= MESSAGES_INITIAL_LIMIT

  if (recentMessages.length === 0 && !isFilteredMode) {
    return <p className="py-8 text-center text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
  }

  return (
    <div className="space-y-4">
      {showInitialLimitWarning && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Exibindo as últimas {MESSAGES_INITIAL_LIMIT} mensagens de {totalInDatabase} no total. Para encontrar
            mensagens mais antigas, use os filtros de data, telefone ou serviço e clique em &quot;Buscar&quot;.
          </AlertDescription>
        </Alert>
      )}

      {isFilteredMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Busca completa ativa — {filteredTotal} mensagem(ns) encontrada(s)
            {hasActiveFilters ? " com os filtros aplicados" : ""}.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone, template ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="read">Lido</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="start-date" className="text-xs text-muted-foreground">
              Data início
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="end-date" className="text-xs text-muted-foreground">
              Data fim
            </Label>
            <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApplyFilters} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
            {(hasActiveFilters || isFilteredMode) && (
              <Button variant="outline" onClick={handleClearFilters} disabled={loading}>
                <FilterX className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Serviço</TableHead>
              <TableHead className="hidden sm:table-cell">Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Erro</TableHead>
              <TableHead className="hidden md:table-cell">Enviado</TableHead>
              <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Carregando mensagens...
                </TableCell>
              </TableRow>
            ) : paginatedMessages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhuma mensagem encontrada com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              paginatedMessages.map((message) => {
                const serviceName = getMessageServiceName(message)

                return (
                  <TableRow key={message.id}>
                    <TableCell className="font-mono text-sm">{message.recipient_phone}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[220px] truncate text-sm" title={serviceName}>
                      {serviceName}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{message.template_name}</TableCell>
                    <TableCell>
                      <MessageStatusBadge status={message.status} errorMessage={message.error_message} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[280px] truncate text-xs text-destructive">
                      {message.error_message || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {message.status_updated_at
                        ? formatDistanceToNow(new Date(message.status_updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleViewHistory(message)}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver conteúdo e histórico</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {paginatedMessages.length} de {totalItems} mensagem(ns)
          {!isFilteredMode && !hasActiveFilters ? ` (últimas ${MESSAGES_INITIAL_LIMIT})` : ""}
          {totalPages > 1 ? ` — página ${page} de ${totalPages}` : ""}
        </p>

        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) setPage(page - 1)
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) setPage(page + 1)
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Mensagem</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedMessage && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-mono text-sm">{selectedMessage.recipient_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Serviço</p>
                        <p className="text-sm">{getMessageServiceName(selectedMessage)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Template</p>
                        <p className="text-sm">{selectedMessage.template_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status Atual</p>
                        <div className="mt-1">
                          <MessageStatusBadge status={selectedMessage.status} errorMessage={selectedMessage.error_message} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Enviado em</p>
                        <p className="text-sm">
                          {format(new Date(selectedMessage.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {selectedMessage.whatsapp_message_id && (
                      <div>
                        <p className="text-xs text-muted-foreground">ID WhatsApp</p>
                        <p className="font-mono text-xs break-all">{selectedMessage.whatsapp_message_id}</p>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Conteúdo da mensagem</p>
                      <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                        {getMessagePayloadContent(selectedMessage)}
                      </div>
                    </div>
                    {selectedMessage.status === "failed" && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-medium text-destructive">Erro da Meta / WhatsApp</p>
                        <WhatsAppErrorDetailsView
                          errorMessage={selectedMessage.error_message}
                          errorDetails={
                            (selectedMessage.metadata?.whatsappErrorDetails as Record<string, unknown> | undefined) ||
                            null
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Status
                  </h4>

                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : statusHistory.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground text-sm">
                        Nenhuma atualização de status recebida ainda.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {statusHistory.map((history, index) => {
                        return (
                          <Card key={history.id}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <MessageStatusBadge status={history.status} />
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(history.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </p>
                              </div>
                              {index === statusHistory.length - 1 && (
                                <Badge variant="outline" className="text-xs">
                                  Atual
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
