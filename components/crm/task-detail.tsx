"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Trash2,
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  MessageSquare,
  Send,
  Pencil,
  X,
  Check,
} from "lucide-react";
import type { Task, Lead, Tag } from "@/lib/types";
import { formatInAppTimezone, isOverdueNextDayInAppTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface TaskDetailProps {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TaskDetail({ taskId, open, onOpenChange, onUpdate }: TaskDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [task, setTask] = useState<Task | null>(null);
  const [lead, setLead] = useState<(Lead & { 
    lead_sources: { name: string; type: string } | null;
    lead_tags: { tags: Tag }[];
    nationalities: { country: string } | null;
    us_states: { name: string; abbreviation: string } | null;
  }) | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    due_date: string;
    scheduled_at: string;
    start_time: string;
    end_time: string;
    type: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [leadNotes, setLeadNotes] = useState<
    { id: string; content: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskAndLead();
    }
  }, [open, taskId]);

  const fetchTaskAndLead = async () => {
    setLoading(true);
    
    // Buscar task
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskData) {
      setTask(taskData);
      setNote(taskData.note || "");

      // Buscar lead com todas as informações
      if (taskData.lead_id) {
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .select(`
            *,
            lead_sources (name, type),
            lead_tags (
              tags (id, name, color, type)
            ),
            nationalities (country),
            us_states (name, abbreviation)
          `)
          .eq("id", taskData.lead_id)
          .single();

        if (leadData) {
          setLead(leadData as any);
        }

        const { data: notesData } = await supabase
          .from("lead_notes")
          .select("id, content, created_at")
          .eq("lead_id", taskData.lead_id)
          .order("created_at", { ascending: false })
          .limit(8);
        setLeadNotes(notesData || []);
      } else {
        setLeadNotes([]);
      }
    }
    
    setLoading(false);
  };

  if (!task) return null;

  const isOverdue =
    !task.completed &&
    isOverdueNextDayInAppTimezone(task.scheduled_at || task.due_date);

  const handleToggleComplete = async () => {
    if (!task) return;
    
    const { error } = await supabase
      .from("tasks")
      .update({
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null,
        status: !task.completed ? "done" : "pending",
        done_at: !task.completed ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (!error) {
      await fetchTaskAndLead();
      onUpdate();
      router.refresh();
    }
  };

  const handleSaveNote = async () => {
    if (!task) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({ note })
      .eq("id", task.id);

    if (!error) {
      await fetchTaskAndLead();
      onUpdate();
      router.refresh();
    }
    setSaving(false);
  };

  const startEditing = () => {
    if (!task) return;
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : "",
      scheduled_at: task.scheduled_at ? new Date(task.scheduled_at).toISOString().slice(0, 16) : "",
      start_time: task.start_time || "",
      end_time: task.end_time || "",
      type: task.type || "task",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveEditing = async () => {
    if (!task || !editForm) return;
    setSavingEdit(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editForm.title,
        description: editForm.description || null,
        type: editForm.type,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
        scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : null,
      })
      .eq("id", task.id);

    if (!error) {
      setIsEditing(false);
      setEditForm(null);
      await fetchTaskAndLead();
      onUpdate();
      router.refresh();
    }
    setSavingEdit(false);
  };

  const handleDelete = async () => {
    if (!task) return;
    
    const confirmed = confirm("Tem certeza que deseja deletar esta task?");
    if (!confirmed) return;

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (!error) {
      onOpenChange(false);
      onUpdate();
      router.refresh();
    } else {
      alert("Erro ao deletar task");
    }
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto px-6">
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[900px] overflow-y-auto px-6">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl pr-8">{task.title}</SheetTitle>
              {task.description && (
                <SheetDescription className="mt-2">
                  {task.description}
                </SheetDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card da Task */}
          <Card className="border-border/50 h-fit">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Informações da Task</Label>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={startEditing}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {!isEditing && (
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={handleToggleComplete}
                      className="h-5 w-5"
                    />
                  )}
                </div>
              </div>

              {isEditing && editForm ? (
                /* Modo de edição */
                <div className="space-y-4">
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
                        <option value="task">Task</option>
                        <option value="callback">Callback</option>
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

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={saveEditing}
                      disabled={savingEdit || !editForm.title.trim()}
                    >
                      <Check className="w-4 h-4" />
                      {savingEdit ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={task.completed ? "default" : "secondary"}>
                      {task.completed ? "Concluída" : "Pendente"}
                    </Badge>
                    {isOverdue && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Atrasada
                      </Badge>
                    )}
                    {task.type === "callback" && (
                      <Badge variant="outline">Callback</Badge>
                    )}
                  </div>

                  {/* Datas e Horários */}
                  <div className="space-y-3 pt-2">
                    {task.scheduled_at && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Data agendada</p>
                          <p className="text-xs text-muted-foreground">
                            {formatInAppTimezone(task.scheduled_at, {
                              dateStyle: "long",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.due_date && (
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Data limite</p>
                          <p className="text-xs text-muted-foreground">
                            {formatInAppTimezone(task.due_date, {
                              dateStyle: "long",
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.start_time && (
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Horário</p>
                          <p className="text-xs text-muted-foreground">
                            {task.start_time}
                            {task.end_time && ` - ${task.end_time}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="note" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Observações
                    </Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Adicione observações sobre esta task..."
                      rows={4}
                      className="resize-none"
                    />
                    <Button
                      onClick={handleSaveNote}
                      disabled={saving}
                      className="w-full"
                      size="sm"
                    >
                      {saving ? "Salvando..." : "Salvar Observações"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card do Lead */}
          {lead ? (
            <Card className="border-border/50 h-fit">
              <CardContent className="p-6 space-y-5">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Informações do Lead
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    router.push(`/dashboard/pipeline?lead=${lead.id}`);
                  }}
                >
                  Ver todas as notas e histórico do lead
                </Button>

                {/* Nome e Empresa */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-linear-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {lead.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{lead.name}</p>
                      {lead.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" />
                          {lead.company}
                        </p>
                      )}
                    </div>
                  </div>

                {/* Ações Rápidas */}
                <div className="grid grid-cols-3 gap-2">
                  {(lead.whatsapp || lead.phone) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const phoneNumber = (lead.whatsapp || lead.phone)?.replace(/\D/g, '');
                        window.open(`https://wa.me/${phoneNumber}`, '_blank');
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </Button>
                  )}
                  {lead.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                    >
                      <Mail className="w-4 h-4" />
                      <span className="hidden sm:inline">Email</span>
                    </Button>
                  )}
                  {lead.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(`sms:${lead.phone.replace(/\D/g, '')}`, '_blank')}
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">SMS</span>
                    </Button>
                  )}
                </div>

                {/* Contatos */}
                <div className="space-y-3 pt-4">
                    {lead.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate text-foreground font-medium">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium">{lead.phone}</span>
                      </div>
                    )}
                    {lead.whatsapp && lead.whatsapp !== lead.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium">{lead.whatsapp}</span>
                      </div>
                    )}
                  </div>

                {/* Localização */}
                {(lead.nationalities || lead.us_states || lead.city) && (
                  <div className="space-y-2.5 pt-4 border-t">
                      {lead.nationalities && (
                        <div className="flex items-center gap-3 text-sm">
                          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-medium">{lead.nationalities.country}</span>
                        </div>
                      )}
                      {(lead.us_states || lead.city) && (
                        <div className="flex items-center gap-3 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-medium">
                            {lead.city && `${lead.city}`}
                            {lead.city && lead.us_states && ", "}
                            {lead.us_states && `${lead.us_states.abbreviation}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Tags */}
                {(lead.lead_sources || lead.lead_tags?.length > 0) && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-sm font-medium text-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {lead.lead_sources && (
                        <Badge
                          variant="outline"
                          className="text-xs px-2.5 py-1 font-medium"
                        >
                          {lead.lead_sources.name}
                        </Badge>
                      )}
                      {lead.lead_tags?.map(({ tags: tag }) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs px-2.5 py-1 font-medium border"
                          style={{ 
                            backgroundColor: tag.color + "15", 
                            color: tag.color,
                            borderColor: tag.color + "30"
                          }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valor do Deal */}
                {lead.deal_value && lead.deal_value > 0 && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-foreground">Valor do Deal</Label>
                    <p className="text-2xl font-bold text-primary mt-1.5">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(lead.deal_value)}
                    </p>
                  </div>
                )}

                {/* Notas do Lead */}
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-sm font-medium text-foreground">Notas do Lead</Label>
                  {leadNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma nota cadastrada para este lead.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {leadNotes.map((ln) => (
                        <div key={ln.id} className="rounded-md bg-muted/40 p-2.5">
                          <p className="text-xs text-foreground whitespace-pre-wrap">{ln.content}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {formatInAppTimezone(ln.created_at, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 h-fit">
              <CardContent className="p-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Informações do Lead
                </Label>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Esta task não está vinculada a nenhum lead
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
