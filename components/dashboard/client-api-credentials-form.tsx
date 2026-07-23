"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import type { ClientApiCredential } from "@/lib/types"
import { Copy, Plus, Trash2 } from "lucide-react"

type CredentialListItem = Pick<
  ClientApiCredential,
  "id" | "name" | "client_id" | "secret_prefix" | "is_active" | "last_used_at" | "created_at"
>

interface ClientApiCredentialsFormProps {
  credentials: CredentialListItem[]
  canManage: boolean
  tenantId: string | null
}

interface CreatedCredential {
  clientId: string
  apiSecret: string
  name: string
}

export function ClientApiCredentialsForm({ credentials, canManage, tenantId }: ClientApiCredentialsFormProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null)
  const [name, setName] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenantId) {
      setError("Você precisa estar vinculado a uma empresa")
      return
    }

    setIsLoading(true)
    setError(null)
    setCreatedCredential(null)

    try {
      const response = await fetch("/api/client-api-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao criar credencial")
        return
      }

      setCreatedCredential({
        clientId: data.clientId,
        apiSecret: data.apiSecret,
        name,
      })
      setName("")
      setIsAdding(false)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao criar credencial")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (credential: CredentialListItem, isActive: boolean) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("client_api_credentials")
      .update({ is_active: isActive })
      .eq("id", credential.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta credencial da API?")) return

    const supabase = createClient()
    const { error: deleteError } = await supabase.from("client_api_credentials").delete().eq("id", id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    router.refresh()
  }

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value)
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar credenciais da API.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Compartilhe a documentação com seu cliente em{" "}
        <a href="/docs/api-cliente" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
          /docs/api-cliente
        </a>
        . Veja todas as tentativas de envio em{" "}
        <a href="/dashboard/api-logs" className="text-primary underline-offset-4 hover:underline">
          Logs API Cliente
        </a>
        .
      </div>

      {createdCredential && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">
            Credencial &quot;{createdCredential.name}&quot; criada. Copie o segredo agora — ele não será exibido novamente.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Client ID</p>
                <p className="font-mono text-sm break-all">{createdCredential.clientId}</p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(createdCredential.clientId)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">API Secret</p>
                <p className="font-mono text-sm break-all">{createdCredential.apiSecret}</p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(createdCredential.apiSecret)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {credentials.map((credential) => (
        <div key={credential.id} className="flex items-center justify-between rounded-md border p-3 gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{credential.name}</p>
              <Badge variant={credential.is_active ? "default" : "secondary"}>
                {credential.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono break-all">Client ID: {credential.client_id}</p>
            <p className="text-sm text-muted-foreground">Secret: ••••{credential.secret_prefix}</p>
            {credential.last_used_at && (
              <p className="text-xs text-muted-foreground">
                Último uso: {new Date(credential.last_used_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={credential.is_active}
              onCheckedChange={(checked) => handleToggleActive(credential, checked)}
            />
            <Button variant="ghost" size="icon" onClick={() => handleDelete(credential.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}

      {isAdding ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
          <div className="grid gap-2">
            <Label htmlFor="credential-name">Nome da credencial</Label>
            <Input
              id="credential-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Integração ERP produção"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Gerando..." : "Gerar credencial"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Nova credencial da API
        </Button>
      )}

      {!isAdding && error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
