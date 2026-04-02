"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  X,
  Mail,
  Phone,
  Building,
  Calendar,
  Plus,
  Trash2,
  StickyNote,
  CheckSquare,
  Tag as TagIcon,
  ChevronDown,
  Check,
  PhoneCall,
  DollarSign,
  TrophyIcon,
  XCircle,
  CheckCircle,
  MessageSquare,
  Send,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Lead, Tag, PipelineColumn, Task, LeadNote, USState, Nationality, LeadInstallment } from "@/lib/types";
import { getWonPipelineColumn } from "@/lib/pipeline-utils";
import { CallbackModal } from "@/components/crm/callback-modal";
import { MeetingModal } from "@/components/crm/meeting-modal";
import { MarkLostDialog } from "@/components/crm/mark-lost-dialog";
import { MarkFinishedDialog } from "@/components/crm/mark-finished-dialog";
import { formatInAppTimezone } from "@/lib/timezone";

interface LeadDetailProps {
  lead: Lead & {
    lead_sources: { name: string; color: string } | null;
    lead_tags: { tags: Tag }[];
    us_states?: { name: string; abbreviation: string } | null;
    nationalities?: { country: string; nationality: string } | null;
  };
  tags: Tag[];
  columns: PipelineColumn[];
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadDetail({
  lead,
  tags,
  columns,
  onClose,
  onUpdate,
}: LeadDetailProps) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [states, setStates] = useState<USState[]>([]);
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskStartTime, setNewTaskStartTime] = useState("");
  const [newTaskEndTime, setNewTaskEndTime] = useState("");
  const [selectedColumn, setSelectedColumn] = useState(lead.column_id || "");
  const [selectedState, setSelectedState] = useState(lead.state_id || "");
  const [selectedNationality, setSelectedNationality] = useState(lead.nationality_id || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    lead.lead_tags?.map((lt) => lt.tags.id) || []
  );
  
  // Estados dos popovers
  const [openState, setOpenState] = useState(false);
  const [openNationality, setOpenNationality] = useState(false);
  const [openQualificacao, setOpenQualificacao] = useState(false);
  const [openTemperatura, setOpenTemperatura] = useState(false);
  const [openTentativaContato, setOpenTentativaContato] = useState(false);
  const [openFollowUp, setOpenFollowUp] = useState(false);
  const [openCallbackModal, setOpenCallbackModal] = useState(false);
  const [openMeetingModal, setOpenMeetingModal] = useState(false);
  
  const supabase = createClient();
  const [isMarkingWon, setIsMarkingWon] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showFinishedDialog, setShowFinishedDialog] = useState(false);
  const [installments, setInstallments] = useState<LeadInstallment[]>([]);
  const [firstDueForGen, setFirstDueForGen] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [generatingInstallments, setGeneratingInstallments] = useState(false);

  const loadInstallments = async () => {
    const { data, error } = await supabase
      .from("lead_installments")
      .select("*")
      .eq("lead_id", lead.id)
      .order("sort_order", { ascending: true })
      .order("due_date", { ascending: true });
    if (!error && data) {
      setInstallments(data as LeadInstallment[]);
    }
  };

  useEffect(() => {
    loadNotes();
    loadTasks();
    loadStates();
    loadNationalities();
    loadInstallments();
  }, [lead.id]);

  const syncAmountReceivedFromInstallments = async (rows: LeadInstallment[]) => {
    const paid = rows.filter((r) => r.paid_at).reduce((s, r) => s + Number(r.amount), 0);
    const cap = Number(lead.deal_value || 0);
    await supabase
      .from("leads")
      .update({ amount_received: Math.min(paid, cap) })
      .eq("id", lead.id);
  };

  const handleGenerateInstallments = async () => {
    const n = Math.max(2, lead.installments_count || 2);
    const totalCents = Math.round(Number(lead.deal_value || 0) * 100);
    if (totalCents <= 0) return;
    const base = Math.floor(totalCents / n);
    const amounts: number[] = [];
    let acc = 0;
    for (let i = 0; i < n - 1; i++) {
      amounts.push(base / 100);
      acc += base;
    }
    amounts.push((totalCents - acc) / 100);

    const start = new Date(firstDueForGen + "T12:00:00");
    const rows = amounts.map((amount, i) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      return {
        lead_id: lead.id,
        sort_order: i,
        amount,
        due_date: d.toISOString().slice(0, 10),
        paid_at: null as string | null,
      };
    });

    setGeneratingInstallments(true);
    const { error: delErr } = await supabase.from("lead_installments").delete().eq("lead_id", lead.id);
    if (delErr) {
      console.error(delErr);
      alert("Não foi possível limpar parcelas antigas. Rode o script SQL 025 no banco se a tabela não existir.");
      setGeneratingInstallments(false);
      return;
    }
    const { error: insErr } = await supabase.from("lead_installments").insert(rows);
    setGeneratingInstallments(false);
    if (insErr) {
      console.error(insErr);
      alert("Erro ao gerar parcelas. Confirme a migração lead_installments (scripts/025).");
      return;
    }
    await loadInstallments();
    await syncAmountReceivedFromInstallments([]);
    onUpdate();
  };

  const handleToggleInstallmentPaid = async (row: LeadInstallment, paid: boolean) => {
    const paid_at = paid ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("lead_installments")
      .update({ paid_at })
      .eq("id", row.id);
    if (error) return;
    const next = installments.map((r) => (r.id === row.id ? { ...r, paid_at } : r));
    setInstallments(next);
    await syncAmountReceivedFromInstallments(next);
    onUpdate();
  };

  const handleInstallmentFieldBlur = async (row: LeadInstallment, patch: Partial<LeadInstallment>) => {
    const amount = patch.amount != null ? Number(patch.amount) : Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const due_date = patch.due_date ?? row.due_date;
    const { error } = await supabase
      .from("lead_installments")
      .update({ amount, due_date })
      .eq("id", row.id);
    if (!error) {
      await loadInstallments();
      onUpdate();
    }
  };

  const handleDeleteInstallment = async (id: string) => {
    const { error } = await supabase.from("lead_installments").delete().eq("id", id);
    if (!error) {
      const next = installments.filter((r) => r.id !== id);
      setInstallments(next);
      await syncAmountReceivedFromInstallments(next);
      onUpdate();
    }
  };

  const handleAddInstallment = async () => {
    const maxOrder = installments.reduce((m, r) => Math.max(m, r.sort_order), -1);
    const lastDue =
      installments.length > 0
        ? installments[installments.length - 1].due_date
        : firstDueForGen;
    const d = new Date(lastDue + "T12:00:00");
    d.setMonth(d.getMonth() + 1);
    const { error } = await supabase.from("lead_installments").insert({
      lead_id: lead.id,
      sort_order: maxOrder + 1,
      amount: 0.01,
      due_date: d.toISOString().slice(0, 10),
      paid_at: null,
    });
    if (!error) {
      await loadInstallments();
      onUpdate();
    }
  };

  const loadStates = async () => {
    const { data } = await supabase
      .from("us_states")
      .select("*")
      .order("name", { ascending: true });
    setStates(data || []);
  };

  const loadNationalities = async () => {
    const { data } = await supabase
      .from("nationalities")
      .select("*")
      .order("country", { ascending: true });
    setNationalities(data || []);
  };

  const loadNotes = async () => {
    const { data } = await supabase
      .from("lead_notes")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    setNotes(data || []);
  };

  const loadTasks = async () => {
    console.log("[v0] Loading tasks for lead:", lead.id);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("lead_id", lead.id)
      .order("due_date", { ascending: true });
    
    if (error) {
      console.error("[v0] Error loading tasks:", error);
    } else {
      console.log("[v0] Tasks loaded:", data?.length || 0, "tasks", data);
    }
    
    setTasks(data || []);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("lead_notes")
      .insert({
        lead_id: lead.id,
        content: newNote,
        created_by: user?.id,
      })
      .select()
      .single();

    if (!error && data) {
      setNotes([data, ...notes]);
      setNewNote("");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

    if (!error) {
      setNotes(notes.filter((n) => n.id !== noteId));
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();

    // Se tem horário de início mas não tem fim, adiciona 1h
    let endTime = newTaskEndTime;
    if (newTaskStartTime && !newTaskEndTime) {
      const [hours, minutes] = newTaskStartTime.split(':');
      const endHour = (parseInt(hours) + 1).toString().padStart(2, '0');
      endTime = `${endHour}:${minutes}`;
    }

    // Verifica se há conflito de horário
    if (newTaskDueDate && newTaskStartTime && endTime) {
      const dateOnly = newTaskDueDate.split('T')[0];
      
      const { data: conflictingTasks, error: fetchError } = await supabase
        .from("tasks")
        .select("id, title, start_time, end_time")
        .eq("assigned_to", user?.id)
        .eq("completed", false)
        .gte("due_date", `${dateOnly}T00:00:00`)
        .lte("due_date", `${dateOnly}T23:59:59`);

      if (fetchError) {
        console.error('[v0] Error checking conflicts:', fetchError);
      }

      if (conflictingTasks && conflictingTasks.length > 0) {
        const tasksWithTime = conflictingTasks.filter(t => t.start_time && t.end_time);
        
        const hasConflict = tasksWithTime.some(task => {
          // Converte times para minutos para comparação precisa
          const toMinutes = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
          };
          
          const newStartMin = toMinutes(newTaskStartTime);
          const newEndMin = toMinutes(endTime);
          const taskStartMin = toMinutes(task.start_time!);
          const taskEndMin = toMinutes(task.end_time!);
          
          // Verifica sobreposição
          return (newStartMin < taskEndMin && newEndMin > taskStartMin);
        });

        if (hasConflict) {
          alert('Já existe uma task marcada para este horário. Por favor, escolha outro horário.');
          return;
        }
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        lead_id: lead.id,
        title: newTaskTitle,
        type: "manual",
        status: "pending",
        due_date: newTaskDueDate || null,
        start_time: newTaskStartTime || null,
        end_time: endTime || null,
        assigned_to: user?.id,
        created_by: user?.id,
      })
      .select()
      .single();

    if (!error && data) {
      setTasks([...tasks, data]);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setNewTaskStartTime("");
      setNewTaskEndTime("");
      onUpdate();
    } else if (error) {
      console.error('[v0] Error creating task:', error);
      alert('Erro ao criar task. Verifique se não há conflito de horário.');
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({ completed })
      .eq("id", taskId);

    if (!error) {
      setTasks(
        tasks.map((t) => (t.id === taskId ? { ...t, completed } : t))
      );
      onUpdate();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (!error) {
      setTasks(tasks.filter((t) => t.id !== taskId));
      onUpdate();
    }
  };

  const handleColumnChange = async (columnId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ column_id: columnId })
      .eq("id", lead.id);

    if (!error) {
      setSelectedColumn(columnId);
      onUpdate();
    }
  };

  const handleStateChange = async (stateId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ state_id: stateId })
      .eq("id", lead.id);

    if (!error) {
      setSelectedState(stateId);
      onUpdate();
    }
  };

  const handleNationalityChange = async (nationalityId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ nationality_id: nationalityId })
      .eq("id", lead.id);

    if (!error) {
      setSelectedNationality(nationalityId);
      onUpdate();
    }
  };

  const handleMarkAsWon = async () => {
    // Validar se o valor foi preenchido
    const currentValue = lead.deal_value || 0;
    if (currentValue <= 0) {
      alert("Por favor, preencha o valor do negócio antes de marcar como ganho.");
      return;
    }

    const paymentModel = lead.payment_model || "full";
    const receivedAmount =
      paymentModel === "full"
        ? currentValue
        : Number(lead.amount_received || 0);

    if (receivedAmount < 0 || receivedAmount > currentValue) {
      alert("O valor recebido deve estar entre 0 e o valor total do negócio.");
      return;
    }

    setIsMarkingWon(true);

    try {
      const wonColumnId = getWonPipelineColumn(columns)?.id;
      if (!wonColumnId) {
        alert(
          "Não há coluna de vitória no pipeline (ex.: «Venda Feita»). Configure o funil antes de marcar ganho."
        );
        return;
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          column_id: wonColumnId,
          payment_model: paymentModel,
          amount_received: receivedAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      if (updateError) {
        console.error("[v0] Error marking as won:", updateError);
        alert("Erro ao marcar lead como ganho. Tente novamente.");
      } else {
        onUpdate();
        onClose();
      }
    } catch (err) {
      console.error("[v0] Error in handleMarkAsWon:", err);
      alert("Erro ao marcar lead como ganho.");
    } finally {
      setIsMarkingWon(false);
    }
  };

  const handleTagToggle = async (tagId: string) => {
    const isSelected = selectedTags.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from("lead_tags")
        .delete()
        .eq("lead_id", lead.id)
        .eq("tag_id", tagId);

      if (!error) {
        setSelectedTags(selectedTags.filter((t) => t !== tagId));
      }
    } else {
      const { error } = await supabase.from("lead_tags").insert({
        lead_id: lead.id,
        tag_id: tagId,
      });

      if (!error) {
        setSelectedTags([...selectedTags, tagId]);
      }
    }
    onUpdate();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
  <>
  <Sheet open={true} onOpenChange={onClose}>
  <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 bg-background">
  <SheetHeader className="space-y-6 p-8 pb-6 bg-muted/30">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {lead.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <SheetTitle className="text-xl">{lead.name}</SheetTitle>
                {lead.company && (
                  <p className="text-sm text-muted-foreground">{lead.company}</p>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setOpenCallbackModal(true)}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                Ligar Novamente
              </Button>
              <Button
                onClick={() => setOpenMeetingModal(true)}
                size="sm"
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                Marcar Reunião
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="px-8 pb-8 space-y-8">
          <div className="grid grid-cols-1 gap-3">
            {lead.email && (
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground">{lead.email}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  asChild
                >
                  <a href={`mailto:${lead.email}`} target="_blank" rel="noopener noreferrer">
                    <Send className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground">{lead.phone}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={`sms:${lead.phone.replace(/\D/g, '')}`} title="SMS">
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <Building className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{lead.company}</span>
              </div>
            )}
            {lead.metadata?.segmento && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <TagIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Segmento</span>
                  <span className="text-sm text-foreground">{lead.metadata.segmento}</span>
                </div>
              </div>
            )}
            {lead.metadata?.faturamento && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <DollarSign className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Faturamento Mensal</span>
                  <span className="text-sm text-foreground">{lead.metadata.faturamento}</span>
                </div>
              </div>
            )}
          </div>

          {/* Valor do Lead */}
          <div className="space-y-2">
            <Label>Valor do Negócio (USD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={lead.deal_value || 0}
              onChange={async (e) => {
                const value = parseFloat(e.target.value) || 0;
                await supabase
                  .from("leads")
                  .update({ deal_value: value })
                  .eq("id", lead.id);
                onUpdate();
              }}
              placeholder="0.00"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Este valor será somado ao valor potencial enquanto o lead estiver em aberto, 
              e ao valor realizado quando for fechado ganho.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={lead.payment_model || "full"}
                  onValueChange={async (value) => {
                    const nextModel = value as "full" | "installments" | "entry_plus_installments";
                    const updates: Record<string, unknown> = {
                      payment_model: nextModel,
                    };
                    if (nextModel === "full") {
                      updates.amount_received = Number(lead.deal_value || 0);
                      updates.installments_count = null;
                    }
                    if (nextModel === "installments" && !lead.installments_count) {
                      updates.installments_count = 2;
                    }
                    if (nextModel === "entry_plus_installments" && !lead.installments_count) {
                      updates.installments_count = 2;
                    }
                    await supabase.from("leads").update(updates).eq("id", lead.id);
                    onUpdate();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Integral</SelectItem>
                    <SelectItem value="installments">Parcelado</SelectItem>
                    <SelectItem value="entry_plus_installments">Entrada + Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor Recebido em Caixa (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={lead.deal_value || 0}
                  value={
                    lead.payment_model === "full"
                      ? Number(lead.deal_value || 0)
                      : Number(lead.amount_received || 0)
                  }
                  disabled={(lead.payment_model || "full") === "full"}
                  onChange={async (e) => {
                    const raw = parseFloat(e.target.value);
                    const total = Number(lead.deal_value || 0);
                    const value = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), total) : 0;
                    await supabase
                      .from("leads")
                      .update({ amount_received: value })
                      .eq("id", lead.id);
                    onUpdate();
                  }}
                  placeholder="0.00"
                />
              </div>

              {(lead.payment_model === "installments" || lead.payment_model === "entry_plus_installments") && (
                <div className="space-y-2">
                  <Label>Quantidade de Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    step="1"
                    value={lead.installments_count || 2}
                    onChange={async (e) => {
                      const raw = parseInt(e.target.value, 10);
                      const value = Number.isFinite(raw) ? Math.max(raw, 2) : 2;
                      await supabase
                        .from("leads")
                        .update({ installments_count: value })
                        .eq("id", lead.id);
                      onUpdate();
                    }}
                    placeholder="2"
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Coorte: total já recebido e saldo a receber. Com parcelas cadastradas, o relatório também mostra caixa /
              previsto / em aberto na janela da campanha.
            </p>

            {(lead.payment_model === "installments" ||
              lead.payment_model === "entry_plus_installments") &&
              Number(lead.deal_value || 0) > 0 && (
                <div className="rounded-lg border border-border p-4 space-y-3 mt-3">
                  <p className="text-sm font-medium">Parcelas (vencimento e pagamento)</p>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-[140px]">
                      <Label className="text-xs">Primeiro vencimento</Label>
                      <Input
                        type="date"
                        value={firstDueForGen}
                        onChange={(e) => setFirstDueForGen(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={generatingInstallments}
                      onClick={() => {
                        if (
                          installments.length > 0 &&
                          !confirm("Substituir todas as parcelas por uma nova grade igual?")
                        ) {
                          return;
                        }
                        void handleGenerateInstallments();
                      }}
                    >
                      {generatingInstallments ? "Gerando..." : "Gerar parcelas iguais"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleAddInstallment()}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Relatório: data de pagamento → recebido no período; vencimento → previsto / em aberto na janela.
                  </p>
                  {installments.length > 0 && (
                    <div className="space-y-2">
                      {installments.map((row) => (
                        <div
                          key={`${row.id}-${row.amount}-${row.due_date}-${row.paid_at ?? ""}`}
                          className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="w-28 h-8"
                            defaultValue={row.amount}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v) && v > 0) {
                                void handleInstallmentFieldBlur(row, { amount: v });
                              }
                            }}
                          />
                          <Input
                            type="date"
                            className="w-36 h-8"
                            defaultValue={row.due_date}
                            onBlur={(e) => {
                              if (e.target.value) {
                                void handleInstallmentFieldBlur(row, { due_date: e.target.value });
                              }
                            }}
                          />
                          <label className="flex items-center gap-2 text-xs cursor-pointer shrink-0">
                            <Checkbox
                              checked={Boolean(row.paid_at)}
                              onCheckedChange={(c) => void handleToggleInstallmentPaid(row, c === true)}
                            />
                            Pago
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => void handleDeleteInstallment(row.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            
            {/* Ações Rápidas */}
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleMarkAsWon}
                        disabled={isMarkingWon || (lead.deal_value || 0) <= 0}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <TrophyIcon className="w-4 h-4 mr-2" />
                        {isMarkingWon ? "Marcando..." : "Marcar como Ganho"}
                      </Button>
                      <Button
                        onClick={() => setShowLostDialog(true)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Marcar como Perdido
                      </Button>
                    </div>
                    <Button
                      onClick={() => setShowFinishedDialog(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marcar como Finalizado
                    </Button>
                  </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>País</Label>
              <Popover open={openNationality} onOpenChange={setOpenNationality}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openNationality}
                    className="w-full justify-between bg-transparent"
                  >
                    {selectedNationality
                      ? nationalities.find((n) => n.id === selectedNationality)?.country
                      : "Selecione o país"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar país..." />
                    <CommandList>
                      <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
                      <CommandGroup>
                        {nationalities.map((nat) => (
                          <CommandItem
                            key={nat.id}
                            value={nat.country}
                            onSelect={() => {
                              handleNationalityChange(nat.id);
                              setOpenNationality(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedNationality === nat.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {nat.country}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Etapa do Pipeline</Label>
              <Select value={selectedColumn} onValueChange={handleColumnChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: col.color }}
                        />
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado (EUA)</Label>
              <Popover open={openState} onOpenChange={setOpenState}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openState}
                    className="w-full justify-between bg-transparent"
                  >
                    {selectedState
                      ? `${states.find((s) => s.id === selectedState)?.abbreviation} - ${states.find((s) => s.id === selectedState)?.name}`
                      : "Selecione um estado"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar estado..." />
                    <CommandList>
                      <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                      <CommandGroup>
                        {states.map((state) => (
                          <CommandItem
                            key={state.id}
                            value={`${state.abbreviation} ${state.name}`}
                            onSelect={() => {
                              handleStateChange(state.id);
                              setOpenState(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedState === state.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {state.abbreviation} - {state.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base">
              <TagIcon className="w-4 h-4" />
              Tags
            </Label>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Qualificação */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Qualificação</Label>
                <Popover open={openQualificacao} onOpenChange={setOpenQualificacao}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openQualificacao}
                      className="w-full justify-between bg-transparent"
                    >
                      <span className="truncate">
                        {selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'QUALIFICACAO')).length > 0
                          ? `${selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'QUALIFICACAO')).length} selecionadas`
                          : "Selecione"}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup>
                          {tags.filter(t => t.type === 'QUALIFICACAO').map((tag) => (
                            <CommandItem
                              key={tag.id}
                              value={tag.name}
                              onSelect={() => handleTagToggle(tag.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name.replace('QUAL_', '')}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Temperatura */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Temperatura</Label>
                <Popover open={openTemperatura} onOpenChange={setOpenTemperatura}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openTemperatura}
                      className="w-full justify-between bg-transparent"
                    >
                      <span className="truncate">
                        {selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'TEMPERATURA')).length > 0
                          ? `${selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'TEMPERATURA')).length} selecionadas`
                          : "Selecione"}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup>
                          {tags.filter(t => t.type === 'TEMPERATURA').map((tag) => (
                            <CommandItem
                              key={tag.id}
                              value={tag.name}
                              onSelect={() => handleTagToggle(tag.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name.replace('TEMP_', '')}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tentativas de Contato */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Tentativas de Primeiro Contato</Label>
                <Popover open={openTentativaContato} onOpenChange={setOpenTentativaContato}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openTentativaContato}
                      className="w-full justify-between bg-transparent"
                    >
                      <span className="truncate">
                        {selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'TENTATIVA_CONTATO')).length > 0
                          ? `${selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'TENTATIVA_CONTATO')).length} selecionadas`
                          : "Selecione"}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup>
                          {tags.filter(t => t.type === 'TENTATIVA_CONTATO').map((tag) => (
                            <CommandItem
                              key={tag.id}
                              value={tag.name}
                              onSelect={() => handleTagToggle(tag.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name.replace('CONT_', '')}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Follow Up */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Tentativas de Follow Up</Label>
                <Popover open={openFollowUp} onOpenChange={setOpenFollowUp}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openFollowUp}
                      className="w-full justify-between bg-transparent"
                    >
                      <span className="truncate">
                        {selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'FOLLOW_UP')).length > 0
                          ? `${selectedTags.filter(id => tags.find(t => t.id === id && t.type === 'FOLLOW_UP')).length} selecionadas`
                          : "Selecione"}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup>
                          {tags.filter(t => t.type === 'FOLLOW_UP').map((tag) => (
                            <CommandItem
                              key={tag.id}
                              value={tag.name}
                              onSelect={() => handleTagToggle(tag.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name.replace('FU_', '')}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="notes" className="flex-1">
                <StickyNote className="w-4 h-4 mr-2" />
                Notas
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                <CheckSquare className="w-4 h-4 mr-2" />
                Tasks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="mt-6 space-y-6">
              <div className="space-y-3">
                <Textarea
                  placeholder="Adicionar uma nota..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Nota
                </Button>
              </div>

              <div className="space-y-4">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                          {note.content}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(note.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma nota adicionada
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-6 space-y-6">
              <div className="space-y-3">
                <Input
                  placeholder="Titulo da task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={newTaskDueDate.split('T')[0] || ''}
                      onChange={(e) => setNewTaskDueDate(e.target.value ? `${e.target.value}T00:00` : '')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hora início (padrão: 1h duração)</Label>
                    <Input
                      type="time"
                      value={newTaskStartTime}
                      onChange={(e) => setNewTaskStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora fim (opcional)</Label>
                  <Input
                    type="time"
                    value={newTaskEndTime}
                    onChange={(e) => setNewTaskEndTime(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Task
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma task cadastrada ainda. Adicione a primeira task acima.
                  </p>
                )}
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl"
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={(checked) =>
                        handleToggleTask(task.id, checked as boolean)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {task.title}
                        </p>
                        {task.type === 'callback' && (
                          <Badge variant="secondary" className="text-xs">
                            Callback
                          </Badge>
                        )}
                        {task.status === 'overdue' && !task.completed && (
                          <Badge variant="destructive" className="text-xs">
                            Atrasada
                          </Badge>
                        )}
                      </div>
                      {task.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(task.scheduled_at)} - {formatInAppTimezone(task.scheduled_at, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {task.due_date && !task.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(task.due_date)}
                          {task.start_time && ` - ${task.start_time}`}
                          {task.end_time && ` até ${task.end_time}`}
                        </p>
                      )}
                      {task.note && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          {task.note}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma task adicionada
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <MarkLostDialog
      open={showLostDialog}
      onOpenChange={setShowLostDialog}
      leadId={lead.id}
      leadName={lead.name}
      currentDealValue={lead.deal_value}
      onSuccess={() => {
        onUpdate();
        onClose();
      }}
    />

    <MarkFinishedDialog
      open={showFinishedDialog}
      onOpenChange={setShowFinishedDialog}
      leadId={lead.id}
      leadName={lead.name}
      onSuccess={() => {
        onUpdate();
        onClose();
      }}
    />

    <CallbackModal
      open={openCallbackModal}
      onOpenChange={setOpenCallbackModal}
      leadId={lead.id}
      leadName={lead.name}
      onSuccess={() => {
        console.log("[v0] Callback agendado com sucesso");
        onUpdate();
      }}
    />

    <MeetingModal
      open={openMeetingModal}
      onOpenChange={setOpenMeetingModal}
      leadId={lead.id}
      leadName={lead.name}
      onSuccess={() => {
        console.log("[v0] Reunião agendada com sucesso");
        onUpdate();
      }}
    />
  </>
  );
}
