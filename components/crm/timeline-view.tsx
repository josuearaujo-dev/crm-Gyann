"use client";

import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Pencil, X, Check } from "lucide-react";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatInAppTimezone } from "@/lib/timezone";

interface TimelineViewProps {
  initialTasks: (Task & { leads: { name: string; email: string; company: string | null } | null })[];
  userId: string;
}

export function TimelineView({ initialTasks, userId }: TimelineViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState(initialTasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
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
  const supabase = createClient();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateForQuery = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const changeDate = async (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);

    // Reload tasks for the new date
    const { data } = await supabase
      .from("tasks")
      .select("*, leads(name, email, company)")
      .eq("assigned_to", userId)
      .or(`and(due_date.gte.${formatDateForQuery(newDate)},due_date.lte.${formatDateForQuery(newDate)}T23:59:59),and(scheduled_at.gte.${formatDateForQuery(newDate)}T00:00:00,scheduled_at.lte.${formatDateForQuery(newDate)}T23:59:59)`)
      .order("scheduled_at", { ascending: true, nullsLast: true })
      .order("start_time", { ascending: true, nullsLast: true });

    if (data) {
      setTasks(data);
    }
  };

  const goToToday = async () => {
    const today = new Date();
    setSelectedDate(today);
    
    // Reload tasks for today
    const { data } = await supabase
      .from("tasks")
      .select("*, leads(name, email, company)")
      .eq("assigned_to", userId)
      .or(`and(due_date.gte.${formatDateForQuery(today)},due_date.lte.${formatDateForQuery(today)}T23:59:59),and(scheduled_at.gte.${formatDateForQuery(today)}T00:00:00,scheduled_at.lte.${formatDateForQuery(today)}T23:59:59)`)
      .order("scheduled_at", { ascending: true, nullsLast: true })
      .order("start_time", { ascending: true, nullsLast: true });

    if (data) {
      setTasks(data);
    }
  };

  const getTasksForHour = (hour: number) => {
    const hourStr = hour.toString().padStart(2, "0");
    return tasks.filter((task) => {
      // Para tasks com scheduled_at (callbacks)
      if (task.scheduled_at) {
        const scheduledDate = new Date(task.scheduled_at);
        const taskDate = formatDateForQuery(scheduledDate);
        const selectedDateStr = formatDateForQuery(selectedDate);
        
        if (taskDate !== selectedDateStr) return false;
        
        const taskHour = scheduledDate.getHours();
        return taskHour === hour;
      }
      
      // Para tasks regulares com start_time e due_date
      if (!task.start_time || !task.due_date) return false;
      
      const taskDate = formatDateForQuery(new Date(task.due_date));
      const selectedDateStr = formatDateForQuery(selectedDate);
      
      if (taskDate !== selectedDateStr) return false;

      const taskHour = parseInt(task.start_time.split(":")[0]);
      return taskHour === hour;
    });
  };

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
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

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditForm(null);
  };

  const saveEditingTask = async () => {
    if (!editingTaskId || !editForm) return;
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
      .eq("id", editingTaskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTaskId ? { ...t, ...updateData } : t))
      );
      setEditingTaskId(null);
      setEditForm(null);
    }
    setSavingEdit(false);
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const updateData: any = {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    };

    // Se concluindo, atualizar status para 'done' e done_at
    if (completed) {
      updateData.status = 'done';
      updateData.done_at = new Date().toISOString();
    } else {
      updateData.status = 'pending';
      updateData.done_at = null;
    }

    setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updateData } : t));
    await supabase.from("tasks").update(updateData).eq("id", taskId);
  };

  const getTaskDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 1;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const durationInMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return durationInMinutes / 60;
  };

  const isToday = formatDateForQuery(selectedDate) === formatDateForQuery(new Date());

  return (
    <div className="h-full flex flex-col p-6 lg:p-8 space-y-6 bg-gradient-to-br from-background via-background to-primary/[0.02]">
      <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <CalendarIcon className="w-6 h-6 text-primary" />
        <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">
              {formatDate(selectedDate)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? "task agendada" : "tasks agendadas"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          {!isToday && (
            <Button variant="outline" onClick={goToToday}>
              Hoje
            </Button>
          )}
          
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-y-auto">
          <div className="min-w-[600px]">
            {hours.map((hour) => {
              const hourTasks = getTasksForHour(hour);
              const currentHour = new Date().getHours();
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <div
                  key={hour}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-muted/30 transition-colors",
                    isCurrentHour && "bg-primary/5"
                  )}
                >
                  <div className="w-20 p-4 border-r border-border/50 bg-muted/20 flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "text-sm font-medium",
                        isCurrentHour ? "text-primary" : "text-muted-foreground"
                      )}>
                        {hour.toString().padStart(2, "0")}:00
                      </span>
                      {isCurrentHour && (
                        <Clock className="w-3 h-3 text-primary mt-1" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 p-3 min-h-[80px] space-y-2">
                    {hourTasks.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground/50">
                        {isCurrentHour && "Agora"}
                      </div>
                    ) : (
                      hourTasks.map((task) => {
                        const duration = getTaskDuration(task.start_time!, task.end_time);
                        const isEditing = editingTaskId === task.id;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "rounded-lg border transition-all",
                              isEditing
                                ? "border-primary/50 bg-card"
                                : task.completed
                                  ? "bg-muted/50 border-border/50"
                                  : "bg-primary/5 border-primary/20 hover:border-primary/40"
                            )}
                            style={{ minHeight: isEditing ? undefined : `${Math.max(duration * 40, 60)}px` }}
                          >
                            {isEditing && editForm ? (
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold text-primary">Editando Task</Label>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditingTask}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Título</Label>
                                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Descrição</Label>
                                  <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className="resize-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
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
                                <div className="grid grid-cols-2 gap-2">
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
                                  <Textarea value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} rows={2} className="resize-none" />
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" className="flex-1 gap-2" onClick={saveEditingTask} disabled={savingEdit || !editForm.title.trim()}>
                                    <Check className="w-4 h-4" />
                                    {savingEdit ? "Salvando..." : "Salvar"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditingTask}>Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3 p-3">
                                <Checkbox
                                  checked={task.completed}
                                  onCheckedChange={(checked) => handleToggleTask(task.id, checked as boolean)}
                                  className="mt-0.5 bg-primary-foreground flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("font-medium text-sm", task.completed && "line-through text-muted-foreground")}>
                                    {task.title}
                                  </p>
                                  {task.leads && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {task.leads.name}{task.leads.company && ` - ${task.leads.company}`}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    {task.type === 'callback' && task.scheduled_at ? (
                                      <>
                                        <Badge variant="secondary" className="text-xs">Callback</Badge>
                                        <Badge variant="outline" className="text-xs">
                                          <Clock className="w-3 h-3 mr-1" />
                                          {formatInAppTimezone(task.scheduled_at, { hour: '2-digit', minute: '2-digit' })}
                                        </Badge>
                                        {task.status === 'overdue' && !task.completed && (
                                          <Badge variant="destructive" className="text-xs">Atrasada</Badge>
                                        )}
                                      </>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {task.start_time}{task.end_time && ` - ${task.end_time}`}{!task.end_time && " (1h)"}
                                      </Badge>
                                    )}
                                    {task.note && <span className="text-xs text-muted-foreground italic">{task.note}</span>}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditingTask(task)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
