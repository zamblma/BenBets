const memoryCache: Record<string, string> = {};
const inflightMap = new Map<string, Promise<Record<string, string>>>();

const STORAGE_PREFIX = 'benbets_wiki_thumbs_v1_';

function readStorage(key: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: Record<string, string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Fetches thumbnails in batches (<= 50 titles per request) from the free
 * MediaWiki API with CORS (`origin=*`), resolving normalized & redirected titles
 * back to each requested title key.
 */
export async function fetchWikiThumbnails(
  titles: string[],
  thumbSize = 450,
  cacheKey?: string
): Promise<Record<string, string>> {
  const uniqueTitles = Array.from(new Set(titles.map((t) => t.trim()).filter(Boolean)));
  if (uniqueTitles.length === 0) return {};

  const result: Record<string, string> = {};

  if (cacheKey) {
    const cached = readStorage(STORAGE_PREFIX + cacheKey);
    if (cached) {
      Object.assign(memoryCache, cached);
    }
  }

  const missing: string[] = [];
  for (const title of uniqueTitles) {
    const memKey = `${thumbSize}:${title}`;
    if (memoryCache[memKey]) {
      result[title] = memoryCache[memKey];
    } else if (cacheKey) {
      const cached = readStorage(STORAGE_PREFIX + cacheKey);
      if (cached && cached[title]) {
        memoryCache[memKey] = cached[title];
        result[title] = cached[title];
      } else {
        missing.push(title);
      }
    } else {
      missing.push(title);
    }
  }

  if (missing.length === 0) return result;

  const dedupeKey = `${thumbSize}:${cacheKey || ''}:${missing.join('|')}`;
  const existingPromise = inflightMap.get(dedupeKey);
  if (existingPromise) {
    const fetched = await existingPromise;
    return { ...result, ...fetched };
  }

  const promise = (async () => {
    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += 50) {
      batches.push(missing.slice(i, i + 50));
    }

    const fetchedAll: Record<string, string> = {};

    await Promise.all(
      batches.map(async (batch) => {
        try {
          const joined = batch.join('|');
          const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            joined
          )}&prop=pageimages&piprop=thumbnail&pithumbsize=${thumbSize}&redirects=1&format=json&origin=*`;
          const res = await fetch(url);
          if (!res.ok) return;
          const data = await res.json();
          const query = data?.query;
          if (!query?.pages) return;

          // Build reverse chain: canonical title -> Set of requested titles
          const normalizedMap = new Map<string, string>();
          if (Array.isArray(query.normalized)) {
            for (const n of query.normalized) {
              if (n.from && n.to) normalizedMap.set(n.from, n.to);
            }
          }

          const redirectMap = new Map<string, string>();
          if (Array.isArray(query.redirects)) {
            for (const r of query.redirects) {
              if (r.from && r.to) redirectMap.set(r.from, r.to);
            }
          }

          const pageImageByTitle = new Map<string, string>();
          for (const page of Object.values(query.pages) as any[]) {
            if (page?.title && page?.thumbnail?.source) {
              pageImageByTitle.set(page.title, page.thumbnail.source);
            }
          }

          for (const original of batch) {
            const spaced = original.replace(/_/g, ' ');
            const afterNorm = normalizedMap.get(original) || normalizedMap.get(spaced) || spaced;
            let resolved = afterNorm;
            for (let hops = 0; hops < 4; hops++) {
              const next = redirectMap.get(resolved);
              if (!next) break;
              resolved = next;
            }
            const thumb =
              pageImageByTitle.get(resolved) ||
              pageImageByTitle.get(afterNorm) ||
              pageImageByTitle.get(spaced) ||
              pageImageByTitle.get(original);

            if (thumb) {
              fetchedAll[original] = thumb;
              memoryCache[`${thumbSize}:${original}`] = thumb;
            }
          }
        } catch {
          // Gracefully ignore network/CORS errors on individual batches
        }
      })
    );

    if (cacheKey && Object.keys(fetchedAll).length > 0) {
      const existing = readStorage(STORAGE_PREFIX + cacheKey) || {};
      writeStorage(STORAGE_PREFIX + cacheKey, { ...existing, ...fetchedAll });
    }

    return fetchedAll;
  })();

  inflightMap.set(dedupeKey, promise);
  try {
    const fetched = await promise;
    return { ...result, ...fetched };
  } finally {
    inflightMap.delete(dedupeKey);
  }
}
