"use client";

import { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { TrendingUp } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface LeadsByState {
  state_abbreviation: string;
  state_name: string;
  count: number;
}

interface USMapDashboardProps {
  leadsByState: LeadsByState[];
}

// Mapeamento de nomes completos para abreviações
const stateNameToAbbr: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY"
};

export function USMapDashboard({ leadsByState }: USMapDashboardProps) {
  const [content, setContent] = useState("");

  // Criar a escala de cores com mais contraste
  const colorScale = useMemo(() => {
    const maxLeads = Math.max(...leadsByState.map(s => s.count), 1);
    return scaleLinear<string>()
      .domain([0, maxLeads / 2, maxLeads])
      .range(["#e0f2fe", "#0369a1", "#0c4a6e"]);
  }, [leadsByState]);

  const getStateData = (geoName: string) => {
    const abbr = stateNameToAbbr[geoName];
    return leadsByState.find(s => s.state_abbreviation === abbr);
  };

  const topStates = useMemo(() => {
    return [...leadsByState].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [leadsByState]);

  return (
    <div className="col-span-full space-y-6">
      {/* Título principal */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Estados mais Rentáveis</h2>
        <p className="text-sm text-muted-foreground mt-1">Distribuição geográfica de leads</p>
      </div>

      {/* Top 3 Estados */}
      <div className="flex justify-center gap-4 flex-wrap">
        {topStates.map((state, index) => (
          <div
            key={state.state_abbreviation}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-primary/50 to-primary rounded-2xl blur-sm opacity-30 group-hover:opacity-50 transition"></div>
            <div className="relative bg-card border border-border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 min-w-[200px]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: colorScale(state.count) }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                </div>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-foreground">{state.count}</p>
                <p className="text-sm font-semibold text-foreground">{state.state_name}</p>
                <p className="text-xs text-muted-foreground">{state.state_abbreviation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mapa centralizado e menor com mais contraste */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-1">
          {/* Brilho superior para efeito 3D */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none z-10"></div>
          
          <div className="p-8 bg-transparent">
            <ComposableMap projection="geoAlbersUsa">
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const stateData = getStateData(geo.properties.name);
                    const fillColor = stateData ? colorScale(stateData.count) : "#f1f5f9";
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() => {
                          setContent(`${geo.properties.name}: ${stateData?.count || 0} leads`);
                        }}
                        onMouseLeave={() => {
                          setContent("");
                        }}
                        style={{
                          default: {
                            fill: fillColor,
                            stroke: "#475569",
                            strokeWidth: 0.75,
                            outline: "none"
                          },
                          hover: {
                            fill: "#f97316",
                            stroke: "#1e293b",
                            strokeWidth: 1.5,
                            outline: "none",
                            cursor: "pointer"
                          },
                          pressed: {
                            fill: "#ea580c",
                            stroke: "#1e293b",
                            strokeWidth: 1.5,
                            outline: "none"
                          }
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {/* Tooltip flutuante */}
          {content && (
            <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-slate-300 text-sm font-semibold text-slate-800 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
              {content}
            </div>
          )}

          {/* Legenda com efeito glassmorphism */}
          <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-300 z-20">
            <p className="text-xs font-bold mb-3 text-slate-700">Densidade de Leads</p>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#e0f2fe] shadow-sm border border-slate-300"></div>
                <span className="text-slate-700 font-medium">Baixo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#0369a1] shadow-sm"></div>
                <span className="text-slate-700 font-medium">Médio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#0c4a6e] shadow-sm"></div>
                <span className="text-slate-700 font-medium">Alto</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
