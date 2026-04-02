import type { Lead, LeadInstallment } from "@/lib/types";

export function indexInstallmentsByLeadId(rows: LeadInstallment[]): Map<string, LeadInstallment[]> {
  const m = new Map<string, LeadInstallment[]>();
  for (const r of rows) {
    const list = m.get(r.lead_id) ?? [];
    list.push(r);
    m.set(r.lead_id, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.due_date.localeCompare(b.due_date));
  }
  return m;
}

function legacyReceived(lead: Lead): number {
  const total = Number(lead.deal_value || 0);
  const model = lead.payment_model;
  if (!model || model === "full") return total;
  return Math.min(Math.max(Number(lead.amount_received || 0), 0), total);
}

function sumPaidInstallments(leadId: string, byLead: Map<string, LeadInstallment[]>): number {
  const rows = byLead.get(leadId) ?? [];
  return rows.filter((r) => r.paid_at).reduce((s, r) => s + Number(r.amount), 0);
}

/** Caixa e saldo da coorte: por lead usa soma de parcelas pagas se existir grade; senão campos legados. */
export function cohortCashAndOutstanding(
  salesLeads: Lead[],
  byLead: Map<string, LeadInstallment[]>
): { totalReceived: number; totalOutstanding: number; revenue: number } {
  let totalReceived = 0;
  const revenue = salesLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);
  for (const l of salesLeads) {
    const rows = byLead.get(l.id) ?? [];
    if (rows.length > 0) {
      totalReceived += sumPaidInstallments(l.id, byLead);
    } else {
      totalReceived += legacyReceived(l);
    }
  }
  return {
    totalReceived,
    totalOutstanding: Math.max(revenue - totalReceived, 0),
    revenue,
  };
}

export function countSalesWithInstallmentSchedule(
  salesLeads: Lead[],
  byLead: Map<string, LeadInstallment[]>
): number {
  return salesLeads.filter((l) => (byLead.get(l.id)?.length ?? 0) > 0).length;
}

/**
 * Métricas de fluxo na janela [periodStart, periodEnd] (datas ISO YYYY-MM-DD, inclusive).
 * Só considera parcelas de vendas da coorte; vendas sem grade não entram aqui.
 */
export function periodInstallmentMetrics(
  salesLeads: Lead[],
  byLead: Map<string, LeadInstallment[]>,
  periodStart: string,
  periodEnd: string
): { cashInPeriod: number; expectedInPeriod: number; openInPeriod: number } {
  const pStartMs = new Date(`${periodStart}T00:00:00`).getTime();
  const pEndMs = new Date(`${periodEnd}T23:59:59.999`).getTime();

  let cashInPeriod = 0;
  let expectedInPeriod = 0;
  let openInPeriod = 0;

  for (const lead of salesLeads) {
    const rows = byLead.get(lead.id) ?? [];
    if (rows.length === 0) continue;

    for (const r of rows) {
      const due = r.due_date;
      const dueInPeriod = due >= periodStart && due <= periodEnd;
      if (dueInPeriod) {
        expectedInPeriod += Number(r.amount);
        if (!r.paid_at) {
          openInPeriod += Number(r.amount);
        }
      }
      if (r.paid_at) {
        const paidMs = new Date(r.paid_at).getTime();
        if (paidMs >= pStartMs && paidMs <= pEndMs) {
          cashInPeriod += Number(r.amount);
        }
      }
    }
  }

  return { cashInPeriod, expectedInPeriod, openInPeriod };
}
