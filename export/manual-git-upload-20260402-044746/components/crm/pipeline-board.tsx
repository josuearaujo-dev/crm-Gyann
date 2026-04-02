"use client";

import React from "react"

import { useState, useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, MoreHorizontal, Trash2, Kanban, Filter, ChevronDown, Check, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadCard } from "./lead-card";
import { LeadDetail } from "./lead-detail";
import type { PipelineColumn, Lead, Tag } from "@/lib/types";
import { getThemeAwareColor } from "@/lib/color-utils";
import { getWonPipelineColumn } from "@/lib/pipeline-utils";

interface LeadSource {
  id: string;
  name: string;
  type: string;
}

interface PipelineBoardProps {
  initialColumns: PipelineColumn[];
  initialLeads: (Lead & {
    lead_sources: { name: string; type: string } | null;
    lead_tags: { tags: Tag }[];
  })[];
  tags: Tag[];
  sources: LeadSource[];
  userId: string;
}

export function PipelineBoard({
  initialColumns,
  initialLeads,
  tags,
  sources,
  userId,
}: PipelineBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [leads, setLeads] = useState(initialLeads);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3b82f6");
  const [newColumnPosition, setNewColumnPosition] = useState<number>(0);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  
  // Drag scroll states
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterNationality, setFilterNationality] = useState<string>("all");
  
  // Estados dos popovers
  const [openStage, setOpenStage] = useState(false);
  const [openState, setOpenState] = useState(false);
  const [openNationality, setOpenNationality] = useState(false);
  const [openSource, setOpenSource] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const supabase = createClient();
  const [states, setStates] = useState<any[]>([]);
  const [nationalities, setNationalities] = useState<any[]>([]);

  const wonColumnId = React.useMemo(() => getWonPipelineColumn(columns)?.id, [columns]);

  useEffect(() => {
    loadFiltersData();
  }, []);

  const loadFiltersData = async () => {
    const { data: statesData } = await supabase
      .from("us_states")
      .select("*")
      .order("name", { ascending: true });
    setStates(statesData || []);

    const { data: nationalitiesData } = await supabase
      .from("nationalities")
      .select("*")
      .order("country", { ascending: true });
    setNationalities(nationalitiesData || []);
  };

  const activeLeadId = selectedLead;

  // Drag scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Aplicar filtros
  const filteredLeads = leads.filter((lead) => {
    // Filtrar leads perdidos do pipeline
    if (lead.is_lost) {
      return false;
    }

    const matchesSearch = lead.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesSource = filterSource
      ? lead.source_id === filterSource
      : true;
    const matchesStage = filterStage !== "all"
      ? lead.column_id === filterStage
      : true;

    let matchesDateRange = true;
    if (filterDateFrom || filterDateTo) {
      const leadDate = new Date(lead.created_at);
      if (filterDateFrom) {
        matchesDateRange =
          matchesDateRange && leadDate >= new Date(filterDateFrom);
      }
      if (filterDateTo) {
        const endDate = new Date(filterDateTo);
        endDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && leadDate <= endDate;
      }
    }

    const matchesState = filterState !== "all"
      ? lead.state_id === filterState
      : true;

    const matchesNationality = filterNationality !== "all"
      ? lead.nationality_id === filterNationality
      : true;

    return matchesSearch && matchesSource && matchesStage && matchesDateRange && matchesState && matchesNationality;
  });

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      alert("Por favor, preencha o nome da coluna");
      return;
    }

    console.log("[v0] Criando nova coluna:", { 
      name: newColumnName, 
      color: newColumnColor, 
      position: newColumnPosition,
      userId 
    });

    // Atualizar posições das colunas existentes se necessário
    if (newColumnPosition < columns.length) {
      console.log("[v0] Atualizando posições das colunas existentes");
      const updatePromises = columns
        .filter(col => col.position >= newColumnPosition)
        .map(col => 
          supabase
            .from("pipeline_columns")
            .update({ position: col.position + 1 })
            .eq("id", col.id)
        );
      
      await Promise.all(updatePromises);
    }

    const { data, error } = await supabase
      .from("pipeline_columns")
      .insert({
        name: newColumnName,
        color: newColumnColor,
        position: newColumnPosition,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[v0] Erro ao criar coluna:", error);
      alert(`Erro ao criar coluna: ${error.message}`);
      return;
    }

    if (data) {
      console.log("[v0] Coluna criada com sucesso:", data);
      
      // Recarregar colunas para refletir novas posições
      const { data: updatedColumns } = await supabase
        .from("pipeline_columns")
        .select("*")
        .order("position", { ascending: true });
      
      if (updatedColumns) {
        setColumns(updatedColumns);
      }
      
      setNewColumnName("");
      setNewColumnColor("#3b82f6");
      setNewColumnPosition(0);
      setIsAddingColumn(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    const { error } = await supabase
      .from("pipeline_columns")
      .delete()
      .eq("id", columnId);

    if (!error) {
      setColumns(columns.filter((c) => c.id !== columnId));
      setLeads(leads.filter((l) => l.column_id !== columnId));
    }
  };

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedLead) return;
    
    if (wonColumnId && columnId === wonColumnId) {
      const lead = leads.find(l => l.id === draggedLead);
      const dealValue = lead?.deal_value || 0;
      
      if (dealValue <= 0) {
        // Abrir detalhe do lead para o usuário preencher o valor
        setSelectedLead(draggedLead);
        setDraggedLead(null);
        alert("Para marcar como ganho, é necessário preencher o valor do negócio. O detalhe do lead foi aberto para você finalizar.");
        return;
      }
    }
    
    const { error } = await supabase
      .from("leads")
      .update({ column_id: columnId })
      .eq("id", draggedLead);
    
    if (!error) {
      setLeads(
        leads.map((lead) =>
          lead.id === draggedLead ? { ...lead, column_id: columnId } : lead
        )
      );
    }
    setDraggedLead(null);
  };

  const handleLeadClick = (leadId: string) => {
    setSelectedLead(leadId);
  };

  const handleCloseDetail = () => {
    setSelectedLead(null);
  };

  const handleLeadUpdate = async () => {
    // Recarrega apenas os dados necessários sem refresh da página
    const { data: updatedLeads } = await supabase
      .from("leads")
      .select("*, lead_sources(name, type), lead_tags(tags(*))")
      .order("created_at", { ascending: false });
    
    if (updatedLeads) {
      setLeads(updatedLeads);
    }
  };

  const selectedLeadData = leads.find((l) => l.id === activeLeadId);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 lg:p-8 border-b border-border bg-gradient-to-r from-transparent via-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Kanban className="w-4 h-4" />
              <span className="text-sm font-medium uppercase tracking-wider">Pipeline</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Seus Leads</h1>
            <p className="text-muted-foreground mt-1">
              Arraste e solte para mover entre etapas
            </p>
          </div>
          <Dialog open={isAddingColumn} onOpenChange={setIsAddingColumn}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Coluna
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Coluna</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome da coluna</Label>
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Ex: Qualificacao"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Select 
                    value={newColumnPosition.toString()} 
                    onValueChange={(v) => setNewColumnPosition(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a posição" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(columns.length + 1)].map((_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i === 0 ? "Início" : i === columns.length ? "Final" : `Posição ${i + 1}`}
                          {i < columns.length && ` (antes de "${columns[i].name}")`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={newColumnColor}
                      onChange={(e) => setNewColumnColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={newColumnColor}
                      onChange={(e) => setNewColumnColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <Button onClick={handleAddColumn} className="w-full">
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="px-6 lg:px-8 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 transition-all hover:shadow-md"
          >
            <Filter className={`w-4 h-4 transition-all duration-300 ${showFilters ? "text-primary" : ""}`} />
            <span className="font-medium">Filtros</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-in-out ${showFilters ? "rotate-180" : "rotate-0"}`} />
          </Button>
          <div className={`transition-all duration-300 ${showFilters ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilterSource("");
                setFilterStage("all");
                setFilterDateRange("all");
                setFilterDateFrom("");
                setFilterDateTo("");
                setFilterState("all");
                setFilterNationality("all");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
        
        <div 
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            showFilters ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
          }`}
        >
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Busca */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buscar Lead</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Filtros principais em 3 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Filtro por Fonte */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fonte do Lead</Label>
              <Popover open={openSource} onOpenChange={setOpenSource}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSource}
                    className="h-9 w-full justify-between bg-transparent"
                  >
                    {filterSource === "" 
                      ? "Todas as fontes"
                      : sources.find((s) => s.id === filterSource)?.name}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar fonte..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma fonte encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterSource("");
                            setOpenSource(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterSource === "" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas as fontes
                        </CommandItem>
                        {sources.map((source) => (
                          <CommandItem
                            key={source.id}
                            value={source.name}
                            onSelect={() => {
                              setFilterSource(source.id);
                              setOpenSource(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterSource === source.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {source.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro por Etapa */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Etapa do Pipeline</Label>
              <Popover open={openStage} onOpenChange={setOpenStage}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStage}
                    className="h-9 w-full justify-between bg-transparent"
                  >
                    {filterStage === "all" 
                      ? "Todas as etapas"
                      : columns.find((col) => col.id === filterStage)?.name}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar etapa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma etapa encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterStage("all");
                            setOpenStage(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterStage === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas as etapas
                        </CommandItem>
                        {columns.map((col) => (
                          <CommandItem
                            key={col.id}
                            value={col.name}
                            onSelect={() => {
                              setFilterStage(col.id);
                              setOpenStage(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterStage === col.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {col.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro por Data */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data de Entrada</Label>
              <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as datas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Intervalo personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Estado (EUA) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado (EUA)</Label>
              <Popover open={openState} onOpenChange={setOpenState}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openState}
                    className="h-9 w-full justify-between bg-transparent"
                  >
                    {filterState === "all" 
                      ? "Todos os estados"
                      : `${states.find((s) => s.id === filterState)?.abbreviation} - ${states.find((s) => s.id === filterState)?.name}`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar estado..." />
                    <CommandList>
                      <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterState("all");
                            setOpenState(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterState === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todos os estados
                        </CommandItem>
                        {states.map((state) => (
                          <CommandItem
                            key={state.id}
                            value={`${state.abbreviation} ${state.name}`}
                            onSelect={() => {
                              setFilterState(state.id);
                              setOpenState(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterState === state.id ? "opacity-100" : "opacity-0"}`}
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

            {/* Filtros secundários em 2 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Filtro por Estado (EUA) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado (EUA)</Label>
              <Popover open={openState} onOpenChange={setOpenState}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openState}
                    className="h-9 w-full justify-between bg-transparent"
                  >
                    {filterState === "all" 
                      ? "Todos os estados"
                      : `${states.find((s) => s.id === filterState)?.abbreviation} - ${states.find((s) => s.id === filterState)?.name}`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar estado..." />
                    <CommandList>
                      <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterState("all");
                            setOpenState(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterState === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todos os estados
                        </CommandItem>
                        {states.map((state) => (
                          <CommandItem
                            key={state.id}
                            value={`${state.abbreviation} ${state.name}`}
                            onSelect={() => {
                              setFilterState(state.id);
                              setOpenState(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterState === state.id ? "opacity-100" : "opacity-0"}`}
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

            {/* Filtro por Nacionalidade */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nacionalidade</Label>
              <Popover open={openNationality} onOpenChange={setOpenNationality}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openNationality}
                    className="h-9 w-full justify-between bg-transparent"
                  >
                    {filterNationality === "all" 
                      ? "Todas as nacionalidades"
                      : nationalities.find((n) => n.id === filterNationality)?.country}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar nacionalidade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma nacionalidade encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterNationality("all");
                            setOpenNationality(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterNationality === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          Todas as nacionalidades
                        </CommandItem>
                        {nationalities.map((nationality) => (
                          <CommandItem
                            key={nationality.id}
                            value={nationality.country}
                            onSelect={() => {
                              setFilterNationality(nationality.id);
                              setOpenNationality(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterNationality === nationality.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {nationality.country}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            </div>

            {/* Data personalizada */}
            {filterDateRange === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data inicial</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data final</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-x-auto p-6 lg:p-8 ${isDragging ? "cursor-grabbing" : "cursor-grab"} select-none`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className="flex gap-5 h-full min-w-max">
          {columns
            .filter((column) => filterStage === "all" || column.id === filterStage)
            .map((column, colIndex) => {
            const columnLeads = filteredLeads.filter((l) => l.column_id === column.id);
            const isSingleColumnView = filterStage !== "all";
            
            return (
              <div
                key={column.id}
                className={`flex flex-col rounded-2xl border border-border/30 animate-fade-in bg-card ${
                  isSingleColumnView ? "w-full" : "w-80"
                }`}
                style={{ animationDelay: `${colIndex * 100}ms` }}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
                <div className="p-4 flex items-center justify-between border-b border-border/30 bg-card">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full ring-4 ring-offset-2 ring-offset-background"
                      style={{ 
                        backgroundColor: getThemeAwareColor(column.color),
                        boxShadow: `0 0 12px ${getThemeAwareColor(column.color)}60`,
                        borderColor: getThemeAwareColor(column.color)
                      }}
                    />
                    <span className="font-semibold text-foreground">
                      {column.name}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="animate-scale-in">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteColumn(column.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir coluna
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className={`flex-1 overflow-y-auto p-3 ${
                  isSingleColumnView 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 auto-rows-min" 
                    : "space-y-3"
                }`}>
                  {columnLeads.map((lead, leadIndex) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      className="cursor-grab active:cursor-grabbing active:scale-[1.02] transition-transform duration-150"
                      style={{ animationDelay: `${leadIndex * 50}ms` }}
                    >
                      <LeadCard
                        lead={lead}
                        onClick={() => handleLeadClick(lead.id)}
                      />
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center opacity-50 col-span-full">
                      <p className="text-sm text-muted-foreground">
                        Arraste leads aqui
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {columns.length === 0 && (
            <div className="flex items-center justify-center w-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira coluna para começar
                </p>
                <Button onClick={() => setIsAddingColumn(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Coluna
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLeadData && (
        <LeadDetail
          lead={selectedLeadData}
          tags={tags}
          columns={columns}
          onClose={handleCloseDetail}
          onUpdate={handleLeadUpdate}
        />
      )}
    </div>
  );
}
