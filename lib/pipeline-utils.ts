import type { Meeting, PipelineColumn } from "@/lib/types";

/** Coluna de vitória no funil (ex.: "Venda Feita", "Fechado Ganho"). */
export function getWonPipelineColumn(columns: PipelineColumn[]): PipelineColumn | undefined {
  return columns.find((c) => {
    const n = c.name.toLowerCase().trim();
    if (n.includes("perdido") || n.includes("lost") || n.includes("cancelad")) return false;
    if (n.includes("ganho")) return true;
    if (n.includes("venda feita")) return true;
    if (n.includes("closed won")) return true;
    if (n.includes("won") && !n.includes("lost")) return true;
    return false;
  });
}

/** Coluna "Tentando Contato" (ou similar). */
export function getContactAttemptColumn(columns: PipelineColumn[]): PipelineColumn | undefined {
  return columns.find((c) => {
    const n = c.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return n.includes("tentando contato") || n.includes("tentativa de contato") || n === "contato";
  });
}

/** Coluna "Qualificação" (etapa do funil, não a tag). */
export function getQualificationStageColumn(columns: PipelineColumn[]): PipelineColumn | undefined {
  return columns.find((c) => {
    const n = c.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (n.includes("nao qualif") || n.includes("desqualif")) return false;
    return n.includes("qualific");
  });
}

/** Lead criado ou atualizado dentro do intervalo (útil para fechamentos no período). */
export function leadTouchesPeriod(lead: { created_at: string; updated_at: string }, start: Date, end: Date): boolean {
  const created = new Date(lead.created_at);
  const updated = new Date(lead.updated_at);
  return (created >= start && created <= end) || (updated >= start && updated <= end);
}

/**
 * Reunião associada ao período: data/hora agendada OU momento em que foi cadastrada no CRM.
 * Ignora canceladas. Cobre o caso comum de lead na campanha com reunião marcada para depois do fim da campanha.
 */
export function meetingTouchesPeriod(
  meeting: Pick<Meeting, "scheduled_at" | "created_at" | "status">,
  start: Date,
  end: Date
): boolean {
  if (meeting.status === "cancelled") return false;
  const sched = new Date(meeting.scheduled_at);
  const created = new Date(meeting.created_at);
  return (
    (sched >= start && sched <= end) ||
    (created >= start && created <= end)
  );
}
