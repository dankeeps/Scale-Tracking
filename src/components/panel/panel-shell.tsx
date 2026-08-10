"use client";

import { FlaskConical, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/(panel)/actions";
import { SidebarNav } from "@/components/panel/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BRAND_LOGO, BRAND_NAME, brandInitials } from "@/lib/branding";

/**
 * Marca do painel. Nome vem de `NEXT_PUBLIC_BRAND_NAME`; sem logo configurada,
 * desenhamos as iniciais — nenhuma foto embutida no repositório.
 */
function Brand() {
  return (
    <div className="flex items-center gap-2">
      {BRAND_LOGO ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={BRAND_LOGO}
          alt={BRAND_NAME}
          className="size-8 rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-md bg-primary/15 font-mono text-xs font-semibold text-primary"
        >
          {brandInitials()}
        </span>
      )}
      <span className="truncate font-semibold tracking-tight">{BRAND_NAME}</span>
    </div>
  );
}

/** Aviso fixo de que os números na tela são fictícios. */
function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-accent-amber/30 bg-accent-amber/10 px-4 py-2 text-center text-xs text-accent-amber">
      <FlaskConical className="size-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">Modo demonstração</strong> — dados
        fictícios, sem login. Conecte o Supabase para valer.
      </span>
      <Link
        href="/dashboard/instrucoes"
        className="font-semibold underline underline-offset-2"
      >
        Ver o passo a passo
      </Link>
    </div>
  );
}

function SignOutButton({ full }: { full?: boolean }) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant={full ? "outline" : "ghost"}
        size={full ? "default" : "icon"}
        className={full ? "w-full justify-start gap-3" : undefined}
        aria-label="Sair"
      >
        <LogOut className="size-4" />
        {full ? "Sair" : null}
      </Button>
    </form>
  );
}

/** Estrutura do painel: sidebar fixa no desktop, drawer no mobile, header comum. */
export function PanelShell({
  email,
  demo = false,
  children,
}: {
  email: string | null;
  /** Painel aberto sem sessão, com dados fictícios. */
  demo?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // md:pl-64 reserva o espaço da sidebar, que é fixed (fora do fluxo).
  return (
    <div className="flex min-h-svh md:pl-64">
      {/* Sidebar desktop: fixed na viewport — imune à rolagem da página. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-border/70 bg-card/40 p-4 md:flex">
        <div className="px-1 py-2">
          <Brand />
        </div>
        <div className="mt-4 flex-1">
          <SidebarNav />
        </div>
        <div className="mt-auto space-y-3 border-t border-border/70 pt-3">
          {email ? (
            <p className="truncate px-1 text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          ) : null}
          {demo ? (
            <p className="px-1 text-xs text-muted-foreground">
              Sessão desativada na demonstração.
            </p>
          ) : (
            <SignOutButton full />
          )}
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {demo ? <DemoBanner /> : null}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/70 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            {/* Menu mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetTitle className="sr-only">Navegação</SheetTitle>
                <div className="px-1 pb-2">
                  <Brand />
                </div>
                <div className="mt-2 flex-1">
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </div>
                {email ? (
                  <p className="truncate px-1 pt-2 text-xs text-muted-foreground">
                    {email}
                  </p>
                ) : null}
                {demo ? null : (
                  <div className="pt-2">
                    <SignOutButton full />
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <div className="md:hidden">
              <Brand />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            {demo ? null : (
              <div className="hidden md:block">
                <SignOutButton />
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
