"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProductFilter({
  current,
  products,
}: {
  current: string;
  products: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") params.delete("product");
    else params.set("product", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={set}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Todos os produtos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os produtos</SelectItem>
        {products.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
