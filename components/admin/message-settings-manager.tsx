"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Save } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Tenant {
  id: string
  name: string
  message_resend_behavior?: "skip" | "resend"
}

interface MessageSettingsManagerProps {
  tenants: Tenant[]
}

function TenantRow({
  tenant,
  onSave,
  saving,
}: {
  tenant: Tenant
  onSave: (id: string, behavior: "skip" | "resend") => void
  saving: boolean
}) {
  const currentBehavior = tenant.message_resend_behavior || "skip"
  const [selectedBehavior, setSelectedBehavior] = useState<"skip" | "resend">(currentBehavior)
  const hasChanges = selectedBehavior !== currentBehavior

  return (
    <TableRow>
      <TableCell className="font-medium">{tenant.name}</TableCell>
      <TableCell>
        <Select value={selectedBehavior} onValueChange={(value) => setSelectedBehavior(value as "skip" | "resend")}>
          <SelectTrigger className="w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">Pular mensagens já enviadas</SelectItem>
            <SelectItem value="resend">Reenviar mensagens já enviadas</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => onSave(tenant.id, selectedBehavior)} disabled={!hasChanges || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function MessageSettingsManager({ tenants: initialTenants }: MessageSettingsManagerProps) {
  const [tenants, setTenants] = useState(initialTenants)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const handleSave = async (tenantId: string, behavior: "skip" | "resend") => {
    setSaving((prev) => ({ ...prev, [tenantId]: true }))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("tenants")
        .update({ message_resend_behavior: behavior })
        .eq("id", tenantId)

      if (error) {
        throw error
      }

      // Atualiza o estado local
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, message_resend_behavior: behavior } : t)),
      )

      toast({
        title: "Configuração salva",
        description: "A configuração de reenvio foi atualizada com sucesso.",
      })
    } catch (error) {
      console.error("Error saving message settings:", error)
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro ao salvar configuração",
      })
    } finally {
      setSaving((prev) => ({ ...prev, [tenantId]: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Envio de Mensagens</CardTitle>
        <CardDescription>
          Configure o comportamento de reenvio de mensagens para cada empresa. Esta configuração afeta o botão "Enviar
          Todas".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-2">Comportamentos disponíveis:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>Pular mensagens já enviadas:</strong> Ao usar "Enviar Todas", mensagens que já foram enviadas
                anteriormente serão ignoradas.
              </li>
              <li>
                <strong>Reenviar mensagens já enviadas:</strong> Ao usar "Enviar Todas", todas as mensagens serão
                enviadas novamente, incluindo as que já foram enviadas.
              </li>
            </ul>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Comportamento de Reenvio</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TenantRow
                  key={tenant.id}
                  tenant={tenant}
                  onSave={handleSave}
                  saving={saving[tenant.id] || false}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

