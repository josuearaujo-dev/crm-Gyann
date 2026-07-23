"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import type { MktzapTemplate } from "@/lib/types"
import { RefreshCw, Loader2, Check, X, Edit2, Wand2, ChevronDown, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
} from "@/components/ui/command"

// Campos conhecidos da API de dados, com descrição amigável
const API_DATA_FIELDS = [
  { value: "nomePax", label: "Nome do Passageiro", group: "Passageiro" },
  { value: "telefone", label: "Telefone", group: "Passageiro" },
  { value: "idioma", label: "Idioma", group: "Passageiro" },
  { value: "qtdPaxs", label: "Qtd. Passageiros", group: "Passageiro" },
  { value: "adt", label: "Adultos", group: "Passageiro" },
  { value: "chd", label: "Crianças", group: "Passageiro" },
  { value: "inf", label: "Infantes", group: "Passageiro" },
  { value: "snr", label: "Sênior", group: "Passageiro" },
  { value: "cliente", label: "Cliente", group: "Empresa" },
  { value: "empresa", label: "Empresa", group: "Empresa" },
  { value: "canal", label: "Canal", group: "Empresa" },
  { value: "departamento", label: "Departamento", group: "Empresa" },
  { value: "idCanal", label: "ID Canal", group: "Empresa" },
  { value: "idDepartamento", label: "ID Departamento", group: "Empresa" },
  { value: "evento", label: "Evento", group: "Empresa" },
  { value: "servico", label: "Serviço", group: "Serviço" },
  { value: "tipoServico", label: "Tipo de Serviço", group: "Serviço" },
  { value: "parametroServico", label: "Parâmetro do Serviço", group: "Serviço" },
  { value: "categoriaServico", label: "Categoria do Serviço", group: "Serviço" },
  { value: "parametro", label: "Parâmetro", group: "Serviço" },
  { value: "idServico", label: "ID Serviço", group: "Serviço" },
  { value: "idTipoServico", label: "ID Tipo Serviço", group: "Serviço" },
  { value: "idParametroServico", label: "ID Parâmetro Serviço", group: "Serviço" },
  { value: "idServicoFile", label: "ID Serviço File", group: "Serviço" },
  { value: "dataPickup", label: "Data Pickup", group: "Datas/Horários" },
  { value: "horaPickup", label: "Hora Pickup", group: "Datas/Horários" },
  { value: "horaServico", label: "Hora do Serviço", group: "Datas/Horários" },
  { value: "dataHoraCiencia", label: "Data/Hora Ciência", group: "Datas/Horários" },
  { value: "origem", label: "Origem", group: "Localização" },
  { value: "destino", label: "Destino", group: "Localização" },
  { value: "hotelPousada", label: "Hotel / Pousada", group: "Localização" },
  { value: "aeroporto", label: "Aeroporto", group: "Localização" },
  { value: "idHotelPousada", label: "ID Hotel/Pousada", group: "Localização" },
  { value: "voo", label: "Voo", group: "Transporte" },
  { value: "ddi", label: "DDI", group: "Transporte" },
  { value: "idFile", label: "ID File", group: "Identificação" },
  { value: "idOrdemServico", label: "Ordem de Serviço", group: "Identificação" },
  { value: "idPaxServico", label: "ID Pax Serviço", group: "Identificação" },
  { value: "msgInicio", label: "Mensagem Início", group: "Mensagens" },
  { value: "msgFim", label: "Mensagem Fim", group: "Mensagens" },
  { value: "clienteCiente", label: "Cliente Ciente", group: "Mensagens" },
]

const FIELD_GROUPS = ["Passageiro", "Empresa", "Serviço", "Datas/Horários", "Localização", "Transporte", "Identificação", "Mensagens"]

