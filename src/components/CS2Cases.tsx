import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Search, ArrowLeft, TrendingUp, Crosshair, Loader2, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import type { PlacedBet, PokemonCard } from '../types';
import { useSound } from '../hooks/useSound';

interface CSSkin {
  id: string;
  name: string;
  rarity: string;
  weapon: string;
  rarityLevel: number;
  minPrice: number;
  maxPrice: number;
  minFloat?: number;
  maxFloat?: number;
  canStatTrak?: boolean;
  image?: string;
}

interface CS2CaseData {
  id: string;
  name: string;
  image: string;
  price: number;
  tier: 'daily' | 'budget' | 'standard' | 'premium' | 'high';
  weights: number[];
  items: CSSkin[];
}

interface RolledResultMeta {
  floatValue: number;
  wearCode: 'FN' | 'MW' | 'FT' | 'WW' | 'BS';
  wearLabel: string;
  isStatTrak: boolean;
}

interface RecentDropEntry {
  uid: string;
  weapon: string;
  name: string;
  rarityLevel: number;
  image?: string;
  isStatTrak: boolean;
  wearCode: string;
  price: number;
}

interface SkinMetaInfo {
  minFloat: number;
  maxFloat: number;
  canStatTrak: boolean;
}

const CSGO_CRATES_URLS = [
  'https://cdn.jsdelivr.net/gh/ByMykel/CSGO-API@main/public/api/en/crates.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json',
];

const CSGO_SKINS_URLS = [
  'https://cdn.jsdelivr.net/gh/ByMykel/CSGO-API@main/public/api/en/skins.json',
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json',
];

function toFastCdnUrl(url?: string): string {
  if (!url) return '';
  return url.replace(
    'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/',
    'https://cdn.jsdelivr.net/gh/ByMykel/counter-strike-image-tracker@main/'
  );
}

function toRawFallbackUrl(url?: string): string {
  if (!url) return '';
  return url.replace(
    'https://cdn.jsdelivr.net/gh/ByMykel/counter-strike-image-tracker@main/',
    'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/'
  );
}

