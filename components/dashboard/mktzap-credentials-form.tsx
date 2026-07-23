"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { MktzapCredential } from "@/lib/types"
import { Eye, EyeOff, Save, Loader2, CheckCircle2, XCircle } from "lucide-react"

interface MktzapCredentialsFormProps {
  credentials: MktzapCredential | null
  canManage: boolean
  tenantId: string | null
}

export function MktzapCredentialsForm({ credentials, canManage, tenantId }: MktzapCredentialsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testingToken, setTestingToken] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<"idle" | "success" | "error">("idle")
  const router = useRouter()

  const [formData, setFormData] = useState({
    company_id: credentials?.company_id || "",
    client_key: credentials?.client_key || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) {
      setError("Você precisa estar vinculado a uma empresa")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    if (credentials) {
      const { error: updateError } = await supabase
        .from("mktzap_credentials")
        .update({ company_id: formData.company_id, client_key: formData.client_key })
        .eq("id", credentials.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        router.refresh()
      }
    } else {
      const { error: insertError } = await supabase.from("mktzap_credentials").insert({
        ...formData,
        tenant_id: tenantId,
      })

      if (insertError) {
        setError(insertError.message)
      } else {
        setSuccess(true)
        router.refresh()
      }
    }
    setIsLoading(false)
  }

  const handleTestToken = async () => {
    setTestingToken(true)
    setTokenStatus("idle")

    try {
      const response = await fetch("/api/mktzap-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.token) {
          setTokenStatus("success")
        } else {
          setError("Token não retornado pela API.")
          setTokenStatus("error")
        }
      } else {
        const err = await response.json().catch(() => null)
        setError(err?.error ? `${err.error}${err?.details ? ` (${err.details})` : ""}` : "Falha ao obter token.")
        setTokenStatus("error")
      }
    } catch {
      setTokenStatus("error")
    } finally {
      setTestingToken(false)
    }
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar credenciais.</p>
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="company_id">Company ID</Label>
          <Input
            id="company_id"
            value={formData.company_id}
            onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
            placeholder="ID da empresa na plataforma MKTZAP"
            required
          />
          <p className="text-xs text-muted-foreground">
            O company_id usado na URL: <code className="bg-muted px-1 rounded">api.mktzap.com.br/company/<strong>:company_id</strong>/token</code>
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client_key">Client Key</Label>
          <div className="relative">
            <Input
              id="client_key"
              type={showKey ? "text" : "password"}
              value={formData.client_key}
              onChange={(e) => setFormData({ ...formData, client_key: e.target.value })}
              placeholder="Chave do cliente MKTZAP"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O clientKey da query string: <code className="bg-muted px-1 rounded">?clientKey=<strong>valor</strong></code>
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Salvo com sucesso!</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Salvando..." : "Salvar Credenciais"}
          </Button>
          {credentials && (
            <Button type="button" variant="outline" onClick={handleTestToken} disabled={testingToken}>
              {testingToken ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : tokenStatus === "success" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Token OK
                </>
              ) : tokenStatus === "error" ? (
                <>
                  <XCircle className="mr-2 h-4 w-4 text-destructive" />
                  Falha - Tentar novamente
                </>
              ) : (
                "Testar Token"
              )}
            </Button>
          )}
        </div>
      </form>

      {credentials && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium">Informações da integração</p>
          <p className="text-xs text-muted-foreground">
            O token é buscado automaticamente e tem validade de <strong>1 hora</strong>. O sistema renova automaticamente quando necessário.
          </p>
          <p className="text-xs text-muted-foreground">
            URL do token: <code className="bg-muted px-1 rounded break-all">https://api.mktzap.com.br/company/{formData.company_id}/token?clientKey=***</code>
          </p>
        </div>
      )}
    </div>
  )
}
