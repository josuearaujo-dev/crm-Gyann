"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Calendar, User, Search, Filter, CheckCircle2, Trash2, Pencil, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Task } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TasksTableProps {
  initialTasks: (Task & { 
    leads: { name: string; email: string; company: string | null } | null 
  })[];
}

export function TasksTable({ initialTasks }: TasksTableProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterType, setFilterType] = useState<"all" | "with_time" | "without_time">("all");
  const [editingTask, setEditingTask] = useState<typeof initialTasks[0] | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    due_date: string;
    scheduled_at: string;
    start_time: string;
    end_time: string;
    type: string;
    note: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({ 
        completed, 
        done_at: completed ? new Date().toISOString() : null 
      })
      .eq("id", taskId);

    if (!error) {
      setTasks(tasks.map(t => 
        t.id === taskId 
          ? { ...t, completed, done_at: completed ? new Date().toISOString() : null }
          : t
      ));
      router.refresh();
    }
  };

  const openEditTask = (task: typeof initialTasks[0]) => {
    setEditingTask(task);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : "",
      scheduled_at: task.scheduled_at ? new Date(task.scheduled_at).toISOString().slice(0, 16) : "",
      start_time: task.start_time || "",
      end_time: task.end_time || "",
      type: task.type || "task",
      note: task.note || "",
    });
  };

  const saveEditTask = async () => {
    if (!editingTask || !editForm) return;
    setSavingEdit(true);

    const updateData: Record<string, unknown> = {
      title: editForm.title,
      description: editForm.description || null,
      type: editForm.type,
      start_time: editForm.start_time || null,
      end_time: editForm.end_time || null,
      note: editForm.note || null,
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
      scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : null,
    };

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", editingTask.id);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...updateData } : t))
      );
      setEditingTask(null);
      setEditForm(null);
    }
    setSavingEdit(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = confirm("Tem certeza que deseja deletar esta task?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (!error) {
      setTasks(tasks.filter(t => t.id !== taskId));
      router.refresh();
    } else {
      console.error("[v0] Erro ao deletar task:", error);
      alert("Erro ao deletar task");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.leads?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      filterStatus === "all" ? true :
      filterStatus === "completed" ? task.completed :
      !task.completed;

    const matchesType =
      filterType === "all" ? true :
      filterType === "with_time" ? task.time :
      !task.time;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getTaskTypeLabel = (task: Task) => {
    if (task.type === "callback") return "Ligação";
    if (task.type === "meeting") return "Reunião";
    return "Tarefa";
  };

  const getTaskTypeColor = (task: Task) => {
    if (task.type === "callback") return "bg-blue-500";
    if (task.type === "meeting") return "bg-purple-500";
    return "bg-gray-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Todas as Tasks
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              Todas
            </Button>
            <Button
              variant={filterType === "with_time" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("with_time")}
            >
              <Clock className="w-4 h-4 mr-1" />
              Com Horário
            </Button>
            <Button
              variant={filterType === "without_time" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("without_time")}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Sem Horário
            </Button>
          </div>
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tarefa ou lead..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              Todas
            </Button>
            <Button
              variant={filterStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("pending")}
            >
              Pendentes
            </Button>
            <Button
              variant={filterStatus === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("completed")}
            >
              Concluídas
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead className="w-[90px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id} className={task.completed ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked) => 
                          handleToggleTask(task.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={`font-medium ${task.completed ? "line-through" : ""}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.leads ? (
                        <div>
                          <p className="font-medium">{task.leads.name}</p>
                          {task.leads.company && (
                            <p className="text-sm text-muted-foreground">
                              {task.leads.company}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={`${getTaskTypeColor(task)} text-white`}
                      >
                        {getTaskTypeLabel(task)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {format(new Date(task.due_date), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.start_time ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{task.start_time}</span>
                        </div>
                      ) : task.time ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{task.time}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sem horário</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditTask(task)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Sheet de edição */}
      <Sheet open={!!editingTask} onOpenChange={(open) => { if (!open) { setEditingTask(null); setEditForm(null); } }}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto px-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Task
            </SheetTitle>
          </SheetHeader>
          {editForm && (
            <div className="space-y-4 mt-6">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Título da task" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descrição (opcional)" rows={3} className="resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="task">Task</option>
                    <option value="callback">Callback</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data limite</Label>
                  <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data agendada</Label>
                <Input type="datetime-local" value={editForm.scheduled_at} onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hora início</Label>
                  <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora fim</Label>
                  <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="Observações..." rows={3} className="resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2" onClick={saveEditTask} disabled={savingEdit || !editForm.title.trim()}>
                  <Check className="w-4 h-4" />
                  {savingEdit ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => { setEditingTask(null); setEditForm(null); }}>
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
