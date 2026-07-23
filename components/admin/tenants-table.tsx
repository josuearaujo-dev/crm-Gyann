"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { Tenant } from "@/lib/types"
import { Plus, Trash2, Edit2, X, Check, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface TenantsTableProps {
  tenants: Tenant[]
}

export function TenantsTable({ tenants }: TenantsTableProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    if (editingId) {
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ name: formData.name, slug: formData.slug })
        .eq("id", editingId)

      if (updateError) {
        setError(updateError.message)
      } else {
        setEditingId(null)
        resetForm()
        router.refresh()
      }
    } else {
      const { error: insertError } = await supabase.from("tenants").insert(formData)

      if (insertError) {
        setError(insertError.message)
      } else {
        setIsAdding(false)
        resetForm()
        router.refresh()
      }
    }
    setIsLoading(false)
  }

  const resetForm = () => {
    setFormData({ name: "", slug: "" })
  }

  const handleEdit = (tenant: Tenant) => {
    setEditingId(tenant.id)
    setFormData({ name: tenant.name, slug: tenant.slug })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa? Todos os dados associados serão perdidos.")) return

    const supabase = createClient()
    await supabase.from("tenants").delete().eq("id", id)
    router.refresh()
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const supabase = createClient()
    await supabase.from("tenants").update({ is_active: isActive }).eq("id", id)
    router.refresh()
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    resetForm()
    setError(null)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Empresa</DialogTitle>
              <DialogDescription>Crie uma nova empresa (tenant) no sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    })
                  }}
                  placeholder="Minha Empresa Ltda"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug (identificador único)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="minha-empresa"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Criando..." : "Criar Empresa"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma empresa cadastrada.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  {editingId === tenant.id ? (
                    <>
                      <TableCell colSpan={4}>
                        <form onSubmit={handleSubmit} className="flex items-center gap-4">
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="max-w-xs"
                          />
                          <Input
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="max-w-xs"
                          />
                          <Button type="submit" size="icon" disabled={isLoading}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={handleCancel}>
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{tenant.slug}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tenant.is_active}
                            onCheckedChange={(checked) => handleToggleActive(tenant.id, checked)}
                          />
                          <Badge variant={tenant.is_active ? "default" : "secondary"}>
                            {tenant.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tenant.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