const EXAMPLE_BY_FIELD: Record<string, string> = {
  nomePax: "CARLOS ENRIQUE",
  telefone: "91165088356",
  idioma: "PT_BR",
  qtdPaxs: "5",
  adt: "1",
  chd: "2",
  inf: "1",
  snr: "1",
  cliente: "Cliente Exemplo Operadora",
  empresa: "Sua Empresa de Turismo",
  canal: "RPA COSTAZUL",
  departamento: "RECEPTIVO",
  idCanal: "5",
  idDepartamento: "1",
  evento: "INDEFINIDO",
  servico: "TRANSFER CHEGADA - VIA MACEIO",
  tipoServico: "Regular",
  parametroServico: "CHEGADA",
  categoriaServico: "Regular",
  parametro: "CHEGADA",
  idServico: "60",
  idTipoServico: "1",
  idParametroServico: "1",
  idServicoFile: "242899",
  dataPickup: "15/02/2026",
  horaPickup: "08:45:00",
  horaServico: "08:45:00",
  dataHoraCiencia: "2026-02-15T08:45:00",
  origem: "AEROPORTO ZUMBI DOS PALMARES",
  destino: "PRAIA DOURADA MARAGOGI PARK",
  hotelPousada: "PRAIA DOURADA MARAGOGI PARK",
  aeroporto: "MCZ",
  idHotelPousada: "3",
  voo: "G3 9522",
  ddi: "54",
  idFile: "110428",
  idOrdemServico: "85809",
  idPaxServico: "693144",
  msgInicio: "Mensagem de abertura",
  msgFim: "Mensagem de encerramento",
  clienteCiente: "false",
}

