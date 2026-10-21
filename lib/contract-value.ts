import type { Lead } from "@/lib/types";

export type ContractType = "mrr" | "tcv";

type ContractLead = Pick<
  Lead,
  "deal_value" | "mrr_value" | "contract_months" | "contract_type"
>;

/** Valor cheio do contrato (deal_value). */
export function getLeadContractTotal(lead: Pick<Lead, "deal_value">): number {
  return Math.max(Number(lead.deal_value || 0), 0);
}

/** @deprecated use getLeadContractTotal — TCV de tipo à vista é outra métrica. */
export function getLeadTcv(lead: Pick<Lead, "deal_value">): number {
  return getLeadContractTotal(lead);
}

/**
 * MRR mensal só para contratos do tipo MRR (pagamento mensal).
 * Não deriva MRR a partir de vendas TCV (à vista).
 */
export function getLeadMrr(lead: ContractLead): number {
  if (lead.contract_type !== "mrr") return 0;
  const stored = Number(lead.mrr_value || 0);
  if (stored > 0) return stored;
  const months = Number(lead.contract_months || 0);
  const total = getLeadContractTotal(lead);
  if (months > 0 && total > 0) return total / months;
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

/** Tipo efetivo: legado sem tipo e com valor → trata como TCV (à vista). */
export function getEffectiveContractType(lead: ContractLead): ContractType | null {
  if (lead.contract_type === "mrr" || lead.contract_type === "tcv") {
    return lead.contract_type;
  }
  if (getLeadContractTotal(lead) > 0) return "tcv";
  return null;
}

/**
 * Relatório separado:
 * - TCV = contratos à vista (paga tudo de uma vez)
 * - MRR = contratos mensais (mensalidade; total = mensal × meses)
 */
export function summarizeContracts(salesLeads: ContractLead[]): {
  contractsSold: number;
  mrrContracts: number;
  tcvContracts: number;
  /** Soma das mensalidades (só MRR). */
  totalMrr: number;
  /** Soma dos valores à vista (só TCV). */
  totalTcv: number;
  /** Soma do valor total dos contratos MRR (mensal × meses). */
  totalMrrContractValue: number;
  /** Ticket médio da mensalidade (só contratos MRR). */
  avgMrrTicket: number;
  /** Ticket médio do valor à vista (só contratos TCV). */
  avgTcvTicket: number;
  untypedContracts: number;
} {
  let mrrContracts = 0;
  let tcvContracts = 0;
  let untypedContracts = 0;
  let totalMrr = 0;
  let totalTcv = 0;
  let totalMrrContractValue = 0;

  for (const lead of salesLeads) {
    const typed = lead.contract_type === "mrr" || lead.contract_type === "tcv";
    const effective = getEffectiveContractType(lead);
    const total = getLeadContractTotal(lead);

    if (!typed && total > 0) untypedContracts += 1;

    if (effective === "mrr") {
      mrrContracts += 1;
      const mrr = getLeadMrr({ ...lead, contract_type: "mrr" });
      totalMrr += mrr;
      totalMrrContractValue += total > 0 ? total : computeTcvFromMrr(mrr, Number(lead.contract_months || 0));
    } else if (effective === "tcv") {
      tcvContracts += 1;
      totalTcv += total;
    }
  }

  return {
    contractsSold: salesLeads.length,
    mrrContracts,
    tcvContracts,
    totalMrr,
    totalTcv,
    totalMrrContractValue,
    avgMrrTicket: mrrContracts > 0 ? totalMrr / mrrContracts : 0,
    avgTcvTicket: tcvContracts > 0 ? totalTcv / tcvContracts : 0,
    untypedContracts,
  };
}
