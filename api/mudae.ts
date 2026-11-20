// Vercel Serverless Proxy com Edge Cache gratuito (24h) para AniList + Jikan

interface ProxyReq {
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}

interface ProxyRes {
  status: (code: number) => ProxyRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

interface NormalizedSeed {
  id: string;
  name: string;
  series: string;
  image: string;
  gender: 'Female' | 'Male' | 'Other';
  favourites: number;
  role?: string;
  globalRank?: number;
}

const MUDAE_LEGACY_POOL_TOTAL = 129_254;

function hashGender(seedKey: string): 'Female' | 'Male' | 'Other' {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const mod = (h >>> 0) % 100;
  if (mod < 48) return 'Female';
  if (mod < 96) return 'Male';
  return 'Other';
}

function normalizeGender(raw: unknown, idHint?: string | number, nameHint?: string): 'Female' | 'Male' | 'Other' {
  if (typeof raw === 'string') {
    const g = raw.trim().toLowerCase();
    if (g === 'female') return 'Female';
    if (g === 'male') return 'Male';
    if (g === 'non-binary' || g === 'other') return 'Other';
  }
  return hashGender(`${idHint ?? ''}:${nameHint ?? ''}`);
}

function isUsablePortrait(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('http')) return false;
  const low = url.toLowerCase();
  return !low.includes('default.jpg') && !low.includes('questionmark') && !low.includes('placeholder');
}

function mapAniListChar(ch: any, globalRank?: number): NormalizedSeed | null {
  if (!ch?.id) return null;
  const img = ch.image?.large || '';
  const node = ch.media?.nodes?.[0] || ch.media?.edges?.[0]?.node;
  const series = node?.title?.english || node?.title?.romaji || 'Anime';
  return {
    id: `anilist_${ch.id}`,
    name: ch.name?.full || 'Personagem',
    series,
    image: isUsablePortrait(img) ? img : '',
    gender: normalizeGender(ch.gender, ch.id, ch.name?.full),
    favourites: typeof ch.favourites === 'number' && Number.isFinite(ch.favourites) ? ch.favourites : 400,
    role: 'Main',
    ...(typeof globalRank === 'number' ? { globalRank } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: ProxyReq, res: ProxyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  const rawPages = req.query?.pages;
  const rawIds = req.query?.ids;
  const rawSearch = req.query?.q;

  const pagesStr = Array.isArray(rawPages) ? rawPages[0] : rawPages || '';
  const idsStr = Array.isArray(rawIds) ? rawIds[0] : rawIds || '';
  const searchStr = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch || '').trim();

  try {
    if (idsStr) {
      const ids = idsStr
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 50);

      if (ids.length === 0) {
        return res.status(400).json({ error: 'Invalid ids' });
      }

      const query = `
        query ($ids: [Int]) {
          Page(page: 1, perPage: 50) {
            characters(id_in: $ids) {
              id
              name { full }
              gender
              favourites
              image { large }
              media(perPage: 1) { nodes { title { romaji english } } }
            }
          }
        }
      `;
      const apiRes = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables: { ids } }),
        },
        4500
      );
      if (!apiRes.ok) throw new Error(`AniList HTTP ${apiRes.status}`);
      const json = await apiRes.json();
      const seeds = (json?.data?.Page?.characters || [])
        .map((ch: any) => mapAniListChar(ch))
        .filter((x: NormalizedSeed | null): x is NormalizedSeed => Boolean(x));

      return res.status(200).json({ source: 'anilist', seeds });
    }

    if (searchStr) {
      const query = `
        query ($search: String) {
          Page(page: 1, perPage: 25) {
            characters(search: $search, sort: [FAVOURITES_DESC]) {
              id
              name { full }
              gender
              favourites
              image { large }
              media(perPage: 1) { nodes { title { romaji english } } }
            }
          }
        }
      `;
      const apiRes = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables: { search: searchStr } }),
        },
        4500
      );
      if (!apiRes.ok) throw new Error(`AniList HTTP ${apiRes.status}`);
      const json = await apiRes.json();
      const seeds = (json?.data?.Page?.characters || [])
        .map((ch: any) => mapAniListChar(ch))
        .filter((x: NormalizedSeed | null): x is NormalizedSeed => Boolean(x));
      return res.status(200).json({ source: 'anilist', seeds });
    }

    const pages = (pagesStr || '1,120')
      .split(',')
      .map((n) => Math.max(1, Math.min(2585, Number(n.trim()) || 1)))
      .slice(0, 3);

    const fields = pages.map((p, i) => {
      const sortMode = p <= 100 ? 'FAVOURITES_DESC' : p % 2 === 0 ? 'ID_DESC' : 'ID';
      const mappedPage = p <= 100 ? p : (((p - 101) * 13 + Math.floor(p / 100) * 7) % 100) + 1;
      return `
        p${i}: Page(page: ${mappedPage}, perPage: 50) {
          characters(sort: [${sortMode}]) {
            id
            name { full }
            gender
            favourites
            image { large }
            media(perPage: 1) { nodes { title { romaji english } } }
          }
        }
      `;
    });

    const apiRes = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: `query { ${fields.join('\n')} }` }),
      },
      4500
    );

    if (apiRes.ok) {
      const json = await apiRes.json();
      const data = json?.data || {};
      const seeds: NormalizedSeed[] = [];
      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i];
        const list = data[`p${i}`]?.characters || [];
        list.forEach((ch: any, idx: number) => {
          const rank = Math.min(MUDAE_LEGACY_POOL_TOTAL, (pageNum - 1) * 50 + idx + 1);
          const mapped = mapAniListChar(ch, rank);
          if (mapped && mapped.image) seeds.push(mapped);
        });
      }
      if (seeds.length > 0) {
        return res.status(200).json({ source: 'anilist', seeds });
      }
    }

    // Fallback para Jikan (MyAnimeList) se AniList limitar no edge
    const jikanSeeds: NormalizedSeed[] = [];
    for (const p of pages.slice(0, 2)) {
      const fastPage = ((p - 1) % 100) + 1;
      const jRes = await fetchWithTimeout(
        `https://api.jikan.moe/v4/characters?page=${fastPage}&limit=25&order_by=favorites&sort=desc`,
        undefined,
        3500
      );
      if (!jRes.ok) continue;
      const jJson = await jRes.json();
      const list = Array.isArray(jJson?.data) ? jJson.data : [];
      list.forEach((ch: any, idx: number) => {
        if (!ch?.mal_id || !isUsablePortrait(ch.images?.jpg?.image_url)) return;
        const rank = Math.min(MUDAE_LEGACY_POOL_TOTAL, (p - 1) * 50 + idx * 2 + 1);
        jikanSeeds.push({
          id: `mal_${ch.mal_id}`,
          name: ch.name || 'Personagem',
          series: Array.isArray(ch.nicknames) && ch.nicknames[0] ? String(ch.nicknames[0]) : 'Anime Catalog (MAL)',
          image: ch.images.jpg.image_url,
          gender: normalizeGender(undefined, ch.mal_id, ch.name),
          favourites: Math.round((typeof ch.favorites === 'number' ? ch.favorites : 500) * 0.65),
          role: 'Main',
          globalRank: rank,
        });
      });
    }

    return res.status(200).json({ source: 'jikan', seeds: jikanSeeds });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Upstream fetch failed', seeds: [] });
  }
}
