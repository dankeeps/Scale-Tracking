"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RangeKey } from "@/lib/dashboard/range";

const ALL = "__all__";

export function EventsFilters({
  current,
  eventName,
  types,
}: {
  current: RangeKey;
  eventName: string | null;
  types: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setEvent(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) params.delete("event");
    else params.set("event", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={eventName ?? ALL} onValueChange={setEvent}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Todos os eventos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os eventos</SelectItem>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PeriodSelector current={current} />
    </div>
  );
}
