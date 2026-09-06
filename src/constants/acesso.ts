export const EQUIPE_PADRAO = "instalacao-principal";

export const DOMINIOS_EMAIL_PESSOAL = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
]);

export function emailParecePessoal(email: string) {
  return DOMINIOS_EMAIL_PESSOAL.has(email.trim().toLowerCase().split("@")[1] || "");
}
