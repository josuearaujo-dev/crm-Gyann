"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import type { Lead, Tag } from "@/lib/types";

interface LeadCardProps {
  lead: Lead & {
    lead_sources: { name: string; type: string } | null;
    lead_tags: { tags: Tag }[];
  };
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <Card
      className="bg-card hover:bg-accent/50 border-border/50 hover:border-border hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <span className="text-xs font-bold text-primary">
                  {lead.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {lead.name}
                </p>
                {lead.company && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {lead.company}
                  </p>
                )}
              </div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 flex-shrink-0" />
          </div>

          <div className="space-y-1 pl-10">
            {lead.email && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span>{lead.phone}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-wrap pl-10">
            {lead.lead_sources && (
              <Badge
                variant="outline"
                className="text-[9px] font-medium px-1.5 py-0 rounded h-4"
              >
                {lead.lead_sources.name}
              </Badge>
            )}
            {lead.lead_tags?.slice(0, 2).map(({ tags: tag }) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-[9px] font-medium px-1.5 py-0 rounded h-4"
                style={{ backgroundColor: tag.color + "15", color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {lead.lead_tags?.length > 2 && (
              <span className="text-[9px] text-muted-foreground font-medium">
                +{lead.lead_tags.length - 2}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
