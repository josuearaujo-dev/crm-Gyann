// Timezone fixo para o sistema (São Francisco - Pacific Time)
export const APP_TIMEZONE = 'America/Los_Angeles';

/**
 * Interpreta data (YYYY-MM-DD) e hora (HH:mm) como horário civil em APP_TIMEZONE
 * e devolve o instante em UTC. Não depende do fuso do navegador do usuário.
 * Cobre PST/PDT corretamente para a data da reunião (não para "hoje").
 */
export function wallTimeInAppTimezoneToUtc(dateStr: string, timeStr: string): Date {
  const y = parseInt(dateStr.slice(0, 4), 10);
  const mo = parseInt(dateStr.slice(5, 7), 10);
  const d = parseInt(dateStr.slice(8, 10), 10);
  const [hs, msPart] = timeStr.trim().split(':');
  const h = parseInt(hs, 10);
  const mi = parseInt(msPart ?? '0', 10);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(d) ||
    !Number.isFinite(h) ||
    !Number.isFinite(mi) ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    h < 0 ||
    h > 23 ||
    mi < 0 ||
    mi > 59
  ) {
    throw new Error('Data ou horário inválido');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const wallKey = (utcMs: number) => {
    const parts = formatter.formatToParts(new Date(utcMs));
    const get = (type: Intl.DateTimeFormatPartTypes) => {
      const raw = parts.find((p) => p.type === type)?.value ?? '';
      if (type === 'hour' && raw === '24') return 0;
      return parseInt(raw, 10);
    };
    const yy = get('year');
    const MM = get('month');
    const dd = get('day');
    const hh = get('hour');
    const mm = get('minute');
    return yy * 1e8 + MM * 1e6 + dd * 1e4 + hh * 100 + mm;
  };

  const targetKey = y * 1e8 + mo * 1e6 + d * 1e4 + h * 100 + mi;
  const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const start = anchor - 36 * 3600000;

  for (let i = 0; i <= 72 * 60; i++) {
    const t = start + i * 60000;
    if (wallKey(t) === targetKey) {
      return new Date(t);
    }
  }

  throw new Error(
    'Este horário não existe no fuso do Pacífico (ex.: mudança para horário de verão). Escolha outro horário.'
  );
}

/**
 * Formata um valor numérico como moeda USD
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata uma data para exibição em inglês (en-US)
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, ...options }).format(dateObj);
}

/**
 * Converte uma data/hora local para UTC considerando o timezone da aplicação
 */
export function toUTC(dateString: string, timeString: string): Date {
  // Criar string no formato ISO com timezone
  const isoString = `${dateString}T${timeString}:00`;
  
  // Criar objeto Date interpretando como timezone de São Francisco
  const localDate = new Date(isoString);
  
  // Obter o offset do timezone de São Francisco para essa data específica
  const sfFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return localDate;
}

/**
 * Formata uma data UTC para exibição no timezone da aplicação
 */
export function formatInAppTimezone(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    ...options
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

/**
 * Retorna a data/hora atual no timezone da aplicação
 */
export function nowInAppTimezone(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
}

/**
 * Converte uma data UTC para string de data no formato YYYY-MM-DD no timezone da app
 */
export function toDateStringInAppTimezone(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return formatter.format(dateObj);
}

/**
 * Converte uma data UTC para string de hora no formato HH:MM no timezone da app
 */
export function toTimeStringInAppTimezone(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return formatter.format(dateObj);
}

/**
 * Regra de atraso: task só fica atrasada no DIA SEGUINTE ao dia agendado (fuso da aplicação).
 * Ex.: 2026-04-07 -> atrasada a partir de 2026-04-08.
 */
export function isOverdueNextDayInAppTimezone(
  taskDateLike: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!taskDateLike) return false;
  const taskDay = toDateStringInAppTimezone(taskDateLike);
  const nowDay = toDateStringInAppTimezone(now);
  return nowDay > taskDay;
}
