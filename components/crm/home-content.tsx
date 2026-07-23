"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatInAppTimezone, isOverdueNextDayInAppTimezone } from "@/lib/timezone";
import {
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar,
  Mail,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Lead, Task, Profile, Meeting, Tag, PipelineColumn } from "@/lib/types";
import type { Campaign } from "./campaign-manager";
import { getWonPipelineColumn } from "@/lib/pipeline-utils";
import BorderBeam from "@/components/ui/border-beam"; // Import BorderBeam
import NumberTicker from "@/components/ui/number-ticker"; // Import NumberTicker
import { TaskDetail } from "./task-detail";
import { LeadDetail } from "./lead-detail";

type HomeLeadDetailRow = Lead & {
  lead_sources: { name: string; type: string } | null;
  lead_tags: { tags: Tag }[];
  us_states?: { name: string; abbreviation: string } | null;
  nationalities?: { country: string; nationality: string } | null;
};

const LEAD_DETAIL_SELECT =
  "*, lead_sources(name, type), lead_tags(tags(*)), us_states(name, abbreviation), nationalities(country, nationality)";

interface HomeContentProps {
  profile: Profile | null;
  todayTasks: (Task & { leads: { name: string; email: string } | null })[];
  todayMeetings: (Meeting & { leads: { name: string; email: string; company: string | null } | null })[];
  recentLeads: (Lead & {
    lead_sources: { name: string } | null;
    pipeline_columns: { name: string } | null;
  })[];
  leadStats: {
    id: string;
    created_at: string;
    deal_value: number;
    column_id: string | null;
    is_lost?: boolean | null;
    excluded_from_reports?: boolean | null;
  }[];
  pipelineColumns: PipelineColumn[];
  tags: Tag[];
  campaigns: Campaign[];
  taskStats: { id: string; completed: boolean }[];
  potentialValue: number;
  realizedValue: number;
}

