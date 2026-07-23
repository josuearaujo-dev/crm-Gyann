"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Send, Loader2, Filter, X, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import type { ApiCredential, MktzapTemplate } from "@/lib/types"

interface MktzapSendMessagesFormProps {
  apiCredentials: ApiCredential[]
  templates: MktzapTemplate[]
  tenantId: string | null
  disabled: boolean
  canSelectApi?: boolean
}

interface DataRecord {
  id: string | number
  phone: string
  nomePax?: string
  servico?: string
  categoriaServico?: string
  parametro?: string
  tipoServico?: string
  parametroServico?: string
  dataPickup?: string
  idPaxServico?: string | number
  [key: string]: unknown
}

interface SendResultItem {
  id: string | number | null
  success: boolean
  error?: string | null
  ddiMissing?: boolean
  statusKey?: string
  idPaxServico?: string | null
  idFile?: string | null
  serviceDate?: string | null
  mktzapMessageId?: string | null
  protocol?: string | null
  response?: Record<string, unknown> | null
}

interface RowSendDetail {
  success: boolean
  error?: string | null
  ddiMissing?: boolean
  mktzapMessageId?: string | null
  protocol?: string | null
  response?: Record<string, unknown> | null
}

function formatMessageForDisplay(text: string): string {
  if (!text) return ""
  try {
    const decoded = JSON.parse(`"${text.replace(/"/g, '\\"')}"`) as string
    return decoded
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\s+\?/g, "?")
      .trim()
  } catch {
    return text
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\s+\?/g, "?")
      .trim()
  }
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
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
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
                <CommandItem key={value} value={value} onSelect={() => onToggle(value)}>
                  <span className="flex-1 truncate">{value}</span>
                  {selected.includes(value) && <span className="text-primary text-xs">✓</span>}
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
              className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs flex items-center gap-1"
            >
              <span className="truncate max-w-[180px]">{value}</span>
              <button type="button" onClick={() => onRemove(value)} className="hover:bg-primary/20 rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MktzapSendMessagesForm({
  apiCredentials,
  templates,
  tenantId,
  disabled,
  canSelectApi = true,
}: MktzapSendMessagesFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [selectedApi, setSelectedApi] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingAll, setIsSendingAll] = useState(false)
  const [sendingRow, setSendingRow] = useState<number | null>(null)
  const [data, setData] = useState<DataRecord[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, "sent" | "failed">>({})
  const [sendDetailsMap, setSendDetailsMap] = useState<Record<string, RowSendDetail>>({})
  const [detailRecord, setDetailRecord] = useState<DataRecord | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showConfirmSendAll, setShowConfirmSendAll] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [phoneTab, setPhoneTab] = useState<"with_phone" | "missing_phone">("with_phone")
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({})
  const [filters, setFilters] = useState({
    idFile: [] as string[],
    nomePax: [] as string[],
    servico: [] as string[],
    categoriaServico: [] as string[],
    parametro: [] as string[],
    cliente: [] as string[],
    origem: [] as string[],
    destino: [] as string[],
    idioma: [] as string[],
    idDepartamento: [] as string[],
    idCanal: [] as string[],
  })

  const mappedTemplates = useMemo(() => {
    return templates.filter((template) => {
      const mapping = template.parameter_mapping || {}
      return Object.keys(mapping).length > 0 && !!template.is_active
    })
  }, [templates])

  const selectedTemplateObj = useMemo(
    () => mappedTemplates.find((template) => template.id === selectedTemplate),
    [mappedTemplates, selectedTemplate],
  )
  const selectedApiObj = useMemo(() => apiCredentials.find((api) => api.id === selectedApi), [apiCredentials, selectedApi])

  useEffect(() => {
    if (mappedTemplates.length === 0) {
      setSelectedTemplate("")
      return
    }
    const stillExists = mappedTemplates.some((template) => template.id === selectedTemplate)
    if (!stillExists) {
      setSelectedTemplate(mappedTemplates[0].id)
    }
  }, [mappedTemplates, selectedTemplate])

  useEffect(() => {
    if (!selectedTemplateObj) {
      setDynamicValues({})
      return
    }
    const flags = selectedTemplateObj.dynamic_parameter_flags || {}
    const next: Record<string, string> = {}
    Object.keys(flags)
      .filter((key) => flags[key])
      .forEach((key) => {
        next[key] = ""
      })
    setDynamicValues(next)
  }, [selectedTemplateObj])

  useEffect(() => {
    if (apiCredentials.length > 0 && !selectedApi) {
      setSelectedApi(apiCredentials[0].id)
    }
  }, [apiCredentials, selectedApi])

  const canSearch = !!selectedTemplate && !!selectedApi && !!startDate && !!endDate && !disabled
  const canSend = !!selectedTemplateObj && !!tenantId && !disabled

  const getRowId = (record: DataRecord) => String(record.idPaxServico || record.id)
  const getStatusKey = (record: DataRecord) => getRowId(record) || "NO_ID_PAX_SERVICO"

  const getPhoneValue = (record: DataRecord) =>
    String(record.phone || record.telefone || record.celular || record.whatsapp || record.fone || "").trim()

  const hasPhone = (record: DataRecord) => getPhoneValue(record).length > 0

  const compareRecords = (a: DataRecord, b: DataRecord) => {
    const idFileA = String(a.idFile || "").trim()
    const idFileB = String(b.idFile || "").trim()
    const idFileNumericA = Number(idFileA)
    const idFileNumericB = Number(idFileB)

    const bothNumeric = Number.isFinite(idFileNumericA) && Number.isFinite(idFileNumericB)
    if (bothNumeric && idFileNumericA !== idFileNumericB) {
      return idFileNumericA - idFileNumericB
    }
    if (idFileA !== idFileB) {
      return idFileA.localeCompare(idFileB, "pt-BR", { sensitivity: "base" })
    }

    const nomeA = String(a.nomePax || a.name || "").trim()
    const nomeB = String(b.nomePax || b.name || "").trim()
    return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" })
  }

  const buildMessagePreview = (record: DataRecord) => {
    if (!selectedTemplateObj) return "Template não selecionado"
    let preview = selectedTemplateObj.template || ""
    const mapping = selectedTemplateObj.parameter_mapping || {}
    const dynamicFlags = selectedTemplateObj.dynamic_parameter_flags || {}
    Object.keys(mapping)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((paramKey) => {
        const field = mapping[paramKey]
        const dynamicValue = String(dynamicValues[paramKey] ?? "").trim()
        const value = dynamicFlags[paramKey] ? (dynamicValue || `[dinâmico {{${paramKey}}}]`) : String(record[field] ?? "-")
        preview = preview.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), value)
      })
    return preview
  }

  const dynamicVariableKeys = useMemo(() => {
    const flags = selectedTemplateObj?.dynamic_parameter_flags || {}
    return Object.keys(flags)
      .filter((key) => flags[key])
      .sort((a, b) => Number(a) - Number(b))
  }, [selectedTemplateObj])

  const availableFilters = useMemo(() => {
    const unique = <T,>(values: T[]) => [...new Set(values)]
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" })
    const byText = (a: string, b: string) => collator.compare(a, b)

    const idFile = unique(data.map((record) => String(record.idFile || "").trim()).filter(Boolean))
    const nomePax = unique(data.map((record) => String(record.nomePax || record.name || "").trim()).filter(Boolean))
    const servico = unique(
      data.map((record) => String(record.servico || "").trim()).filter(Boolean),
    )
    const categoriaServico = unique(
      data.map((record) => String(record.categoriaServico || record.tipoServico || "").trim()).filter(Boolean),
    )
    const parametro = unique(
      data.map((record) => String(record.parametro || record.parametroServico || "").trim()).filter(Boolean),
    )
    const cliente = unique(
      data.map((record) => String(record.cliente ?? "").trim()).filter(Boolean),
    )
    const origem = unique(
      data.map((record) => String(record.origem ?? "").trim()).filter(Boolean),
    )
    const destino = unique(
      data.map((record) => String(record.destino ?? "").trim()).filter(Boolean),
    )
    const idioma = unique(
      data.map((record) => String(record.idioma ?? "").trim()).filter(Boolean),
    )
    // Mapeia departamento -> idDepartamento e canal -> idCanal para mostrar valores legíveis mas filtrar por IDs
    const departamentoMap = new Map<string, string>()
    const canalMap = new Map<string, string>()
    data.forEach((record) => {
      const dept = String(record.departamento ?? "").trim()
      const deptId = String(record.idDepartamento ?? "").trim()
      if (dept && deptId) {
        departamentoMap.set(dept, deptId)
      }
      const canal = String(record.canal ?? "").trim()
      const canalId = String(record.idCanal ?? "").trim()
      if (canal && canalId) {
        canalMap.set(canal, canalId)
      }
    })
    const departamento = Array.from(departamentoMap.keys())
    const canal = Array.from(canalMap.keys())

    return {
      idFile: idFile.sort(byText),
      nomePax: nomePax.sort(byText),
      servico: servico.sort(byText),
      categoriaServico: categoriaServico.sort(byText),
      parametro: parametro.sort(byText),
      cliente: cliente.sort(byText),
      origem: origem.sort(byText),
      destino: destino.sort(byText),
      idioma: idioma.sort(byText),
      departamento: departamento.sort(byText),
      canal: canal.sort(byText),
      departamentoMap,
      canalMap,
    }
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter((record) => {
      const idFile = String(record.idFile || "").trim()
      const nomePax = String(record.nomePax || record.name || "").trim()
      const servico = String(record.servico || "").trim()
      const categoriaServico = String(record.categoriaServico || record.tipoServico || "").trim()
      const parametro = String(record.parametro || record.parametroServico || "").trim()
      const cliente = String(record.cliente ?? "").trim()
      const origem = String(record.origem ?? "").trim()
      const destino = String(record.destino ?? "").trim()
      const idioma = String(record.idioma ?? "").trim()
      const idDepartamento = String(record.idDepartamento ?? "").trim()
      const idCanal = String(record.idCanal ?? "").trim()

      const passIdFile = filters.idFile.length === 0 || filters.idFile.includes(idFile)
      const passNome = filters.nomePax.length === 0 || filters.nomePax.includes(nomePax)
      const passServico = filters.servico.length === 0 || filters.servico.includes(servico)
      const passCategoriaServico =
        filters.categoriaServico.length === 0 || filters.categoriaServico.includes(categoriaServico)
      const passParametro = filters.parametro.length === 0 || filters.parametro.includes(parametro)
      const passCliente = filters.cliente.length === 0 || filters.cliente.includes(cliente)
      const passOrigem = filters.origem.length === 0 || filters.origem.includes(origem)
      const passDestino = filters.destino.length === 0 || filters.destino.includes(destino)
      const passIdioma = filters.idioma.length === 0 || filters.idioma.includes(idioma)
      const passIdDepartamento = filters.idDepartamento.length === 0 || filters.idDepartamento.includes(idDepartamento)
      const passIdCanal = filters.idCanal.length === 0 || filters.idCanal.includes(idCanal)

      return (
        passIdFile &&
        passNome &&
        passServico &&
        passCategoriaServico &&
        passParametro &&
        passCliente &&
        passOrigem &&
        passDestino &&
        passIdioma &&
        passIdDepartamento &&
        passIdCanal
      )
    })
  }, [data, filters])

  const withPhoneData = useMemo(() => filteredData.filter((record) => hasPhone(record)), [filteredData])
  const missingPhoneData = useMemo(() => filteredData.filter((record) => !hasPhone(record)), [filteredData])
  const visibleData = phoneTab === "with_phone" ? withPhoneData : missingPhoneData

  const getSortValue = (record: DataRecord, column: string): string | number => {
    switch (column) {
      case "idFile":
        return String(record.idFile ?? "")
      case "nome":
        return String(record.nomePax ?? record.name ?? "")
      case "telefone":
        return getPhoneValue(record)
      case "ddi":
        return String(record.ddi ?? "")
      case "servico":
        return String(record.servico ?? record.parametroServico ?? "")
      case "categoriaServico":
        return String(record.categoriaServico ?? record.tipoServico ?? "")
      case "parametro":
        return String(record.parametro ?? record.parametroServico ?? "")
      case "voo":
        return String(record.voo ?? "")
      case "data":
        return String(record.dataPickup ?? "")
      case "horaPickup":
        return String(record.horaPickup ?? "")
      case "horaServico":
        return String(record.horaServico ?? "")
      default:
        return ""
    }
  }

  const sortedVisibleData = useMemo(() => {
    if (!sortColumn) return visibleData
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true })
    return [...visibleData].sort((a, b) => {
      const valA = getSortValue(a, sortColumn)
      const valB = getSortValue(b, sortColumn)
      const cmp = typeof valA === "number" && typeof valB === "number"
        ? valA - valB
        : collator.compare(String(valA), String(valB))
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [visibleData, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const SortableHead = ({ column, label }: { column: string; label: string }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
      >
        {label}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </TableHead>
  )

  const toggleFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const values = prev[key]
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      return { ...prev, [key]: nextValues }
    })
  }

  const removeFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key].filter((item) => item !== value) }))
  }

  const clearAllFilters = () => {
    setFilters({
      idFile: [],
      nomePax: [],
      servico: [],
      categoriaServico: [],
      parametro: [],
      cliente: [],
      origem: [],
      destino: [],
      idioma: [],
      idDepartamento: [],
      idCanal: [],
    })
  }

  const toggleDepartamentoFilter = (departamentoValue: string) => {
    const deptId = availableFilters.departamentoMap?.get(departamentoValue)
    if (!deptId) return
    setFilters((prev) => {
      const values = prev.idDepartamento
      const nextValues = values.includes(deptId) ? values.filter((item) => item !== deptId) : [...values, deptId]
      return { ...prev, idDepartamento: nextValues }
    })
  }

  const removeDepartamentoFilter = (departamentoValue: string) => {
    const deptId = availableFilters.departamentoMap?.get(departamentoValue)
    if (!deptId) return
    setFilters((prev) => ({ ...prev, idDepartamento: prev.idDepartamento.filter((item) => item !== deptId) }))
  }

  const toggleCanalFilter = (canalValue: string) => {
    const canalId = availableFilters.canalMap?.get(canalValue)
    if (!canalId) return
    setFilters((prev) => {
      const values = prev.idCanal
      const nextValues = values.includes(canalId) ? values.filter((item) => item !== canalId) : [...values, canalId]
      return { ...prev, idCanal: nextValues }
    })
  }

  const removeCanalFilter = (canalValue: string) => {
    const canalId = availableFilters.canalMap?.get(canalValue)
    if (!canalId) return
    setFilters((prev) => ({ ...prev, idCanal: prev.idCanal.filter((item) => item !== canalId) }))
  }

  const getSelectedDepartamentos = () => {
    if (!availableFilters.departamentoMap) return []
    return Array.from(availableFilters.departamentoMap.entries())
      .filter(([_, id]) => filters.idDepartamento.includes(id))
      .map(([dept, _]) => dept)
  }

  const getSelectedCanais = () => {
    if (!availableFilters.canalMap) return []
    return Array.from(availableFilters.canalMap.entries())
      .filter(([_, id]) => filters.idCanal.includes(id))
      .map(([canal, _]) => canal)
  }

  const fetchData = async () => {
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
        description: "Selecione API, data início e data fim.",
      })
      return
    }
    if (endDate < startDate) {
      toast({
        variant: "destructive",
        title: "Período inválido",
        description: "A data fim não pode ser anterior à data início.",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/fetch-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiCredentialId: selectedApi,
          startDate,
          endDate,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Erro ao buscar dados")
      }
      const rawRecords = (json.data || []) as DataRecord[]
      const recordsToUse = selectedTemplateObj?.is_passeio
        ? rawRecords.filter(
            (record) => String(record.parametroServico || "").trim().toUpperCase() === "PASSEIO",
          )
        : rawRecords.filter(
            (record) => String(record.parametroServico || "").trim().toUpperCase() !== "PASSEIO",
          )

      const records = recordsToUse.sort(compareRecords)
      setData(records)
      setStatusMap({})
      setSendDetailsMap({})

      const idPaxServicosToCheck = [...new Set(records.map((record) => String(record.idPaxServico || record.id || "").trim()).filter(Boolean))]
      if (selectedTemplateObj && idPaxServicosToCheck.length > 0) {
        const statusResponse = await fetch("/api/mktzap-check-message-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateObj.id,
            tenantId,
            idPaxServicos: idPaxServicosToCheck,
          }),
        })

        if (statusResponse.ok) {
          const statusJson = await statusResponse.json()
          const statuses = (statusJson.statuses || {}) as Record<string, { status: string }>
          if (Object.keys(statuses).length > 0) {
            setStatusMap((prev) => {
              const next = { ...prev }
              records.forEach((record) => {
                const key = getStatusKey(record)
                if (statuses[key]?.status === "sent") {
                  next[key] = "sent"
                }
              })
              return next
            })
          }
        }
      }

      toast({
        title: "Dados carregados",
        description: selectedTemplateObj?.is_passeio
          ? `${records.length} registro(s) encontrado(s) com parametroServico = PASSEIO.`
          : `${records.length} registro(s) encontrado(s), excluindo parametroServico = PASSEIO.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha na busca",
        description: error instanceof Error ? error.message : "Erro ao buscar dados",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const applySendResult = (items: SendResultItem[]) => {
    setStatusMap((prev) => {
      const next = { ...prev }
      items.forEach((item) => {
        if (!item.statusKey) return
        next[item.statusKey] = item.success ? "sent" : "failed"
      })
      return next
    })

    setSendDetailsMap((prev) => {
      const next = { ...prev }
      items.forEach((item) => {
        if (item.id === null || item.id === undefined) return
        next[String(item.id)] = {
          success: item.success,
          error: item.error,
          ddiMissing: item.ddiMissing,
          mktzapMessageId: item.mktzapMessageId,
          protocol: item.protocol,
          response: item.response,
        }
      })
      return next
    })
  }

  const sendRecords = async (records: DataRecord[]) => {
    if (!canSend || !selectedTemplateObj || !tenantId) {
      throw new Error("Configuração incompleta para envio MKTZAP")
    }
    if (!selectedTemplateObj.broker_phone) {
      throw new Error("Template sem broker_phone configurado")
    }
    const missingDynamic = dynamicVariableKeys.filter((key) => !String(dynamicValues[key] || "").trim())
    if (missingDynamic.length > 0) {
      throw new Error(`Preencha os campos dinâmicos: {{${missingDynamic.join("}}, {{")}}}`)
    }

    const response = await fetch("/api/mktzap-send-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedTemplateObj.id,
        tenantId,
        records,
        dynamicValues,
      }),
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json.error || "Erro ao enviar mensagem")
    }
    return json as { success: number; failed: number; results: SendResultItem[] }
  }

  const handleSendOne = async (record: DataRecord, index: number) => {
    if (!hasPhone(record)) {
      toast({
        variant: "destructive",
        title: "Telefone ausente",
        description: "Esse registro não possui telefone e não pode ser enviado.",
      })
      return
    }
    try {
      setSendingRow(index)
      const result = await sendRecords([record])
      applySendResult(result.results || [])
      toast({
        title: result.failed > 0 ? "Envio com falha" : "Mensagem enviada",
        description: result.failed > 0 ? result.results?.[0]?.error || "Falha no envio" : "Mensagem enviada com sucesso.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha no envio",
        description: error instanceof Error ? error.message : "Não foi possível enviar",
      })
    } finally {
      setSendingRow(null)
    }
  }

  const BATCH_SIZE = 20

  const handleSendAll = async () => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "Sem registros",
        description: "Busque os dados antes de enviar.",
      })
      return
    }

    const sendableRecords = visibleData.filter((record) => hasPhone(record))
    const skipped = visibleData.length - sendableRecords.length
    if (sendableRecords.length === 0) {
      toast({
        variant: "destructive",
        title: "Sem registros com telefone",
        description: "A aba atual não possui registros com telefone para envio.",
      })
      return
    }

    setIsSendingAll(true)
    setSendProgress({ sent: 0, total: sendableRecords.length })

    let totalSuccess = 0
    let totalFailed = 0

    try {
      for (let i = 0; i < sendableRecords.length; i += BATCH_SIZE) {
        const batch = sendableRecords.slice(i, i + BATCH_SIZE)
        const result = await sendRecords(batch)
        applySendResult(result.results || [])
        totalSuccess += result.success ?? 0
        totalFailed += result.failed ?? 0
        setSendProgress({ sent: Math.min(i + batch.length, sendableRecords.length), total: sendableRecords.length })
      }
      toast({
        title: "Envio concluído",
        description:
          skipped > 0
            ? `${totalSuccess} enviada(s), ${totalFailed} falha(s), ${skipped} sem telefone.`
            : `${totalSuccess} enviada(s), ${totalFailed} falha(s).`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha no envio em lote",
        description: error instanceof Error ? error.message : "Não foi possível enviar todas",
      })
    } finally {
      setIsSendingAll(false)
      setSendProgress(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Template MKTZAP</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o template" />
            </SelectTrigger>
            <SelectContent>
              {mappedTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>API de Dados</Label>
          {canSelectApi ? (
            <Select value={selectedApi} onValueChange={setSelectedApi} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a API" />
              </SelectTrigger>
              <SelectContent>
                {apiCredentials.map((api) => (
                  <SelectItem key={api.id} value={api.id}>
                    {api.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 px-3 rounded-md border bg-muted/30 text-sm flex items-center">
              {selectedApiObj?.name || "API padrão"}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Data início</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={disabled} />
        </div>

        <div className="space-y-2">
          <Label>Data fim</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={fetchData} disabled={!canSearch || isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Buscar
        </Button>
        <Button variant="outline" onClick={() => setIsFilterOpen((prev) => !prev)} disabled={data.length === 0}>
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
        <div className="ml-6 border-l pl-4 flex items-center gap-2">
          <Button
            onClick={() => setShowConfirmSendAll(true)}
            disabled={!canSend || visibleData.length === 0 || isSendingAll || phoneTab === "missing_phone"}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isSendingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar Todas
          </Button>
          {isSendingAll && sendProgress && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {sendProgress.sent}/{sendProgress.total}
            </span>
          )}
        </div>
        {mappedTemplates.length === 0 && (
          <Badge variant="destructive">Nenhum template mapeado disponível</Badge>
        )}
        {selectedTemplateObj?.broker_phone ? (
          <Badge variant="secondary">broker_phone: {selectedTemplateObj.broker_phone}</Badge>
        ) : (
          <Badge variant="destructive">Template sem broker_phone</Badge>
        )}
        {selectedTemplateObj?.is_passeio && (
          <Badge variant="outline">Filtro automático: parametroServico = PASSEIO</Badge>
        )}
        {dynamicVariableKeys.length > 0 && (
          <Badge variant="secondary">Campos dinâmicos: {dynamicVariableKeys.length}</Badge>
        )}
      </div>

      {dynamicVariableKeys.length > 0 && (
        <div className="rounded-md border p-4 space-y-3">
          <p className="text-sm font-medium">Campos dinâmicos do template</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dynamicVariableKeys.map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`dynamic-${key}`}>{`{{${key}}}`}</Label>
                <Input
                  id={`dynamic-${key}`}
                  value={dynamicValues[key] || ""}
                  onChange={(event) =>
                    setDynamicValues((prev) => ({
                      ...prev,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={`Informe o valor de {{${key}}}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isFilterOpen && (
        <div className="rounded-md border p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FilterCombobox
              label="ID FILE"
              options={availableFilters.idFile}
              selected={filters.idFile}
              onToggle={(value) => toggleFilter("idFile", value)}
              onRemove={(value) => removeFilter("idFile", value)}
              placeholder="Filtrar por ID FILE"
            />
            <FilterCombobox
              label="Nome"
              options={availableFilters.nomePax}
              selected={filters.nomePax}
              onToggle={(value) => toggleFilter("nomePax", value)}
              onRemove={(value) => removeFilter("nomePax", value)}
              placeholder="Filtrar por nome"
            />
            <FilterCombobox
              label="Serviço"
              options={availableFilters.servico}
              selected={filters.servico}
              onToggle={(value) => toggleFilter("servico", value)}
              onRemove={(value) => removeFilter("servico", value)}
              placeholder="Filtrar por serviço"
            />
            <FilterCombobox
              label="Categoria Serviço"
              options={availableFilters.categoriaServico}
              selected={filters.categoriaServico}
              onToggle={(value) => toggleFilter("categoriaServico", value)}
              onRemove={(value) => removeFilter("categoriaServico", value)}
              placeholder="Filtrar por categoria serviço"
            />
            <FilterCombobox
              label="Parâmetro"
              options={availableFilters.parametro}
              selected={filters.parametro}
              onToggle={(value) => toggleFilter("parametro", value)}
              onRemove={(value) => removeFilter("parametro", value)}
              placeholder="Filtrar por parâmetro"
            />
            <FilterCombobox
              label="Cliente"
              options={availableFilters.cliente}
              selected={filters.cliente}
              onToggle={(value) => toggleFilter("cliente", value)}
              onRemove={(value) => removeFilter("cliente", value)}
              placeholder="Filtrar por cliente"
            />
            <FilterCombobox
              label="Origem"
              options={availableFilters.origem}
              selected={filters.origem}
              onToggle={(value) => toggleFilter("origem", value)}
              onRemove={(value) => removeFilter("origem", value)}
              placeholder="Filtrar por origem"
            />
            <FilterCombobox
              label="Destino"
              options={availableFilters.destino}
              selected={filters.destino}
              onToggle={(value) => toggleFilter("destino", value)}
              onRemove={(value) => removeFilter("destino", value)}
              placeholder="Filtrar por destino"
            />
            <FilterCombobox
              label="Idioma"
              options={availableFilters.idioma}
              selected={filters.idioma}
              onToggle={(value) => toggleFilter("idioma", value)}
              onRemove={(value) => removeFilter("idioma", value)}
              placeholder="Filtrar por idioma"
            />
            <FilterCombobox
              label="Departamento"
              options={availableFilters.departamento || []}
              selected={getSelectedDepartamentos()}
              onToggle={(value) => toggleDepartamentoFilter(value)}
              onRemove={(value) => removeDepartamentoFilter(value)}
              placeholder="Filtrar por departamento"
            />
            <FilterCombobox
              label="Canal"
              options={availableFilters.canal || []}
              selected={getSelectedCanais()}
              onToggle={(value) => toggleCanalFilter(value)}
              onRemove={(value) => removeCanalFilter(value)}
              placeholder="Filtrar por canal"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredData.length} de {data.length} registro(s)
            </p>
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Limpar filtros
            </Button>
          </div>
        </div>
      )}

      <Tabs
        value={phoneTab}
        onValueChange={(value) => setPhoneTab(value as "with_phone" | "missing_phone")}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="with_phone">Com telefone ({withPhoneData.length})</TabsTrigger>
          <TabsTrigger value="missing_phone">Telefone faltando ({missingPhoneData.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead column="idFile" label="ID FILE" />
              <SortableHead column="nome" label="Nome" />
              <SortableHead column="telefone" label="Telefone" />
              <SortableHead column="ddi" label="DDI" />
              <SortableHead column="servico" label="Serviço" />
              <SortableHead column="categoriaServico" label="Categoria Serviço" />
              <SortableHead column="parametro" label="Parâmetro" />
              <SortableHead column="voo" label="Voo" />
              <SortableHead column="data" label="Data" />
              <SortableHead column="horaPickup" label="Hora Pickup" />
              <SortableHead column="horaServico" label="Hora Serviço" />
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVisibleData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground">
                  {data.length === 0
                    ? "Nenhum registro carregado."
                    : "Nenhum registro para os filtros/aba selecionados."}
                </TableCell>
              </TableRow>
            ) : (
              sortedVisibleData.map((record, index) => {
                const rowId = getRowId(record)
                const statusKey = getStatusKey(record)
                const rowHasPhone = hasPhone(record)
                const status = statusMap[statusKey]
                const detail = sendDetailsMap[rowId]
                const isSendingThisRow = sendingRow === index
                return (
                  <TableRow
                    key={`${rowId}-${index}`}
                    className={`cursor-pointer ${!rowHasPhone ? "bg-amber-100/60 dark:bg-amber-950/40" : ""}`}
                    onClick={() => {
                      setDetailRecord(record)
                      setIsDetailOpen(true)
                    }}
                  >
                    <TableCell>{String(record.idFile || "—")}</TableCell>
                    <TableCell>{String(record.nomePax || record.name || "—")}</TableCell>
                    <TableCell>{getPhoneValue(record) || "—"}</TableCell>
                    <TableCell>{String(record.ddi ?? "—")}</TableCell>
                    <TableCell>{String(record.servico || record.parametroServico || "—")}</TableCell>
                    <TableCell>{String(record.categoriaServico || record.tipoServico || "—")}</TableCell>
                    <TableCell>{String(record.parametro || record.parametroServico || "—")}</TableCell>
                    <TableCell>{String(record.voo ?? "—")}</TableCell>
                    <TableCell>{String(record.dataPickup || "—")}</TableCell>
                    <TableCell>{String(record.horaPickup ?? "—")}</TableCell>
                    <TableCell>{String(record.horaServico ?? "—")}</TableCell>
                    <TableCell>
                      {status === "sent" && <Badge className="bg-emerald-600">enviado</Badge>}
                      {status === "failed" && <Badge variant="destructive">falhou</Badge>}
                      {!status && <Badge variant="outline">pendente</Badge>}
                      {detail?.ddiMissing && (
                        <Badge variant="outline" className="ml-1 border-amber-500 text-amber-700 dark:text-amber-400">
                          DDI ausente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canSend || isSendingThisRow || isSendingAll || !rowHasPhone}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleSendOne(record, index)
                        }}
                      >
                        {isSendingThisRow ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Enviar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Serviço</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p>{String(detailRecord.idPaxServico || detailRecord.id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p>{String(detailRecord.nomePax || detailRecord.name || "—")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p>{getPhoneValue(detailRecord) || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Template</p>
                  <p>{selectedTemplateObj?.name || "—"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Prévia da mensagem</p>
                <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
{formatMessageForDisplay(buildMessagePreview(detailRecord))}
                </pre>
              </div>

              {sendDetailsMap[getRowId(detailRecord)] && (
                <div className="space-y-2">
                  <p className="font-medium">Último retorno do envio</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p>{sendDetailsMap[getRowId(detailRecord)].success ? "enviado" : "falhou"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Protocol</p>
                      <p>{sendDetailsMap[getRowId(detailRecord)].protocol || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">History ID</p>
                      <p>{sendDetailsMap[getRowId(detailRecord)].mktzapMessageId || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Erro</p>
                      <p className={sendDetailsMap[getRowId(detailRecord)].ddiMissing ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                        {sendDetailsMap[getRowId(detailRecord)].error || "—"}
                      </p>
                    </div>
                  </div>
                  {"request_payload" in (sendDetailsMap[getRowId(detailRecord)].response || {}) && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-medium">Payload enviado ao MKTZAP</p>
                      <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                        {JSON.stringify((sendDetailsMap[getRowId(detailRecord)].response as Record<string, unknown>)?.request_payload ?? {}, null, 2)}
                      </pre>
                    </div>
                  )}
                  <p className="text-muted-foreground font-medium">Resposta do MKTZAP</p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{JSON.stringify(sendDetailsMap[getRowId(detailRecord)].response || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmSendAll} onOpenChange={setShowConfirmSendAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar todas as mensagens?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente enviar todas as mensagens da lista? Esta ação enviará para todos os registros com
              telefone na aba atual.
              <span className="mt-2 block font-medium text-amber-600 dark:text-amber-400">
                O processo não pode ser interrompido após iniciar.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmSendAll(false)
                void handleSendAll()
              }}
            >
              Enviar Todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
