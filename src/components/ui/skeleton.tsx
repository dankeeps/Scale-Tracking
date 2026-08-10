import { cn } from "@/lib/utils";

/** Bloco cinza pulsante que ocupa o lugar do conteúdo enquanto ele carrega. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

export { Skeleton };
