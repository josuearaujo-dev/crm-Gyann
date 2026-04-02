"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatInAppTimezone } from "@/lib/timezone";

type MeetingWithLead = Meeting & { leads: { name: string; email: string; company: string | null } | null };

interface MeetingsCalendarViewProps {
  initialMeetings: MeetingWithLead[];
  userId: string;
}

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  done: "Realizada",
  no_show: "No Show",
  cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  done: "secondary",
  no_show: "destructive",
  cancelled: "outline",
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  zoom: "Zoom",
  phone: "Telefone",
  in_person: "Presencial",
  google_meet: "Google Meet",
  other: "Outro",
};

export function MeetingsCalendarView({ initialMeetings, userId }: MeetingsCalendarViewProps) {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetings, setMeetings] = useState(initialMeetings);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithLead | null>(null);
  const [editForm, setEditForm] = useState<{
    scheduled_at: string;
    duration_minutes: string;
    meeting_type: string;
    meeting_link: string;
    notes: string;
    status: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const getMeetingsForDate = (date: Date) =>
    meetings.filter((m) => {
      const d = new Date(m.scheduled_at);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
    });

  const selectedDateMeetings = selectedDate ? getMeetingsForDate(selectedDate) : [];

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const openEdit = (meeting: MeetingWithLead) => {
    setEditingMeeting(meeting);
    setEditForm({
      scheduled_at: meeting.scheduled_at ? new Date(meeting.scheduled_at).toISOString().slice(0, 16) : "",
      duration_minutes: meeting.duration_minutes?.toString() || "",
      meeting_type: meeting.meeting_type || "other",
      meeting_link: meeting.meeting_link || "",
      notes: meeting.notes || "",
      status: meeting.status || "scheduled",
    });
  };

  const cancelEdit = () => {
    setEditingMeeting(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingMeeting || !editForm) return;
    setSavingEdit(true);

    const updateData = {
      scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : editingMeeting.scheduled_at,
      duration_minutes: editForm.duration_minutes ? parseInt(editForm.duration_minutes) : null,
      meeting_type: editForm.meeting_type || null,
      meeting_link: editForm.meeting_link || null,
      notes: editForm.notes || null,
      status: editForm.status,
    };

    const { error } = await supabase.from("meetings").update(updateData).eq("id", editingMeeting.id);

    if (!error) {
      setMeetings((prev) =>
        prev.map((m) => (m.id === editingMeeting.id ? { ...m, ...updateData } : m))
      );
      setEditingMeeting(null);
      setEditForm(null);
    }
    setSavingEdit(false);
  };

  const handleMarkNoShow = async (meetingId: string) => {
    const { error } = await supabase.from("meetings").update({ status: "no_show" }).eq("id", meetingId);
    if (!error) {
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, status: "no_show" as const } : m)));
    }
  };

  const handleMarkDone = async (meetingId: string) => {
    const { error } = await supabase.from("meetings").update({ status: "done" }).eq("id", meetingId);
    if (!error) {
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, status: "done" as const } : m)));
    }
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date();

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header do calendário */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {MONTHS[currentMonth.getMonth()]} De {currentMonth.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Grade do calendário */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="min-h-[100px] border-r border-b border-border/40 bg-muted/20" />;
            const dayMeetings = getMeetingsForDate(day);
            const isToday = day.toDateString() === today.toDateString();
            const isSelected = selectedDate?.toDateString() === day.toDateString();
            const hasMeetings = dayMeetings.length > 0;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[100px] border-r border-b border-border/40 p-2 cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                  isToday && "bg-primary/5"
                )}
                onClick={() => setSelectedDate(isSelected ? null : day)}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium mb-1",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>
                  {day.getDate()}
                </div>

                <div className="space-y-1">
                  {dayMeetings.slice(0, 2).map((meeting) => (
                    <div
                      key={meeting.id}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded truncate font-medium",
                        meeting.status === "no_show" ? "bg-destructive/10 text-destructive" :
                        meeting.status === "done" ? "bg-muted text-muted-foreground line-through" :
                        "bg-chart-2/15 text-chart-2"
                      )}
                    >
                      {meeting.leads?.name || "Lead removido"}
                    </div>
                  ))}
                  {dayMeetings.length > 2 && (
                    <div className="text-xs text-muted-foreground px-1.5">
                      +{dayMeetings.length - 2} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet lateral de detalhes do dia */}
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
                  {selectedDateMeetings.length} {selectedDateMeetings.length === 1 ? "reunião agendada" : "reuniões agendadas"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-8">
                {selectedDateMeetings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma reunião agendada para este dia</p>
                  </div>
                ) : (
                  selectedDateMeetings.map((meeting) => {
                    const isEditing = editingMeeting?.id === meeting.id;

                    return (
                      <div
                        key={meeting.id}
                        className={cn(
                          "rounded-lg border transition-colors",
                          isEditing ? "border-primary/50 bg-card" : "border-border bg-muted/30"
                        )}
                      >
                        {isEditing && editForm ? (
                          <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold text-primary">Editando Reunião</Label>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Data e Hora</Label>
                              <Input type="datetime-local" value={editForm.scheduled_at} onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Tipo</Label>
                                <select value={editForm.meeting_type} onChange={(e) => setEditForm({ ...editForm, meeting_type: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                                  <option value="zoom">Zoom</option>
                                  <option value="phone">Telefone</option>
                                  <option value="in_person">Presencial</option>
                                  <option value="google_meet">Google Meet</option>
                                  <option value="other">Outro</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Duração (min)</Label>
                                <Input type="number" value={editForm.duration_minutes} onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })} placeholder="60" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                                <option value="scheduled">Agendada</option>
                                <option value="done">Realizada</option>
                                <option value="no_show">No Show</option>
                                <option value="cancelled">Cancelada</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Link da Reunião</Label>
                              <Input value={editForm.meeting_link} onChange={(e) => setEditForm({ ...editForm, meeting_link: e.target.value })} placeholder="https://..." />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Notas</Label>
                              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="resize-none" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" className="flex-1 gap-2" onClick={saveEdit} disabled={savingEdit}>
                                <Check className="w-4 h-4" />
                                {savingEdit ? "Salvando..." : "Salvar"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{meeting.leads?.name || "Lead removido"}</p>
                                {meeting.leads?.company && <p className="text-sm text-muted-foreground mt-0.5">{meeting.leads.company}</p>}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={STATUS_VARIANTS[meeting.status] || "outline"} className="text-xs">
                                  {STATUS_LABELS[meeting.status] || meeting.status}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(meeting)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-3">
                              <Badge variant="outline" className="text-xs gap-1">
                                <Clock className="w-3 h-3" />
                                {formatInAppTimezone(meeting.scheduled_at, { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                              {meeting.meeting_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                                </Badge>
                              )}
                              {meeting.duration_minutes && (
                                <Badge variant="outline" className="text-xs">{meeting.duration_minutes} min</Badge>
                              )}
                            </div>

                            {meeting.notes && (
                              <p className="text-xs text-muted-foreground mt-3 p-2.5 bg-background/60 rounded-md border border-border/50">
                                {meeting.notes}
                              </p>
                            )}

                            {meeting.meeting_link && (
                              <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-3">
                                Abrir link da reunião
                              </a>
                            )}

                            {meeting.status === "scheduled" && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleMarkDone(meeting.id)}
                                >
                                  Marcar como Realizada
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleMarkNoShow(meeting.id)}
                                >
                                  Marcar No Show
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
