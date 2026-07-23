import type { Lead, PipelineColumn } from "@/lib/types";
import { getWonPipelineColumn } from "@/lib/pipeline-utils";

export type LeadClosureStatus = "open" | "won" | "lost" | "finished";

export interface LeadTimelineInfo {
  status: LeadClosureStatus;
  statusLabel: string;
  createdAt: Date | null;
  closedAt: Date | null;
  /** Alias legível para UI (ISO string). */
  addedAt: string;
  daysInPipeline: number | null;
  /** Alias usado pela UI atual. */
  daysUntilClose: number;
}

type LeadTimelineInput = Pick<
  Lead,
  "created_at" | "updated_at" | "column_id" | "is_lost" | "is_finished" | "finished_at"
> & {
  lost_at?: string | null;
  won_at?: string | null;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function differenceInCalendarDaysSafe(end: Date, start: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function getLeadTimelineInfo(
  lead: LeadTimelineInput,
  columns: PipelineColumn[],
): LeadTimelineInfo {
  const createdAt = parseDate(lead.created_at);

  if (!createdAt) {
    return {
      status: "open",
      statusLabel: "Em aberto",
      createdAt: null,
      closedAt: null,
      addedAt: lead.created_at,
      daysInPipeline: null,
      daysUntilClose: 0,
    };
  }

  let status: LeadClosureStatus = "open";
  let statusLabel = "Em aberto";
  let closedAt: Date | null = null;

  if (lead.is_lost || lead.lost_at) {
    status = "lost";
    statusLabel = "Perdido";
    closedAt = parseDate(lead.lost_at);
  } else if (lead.is_finished || lead.finished_at) {
    status = "finished";
    statusLabel = "Finalizado";
    closedAt = parseDate(lead.finished_at);
  } else {
    const wonColumn = getWonPipelineColumn(columns);
    const isWon = Boolean(wonColumn) && lead.column_id === wonColumn?.id;

    if (isWon) {
      status = "won";
      statusLabel = "Ganho";
      // Preferir won_at; updated_at é provisório se won_at ainda não existir
      closedAt = parseDate(lead.won_at) || parseDate(lead.updated_at);
    }
  }

  const endDate = closedAt ?? new Date();
  const days = differenceInCalendarDaysSafe(endDate, createdAt);

  return {
    status,
    statusLabel,
    createdAt,
    closedAt,
    addedAt: lead.created_at,
    daysInPipeline: days,
    daysUntilClose: days,
  };
}

export function formatLeadDaysLabel(timeline: LeadTimelineInfo): string {
  if (timeline.daysInPipeline === null) {
    return "Tempo indisponível";
  }

  const days = timeline.daysInPipeline;
  const unit = days === 1 ? "dia" : "dias";

  if (timeline.status === "open") {
    if (days === 0) return "Em aberto há menos de 1 dia";
    return `Em aberto há ${days} ${unit}`;
  }

  if (days === 0) return "Fechado no mesmo dia";
  return `${days} ${unit} até o fechamento`;
}

export function getClosureStatusLabel(status: LeadClosureStatus): string {
  switch (status) {
    case "won":
      return "Ganho";
    case "lost":
      return "Perdido";
    case "finished":
      return "Finalizado";
    default:
      return "Em aberto";
  }
}
