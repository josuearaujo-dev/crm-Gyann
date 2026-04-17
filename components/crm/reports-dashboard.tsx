"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSpring, animated } from "@react-spring/web";
import {
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Phone,
  CheckCircle,
  Clock,
  Percent,
  CalendarRange,
  AlertCircle,
  Calendar,
  Filter,
  FileDown,
  FileJson2,
} from "lucide-react";
import type { Lead, PipelineColumn, LeadSource, Meeting, LeadInstallment } from "@/lib/types";
import { getWonPipelineColumn, meetingTouchesPeriod } from "@/lib/pipeline-utils";
import {
  cohortCashAndOutstanding,
  countSalesWithInstallmentSchedule,
  indexInstallmentsByLeadId,
  periodInstallmentMetrics,
} from "@/lib/report-finance";
import { CampaignManager, type Campaign } from "./campaign-manager";
import { formatCurrency } from "@/lib/timezone";

interface ReportsDashboardProps {
  leads: (Lead & {
    lead_tags?: { tags: { id: string; name: string; color: string } }[];
    excluded_from_reports?: boolean | null;
  })[];
  columns: PipelineColumn[];
  sources: LeadSource[];
  meetings: Meeting[];
  installments: LeadInstallment[];
  initialCampaigns: Campaign[];
  userId: string;
}

const AnimatedNumber = ({ value, decimals = 0 }: { value: number; decimals?: number }) => {
  const props = useSpring({ val: value, from: { val: 0 }, config: { tension: 120, friction: 25 } });
  return <animated.span>{props.val.to((n) => n.toFixed(decimals))}</animated.span>;
};

const AnimatedCurrency = ({ value }: { value: number }) => {
  const props = useSpring({ val: value, from: { val: 0 }, config: { tension: 120, friction: 25 } });
  return (
    <animated.span>
      {props.val.to((n) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
      )}
    </animated.span>
  );
};

