"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Building,
  Calendar,
  DollarSign,
  XCircle,
  TrophyIcon,
  ExternalLink,
} from "lucide-react";
import type { Lead, PipelineColumn, LeadSource } from "@/lib/types";
import { getWonPipelineColumn } from "@/lib/pipeline-utils";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface LossReason {
  id: string;
  name: string;
}

interface LeadWithReason extends Lead {
  loss_reason?: LossReason | null;
}

interface LeadsTableProps {
  leads: LeadWithReason[];
  columns: PipelineColumn[];
  sources: LeadSource[];
  lossReasons: LossReason[];
}

export function LeadsTable({ leads, columns, sources, lossReasons }: LeadsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // all, active, lost, won
  const [filterLossReason, setFilterLossReason] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const wonColumnId = useMemo(() => getWonPipelineColumn(columns)?.id, [columns]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Filtro de busca
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de fonte
      const matchesSource = filterSource ? lead.source_id === filterSource : true;

      // Filtro de coluna (etapa)
      const matchesColumn = filterColumn ? lead.column_id === filterColumn : true;

      // Filtro de status
      let matchesStatus = true;
      if (filterStatus === "active") {
        matchesStatus = !lead.is_lost && lead.column_id !== wonColumnId;
      } else if (filterStatus === "lost") {
        matchesStatus = lead.is_lost === true;
      } else if (filterStatus === "won") {
        matchesStatus = wonColumnId ? lead.column_id === wonColumnId : false;
      }

      // Filtro de motivo de perda
      const matchesLossReason = filterLossReason 
        ? lead.loss_reason_id === filterLossReason 
        : true;

      // Filtro de data
      let matchesDateRange = true;
      if (filterDateFrom || filterDateTo) {
        const leadDate = new Date(lead.created_at);
        if (filterDateFrom) {
          matchesDateRange = matchesDateRange && leadDate >= new Date(filterDateFrom);
        }
        if (filterDateTo) {
          const endDate = new Date(filterDateTo);
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && leadDate <= endDate;
        }
      }

      return matchesSearch && matchesSource && matchesColumn && matchesStatus && matchesLossReason && matchesDateRange;
    });
  }, [
    leads,
    searchTerm,
    filterSource,
    filterColumn,
    filterStatus,
    filterLossReason,
    filterDateFrom,
    filterDateTo,
    wonColumnId,
  ]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter((l) => !l.is_lost && l.column_id !== wonColumnId).length;
    const won = wonColumnId ? leads.filter((l) => l.column_id === wonColumnId).length : 0;
    const lost = leads.filter((l) => l.is_lost).length;
    const totalValue = wonColumnId
      ? leads.filter((l) => l.column_id === wonColumnId).reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0)
      : 0;

    return { total, active, won, lost, totalValue };
  }, [leads, wonColumnId]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterSource("");
    setFilterColumn("");
    setFilterStatus("all");
    setFilterLossReason("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const getStatusBadge = (lead: LeadWithReason) => {
    if (lead.is_lost) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Perdido
        </Badge>
      );
    }
    if (wonColumnId && lead.column_id === wonColumnId) {
      return (
        <Badge className="gap-1 bg-green-600">
          <TrophyIcon className="w-3 h-3" />
          Ganho
        </Badge>
      );
    }
    return <Badge variant="secondary">Ativo</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total de Leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.won}</div>
            <div className="text-xs text-muted-foreground">Ganhos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.lost}</div>
            <div className="text-xs text-muted-foreground">Perdidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.totalValue)}
            </div>
            <div className="text-xs text-muted-foreground">Valor Fechado</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Filtros</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email, telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="won">Ganhos</SelectItem>
                    <SelectItem value="lost">Perdidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Fonte</Label>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Etapa</Label>
                <Select value={filterColumn} onValueChange={setFilterColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filterStatus === "lost" && (
                <div className="space-y-2">
                  <Label className="text-xs">Motivo de Perda</Label>
                  <Select value={filterLossReason} onValueChange={setFilterLossReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {lossReasons.map((reason) => (
                        <SelectItem key={reason.id} value={reason.id}>
                          {reason.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Data Inicial</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Data Final</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Motivo/Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado com os filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{getStatusBadge(lead)}</TableCell>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {lead.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.company && (
                          <div className="flex items-center gap-1 text-sm">
                            <Building className="w-3 h-3" />
                            {lead.company}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {columns.find(c => c.id === lead.column_id)?.name || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sources.find(s => s.id === lead.source_id)?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {lead.deal_value && lead.deal_value > 0 ? (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="w-3 h-3" />
                            {new Intl.NumberFormat('en-US', { 
                              style: 'currency', 
                              currency: 'USD',
                              minimumFractionDigits: 0,
                            }).format(Number(lead.deal_value))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(lead.created_at), "MM/dd/yyyy", { locale: enUS })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.is_lost && (
                          <div className="text-sm space-y-1">
                            <div className="font-medium text-destructive">
                              {lead.loss_reason?.name || "Não especificado"}
                            </div>
                            {lead.loss_notes && (
                              <div className="text-muted-foreground text-xs line-clamp-2">
                                {lead.loss_notes}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground text-center">
        Mostrando {filteredLeads.length} de {leads.length} leads
      </div>
    </div>
  );
}