function CS2Image({
  src,
  alt,
  className,
  fallbackEmoji = '🔫',
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackEmoji?: string;
}) {
  const candidates = useMemo(() => {
    if (!src) return [];
    const list = [toFastCdnUrl(src), toRawFallbackUrl(src), src];
    const seen = new Set<string>();
    return list.filter((u) => {
      if (!u || !u.startsWith('http') || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [src]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [src]);

  if (idx >= candidates.length) {
    return <span className="text-3xl select-none">{fallbackEmoji}</span>;
  }

  return (
    <img
      src={candidates[idx]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setIdx((p) => p + 1)}
    />
  );
}

let cachedCasesMemory: CS2CaseData[] | null = null;
let cachedSkinImagesMemory: Record<string, string> = {};

function rarityColor(level: number) {
  switch (level) {
    case 0: return { bg: 'bg-blue-500/15', border: 'border-blue-500/45', text: 'text-blue-400', glow: 'rgba(59,130,246,0.32)' };
    case 1: return { bg: 'bg-purple-500/15', border: 'border-purple-500/45', text: 'text-purple-400', glow: 'rgba(168,85,247,0.34)' };
    case 2: return { bg: 'bg-pink-500/15', border: 'border-pink-500/45', text: 'text-pink-400', glow: 'rgba(236,72,153,0.35)' };
    case 3: return { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400', glow: 'rgba(239,68,68,0.42)' };
    case 4: return { bg: 'bg-amber-500/15', border: 'border-amber-400/70', text: 'text-amber-300', glow: 'rgba(245,158,11,0.62)' };
    default: return { bg: 'bg-slate-500/15', border: 'border-slate-500/40', text: 'text-slate-400', glow: 'rgba(100,116,139,0.3)' };
  }
}

function rarityLabel(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec (Azul)';
    case 1: return 'Restricted (Roxa)';
    case 2: return 'Classified (Rosa)';
    case 3: return 'Covert (Vermelha)';
    case 4: return 'Rare Special (Ouro)';
    default: return 'Desconhecida';
  }
}

function rarityLabelShort(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec';
    case 1: return 'Restricted';
    case 2: return 'Classified';
    case 3: return 'Covert';
    case 4: return '★ Rare Special';
    default: return '';
  }
}

function rarityNameFromLevel(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec';
    case 1: return 'Restricted';
    case 2: return 'Classified';
    case 3: return 'Covert';
    case 4: return 'Rare Special';
    default: return 'Mil-Spec';
  }
}

function mapApiRarityToLevel(rarityId?: string, rarityName?: string): number {
  const id = (rarityId || '').toLowerCase();
  const name = (rarityName || '').toLowerCase();
  if (id.includes('ancient') || name.includes('oculto') || name.includes('covert')) return 3;
  if (id.includes('legendary') || name.includes('secreto') || name.includes('classified')) return 2;
  if (id.includes('mythical') || name.includes('restrito') || name.includes('restricted')) return 1;
  return 0;
}

function splitWeaponAndSkin(fullName: string): { weapon: string; name: string } {
  const clean = fullName.replace(/^★\s*/, '').replace(/^☆\s*/, '').trim();
  const parts = clean.split('|');
  if (parts.length >= 2) {
    return {
      weapon: (fullName.startsWith('★') || fullName.startsWith('☆') ? '★ ' : '') + parts[0].trim(),
      name: parts.slice(1).join('|').trim(),
    };
  }
  return {
    weapon: fullName.startsWith('★') || fullName.startsWith('☆') ? '★ Special' : 'CS2',
    name: clean,
  };
}

function getPriceRange(tier: CS2CaseData['tier'], level: number): { minPrice: number; maxPrice: number } {
  const tierFactor = tier === 'daily' ? 0.5 : tier === 'budget' ? 0.85 : tier === 'standard' ? 1 : tier === 'premium' ? 1.85 : 3.2;
  switch (level) {
    case 0: return { minPrice: +(0.40 * tierFactor).toFixed(2), maxPrice: +(3.1 * tierFactor).toFixed(2) };
    case 1: return { minPrice: +(2.8 * tierFactor).toFixed(2), maxPrice: +(13.5 * tierFactor).toFixed(2) };
    case 2: return { minPrice: +(14 * tierFactor).toFixed(2), maxPrice: +(58 * tierFactor).toFixed(2) };
    case 3: return { minPrice: +(55 * tierFactor).toFixed(2), maxPrice: +(340 * tierFactor).toFixed(2) };
    case 4: return { minPrice: +(380 * tierFactor).toFixed(2), maxPrice: +(2600 * tierFactor).toFixed(2) };
    default: return { minPrice: 0.5, maxPrice: 2 };
  }
}

function rollFloatAndStatTrak(skin: CSSkin): { meta: RolledResultMeta; priceMult: number } {
  const minF = typeof skin.minFloat === 'number' ? skin.minFloat : 0;
  const maxF = typeof skin.maxFloat === 'number' && skin.maxFloat > minF ? skin.maxFloat : 1;
  const r = Math.random();
  const raw =
    r < 0.14
      ? minF + Math.random() * Math.min(0.07, maxF - minF)
      : minF + (r * r * 0.72 + Math.random() * 0.28) * (maxF - minF);
  const floatValue = Number(Math.min(maxF, Math.max(minF, raw)).toFixed(4));

  let wearCode: RolledResultMeta['wearCode'] = 'FT';
  let wearLabel = 'Testada em Campo';
  let wearMult = 1.0;

  if (floatValue < 0.07) {
    wearCode = 'FN';
    wearLabel = 'Nova de Fábrica';
    wearMult = 1.65;
  } else if (floatValue < 0.15) {
    wearCode = 'MW';
    wearLabel = 'Pouco Usada';
    wearMult = 1.32;
  } else if (floatValue < 0.38) {
    wearCode = 'FT';
    wearLabel = 'Testada em Campo';
    wearMult = 1.0;
  } else if (floatValue < 0.45) {
    wearCode = 'WW';
    wearLabel = 'Bem Desgastada';
    wearMult = 0.85;
  } else {
    wearCode = 'BS';
    wearLabel = 'Veterana de Guerra';
    wearMult = 0.72;
  }

  const isStatTrak = skin.canStatTrak !== false && Math.random() < 0.10;
  const priceMult = wearMult * (isStatTrak ? 1.85 : 1.0);

  return {
    meta: { floatValue, wearCode, wearLabel, isStatTrak },
    priceMult,
  };
}

const KILOWATT_CASE_IMG =
  'https://cdn.jsdelivr.net/gh/ByMykel/counter-strike-image-tracker@main/static/panorama/images/econ/weapon_cases/crate_community_33_png.png';
const HIDEOUT_IMG =
  'https://cdn.jsdelivr.net/gh/ByMykel/counter-strike-image-tracker@main/static/panorama/images/econ/default_generated/weapon_elite_dual_berettas_lethal_grin_light_png.png';
const KUKRI_IMG =
  'https://cdn.jsdelivr.net/gh/ByMykel/counter-strike-image-tracker@main/static/panorama/images/econ/weapons/base_weapons/weapon_knife_kukri_png.png';

const FALLBACK_CASES: CS2CaseData[] = [
  {
    id: 'daily',
    name: 'Caixa Diária CS2',
    image: KILOWATT_CASE_IMG,
    price: 0,
    tier: 'daily',
    weights: [81, 11.5, 4.2, 2.3, 1.0],
    items: [
      { id: 'daily_1', name: 'Hideout', rarity: 'Mil-Spec', weapon: 'Dual Berettas', rarityLevel: 0, minPrice: 0.25, maxPrice: 1.5, image: HIDEOUT_IMG },
      { id: 'daily_2', name: 'Dark Sigil', rarity: 'Mil-Spec', weapon: 'Nova', rarityLevel: 0, minPrice: 0.25, maxPrice: 1.5 },
      { id: 'daily_3', name: 'Block-18', rarity: 'Restricted', weapon: 'Glock-18', rarityLevel: 1, minPrice: 1.5, maxPrice: 6 },
      { id: 'daily_4', name: 'Just Smile', rarity: 'Classified', weapon: 'MP7', rarityLevel: 2, minPrice: 6, maxPrice: 24 },
      { id: 'daily_5', name: 'Inheritance', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 35, maxPrice: 180 },
      { id: 'daily_6', name: '★ Kukri Knife', rarity: 'Rare Special', weapon: '★ Knife', rarityLevel: 4, minPrice: 200, maxPrice: 1100, image: KUKRI_IMG },
    ],
  },
  {
    id: 'kilowatt',
    name: 'Kilowatt Case',
    image: KILOWATT_CASE_IMG,
    price: 12.90,
    tier: 'standard',
    weights: [74.5, 14.5, 5.8, 4.1, 1.1],
    items: [
      { id: 'kw_1', name: 'Hideout', rarity: 'Mil-Spec', weapon: 'Dual Berettas', rarityLevel: 0, minPrice: 0.5, maxPrice: 3, image: HIDEOUT_IMG },
      { id: 'kw_2', name: 'Block-18', rarity: 'Restricted', weapon: 'Glock-18', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_3', name: 'Chrome Cannon', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'kw_4', name: '★ Kukri Knife', rarity: 'Rare Special', weapon: '★ Knife', rarityLevel: 4, minPrice: 400, maxPrice: 2000, image: KUKRI_IMG },
    ],
  },
];

const TIER_WEIGHTS: Record<CS2CaseData['tier'], number[]> = {
  daily: [81, 11.5, 4.2, 2.3, 1.0],
  budget: [78.4, 12.5, 4.6, 3.5, 1.0],
  standard: [74.5, 14.5, 5.8, 4.1, 1.1],
  premium: [63.6, 21.5, 8.2, 5.5, 1.2],
  high: [48.5, 28.5, 14.2, 7.2, 1.6],
};

const TIER_PRICES: Record<CS2CaseData['tier'], number[]> = {
  daily: [0],
  budget: [5.90, 7.90],
  standard: [12.90, 14.90],
  premium: [24.90, 39.90],
  high: [59.90, 99.90],
};

const PRIORITY_PATTERNS = [
  'kilowatt', 'gallery', 'fever', 'revolution', 'recoil', 'dreams',
  'fracture', 'snakebite', 'prisma', 'spectrum', 'riptide', 'bravo',
  'chroma', 'falchion', 'cs20', 'clutch', 'danger zone', 'horizon',
  'operation', 'cobblestone', 'mirage', 'inferno', 'overpass',
];

async function fetchFirstValidJson(urls: string[]): Promise<any[] | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) return json;
    } catch {
      // Try next CDN mirror
    }
  }
  return null;
}

