import "server-only";
import { createHash } from "node:crypto";

// Hashing SHA-256 dos dados pessoais para a Meta CAPI (normalização conforme a
// doc de "customer information parameters"). NÃO hashear fbp/fbc/ip/user_agent.

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
/** Só dígitos (mantém o código do país; sem '+', espaços ou símbolos). */
export const normalizePhone = (v: string) => v.replace(/\D/g, "");
export const normalizeName = (v: string) => v.trim().toLowerCase();
/** Estado/país: minúsculo, sem espaços (ex.: "SP" -> "sp"). */
export const normalizeRegion = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, "");
/**
 * Cidade (Meta ct): minúsculo, sem acentos/espaços/pontuação (ex.: "São Paulo"
 * -> "saopaulo"). O NFD decompõe o acento e o filtro [^a-z0-9] o remove junto.
 */
export const normalizeCity = (v: string) =>
  v
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Aplica o normalizador e retorna o hash, ou null se vazio. */
export function hashOrNull(
  value: string | null | undefined,
  normalizer: (v: string) => string = (v) => v.trim().toLowerCase(),
): string | null {
  if (!value) return null;
  const norm = normalizer(value);
  if (!norm) return null;
  return sha256(norm);
}
