"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toaster global (sonner), sincronizado com o tema atual. */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "dark"}
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "glass rounded-md",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
