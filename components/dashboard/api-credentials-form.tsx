"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { ApiCredential } from "@/lib/types"
import { Trash2, Plus, Eye, EyeOff } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface ApiCredentialsFormProps {
  credentials: ApiCredential[]
  canManage: boolean
  tenantId: string | null
}

export function ApiCredentialsForm({ credentials, canManage, tenantId }: ApiCredentialsFormProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    base_url: "",
    username: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) {
      setError("Você precisa estar vinculado a uma empresa")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from("api_credentials").insert({
      ...formData,
      tenant_id: tenantId,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setFormData({ name: "", base_url: "", username: "", password: "" })
      setIsAdding(false)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta credencial?")) return

    const supabase = createClient()
    await supabase.from("api_credentials").delete().eq("id", id)
    router.refresh()
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar credenciais.</p>
  }

  return (
    <div className="space-y-4">
      {credentials.map((cred) => (
        <div key={cred.id} className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="font-medium">{cred.name}</p>
            <p className="text-sm text-muted-foreground truncate">{cred.base_url}</p>
            <p className="text-sm text-muted-foreground">Usuário: {cred.username}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(cred.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      {isAdding ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome da API</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ManageTour API"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="base_url">URL da API (completa)</Label>
            <Textarea
              id="base_url"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder="https://dev.managetour.app.br/webrun/apiGetPaxServicoNotificacao.rule?sys=API"
              className="font-mono text-sm"
              rows={2}
              required
            />
            <p className="text-xs text-muted-foreground">
              Informe a URL completa com o path. Os parâmetros <code>dataInicio</code> e <code>dataFim</code> serão
              adicionados automaticamente.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Usuário (Basic Auth)</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha (Basic Auth)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword["new"] ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword({ ...showPassword, new: !showPassword["new"] })}
              >
                {showPassword["new"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Credencial
        </Button>
      )}
    </div>
  )
}
