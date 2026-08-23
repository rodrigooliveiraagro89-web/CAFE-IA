/**
 * Normalização de telefone BR para E.164 (só dígitos, com 55 + DDD). Usado no
 * opt-in de WhatsApp. Ex.: "(35) 99999-8888" -> "5535999998888".
 */
export function normalizeBrPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos. */
export function validBrPhone(e164: string): boolean {
  return /^55\d{10,11}$/.test(e164);
}