export function HomeContent({
  profile,
  todayTasks: initialTodayTasks,
  todayMeetings: initialTodayMeetings,
  recentLeads,
  leadStats,
  pipelineColumns,
  tags,
  campaigns,
  taskStats: initialTaskStats,
  potentialValue,
  realizedValue,
}: HomeContentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [todayTasks, setTodayTasks] = useState(initialTodayTasks);
  const [todayMeetings, setTodayMeetings] = useState(initialTodayMeetings);
  const [taskStats, setTaskStats] = useState(initialTaskStats);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [meetingSheetLead, setMeetingSheetLead] = useState<HomeLeadDetailRow | null>(null);
  const [meetingSheetLoadingLeadId, setMeetingSheetLoadingLeadId] = useState<string | null>(null);

  const fetchLeadForMeetingSheet = async (leadId: string) => {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_DETAIL_SELECT)
      .eq("id", leadId)
      .maybeSingle();
    if (error || !data) return null;
    return data as HomeLeadDetailRow;
  };

  const openMeetingLeadSheet = async (leadId: string) => {
    setMeetingSheetLoadingLeadId(leadId);
    try {
      const row = await fetchLeadForMeetingSheet(leadId);
      if (row) setMeetingSheetLead(row);
    } finally {
      setMeetingSheetLoadingLeadId(null);
    }
  };

  const closeMeetingLeadSheet = () => setMeetingSheetLead(null);

  const handleMeetingLeadSheetUpdate = async () => {
    if (meetingSheetLead?.id) {
      const row = await fetchLeadForMeetingSheet(meetingSheetLead.id);
      if (row) setMeetingSheetLead(row);
    }
    router.refresh();
  };
  const [filterMode, setFilterMode] = useState<"month" | "range" | "campaign">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || "none");

  // Atualizar status overdue periodicamente (apenas atualiza o estado, sem refresh)
  useEffect(() => {
    const updateOverdue = async () => {
      const response = await fetch("/api/tasks/update-overdue", { method: "POST" });
      if (response.ok) {
        // Atualizar apenas as tasks localmente, sem refresh completo
        const now = new Date().toISOString();
        setTodayTasks(todayTasks.map(task => {
          if ((task as any).scheduled_at && (task as any).scheduled_at < now && (task as any).status === 'scheduled') {
            return { ...task, status: 'overdue' as any };
          }
          return task;
        }));
      }
    };

    // Executar após 1 minuto (para dar tempo da página carregar)
    const initialTimeout = setTimeout(updateOverdue, 60 * 1000);

    // E depois a cada 5 minutos
    const interval = setInterval(updateOverdue, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []); // Sem dependências para evitar re-runs

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );
  const wonColumnId = useMemo(() => getWonPipelineColumn(pipelineColumns as any)?.id || null, [pipelineColumns]);
  const periodWindow = useMemo(() => {
    if (filterMode === "campaign") {
      if (!selectedCampaign) return null;
      return { start: selectedCampaign.start_date, end: selectedCampaign.end_date, label: `Campanha: ${selectedCampaign.name}` };
    }
    if (filterMode === "month") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      const end = new Date(year, month, 0).toISOString().slice(0, 10);
      return { start, end, label: `${selectedMonth}` };
    }
    if (!rangeStart || !rangeEnd) return null;
    return { start: rangeStart, end: rangeEnd, label: `${rangeStart} -> ${rangeEnd}` };
  }, [filterMode, selectedCampaign, selectedMonth, rangeStart, rangeEnd]);

  const filteredLeadStats = useMemo(() => {
    const inFunnelStats = leadStats.filter(
      (l) => !l.is_lost && !l.excluded_from_reports
    );
    if (filterMode === "campaign" && !selectedCampaign) return [];
    if (!periodWindow) return inFunnelStats;
    return inFunnelStats.filter((l) => {
      const d = l.created_at.slice(0, 10);
      return d >= periodWindow.start && d <= periodWindow.end;
    });
  }, [filterMode, selectedCampaign, leadStats, periodWindow]);

  const filteredRecentLeads = useMemo(() => {
    if (filterMode === "campaign" && !selectedCampaign) return [];
    const base = periodWindow
      ? recentLeads.filter((l) => {
          const d = l.created_at.slice(0, 10);
          return d >= periodWindow.start && d <= periodWindow.end;
        })
      : recentLeads;
    return base.slice(0, 5);
  }, [filterMode, selectedCampaign, recentLeads, periodWindow]);

  const totalLeads = filteredLeadStats.length;
  const computedRealizedValue = wonColumnId
    ? filteredLeadStats
        .filter((l) => l.column_id === wonColumnId)
        .reduce((sum, l) => sum + Number(l.deal_value || 0), 0)
    : realizedValue;
  const computedPotentialValue = wonColumnId
    ? filteredLeadStats
        .filter((l) => l.column_id !== wonColumnId)
        .reduce((sum, l) => sum + Number(l.deal_value || 0), 0)
    : potentialValue;

  const completedTasks = taskStats.filter((t) => t.completed).length;
  const pendingTasks = taskStats.filter((t) => !t.completed).length;

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
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

    await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId);

    setTodayTasks(
      todayTasks.map((t) =>
        t.id === taskId
          ? { ...t, ...updateData }
          : t
      )
    );

    setTaskStats(
      taskStats.map((t) => (t.id === taskId ? { ...t, completed } : t))
    );
  };

  const handleMeetingDone = async (meetingId: string, leadId: string | null) => {
    console.log("[v0] Marcando reunião como feita:", { meetingId, leadId });
    
    // Atualizar status da reunião para 'done'
    await supabase
      .from("meetings")
      .update({ status: 'done' })
      .eq("id", meetingId);

    // Se tem lead, mover para "Reunião Feita"
    if (leadId) {
      // Buscar a coluna "Reunião Feita"
      const { data: column } = await supabase
        .from("pipeline_columns")
        .select("id")
        .eq("name", "Reunião Feita")
        .single();

      if (column) {
        console.log("[v0] Movendo lead para 'Reunião Feita':", column.id);
        await supabase
          .from("leads")
          .update({ column_id: column.id })
          .eq("id", leadId);
      }
    }

    // Remover da lista local
    setTodayMeetings(todayMeetings.filter((m) => m.id !== meetingId));
    
    router.refresh();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <>
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || "Usuario"}
          </h1>
          <p className="text-muted-foreground mt-2">
            Aqui esta um resumo das suas atividades de hoje
          </p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="w-full sm:w-60 space-y-2">
              <Label>Filtro da Home</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as "month" | "range" | "campaign")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="range">Período</SelectItem>
                  <SelectItem value="campaign">Campanha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterMode === "month" && (
              <div className="w-full sm:w-56 space-y-2">
                <Label>Mês</Label>
                <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
            )}

            {filterMode === "range" && (
              <>
                <div className="w-full sm:w-48 space-y-2">
                  <Label>Início</Label>
                  <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                </div>
                <div className="w-full sm:w-48 space-y-2">
                  <Label>Fim</Label>
                  <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                </div>
              </>
            )}

            {filterMode === "campaign" && (
              <div className="w-full sm:w-80 space-y-2">
                <Label>Campanha</Label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhuma campanha cadastrada
                      </SelectItem>
                    ) : (
                      campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Base usada nos cards: leads criados no período selecionado ({periodWindow?.label || "sem filtro"}).
          </p>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden relative h-full">
          <BorderBeam size={250} duration={12} delay={3} />
          <CardContent className="p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Valor Potencial</p>
                <div className="text-4xl font-bold text-foreground mt-2 tracking-tight flex items-baseline gap-1">
                  <span className="text-2xl">$</span>
                  <NumberTicker value={computedPotentialValue || 0} decimalPlaces={2} stiffness={240} damping={26} />
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span>Leads em aberto</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-7 h-7 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden relative h-full">
          <BorderBeam size={250} duration={12} delay={0} />
          <CardContent className="p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-chart-2/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Valor Realizado</p>
                <div className="text-4xl font-bold text-foreground mt-2 tracking-tight flex items-baseline gap-1">
                  <span className="text-2xl">$</span>
                  <NumberTicker value={computedRealizedValue || 0} decimalPlaces={2} stiffness={240} damping={26} />
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-chart-2" />
                  <span>Negócios fechados</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-chart-2/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="w-7 h-7 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden relative h-full">
          <BorderBeam size={250} duration={12} delay={6} />
          <CardContent className="p-6 relative h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total de leads</p>
                <div className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                  <NumberTicker value={totalLeads} stiffness={240} damping={26} />
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs">
                  <NumberTicker value={totalLeads} className="text-muted-foreground text-xs" stiffness={240} damping={26} />
                  <span className="text-muted-foreground">no filtro</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks and Meetings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="text-lg font-semibold">Tasks de Hoje</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {todayTasks.filter(t => !t.completed).length} pendentes
                  </p>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma task para hoje
                </p>
                <p className="text-muted-foreground/70 text-xs mt-1">
                  Aproveite o dia!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task, index) => {
                  const isOverdue =
                    !task.completed &&
                    isOverdueNextDayInAppTimezone((task as any).scheduled_at || task.due_date);
                  
                  return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 group cursor-pointer",
                      task.completed 
                        ? "bg-muted/30 border-transparent" 
                        : isOverdue
                        ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 animate-pulse"
                        : "bg-muted/50 hover:bg-muted hover:border-border/50 border-transparent"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={(checked) => {
                        handleTaskToggle(task.id, checked as boolean);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                        isOverdue && "border-destructive"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "font-medium transition-all duration-200",
                            task.completed 
                              ? "line-through text-muted-foreground" 
                              : isOverdue
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Atrasada
                          </Badge>
                        )}
                        {(task as any).type === 'callback' && (
                          <Badge variant="secondary" className="text-xs">
                            Callback
                          </Badge>
                        )}
                      </div>
                      {task.leads && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {task.leads.name}
                        </p>
                      )}
                    </div>
                    {task.start_time && (
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        {task.start_time}
                      </Badge>
                    )}
                    {(task as any).scheduled_at && (
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        {formatInAppTimezone((task as any).scheduled_at, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Badge>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-chart-2/10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <span className="text-lg font-semibold">Reuniões de Hoje</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {todayMeetings.filter(m => m.status === 'scheduled').length} agendadas
                  </p>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma reunião agendada
                </p>
                <p className="text-muted-foreground/70 text-xs mt-1">
                  Agende reuniões com seus leads
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map((meeting, index) => (
                  <div
                    key={meeting.id}
                    role={meeting.lead_id ? "button" : undefined}
                    tabIndex={meeting.lead_id ? 0 : undefined}
                    onClick={() => {
                      if (meeting.lead_id && !meetingSheetLoadingLeadId) {
                        void openMeetingLeadSheet(meeting.lead_id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        meeting.lead_id &&
                        !meetingSheetLoadingLeadId &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        void openMeetingLeadSheet(meeting.lead_id);
                      }
                    }}
                    className={cn(
                      "flex flex-col gap-2 p-4 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50 transition-all duration-200",
                      meeting.lead_id && "cursor-pointer",
                      meetingSheetLoadingLeadId === meeting.lead_id && "opacity-60 pointer-events-none"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {meeting.leads?.name || "Lead removido"}
                        </p>
                        {meeting.leads?.company && (
                          <p className="text-xs text-muted-foreground truncate">
                            {meeting.leads.company}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        {formatInAppTimezone(meeting.scheduled_at, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {meeting.meeting_type && (
                        <Badge variant="secondary" className="text-xs">
                          {meeting.meeting_type === 'zoom' && 'Zoom'}
                          {meeting.meeting_type === 'phone' && 'Telefone'}
                          {meeting.meeting_type === 'in_person' && 'Presencial'}
                          {meeting.meeting_type === 'google_meet' && 'Google Meet'}
                          {meeting.meeting_type === 'other' && 'Outro'}
                        </Badge>
                      )}
                      {meeting.duration_minutes && (
                        <span className="text-xs text-muted-foreground">
                          {meeting.duration_minutes}min
                        </span>
                      )}
                    </div>

                    {meeting.meeting_link && (
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {meeting.meeting_link}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMeetingDone(meeting.id, meeting.lead_id);
                      }}
                      className="mt-2 px-3 py-1.5 bg-chart-2/10 hover:bg-chart-2/20 text-chart-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      Marcar como Feita
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leads Recentes - Full Width Below */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-lg font-semibold">Leads Recentes</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {periodWindow ? `Ultimos ${filteredRecentLeads.length} no filtro` : `Ultimos ${filteredRecentLeads.length} cadastrados`}
                </p>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecentLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Nenhum lead cadastrado
              </p>
              <p className="text-muted-foreground/70 text-xs mt-1">
                Configure um webhook para comecar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecentLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50 transition-all duration-200 cursor-pointer group"
                  onClick={() =>
                    router.push(`/dashboard/pipeline?lead=${lead.id}`)
                  }
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-11 h-11 bg-linear-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                    <span className="text-sm font-bold text-primary">
                      {lead.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {lead.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.email}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {lead.pipeline_columns && (
                      <Badge variant="secondary" className="text-xs font-medium">
                        {lead.pipeline_columns.name}
                      </Badge>
                    )}
                    {lead.lead_sources && (
                      <span className="text-xs text-muted-foreground">
                        via {lead.lead_sources.name}
                      </span>
                    )}
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <TaskDetail
      open={selectedTaskId !== null}
      onOpenChange={(open) => !open && setSelectedTaskId(null)}
      taskId={selectedTaskId || ""}
      onUpdate={() => {
        router.refresh();
      }}
    />

    {meetingSheetLead && (
      <LeadDetail
        lead={meetingSheetLead as Parameters<typeof LeadDetail>[0]["lead"]}
        tags={tags}
        columns={pipelineColumns}
        onClose={closeMeetingLeadSheet}
        onUpdate={handleMeetingLeadSheetUpdate}
      />
    )}
  </>
  );
}
