"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { Search, Send, Loader2, Eye, Filter, X, SendHorizontal, ChevronDown, ChevronUp } from "lucide-react"
import { createClient } from "@/lib/supabase"
import type { ApiCredential, MessageTemplate } from "@/lib/types"
import { formatWhatsAppApiError } from "@/lib/whatsapp"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface SendMessagesFormProps {
  apiCredentials: ApiCredential[]
  templates: MessageTemplate[]
  tenantId: string | null
  userId: string
  disabled: boolean
  resendBehavior?: "skip" | "resend"
  canSelectApi?: boolean
}

interface DataRecord {
  id: string
  phone: string
  idPaxServico: string
  messageStatus: "sending" | "sent" | "error" | null
  idFile?: string | number
  dataPickup?: string
  nomePax?: string
  servico?: string
  categoriaServico?: string
  parametroServico?: string
  idOrdemServico?: string | number
  empresa?: string // cliente
  evento?: string
  origem?: string
  destino?: string
  idioma?: string
  [key: string]: unknown
}

type MessageStatus = {
  status: "pending" | "sending" | "sent" | "delivered" | "read" | "failed"
  error?: string
  errorDetails?: Record<string, unknown> | null
  messageId?: string
}

type SendMessagesApiResult = {
  success?: number
  failed?: number
  error?: string
  results?: Array<{
    id: string
    success: boolean
    whatsappMessageId?: string
    error?: string
    errorDetails?: Record<string, unknown> | null
  }>
}

async function parseSendMessagesResponse(response: Response): Promise<SendMessagesApiResult> {
  const data = (await response.json().catch(() => ({}))) as SendMessagesApiResult & Record<string, unknown>

  if (!response.ok) {
    throw new Error(formatWhatsAppApiError(data, response.status))
  }

  if (!data.results && typeof data.error === "string") {
    throw new Error(data.error)
  }

  return data
}

function getSendErrorMessage(
  sendResult?: { error?: string; errorDetails?: Record<string, unknown> | null } | null,
  fallback = "Erro desconhecido",
) {
  const base = sendResult?.error?.trim() || fallback
  const details = sendResult?.errorDetails

  if (!details) {
    return base
  }

  const extras: string[] = []
  if (details.code != null) extras.push(`código ${details.code}`)
  if (details.errorSubcode != null) extras.push(`subcódigo ${details.errorSubcode}`)
  if (details.fbtraceId) extras.push(`trace ${details.fbtraceId}`)

  return extras.length > 0 ? `${base}\n(${extras.join(", ")})` : base
}

