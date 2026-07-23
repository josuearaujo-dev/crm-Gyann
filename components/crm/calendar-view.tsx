"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Pencil, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Task, Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatInAppTimezone } from "@/lib/timezone";

interface CalendarViewProps {
  initialTasks: (Task & { leads: { name: string; email: string; company: string | null } | null })[];
  initialMeetings: (Meeting & { leads: { name: string; email: string; company: string | null } | null })[];
  userId: string;
}

export function CalendarView({ initialTasks, initialMeetings, userId }: CalendarViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState(initialTasks);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateForQuery = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = formatDateForQuery(date);
    return tasks.filter((task) => {
      if (task.scheduled_at) {
        const taskDate = formatDateForQuery(new Date(task.scheduled_at));
        return taskDate === dateStr;
      }
      if (task.due_date) {
        const taskDate = formatDateForQuery(new Date(task.due_date));
        return taskDate === dateStr;
      }
      return false;
    });
  };

  const getMeetingsForDate = (date: Date) => {
    const dateStr = formatDateForQuery(date);
    return meetings.filter((meeting) => {
      const meetingDate = formatDateForQuery(new Date(meeting.scheduled_at));
      return meetingDate === dateStr;
    });
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({ completed, done_at: completed ? new Date().toISOString() : null })
      .eq("id", taskId);

    if (!error) {
      router.refresh();
    }
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
      type: task.type === "callback" ? "callback" : "manual",
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

    const taskType =
      editForm.type === "callback" ? "callback" : "manual";

    const updateData: Record<string, unknown> = {
      title: editForm.title,
      description: editForm.description || null,
      type: taskType,
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
      // Atualiza o estado local imediatamente sem precisar de router.refresh()
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId ? { ...t, ...updateData } : t
        )
      );
      setEditingTaskId(null);
      setEditForm(null);
    }
    setSavingEdit(false);
  };

  const handleNoShow = async (meetingId: string) => {
    const confirmed = confirm("Marcar esta reunião como 'No Show' (cliente não compareceu)?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("meetings")
      .update({ status: "no_show" })
      .eq("id", meetingId);

    if (!error) {
      router.refresh();
    } else {
      console.error("[v0] Erro ao marcar no-show:", error);
      alert("Erro ao marcar no-show");
    }
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];
  const selectedDateMeetings = selectedDate ? getMeetingsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold capitalize">{monthName}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendário Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {/* Week days header */}
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="min-h-[100px] p-2 bg-muted/20 rounded-lg" />;
              }

              const dayTasks = getTasksForDate(day);
              const dayMeetings = getMeetingsForDate(day);
              const isToday = formatDateForQuery(day) === formatDateForQuery(new Date());
              const isSelected = selectedDate && formatDateForQuery(day) === formatDateForQuery(selectedDate);

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[100px] p-2 rounded-lg border-2 transition-all hover:border-primary/50 text-left",
                    isToday && "bg-primary/5 border-primary",
                    isSelected && "bg-primary/10 border-primary",
                    !isToday && !isSelected && "border-border bg-card"
                  )}
                >
                  <div className="font-semibold text-sm mb-2">{day.getDate()}</div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "text-xs px-2 py-1 rounded truncate",
                          task.type === 'callback' ? "bg-chart-3/20 text-chart-3" : "bg-chart-1/20 text-chart-1",
                          task.completed && "line-through opacity-50"
                        )}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayMeetings.slice(0, 2).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="text-xs px-2 py-1 rounded truncate bg-chart-2/20 text-chart-2"
                      >
                        Reunião: {meeting.leads?.name || "Lead"}
                      </div>
                    ))}
                    {(dayTasks.length + dayMeetings.length) > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{(dayTasks.length + dayMeetings.length) - 2} mais
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details Drawer */}
      <Sheet open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto px-6">
          {selectedDate && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  {formatDate(selectedDate)}
                </SheetTitle>
                <SheetDescription>
                  {selectedDateTasks.length + selectedDateMeetings.length} {selectedDateTasks.length + selectedDateMeetings.length === 1 ? 'item agendado' : 'itens agendados'}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-8 mt-8">
                {/* Tasks */}
                {selectedDateTasks.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Tarefas ({selectedDateTasks.length})
                    </h3>
                    <div className="space-y-4">
                      {selectedDateTasks.map((task) => {
                        const isEditing = editingTaskId === task.id;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "rounded-lg border transition-colors",
                              isEditing
                                ? "border-primary/50 bg-card"
                                : "bg-muted/50 border-border hover:bg-muted"
                            )}
                          >
                            {isEditing && editForm ? (
                              /* Modo de edição */
                              <div className="p-5 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                  <Label className="text-sm font-semibold text-primary">Editando Task</Label>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditingTask}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Título</Label>
                                  <Input
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    placeholder="Título da task"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Descrição</Label>
                                  <Textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    placeholder="Descrição (opcional)"
                                    rows={2}
                                    className="resize-none"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Tipo</Label>
                                    <select
                                      value={editForm.type}
                                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    >
                                      <option value="manual">Tarefa</option>
                                      <option value="callback">Callback (ligar)</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Data limite</Label>
                                    <Input
                                      type="date"
                                      value={editForm.due_date}
                                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Data agendada</Label>
                                  <Input
                                    type="datetime-local"
                                    value={editForm.scheduled_at}
                                    onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Hora início</Label>
                                    <Input
                                      type="time"
                                      value={editForm.start_time}
                                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Hora fim</Label>
                                    <Input
                                      type="time"
                                      value={editForm.end_time}
                                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Observações</Label>
                                  <Textarea
                                    value={editForm.note}
                                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                    placeholder="Observações..."
                                    rows={2}
                                    className="resize-none"
                                  />
                                </div>

                                <div className="flex gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={saveEditingTask}
                                    disabled={savingEdit || !editForm.title.trim()}
                                  >
                                    <Check className="w-4 h-4" />
                                    {savingEdit ? "Salvando..." : "Salvar"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditingTask}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* Modo de visualização */
                              <div className="flex items-start gap-4 p-5">
                                <Checkbox
                                  checked={task.completed}
                                  onCheckedChange={(checked) => handleTaskToggle(task.id, checked as boolean)}
                                  className="mt-0.5 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("font-medium text-sm", task.completed && "line-through text-muted-foreground")}>
                                    {task.title}
                                  </p>
                                  {task.leads && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {task.leads.name}
                                      {task.leads.company && ` - ${task.leads.company}`}
                                    </p>
                                  )}
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {task.type === 'callback' && (
                                      <Badge variant="secondary" className="text-xs">
                                        Callback
                                      </Badge>
                                    )}
                                    {task.scheduled_at && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatInAppTimezone(task.scheduled_at, { hour: '2-digit', minute: '2-digit' })}
                                      </Badge>
                                    )}
                                    {task.start_time && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Clock className="w-3 h-3" />
                                        {task.start_time}
                                        {task.end_time && ` - ${task.end_time}`}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditingTask(task)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Meetings */}
                {selectedDateMeetings.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Reuniões ({selectedDateMeetings.length})
                    </h3>
                    <div className="space-y-4">
                      {selectedDateMeetings.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="p-5 rounded-lg bg-chart-2/10 border border-chart-2/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{meeting.leads?.name || "Lead removido"}</p>
                              {meeting.leads?.company && (
                                <p className="text-sm text-muted-foreground mt-0.5">{meeting.leads.company}</p>
                              )}
                            </div>
                            {meeting.status === "no_show" && (
                              <Badge variant="destructive" className="text-xs">
                                No Show
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              {formatInAppTimezone(meeting.scheduled_at, { hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                            {meeting.meeting_type && (
                              <Badge variant="secondary" className="text-xs">
                                {meeting.meeting_type}
                              </Badge>
                            )}
                            {meeting.duration_minutes && (
                              <Badge variant="outline" className="text-xs">
                                {meeting.duration_minutes} min
                              </Badge>
                            )}
                          </div>

                          {meeting.notes && (
                            <p className="text-xs text-muted-foreground mt-3 p-2 bg-background/50 rounded">
                              {meeting.notes}
                            </p>
                          )}
                          
                          {meeting.meeting_link && (
                            <a
                              href={meeting.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-3"
                            >
                              🔗 Abrir link da reunião
                            </a>
                          )}
                          
                          {meeting.status !== "no_show" && meeting.status !== "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full"
                              onClick={() => handleNoShow(meeting.id)}
                            >
                              Marcar No Show
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateTasks.length === 0 && selectedDateMeetings.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma tarefa ou reunião agendada para este dia</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
