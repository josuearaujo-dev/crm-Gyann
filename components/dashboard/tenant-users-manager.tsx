"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
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
import { Trash2, Pencil, Save, X } from "lucide-react"

interface TenantUser {
  id: string
  full_name: string | null
  role: string
  id_mktzap: string | null
  created_at: string
}

interface TenantUsersManagerProps {
  users: TenantUser[]
}

export function TenantUsersManager({ users }: TenantUsersManagerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [deletingUser, setDeletingUser] = useState<TenantUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    id_mktzap: "",
  })
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    id_mktzap: "",
  })

  const handleCreate = async () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Informe email e senha para criar o usuário.",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/tenant-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Falha ao criar usuário")
      }

      toast({
        title: "Usuário criado",
        description: `Usuário ${json.user?.email || ""} criado com papel usuário.`,
      })

      setFormData({
        full_name: "",
        email: "",
        password: "",
        id_mktzap: "",
      })
      router.refresh()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: error instanceof Error ? error.message : "Falha inesperada",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tenant-users?id=${encodeURIComponent(deletingUser.id)}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao excluir usuário")
      toast({ title: "Usuário excluído", description: "O usuário foi removido da empresa." })
      setDeletingUser(null)
      router.refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Falha ao excluir usuário",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const startEdit = (user: TenantUser) => {
    setEditingUserId(user.id)
    setEditFormData({
      full_name: user.full_name || "",
      id_mktzap: user.id_mktzap || "",
    })
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setEditFormData({ full_name: "", id_mktzap: "" })
  }

  const handleSaveEdit = async () => {
    if (!editingUserId) return
    setIsSavingEdit(true)
    try {
      const response = await fetch("/api/tenant-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUserId,
          full_name: editFormData.full_name,
          id_mktzap: editFormData.id_mktzap,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Falha ao salvar usuário")
      }

      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas.",
      })
      cancelEdit()
      router.refresh()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar usuário",
        description: error instanceof Error ? error.message : "Falha inesperada",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4 space-y-4">
        <p className="text-sm font-medium">Cadastrar novo usuário da empresa</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={formData.full_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, full_name: event.target.value }))}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="usuario@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha *</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Mínimo recomendado: 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label>ID MKTZAP</Label>
            <Input
              value={formData.id_mktzap}
              onChange={(event) => setFormData((prev) => ({ ...prev, id_mktzap: event.target.value }))}
              placeholder="ID do usuário no MKTZAP (opcional)"
            />
          </div>
        </div>
        <Button onClick={handleCreate} disabled={isLoading}>
          {isLoading ? "Criando..." : "Criar usuário"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>ID MKTZAP</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[80px] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum usuário com papel usuário cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {editingUserId === item.id ? (
                      <Input
                        value={editFormData.full_name}
                        onChange={(event) => setEditFormData((prev) => ({ ...prev, full_name: event.target.value }))}
                        placeholder="Nome completo"
                      />
                    ) : (
                      item.full_name || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {editingUserId === item.id ? (
                      <Input
                        value={editFormData.id_mktzap}
                        onChange={(event) => setEditFormData((prev) => ({ ...prev, id_mktzap: event.target.value }))}
                        placeholder="ID MKTZAP"
                      />
                    ) : (
                      item.id_mktzap || "—"
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editingUserId === item.id ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={handleSaveEdit} disabled={isSavingEdit}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={cancelEdit} disabled={isSavingEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingUser(item)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{deletingUser?.full_name || "este usuário"}</strong> da empresa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
    </div>
  )
}
