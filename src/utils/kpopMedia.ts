const COMMONS_STORAGE_KEY = 'benbets_kpop_commons_v2';
const REJECT_TITLE_RE = /logo|wordmark|signature|autograph|lightstick|diagram|map|flag|icon/i;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const memoryGalleries: Record<string, string[]> = {};
const inflightCommons = new Map<string, Promise<string[]>>();
let storageHydrated = false;

function hydrateFromStorage() {
  if (storageHydrated) return;
  storageHydrated = true;
  try {
    const raw = localStorage.getItem(COMMONS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v) && v.every((u) => typeof u === 'string' && u.startsWith('https://'))) {
          memoryGalleries[k] = v.slice(0, 5);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
}

function persistStorage() {
  try {
    localStorage.setItem(COMMONS_STORAGE_KEY, JSON.stringify(memoryGalleries));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedCommonsGalleries(): Record<string, string[]> {
  hydrateFromStorage();
  return { ...memoryGalleries };
}

/**
 * Busca até 5 fotos verticais de alta qualidade de um(a) idol no Wikimedia Commons
 * (CORS nativo com origin=*, gratuito e sem API key).
 */
export async function fetchCommonsIdolGallery(idolId: string, commonsQuery: string): Promise<string[]> {
  hydrateFromStorage();
  if (!idolId || !commonsQuery) return [];
  if (memoryGalleries[idolId] && memoryGalleries[idolId].length > 0) {
    return memoryGalleries[idolId];
  }

  const existing = inflightCommons.get(idolId);
  if (existing) return existing;

  const promise = (async (): Promise<string[]> => {
    try {
      const endpoint =
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
        `&gsrsearch=${encodeURIComponent(`${commonsQuery} filetype:bitmap`)}` +
        `&gsrlimit=12&prop=imageinfo&iiprop=url|dimensions|mime&iiurlwidth=600&format=json&origin=*`;

      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages || typeof pages !== 'object') return [];

      const candidates: { url: string; score: number }[] = [];
      const seen = new Set<string>();

      for (const page of Object.values(pages) as any[]) {
        const title = String(page?.title || '');
        if (!title || REJECT_TITLE_RE.test(title)) continue;

        const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
        if (!info) continue;

        const mime = String(info.mime || '').toLowerCase();
        if (!ALLOWED_MIMES.has(mime)) continue;

        const width = Number(info.width || 0);
        const height = Number(info.height || 0);
        if (width < 250 || height < 300) continue;

        const rawUrl = String(info.thumburl || info.url || '');
        if (!rawUrl.startsWith('https://') || seen.has(rawUrl)) continue;
        seen.add(rawUrl);

        // Priorizar retratos verticais ideais para photocards 2:3 / 3:4
        let score = 0;
        const ratio = height / width;
        if (ratio >= 1.15) score += 100;
        else if (ratio >= 1.0) score += 70;
        else if (width <= height * 1.4) score += 25;
        else score -= 40; // muito horizontal

        // Pequeno bônus para resoluções melhores
        score += Math.min(20, Math.round(height / 200));

        candidates.push({ url: rawUrl, score });
      }

      if (candidates.length === 0) return [];

      candidates.sort((a, b) => b.score - a.score);
      const hasVertical = candidates.some((c) => c.score >= 70);
      const filtered = hasVertical ? candidates.filter((c) => c.score > 0) : candidates;
      const urls = filtered.slice(0, 5).map((c) => c.url);

      if (urls.length > 0) {
        memoryGalleries[idolId] = urls;
        persistStorage();
      }
      return urls;
    } catch {
      return [];
    } finally {
      inflightCommons.delete(idolId);
    }
  })();

  inflightCommons.set(idolId, promise);
  return promise;
}

/**
 * Pré-carrega em paralelo as galerias do Wikimedia Commons para uma lista de idols,
 * respeitando um timeout máximo para não travar a revelação dos cards.
 */
export async function preloadIdolGalleries(
  idols: { id: string; commonsQuery: string }[],
  timeoutMs = 950
): Promise<Record<string, string[]>> {
  hydrateFromStorage();
  const unique = Array.from(new Map(idols.map((i) => [i.id, i])).values());
  const out: Record<string, string[]> = {};
  if (unique.length === 0) return out;

  const missing: { id: string; commonsQuery: string }[] = [];
  for (const idol of unique) {
    if (memoryGalleries[idol.id]?.length) {
      out[idol.id] = memoryGalleries[idol.id];
    } else {
      missing.push(idol);
    }
  }

  if (missing.length === 0) return out;

  const work = Promise.all(
    missing.map(async (idol) => {
      const urls = await fetchCommonsIdolGallery(idol.id, idol.commonsQuery);
      if (urls.length > 0) out[idol.id] = urls;
    })
  );

  await Promise.race([
    work,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  // Coletar quaisquer entradas já concluídas no cache
  for (const idol of unique) {
    if (!out[idol.id] && memoryGalleries[idol.id]?.length) {
      out[idol.id] = memoryGalleries[idol.id];
    }
  }
  return out;
}
