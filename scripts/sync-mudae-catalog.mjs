import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../public/mudae-catalog.json');

const MUDAE_LEGACY_POOL_TOTAL = 129_254;

const FALLBACK_IDS = [
  45627, 127691, 40, 124381, 89362, 137079, 176754, 127518, 89028, 129927,
  62, 27, 14, 40881, 497, 11, 71, 246, 1555, 121102, 132645, 138101, 206,
  145, 249, 1690, 139814, 130041, 92954, 5186, 2457, 45887, 129132, 259, 263,
  4839, 46494, 46484, 92953, 92956, 129131, 19662, 9684, 1694, 1689, 2514, 3001,
  2962, 92964, 121942, 36829, 15810, 1875, 9382, 2423, 2425, 2431, 5255, 73995,
  46496, 92955, 121941, 9811,
];

const TIER_PAGES = [
  1, 2, 4, 6, 12, 22,
  35, 65, 110, 160, 220, 280,
  320, 450, 620, 880, 1150, 1520, 1980, 2450,
];

function hashGender(seedKey) {
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

function normalizeGender(raw, idHint, nameHint) {
  if (typeof raw === 'string') {
    const g = raw.trim().toLowerCase();
    if (g === 'female') return 'Female';
    if (g === 'male') return 'Male';
    if (g === 'non-binary' || g === 'other') return 'Other';
  }
  return hashGender(`${idHint ?? ''}:${nameHint ?? ''}`);
}

function isUsablePortrait(url) {
  if (typeof url !== 'string' || !url.startsWith('http')) return false;
  const low = url.toLowerCase();
  return !low.includes('default.jpg') && !low.includes('questionmark') && !low.includes('placeholder');
}

function mapAniListChar(ch, globalRank) {
  if (!ch?.id) return null;
  const img = ch.image?.large || ch.image?.medium || '';
  if (!isUsablePortrait(img)) return null;
  const node = ch.media?.nodes?.[0] || ch.media?.edges?.[0]?.node;
  const series = node?.title?.english || node?.title?.romaji || 'Anime';
  return {
    id: `anilist_${ch.id}`,
    name: ch.name?.full || 'Personagem',
    series,
    image: img,
    gender: normalizeGender(ch.gender, ch.id, ch.name?.full),
    favourites: typeof ch.favourites === 'number' && Number.isFinite(ch.favourites) ? ch.favourites : 400,
    role: 'Main',
    ...(typeof globalRank === 'number' ? { globalRank } : {}),
  };
}

async function fetchAniList(query, variables = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchByIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const query = `
      query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          characters(id_in: $ids) {
            id
            name { full }
            gender
            favourites
            image { large }
            media(perPage: 1) {
              nodes { title { romaji english } }
            }
          }
        }
      }
    `;
    try {
      const json = await fetchAniList(query, { ids: chunk });
      const list = json?.data?.Page?.characters || [];
      for (const ch of list) {
        const mapped = mapAniListChar(ch);
        if (mapped) out.push(mapped);
      }
    } catch (err) {
      console.warn(`⚠️ Falha parcial em id_in chunk ${i}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

async function fetchPagesPair(pages) {
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
          media(perPage: 1) {
            nodes { title { romaji english } }
          }
        }
      }
    `;
  });
  const query = `query { ${fields.join('\n')} }`;
  const json = await fetchAniList(query);
  const data = json?.data || {};
  const seeds = [];
  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i];
    const list = data[`p${i}`]?.characters || [];
    list.forEach((ch, idx) => {
      const rank = Math.min(MUDAE_LEGACY_POOL_TOTAL, (pageNum - 1) * 50 + idx + 1);
      const mapped = mapAniListChar(ch, rank);
      if (mapped) seeds.push(mapped);
    });
  }
  return seeds;
}

async function main() {
  console.log('🚀 Gerando catálogo estático pré-processado do Mudae Anime Bot...');
  const map = new Map();

  console.log(`🔎 Hidratando ${FALLBACK_IDS.length} personagens base via AniList...`);
  const fallbackSeeds = await fetchByIds(FALLBACK_IDS);
  for (const s of fallbackSeeds) map.set(s.id, s);
  console.log(`✅ Base hidratada: ${fallbackSeeds.length} personagens com retrato verificado.`);

  const loadedPages = [];
  for (let i = 0; i < TIER_PAGES.length; i += 2) {
    const pair = TIER_PAGES.slice(i, i + 2);
    try {
      const batch = await fetchPagesPair(pair);
      for (const s of batch) {
        const prev = map.get(s.id);
        if (!prev || (!prev.globalRank && s.globalRank)) {
          map.set(s.id, { ...s, globalRank: s.globalRank ?? prev?.globalRank });
        }
      }
      loadedPages.push(...pair);
      console.log(`📦 Páginas ${pair.join(', ')} -> +${batch.length} personagens (total: ${map.size})`);
    } catch (err) {
      console.warn(`⚠️ Erro nas páginas ${pair.join(', ')}: ${err.message}. Aguardando retry...`);
      await new Promise((r) => setTimeout(r, 3500));
      try {
        const retryBatch = await fetchPagesPair(pair);
        for (const s of retryBatch) map.set(s.id, s);
        loadedPages.push(...pair);
        console.log(`🔁 Retry OK páginas ${pair.join(', ')} -> +${retryBatch.length}`);
      } catch (err2) {
        console.warn(`❌ Retry falhou páginas ${pair.join(', ')}: ${err2.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 1750));
  }

  const seeds = Array.from(map.values());
  if (seeds.length < 50) {
    throw new Error(`Apenas ${seeds.length} personagens obtidos. Abortando gravação.`);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      pagesLoaded: loadedPages,
      seeds,
    })
  );
  console.log(`✨ Catálogo salvo com sucesso em ${OUTPUT_PATH} (${seeds.length} personagens com retratos reais)!`);
}

main().catch((err) => {
  console.error('❌ Erro ao gerar mudae-catalog.json:', err);
  process.exit(1);
});
