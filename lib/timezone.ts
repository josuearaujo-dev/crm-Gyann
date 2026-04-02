// Timezone fixo para o sistema (São Francisco - Pacific Time)
export const APP_TIMEZONE = 'America/Los_Angeles';

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
