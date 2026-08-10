// Extração de IP real, user agent e geo a partir dos headers da request.
// Geo vem dos headers da Vercel (x-vercel-ip-*); no dev local fica vazio.

export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? null;
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}

export interface Geo {
  country: string | null;
  region: string | null;
  city: string | null;
}

export function getGeo(headers: Headers): Geo {
  const city = headers.get("x-vercel-ip-city");
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    // A Vercel envia a cidade URL-encoded (ex.: "S%C3%A3o%20Paulo").
    city: city ? safeDecode(city) : null,
  };
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
