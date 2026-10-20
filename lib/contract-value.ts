import type { Lead } from "@/lib/types";

export type ContractType = "mrr" | "tcv";

/** TCV = valor cheio do contrato (deal_value). */
export function getLeadTcv(lead: Pick<Lead, "deal_value">): number {
  return Math.max(Number(lead.deal_value || 0), 0);
}

/** MRR = valor mensal; deriva de mrr_value ou TCV ÷ meses. */
export function getLeadMrr(
  lead: Pick<Lead, "deal_value" | "mrr_value" | "contract_months">
): number {
  const stored = Number(lead.mrr_value || 0);
  if (stored > 0) return stored;
  const months = Number(lead.contract_months || 0);
  const tcv = getLeadTcv(lead);
  if (months > 0 && tcv > 0) return tcv / months;
  return 0;
}

export function computeTcvFromMrr(mrr: number, months: number): number {
  if (!(mrr > 0) || !(months > 0)) return 0;
  return Math.round(mrr * months * 100) / 100;
}

export function computeMrrFromTcv(tcv: number, months: number): number {
  if (!(tcv > 0) || !(months > 0)) return 0;
  return Math.round((tcv / months) * 100) / 100;
}

export function summarizeContracts(
  salesLeads: Array<Pick<Lead, "deal_value" | "mrr_value" | "contract_months" | "contract_type">>
): {
  contractsSold: number;
  totalMrr: number;
  totalTcv: number;
  avgMrrTicket: number;
  avgTcvTicket: number;
  mrrContracts: number;
  tcvContracts: number;
} {
  const contractsSold = salesLeads.length;
  let totalMrr = 0;
  let totalTcv = 0;
  let mrrContracts = 0;
  let tcvContracts = 0;

  for (const lead of salesLeads) {
    const tcv = getLeadTcv(lead);
    const mrr = getLeadMrr(lead);
    totalTcv += tcv;
    totalMrr += mrr;
    if (lead.contract_type === "mrr") mrrContracts += 1;
    else if (lead.contract_type === "tcv") tcvContracts += 1;
  }

  return {
    contractsSold,
    totalMrr,
    totalTcv,
    avgMrrTicket: contractsSold > 0 ? totalMrr / contractsSold : 0,
    avgTcvTicket: contractsSold > 0 ? totalTcv / contractsSold : 0,
    mrrContracts,
    tcvContracts,
  };
}
