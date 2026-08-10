/**
 * Identidade visual do projeto (mockada de propósito).
 *
 * Este repositório é um template duplicado para cada especialista. Nada de nome
 * ou foto de ninguém no código: o nome vem da env `NEXT_PUBLIC_BRAND_NAME` e o
 * avatar é gerado a partir das iniciais. Se quiser uma imagem, aponte
 * `NEXT_PUBLIC_BRAND_LOGO` para um arquivo em /public ou uma URL.
 */

const FALLBACK_NAME = "Seu Projeto";

export const BRAND_NAME: string =
  process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || FALLBACK_NAME;

export const BRAND_LOGO: string | null =
  process.env.NEXT_PUBLIC_BRAND_LOGO?.trim() || null;

/** Iniciais do nome (no máximo 2 letras) para o avatar gerado. */
export function brandInitials(name: string = BRAND_NAME): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