const MetricCard = ({
  title,
  children,
  icon: Icon,
  iconClass = "text-muted-foreground",
  sub,
  colSpan,
}: {
  title: string;
  children: React.ReactNode;
  icon: React.ElementType;
  iconClass?: string;
  sub?: React.ReactNode;
  colSpan?: string;
}) => (
  <Card className={colSpan}>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className={`w-4 h-4 ${iconClass}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{children}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

// Calcula interseção em dias entre dois ranges de datas
function daysOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1 : 0;
}

function campaignDays(campaign: Campaign): number {
  const start = new Date(campaign.start_date + "T00:00:00");
  const end = new Date(campaign.end_date + "T23:59:59");
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function ReportsDashboard({
  leads,
  columns,
  sources,
  meetings,
  installments,
  initialCampaigns,
  userId,
}: ReportsDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [filterMode, setFilterMode] = useState<"campaign" | "range">("campaign");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    initialCampaigns.find((c) => {
      const today = new Date().toISOString().slice(0, 10);
      return c.is_active && c.start_date <= today && c.end_date >= today;
    })?.id || initialCampaigns[0]?.id || "none"
  );

  // Range livre de datas
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [rangeStart, setRangeStart] = useState(thirtyDaysAgo);
  const [rangeEnd, setRangeEnd] = useState(today);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  /** Janela usada para previsto / caixa / em aberto no período (campanha ou range). */
  const analysisPeriod = useMemo(() => {
    if (filterMode === "campaign" && selectedCampaign) {
      return { start: selectedCampaign.start_date, end: selectedCampaign.end_date };
    }
    return { start: rangeStart, end: rangeEnd };
  }, [filterMode, selectedCampaign, rangeStart, rangeEnd]);

  // Dados calculados para o modo "range livre"
  const rangeData = useMemo(() => {
    if (filterMode !== "range" || !rangeStart || !rangeEnd) return null;
    const rStart = new Date(rangeStart + "T00:00:00");
    const rEnd = new Date(rangeEnd + "T23:59:59");

    // Leads criados dentro do range (exceto perdidos)
    const rangeLeads = leads.filter((lead) => {
      if (lead.is_lost) return false;
      if (lead.excluded_from_reports) return false;
      const created = new Date(lead.created_at);
      return created >= rStart && created <= rEnd;
    });

    // Para cada campanha, calcula quanto do budget pertence ao range
    // proporcional aos dias de sobreposição
    let totalInvestment = 0;
    const campaignBreakdown: { name: string; budget: number; proportion: number; leadsCount: number }[] = [];

    for (const campaign of campaigns) {
      const cStart = new Date(campaign.start_date + "T00:00:00");
      const cEnd = new Date(campaign.end_date + "T23:59:59");
      const overlap = daysOverlap(rStart, rEnd, cStart, cEnd);
      if (overlap <= 0) continue;
      const total = campaignDays(campaign);
      const proportion = overlap / total;
      const partialBudget = campaign.budget * proportion;
      totalInvestment += partialBudget;

      // Leads desse range que pertencem ao período dessa campanha (interseção)
      const intersectStart = new Date(Math.max(rStart.getTime(), cStart.getTime()));
      const intersectEnd = new Date(Math.min(rEnd.getTime(), cEnd.getTime()));
      const leadsInIntersect = rangeLeads.filter((l) => {
        const created = new Date(l.created_at);
        return created >= intersectStart && created <= intersectEnd;
      }).length;

      campaignBreakdown.push({
        name: campaign.name,
        budget: partialBudget,
        proportion: Math.round(proportion * 100),
        leadsCount: leadsInIntersect,
      });
    }

    // Leads no range que NÃO pertencem a nenhuma campanha
    const leadsWithCampaign = new Set<string>();
    for (const campaign of campaigns) {
      const cStart = new Date(campaign.start_date + "T00:00:00");
      const cEnd = new Date(campaign.end_date + "T23:59:59");
      rangeLeads.forEach((l) => {
        const created = new Date(l.created_at);
        if (created >= cStart && created <= cEnd) leadsWithCampaign.add(l.id);
      });
    }
    const uncampaignedLeads = rangeLeads.filter((l) => !leadsWithCampaign.has(l.id));

    if (uncampaignedLeads.length > 0) {
      campaignBreakdown.push({
        name: "No active campaign",
        budget: 0,
        proportion: 0,
        leadsCount: uncampaignedLeads.length,
      });
    }

    const rangeCohortIds = new Set(rangeLeads.map((l) => l.id));
    const rangeMeetings = meetings.filter((m) => {
      if (m.status === "cancelled") return false;
      const forCohort = m.lead_id != null && rangeCohortIds.has(m.lead_id);
      const inWindow = meetingTouchesPeriod(m, rStart, rEnd);
      return forCohort || inWindow;
    });

    return { rangeLeads, totalInvestment, campaignBreakdown, rangeMeetings, uncampaignedCount: uncampaignedLeads.length };
  }, [filterMode, rangeStart, rangeEnd, leads, campaigns, meetings]);

  // Leads dentro do range da campanha selecionada (modo campanha)
  const campaignLeads = useMemo(() => {
    if (filterMode === "range") return rangeData?.rangeLeads || [];
    if (!selectedCampaign) return [];
    const start = new Date(selectedCampaign.start_date + "T00:00:00");
    const end = new Date(selectedCampaign.end_date + "T23:59:59");
    return leads.filter((lead) => {
      if (lead.is_lost) return false;
      if (lead.excluded_from_reports) return false;
      const created = new Date(lead.created_at);
      return created >= start && created <= end;
    });
  }, [leads, selectedCampaign, filterMode, rangeData]);

  const sourceFilteredLeads = useMemo(() => {
    if (selectedSourceId === "all") return campaignLeads;
    return campaignLeads.filter((lead) => lead.source_id === selectedSourceId);
  }, [campaignLeads, selectedSourceId]);

  const leadSourceById = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead.source_id])),
    [leads]
  );

  const wonColumn = useMemo(() => getWonPipelineColumn(columns), [columns]);
  const analysisPeriodDays = useMemo(() => {
    const start = new Date(`${analysisPeriod.start}T00:00:00`);
    const end = new Date(`${analysisPeriod.end}T23:59:59`);
    const diffMs = end.getTime() - start.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }, [analysisPeriod.start, analysisPeriod.end]);

  const metrics = useMemo(() => {
    // Investimento: proporcional no modo range, budget total no modo campanha
    const investment =
      filterMode === "range"
        ? rangeData?.totalInvestment || 0
        : selectedCampaign?.budget || 0;

    const totalLeads = sourceFilteredLeads.length;
    const leadsPerDay = analysisPeriodDays > 0 ? totalLeads / analysisPeriodDays : 0;

    // Qualificados: leads com tag contendo "QUALIFICADO" (case insensitive)
    const qualifiedLeads = sourceFilteredLeads.filter((lead) =>
      lead.lead_tags?.some((lt) =>
        lt.tags.name.toUpperCase().includes("QUALIFICADO")
      )
    );
    const qualifiedCount = qualifiedLeads.length;
    const qualificationRate = totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0;

    // Regra temporal padronizada: relatório por coorte (leads criados no período selecionado).
    const cohortWonLeads = sourceFilteredLeads.filter((l) => wonColumn && l.column_id === wonColumn.id);

    // Vendas válidas: ganhos da própria coorte.
    const salesLeads = cohortWonLeads;
    const totalSales = salesLeads.length;
    const byLead = indexInstallmentsByLeadId(installments);
    const { totalReceived: totalReceivedCohort, totalOutstanding: outstandingCohort, revenue } =
      cohortCashAndOutstanding(salesLeads, byLead);
    const salesWithInstallmentSchedule = countSalesWithInstallmentSchedule(salesLeads, byLead);
    const { cashInPeriod, expectedInPeriod, openInPeriod } = periodInstallmentMetrics(
      salesLeads,
      byLead,
      analysisPeriod.start,
      analysisPeriod.end
    );
    const showPeriodInstallmentBreakdown = totalSales === 0 || salesWithInstallmentSchedule > 0;
    const roasNumerator =
      totalSales > 0 && salesWithInstallmentSchedule > 0 ? cashInPeriod : totalReceivedCohort;
    const avgTicket = totalSales > 0 ? revenue / totalSales : 0;

    // Reuniões da coorte: separa marcada, realizada e no-show.
    const cohortLeadIds = new Set(sourceFilteredLeads.map((l) => l.id));
    const meetingsForCohort = meetings.filter((m) => {
      if (m.status === "cancelled") return false;
      const forCohortLead = m.lead_id != null && cohortLeadIds.has(m.lead_id);
      const sourceMatches =
        selectedSourceId === "all" ||
        (m.lead_id != null && leadSourceById.get(m.lead_id) === selectedSourceId);
      return sourceMatches && forCohortLead;
    });

    const meetingsMarkedCount = meetingsForCohort.length;
    const meetingsHeld = meetingsForCohort.filter((m) => m.status === "done");
    const meetingsHeldCount = meetingsHeld.length;
    const meetingsNoShow = meetingsForCohort.filter((m) => m.status === "no_show");
    const meetingsNoShowCount = meetingsNoShow.length;
    const totalCalls = meetingsHeldCount;
    const leadsWithMeetingIds = new Set(
      meetingsForCohort
        .map((m) => m.lead_id)
        .filter((id): id is string => Boolean(id))
    );
    const noShowLeadIds = new Set(
      meetingsNoShow
        .filter((m) => m.lead_id)
        .map((m) => m.lead_id as string)
    );
    const noShowLeadsCount = noShowLeadIds.size;
    const noShowRate =
      leadsWithMeetingIds.size > 0 ? (noShowLeadsCount / leadsWithMeetingIds.size) * 100 : 0;

    const leadsWithHeldMeeting = new Set(
      meetingsHeld.map((m) => m.lead_id).filter((id): id is string => Boolean(id))
    );
    const salesFromMeetings = salesLeads.filter((lead) => {
      if (!leadsWithHeldMeeting.has(lead.id)) return false;
      // Proxy de data de fechamento: updated_at do lead ao entrar em ganho.
      const wonAt = new Date(lead.updated_at).getTime();
      return meetingsHeld.some((m) => {
        if (m.lead_id !== lead.id) return false;
        const heldAt = new Date(m.scheduled_at).getTime();
        return heldAt <= wonAt;
      });
    }).length;
    // Métricas de custo
    const cpl = totalLeads > 0 && investment > 0 ? investment / totalLeads : 0;
    const costPerQualified = qualifiedCount > 0 && investment > 0 ? investment / qualifiedCount : 0;
    const costPerCall = totalCalls > 0 && investment > 0 ? investment / totalCalls : null;
    const cac = totalSales > 0 && investment > 0 ? investment / totalSales : 0;

    // Taxas de conversão
    const leadToSaleRate =
      totalLeads > 0 ? (cohortWonLeads.length / totalLeads) * 100 : 0;
    const callToSaleRate =
      meetingsHeldCount > 0 ? (salesFromMeetings / meetingsHeldCount) * 100 : null;
    const leadToCallRate = totalLeads > 0 ? (meetingsHeldCount / totalLeads) * 100 : 0;
    const callsPerSale =
      totalSales > 0 ? meetingsHeldCount / totalSales : null;
    const qualifiedToSaleRate =
      qualifiedCount > 0 ? (totalSales / qualifiedCount) * 100 : 0;

    const avgClosingTime =
      salesLeads.length > 0
        ? salesLeads.reduce((sum, l) => {
            const days = Math.floor(
              (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return sum + Math.max(days, 0);
          }, 0) / salesLeads.length
        : 0;

    // ROAS em múltiplo (x) e ROI percentual.
    const roas = investment > 0 ? roasNumerator / investment : 0;
    const roiPercent = investment > 0 ? ((roasNumerator - investment) / investment) * 100 : 0;
    const roiX = roiPercent / 100;

    return {
      investment,
      totalLeads,
      leadsPerDay,
      qualifiedCount,
      qualificationRate,
      totalSales,
      revenue,
      totalReceivedCohort,
      outstandingCohort,
      cashInPeriod,
      expectedInPeriod,
      openInPeriod,
      showPeriodInstallmentBreakdown,
      salesWithInstallmentSchedule,
      roasUsesPeriodCash: totalSales > 0 && salesWithInstallmentSchedule > 0,
      avgTicket,
      meetingsMarkedCount,
      meetingsHeldCount,
      meetingsNoShowCount,
      totalCalls,
      cpl,
      costPerQualified,
      costPerCall,
      cac,
      leadToSaleRate,
      callToSaleRate,
      leadToCallRate,
      callsPerSale,
      noShowLeadsCount,
      noShowRate,
      qualifiedToSaleRate,
      avgClosingTime,
      roas,
      roiX,
      roiPercent,
      salesFromMeetings,
    };
  }, [
    sourceFilteredLeads,
    leads,
    analysisPeriodDays,
    selectedCampaign,
    selectedSourceId,
    leadSourceById,
    wonColumn,
    meetings,
    installments,
    analysisPeriod.start,
    analysisPeriod.end,
  ]);

  // Gráfico: distribuição por pipeline
  const pipelineData = useMemo(() => {
    return columns
      .map((col) => ({
        name: col.name,
        leads: sourceFilteredLeads.filter((l) => l.column_id === col.id).length,
        color: col.color,
      }))
      .filter((d) => d.leads > 0);
  }, [sourceFilteredLeads, columns]);

  // Gráfico: leads por fonte
  const sourceData = useMemo(() => {
    return sources
      .map((source) => ({
        name: source.name,
        value: sourceFilteredLeads.filter((l) => l.source_id === source.id).length,
      }))
      .filter((d) => d.value > 0);
  }, [sourceFilteredLeads, sources]);
  const sourceDataSorted = useMemo(
    () => [...sourceData].sort((a, b) => b.value - a.value),
    [sourceData]
  );

  const isCampaignActive = selectedCampaign
    ? (() => {
        const today = new Date().toISOString().slice(0, 10);
        return selectedCampaign.is_active && selectedCampaign.start_date <= today && selectedCampaign.end_date >= today;
      })()
    : false;

  const selectedSourceName =
    selectedSourceId === "all"
      ? "Todas as fontes"
      : sources.find((s) => s.id === selectedSourceId)?.name || "Fonte desconhecida";

  const reportLog = useMemo(() => {
    const nowIso = new Date().toISOString();
    const periodLabel =
      filterMode === "campaign"
        ? selectedCampaign
          ? `${selectedCampaign.start_date} -> ${selectedCampaign.end_date}`
          : "Sem campanha"
        : `${rangeStart} -> ${rangeEnd}`;

    return {
      generatedAt: nowIso,
      filters: {
        mode: filterMode,
        campaignId: selectedCampaign?.id || null,
        campaignName: selectedCampaign?.name || null,
        sourceId: selectedSourceId,
        sourceName: selectedSourceName,
        period: periodLabel,
      },
      dataUsed: {
        totalLeadsLoaded: leads.length,
        leadsAfterPeriodAndSource: sourceFilteredLeads.length,
        meetingsLoaded: meetings.length,
        installmentsLoaded: installments.length,
        wonColumnId: wonColumn?.id || null,
        wonColumnName: wonColumn?.name || null,
        analysisPeriod,
      },
      formulas: {
        leadToSaleRate: "cohortWonLeads / totalLeads * 100",
        qualifiedToSaleRate: "totalSales / qualifiedCount * 100",
        leadToMeetingRate: "meetingsHeldCount / totalLeads * 100",
        meetingToSaleRate: "salesFromMeetings / meetingsHeldCount * 100",
        meetingsPerSale: "meetingsHeldCount / totalSales",
        cpl: "investment / totalLeads",
        cac: "investment / totalSales",
        revenue: "sum(deal_value) vendas da coorte",
        totalReceivedCohort:
          "por venda: se há parcelas → soma(amount) com paid_at; senão legado (integral ou amount_received)",
        outstandingCohort: "revenue - totalReceivedCohort",
        cashInPeriod: "soma parcelas com paid_at dentro da janela (campanha ou range)",
        expectedInPeriod: "soma parcelas com due_date dentro da janela",
        openInPeriod: "parcelas com due_date na janela e paid_at nulo",
        roasX:
          metrics.roasUsesPeriodCash
            ? "cashInPeriod / investment"
            : "totalReceivedCohort / investment (sem grade de parcelas nas vendas)",
        roiPercent:
          metrics.roasUsesPeriodCash
            ? "(cashInPeriod - investment) / investment * 100"
            : "(totalReceivedCohort - investment) / investment * 100",
      },
      results: metrics,
    };
  }, [
    filterMode,
    selectedCampaign,
    selectedSourceId,
    selectedSourceName,
    rangeStart,
    rangeEnd,
    leads.length,
    sourceFilteredLeads.length,
    meetings.length,
    installments.length,
    wonColumn,
    metrics,
    analysisPeriod,
  ]);

  const downloadJsonLog = () => {
    const filename = `report-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    const blob = new Blob([JSON.stringify(reportLog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadReportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 14;
    const line = (label: string, value: string) => {
      doc.text(`${label}: ${value}`, 14, y);
      y += 7;
    };

    doc.setFontSize(14);
    doc.text("Relatorio CRM - Snapshot", 14, y);
    y += 10;
    doc.setFontSize(10);
    line("Gerado em", new Date().toLocaleString("pt-BR"));
    line("Modo", filterMode === "campaign" ? "Campanha" : "Range de datas");
    line("Campanha", selectedCampaign?.name || "N/A");
    line("Fonte", selectedSourceName);
    line(
      "Periodo",
      filterMode === "campaign"
        ? selectedCampaign
          ? `${selectedCampaign.start_date} a ${selectedCampaign.end_date}`
          : "N/A"
        : `${rangeStart} a ${rangeEnd}`
    );
    y += 4;
    doc.text("Metricas principais", 14, y);
    y += 7;
    line("Leads", String(metrics.totalLeads));
    line("Qualificados", String(metrics.qualifiedCount));
    line("Vendas", String(metrics.totalSales));
    line("Valor contratado", formatCurrency(metrics.revenue));
    line("Recebido no período (parcelas)", formatCurrency(metrics.cashInPeriod));
    line("Previsto no período (parcelas)", formatCurrency(metrics.expectedInPeriod));
    line("Em aberto no período", formatCurrency(metrics.openInPeriod));
    line("Total já recebido (coorte)", formatCurrency(metrics.totalReceivedCohort));
    line("Saldo a receber (coorte)", formatCurrency(metrics.outstandingCohort));
    line("CAC", formatCurrency(metrics.cac));
    line("CPL", formatCurrency(metrics.cpl));
    line("ROAS (x)", `${metrics.roas.toFixed(2)}x`);
    line("ROI (x)", `${metrics.roiX.toFixed(2)}x`);
    line("No-show", `${metrics.noShowRate.toFixed(1)}% (${metrics.noShowLeadsCount} leads)`);

    y += 4;
    doc.text("Resumo de calculo (log JSON no arquivo separado)", 14, y);
    y += 7;
    const summary = JSON.stringify(reportLog.formulas);
    const split = doc.splitTextToSize(summary, 180);
    doc.text(split, 14, y);

    const filename = `relatorio-crm-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`;
    doc.save(filename);
  };

  return (
    <Tabs defaultValue="reports" className="space-y-6">
      <TabsList className="grid w-full max-w-xs grid-cols-2">
        <TabsTrigger value="reports">Relatórios</TabsTrigger>
        <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
      </TabsList>

      {/* ABA: CAMPANHAS */}
      <TabsContent value="campaigns" className="mt-0">
        <CampaignManager
          campaigns={campaigns}
          userId={userId}
          onCampaignsChange={(updated) => {
            setCampaigns(updated);
            if (!updated.find((c) => c.id === selectedCampaignId)) {
              setSelectedCampaignId(updated[0]?.id || "none");
            }
          }}
        />
      </TabsContent>

      {/* ABA: RELATÓRIOS */}
      <TabsContent value="reports" className="mt-0 space-y-6">

        {/* Seletor de modo e filtros */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Toggle de modo */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={filterMode === "campaign" ? "default" : "outline"}
                onClick={() => setFilterMode("campaign")}
                className="gap-2"
              >
                <Filter className="w-3.5 h-3.5" />
                Por Campanha
              </Button>
              <Button
                size="sm"
                variant={filterMode === "range" ? "default" : "outline"}
                onClick={() => setFilterMode("range")}
                className="gap-2"
              >
                <Calendar className="w-3.5 h-3.5" />
                Por Range de Datas
              </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={downloadJsonLog}>
                  <FileJson2 className="w-3.5 h-3.5" />
                  Baixar JSON (log)
                </Button>
                <Button size="sm" className="gap-2" onClick={downloadReportPdf}>
                  <FileDown className="w-3.5 h-3.5" />
                  Baixar PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="w-full sm:max-w-sm space-y-1">
                <p className="text-sm font-medium">Fonte do lead</p>
                <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as fontes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fontes</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtro por campanha */}
            {filterMode === "campaign" && (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Campanha</p>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.length === 0 && (
                        <SelectItem value="none" disabled>Nenhuma campanha cadastrada</SelectItem>
                      )}
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCampaign && (
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="w-4 h-4" />
                      <span>
                        {new Date(selectedCampaign.start_date + "T00:00:00").toLocaleDateString("en-US")}
                        {" — "}
                        {new Date(selectedCampaign.end_date + "T00:00:00").toLocaleDateString("en-US")}
                      </span>
                      {isCampaignActive ? (
                        <Badge className="text-xs bg-green-500/15 text-green-600 border-green-500/30">Vigente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Encerrada</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span>Investment: <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(selectedCampaign.budget)}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filtro por range de datas */}
            {filterMode === "range" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm font-medium">Data de início</Label>
                    <Input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm font-medium">Data de fim</Label>
                    <Input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </div>
                </div>

                {/* Breakdown de campanhas que se sobrepõem ao range */}
                {rangeData && rangeData.campaignBreakdown.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Campaigns in period — proportional investment
                    </p>
                    <div className="space-y-2">
                      {rangeData.campaignBreakdown.map((c) => (
                        <div key={c.name} className={`flex items-center justify-between text-sm rounded-md px-2 py-1.5 ${c.name === "No active campaign" ? "bg-amber-500/10 border border-amber-500/30" : ""}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.name === "No active campaign" ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="font-medium text-amber-700 dark:text-amber-400">No active campaign</span>
                                <span className="text-muted-foreground text-xs">{c.leadsCount} lead{c.leadsCount !== 1 ? "s" : ""} — included in totals, $0.00 investment</span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">{c.name}</span>
                                <Badge variant="outline" className="text-xs">{c.proportion}% of period</Badge>
                                <span className="text-muted-foreground text-xs">{c.leadsCount} lead{c.leadsCount !== 1 ? "s" : ""}</span>
                              </>
                            )}
                          </div>
                          <span className={`font-semibold tabular-nums ${c.name === "No active campaign" ? "text-muted-foreground" : ""}`}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c.budget)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm pt-2 border-t font-semibold">
                        <span>Total invested in range</span>
                        <span className="text-primary">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rangeData.totalInvestment)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {rangeData && rangeData.campaignBreakdown.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>No campaigns cover this period — investment will be $0.00. All leads in range will still be counted.</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sem campanha selecionada (modo campanha) */}
        {filterMode === "campaign" && !selectedCampaign && (
          <div className="text-center py-16 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma campanha selecionada</p>
            <p className="text-xs mt-1">Vá até a aba Campanhas para cadastrar uma.</p>
          </div>
        )}

        {(filterMode === "range" || selectedCampaign) && (
          <>
            {/* CARDS DE MÉTRICAS */}

            {/* Bloco 1 — Funil principal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Funil Principal</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard title="Total de Leads" icon={Users}
                  sub={`${metrics.totalLeads} leads no período`}>
                  <AnimatedNumber value={metrics.totalLeads} />
                </MetricCard>
                <MetricCard title="Leads Qualificados" icon={Target} iconClass="text-blue-500"
                  sub={<><AnimatedNumber value={metrics.qualificationRate} decimals={1} />% de qualificação</>}>
                  <span className="text-blue-600"><AnimatedNumber value={metrics.qualifiedCount} /></span>
                </MetricCard>
                <MetricCard
                  title="Reuniões Marcadas"
                  icon={Calendar}
                  sub="Total de reuniões agendadas da coorte"
                >
                  <AnimatedNumber value={metrics.meetingsMarkedCount} />
                </MetricCard>
                <MetricCard title="Reuniões Realizadas" icon={Phone}
                  sub={<><AnimatedNumber value={metrics.leadToCallRate} decimals={1} />% dos leads · {metrics.meetingsNoShowCount} no-show</>}>
                  <AnimatedNumber value={metrics.meetingsHeldCount} />
                </MetricCard>
                <MetricCard title="Vendas" icon={CheckCircle} iconClass="text-green-600"
                  sub="Leads da coorte em etapa de ganho">
                  <span className="text-green-600"><AnimatedNumber value={metrics.totalSales} /></span>
                </MetricCard>
              </div>
            </div>

            {/* Bloco 2 — Financeiro (coorte vs janela temporal explícita) */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Financeiro
              </p>
              {metrics.totalSales > 0 && !metrics.showPeriodInstallmentBreakdown && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200 mb-3">
                  Cadastre parcelas no lead (vencimento e pagamento) para ver recebido / previsto / em aberto na
                  janela da análise. ROAS e ROI usam o total já recebido da coorte até o momento.
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Investimento" icon={DollarSign}>
                  <AnimatedCurrency value={metrics.investment} />
                </MetricCard>
                <MetricCard
                  title="Valor contratado"
                  icon={DollarSign}
                  iconClass="text-green-600"
                  sub="Soma deal_value das vendas da coorte"
                >
                  <span className="text-green-600"><AnimatedCurrency value={metrics.revenue} /></span>
                </MetricCard>
                <MetricCard
                  title="Recebido no período"
                  icon={DollarSign}
                  iconClass="text-emerald-600"
                  sub="Parcelas com data de pagamento na janela"
                >
                  {metrics.totalSales > 0 && !metrics.showPeriodInstallmentBreakdown ? (
                    <span className="text-muted-foreground text-base font-normal">—</span>
                  ) : (
                    <span className="text-emerald-600"><AnimatedCurrency value={metrics.cashInPeriod} /></span>
                  )}
                </MetricCard>
                <MetricCard
                  title="Previsto no período"
                  icon={DollarSign}
                  iconClass="text-sky-600"
                  sub="Parcelas com vencimento na janela"
                >
                  {metrics.totalSales > 0 && !metrics.showPeriodInstallmentBreakdown ? (
                    <span className="text-muted-foreground text-base font-normal">—</span>
                  ) : (
                    <span className="text-sky-600"><AnimatedCurrency value={metrics.expectedInPeriod} /></span>
                  )}
                </MetricCard>
                <MetricCard
                  title="Em aberto no período"
                  icon={DollarSign}
                  iconClass="text-amber-600"
                  sub="Vence na janela e ainda não pago"
                >
                  {metrics.totalSales > 0 && !metrics.showPeriodInstallmentBreakdown ? (
                    <span className="text-muted-foreground text-base font-normal">—</span>
                  ) : (
                    <span className="text-amber-600"><AnimatedCurrency value={metrics.openInPeriod} /></span>
                  )}
                </MetricCard>
                <MetricCard
                  title="Total já recebido (coorte)"
                  icon={DollarSign}
                  iconClass="text-emerald-700"
                  sub="Parcelas pagas ou valor recebido legado"
                >
                  <span className="text-emerald-700"><AnimatedCurrency value={metrics.totalReceivedCohort} /></span>
                </MetricCard>
                <MetricCard
                  title="Saldo a receber (coorte)"
                  icon={DollarSign}
                  iconClass="text-orange-600"
                  sub="Contratado − já recebido"
                >
                  <span className="text-orange-600"><AnimatedCurrency value={metrics.outstandingCohort} /></span>
                </MetricCard>
                <MetricCard title="Ticket médio" icon={DollarSign} sub="Valor contratado ÷ vendas">
                  <AnimatedCurrency value={metrics.avgTicket} />
                </MetricCard>
              </div>
            </div>

            {/* Bloco 3 — Eficiência */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Eficiência</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <MetricCard title="CPL" icon={DollarSign} sub="Custo por Lead">
                  <AnimatedCurrency value={metrics.cpl} />
                </MetricCard>
                <MetricCard title="Custo p/ Qualificado" icon={DollarSign} sub="Por lead com tag QUALIFICADO">
                  <AnimatedCurrency value={metrics.costPerQualified} />
                </MetricCard>
                <MetricCard title="Custo p/ Reunião" icon={DollarSign} sub="Investimento ÷ reuniões realizadas">
                  {metrics.costPerCall == null ? (
                    <span className="text-muted-foreground text-base">—</span>
                  ) : (
                    <AnimatedCurrency value={metrics.costPerCall} />
                  )}
                </MetricCard>
                <MetricCard title="CAC" icon={DollarSign} iconClass="text-red-500" sub="Custo de Aquisição">
                  <span className="text-red-600"><AnimatedCurrency value={metrics.cac} /></span>
                </MetricCard>
                <MetricCard title="Leads por dia" icon={Calendar} sub="Média diária no período selecionado">
                  <AnimatedNumber value={metrics.leadsPerDay} decimals={1} />
                </MetricCard>
                <MetricCard title="Tempo p/ Fechar" icon={Clock} sub="Média em dias">
                  <AnimatedNumber value={metrics.avgClosingTime} decimals={1} />
                  <span className="text-base font-normal ml-1">dias</span>
                </MetricCard>
              </div>
            </div>

            {/* Bloco 4 — Resultado e retorno */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Resultado</p>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <MetricCard title="ROAS" icon={TrendingUp} iconClass="text-green-600"
                  sub={
                    metrics.roasUsesPeriodCash
                      ? "Caixa no período (parcelas pagas na janela) ÷ investimento"
                      : "Total já recebido da coorte ÷ investimento"
                  }>
                  {metrics.investment > 0 ? (
                    <span className={metrics.roas >= 1 ? "text-green-600" : "text-red-600"}>
                      <AnimatedNumber value={metrics.roas} decimals={2} />x
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-base">N/A</span>
                  )}
                </MetricCard>
                <MetricCard
                  title="ROI (x)"
                  icon={Percent}
                  sub={
                    metrics.roasUsesPeriodCash
                      ? "(Recebido no período − investimento) ÷ investimento"
                      : "(Total já recebido da coorte − investimento) ÷ investimento"
                  }
                >
                  {metrics.investment > 0 ? (
                    <span className={metrics.roiX >= 0 ? "text-green-600" : "text-red-600"}>
                      <AnimatedNumber value={metrics.roiX} decimals={2} />x
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-base">N/A</span>
                  )}
                </MetricCard>
              </div>
            </div>

            {/* Bloco 5 — Taxas de Conversão */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Taxas de Conversão</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard title="Lead → Venda" icon={Percent}
                  sub="Leads criados no período que já estão ganhos">
                  <AnimatedNumber value={metrics.leadToSaleRate} decimals={1} />%
                </MetricCard>
                <MetricCard title="Qualificado → Venda" icon={Percent}
                  sub="Vendas ÷ leads qualificados">
                  <AnimatedNumber value={metrics.qualifiedToSaleRate} decimals={1} />%
                </MetricCard>
                <MetricCard title="Reunião → Venda" icon={Percent}
                  sub="Vendas com reunião realizada ÷ reuniões realizadas">
                  {metrics.callToSaleRate == null ? (
                    <span className="text-muted-foreground text-base">—</span>
                  ) : (
                    <><AnimatedNumber value={metrics.callToSaleRate} decimals={1} />%</>
                  )}
                </MetricCard>
                <MetricCard title="Reuniões p/ Venda" icon={Phone}
                  sub="Reuniões realizadas ÷ vendas">
                  {metrics.callsPerSale == null ? (
                    <span className="text-muted-foreground text-base">—</span>
                  ) : (
                    <AnimatedNumber value={metrics.callsPerSale} decimals={1} />
                  )}
                </MetricCard>
                <MetricCard title="Taxa de No-show" icon={AlertCircle}
                  sub={`${metrics.noShowLeadsCount} lead(s) não compareceram`}>
                  <AnimatedNumber value={metrics.noShowRate} decimals={1} />%
                </MetricCard>
              </div>
            </div>

            {metrics.meetingsHeldCount === 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Sem reuniões realizadas registradas no período. Métricas de reunião podem aparecer como "—".
              </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Leads por Etapa do Pipeline</CardTitle>
                  <CardDescription>Distribuição dos leads da campanha por etapa</CardDescription>
                </CardHeader>
                <CardContent>
                  {pipelineData.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      Nenhum lead no período da campanha
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={pipelineData} margin={{ top: 4, right: 4, bottom: 40, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                          {pipelineData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leads por Fonte</CardTitle>
                  <CardDescription>Origem dos leads (barras horizontais)</CardDescription>
                </CardHeader>
                <CardContent>
                  {sourceData.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      Nenhuma fonte identificada no período
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={sourceDataSorted}
                        layout="vertical"
                        margin={{ top: 4, right: 12, bottom: 4, left: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {sourceDataSorted.map((_, index) => (
                            <Cell key={`source-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
