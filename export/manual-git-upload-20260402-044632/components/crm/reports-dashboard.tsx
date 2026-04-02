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
  PieChart,
  Pie,
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
} from "lucide-react";
import type { Lead, PipelineColumn, LeadSource, Meeting } from "@/lib/types";
import { getWonPipelineColumn, leadTouchesPeriod, meetingTouchesPeriod } from "@/lib/pipeline-utils";
import { CampaignManager, type Campaign } from "./campaign-manager";
import { formatCurrency } from "@/lib/timezone";

interface ReportsDashboardProps {
  leads: (Lead & {
    lead_tags?: { tags: { id: string; name: string; color: string } }[];
  })[];
  columns: PipelineColumn[];
  sources: LeadSource[];
  meetings: Meeting[];
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
  initialCampaigns,
  userId,
}: ReportsDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [filterMode, setFilterMode] = useState<"campaign" | "range">("campaign");
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

  // Dados calculados para o modo "range livre"
  const rangeData = useMemo(() => {
    if (filterMode !== "range" || !rangeStart || !rangeEnd) return null;
    const rStart = new Date(rangeStart + "T00:00:00");
    const rEnd = new Date(rangeEnd + "T23:59:59");

    // Leads criados dentro do range (exceto perdidos)
    const rangeLeads = leads.filter((lead) => {
      if (lead.is_lost) return false;
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
      const created = new Date(lead.created_at);
      return created >= start && created <= end;
    });
  }, [leads, selectedCampaign, filterMode, rangeData]);

  const wonColumn = useMemo(() => getWonPipelineColumn(columns), [columns]);

  const periodBounds = useMemo(() => {
    if (filterMode === "range" && rangeStart && rangeEnd) {
      return {
        start: new Date(rangeStart + "T00:00:00"),
        end: new Date(rangeEnd + "T23:59:59"),
      };
    }
    if (filterMode === "campaign" && selectedCampaign) {
      return {
        start: new Date(selectedCampaign.start_date + "T00:00:00"),
        end: new Date(selectedCampaign.end_date + "T23:59:59"),
      };
    }
    return null;
  }, [filterMode, rangeStart, rangeEnd, selectedCampaign]);

  const metrics = useMemo(() => {
    // Investimento: proporcional no modo range, budget total no modo campanha
    const investment =
      filterMode === "range"
        ? rangeData?.totalInvestment || 0
        : selectedCampaign?.budget || 0;

    const totalLeads = campaignLeads.length;

    // Qualificados: leads com tag contendo "QUALIFICADO" (case insensitive)
    const qualifiedLeads = campaignLeads.filter((lead) =>
      lead.lead_tags?.some((lt) =>
        lt.tags.name.toUpperCase().includes("QUALIFICADO")
      )
    );
    const qualifiedCount = qualifiedLeads.length;
    const qualificationRate = totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0;

    // Coorte: leads criados no período que já estão em "Venda Feita" (taxa lead→venda da coorte)
    const cohortWonLeads = campaignLeads.filter((l) => wonColumn && l.column_id === wonColumn.id);

    // Vendas / faturamento / CAC: ganhos que "tocam" o período (criados OU atualizados na janela).
    // Assim entram fechamentos feitos no período mesmo se o lead entrou antes da campanha.
    const salesLeads =
      wonColumn && periodBounds
        ? leads.filter(
            (l) =>
              !l.is_lost &&
              l.column_id === wonColumn.id &&
              leadTouchesPeriod(l, periodBounds.start, periodBounds.end)
          )
        : [];
    const totalSales = salesLeads.length;
    const revenue = salesLeads.reduce((sum, l) => sum + Number(l.deal_value || 0), 0);
    const avgTicket = totalSales > 0 ? revenue / totalSales : 0;

    // Reuniões: (1) lead pertence à coorte do período OU (2) data/cadastro da reunião na janela.
    // Assim entram calls agendadas depois do fim da campanha para leads gerados na campanha.
    const cohortLeadIds = new Set(campaignLeads.map((l) => l.id));
    const activeMeetings = meetings.filter((m) => {
      if (m.status === "cancelled") return false;
      const forCohortLead = m.lead_id != null && cohortLeadIds.has(m.lead_id);
      const inTimeWindow =
        periodBounds != null &&
        meetingTouchesPeriod(m, periodBounds.start, periodBounds.end);
      return forCohortLead || inTimeWindow;
    });

    const totalCalls = activeMeetings.length;

    const soldLeadIds = new Set(salesLeads.map((l) => l.id));
    const meetingsWithSoldLead = activeMeetings.filter(
      (m) => m.lead_id != null && soldLeadIds.has(m.lead_id)
    );
    const meetingsConvertedCount = meetingsWithSoldLead.length;

    // Métricas de custo
    const cpl = totalLeads > 0 && investment > 0 ? investment / totalLeads : 0;
    const costPerQualified = qualifiedCount > 0 && investment > 0 ? investment / qualifiedCount : 0;
    const costPerCall = totalCalls > 0 && investment > 0 ? investment / totalCalls : 0;
    const cac = totalSales > 0 && investment > 0 ? investment / totalSales : 0;

    // Taxas de conversão
    const leadToSaleRate =
      totalLeads > 0 ? (cohortWonLeads.length / totalLeads) * 100 : 0;
    const callToSaleRate =
      totalCalls > 0 ? (meetingsConvertedCount / totalCalls) * 100 : 0;
    const leadToCallRate = totalLeads > 0 ? (totalCalls / totalLeads) * 100 : 0;
    const callsPerSale =
      totalSales > 0 ? meetingsConvertedCount / totalSales : 0;
    const qualifiedWonCount = cohortWonLeads.filter((l) =>
      l.lead_tags?.some((lt) => lt.tags.name.toUpperCase().includes("QUALIFICADO"))
    ).length;
    const qualifiedToSaleRate =
      qualifiedCount > 0 ? (qualifiedWonCount / qualifiedCount) * 100 : 0;

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

    const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : 0;

    return {
      investment,
      totalLeads,
      qualifiedCount,
      qualificationRate,
      totalSales,
      revenue,
      avgTicket,
      totalCalls,
      cpl,
      costPerQualified,
      costPerCall,
      cac,
      leadToSaleRate,
      callToSaleRate,
      leadToCallRate,
      callsPerSale,
      qualifiedToSaleRate,
      avgClosingTime,
      roi,
    };
  }, [
    campaignLeads,
    leads,
    selectedCampaign,
    wonColumn,
    periodBounds,
    meetings,
    filterMode,
    rangeData,
  ]);

  // Gráfico: distribuição por pipeline
  const pipelineData = useMemo(() => {
    return columns
      .map((col) => ({
        name: col.name,
        leads: campaignLeads.filter((l) => l.column_id === col.id).length,
        color: col.color,
      }))
      .filter((d) => d.leads > 0);
  }, [campaignLeads, columns]);

  // Gráfico: leads por fonte
  const sourceData = useMemo(() => {
    return sources
      .map((source) => ({
        name: source.name,
        value: campaignLeads.filter((l) => l.source_id === source.id).length,
      }))
      .filter((d) => d.value > 0);
  }, [campaignLeads, sources]);

  const isCampaignActive = selectedCampaign
    ? (() => {
        const today = new Date().toISOString().slice(0, 10);
        return selectedCampaign.is_active && selectedCampaign.start_date <= today && selectedCampaign.end_date >= today;
      })()
    : false;

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

            {/* Bloco 1 — Volume */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Volume</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Total de Leads" icon={Users}
                  sub={`${metrics.totalLeads} leads no período`}>
                  <AnimatedNumber value={metrics.totalLeads} />
                </MetricCard>
                <MetricCard title="Leads Qualificados" icon={Target} iconClass="text-blue-500"
                  sub={<><AnimatedNumber value={metrics.qualificationRate} decimals={1} />% de qualificação</>}>
                  <span className="text-blue-600"><AnimatedNumber value={metrics.qualifiedCount} /></span>
                </MetricCard>
                <MetricCard title="Reuniões Marcadas" icon={Phone}
                  sub={<><AnimatedNumber value={metrics.leadToCallRate} decimals={1} />% dos leads · coorte ou data/cadastro na janela</>}>
                  <AnimatedNumber value={metrics.totalCalls} />
                </MetricCard>
                <MetricCard title="Vendas" icon={CheckCircle} iconClass="text-green-600"
                  sub="Ganhos com criação ou fechamento (atualização) na janela">
                  <span className="text-green-600"><AnimatedNumber value={metrics.totalSales} /></span>
                </MetricCard>
              </div>
            </div>

            {/* Bloco 2 — Custos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Custos</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="CPL" icon={DollarSign} sub="Custo por Lead">
                  <AnimatedCurrency value={metrics.cpl} />
                </MetricCard>
                <MetricCard title="Custo p/ Qualificado" icon={DollarSign} sub="Por lead com tag QUALIFICADO">
                  <AnimatedCurrency value={metrics.costPerQualified} />
                </MetricCard>
                <MetricCard title="Custo p/ Reunião" icon={DollarSign} sub="Investimento ÷ reuniões na janela">
                  <AnimatedCurrency value={metrics.costPerCall} />
                </MetricCard>
                <MetricCard title="CAC" icon={DollarSign} iconClass="text-red-500" sub="Custo de Aquisição">
                  <span className="text-red-600"><AnimatedCurrency value={metrics.cac} /></span>
                </MetricCard>
              </div>
            </div>

            {/* Bloco 3 — Resultado */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Resultado</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Faturamento" icon={DollarSign} iconClass="text-green-600">
                  <span className="text-green-600"><AnimatedCurrency value={metrics.revenue} /></span>
                </MetricCard>
                <MetricCard title="Ticket Médio" icon={DollarSign}>
                  <AnimatedCurrency value={metrics.avgTicket} />
                </MetricCard>
                <MetricCard title="ROI" icon={TrendingUp} iconClass="text-green-600"
                  sub="Retorno sobre investimento">
                  {metrics.investment > 0 ? (
                    <span className={metrics.roi >= 0 ? "text-green-600" : "text-red-600"}>
                      <AnimatedNumber value={metrics.roi} decimals={1} />%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-base">N/A</span>
                  )}
                </MetricCard>
                <MetricCard title="Tempo p/ Fechar" icon={Clock} sub="Média em dias">
                  <AnimatedNumber value={metrics.avgClosingTime} decimals={1} />
                  <span className="text-base font-normal ml-1">dias</span>
                </MetricCard>
              </div>
            </div>

            {/* Bloco 4 — Taxas de Conversão */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Taxas de Conversão</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Lead → Venda" icon={Percent}
                  sub="Leads criados no período que já estão ganhos">
                  <AnimatedNumber value={metrics.leadToSaleRate} decimals={1} />%
                </MetricCard>
                <MetricCard title="Qualificado → Venda" icon={Percent}
                  sub="De leads qualificados">
                  <AnimatedNumber value={metrics.qualifiedToSaleRate} decimals={1} />%
                </MetricCard>
                <MetricCard title="Reunião → Venda" icon={Percent}
                  sub="% das reuniões na janela cujo lead está em ganho">
                  <AnimatedNumber value={metrics.callToSaleRate} decimals={1} />%
                </MetricCard>
                <MetricCard title="Reuniões p/ Venda" icon={Phone}
                  sub="Reuniões na janela (lead ganho) ÷ vendas">
                  <AnimatedNumber value={metrics.callsPerSale} decimals={1} />
                </MetricCard>
              </div>
            </div>

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
                  <CardDescription>Origem dos leads dentro da campanha</CardDescription>
                </CardHeader>
                <CardContent>
                  {sourceData.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      Nenhuma fonte identificada no período
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={sourceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {sourceData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
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
