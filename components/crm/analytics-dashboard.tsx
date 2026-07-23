"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { Users, TrendingUp, CheckCircle2, Clock, BarChart3, ArrowUpRight } from "lucide-react";
import type { Lead, PipelineColumn, LeadSource, Task } from "@/lib/types";
import { useEffect, useState } from "react";
import { getThemeAwareColor } from "@/lib/color-utils";

interface AnalyticsDashboardProps {
  leads: (Lead & {
    lead_sources: { name: string; type: string } | null;
    pipeline_columns: { name: string; color: string } | null;
  })[];
  columns: PipelineColumn[];
  sources: LeadSource[];
  tasks: Task[];
}

export function AnalyticsDashboard({
  leads,
  columns,
  sources,
  tasks,
}: AnalyticsDashboardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Leads por coluna do pipeline
  const leadsByColumn = columns.map((col) => ({
    name: col.name,
    value: leads.filter((l) => l.column_id === col.id).length,
    color: mounted ? getThemeAwareColor(col.color) : col.color,
  }));

  // Leads por fonte
  const leadsBySource = sources.map((source) => ({
    name: source.name,
    value: leads.filter((l) => l.source_id === source.id).length,
    color: mounted ? getThemeAwareColor(source.color) : source.color,
  }));

  // Leads por mes (ultimos 6 meses)
  const getLeadsByMonth = () => {
    const months: { name: string; leads: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("en-US", { month: "short" });
      const monthLeads = leads.filter((l) => {
        const leadDate = new Date(l.created_at);
        return (
          leadDate.getMonth() === date.getMonth() &&
          leadDate.getFullYear() === date.getFullYear()
        );
      }).length;
      months.push({ name: monthName, leads: monthLeads });
    }

    return months;
  };

  const leadsByMonth = getLeadsByMonth();

  // Estatisticas de tasks
  const completedTasks = tasks.filter((t) => t.completed).length;
  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const taskCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Taxa de conversao (leads na ultima coluna / total)
  const lastColumn = columns[columns.length - 1];
  const convertedLeads = lastColumn
    ? leads.filter((l) => l.column_id === lastColumn.id).length
    : 0;
  const conversionRate =
    leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} leads
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-primary mb-1">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Analytics</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Metricas e insights sobre seus leads
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total de Leads</p>
                <p className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                  {leads.length}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <ArrowUpRight className="w-3 h-3 text-success" />
                  <span className="text-success font-medium">Ativos</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Taxa de Conversao</p>
                <p className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                  {conversionRate}%
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-success font-medium">{convertedLeads} convertidos</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-7 h-7 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-chart-2/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Tasks Concluidas</p>
                <p className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                  {completedTasks}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-chart-2" />
                  <span>{taskCompletionRate}% completo</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-chart-2/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="w-7 h-7 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover-lift border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex items-center justify-between relative">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Tasks Pendentes</p>
                <p className="text-4xl font-bold text-foreground mt-2 tracking-tight">
                  {pendingTasks}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 text-warning" />
                  <span className="text-warning font-medium">A fazer</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-warning/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-7 h-7 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Leads por Etapa do Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsByColumn.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsByColumn}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {leadsByColumn.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Crie colunas no pipeline para ver este grafico
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Leads por Fonte</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsBySource.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leadsBySource.filter((s) => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {leadsBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Cadastre leads com fontes para ver este grafico
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Evolucao de Leads (Ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={leadsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--primary)", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "var(--primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