function buildCasesFromApi(
  rawCrates: any[],
  skinsMetaMap: Map<string, SkinMetaInfo>
): { cases: CS2CaseData[]; imageMap: Record<string, string> } {
  const imageMap: Record<string, string> = {};
  const validCrates = rawCrates.filter((c) => {
    if (!c || !Array.isArray(c.contains) || c.contains.length < 8 || !c.image) return false;
    if (c.type === 'Case') return true;
    if (c.type === 'Souvenir') {
      const lower = (c.name || '').toLowerCase();
      return PRIORITY_PATTERNS.some((p) => lower.includes(p));
    }
    return false;
  });

  const prioritized = [...validCrates].sort((a, b) => {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    const ai = PRIORITY_PATTERNS.findIndex((p) => an.includes(p));
    const bi = PRIORITY_PATTERNS.findIndex((p) => bn.includes(p));
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return (b.first_sale_date || '').localeCompare(a.first_sale_date || '');
  });

  const chosen = prioritized.slice(0, 24);
  const tiersOrder: CS2CaseData['tier'][] = [
    'budget', 'budget', 'budget', 'budget', 'budget', 'budget',
    'standard', 'standard', 'standard', 'standard', 'standard', 'standard', 'standard', 'standard',
    'premium', 'premium', 'premium', 'premium', 'premium',
    'high', 'high', 'high', 'high', 'high',
  ];

  const builtCases: CS2CaseData[] = chosen.map((crate, idx) => {
    const tier = tiersOrder[idx] || 'standard';
    const priceChoices = TIER_PRICES[tier];
    const price = priceChoices[idx % priceChoices.length];

    const standardItems: CSSkin[] = (crate.contains || []).map((skin: any, sIdx: number) => {
      const level = mapApiRarityToLevel(skin.rarity?.id, skin.rarity?.name);
      const { weapon, name } = splitWeaponAndSkin(skin.name || 'Skin');
      const { minPrice, maxPrice } = getPriceRange(tier, level);
      const itemId = skin.id || `${crate.id}_${sIdx}`;
      const fastImg = toFastCdnUrl(skin.image);
      const meta = skinsMetaMap.get(itemId);

      if (fastImg) {
        imageMap[itemId] = fastImg;
        imageMap[`${weapon} | ${name}`.toLowerCase()] = fastImg;
      }

      return {
        id: itemId,
        name,
        weapon,
        rarity: rarityNameFromLevel(level),
        rarityLevel: level,
        minPrice,
        maxPrice,
        minFloat: meta?.minFloat ?? 0.0,
        maxFloat: meta?.maxFloat ?? 1.0,
        canStatTrak: meta ? meta.canStatTrak : crate.type !== 'Souvenir',
        image: fastImg,
      };
    });

    const rarePool = Array.isArray(crate.contains_rare) ? crate.contains_rare.slice(0, 14) : [];
    const rareItems: CSSkin[] = rarePool.map((skin: any, rIdx: number) => {
      const { weapon, name } = splitWeaponAndSkin(skin.name || 'Rare Special');
      const { minPrice, maxPrice } = getPriceRange(tier, 4);
      const itemId = skin.id || `${crate.id}_rare_${rIdx}`;
      const fastImg = toFastCdnUrl(skin.image);
      const meta = skinsMetaMap.get(itemId);

      if (fastImg) {
        imageMap[itemId] = fastImg;
        imageMap[`${weapon} | ${name}`.toLowerCase()] = fastImg;
      }

      return {
        id: itemId,
        name,
        weapon: weapon.startsWith('★') ? weapon : `★ ${weapon}`,
        rarity: 'Rare Special',
        rarityLevel: 4,
        minPrice,
        maxPrice,
        minFloat: meta?.minFloat ?? 0.0,
        maxFloat: meta?.maxFloat ?? 0.8,
        canStatTrak: !/glove|wraps|luva/i.test(skin.name || ''),
        image: fastImg,
      };
    });

    return {
      id: crate.id || `crate-${idx}`,
      name: crate.name || 'CS2 Case',
      image: toFastCdnUrl(crate.image),
      price,
      tier,
      weights: TIER_WEIGHTS[tier],
      items: [...standardItems, ...rareItems],
    };
  });

  // Free Daily Case built from real skins across the loaded cases
  const dailyPool: CSSkin[] = [];
  for (const c of builtCases.slice(0, 6)) {
    const pickLevel = (lvl: number) => c.items.filter((i) => i.rarityLevel === lvl).slice(0, 2);
    dailyPool.push(
      ...pickLevel(0).slice(0, 2),
      ...pickLevel(1).slice(0, 1),
      ...pickLevel(2).slice(0, 1),
      ...pickLevel(3).slice(0, 1),
      ...pickLevel(4).slice(0, 1)
    );
  }
  const uniqueDaily = Array.from(new Map(dailyPool.map((i) => [i.id, i])).values())
    .slice(0, 24)
    .map((item) => {
      const { minPrice, maxPrice } = getPriceRange('daily', item.rarityLevel);
      return { ...item, minPrice, maxPrice };
    });

  const dailyCase: CS2CaseData = {
    id: 'daily',
    name: 'Caixa Diária CS2',
    image: builtCases[0]?.image || KILOWATT_CASE_IMG,
    price: 0,
    tier: 'daily',
    weights: TIER_WEIGHTS.daily,
    items: uniqueDaily.length > 0 ? uniqueDaily : FALLBACK_CASES[0].items,
  };

  return { cases: [dailyCase, ...builtCases], imageMap };
}

