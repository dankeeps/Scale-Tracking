import {
  BookOpen,
  FileText,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Itens de navegação do painel. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/dashboard/vendas", label: "Vendas", icon: Wallet },
  { href: "/dashboard/paginas", label: "Páginas", icon: FileText },
  { href: "/dashboard/eventos", label: "Eventos", icon: ListChecks },
  { href: "/dashboard/config", label: "Configurações", icon: Settings },
  { href: "/dashboard/instrucoes", label: "Instruções", icon: BookOpen },
];
