"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Pencil, X, Check, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatInAppTimezone } from "@/lib/timezone";

type MeetingWithLead = Meeting & { leads: { name: string; email: string; company: string | null } | null };

interface MeetingsTableProps {
  initialMeetings: MeetingWithLead[];
}

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

export function MeetingsTable({ initialMeetings }: MeetingsTableProps) {
  const supabase = createClient();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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

  const filtered = meetings.filter((m) => {
    const matchesSearch =
      m.leads?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.leads?.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Todas as Reuniões</CardTitle>
          <div className="flex items-center gap-3">
            {/* Filtro de status */}
            <div className="flex gap-1">
              {["all", "scheduled", "done", "no_show", "cancelled"].map((s) => (
                <Button
                  key={s}
                  variant={filterStatus === s ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setFilterStatus(s)}
                >
                  {s === "all" ? "Todas" : STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
            {/* Busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar reuniões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-52 text-sm"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Data e Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhuma reunião encontrada
                </TableCell>
              </TableRow>
            )}
            {filtered.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{meeting.leads?.name || "Lead removido"}</p>
                    {meeting.leads?.company && (
                      <p className="text-xs text-muted-foreground">{meeting.leads.company}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatInAppTimezone(meeting.scheduled_at, { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </TableCell>
                <TableCell>
                  {meeting.meeting_type ? (
                    <Badge variant="secondary" className="text-xs">
                      {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {meeting.duration_minutes ? `${meeting.duration_minutes} min` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[meeting.status] || "outline"} className="text-xs">
                    {STATUS_LABELS[meeting.status] || meeting.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="text-xs text-muted-foreground truncate">
                    {meeting.notes || "—"}
                  </p>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(meeting)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Sheet de edição */}
      <Sheet open={!!editingMeeting} onOpenChange={(open) => { if (!open) { setEditingMeeting(null); setEditForm(null); } }}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto px-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Reunião
            </SheetTitle>
          </SheetHeader>
          {editForm && (
            <div className="space-y-4 mt-6">
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
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={4} className="resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2" onClick={saveEdit} disabled={savingEdit}>
                  <Check className="w-4 h-4" />
                  {savingEdit ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => { setEditingMeeting(null); setEditForm(null); }}>
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