function FieldCombobox({
  value,
  onChange,
  variable,
}: {
  value: string
  onChange: (value: string) => void
  variable: string
}) {
  const [open, setOpen] = useState(false)
  const selectedField = API_DATA_FIELDS.find((f) => f.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 justify-between font-normal h-9"
        >
          <span className="truncate">
            {selectedField
              ? `${selectedField.value} (${selectedField.label})`
              : value
                ? value
                : `Selecione o campo para {{${variable}}}`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campo..." />
          <CommandList>
            <CommandEmpty>Nenhum campo encontrado.</CommandEmpty>
            <CommandItem
              value="limpar selecao"
              onSelect={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Limpar seleção
            </CommandItem>
            {FIELD_GROUPS.map((group) => {
              const fields = API_DATA_FIELDS.filter((f) => f.group === group)
              if (fields.length === 0) return null
              return (
                <CommandGroup key={group} heading={group}>
                  {fields.map((field) => (
                    <CommandItem
                      key={field.value}
                      value={`${field.value} ${field.label}`}
                      onSelect={() => {
                        onChange(field.value)
                        setOpen(false)
                      }}
                    >
                      <span className="font-mono text-xs mr-2">{field.value}</span>
                      <span className="text-muted-foreground text-xs">— {field.label}</span>
                      {value === field.value && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface MktzapTemplatesListProps {
  templates: MktzapTemplate[]
  canManage: boolean
  tenantId: string | null
}

export function MktzapTemplatesList({ templates, canManage, tenantId }: MktzapTemplatesListProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const router = useRouter()

  const [parameterMapping, setParameterMapping] = useState<Record<string, string>>({})
  const [dynamicParameterFlags, setDynamicParameterFlags] = useState<Record<string, boolean>>({})
  const [extractedVariables, setExtractedVariables] = useState<string[]>([])
  const [editingTemplate, setEditingTemplate] = useState<MktzapTemplate | null>(null)
  const [brokerPhone, setBrokerPhone] = useState("")
  const [isActiveForSend, setIsActiveForSend] = useState(true)
  const [isPasseioTemplate, setIsPasseioTemplate] = useState(false)

  const formatTemplateTextForDisplay = (rawText: string): string => {
    if (!rawText) return ""

    const decoded = rawText
      // Converte sequencias unicode escapadas: \u00e1, \ud83d\ude97 etc.
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      // Converte quebras de linha escapadas
      .replace(/\\n/g, "\n")

    // Ajustes visuais de pontuacao para leitura
    return decoded.replace(/\s+\?/g, "?")
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/mktzap-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Erro ao sincronizar",
          description: data.error || "Não foi possível sincronizar os templates.",
        })
        return
      }

      toast({
        title: "Templates sincronizados",
        description: `${data.total} templates: ${data.created} novos, ${data.updated} atualizados.`,
      })

      router.refresh()
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha de conexão ao sincronizar templates.",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const extractVariables = (templateText: string): string[] => {
    const regex = /\{\{(\d+)\}\}/g
    const matches = templateText.matchAll(regex)
    return [...new Set([...matches].map((m) => m[1]))].sort((a, b) => Number(a) - Number(b))
  }

  const handleEdit = (template: MktzapTemplate) => {
    setEditingId(template.id)
    setEditingTemplate(template)
    setShowPreview(false)
    const vars = extractVariables(formatTemplateTextForDisplay(template.template))
    setExtractedVariables(vars)

    const mapping = { ...template.parameter_mapping }
    const flags = { ...(template.dynamic_parameter_flags || {}) }
    vars.forEach((v) => {
      if (!(v in mapping)) mapping[v] = ""
      if (!(v in flags)) flags[v] = false
    })
    setParameterMapping(mapping)
    setDynamicParameterFlags(flags)
    setBrokerPhone(template.broker_phone || "")
    setIsActiveForSend(template.is_active ?? true)
    setIsPasseioTemplate(template.is_passeio ?? false)
  }

  const handleSave = async () => {
    if (!editingId) return

    // Campos marcados como dinâmicos podem ficar sem mapeamento; os demais precisam estar preenchidos
    const unmapped = extractedVariables.filter((v) => !dynamicParameterFlags[v] && !parameterMapping[v])
    if (unmapped.length > 0) {
      setError(`Mapeie todos os parâmetros (ou marque como dinâmico): {{${unmapped.join("}}, {{")}}}`)
      return
    }

    const normalizedBrokerPhone = brokerPhone.replace(/\D/g, "")
    if (!normalizedBrokerPhone) {
      setError("Informe o broker_phone (telefone de envio do template).")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const cleanMapping: Record<string, string> = {}
    const cleanDynamicFlags: Record<string, boolean> = {}
    extractedVariables.forEach((v) => {
      if (parameterMapping[v]) {
        cleanMapping[v] = parameterMapping[v]
      } else if (dynamicParameterFlags[v]) {
        cleanMapping[v] = "" // dinâmico: campo pode ficar vazio no cadastro
      }
      cleanDynamicFlags[v] = !!dynamicParameterFlags[v]
    })

    const { error: updateError } = await supabase
      .from("mktzap_templates")
      .update({
        parameter_mapping: cleanMapping,
        dynamic_parameter_flags: cleanDynamicFlags,
        broker_phone: normalizedBrokerPhone,
        is_active: isActiveForSend,
        is_passeio: isPasseioTemplate,
      })
      .eq("id", editingId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setEditingId(null)
      setEditingTemplate(null)
      toast({ title: "Mapeamento salvo", description: "O mapeamento de parâmetros foi salvo com sucesso." })
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditingTemplate(null)
    setError(null)
    setShowPreview(false)
    setParameterMapping({})
    setDynamicParameterFlags({})
    setExtractedVariables([])
    setBrokerPhone("")
    setIsActiveForSend(true)
    setIsPasseioTemplate(false)
  }

  const updateMapping = (variable: string, value: string) => {
    setParameterMapping((prev) => ({ ...prev, [variable]: value }))
  }

  const toggleDynamicFlag = (variable: string, checked: boolean) => {
    setDynamicParameterFlags((prev) => ({ ...prev, [variable]: checked }))
  }

  // Gera prévia do template com os campos mapeados
  const buildPreview = (templateText: string): string => {
    let preview = formatTemplateTextForDisplay(templateText)
    Object.entries(parameterMapping).forEach(([varNum, fieldName]) => {
      if (fieldName) {
        preview = preview.replace(
          new RegExp(`\\{\\{${varNum}\\}\\}`, "g"),
          EXAMPLE_BY_FIELD[fieldName] ?? `[exemplo ${fieldName}]`,
        )
      }
    })
    return preview
  }

  // Gera o template com destaque visual nas variáveis
  const renderTemplateWithHighlights = (templateText: string) => {
    const formatted = formatTemplateTextForDisplay(templateText)
    const parts = formatted.split(/(\{\{\d+\}\})/)
    return parts.map((part, i) => {
      const match = part.match(/\{\{(\d+)\}\}/)
      if (match) {
        const varNum = match[1]
        const fieldName = parameterMapping[varNum]
        return (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
              fieldName
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            }`}
          >
            {fieldName ? `{{${varNum}}} → ${fieldName}` : `{{${varNum}}} ?`}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? "s" : ""} sincronizado{templates.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Templates
              </>
            )}
          </Button>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum template sincronizado.</p>
          {canManage && (
            <p className="text-sm text-muted-foreground mt-1">
              Clique em &quot;Sincronizar Templates&quot; para buscar da API MKTZAP.
            </p>
          )}
        </div>
      ) : (
        templates.map((template) => (
          <div key={template.id}>
            {editingId === template.id ? (
              <div className="space-y-4 rounded-lg border-2 border-primary/20 p-5 bg-card">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-lg">{template.name}</p>
                    <Badge variant="secondary">{template.language}</Badge>
                    <Badge variant="outline" className="text-xs">ID: {template.mktzap_id}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs"
                  >
                    {showPreview ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                    {showPreview ? "Ocultar prévia" : "Ver prévia"}
                  </Button>
                </div>

                {/* Template com variáveis destacadas */}
                <div className="rounded-md bg-muted/50 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {renderTemplateWithHighlights(template.template)}
                </div>

                {/* Prévia com campos mapeados */}
                {showPreview && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">Prévia com textos de exemplo:</p>
                    <p className="text-sm whitespace-pre-wrap text-green-900 dark:text-green-100">
                      {buildPreview(template.template)}
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="broker_phone" className="text-sm font-semibold">
                    broker_phone (telefone de envio)
                  </Label>
                  <input
                    id="broker_phone"
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={brokerPhone}
                    onChange={(e) => setBrokerPhone(e.target.value)}
                    placeholder="Ex: 5585987278651"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número que será usado para enviar este template no MKTZAP.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Ativo para envio</p>
                    <p className="text-xs text-muted-foreground">
                      Somente templates ativos aparecem na tela de envio do MKTZAP.
                    </p>
                  </div>
                  <Switch checked={isActiveForSend} onCheckedChange={setIsActiveForSend} />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Template de passeio</p>
                    <p className="text-xs text-muted-foreground">
                      Quando marcado, a busca no envio filtra automaticamente por parametroServico = PASSEIO.
                    </p>
                  </div>
                  <Switch checked={isPasseioTemplate} onCheckedChange={setIsPasseioTemplate} />
                </div>

                {/* Mapeamento de parâmetros */}
                {extractedVariables.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="pt-4">
                      <Label className="text-sm font-semibold mb-1 block">
                        De → Para: Mapeamento de Variáveis
                      </Label>
                      <p className="text-xs text-muted-foreground mb-4">
                        Selecione qual campo do JSON da API de dados preenche cada variável do template.
                      </p>
                      <div className="grid gap-3">
                        {extractedVariables.map((variable) => (
                          <div key={variable} className="flex items-center gap-3">
                            <Badge
                              variant={parameterMapping[variable] ? "default" : "secondary"}
                              className="w-16 justify-center font-mono shrink-0"
                            >
                              {`{{${variable}}}`}
                            </Badge>
                            <span className="text-muted-foreground shrink-0">→</span>
                            <FieldCombobox
                              value={parameterMapping[variable] || ""}
                              onChange={(val) => updateMapping(variable, val)}
                              variable={variable}
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <Checkbox
                                id={`dynamic-${variable}`}
                                checked={!!dynamicParameterFlags[variable]}
                                onCheckedChange={(checked) => toggleDynamicFlag(variable, checked === true)}
                              />
                              <Label htmlFor={`dynamic-${variable}`} className="text-xs cursor-pointer">
                                Dinâmico
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {extractedVariables.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma variável {"{{n}}"} encontrada neste template.
                  </p>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" onClick={handleSave} disabled={isLoading}>
                    <Check className="mr-2 h-4 w-4" />
                    {isLoading ? "Salvando..." : "Salvar Mapeamento"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{template.name}</p>
                    <Badge variant="secondary">{template.language}</Badge>
                    <Badge variant="outline" className="text-xs">ID: {template.mktzap_id}</Badge>
                    {template.is_active ? (
                      <Badge className="text-xs bg-emerald-600">ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">inativo</Badge>
                    )}
                    {template.is_passeio && (
                      <Badge variant="outline" className="text-xs">passeio</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {formatTemplateTextForDisplay(template.template)}
                  </p>
                  {template.broker_phone ? (
                    <Badge variant="default" className="text-xs font-mono">
                      broker_phone: {template.broker_phone}
                    </Badge>
                  ) : (
                    <p className="text-xs text-amber-600">broker_phone pendente</p>
                  )}
                  {Object.keys(template.parameter_mapping || {}).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(template.parameter_mapping).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs font-mono">
                          {`{{${key}}}`} → {value as string}
                          {(template.dynamic_parameter_flags || {})[key] ? " (dinâmico)" : ""}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    extractVariables(formatTemplateTextForDisplay(template.template)).length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <p className="text-xs text-amber-600 font-medium">Mapeamento de parâmetros pendente</p>
                      </div>
                    )
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} className="gap-1">
                      <Edit2 className="h-4 w-4" />
                      <span className="hidden sm:inline text-xs">Mapear</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