function FilterCombobox({
  label,
  options,
  selected,
  onToggle,
  onRemove,
  placeholder,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  onRemove: (value: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected.length === 0 ? placeholder : `${selected.length} selecionado(s)`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              {options.map((value) => (
                <CommandItem
                  key={value}
                  value={value}
                  onSelect={() => onToggle(value)}
                >
                  <span className="flex-1 truncate">{value}</span>
                  {selected.includes(value) && (
                    <span className="text-primary text-xs">✓</span>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <div
              key={value}
              className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              <span className="truncate max-w-[180px]">{value}</span>
              <button
                type="button"
                onClick={() => onRemove(value)}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SendMessagesForm({
  apiCredentials,
  templates,
  tenantId,
  userId,
  disabled,
  resendBehavior = "skip",
  canSelectApi = true,
}: SendMessagesFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [selectedApi, setSelectedApi] = useState<string>("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [data, setData] = useState<DataRecord[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)
  const sentMessageIdsRef = useRef<Map<string, string>>(new Map())
  const [messageStatuses, setMessageStatuses] = useState<Map<string, MessageStatus>>(new Map())
  const [statusUpdateTrigger, setStatusUpdateTrigger] = useState(0)
  const [isPolling, setIsPolling] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [testPhoneNumber, setTestPhoneNumber] = useState("")
  const [editedFields, setEditedFields] = useState<Record<string, Record<string, string>>>({})
  const [primaryKey, setPrimaryKey] = useState<string>("")

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState({
    parametroServico: [] as string[],
    categoriaServico: [] as string[],
    servico: [] as string[],
    idOrdemServico: [] as string[],
    idFile: [] as string[],
    cliente: [] as string[],
    evento: [] as string[],
    origem: [] as string[],
    destino: [] as string[],
    idioma: [] as string[],
    status: [] as string[],
  })
  const [availableFilters, setAvailableFilters] = useState({
    parametroServico: [] as string[],
    categoriaServico: [] as string[],
    servico: [] as string[],
    idOrdemServico: [] as string[],
    idFile: [] as string[],
    cliente: [] as string[],
    evento: [] as string[],
    origem: [] as string[],
    destino: [] as string[],
    idioma: [] as string[],
    status: [] as string[],
  })
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState("")
  const [confirmTitle, setConfirmTitle] = useState("")
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [resendAction, setResendAction] = useState<(() => void) | null>(null)
  const [resendRecord, setResendRecord] = useState<DataRecord | null>(null)

  const selectedTemplateObj = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplate)
  }, [templates, selectedTemplate])
  const selectedApiObj = useMemo(() => {
    return apiCredentials.find((api) => api.id === selectedApi)
  }, [apiCredentials, selectedApi])

  const getTemplateMapping = (template: MessageTemplate | undefined): Record<string, string> => {
    if (!template) return {}
    // Accept both 'parameter_mapping' (from DB) and 'parameters_mapping' (legacy)
    return (template as any).parameters_mapping || template.parameter_mapping || {}
  }

  const buildPreviewMessage = (record: DataRecord, useEditedParams = false): string => {
    const templateMapping = getTemplateMapping(selectedTemplateObj)

    if (!selectedTemplateObj?.template_text || Object.keys(templateMapping).length === 0) {
      return "Template não configurado"
    }

    let message = selectedTemplateObj.template_text

    Object.entries(templateMapping).forEach(([paramNum, fieldName]) => {
      const recordKey = `${record.id}_${paramNum}`
      const value =
        useEditedParams && editedFields[record[primaryKey]] && editedFields[record[primaryKey]][fieldName]
          ? editedFields[record[primaryKey]][fieldName]
          : record[fieldName] || `[${fieldName}]`
      message = message.replace(new RegExp(`\\{\\{${paramNum}\\}\\}`, "g"), String(value))
    })

    return message
  }

  const fetchData = async () => {
    console.log("[v0] fetchData called")
    if (!selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Template obrigatório",
        description: "Selecione um template antes de buscar.",
      })
      return
    }
    if (!selectedApi || !startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Selecione a API e as datas de início e fim.",
      })
      return
    }

    if (endDate < startDate) {
      toast({
        variant: "destructive",
        title: "Erro nas datas",
        description: "A data fim não pode ser anterior à data início.",
      })
      return
    }

    setIsLoading(true)
    setError(null)
    setData([])
    setSelectedRows(new Set())
    setFilters({
      parametroServico: [],
      categoriaServico: [],
      servico: [],
      idOrdemServico: [],
      idFile: [],
      cliente: [],
      evento: [],
      origem: [],
      destino: [],
      idioma: [],
      status: [],
    })

    try {
      const response = await fetch("/api/fetch-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiCredentialId: selectedApi,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] API Error response:", errorData)
        throw new Error(errorData.error || "Erro ao buscar dados")
      }

      const result = await response.json()
      console.log("[v0] Fetched data:", result.data?.length, "records")

      const sortedData = (result.data || []).sort((a: DataRecord, b: DataRecord) => {
        const fileA = Number(a.idFile) || 0
        const fileB = Number(b.idFile) || 0
        if (fileA !== fileB) return fileA - fileB

        const dateA = String(a.dataPickup || "")
        const dateB = String(b.dataPickup || "")
        return dateA.localeCompare(dateB)
      })

      const uniqueParametroServico: string[] = Array.from(
        new Set<string>(sortedData.map((r: DataRecord) => String(r.parametroServico || ""))),
      ).filter((value) => value.length > 0)
      const uniqueCategoriaServico: string[] = Array.from(
        new Set<string>(sortedData.map((r: DataRecord) => String(r.categoriaServico || r.tipoServico || ""))),
      ).filter((value) => value.length > 0)
      const uniqueServico: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.servico || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueIdOrdemServico: string[] = Array.from(
        new Set<string>(sortedData.map((r: DataRecord) => String(r.idOrdemServico || ""))),
      ).filter((value) => value.length > 0)
      const uniqueIdFile: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.idFile || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueCliente: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.empresa || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueEvento: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.evento || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueOrigem: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.origem || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueDestino: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.destino || "")))).filter(
        (value) => value.length > 0,
      )
      const uniqueIdioma: string[] = Array.from(new Set<string>(sortedData.map((r: DataRecord) => String(r.idioma || "")))).filter(
        (value) => value.length > 0,
      )

      setAvailableFilters({
        parametroServico: uniqueParametroServico.sort(),
        categoriaServico: uniqueCategoriaServico.sort(),
        servico: uniqueServico.sort(),
        idOrdemServico: uniqueIdOrdemServico.sort(),
        idFile: uniqueIdFile.sort(),
        cliente: uniqueCliente.sort(),
        evento: uniqueEvento.sort(),
        origem: uniqueOrigem.sort(),
        destino: uniqueDestino.sort(),
        idioma: uniqueIdioma.sort(),
        status: [],
      })

      const idsToCheck = sortedData
        .map((record: DataRecord) => record.idPaxServico)
        .filter((id: string | number | undefined) => id !== undefined && id !== null)

      console.log("[v0] IdPaxServicos to check:", idsToCheck)

      if (idsToCheck.length > 0) {
        const statusResponse = await fetch("/api/check-message-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idPaxServicos: idsToCheck,
            startDate,
            endDate,
          }),
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log("[v0] Message statuses loaded:", statusData)

          if (statusData.statuses) {
            const newStatusMap = new Map<string, MessageStatus>()
            Object.entries(statusData.statuses).forEach(([idPaxServico, status]) => {
              newStatusMap.set(idPaxServico, status as MessageStatus)
            })
            setMessageStatuses(newStatusMap)
            console.log("[v0] messageStatuses Map populated with", newStatusMap.size, "entries")
          }

          // Merge status data with records
          const dataWithStatus = sortedData.map((record: DataRecord) => {
            const status = statusData.statuses[record.idPaxServico]
            console.log(`[v0] Record ${record.idPaxServico}:`, status ? `Status: ${status.status}` : "No status found")
            return {
              ...record,
              messageStatus: status || null,
            }
          })

          setData(dataWithStatus)
          const uniqueStatus: string[] = Array.from(
            new Set<string>(
              dataWithStatus.map((record: DataRecord) =>
                record.messageStatus ? String((record.messageStatus as any).status || "") : "",
              ),
            ),
          ).filter((value) => value.length > 0)
          setAvailableFilters((prev) => ({ ...prev, status: uniqueStatus.sort() }))
        } else {
          setData(sortedData)
          setAvailableFilters((prev) => ({ ...prev, status: [] }))
        }
      } else {
        setData(sortedData)
        setAvailableFilters((prev) => ({ ...prev, status: [] }))
      }

      toast({
        title: "Dados carregados",
        description: `${sortedData.length} registros encontrados.`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar dados"
      console.error("[v0] Error fetching data:", errorMessage)
      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredData.map((_, index) => index)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleRowSelect = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(index)
    } else {
      newSelected.delete(index)
    }
    setSelectedRows(newSelected)
  }

  const fetchMessageStatuses = useCallback(async () => {
    if (sentMessageIdsRef.current.size === 0) {
      console.log("[v0] No messages to poll")
      return
    }

    const supabase = createClient()
    const messageIds = Array.from(sentMessageIdsRef.current.values())
    console.log("[v0] Polling statuses for messages:", messageIds)

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, whatsapp_message_id, status, id_pax_servico")
      .in("whatsapp_message_id", messageIds)

    if (error) {
      console.error("[v0] Error fetching statuses:", error)
      return
    }

    console.log("[v0] Fetched message statuses:", messages)

    if (messages) {
      setMessageStatuses((prev) => {
        const newStatuses = new Map(prev)
        messages.forEach((msg) => {
          const idPaxServico = String(msg.id_pax_servico)
          const currentStatus = newStatuses.get(idPaxServico)
          if (!currentStatus || currentStatus.status !== msg.status) {
            console.log("[v0] Status changed for", idPaxServico, ":", currentStatus?.status, "->", msg.status)
            newStatuses.set(idPaxServico, {
              status: msg.status as MessageStatus["status"],
              messageId: msg.whatsapp_message_id,
            })
          }
        })
        return newStatuses
      })
      setStatusUpdateTrigger((prev) => prev + 1)
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    setIsPolling(true)
    fetchMessageStatuses() // Fetch immediately

    pollingIntervalRef.current = setInterval(() => {
      fetchMessageStatuses()
    }, 5000)

    console.log("[v0] Started polling")
  }, [fetchMessageStatuses])

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const handleSendSingle = async (record: DataRecord) => {
    const idPaxServico = String(record.idPaxServico)

    if (!selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um template",
      })
      return
    }

    if (testMode && !testPhoneNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Número de teste obrigatório no modo de teste",
      })
      return
    }

    // Verifica se a mensagem já foi enviada
    const existingStatus = messageStatuses.get(idPaxServico)
    if (existingStatus && (existingStatus.status === "sent" || existingStatus.status === "delivered" || existingStatus.status === "read")) {
      // Mostra diálogo perguntando se quer reenviar
      setResendRecord(record)
      setResendAction(() => () => {
        setShowResendDialog(false)
        executeSendSingle(record)
      })
      setShowResendDialog(true)
      return
    }

    executeSendSingle(record)
  }

  const executeSendSingle = async (record: DataRecord) => {
    const idPaxServico = String(record.idPaxServico)

    setIsSending(true)
    setSendingId(data.indexOf(record))

    setMessageStatuses((prev) => {
      const newMap = new Map(prev)
      newMap.set(idPaxServico, { status: "sending" })
      return newMap
    })
    setStatusUpdateTrigger((prev) => prev + 1)

    try {
      const editedParams = editedFields[record.id] || {}
      const templateMapping = getTemplateMapping(selectedTemplateObj)

      const parameters = Object.entries(templateMapping).map(([paramIndex, fieldName]) => {
        const value = editedParams[fieldName] !== undefined ? editedParams[fieldName] : (record[fieldName] as string)
        console.log(`[v0] Edited param ${paramIndex} (${fieldName}):`, value)
        return {
          type: "text",
          text: value || "-",
        }
      })

      console.log("[v0] Final edited parameters:", parameters)

      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [record],
          templateId: selectedTemplate,
          tenantId: tenantId,
          userId: userId,
          testMode,
          testNumber: testMode ? testPhoneNumber : undefined,
          parameters,
        }),
      })

      const result = await parseSendMessagesResponse(response)
      console.log("[v0] Send result:", result)

      if (result.results && result.results[0]) {
        const sendResult = result.results[0]
        if (sendResult.success && sendResult.whatsappMessageId) {
          setMessageStatuses((prev) => {
            const newMap = new Map(prev)
            newMap.set(idPaxServico, {
              status: "sent",
              messageId: sendResult.whatsappMessageId,
            })
            return newMap
          })

          sentMessageIdsRef.current.set(idPaxServico, sendResult.whatsappMessageId)

          if (!isPolling) {
            startPolling()
          }
          setStatusUpdateTrigger((prev) => prev + 1)

          toast({
            title: "Sucesso",
            description: "Mensagem enviada com sucesso",
          })
        } else {
          const errorMessage = getSendErrorMessage(sendResult)
          setMessageStatuses((prev) => {
            const newMap = new Map(prev)
            newMap.set(idPaxServico, {
              status: "failed",
              error: errorMessage,
              errorDetails: sendResult.errorDetails || null,
            })
            return newMap
          })
          // Trigger re-render on failure
          setStatusUpdateTrigger((prev) => prev + 1)

          toast({
            variant: "destructive",
            title: "Erro ao enviar",
            description: errorMessage,
          })
        }
      } else {
        const errorMessage = getSendErrorMessage({ error: result.error }, "Resposta inesperada da API de envio")
        setMessageStatuses((prev) => {
          const newMap = new Map(prev)
          newMap.set(idPaxServico, {
            status: "failed",
            error: errorMessage,
          })
          return newMap
        })
        setStatusUpdateTrigger((prev) => prev + 1)
        toast({
          variant: "destructive",
          title: "Erro ao enviar",
          description: errorMessage,
        })
      }
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro ao enviar mensagem"
      setMessageStatuses((prev) => {
        const newMap = new Map(prev)
        newMap.set(idPaxServico, {
          status: "failed",
          error: errorMessage,
        })
        return newMap
      })
      // Trigger re-render on catch error
      setStatusUpdateTrigger((prev) => prev + 1)

      toast({
        variant: "destructive",
        title: "Erro",
        description: errorMessage,
      })
    } finally {
      setIsSending(false)
      setSendingId(null)
    }
  }

  const handleSendSelected = async () => {
    if (selectedRows.size === 0) return
    setIsSending(true)
    setResult(null)

    const selectedRecords = Array.from(selectedRows).map((index) => filteredData[index])

    try {
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          records: selectedRecords,
          tenantId: tenantId,
          userId: userId,
          testMode,
          testNumber: testMode ? testPhoneNumber : undefined,
        }),
      })

      const result = await parseSendMessagesResponse(response)
      console.log("[v0] Batch send result:", result)

      if (result.results) {
        result.results.forEach(
          (res: {
            id: string
            success: boolean
            whatsappMessageId?: string
            error?: string
            errorDetails?: Record<string, unknown> | null
          }, index: number) => {
            const recordIndex = index
            const errorMessage = getSendErrorMessage(res)

            if (res.success && res.whatsappMessageId) {
              sentMessageIdsRef.current.set(selectedRecords[index].idPaxServico, res.whatsappMessageId) // Use idPaxServico as key
              setMessageStatuses((prev) => {
                const newStatuses = new Map(prev)
                newStatuses.set(selectedRecords[index].idPaxServico, {
                  status: "sent",
                  messageId: res.whatsappMessageId,
                })
                return newStatuses
              })
            } else {
              setMessageStatuses((prev) => {
                const newStatuses = new Map(prev)
                newStatuses.set(selectedRecords[index].idPaxServico, {
                  status: "failed",
                  error: errorMessage,
                  errorDetails: res.errorDetails || null,
                })
                return newStatuses
              })
            }
          },
        )

        const firstFailure = result.results.find((res) => !res.success)
        if (firstFailure) {
          toast({
            variant: "destructive",
            title: "Algumas mensagens falharam",
            description: getSendErrorMessage(firstFailure),
          })
        }

        startPolling()
        // Trigger re-render after batch send
        setStatusUpdateTrigger((prev) => prev + 1)
      }

      setSelectedRows(new Set())
    } catch (error) {
      console.error("[v0] Batch send error:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro ao enviar"
      selectedRecords.forEach((record) => {
        // Iterate over selected records for error status
        setMessageStatuses((prev) => {
          const newStatuses = new Map(prev)
          newStatuses.set(record.idPaxServico, {
            status: "failed",
            error: errorMessage,
          })
          return newStatuses
        })
      })
      toast({
        variant: "destructive",
        title: "Erro no envio em lote",
        description: errorMessage,
      })
      // Trigger re-render on batch send catch error
      setStatusUpdateTrigger((prev) => prev + 1)
    } finally {
      setSendingId(null)
      setIsSending(false)
    }
  }

  const handleSendAll = async () => {
    if (!selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um template",
      })
      return
    }

    const messagesToSend = filteredData

    if (messagesToSend.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum registro para envio",
        description: "A filtragem atual não retornou registros para enviar.",
      })
      return
    }

    // Se estiver em modo teste, exigir número de teste
    if (testMode && !testPhoneNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Número de teste obrigatório no modo de teste",
      })
      return
    }

    // Verifica quantas mensagens já foram enviadas
    const alreadySentCount = messagesToSend.filter((record) => {
      const idPaxServico = String(record.idPaxServico)
      const status = messageStatuses.get(idPaxServico)
      return status && (status.status === "sent" || status.status === "delivered" || status.status === "read")
    }).length

    // Filtra mensagens baseado na configuração do tenant
    let messagesToProcess = messagesToSend
    if (resendBehavior === "skip" && alreadySentCount > 0) {
      messagesToProcess = messagesToSend.filter((record) => {
        const idPaxServico = String(record.idPaxServico)
        const status = messageStatuses.get(idPaxServico)
        return !status || !(status.status === "sent" || status.status === "delivered" || status.status === "read")
      })
    }

    // Prepara mensagem de confirmação
    let confirmTitle = ""
    let confirmDescription = ""

    if (testMode && testPhoneNumber.trim()) {
      confirmTitle = `Enviar ${messagesToProcess.length} mensagens em MODO TESTE?`
      confirmDescription = `Todas as ${messagesToProcess.length} mensagens serão enviadas para o número de teste: ${testPhoneNumber}`
    } else {
      confirmTitle = `Enviar ${messagesToProcess.length} mensagens?`
      confirmDescription = `Tem certeza que deseja enviar ${messagesToProcess.length} mensagens reais para os destinatários?`
    }

    // Adiciona aviso sobre mensagens já enviadas baseado na configuração
    if (alreadySentCount > 0) {
      if (resendBehavior === "skip") {
        confirmDescription += `\n\nℹ️ ${alreadySentCount} mensagem(ns) já foi(ram) enviada(s) anteriormente e será(ão) pulada(s) conforme a configuração.`
      } else {
        confirmDescription += `\n\n⚠️ Atenção: ${alreadySentCount} mensagem(ns) já foi(ram) enviada(s) anteriormente e será(ão) reenviada(s) conforme a configuração.`
      }
    }

    // Mostra diálogo de confirmação
    setConfirmTitle(confirmTitle)
    setConfirmMessage(confirmDescription)
    setConfirmAction(() => () => {
      setShowConfirmDialog(false)
      executeSendAll(messagesToProcess)
    })
    setShowConfirmDialog(true)
  }

  const executeSendAll = async (messagesToSend: DataRecord[]) => {
    setIsSending(true)
    let successCount = 0
    let failCount = 0
    let lastFailureError: string | null = null

    for (const record of messagesToSend) {
      const idPaxServico = String(record.idPaxServico)

      setMessageStatuses((prev) => {
        const newMap = new Map(prev)
        newMap.set(idPaxServico, { status: "sending" })
        return newMap
      })
      setStatusUpdateTrigger((prev) => prev + 1)

      try {
        const editedParams = editedFields[record.id] || {}
        const templateMapping = getTemplateMapping(selectedTemplateObj)

        const parameters = Object.entries(templateMapping).map(([paramIndex, fieldName]) => {
          const value = editedParams[fieldName] !== undefined ? editedParams[fieldName] : (record[fieldName] as string)
          return {
            type: "text",
            text: value || "-",
          }
        })

        const response = await fetch("/api/send-messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [record],
            templateId: selectedTemplate,
            tenantId: tenantId,
            userId: userId,
            // Respeita o modo teste: se ativo, API usará o número de teste em vez do número do JSON
            testMode,
            testNumber: testMode ? testPhoneNumber : undefined,
            parameters,
          }),
        })

        const result = await parseSendMessagesResponse(response)

        if (result.results && result.results[0]) {
          const sendResult = result.results[0]
          if (sendResult.success && sendResult.whatsappMessageId) {
            setMessageStatuses((prev) => {
              const newMap = new Map(prev)
              newMap.set(idPaxServico, {
                status: "sent",
                messageId: sendResult.whatsappMessageId,
              })
              return newMap
            })

            sentMessageIdsRef.current.set(idPaxServico, sendResult.whatsappMessageId)
            successCount++
          } else {
            const errorMessage = getSendErrorMessage(sendResult)
            lastFailureError = errorMessage
            setMessageStatuses((prev) => {
              const newMap = new Map(prev)
              newMap.set(idPaxServico, {
                status: "failed",
                error: errorMessage,
                errorDetails: sendResult.errorDetails || null,
              })
              return newMap
            })
            failCount++
          }
        }
      } catch (error) {
        console.error("[v0] Error sending message:", error)
        const errorMessage = error instanceof Error ? error.message : "Erro ao enviar mensagem"
        lastFailureError = errorMessage
        setMessageStatuses((prev) => {
          const newMap = new Map(prev)
          newMap.set(idPaxServico, {
            status: "failed",
            error: errorMessage,
          })
          return newMap
        })
        failCount++
      }

      setStatusUpdateTrigger((prev) => prev + 1)
    }

    setIsSending(false)

    if (!isPolling && successCount > 0) {
      startPolling()
    }

    toast({
      title: successCount > 0 ? "Concluído" : "Erro",
      description:
        failCount > 0 && lastFailureError
          ? `${successCount} enviada(s), ${failCount} falha(s). Último erro: ${lastFailureError}`
          : `${successCount} mensagens enviadas com sucesso${failCount > 0 ? `, ${failCount} falharam` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    })
  }

  // Modified startPolling to only set isPolling to true if it's not already true
  const startPollingModified = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    if (!isPolling) {
      console.log("[v0] Starting polling...")
      setIsPolling(true)
    }

    // Fetch immediately on start or restart
    fetchMessageStatuses()

    // Set interval only if it's not already running
    if (!pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(() => {
        fetchMessageStatuses()
      }, 5000)
      console.log("[v0] Polling interval set.")
    }
  }, [fetchMessageStatuses, isPolling]) // Add isPolling to dependency array

  const getStatusBadge = (record: any) => {
    if (!record.idPaxServico) return null

    const status = messageStatuses.get(String(record.idPaxServico))

    if (!status) return null

    const statusConfig = {
      sending: { label: "Enviando...", color: "bg-gray-200 text-gray-700" },
      sent: { label: "Enviada", color: "text-white", style: { backgroundColor: "#005375" } },
      delivered: { label: "Entregue", color: "text-white", style: { backgroundColor: "#53bdea" } },
      read: { label: "Lida", color: "text-white", style: { backgroundColor: "#34a868" } },
      failed: { label: "Falhou", color: "bg-red-500 text-white" },
    }

    const config = statusConfig[status.status as keyof typeof statusConfig]
    if (!config) return null

    const badge = (
      <Badge className={`text-xs ${config.color}`} style={config.style}>
        {config.label}
      </Badge>
    )

    if (status.status === "failed" && (status.error || status.errorDetails)) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">{badge}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md whitespace-pre-wrap text-xs">
              {status.error || "Falha no envio"}
              {status.errorDetails?.code != null ? `\nCódigo Meta: ${status.errorDetails.code}` : ""}
              {status.errorDetails?.errorSubcode != null
                ? `\nSubcódigo: ${status.errorDetails.errorSubcode}`
                : ""}
              {status.errorDetails?.fbtraceId ? `\nTrace: ${status.errorDetails.fbtraceId}` : ""}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return badge
  }

  const getRecipientName = (record: DataRecord): string => {
    const nameFields = ["nome", "name", "nomePax", "nome_pax", "nomeCliente", "nome_cliente", "cliente", "destinatario"]
    for (const field of nameFields) {
      if (record[field]) return String(record[field])
    }
    return "Destinatário"
  }

  const getPhoneNumber = (record: DataRecord): string => {
    return String(record.phone)
  }

  const getServiceInfo = (record: DataRecord): string => {
    const serviceFields = [
      "servico",
      "service",
      "tipoServico",
      "tipo_servico",
      "descricao",
      "parametroServico",
      "parametro_servico",
    ]
    for (const field of serviceFields) {
      if (record[field]) return String(record[field])
    }
    return "-"
  }

  const getDateInfo = (record: DataRecord): string => {
    const dateFields = [
      "data",
      "date",
      "dataPickup",
      "data_pickup",
      "dataServico",
      "data_servico",
      "dataSaida",
      "data_saida",
    ]
    for (const field of dateFields) {
      if (record[field]) return String(record[field])
    }
    return "-"
  }

  const handleViewDetail = (record: DataRecord) => {
    setSelectedRecord(record)
    setIsDetailOpen(true)
  }

  const canSearch = selectedTemplate && selectedApi && startDate && endDate

  const getParamValue = (record: DataRecord, paramNum: string, fieldName: string): string => {
    const recordKey = `${record.id}_${paramNum}`
    if (editedFields[record.id] && editedFields[record.id][fieldName]) {
      return editedFields[record.id][fieldName]
    }
    return String(record[fieldName] || "")
  }

  const handleParamChange = (record: DataRecord, paramNum: string, value: string) => {
    const recordKey = `${record.id}_${paramNum}`
    setEditedFields((prev) => ({
      ...prev,
      [record.id]: {
        ...prev[record.id],
        [paramNum]: value,
      },
    }))
  }

  useEffect(() => {
    if (apiCredentials.length > 0 && !selectedApi) {
      setSelectedApi(apiCredentials[0].id)
    }
  }, [apiCredentials, selectedApi])

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].id)
    }
  }, [templates, selectedTemplate])

  useEffect(() => {
    if (selectedTemplateObj) {
      const templateMapping = getTemplateMapping(selectedTemplateObj)
      const firstParamKey = Object.keys(templateMapping)[0]
      if (firstParamKey) {
        // Assuming the value associated with the first key in parameters_mapping is the field name in the data record
        const fieldName = templateMapping[firstParamKey]
        // Find the actual field in the data record that corresponds to this parameter
        // This is a bit of a guess, assuming 'id' is always present or can be used as a fallback
        setPrimaryKey(fieldName || "id") // Use fieldName if available, otherwise fallback to 'id'
      } else {
        setPrimaryKey("id") // Default to 'id' if no parameters are mapped
      }
    }
  }, [selectedTemplateObj])

  const handleFilterChange = (filterType: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const current = prev[filterType]
      // Toggle value: remove if exists, add if not
      const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      return { ...prev, [filterType]: newValues }
    })
  }

  const removeFilter = (filterType: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].filter((v) => v !== value),
    }))
  }

  // Added cliente and evento to clearFilters
  const clearFilters = () => {
    setFilters({
      parametroServico: [],
      categoriaServico: [],
      servico: [],
      idOrdemServico: [],
      idFile: [],
      cliente: [],
      evento: [],
      origem: [],
      destino: [],
      idioma: [],
      status: [],
    })
  }

  const hasActiveFilters =
    filters.parametroServico.length > 0 ||
    filters.categoriaServico.length > 0 ||
    filters.servico.length > 0 ||
    filters.idOrdemServico.length > 0 ||
    filters.idFile.length > 0 ||
    filters.cliente.length > 0 ||
    filters.evento.length > 0 ||
    filters.origem.length > 0 ||
    filters.destino.length > 0 ||
    filters.idioma.length > 0 ||
    filters.status.length > 0

  const getRecordStatus = (record: DataRecord): string => {
    const idPaxServico = String(record.idPaxServico || "")
    const mapStatus = messageStatuses.get(idPaxServico)?.status
    const rowStatus = record.messageStatus ? String((record.messageStatus as any).status || "") : ""
    return String(mapStatus || rowStatus || "")
  }

  const filteredData = data.filter((record) => {
    if (filters.parametroServico.length > 0 && !filters.parametroServico.includes(record.parametroServico || "")) {
      return false
    }
    if (
      filters.categoriaServico.length > 0 &&
      !filters.categoriaServico.includes(String(record.categoriaServico || record.tipoServico || ""))
    ) {
      return false
    }
    if (filters.servico.length > 0 && !filters.servico.includes(record.servico || "")) {
      return false
    }
    if (filters.idOrdemServico.length > 0 && !filters.idOrdemServico.includes(String(record.idOrdemServico || ""))) {
      return false
    }
    if (filters.idFile.length > 0 && !filters.idFile.includes(String(record.idFile || ""))) {
      return false
    }
    if (filters.cliente.length > 0 && !filters.cliente.includes(record.empresa || "")) {
      return false
    }
    if (filters.evento.length > 0 && !filters.evento.includes(record.evento || "")) {
      return false
    }
    if (filters.origem.length > 0 && !filters.origem.includes(record.origem || "")) {
      return false
    }
    if (filters.destino.length > 0 && !filters.destino.includes(record.destino || "")) {
      return false
    }
    if (filters.idioma.length > 0 && !filters.idioma.includes(record.idioma || "")) {
      return false
    }
    if (filters.status.length > 0 && !filters.status.includes(getRecordStatus(record))) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg">API WhatsApp</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Busque destinatários e envie mensagens usando templates do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-2xl">
            <div className="grid gap-2">
              <Label htmlFor="template">Template *</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={disabled}>
                <SelectTrigger id="template" className="text-base w-full">
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canSelectApi ? (
              <div className="grid gap-2">
                <Label htmlFor="api-data">API de Dados *</Label>
                <Select value={selectedApi} onValueChange={setSelectedApi} disabled={disabled || apiCredentials.length === 0}>
                  <SelectTrigger id="api-data" className="text-base w-full">
                    <SelectValue placeholder="Selecione a API de dados" />
                  </SelectTrigger>
                  <SelectContent>
                    {apiCredentials.map((credential) => (
                      <SelectItem key={credential.id} value={credential.id}>
                        {credential.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {apiCredentials.length === 0 && (
                  <p className="text-xs sm:text-sm text-destructive">
                    Nenhuma API de dados cadastrada para esta empresa.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>API de Dados</Label>
                <div className="h-10 px-3 rounded-md border bg-muted/30 text-sm flex items-center">
                  {selectedApiObj?.name || "API padrão"}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Data Início *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={disabled}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Data Fim *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                disabled={disabled}
                className="text-base"
              />
              {endDate && startDate && endDate < startDate && (
                <p className="text-xs sm:text-sm text-destructive">Data fim não pode ser anterior à data início</p>
              )}
            </div>
            <div className="flex items-end">
              <Button onClick={fetchData} disabled={!canSearch || isLoading || disabled} className="w-full h-11 sm:h-10">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </div>
          {/* Removed preview of template that was below the dates */}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg sm:text-xl">Resultados da Pesquisa</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterOpen((v) => !v)}
                  className="relative"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {isFilterOpen ? "Ocultar filtros" : "Mostrar filtros"}
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center">
                      {Object.values(filters).reduce((acc, f) => acc + f.length, 0)}
                    </span>
                  )}
                  {isFilterOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>
                <Button
                  onClick={handleSendAll}
                  disabled={isSending || !selectedTemplate || filteredData.length === 0}
                  variant="default"
                  className="h-9 px-4 py-2"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      Enviar Todas {hasActiveFilters && `(${filteredData.length})`}
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Label htmlFor="test-mode" className="text-sm whitespace-nowrap">
                    Modo Teste
                  </Label>
                  <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} />
                </div>
                {testMode && (
                  <Input
                    placeholder="Número de teste"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="w-full sm:w-40 text-base"
                  />
                )}
              </div>
            </div>
            <CardDescription className="text-sm sm:text-base">
              {filteredData.length} de {data.length} {data.length === 1 ? "registro" : "registros"}
              {hasActiveFilters && " (filtrado)"}
              {selectedApiObj?.name && ` • API: ${selectedApiObj.name}`}
            </CardDescription>
          </CardHeader>
          {isFilterOpen && (
            <div className="px-6 pb-4 border-b space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Refine os resultados pelos filtros abaixo. Digite nos campos para buscar.</p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Limpar todos
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableFilters.parametroServico.length > 0 && (
                  <FilterCombobox
                    label="Parâmetro Serviço"
                    options={availableFilters.parametroServico}
                    selected={filters.parametroServico}
                    onToggle={(value) => handleFilterChange("parametroServico", value)}
                    onRemove={(value) => removeFilter("parametroServico", value)}
                    placeholder="Selecione um parâmetro..."
                  />
                )}
                {availableFilters.categoriaServico.length > 0 && (
                  <FilterCombobox
                    label="Categoria Serviço"
                    options={availableFilters.categoriaServico}
                    selected={filters.categoriaServico}
                    onToggle={(value) => handleFilterChange("categoriaServico", value)}
                    onRemove={(value) => removeFilter("categoriaServico", value)}
                    placeholder="Selecione uma categoria..."
                  />
                )}
                {availableFilters.servico.length > 0 && (
                  <FilterCombobox
                    label="Serviço"
                    options={availableFilters.servico}
                    selected={filters.servico}
                    onToggle={(value) => handleFilterChange("servico", value)}
                    onRemove={(value) => removeFilter("servico", value)}
                    placeholder="Selecione um serviço..."
                  />
                )}
                {availableFilters.idOrdemServico.length > 0 && (
                  <FilterCombobox
                    label="Ordem Serviço"
                    options={availableFilters.idOrdemServico}
                    selected={filters.idOrdemServico}
                    onToggle={(value) => handleFilterChange("idOrdemServico", value)}
                    onRemove={(value) => removeFilter("idOrdemServico", value)}
                    placeholder="Selecione uma ordem..."
                  />
                )}
                {availableFilters.idFile.length > 0 && (
                  <FilterCombobox
                    label="File"
                    options={availableFilters.idFile}
                    selected={filters.idFile}
                    onToggle={(value) => handleFilterChange("idFile", value)}
                    onRemove={(value) => removeFilter("idFile", value)}
                    placeholder="Selecione um file..."
                  />
                )}
                {availableFilters.cliente.length > 0 && (
                  <FilterCombobox
                    label="Cliente"
                    options={availableFilters.cliente}
                    selected={filters.cliente}
                    onToggle={(value) => handleFilterChange("cliente", value)}
                    onRemove={(value) => removeFilter("cliente", value)}
                    placeholder="Selecione um cliente..."
                  />
                )}
                {availableFilters.evento.length > 0 && (
                  <FilterCombobox
                    label="Evento"
                    options={availableFilters.evento}
                    selected={filters.evento}
                    onToggle={(value) => handleFilterChange("evento", value)}
                    onRemove={(value) => removeFilter("evento", value)}
                    placeholder="Selecione um evento..."
                  />
                )}
                {availableFilters.origem.length > 0 && (
                  <FilterCombobox
                    label="Origem"
                    options={availableFilters.origem}
                    selected={filters.origem}
                    onToggle={(value) => handleFilterChange("origem", value)}
                    onRemove={(value) => removeFilter("origem", value)}
                    placeholder="Selecione uma origem..."
                  />
                )}
                {availableFilters.destino.length > 0 && (
                  <FilterCombobox
                    label="Destino"
                    options={availableFilters.destino}
                    selected={filters.destino}
                    onToggle={(value) => handleFilterChange("destino", value)}
                    onRemove={(value) => removeFilter("destino", value)}
                    placeholder="Selecione um destino..."
                  />
                )}
                {availableFilters.idioma.length > 0 && (
                  <FilterCombobox
                    label="Idioma"
                    options={availableFilters.idioma}
                    selected={filters.idioma}
                    onToggle={(value) => handleFilterChange("idioma", value)}
                    onRemove={(value) => removeFilter("idioma", value)}
                    placeholder="Selecione um idioma..."
                  />
                )}
                {availableFilters.status.length > 0 && (
                  <FilterCombobox
                    label="Status"
                    options={availableFilters.status}
                    selected={filters.status}
                    onToggle={(value) => handleFilterChange("status", value)}
                    onRemove={(value) => removeFilter("status", value)}
                    placeholder="Selecione um status..."
                  />
                )}
              </div>
            </div>
          )}
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-full inline-block align-middle">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sm:w-12">
                      <Checkbox
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">File</TableHead>
                    <TableHead className="whitespace-nowrap">Pax</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">Telefone</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Categoria Serviço</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Serviço</TableHead>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell className="p-2 sm:p-4">
                        <Checkbox
                          checked={selectedRows.has(index)}
                          onCheckedChange={(checked) => handleRowSelect(index, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium p-2 sm:p-4">{record.idFile || "-"}</TableCell>
                      <TableCell className="font-medium p-2 sm:p-4 max-w-[100px] sm:max-w-none truncate">
                        {record.nomePax || "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-2 sm:p-4">{getPhoneNumber(record)}</TableCell>
                      <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                        {String(record.categoriaServico || record.tipoServico || "-")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-2 sm:p-4">{getServiceInfo(record)}</TableCell>
                      <TableCell className="p-2 sm:p-4 whitespace-nowrap">{getDateInfo(record)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{getStatusBadge(record)}</TableCell>
                      <TableCell className="text-right p-2 sm:p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(record)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendSingle(record)}
                            disabled={sendingId === data.indexOf(record) || (testMode && !testPhoneNumber.trim())}
                            className="h-8 w-8 p-0"
                          >
                            {sendingId === data.indexOf(record) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950">
          <p className="text-sm text-green-700 dark:text-green-300">
            Envio concluído: {result.success} enviado(s), {result.failed} falha(s)
          </p>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Detalhes da Mensagem</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 overflow-y-auto">
            {selectedRecord && (
              <div className="space-y-4 pr-4 pb-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Informações do Destinatário</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Nome</p>
                        <p className="text-sm font-medium truncate">{getRecipientName(selectedRecord)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium">{getPhoneNumber(selectedRecord)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Serviço</p>
                        <p className="text-sm font-medium truncate">{getServiceInfo(selectedRecord)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Data</p>
                        <p className="text-sm font-medium">{getDateInfo(selectedRecord)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Removed Card for "Edit Message Fields" */}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Prévia da Mensagem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg bg-[#e7fed5] p-3 text-sm whitespace-pre-wrap wrap-break-word dark:bg-[#025c4c] dark:text-white">
                      {buildPreviewMessage(selectedRecord, true)}
                    </div>
                    {testMode && (
                      <p className="text-xs text-amber-600 mt-2">
                        Modo teste ativo: será enviado para {testPhoneNumber || "(número não informado)"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="shrink-0 mt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fechar
            </Button>
            {selectedRecord && (
              <Button
                onClick={() => handleSendSingle(selectedRecord)}
                disabled={sendingId === data.indexOf(selectedRecord) || (testMode && !testPhoneNumber.trim())}
              >
                {sendingId === data.indexOf(selectedRecord) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviar
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para Enviar Todas */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle || "Confirmar Envio"}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction || undefined}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para reenvio individual */}
      <AlertDialog open={showResendDialog} onOpenChange={setShowResendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mensagem já enviada</AlertDialogTitle>
            <AlertDialogDescription>
              Esta mensagem já foi enviada anteriormente. Deseja reenviá-la?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resendAction || undefined}>
              Reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
