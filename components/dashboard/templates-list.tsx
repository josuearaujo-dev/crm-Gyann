"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useRouter } from "next/navigation"
import type { MessageTemplate } from "@/lib/types"
import { Trash2, Plus, Edit2, X, Check, Wand2, ChevronDown, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

interface TemplatesListProps {
  templates: MessageTemplate[]
  canManage: boolean
  tenantId: string | null
}

const API_FIELD_OPTIONS = [
  "aeroporto",
  "canal",
  "cliente",
  "dataPickup",
  "ddi",
  "departamento",
  "destino",
  "empresa",
  "evento",
  "horaPickup",
  "horaServico",
  "hotelPousada",
  "idCanal",
  "idDepartamento",
  "idFile",
  "idHotelPousada",
  "idOrdemServico",
  "idParametroServico",
  "idPaxServico",
  "idServico",
  "idServicoFile",
  "idTipoServico",
  "idioma",
  "msgFim",
  "msgInicio",
  "nomePax",
  "origem",
  "parametroServico",
  "servico",
  "telefone",
  "tipoServico",
  "voo",
  "adt",
  "chd",
  "inf",
  "snr",
  "qtdPaxs",
] as const

const EXAMPLE_BY_FIELD: Record<string, string> = {
  aeroporto: "MCZ",
  canal: "RPA COSTAZUL",
  cliente: "TOURMED OPERDORA DE VIAGENS E TURISMO",
  dataPickup: "15/02/2026",
  ddi: "54",
  departamento: "RECEPTIVO",
  destino: "PRAIA DOURADA MARAGOGI PARK",
  empresa: "XYZ Turismo",
  evento: "INDEFINIDO",
  horaPickup: "08:45:00",
  horaServico: "08:45:00",
  hotelPousada: "PRAIA DOURADA MARAGOGI PARK",
  idCanal: "5",
  idDepartamento: "1",
  idFile: "110428",
  idHotelPousada: "3",
  idOrdemServico: "85809",
  idParametroServico: "1",
  idPaxServico: "693144",
  idServico: "60",
  idServicoFile: "242899",
  idTipoServico: "1",
  idioma: "PT_BR",
  msgFim: "Mensagem de encerramento",
  msgInicio: "Mensagem de abertura",
  nomePax: "CARLOS ENRIQUE",
  origem: "AEROPORTO ZUMBI DOS PALMARES",
  parametroServico: "CHEGADA",
  servico: "TRANSFER CHEGADA - VIA MACEIO",
  telefone: "91165088356",
  tipoServico: "Regular",
  voo: "G3 9522",
  adt: "1",
  chd: "2",
  inf: "1",
  snr: "1",
  qtdPaxs: "5",
}

export function TemplatesList({ templates, canManage, tenantId }: TemplatesListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [isActiveForSend, setIsActiveForSend] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    language_code: "pt_BR",
    category: "UTILITY",
    description: "",
    template_text: "",
    parameter_mapping: {} as Record<string, string>,
  })

  const [extractedVariables, setExtractedVariables] = useState<string[]>([])

  useEffect(() => {
    const regex = /\{\{(\d+)\}\}/g
    const matches = formData.template_text.matchAll(regex)
    const variables = [...new Set([...matches].map((m) => m[1]))].sort((a, b) => Number(a) - Number(b))
    setExtractedVariables(variables)

    // Initialize mapping for new variables
    const newMapping = { ...formData.parameter_mapping }
    variables.forEach((v) => {
      if (!(v in newMapping)) {
        newMapping[v] = ""
      }
    })
    // Remove old variables not in template
    Object.keys(newMapping).forEach((key) => {
      if (!variables.includes(key)) {
        delete newMapping[key]
      }
    })
    if (JSON.stringify(newMapping) !== JSON.stringify(formData.parameter_mapping)) {
      setFormData((prev) => ({ ...prev, parameter_mapping: newMapping }))
    }
  }, [formData.template_text])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) {
      setError("Você precisa estar vinculado a uma empresa")
      return
    }

    // Validate all variables are mapped
    const unmapped = extractedVariables.filter((v) => !formData.parameter_mapping[v])
    if (unmapped.length > 0) {
      setError(`Mapeie todos os parâmetros: {{${unmapped.join("}}, {{")}}}`)
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()

    const dataToSave = {
      name: formData.name,
      language_code: formData.language_code,
      description: formData.description,
      template_text: formData.template_text,
      parameter_mapping: formData.parameter_mapping,
    }

    if (editingId) {
      const { error: updateError } = await supabase
        .from("message_templates")
        .update({
          ...dataToSave,
          is_active: isActiveForSend,
        })
        .eq("id", editingId)

      if (updateError) {
        setError(updateError.message)
      } else {
        setEditingId(null)
        resetForm()
        router.refresh()
      }
    } else {
      const response = await fetch("/api/whatsapp-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dataToSave,
          category: formData.category,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        setError(json.error || "Falha ao criar template na Meta")
      } else {
        setIsAdding(false)
        resetForm()
        setSuccess(json.message || "Template enviado para a Meta e aguardando aprovação.")
        router.refresh()
      }
    }
    setIsLoading(false)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      language_code: "pt_BR",
      category: "UTILITY",
      description: "",
      template_text: "",
      parameter_mapping: {},
    })
    setExtractedVariables([])
    setIsActiveForSend(false)
  }

  const canActivateForSend = (template: MessageTemplate) => {
    if (!template.meta_status) return true
    return template.meta_status === "APPROVED"
  }

  const handleToggleActive = async (template: MessageTemplate, isActive: boolean) => {
    if (isActive && !canActivateForSend(template)) {
      setError("Somente templates aprovados na Meta podem ser ativados para envio.")
      return
    }

    setTogglingId(template.id)
    setError(null)
    setSuccess(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("message_templates")
      .update({ is_active: isActive })
      .eq("id", template.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(isActive ? `Template "${template.name}" ativado para envio.` : `Template "${template.name}" desativado para envio.`)
      router.refresh()
    }

    setTogglingId(null)
  }

  const handleEdit = (template: MessageTemplate) => {
    setEditingId(template.id)
    setFormData({
      name: template.name,
      language_code: template.language_code,
      category: template.category || "UTILITY",
      description: template.description || "",
      template_text: template.template_text || "",
      parameter_mapping: template.parameter_mapping || {},
    })
    setIsActiveForSend(template.is_active ?? false)
  }

  const handleSyncStatus = async (templateId: string) => {
    setSyncingId(templateId)
    setError(null)
    setSuccess(null)

    const response = await fetch("/api/whatsapp-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    })

    const json = await response.json()
    if (!response.ok) {
      setError(json.error || "Falha ao atualizar status na Meta")
    } else {
      setSuccess(json.message || "Status atualizado.")
      router.refresh()
    }

    setSyncingId(null)
  }

  const handleSyncAllFromMeta = async () => {
    setIsSyncingAll(true)
    setError(null)
    setSuccess(null)

    const response = await fetch("/api/whatsapp-templates", {
      method: "GET",
    })

    const json = await response.json()
    if (!response.ok) {
      setError(json.error || "Falha ao sincronizar templates da Meta")
    } else {
      setSuccess(json.message || "Templates sincronizados da Meta.")
      router.refresh()
    }

    setIsSyncingAll(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template também na Meta? Essa ação não pode ser desfeita.")) {
      return
    }

    setDeletingId(id)
    setError(null)
    setSuccess(null)

    const response = await fetch("/api/whatsapp-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    })

    const json = await response.json()
    if (!response.ok) {
      setError(json.error || "Falha ao excluir template na Meta")
    } else {
      setSuccess(json.message || "Template excluído.")
      router.refresh()
    }

    setDeletingId(null)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    resetForm()
  }

  const updateParameterMapping = (variable: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      parameter_mapping: {
        ...prev.parameter_mapping,
        [variable]: value,
      },
    }))
  }

  const editingTemplate = editingId ? templates.find((template) => template.id === editingId) : null

  if (!canManage && templates.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum template configurado.</p>
  }

  return (
    <div className="space-y-4">
      {success && <p className="text-sm text-green-600">{success}</p>}
      {error && !isAdding && !editingId && <p className="text-sm text-destructive">{error}</p>}
      {canManage && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isSyncingAll}
          onClick={handleSyncAllFromMeta}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingAll ? "animate-spin" : ""}`} />
          {isSyncingAll ? "Sincronizando templates da Meta..." : "Atualizar templates existentes da Meta"}
        </Button>
      )}
      {templates.map((template) => (
        <div key={template.id}>
          {editingId === template.id ? (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
              <FormFields
                formData={formData}
                setFormData={setFormData}
                extractedVariables={extractedVariables}
                updateParameterMapping={updateParameterMapping}
              />
              {editingId && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Ativo para envio</p>
                    <p className="text-xs text-muted-foreground">
                      Somente templates ativos e aprovados na Meta aparecem na tela de envio.
                    </p>
                  </div>
                  <Switch
                    checked={isActiveForSend}
                    onCheckedChange={setIsActiveForSend}
                    disabled={!!editingTemplate && !canActivateForSend(editingTemplate)}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isLoading}>
                  <Check className="mr-2 h-4 w-4" />
                  {isLoading ? "Salvando..." : editingId ? "Salvar" : "Criar e enviar para Meta"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between rounded-md border p-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{template.name}</p>
                  <Badge variant="secondary">{template.language_code}</Badge>
                  {template.category && <Badge variant="outline">{template.category}</Badge>}
                  {template.meta_status && (
                    <Badge
                      variant={
                        template.meta_status === "APPROVED"
                          ? "default"
                          : template.meta_status === "REJECTED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      Meta: {template.meta_status}
                    </Badge>
                  )}
                  {template.is_active ? (
                    <Badge className="bg-emerald-600 text-xs">ativo para envio</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      inativo para envio
                    </Badge>
                  )}
                </div>
                {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                {Object.keys(template.parameter_mapping || {}).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(template.parameter_mapping || {}).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {`{{${key}}}`} → {value as string}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">Enviar</span>
                    <Switch
                      checked={template.is_active}
                      disabled={togglingId === template.id || !canActivateForSend(template)}
                      onCheckedChange={(checked) => handleToggleActive(template, checked)}
                    />
                  </div>
                  <div className="flex gap-1">
                  {template.meta_status && template.meta_status !== "APPROVED" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Atualizar status na Meta"
                      disabled={syncingId === template.id}
                      onClick={() => handleSyncStatus(template.id)}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncingId === template.id ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingId === template.id}
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className={`h-4 w-4 text-destructive ${deletingId === template.id ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {canManage && (
        <>
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
              <FormFields
                formData={formData}
                setFormData={setFormData}
                extractedVariables={extractedVariables}
                updateParameterMapping={updateParameterMapping}
              />
              {editingId && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Ativo para envio</p>
                    <p className="text-xs text-muted-foreground">
                      Somente templates ativos e aprovados na Meta aparecem na tela de envio.
                    </p>
                  </div>
                  <Switch
                    checked={isActiveForSend}
                    onCheckedChange={setIsActiveForSend}
                    disabled={!!editingTemplate && !canActivateForSend(editingTemplate)}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Enviando..." : "Criar e enviar para Meta"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Template
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function FormFields({
  formData,
  setFormData,
  extractedVariables,
  updateParameterMapping,
}: {
  formData: {
    name: string
    language_code: string
    category: string
    description: string
    template_text: string
    parameter_mapping: Record<string, string>
  }
  setFormData: (data: typeof formData) => void
  extractedVariables: string[]
  updateParameterMapping: (variable: string, value: string) => void
}) {
  const [showPreview, setShowPreview] = useState(false)

  const mappedPreview = formData.template_text.replace(/\{\{(\d+)\}\}/g, (_, variable: string) => {
    const mappedField = formData.parameter_mapping[variable]
    return mappedField ? (EXAMPLE_BY_FIELD[mappedField] ?? `[exemplo ${mappedField}]`) : `{{${variable}}}`
  })

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="template_name">Nome do Template (WhatsApp)</Label>
          <Input
            id="template_name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="aviso_partida"
            required
          />
          <p className="text-xs text-muted-foreground">
            Use apenas letras minúsculas, números e underscore. Será enviado assim para a Meta.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="language_code">Código do Idioma</Label>
          <Input
            id="language_code"
            value={formData.language_code}
            onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
            placeholder="pt_BR"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Categoria (Meta)</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UTILITY">UTILITY</SelectItem>
            <SelectItem value="MARKETING">MARKETING</SelectItem>
            <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Aviso de partida para passageiros"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="template_text" className="flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          Texto do Template (Meta)
        </Label>
        <Textarea
          id="template_text"
          value={formData.template_text}
          onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
          placeholder={`Digite o texto do template com variáveis, exemplo:

Olá Sr(a) {{1}}
Aqui é da empresa {{2}}, tudo bem?
Serviço: {{3}}
Data: {{4}}
Horário da saída: {{5}}
...`}
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Digite o texto com variáveis {"{{1}}"}, {"{{2}}"}, etc. Ao salvar, o sistema cria o template na Meta e aguarda
          aprovação.
        </p>
      </div>

      {formData.template_text.trim().length > 0 && (
        <div className="space-y-2">
          <Button type="button" variant="outline" onClick={() => setShowPreview((prev) => !prev)}>
            {showPreview ? "Ocultar prévia" : "Ver prévia"}
          </Button>
          {showPreview && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <Label className="text-sm font-medium mb-2 block">Prévia com textos de exemplo</Label>
                <pre className="rounded-md border bg-background p-3 text-xs whitespace-pre-wrap wrap-break-word">
                  {mappedPreview}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  A prévia usa valores fictícios para simular a mensagem final.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {extractedVariables.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <Label className="text-sm font-medium mb-3 block">
              Mapeamento de Variáveis ({extractedVariables.length} encontradas)
            </Label>
            <div className="grid gap-3">
              {extractedVariables.map((variable) => (
                <div key={variable} className="flex items-center gap-3">
                  <Badge variant="secondary" className="w-16 justify-center font-mono">
                    {`{{${variable}}}`}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                        <span className="truncate">
                          {formData.parameter_mapping[variable] || `Campo da API para {{${variable}}}`}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar campo..." />
                        <CommandList>
                          <CommandEmpty>Nenhum campo encontrado.</CommandEmpty>
                          <CommandItem value="__none__" onSelect={() => updateParameterMapping(variable, "")}>
                            Selecione um campo...
                          </CommandItem>
                          {API_FIELD_OPTIONS.map((field) => (
                            <CommandItem key={field} value={field} onSelect={() => updateParameterMapping(variable, field)}>
                              {field}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Selecione no dropdown o campo retornado pela API que corresponde a cada variável do template.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
