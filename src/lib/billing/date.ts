// yyyy-mm-dd (UTC-4 fijo, como usas en feedback)
export function todayUtcMinus4(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const d = new Date(utc - 4 * 60 * 60000);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month1to12: number): number {
  // month1to12: 1..12
  return new Date(year, month1to12, 0).getDate();
}

/**
 * Dado un preferredDay (ej. 31) y un (year, month),
 * devuelve el día que se debe facturar ese mes:
 *   - Si el mes tiene ≥ preferredDay ⇒ preferredDay
 *   - Si el mes tiene menos ⇒ último día del mes (28/29/30)
 */
export function billingDayForMonth(preferredDay: number, year: number, month1to12: number): number {
  const dim = daysInMonth(year, month1to12);
  return Math.min(preferredDay, dim);
}

/** ¿Hoy es el día de cobro del mes según MANAGEMENT_DATE? */
export function isBillingDayToday(managementDateIso: string, now = new Date()): boolean {
  // calcular "hoy" en UTC-4 para consistencia con tus flujos
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc - 4 * 60 * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1; // 1..12
  const preferred = Number(managementDateIso.split('-')[2]); // día del env
  const billDay = billingDayForMonth(preferred, y, m);
  return local.getUTCDate() === billDay;
}

/** último yyyy-mm-dd del mes en UTC-4 para un preferredDay que no existe */
export function effectiveBillingDateForMonth(managementDateIso: string, year: number, month1to12: number): string {
  const preferred = Number(managementDateIso.split('-')[2]);
  const day = billingDayForMonth(preferred, year, month1to12);
  const utc = Date.UTC(year, month1to12 - 1, day, 4, 0, 0); // 04:00Z ~ medianoche UTC-4
  return new Date(utc).toISOString().slice(0, 10);
}