function pickWeightedItem(caseData: CS2CaseData): CSSkin {
  const roll = Math.random() * 100;
  let cumulative = 0;
  let chosenLevel = 0;
  for (let i = 0; i < caseData.weights.length; i++) {
    cumulative += caseData.weights[i];
    if (roll < cumulative) { chosenLevel = i; break; }
  }
  const pool = caseData.items.filter((s) => s.rarityLevel === chosenLevel);
  if (pool.length === 0) {
    const fallback = caseData.items.filter((s) => s.rarityLevel === 0);
    return (fallback.length > 0 ? fallback : caseData.items)[
      Math.floor(Math.random() * (fallback.length > 0 ? fallback.length : caseData.items.length))
    ];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateStripItems(caseData: CS2CaseData, winner: CSSkin, winnerIndex: number): CSSkin[] {
  const items: CSSkin[] = [];
  for (let i = 0; i < 50; i++) {
    if (i === winnerIndex) items.push(winner);
    else items.push(pickWeightedItem(caseData));
  }
  return items;
}

interface CS2CasesProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

export default function CS2Cases({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: CS2CasesProps) {
  const [cases, setCases] = useState<CS2CaseData[]>(() => cachedCasesMemory || FALLBACK_CASES);
  const [loadingApi, setLoadingApi] = useState<boolean>(() => !cachedCasesMemory);
  const [skinImages, setSkinImages] = useState<Record<string, string>>(() => cachedSkinImagesMemory);

  const [tab, setTab] = useState<'cases' | 'collection' | 'market'>('cases');
  const [selectedCase, setSelectedCase] = useState<CS2CaseData | null>(null);
  const [rolling, setRolling] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [result, setResult] = useState<CSSkin | null>(null);
  const [resultMeta, setResultMeta] = useState<RolledResultMeta | null>(null);
  const [resultPrice, setResultPrice] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [stripItems, setStripItems] = useState<CSSkin[]>([]);
  const [stripX, setStripX] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [recentDrops, setRecentDrops] = useState<RecentDropEntry[]>([]);

  const { playFile, play } = useSound();
  const stripContainerRef = useRef<HTMLDivElement>(null);
  const stripInnerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const animToken = useRef<number>(0);
  const animStartRef = useRef<number>(0);
  const lastTickIdxRef = useRef<number>(-1);
  const pendingMetaRef = useRef<{ meta: RolledResultMeta; priceMult: number } | null>(null);

  // Load real CS2 crates & skin metadata via jsDelivr / GitHub CDN
  useEffect(() => {
    if (cachedCasesMemory) {
      setCases(cachedCasesMemory);
      setSkinImages(cachedSkinImagesMemory);
      setLoadingApi(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [rawCrates, rawSkins] = await Promise.all([
          fetchFirstValidJson(CSGO_CRATES_URLS),
          fetchFirstValidJson(CSGO_SKINS_URLS),
        ]);

        if (rawCrates && !cancelled) {
          const skinsMeta = new Map<string, SkinMetaInfo>();
          if (rawSkins) {
            for (const s of rawSkins) {
              if (!s?.id) continue;
              skinsMeta.set(String(s.id), {
                minFloat: typeof s.min_float === 'number' ? s.min_float : 0,
                maxFloat: typeof s.max_float === 'number' ? s.max_float : 1,
                canStatTrak: Boolean(s.stattrak),
              });
            }
          }

          const { cases: built, imageMap } = buildCasesFromApi(rawCrates, skinsMeta);
          if (built.length > 1 && !cancelled) {
            cachedCasesMemory = built;
            cachedSkinImagesMemory = imageMap;
            setCases(built);
            setSkinImages(imageMap);
          }
        }
      } catch {
        // Fallback already active
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Build skin prices whenever cases or collection change
  useEffect(() => {
    setPrices((prev) => {
      const next = { ...prev };
      cases.forEach((c) => c.items.forEach((s) => {
        if (next[s.id] === undefined) {
          next[s.id] = Math.round((s.minPrice + Math.random() * (s.maxPrice - s.minPrice)) * 100) / 100;
        }
      }));
      collection.forEach((card) => {
        if (next[card.id] === undefined) {
          const lvl = card.rarity.includes('Ouro')
            ? 4
            : card.rarity.includes('Vermelha')
            ? 3
            : card.rarity.includes('Rosa')
            ? 2
            : card.rarity.includes('Roxa')
            ? 1
            : 0;
          const range = getPriceRange('standard', lvl);
          next[card.id] = Math.round((range.minPrice + Math.random() * (range.maxPrice - range.minPrice)) * 100) / 100;
        }
      });
      return next;
    });
  }, [cases, collection]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices((prev) => {
        const updated = { ...prev };
        cases.forEach((c) => c.items.forEach((s) => {
          const current = updated[s.id] ?? (s.minPrice + s.maxPrice) / 2;
          const change = (Math.random() - 0.5) * 0.14 * current;
          const newPrice = Math.max(s.minPrice * 0.8, Math.min(s.maxPrice * 1.25, current + change));
          updated[s.id] = Math.round(newPrice * 100) / 100;
        }));
        return updated;
      });
    }, 25000);
    return () => clearInterval(interval);
  }, [cases]);

  useEffect(() => {
    const el = stripContainerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [tab, selectedCase]);

  useEffect(() => {
    function check() {
      try {
        const last = localStorage.getItem('cs2DailyLastOpen');
        if (last) {
          const elapsed = Date.now() - parseInt(last, 10);
          const remaining = Math.max(0, 86400000 - elapsed);
          setDailyCooldown(Math.ceil(remaining / 1000));
        } else {
          setDailyCooldown(0);
        }
      } catch { setDailyCooldown(0); }
    }
    check();
    const tick = setInterval(() => {
      setDailyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const openCase = useCallback(() => {
    if (!selectedCase || rolling) return;
    if (balance < selectedCase.price) return;
    setRolling(true);
    setShowResult(false);
    setResult(null);
    setResultMeta(null);
    if (selectedCase.price > 0) onUpdateBalance(-selectedCase.price);
    if (selectedCase.tier === 'daily') {
      try { localStorage.setItem('cs2DailyLastOpen', String(Date.now())); } catch {}
      setDailyCooldown(86400);
    }

    const winner = pickWeightedItem(selectedCase);
    const rolledFloat = rollFloatAndStatTrak(winner);
    pendingMetaRef.current = rolledFloat;

    const winnerIndex = 35 + Math.floor(Math.random() * 8);
    const items = generateStripItems(selectedCase, winner, winnerIndex);
    setStripItems(items);
    setStripX(containerWidth);
    animToken.current = winnerIndex;
    animStartRef.current = containerWidth;
    lastTickIdxRef.current = -1;
    playFile('/BenBets/sounds/csgo-case-open.mp3', 0.14);
  }, [selectedCase, rolling, balance, onUpdateBalance, containerWidth, playFile]);

  useLayoutEffect(() => {
    if (!rolling || !stripContainerRef.current || !stripInnerRef.current) return;
    if (stripItems.length === 0) return;
    const container = stripContainerRef.current;
    const inner = stripInnerRef.current;
    const containerRect = container.getBoundingClientRect();
    const arrowX = containerRect.left + containerRect.width / 2;

    const winnerIndex = animToken.current;
    const winnerEl = inner.children[winnerIndex] as HTMLElement | undefined;
    const firstEl = inner.children[0] as HTMLElement | undefined;
    if (!winnerEl) return;
    const winnerItem = stripItems[winnerIndex];
    if (!winnerItem) return;

    const itemRect = winnerEl.getBoundingClientRect();
    const itemCenter = itemRect.left + itemRect.width / 2;
    const firstCenter = firstEl
      ? firstEl.getBoundingClientRect().left + firstEl.getBoundingClientRect().width / 2
      : itemCenter - winnerIndex * 108;
    const pitch = winnerIndex > 0 ? (itemCenter - firstCenter) / winnerIndex : 108;

    const startX = animStartRef.current;
    const endX = startX - (itemCenter - arrowX);
    const duration = turboMode ? 1200 : 3500;
    const startTime = performance.now();

    let frameId = 0;
    function animate(now: number) {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const curX = startX + (endX - startX) * eased;
      setStripX(curX);

      const centerIdx = Math.round((arrowX - (firstCenter + (curX - startX))) / (pitch || 108));
      if (centerIdx !== lastTickIdxRef.current && centerIdx >= 0 && centerIdx < stripItems.length) {
        lastTickIdxRef.current = centerIdx;
        play('tick');
      }

      if (p < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        const metaWrap = pendingMetaRef.current || rollFloatAndStatTrak(winnerItem);
        const baseMid = winnerItem.minPrice + Math.random() * (winnerItem.maxPrice - winnerItem.minPrice);
        const finalPrice = Math.max(0.25, Math.round(baseMid * metaWrap.priceMult * 100) / 100);

        setStripX(endX);
        setResult(winnerItem);
        setResultMeta(metaWrap.meta);
        setResultPrice(finalPrice);
        setShowResult(true);
        setRolling(false);
        setRecentDrops((prev) => [
          {
            uid: `${winnerItem.id}-${Date.now()}`,
            weapon: winnerItem.weapon,
            name: winnerItem.name,
            rarityLevel: winnerItem.rarityLevel,
            image: winnerItem.image,
            isStatTrak: metaWrap.meta.isStatTrak,
            wearCode: metaWrap.meta.wearCode,
            price: finalPrice,
          },
          ...prev.slice(0, 7),
        ]);
        play(winnerItem.rarityLevel >= 3 ? 'legendary' : winnerItem.rarityLevel >= 1 ? 'rare' : 'reveal');
      }
    }
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [rolling, stripItems, play, turboMode]);

  const buildKeptCard = useCallback((skin: CSSkin, caze: CS2CaseData, meta: RolledResultMeta | null): PokemonCard => {
    const prefix = meta?.isStatTrak ? 'StatTrak™ ' : '';
    const wearTag = meta ? ` (${meta.wearCode})` : '';
    const baseWeapon = skin.weapon.replace(/^★\s*/, '');
    const displayWeapon = skin.weapon.startsWith('★') ? `★ ${prefix}${baseWeapon}` : `${prefix}${baseWeapon}`;
    return {
      id: `${skin.id}_${meta?.wearCode || 'FT'}_${meta?.isStatTrak ? 'st' : 'std'}`,
      name: `${displayWeapon} | ${skin.name}${wearTag}`,
      imageUrl: skin.image || '',
      rarity: rarityLabel(skin.rarityLevel),
      setName: caze.name,
      setSeries: 'CS2',
      quantity: 1,
    };
  }, []);

  const handleKeep = useCallback(() => {
    if (!result || !selectedCase) return;
    const card = buildKeptCard(result, selectedCase, resultMeta);
    onCollectionUpdate([card]);
    setPrices((p) => ({ ...p, [card.id]: resultPrice }));

    if (onAddBetHistory) {
      onAddBetHistory({
        id: `cs2-${Date.now()}`,
        matchName: `CS2 — ${selectedCase.name}`,
        selectionName: card.name,
        odds: selectedCase.price > 0 ? Number((resultPrice / selectedCase.price).toFixed(2)) : 0,
        stake: selectedCase.price,
        potentialPayout: resultPrice,
        status: 'won',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: result.rarityLevel >= 3 ? 'RARA!' : 'COLECIONADA',
      });
    }

    setShowResult(false);
    setResult(null);
  }, [result, selectedCase, resultMeta, resultPrice, buildKeptCard, onCollectionUpdate, onAddBetHistory]);

  const handleSellNow = useCallback(() => {
    if (!result || !selectedCase) return;
    onUpdateBalance(resultPrice);
    play('cashout');

    if (onAddBetHistory) {
      onAddBetHistory({
        id: `cs2-sell-${Date.now()}`,
        matchName: `CS2 — ${selectedCase.name}`,
        selectionName: `${result.weapon} | ${result.name}`,
        odds: selectedCase.price > 0 ? Number((resultPrice / selectedCase.price).toFixed(2)) : 0,
        stake: selectedCase.price,
        potentialPayout: resultPrice,
        status: resultPrice >= selectedCase.price ? 'won' : 'lost',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: `R$ ${resultPrice.toFixed(2)}`,
      });
    }

    setShowResult(false);
    setResult(null);
  }, [result, selectedCase, resultPrice, onUpdateBalance, onAddBetHistory, play]);

  const sellPrice = useCallback((card: PokemonCard): number => prices[card.id] ?? 1.0, [prices]);

  const handleSellSingle = useCallback((card: PokemonCard) => {
    onSellCard(card.id, sellPrice(card));
  }, [onSellCard, sellPrice]);

  const handleSellAllDups = useCallback(() => {
    const dupePrices: Record<string, number> = {};
    collection.forEach((c) => {
      if (c.quantity > 1) dupePrices[c.id] = sellPrice(c);
    });
    onSellAllDuplicates(dupePrices);
  }, [collection, onSellAllDuplicates, sellPrice]);

  const filteredCollection = useMemo(() => {
    return collection
      .filter((c) => c.setSeries === 'CS2')
      .filter((c) => {
        if (rarityFilter === null) return true;
        const rarMap: Record<string, number> = {
          'Mil-Spec (Azul)': 0, 'Restricted (Roxa)': 1,
          'Classified (Rosa)': 2, 'Covert (Vermelha)': 3, 'Rare Special (Ouro)': 4,
        };
        return rarMap[c.rarity] === rarityFilter;
      })
      .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [collection, rarityFilter, searchQuery]);

  const casesToShow = cases.filter((c) => (tierFilter ? c.tier === tierFilter : true));

  const rarityCounts = useMemo(() => {
    const counts: Record<number, { total: number; collected: number }> = {
      0: { total: 0, collected: 0 },
      1: { total: 0, collected: 0 },
      2: { total: 0, collected: 0 },
      3: { total: 0, collected: 0 },
      4: { total: 0, collected: 0 },
    };
    const seenIds = new Set<string>();
    const cs2Cards = collection.filter((cc) => cc.setSeries === 'CS2');
    cases.forEach((c) => c.items.forEach((s) => {
      if (seenIds.has(s.id)) return;
      seenIds.add(s.id);
      counts[s.rarityLevel].total++;
      if (cs2Cards.some((cc) => cc.id === s.id || cc.id.startsWith(`${s.id}_`))) {
        counts[s.rarityLevel].collected++;
      }
    }));
    return counts;
  }, [cases, collection]);

  const totalItems = (Object.values(rarityCounts) as { total: number; collected: number }[]).reduce((s, r) => s + r.total, 0);
  const collectedItems = collection.filter((c) => c.setSeries === 'CS2').length;

  const resolveCardImage = (card: PokemonCard): string | undefined => {
    if (card.imageUrl) return card.imageUrl;
    const baseName = card.name.replace('StatTrak™ ', '').replace(/\s*\((FN|MW|FT|WW|BS)\)$/, '').toLowerCase();
    return skinImages[card.id] || skinImages[card.id.split('_')[0]] || skinImages[baseName];
  };

  const TIER_INFO: Record<string, { label: string; icon: string; color: string }> = {
    daily: { label: 'Diária Grátis', icon: '🎁', color: 'text-brand border-brand/30 bg-brand/10' },
    budget: { label: 'Econômicas', icon: '🪙', color: 'text-slate-300 border-slate-500/30 bg-slate-500/10' },
    standard: { label: 'Padrão', icon: '📦', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
    premium: { label: 'Premium', icon: '💎', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
    high: { label: 'Alto Risco', icon: '🔥', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header Panorama CS2 */}
      <div className="omnitrix-panel relative overflow-hidden p-4 sm:p-5 rounded-2xl flex items-center gap-4 border-orange-500/30">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-400/75 to-transparent" />
        <div className="bg-orange-500/15 p-3 rounded-xl border border-orange-500/30 text-orange-400 shadow-[0_0_16px_rgba(249,115,22,0.22)] shrink-0">
          <Crosshair className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold font-display text-white text-base">CS2 Panorama Case Opening</h3>
            <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
              CSGO-API CDN • {cases.length} Caixas
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5 truncate">
            Skins & facas oficiais com Float Value real (0.00–1.00) e chance de StatTrak™
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono uppercase text-slate-500">Inventário</div>
          <div className="text-sm font-bold font-mono text-brand">{collectedItems}/{totalItems}</div>
        </div>
      </div>

      {/* Live Drop Ribbon */}
      {recentDrops.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[9px] font-mono font-bold uppercase text-slate-500 shrink-0 px-1">Últimos Drops:</span>
          {recentDrops.map((d) => {
            const rc = rarityColor(d.rarityLevel);
            return (
              <div
                key={d.uid}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${rc.border} ${rc.bg} shrink-0`}
              >
                <div className="w-6 h-5 flex items-center justify-center overflow-hidden">
                  <CS2Image src={d.image} alt={d.name} className="max-h-5 object-contain" fallbackEmoji={d.rarityLevel === 4 ? '★' : '🔫'} />
                </div>
                <div className="text-[9px] leading-tight">
                  <span className={`font-bold ${rc.text}`}>
                    {d.isStatTrak ? 'ST™ ' : ''}{d.name}
                  </span>
                  <span className="text-slate-400 font-mono ml-1">({d.wearCode})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LayoutGroup>
        <div className="flex gap-2 border-b border-[#1a1c2a] pb-2">
          {[
            { id: 'cases' as const, label: 'Caixas', icon: '📦' },
            { id: 'collection' as const, label: `Inventário (${collectedItems})`, icon: '🎒' },
            { id: 'market' as const, label: 'Mercado', icon: '💰' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border relative ${
                tab === t.id
                  ? 'border-orange-500/40 text-orange-300 shadow-[0_0_14px_rgba(249,115,22,0.18)]'
                  : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d] hover:bg-[#141624]'
              }`}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="cs-tab-pill"
                  className="absolute inset-0 bg-gradient-to-r from-orange-500/15 to-amber-600/10 border border-orange-500/30 rounded-xl"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5"><span>{t.icon}</span>{t.label}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <AnimatePresence mode="wait">
        {tab === 'cases' && !selectedCase && (
          <motion.div key="case-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex gap-1.5 flex-wrap items-center">
              <button
                onClick={() => setTierFilter(null)}
                className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  tierFilter === null ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d]'
                }`}
              >
                Todas ({cases.length})
              </button>
              {Object.entries(TIER_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setTierFilter(key)}
                  className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${info.color} ${
                    tierFilter === key ? 'ring-1 ring-brand/60' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {info.icon} {info.label}
                </button>
              ))}
              {loadingApi && (
                <span className="text-[10px] font-mono text-brand flex items-center gap-1 ml-auto">
                  <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando caixas CS2...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {casesToShow.map((c) => {
                const tInfo = TIER_INFO[c.tier] || { label: '', icon: '', color: 'text-slate-400' };
                const knifeCount = c.items.filter((i) => i.rarityLevel === 4).length;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    <button
                      onClick={() => { setSelectedCase(c); setShowResult(false); setResult(null); }}
                      className="omnitrix-card rounded-2xl p-3.5 text-center hover:border-orange-500/45 transition-all cursor-pointer group w-full flex flex-col items-center justify-between h-full relative"
                    >
                      {knifeCount > 0 && (
                        <span className="absolute top-2.5 right-2.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          ★ {knifeCount}
                        </span>
                      )}
                      <div className="w-full h-24 bg-[#06070d] rounded-xl border border-[#1a1d2d] flex items-center justify-center mb-2.5 overflow-hidden p-2">
                        <CS2Image
                          src={c.image}
                          alt={c.name}
                          className="max-h-20 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                          fallbackEmoji="📦"
                        />
                      </div>
                      <div className="w-full">
                        <div className="text-xs font-extrabold text-white group-hover:text-orange-300 transition-colors truncate">{c.name}</div>
                        <div className="text-xs font-mono font-bold text-brand mt-1">
                          {c.price === 0 ? 'GRÁTIS' : `R$ ${c.price.toFixed(2)}`}
                        </div>
                        <div className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full inline-block border ${tInfo.color}`}>
                          {tInfo.icon} {tInfo.label}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {tab === 'cases' && selectedCase && (
          <motion.div key="case-detail" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button onClick={() => setSelectedCase(null)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition-colors cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para todas as caixas
              </button>
              <button
                onClick={() => setTurboMode((v) => !v)}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  turboMode
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.28)]'
                    : 'bg-[#080a12] border-[#1a1d2d] text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" /> Modo Turbo {turboMode ? 'ON (1.2s)' : 'OFF'}
              </button>
            </div>

            <div className="omnitrix-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-xl bg-[#06070d] border border-[#1a1d2d] flex items-center justify-center p-2 shrink-0">
                  <CS2Image
                    src={selectedCase.image}
                    alt={selectedCase.name}
                    className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
                    fallbackEmoji="📦"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-extrabold font-display text-white truncate">{selectedCase.name}</h4>
                  <p className="text-sm font-mono font-bold text-brand">
                    {selectedCase.price === 0 ? 'Caixa Gratuita Diária' : `R$ ${selectedCase.price.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{selectedCase.items.length} skins & itens especiais</span>
                    <span className="text-orange-300 font-mono text-[10px]">• 10% StatTrak™</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-4">
                {[
                  { level: 0, label: 'Azul', chance: `${selectedCase.weights[0]}%`, color: 'text-blue-400' },
                  { level: 1, label: 'Roxa', chance: `${selectedCase.weights[1]}%`, color: 'text-purple-400' },
                  { level: 2, label: 'Rosa', chance: `${selectedCase.weights[2]}%`, color: 'text-pink-400' },
                  { level: 3, label: 'Verm.', chance: `${selectedCase.weights[3]}%`, color: 'text-red-400' },
                  { level: 4, label: '★ Ouro', chance: `${selectedCase.weights[4]}%`, color: 'text-amber-300' },
                ].map((o) => (
                  <div key={o.level} className={`bg-[#06070d] border border-[#1a1d2d] rounded-xl p-2 text-center ${o.color}`}>
                    <div className="text-[10px] font-bold">{o.label}</div>
                    <div className="text-sm sm:text-base font-black font-mono">{o.chance}</div>
                    <div className="text-[9px] opacity-60">{rarityCounts[o.level].collected}/{rarityCounts[o.level].total}</div>
                  </div>
                ))}
              </div>

              <div className="relative" style={{ minHeight: rolling || showResult ? '340px' : 'auto' }}>
                {!rolling && !showResult && (
                  <motion.button
                    onClick={openCase}
                    disabled={balance < selectedCase.price || (selectedCase.tier === 'daily' && dailyCooldown > 0)}
                    whileHover={!(balance < selectedCase.price || (selectedCase.tier === 'daily' && dailyCooldown > 0)) ? { scale: 1.01 } : {}}
                    whileTap={!(balance < selectedCase.price || (selectedCase.tier === 'daily' && dailyCooldown > 0)) ? { scale: 0.99 } : {}}
                    className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer ${
                      balance < selectedCase.price || (selectedCase.tier === 'daily' && dailyCooldown > 0)
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : selectedCase.price === 0
                        ? 'bg-brand hover:bg-[#00e074] text-slate-950 shadow-[0_0_20px_rgba(0,255,135,0.35)]'
                        : 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 hover:from-yellow-400 hover:to-amber-400 shadow-[0_0_22px_rgba(245,158,11,0.35)]'
                    }`}
                  >
                    {selectedCase.tier === 'daily' && dailyCooldown > 0
                      ? `⏳ Disponível em ${Math.floor(dailyCooldown / 3600)}h ${Math.floor((dailyCooldown % 3600) / 60)}m ${dailyCooldown % 60}s`
                      : selectedCase.price === 0
                      ? '🎁 Abrir Caixa Grátis'
                      : `Abrir Caixa — R$ ${selectedCase.price.toFixed(2)}`}
                  </motion.button>
                )}

                <div className={`relative ${!(rolling || showResult) ? 'invisible absolute pointer-events-none' : ''}`} style={!(rolling || showResult) ? { height: '165px' } : {}}>
                  <div ref={stripContainerRef} className="relative overflow-hidden rounded-xl border border-[#1a1d2d] bg-[#06070d] mb-4" style={{ height: '165px' }}>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent z-10" />
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-400/75 z-20 shadow-[0_0_10px_rgba(251,191,36,0.85)]" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                      <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-amber-400" />
                    </div>
                    <div
                      ref={stripInnerRef}
                      className="flex gap-2 items-center py-5 absolute"
                      style={{ transform: `translateX(${stripX}px)`, transition: 'none', willChange: 'transform' }}
                    >
                      {stripItems.map((item, i) => {
                        const rColor = rarityColor(item.rarityLevel);
                        const isWinner = result && i === animToken.current && !rolling;
                        const hideGoldTile = item.rarityLevel === 4 && !isWinner;
                        return (
                          <div
                            key={`s-${i}`}
                            className={`shrink-0 w-[100px] h-[118px] rounded-xl border-2 ${rColor.border} ${
                              hideGoldTile ? 'bg-gradient-to-b from-amber-500/25 via-yellow-500/10 to-[#090b13]' : rColor.bg
                            } p-1.5 flex flex-col items-center justify-between text-center ${
                              isWinner ? 'ring-2 ring-amber-400 scale-105' : ''
                            }`}
                            style={{ boxShadow: `0 0 ${isWinner ? '18' : '6'}px ${rColor.glow}` }}
                          >
                            {hideGoldTile ? (
                              <>
                                <div className="w-full h-14 flex items-center justify-center">
                                  <span className="text-3xl text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">★</span>
                                </div>
                                <div className="w-full">
                                  <div className="text-[7px] font-mono text-amber-200/80 uppercase">RARE SPECIAL</div>
                                  <div className="text-[9px] font-black text-amber-300 leading-tight">★ ITEM RARO ★</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-full h-14 flex items-center justify-center overflow-hidden">
                                  <CS2Image
                                    src={item.image}
                                    alt={item.name}
                                    className="max-h-14 max-w-full object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
                                    fallbackEmoji={item.rarityLevel === 4 ? '⭐' : '🔫'}
                                  />
                                </div>
                                <div className="w-full">
                                  <div className="text-[8px] font-mono text-slate-400 truncate">{item.weapon}</div>
                                  <div className={`text-[9px] font-bold ${rColor.text} truncate leading-tight`}>{item.name}</div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {showResult && result && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="omnitrix-panel rounded-2xl p-5 sm:p-6 text-center relative overflow-hidden"
                    >
                      {result.rarityLevel >= 1 && (
                        <div
                          className="gacha-light-beam opacity-65"
                          style={{ '--beam-color': rarityColor(result.rarityLevel).glow } as CSSProperties}
                        />
                      )}
                      <div className="relative z-10">
                        <div className="text-xs font-mono uppercase tracking-widest text-brand mb-2 flex items-center justify-center gap-1.5 flex-wrap">
                          <Sparkles className="w-3.5 h-3.5" /> Item Obtido!
                          {resultMeta?.isStatTrak && (
                            <span className="bg-orange-500/20 border border-orange-400/60 text-orange-300 font-black px-2 py-0.5 rounded-full text-[9px]">
                              StatTrak™ (+85%)
                            </span>
                          )}
                        </div>
                        <div className="flex justify-center mb-3">
                          <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className={`w-48 h-36 rounded-2xl border-2 flex items-center justify-center relative ${rarityColor(result.rarityLevel).border} ${rarityColor(result.rarityLevel).bg} holo-foil gacha-float p-3`}
                            style={{ boxShadow: `0 0 42px ${rarityColor(result.rarityLevel).glow}` }}
                          >
                            <CS2Image
                              src={result.image}
                              alt={result.name}
                              className="max-h-28 max-w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.75)]"
                              fallbackEmoji={result.rarityLevel === 4 ? '⭐' : '🔫'}
                            />
                          </motion.div>
                        </div>
                        <div className={`text-xs font-mono ${resultMeta?.isStatTrak ? 'text-orange-400 font-bold' : rarityColor(result.rarityLevel).text} opacity-90`}>
                          {resultMeta?.isStatTrak ? 'StatTrak™ ' : ''}{result.weapon}
                        </div>
                        <div className={`text-lg sm:text-xl font-extrabold font-display ${rarityColor(result.rarityLevel).text} leading-tight`}>
                          {result.name}
                        </div>
                        <div className={`text-xs ${rarityColor(result.rarityLevel).text} opacity-75 mt-0.5`}>
                          {rarityLabelShort(result.rarityLevel)}
                        </div>

                        {/* Barra de Float Spectrum */}
                        {resultMeta && (
                          <div className="max-w-xs mx-auto mt-3 bg-[#06070d]/90 border border-[#1a1d2d] rounded-xl p-2.5 text-left">
                            <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                              <span className="text-slate-300 font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-brand" /> {resultMeta.wearLabel} ({resultMeta.wearCode})
                              </span>
                              <span className="text-brand font-bold">Float: {resultMeta.floatValue.toFixed(4)}</span>
                            </div>
                            <div className="relative h-2 rounded-full overflow-hidden flex">
                              <div className="w-[7%] bg-emerald-400" />
                              <div className="w-[8%] bg-lime-400" />
                              <div className="w-[23%] bg-amber-400" />
                              <div className="w-[7%] bg-orange-500" />
                              <div className="flex-1 bg-rose-600" />
                              <div
                                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#fff]"
                                style={{ left: `${Math.min(98, Math.max(1, resultMeta.floatValue * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="text-xl font-black font-mono mt-2.5 text-brand">R$ {resultPrice.toFixed(2)}</div>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={handleSellNow}
                            className="flex-1 min-w-[130px] py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 rounded-xl text-xs font-black hover:from-yellow-400 hover:to-amber-400 transition-all cursor-pointer"
                          >
                            Vender por R$ {resultPrice.toFixed(2)}
                          </button>
                          <button
                            onClick={handleKeep}
                            className="flex-1 min-w-[130px] py-2.5 bg-brand hover:bg-[#00e074] text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer"
                          >
                            Guardar no Inventário
                          </button>
                          {selectedCase.price > 0 && balance >= selectedCase.price && (
                            <button
                              onClick={() => {
                                handleKeep();
                                setTimeout(() => openCase(), 40);
                              }}
                              className="w-full py-2.5 bg-[#121625] hover:bg-[#1a2036] text-orange-300 border border-orange-500/40 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                            >
                              🔄 Guardar & Girar de Novo (R$ {selectedCase.price.toFixed(2)})
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Conteúdo da Caixa</h5>
                {[4, 3, 2, 1, 0].map((level) => {
                  const items = selectedCase.items.filter((s) => s.rarityLevel === level);
                  if (items.length === 0) return null;
                  const rColor = rarityColor(level);
                  return (
                    <div key={level} className="mb-3">
                      <div className={`text-[11px] font-bold ${rColor.text} mb-1.5 flex items-center gap-1.5`}>
                        <span className={`w-2 h-2 rounded-full ${level === 0 ? 'bg-blue-500' : level === 1 ? 'bg-purple-500' : level === 2 ? 'bg-pink-500' : level === 3 ? 'bg-red-500' : 'bg-yellow-400'}`} />
                        {rarityLabel(level)}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {items.map((s) => {
                          const owned = collection.some((c) => c.setSeries === 'CS2' && (c.id === s.id || c.id.startsWith(`${s.id}_`)));
                          return (
                            <div
                              key={s.id}
                              className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-xl border ${rColor.border} ${rColor.bg} ${owned ? 'ring-1 ring-brand/40' : ''}`}
                            >
                              <div className="w-9 h-7 flex items-center justify-center shrink-0 overflow-hidden">
                                <CS2Image src={s.image} alt={s.name} className="w-9 h-7 object-contain" fallbackEmoji={level === 4 ? '⭐' : '🔫'} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[8px] font-mono text-slate-400 truncate">{s.weapon}</div>
                                <div className={`font-bold truncate ${rColor.text}`}>{s.name}</div>
                              </div>
                              {owned && <span className="text-brand font-bold shrink-0">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar skin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0e16] border border-[#1a1d2d] rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/40"
                />
              </div>
              <button
                onClick={() => setRarityFilter(null)}
                className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  rarityFilter === null ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d]'
                }`}
              >
                Todas
              </button>
              {[
                { level: 0, label: 'Azul', color: 'text-blue-400' },
                { level: 1, label: 'Roxa', color: 'text-purple-400' },
                { level: 2, label: 'Rosa', color: 'text-pink-400' },
                { level: 3, label: 'Vermelha', color: 'text-red-400' },
                { level: 4, label: '★ Ouro', color: 'text-amber-300' },
              ].map((r) => (
                <button
                  key={r.level}
                  onClick={() => setRarityFilter(rarityFilter === r.level ? null : r.level)}
                  className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${r.color} ${
                    rarityFilter === r.level ? 'bg-white/10 border-white/25' : 'bg-[#0d0e16] border-[#1a1d2d]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {filteredCollection.length === 0 ? (
              <div className="omnitrix-card rounded-2xl text-center py-12 text-slate-500 text-sm">Nenhuma skin no inventário</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredCollection.map((card) => {
                  const rarMap: Record<string, number> = {
                    'Mil-Spec (Azul)': 0, 'Restricted (Roxa)': 1,
                    'Classified (Rosa)': 2, 'Covert (Vermelha)': 3, 'Rare Special (Ouro)': 4,
                  };
                  const level = rarMap[card.rarity] ?? 0;
                  const rColor = rarityColor(level);
                  const price = prices[card.id] ?? 1;
                  const img = resolveCardImage(card);
                  const isST = card.name.includes('StatTrak™');
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      className={`bg-[#090b13] border ${rColor.border} rounded-xl p-3 text-center holo-foil flex flex-col justify-between relative`}
                      style={{ boxShadow: `0 0 12px ${rColor.glow}` }}
                    >
                      {isST && (
                        <span className="absolute top-2 left-2 text-[7px] font-mono font-black px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-400/50 text-orange-300">
                          ST™
                        </span>
                      )}
                      <div className="h-20 flex items-center justify-center mb-1.5">
                        <CS2Image src={img} alt={card.name} className="max-h-20 max-w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]" fallbackEmoji={level === 4 ? '⭐' : '🔫'} />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-slate-400 truncate">{card.name.split(' | ')[0]}</div>
                        <div className="text-xs font-bold text-white truncate">{card.name.split(' | ')[1] || card.name}</div>
                        <div className={`text-[9px] font-semibold mt-0.5 ${rColor.text}`}>{rarityLabelShort(level)}</div>
                        <div className="text-xs font-mono font-bold mt-1 text-brand">R$ {price.toFixed(2)}</div>
                        {card.quantity > 1 && <div className="text-[10px] text-slate-400 mt-0.5">×{card.quantity}</div>}
                        {card.quantity > 1 && (
                          <button
                            onClick={() => handleSellSingle(card)}
                            className="mt-2 w-full py-1 bg-[#161927] text-slate-200 rounded-lg text-[10px] font-bold hover:bg-brand hover:text-slate-950 transition-all cursor-pointer border border-[#2a2d3d]"
                          >
                            Vender 1x R$ {price.toFixed(2)}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="omnitrix-panel rounded-2xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-white">Mercado de Skins CS2</div>
                <TrendingUp className="w-4 h-4 text-brand" />
              </div>
              <p className="text-[10px] text-slate-400">Preços dinâmicos atualizam a cada 25s</p>
              {collection.filter((c) => c.setSeries === 'CS2' && c.quantity > 1).length > 0 && (
                <button
                  onClick={handleSellAllDups}
                  className="mt-3 w-full py-2.5 bg-brand/15 border border-brand/35 text-brand rounded-xl text-xs font-bold hover:bg-brand hover:text-slate-950 transition-all cursor-pointer"
                >
                  Vender Todas Repetidas
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {collection.filter((c) => c.setSeries === 'CS2' && c.quantity > 1).map((card) => {
                const rarMap: Record<string, number> = {
                  'Mil-Spec (Azul)': 0, 'Restricted (Roxa)': 1,
                  'Classified (Rosa)': 2, 'Covert (Vermelha)': 3, 'Rare Special (Ouro)': 4,
                };
                const level = rarMap[card.rarity] ?? 0;
                const rColor = rarityColor(level);
                const price = prices[card.id] ?? 1;
                const img = resolveCardImage(card);
                return (
                  <div
                    key={card.id}
                    className={`bg-[#090b13] border ${rColor.border} rounded-xl p-3 text-center`}
                    style={{ boxShadow: `0 0 8px ${rColor.glow}` }}
                  >
                    <div className="h-16 flex items-center justify-center mb-1">
                      <CS2Image src={img} alt={card.name} className="max-h-16 object-contain" fallbackEmoji={level === 4 ? '⭐' : '🔫'} />
                    </div>
                    <div className={`text-[10px] font-mono ${rColor.text} truncate`}>{card.name.split(' | ')[0]}</div>
                    <div className="text-xs font-bold text-white truncate">{card.name.split(' | ')[1] || card.name}</div>
                    <div className="text-xs font-mono font-bold mt-1 text-brand">R$ {price.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{card.quantity - 1} repetidas</div>
                    <button
                      onClick={() => handleSellSingle(card)}
                      className="mt-2 w-full py-1.5 bg-[#1a1d2d] text-slate-200 rounded-lg text-[10px] font-bold hover:bg-brand hover:text-slate-950 transition-all cursor-pointer border border-[#2a2d3d]"
                    >
                      Vender 1x R$ {price.toFixed(2)}
                    </button>
                  </div>
                );
              })}
              {collection.filter((c) => c.setSeries === 'CS2' && c.quantity > 1).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">Nenhuma skin repetida para vender</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === 'collection' && (
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((level) => {
            const rColor = rarityColor(level);
            const pct = rarityCounts[level].total > 0 ? Math.round((rarityCounts[level].collected / rarityCounts[level].total) * 100) : 0;
            return (
              <div key={level} className="bg-[#0a0c14] border border-[#1a1d2d] rounded-xl p-2.5 sm:p-3">
                <div className={`text-[9px] sm:text-[10px] font-bold truncate ${rColor.text}`}>{rarityLabelShort(level)}</div>
                <div className="text-sm sm:text-lg font-black font-mono text-white mt-0.5">{rarityCounts[level].collected}/{rarityCounts[level].total}</div>
                <div className="w-full h-1.5 bg-[#1a1d2d] rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${level === 0 ? 'bg-blue-500' : level === 1 ? 'bg-purple-500' : level === 2 ? 'bg-pink-500' : level === 3 ? 'bg-red-500' : 'bg-gradient-to-r from-yellow-500 to-amber-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
