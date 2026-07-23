"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Profile, Tenant } from "@/lib/types"
import { Edit2, UserPlus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface UsersTableProps {
  profiles: (Profile & { tenant: Pick<Tenant, "id" | "name"> | null })[]
  tenants: Pick<Tenant, "id" | "name">[]
}

export function UsersTable({ profiles, tenants }: UsersTableProps) {
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    tenant_id: "",
    id_mktzap: "",
    role: "user" as "admin" | "manager" | "user",
    is_super_admin: false,
  })

  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    full_name: "",
    tenant_id: "",
    id_mktzap: "",
    role: "user" as "admin" | "manager" | "user",
    is_super_admin: false,
  })

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setFormData({
      tenant_id: profile.tenant_id || "",
      id_mktzap: profile.id_mktzap ?? "",
      role: profile.role,
      is_super_admin: profile.is_super_admin,
    })
  }

  const handleSave = async () => {
    if (!editingProfile) return

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        tenant_id: formData.tenant_id || null,
        id_mktzap: formData.id_mktzap || null,
        role: formData.role,
        is_super_admin: formData.is_super_admin,
      })
      .eq("id", editingProfile.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setEditingProfile(null)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.password) {
      setError("Email e senha são obrigatórios")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar usuário")
      }

      setNewUserData({
        email: "",
        password: "",
        full_name: "",
        tenant_id: "",
        id_mktzap: "",
        role: "user",
        is_super_admin: false,
      })
      setIsCreating(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/delete-user?id=${encodeURIComponent(deletingProfile.id)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao excluir usuário")
      setError(null)
      setDeletingProfile(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir usuário")
    } finally {
      setIsDeleting(false)
    }
  }

  const roleLabels = {
    admin: "Administrador",
    manager: "Gerente",
    user: "Usuário",
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsCreating(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Criar Usuário
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>ID MKTZAP</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Super Admin</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.full_name || "Sem nome"}</TableCell>
                <TableCell>
                  {profile.tenant?.name || <span className="text-muted-foreground">Não vinculado</span>}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground text-sm">{profile.id_mktzap ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{roleLabels[profile.role]}</Badge>
                </TableCell>
                <TableCell>{profile.is_super_admin && <Badge variant="default">Super Admin</Badge>}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingProfile(profile)
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>{editingProfile?.full_name || "Usuário sem nome"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Select
                value={formData.tenant_id}
                onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ID MKTZAP</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.id_mktzap}
                onChange={(e) => setFormData({ ...formData, id_mktzap: e.target.value })}
                placeholder="Identificador MKTZAP (opcional)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select
                value={formData.role}
                onValueChange={(value: "admin" | "manager" | "user") => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Super Admin</Label>
              <Switch
                checked={formData.is_super_admin}
                onCheckedChange={(checked) => setFormData({ ...formData, is_super_admin: checked })}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingProfile(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>Adicione um novo usuário ao sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Email *</Label>
              <input
                type="email"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                placeholder="usuario@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Senha *</Label>
              <input
                type="password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label>Nome Completo</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newUserData.full_name}
                onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                placeholder="João Silva"
              />
            </div>
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Select
                value={newUserData.tenant_id}
                onValueChange={(value) => setNewUserData({ ...newUserData, tenant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ID MKTZAP</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newUserData.id_mktzap}
                onChange={(e) => setNewUserData({ ...newUserData, id_mktzap: e.target.value })}
                placeholder="Identificador MKTZAP (opcional)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select
                value={newUserData.role}
                onValueChange={(value: "admin" | "manager" | "user") => setNewUserData({ ...newUserData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Super Admin</Label>
              <Switch
                checked={newUserData.is_super_admin}
                onCheckedChange={(checked) => setNewUserData({ ...newUserData, is_super_admin: checked })}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreating(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProfile} onOpenChange={(open) => !open && (setDeletingProfile(null), setError(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{deletingProfile?.full_name || deletingProfile?.id || "este usuário"}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive px-6">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
