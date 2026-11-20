import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Star, Search, Loader2, ShieldCheck, Coins, Flame, Layers, Eye, EyeOff } from 'lucide-react';
import type { PlacedBet, PokemonCard } from '../types';
import { useSound } from '../hooks/useSound';

interface GenshinItem {
  id: string;
  name: string;
  rank: 3 | 4 | 5;
  kind: 'character' | 'weapon';
  element?: string;
  weaponType?: string;
  region?: string;
  splashUrl: string;
  iconUrl: string;
  isStandard5?: boolean;
  isArchon?: boolean;
  price: number;
}

interface GenshinGachaProps {
  balance: number;
  onUpdateBalance: (delta: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

const CATALOG_CACHE_KEY = 'benbets_genshin_catalog_v1';
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

// 10× Real BRL Pricing (Real 1 Wish ≈ R$ 11,00 -> 10× = R$ 110,00)
const WISH_1_PRICE = 110;
const WISH_10_PRICE = 1000;

const STANDARD_5_NAMES = new Set([
  'diluc', 'jean', 'mona', 'qiqi', 'keqing', 'tighnari', 'dehya', 'yumemizuki mizuki', 'mizuki',
]);

const ARCHON_FEATURED_NAMES = new Set([
  'venti', 'zhongli', 'shogun raiden', 'raiden shogun', 'nahida', 'furina', 'mavuika',
  'neuvillette', 'arlecchino', 'hu tao', 'kaedehara kazuha', 'kazuha', 'xiao', 'ganyu', 'yelan', 'clorinde', 'skirk',
]);

const ELEMENT_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  Fire: { label: 'Pyro', emoji: '🔥', color: 'text-orange-300', bg: 'bg-orange-500/15 border-orange-500/35' },
  Water: { label: 'Hydro', emoji: '💧', color: 'text-sky-300', bg: 'bg-sky-500/15 border-sky-500/35' },
  Electric: { label: 'Electro', emoji: '⚡', color: 'text-purple-300', bg: 'bg-purple-500/15 border-purple-500/35' },
  Wind: { label: 'Anemo', emoji: '🍃', color: 'text-teal-300', bg: 'bg-teal-500/15 border-teal-500/35' },
  Rock: { label: 'Geo', emoji: '🪨', color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/35' },
  Ice: { label: 'Cryo', emoji: '❄️', color: 'text-cyan-200', bg: 'bg-cyan-500/15 border-cyan-500/35' },
  Grass: { label: 'Dendro', emoji: '🌿', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/35' },
};

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function computeGenshinPrice(
  id: string,
  rank: 3 | 4 | 5,
  kind: 'character' | 'weapon',
  isStandard5: boolean,
  isArchon: boolean
): number {
  const h = (hashString(id) % 1000) / 1000;
  if (rank === 3) {
    return Math.round(35 + h * 20); // R$ 35 - R$ 55
  }
  if (rank === 4) {
    if (kind === 'character') return Math.round(350 + h * 100); // R$ 350 - R$ 450
    return Math.round(280 + h * 80); // R$ 280 - R$ 360
  }
  // 5★ (10× real value)
  if (isArchon) return Math.round(8200 + h * 1300); // R$ 8.200 - R$ 9.500
  if (kind === 'character' && !isStandard5) return Math.round(5500 + h * 2300); // R$ 5.500 - R$ 7.800
  return Math.round(2800 + h * 1400); // R$ 2.800 - R$ 4.200 (5★ Padrão / Arma 5★)
}

const FALLBACK_ITEMS: GenshinItem[] = [
  {
    id: 'gi-char-10000089',
    name: 'Furina',
    rank: 5,
    kind: 'character',
    element: 'Water',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Furina.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Furina.png',
    isStandard5: false,
    isArchon: true,
    price: 9200,
  },
  {
    id: 'gi-char-10000052',
    name: 'Shogun Raiden',
    rank: 5,
    kind: 'character',
    element: 'Electric',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Shougun.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Shougun.png',
    isStandard5: false,
    isArchon: true,
    price: 9400,
  },
  {
    id: 'gi-char-10000030',
    name: 'Zhongli',
    rank: 5,
    kind: 'character',
    element: 'Rock',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Zhongli.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Zhongli.png',
    isStandard5: false,
    isArchon: true,
    price: 8900,
  },
  {
    id: 'gi-char-10000073',
    name: 'Nahida',
    rank: 5,
    kind: 'character',
    element: 'Grass',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Nahida.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Nahida.png',
    isStandard5: false,
    isArchon: true,
    price: 9100,
  },
  {
    id: 'gi-char-10000096',
    name: 'Arlecchino',
    rank: 5,
    kind: 'character',
    element: 'Fire',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Arlecchino.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Arlecchino.png',
    isStandard5: false,
    isArchon: true,
    price: 9350,
  },
  {
    id: 'gi-char-10000087',
    name: 'Neuvillette',
    rank: 5,
    kind: 'character',
    element: 'Water',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Neuvillette.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Neuvillette.png',
    isStandard5: false,
    isArchon: true,
    price: 9250,
  },
  {
    id: 'gi-char-10000016',
    name: 'Diluc',
    rank: 5,
    kind: 'character',
    element: 'Fire',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Diluc.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Diluc.png',
    isStandard5: true,
    isArchon: false,
    price: 3600,
  },
  {
    id: 'gi-char-10000035',
    name: 'Qiqi',
    rank: 5,
    kind: 'character',
    element: 'Ice',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Qiqi.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Qiqi.png',
    isStandard5: true,
    isArchon: false,
    price: 2950,
  },
  {
    id: 'gi-char-10000032',
    name: 'Bennett',
    rank: 4,
    kind: 'character',
    element: 'Fire',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Bennett.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Bennett.png',
    price: 440,
  },
  {
    id: 'gi-char-10000025',
    name: 'Xingqiu',
    rank: 4,
    kind: 'character',
    element: 'Water',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Xingqiu.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Xingqiu.png',
    price: 420,
  },
  {
    id: 'gi-char-10000023',
    name: 'Xiangling',
    rank: 4,
    kind: 'character',
    element: 'Fire',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Xiangling.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Xiangling.png',
    price: 410,
  },
  {
    id: 'gi-char-10000031',
    name: 'Fischl',
    rank: 4,
    kind: 'character',
    element: 'Electric',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_Fischl.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_AvatarIcon_Fischl.png',
    price: 400,
  },
  {
    id: 'gi-weap-11301',
    name: 'Espada Fria',
    rank: 3,
    kind: 'weapon',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Sword_Steel.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Sword_Steel.png',
    price: 45,
  },
  {
    id: 'gi-weap-12301',
    name: 'Clava do Debate',
    rank: 3,
    kind: 'weapon',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Claymore_Reasoning.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Claymore_Reasoning.png',
    price: 42,
  },
  {
    id: 'gi-weap-15301',
    name: 'Arco do Corvo',
    rank: 3,
    kind: 'weapon',
    splashUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Bow_Crowfeather.png',
    iconUrl: 'https://gi.yatta.moe/assets/UI/UI_EquipIcon_Bow_Crowfeather.png',
    price: 48,
  },
];

function GenshinArtwork({
  splashUrl,
  iconUrl,
  alt,
  className,
  preferSplash = true,
}: {
  splashUrl: string;
  iconUrl: string;
  alt: string;
  className?: string;
  preferSplash?: boolean;
}) {
  const candidates = useMemo(() => {
    const arr = preferSplash ? [splashUrl, iconUrl] : [iconUrl, splashUrl];
    return Array.from(new Set(arr.filter(Boolean)));
  }, [splashUrl, iconUrl, preferSplash]);

  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [splashUrl, iconUrl, preferSplash]);

  if (idx >= candidates.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-3xl select-none text-amber-300/70">
        ✦
      </div>
    );
  }

  return (
    <img
      src={candidates[idx]}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((p) => p + 1)}
    />
  );
}

interface PityState {
  pity5: number;
  pity4: number;
  guaranteed5: boolean;
  totalWishes: number;
}

export default function GenshinGacha({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  userId,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: GenshinGachaProps) {
  const { play } = useSound();
  const [catalog, setCatalog] = useState<GenshinItem[]>(FALLBACK_ITEMS);
  const [loadingApi, setLoadingApi] = useState(true);
  const [apiCount, setApiCount] = useState<{ chars: number; weapons: number }>({ chars: 0, weapons: 0 });
  const [activeTab, setActiveTab] = useState<'wish' | 'collection'>('wish');
  const [bannerType, setBannerType] = useState<'limited' | 'standard'>('limited');

  // Pity state persisted per user
  const pityStorageKey = `benbets_genshin_pity_${userId || 'guest'}`;
  const [pity, setPity] = useState<PityState>(() => {
    try {
      const raw = localStorage.getItem(pityStorageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { pity5: 0, pity4: 0, guaranteed5: false, totalWishes: 0 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(pityStorageKey, JSON.stringify(pity));
    } catch { /* ignore */ }
  }, [pity, pityStorageKey]);

  // Wish animation & results
  const [isRolling, setIsRolling] = useState(false);
  const [meteorRank, setMeteorRank] = useState<3 | 4 | 5 | null>(null);
  const [lastResults, setLastResults] = useState<GenshinItem[]>([]);
  const [soldInResultIds, setSoldInResultIds] = useState<Set<number>>(new Set());

  // Collection filters
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | '5' | '4' | '3'>('all');
  const [elementFilter, setElementFilter] = useState<string>('all');
  const [showMissing, setShowMissing] = useState(false);

  // Load official Genshin API from gi.yatta.moe (pt-BR)
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const cachedRaw = localStorage.getItem(CATALOG_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.ts && Date.now() - cached.ts < CATALOG_TTL_MS && Array.isArray(cached.items) && cached.items.length > 50) {
            if (!cancelled) {
              setCatalog(cached.items);
              setApiCount(cached.counts || { chars: 0, weapons: 0 });
              setLoadingApi(false);
            }
            return;
          }
        }
      } catch { /* ignore cache errors */ }

      try {
        const [avatarRes, weaponRes] = await Promise.all([
          fetch('https://gi.yatta.moe/api/v2/pt/avatar'),
          fetch('https://gi.yatta.moe/api/v2/pt/weapon'),
        ]);
        const [avatarJson, weaponJson] = await Promise.all([avatarRes.json(), weaponRes.json()]);

        const items: GenshinItem[] = [];
        let charCount = 0;
        let weapCount = 0;

        const avatarItems = Object.values(avatarJson?.data?.items || {}) as any[];
        for (const a of avatarItems) {
          const idStr = String(a?.id || '');
          // Skip Traveler variants & Manekin/test entries
          if (!idStr || idStr.startsWith('10000005') || idStr.startsWith('10000007') || !a?.icon || !a?.name) continue;
          const rankNum = Number(a.rank);
          if (rankNum !== 4 && rankNum !== 5) continue;
          const rank = rankNum as 4 | 5;
          const lowerName = String(a.name).toLowerCase();
          const isStandard5 = rank === 5 && STANDARD_5_NAMES.has(lowerName);
          const isArchon = rank === 5 && ARCHON_FEATURED_NAMES.has(lowerName);
          const icon = String(a.icon);
          const splashIcon = icon.startsWith('UI_AvatarIcon_')
            ? icon.replace('UI_AvatarIcon_', 'UI_Gacha_AvatarImg_')
            : icon;
          const itemId = `gi-char-${idStr}`;
          items.push({
            id: itemId,
            name: String(a.name),
            rank,
            kind: 'character',
            element: a.element ? String(a.element) : undefined,
            weaponType: a.weaponType ? String(a.weaponType) : undefined,
            region: a.region ? String(a.region) : undefined,
            splashUrl: `https://gi.yatta.moe/assets/UI/${splashIcon}.png`,
            iconUrl: `https://gi.yatta.moe/assets/UI/${icon}.png`,
            isStandard5,
            isArchon,
            price: computeGenshinPrice(itemId, rank, 'character', isStandard5, isArchon),
          });
          charCount += 1;
        }

        const weaponItems = Object.values(weaponJson?.data?.items || {}) as any[];
        for (const w of weaponItems) {
          const idStr = String(w?.id || '');
          const rankNum = Number(w?.rank);
          if (!idStr || !w?.icon || !w?.name || (rankNum !== 3 && rankNum !== 4 && rankNum !== 5)) continue;
          const rank = rankNum as 3 | 4 | 5;
          const itemId = `gi-weap-${idStr}`;
          const imgUrl = `https://gi.yatta.moe/assets/UI/${String(w.icon)}.png`;
          items.push({
            id: itemId,
            name: String(w.name),
            rank,
            kind: 'weapon',
            weaponType: w.type ? String(w.type) : undefined,
            splashUrl: imgUrl,
            iconUrl: imgUrl,
            isStandard5: rank === 5,
            isArchon: false,
            price: computeGenshinPrice(itemId, rank, 'weapon', rank === 5, false),
          });
          weapCount += 1;
        }

        if (!cancelled && items.length > 30) {
          setCatalog(items);
          setApiCount({ chars: charCount, weapons: weapCount });
          try {
            localStorage.setItem(
              CATALOG_CACHE_KEY,
              JSON.stringify({ ts: Date.now(), items, counts: { chars: charCount, weapons: weapCount } })
            );
          } catch { /* quota */ }
        }
      } catch (err) {
        console.warn('[GenshinGacha] Falha ao buscar gi.yatta.moe, usando fallback:', err);
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pools by rank & type
  const pools = useMemo(() => {
    const chars5Limited = catalog.filter((i) => i.rank === 5 && i.kind === 'character' && !i.isStandard5);
    const chars5Standard = catalog.filter((i) => i.rank === 5 && i.kind === 'character' && i.isStandard5);
    const weapons5 = catalog.filter((i) => i.rank === 5 && i.kind === 'weapon');
    const items4 = catalog.filter((i) => i.rank === 4);
    const chars4 = items4.filter((i) => i.kind === 'character');
    const weapons3 = catalog.filter((i) => i.rank === 3);
    const featuredArchons = chars5Limited.filter((i) => i.isArchon);
    return {
      chars5Limited: chars5Limited.length ? chars5Limited : catalog.filter((i) => i.rank === 5),
      chars5Standard: chars5Standard.length ? chars5Standard : catalog.filter((i) => i.rank === 5),
      weapons5: weapons5.length ? weapons5 : catalog.filter((i) => i.rank === 5),
      items4: items4.length ? items4 : catalog.filter((i) => i.rank === 4),
      chars4: chars4.length ? chars4 : items4,
      weapons3: weapons3.length ? weapons3 : FALLBACK_ITEMS.filter((i) => i.rank === 3),
      featuredArchons: featuredArchons.length ? featuredArchons : chars5Limited.slice(0, 6),
    };
  }, [catalog]);

  const catalogById = useMemo(() => {
    const map = new Map<string, GenshinItem>();
    for (const item of catalog) map.set(item.id, item);
    return map;
  }, [catalog]);

  const collectionMap = useMemo(() => {
    const map = new Map<string, PokemonCard>();
    for (const c of collection) map.set(c.id, c);
    return map;
  }, [collection]);

  const priceLookup = useMemo(() => {
    const rec: Record<string, number> = {};
    for (const item of catalog) rec[item.id] = item.price;
    for (const c of collection) {
      if (!rec[c.id]) {
        const rank = c.rarity.includes('5★') ? 5 : c.rarity.includes('4★') ? 4 : 3;
        rec[c.id] = computeGenshinPrice(c.id, rank as 3 | 4 | 5, c.setSeries === 'Personagem' ? 'character' : 'weapon', false, false);
      }
    }
    return rec;
  }, [catalog, collection]);

  const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const rollOne = useCallback(
    (curPity: PityState): { item: GenshinItem; nextPity: PityState } => {
      const nextPity5 = curPity.pity5 + 1;
      const nextPity4 = curPity.pity4 + 1;

      // Official Genshin 5★ soft pity (starts at 74, +6% per roll, 100% at 90)
      let rate5 = 0.006;
      if (nextPity5 >= 90) rate5 = 1;
      else if (nextPity5 >= 74) rate5 = Math.min(1, 0.006 + (nextPity5 - 73) * 0.06);

      // Official Genshin 4★ rate (5.1%, guaranteed at 10)
      const rate4 = nextPity4 >= 10 ? 1 : 0.051;

      const r = Math.random();
      if (r < rate5) {
        // 5★ Pull!
        let picked: GenshinItem;
        let nextGuaranteed = curPity.guaranteed5;
        if (bannerType === 'limited') {
          if (curPity.guaranteed5 || Math.random() < 0.5) {
            // Won 50/50 or guaranteed! Higher weight for Archons/Featured
            picked = Math.random() < 0.35 && pools.featuredArchons.length
              ? pickRandom(pools.featuredArchons)
              : pickRandom(pools.chars5Limited);
            nextGuaranteed = false;
          } else {
            // Lost 50/50 to Standard 5★ -> next 5★ is Guaranteed!
            picked = pickRandom(pools.chars5Standard);
            nextGuaranteed = true;
          }
        } else {
          // Standard Banner: 50% Standard Char / 50% 5★ Weapon
          picked = Math.random() < 0.5 ? pickRandom(pools.chars5Standard) : pickRandom(pools.weapons5);
        }
        return {
          item: picked,
          nextPity: {
            pity5: 0,
            pity4: nextPity4 >= 10 ? 0 : nextPity4,
            guaranteed5: nextGuaranteed,
            totalWishes: curPity.totalWishes + 1,
          },
        };
      }

      if (r < rate5 + rate4) {
        // 4★ Pull! (65% character / 35% weapon)
        const picked: GenshinItem = Math.random() < 0.65 && pools.chars4.length ? pickRandom<GenshinItem>(pools.chars4) : pickRandom<GenshinItem>(pools.items4);
        return {
          item: picked,
          nextPity: {
            pity5: nextPity5,
            pity4: 0,
            guaranteed5: curPity.guaranteed5,
            totalWishes: curPity.totalWishes + 1,
          },
        };
      }

      // 3★ Weapon
      return {
        item: pickRandom(pools.weapons3),
        nextPity: {
          pity5: nextPity5,
          pity4: nextPity4,
          guaranteed5: curPity.guaranteed5,
          totalWishes: curPity.totalWishes + 1,
        },
      };
    },
    [bannerType, pools]
  );

  const handleWish = (count: 1 | 10) => {
    const cost = count === 10 ? WISH_10_PRICE : WISH_1_PRICE;
    if (isRolling || balance < cost) return;

    onUpdateBalance(-cost);
    setIsRolling(true);
    setSoldInResultIds(new Set());
    setLastResults([]);

    let state = { ...pity };
    const rolled: GenshinItem[] = [];
    for (let i = 0; i < count; i++) {
      const res = rollOne(state);
      rolled.push(res.item);
      state = res.nextPity;
    }

    // Sort results: highest rarity first for dramatic reveal
    rolled.sort((a, b) => b.rank - a.rank || b.price - a.price);
    const highestRank = (rolled[0]?.rank || 3) as 3 | 4 | 5;
    setMeteorRank(highestRank);
    setPity(state);

    if (highestRank === 5) play('bigwin');
    else if (highestRank === 4) play('win');
    else play('spin');

    // Convert to PokemonCard format for Firestore persistence
    const cardsToAdd: PokemonCard[] = rolled.map((item) => ({
      id: item.id,
      name: item.name,
      imageUrl: item.iconUrl,
      rarity: item.rank === 5 ? (item.isArchon ? '5★ Arconte' : item.isStandard5 ? '5★ Padrão' : '5★ Limitado') : item.rank === 4 ? '4★ Épico' : '3★ Raro',
      setName: item.element ? ELEMENT_META[item.element]?.label || item.element : 'Arma',
      setSeries: item.kind === 'character' ? 'Personagem' : 'Arma',
      quantity: 1,
    }));

    const totalValue = rolled.reduce((sum, x) => sum + x.price, 0);

    setTimeout(() => {
      setIsRolling(false);
      setMeteorRank(null);
      setLastResults(rolled);
      onCollectionUpdate(cardsToAdd);

      if (onAddBetHistory) {
        onAddBetHistory({
          id: `genshin-${Date.now()}`,
          matchName: `Genshin Wish (${count}× ${bannerType === 'limited' ? 'Limitado' : 'Mochileiro'})`,
          selectionName: rolled[0] ? `Destaque: ${rolled[0].name} (${rolled[0].rank}★)` : `${count}× Orações`,
          odds: Number((totalValue / cost).toFixed(2)),
          stake: cost,
          potentialPayout: totalValue,
          status: totalValue >= cost ? 'won' : 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          type: 'casino',
          outcomeValue: `R$ ${totalValue.toLocaleString('pt-BR')}`,
        });
      }
    }, 1350);
  };

  const handleQuickSellResult = (item: GenshinItem, idx: number) => {
    if (soldInResultIds.has(idx)) return;
    setSoldInResultIds((prev) => new Set(prev).add(idx));
    onSellCard(item.id, item.price);
    play('cashout');
  };

  const duplicatesInfo = useMemo(() => {
    let count = 0;
    let totalValue = 0;
    for (const c of collection) {
      if (c.quantity > 1) {
        const extra = c.quantity - 1;
        count += extra;
        totalValue += (priceLookup[c.id] || 40) * extra;
      }
    }
    return { count, totalValue };
  }, [collection, priceLookup]);

  const filteredCollectionItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = showMissing
      ? catalog
      : catalog.filter((item) => collectionMap.has(item.id));

    return list
      .filter((item) => {
        if (rarityFilter !== 'all' && String(item.rank) !== rarityFilter) return false;
        if (elementFilter === 'weapon' && item.kind !== 'weapon') return false;
        if (elementFilter !== 'all' && elementFilter !== 'weapon' && item.element !== elementFilter) return false;
        if (q && !item.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ownedA = collectionMap.has(a.id) ? 1 : 0;
        const ownedB = collectionMap.has(b.id) ? 1 : 0;
        if (ownedA !== ownedB) return ownedB - ownedA;
        if (b.rank !== a.rank) return b.rank - a.rank;
        return b.price - a.price;
      });
  }, [catalog, collectionMap, search, rarityFilter, elementFilter, showMissing]);

  const totalCollectionValue = useMemo(() => {
    return collection.reduce((sum, c) => sum + (priceLookup[c.id] || 40) * c.quantity, 0);
  }, [collection, priceLookup]);

  const featuredShowcase = pools.featuredArchons.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#0e1328] via-[#131836] to-[#0a0e1d] p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.16),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.14),transparent_55%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-2xl shadow-[0_0_24px_rgba(251,191,36,0.25)] shrink-0">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black font-display text-white">
                  Genshin Impact — Orações
                </h2>
                <span className="text-[9px] font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/35 px-2 py-0.5 rounded-full">
                  10× Valor Real
                </span>
                <span className="text-[9px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full">
                  {loadingApi ? 'Sincronizando API...' : `API Yatta • ${apiCount.chars || catalog.filter((x) => x.kind === 'character').length} Personagens + ${apiCount.weapons || catalog.filter((x) => x.kind === 'weapon').length} Armas`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300/90 mt-0.5">
                Pity oficial (4★ em 10 • Soft Pity 5★ em 74 • Hard Pity 90 • 50/50 Garantido) com artes HD oficiais.
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1.5 bg-[#070a14] p-1 rounded-xl border border-white/10 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('wish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'wish'
                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Orações
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collection')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'collection'
                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Coleção ({collection.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'wish' ? (
        <div className="space-y-4">
          {/* Banner Selector & Pity HUD */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => setBannerType('limited')}
                className={`flex-1 rounded-xl p-3 border text-left transition-all cursor-pointer ${
                  bannerType === 'limited'
                    ? 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 border-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                    : 'bg-[#0b0e1b] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300">✦ Oração de Evento (Limitado)</span>
                  <span className="text-[9px] font-mono bg-amber-400/15 text-amber-200 px-1.5 py-0.5 rounded">
                    Até R$ 9.500
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Arcontes e Personagens 5★ Limitados com sistema 50/50 Garantido.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBannerType('standard')}
                className={`flex-1 rounded-xl p-3 border text-left transition-all cursor-pointer ${
                  bannerType === 'standard'
                    ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                    : 'bg-[#0b0e1b] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-300">🌌 Oração Comum (Mochileiro)</span>
                  <span className="text-[9px] font-mono bg-sky-400/15 text-sky-200 px-1.5 py-0.5 rounded">
                    5★ Chars & Armas
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Personagens 5★ Padrão e Armas 5★ Lendárias de Teyvat.
                </p>
              </button>
            </div>

            {/* Pity Counter Box */}
            <div className="rounded-xl bg-[#090c18] border border-white/10 p-3 flex flex-col justify-center gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Pity 5★ {pity.pity5 >= 74 && <span className="text-amber-300 font-bold">(SOFT PITY!)</span>}</span>
                <span className="font-mono font-black text-amber-300">{pity.pity5} / 90</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all ${pity.pity5 >= 74 ? 'bg-gradient-to-r from-amber-400 to-rose-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, (pity.pity5 / 90) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Pity 4★: <strong className="text-purple-300 font-mono">{pity.pity4}/10</strong></span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${pity.guaranteed5 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-300'}`}>
                  {pity.guaranteed5 ? '✓ 5★ Garantido' : '50/50 Ativo'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Banner Visual Showcase */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#111633] via-[#0c1024] to-[#080a16] p-4 sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.14),transparent_65%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                  {bannerType === 'limited' ? '✦ Destaques 5★ Arcontes & Limitados' : '🌌 Pool Mochileiro Oficial'}
                </span>
                {loadingApi && <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />}
              </div>

              {/* Showcase Splash Characters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-3xl mb-5">
                {featuredShowcase.map((char) => {
                  const elem = char.element ? ELEMENT_META[char.element] : null;
                  return (
                    <div
                      key={char.id}
                      className="relative rounded-xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 via-[#0e1328] to-[#070a14] p-2.5 overflow-hidden flex flex-col items-center text-center group"
                    >
                      <div className="w-24 h-24 sm:w-28 sm:h-28 relative flex items-center justify-center">
                        <GenshinArtwork
                          splashUrl={char.splashUrl}
                          iconUrl={char.iconUrl}
                          alt={char.name}
                          className="w-full h-full object-contain drop-shadow-[0_0_16px_rgba(251,191,36,0.35)] group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="text-xs font-extrabold text-white truncate w-full mt-1">{char.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-amber-300">★★★★★</span>
                        {elem && <span className={`text-[9px] font-mono ${elem.color}`}>{elem.emoji} {elem.label}</span>}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-300 mt-1">
                        R$ {char.price.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Wish Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  disabled={isRolling || balance < WISH_1_PRICE}
                  onClick={() => handleWish(1)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-45 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm shadow-[0_0_24px_rgba(56,189,248,0.3)] transition-all cursor-pointer flex items-center gap-2"
                >
                  <Star className="w-4 h-4 fill-current" />
                  <span>1× Oração</span>
                  <span className="font-mono bg-black/25 px-2 py-0.5 rounded-lg text-[11px]">
                    R$ {WISH_1_PRICE.toLocaleString('pt-BR')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isRolling || balance < WISH_10_PRICE}
                  onClick={() => handleWish(10)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_28px_rgba(251,191,36,0.4)] transition-all cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>10× Orações (4★+ Garantido)</span>
                  <span className="font-mono bg-black/15 px-2 py-0.5 rounded-lg text-[11px]">
                    R$ {WISH_10_PRICE.toLocaleString('pt-BR')}
                  </span>
                </button>
              </div>

              {/* Odds & 10x Pricing Legend */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-400">
                <span><strong className="text-amber-300">5★:</strong> 0,6% (R$ 2.800–9.500)</span>
                <span><strong className="text-purple-300">4★:</strong> 5,1% (R$ 280–450)</span>
                <span><strong className="text-sky-300">3★:</strong> 94,3% (R$ 35–55)</span>
                <span className="text-emerald-300/90"><ShieldCheck className="w-3 h-3 inline mr-0.5" />10× valor real</span>
              </div>
            </div>

            {/* Meteor Wish Animation Overlay */}
            <AnimatePresence>
              {isRolling && meteorRank && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 bg-[#040610]/95 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden"
                >
                  <motion.div
                    initial={{ x: -220, y: -160, scale: 0.4, opacity: 0 }}
                    animate={{ x: 0, y: 0, scale: [0.6, 1.35, 1.1], opacity: 1 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl ${
                      meteorRank === 5
                        ? 'bg-amber-400/25 border-2 border-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.95)] text-amber-200'
                        : meteorRank === 4
                          ? 'bg-purple-500/25 border-2 border-purple-300 shadow-[0_0_70px_rgba(168,85,247,0.9)] text-purple-200'
                          : 'bg-sky-500/25 border-2 border-sky-300 shadow-[0_0_60px_rgba(56,189,248,0.85)] text-sky-200'
                    }`}
                  >
                    ✦
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className={`mt-4 text-sm sm:text-base font-black tracking-widest uppercase ${
                      meteorRank === 5 ? 'text-amber-300' : meteorRank === 4 ? 'text-purple-300' : 'text-sky-300'
                    }`}
                  >
                    {meteorRank === 5 ? '★★★★★ ESTRELA DOURADA!' : meteorRank === 4 ? '★★★★ ESTRELA ROXA!' : '★★★ INVOCANDO...'}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Wish Results Grid */}
          {lastResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-[#080b16] p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Resultado da Oração ({lastResults.length}×)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  Valor Total: R$ {lastResults.reduce((s, r) => s + r.price, 0).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className={`grid gap-2.5 ${lastResults.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-2 sm:grid-cols-5'}`}>
                {lastResults.map((item, idx) => {
                  const elem = item.element ? ELEMENT_META[item.element] : null;
                  const ownedQty = collectionMap.get(item.id)?.quantity || 1;
                  const constellation = item.kind === 'character' ? Math.min(6, Math.max(0, ownedQty - 1)) : null;
                  const sold = soldInResultIds.has(idx);

                  const borderClass =
                    item.rank === 5
                      ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/20 via-[#12162b] to-[#080b14] shadow-[0_0_24px_rgba(251,191,36,0.22)]'
                      : item.rank === 4
                        ? 'border-purple-400/60 bg-gradient-to-b from-purple-500/15 via-[#111328] to-[#080b14]'
                        : 'border-sky-500/35 bg-gradient-to-b from-sky-500/10 via-[#0d1222] to-[#070a14]';

                  return (
                    <motion.div
                      key={`${item.id}-${idx}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`rounded-xl border p-2.5 flex flex-col items-center text-center relative ${borderClass}`}
                    >
                      {constellation !== null && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-black bg-black/60 text-amber-300 border border-amber-400/35 px-1.5 py-0.5 rounded">
                          C{constellation}
                        </span>
                      )}
                      {elem && (
                        <span className="absolute top-1.5 left-1.5 text-xs" title={elem.label}>
                          {elem.emoji}
                        </span>
                      )}

                      <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center my-1">
                        <GenshinArtwork
                          splashUrl={item.splashUrl}
                          iconUrl={item.iconUrl}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <p className="text-[11px] font-extrabold text-white line-clamp-1 w-full" title={item.name}>
                        {item.name}
                      </p>
                      <p className={`text-[10px] ${item.rank === 5 ? 'text-amber-300' : item.rank === 4 ? 'text-purple-300' : 'text-sky-300'}`}>
                        {'★'.repeat(item.rank)}
                      </p>
                      <p className="text-[10px] font-mono font-bold text-emerald-300 mt-0.5">
                        R$ {item.price.toLocaleString('pt-BR')}
                      </p>

                      <button
                        type="button"
                        disabled={sold}
                        onClick={() => handleQuickSellResult(item, idx)}
                        className={`mt-2 w-full py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          sold
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-200 border border-white/10'
                        }`}
                      >
                        {sold ? '✓ Vendido' : `Vender R$ ${item.price.toLocaleString('pt-BR')}`}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        /* Collection Tab */
        <div className="space-y-3">
          {/* Stats & Sell Duplicates */}
          <div className="rounded-2xl border border-white/10 bg-[#080b16] p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <p className="text-[10px] text-slate-400">Únicos</p>
                <p className="font-mono font-black text-white">{collection.length} / {catalog.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Valor da Coleção</p>
                <p className="font-mono font-black text-emerald-300">R$ {totalCollectionValue.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Total de Orações</p>
                <p className="font-mono font-black text-amber-300">{pity.totalWishes}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowMissing((p) => !p)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showMissing
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {showMissing ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showMissing ? 'Mostrando Catálogo' : 'Ver Faltantes'}
              </button>

              {duplicatesInfo.count > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSellAllDuplicates(priceLookup);
                    play('cashout');
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Vender {duplicatesInfo.count} Duplicatas (R$ {duplicatesInfo.totalValue.toLocaleString('pt-BR')})
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0a0d19] border border-white/10 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar personagem ou arma..."
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex gap-1">
              {(['all', '5', '4', '3'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                    rarityFilter === r
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-[#0a0d19] border-white/10 text-slate-300 hover:border-amber-400/40'
                  }`}
                >
                  {r === 'all' ? 'Todos' : `${r}★`}
                </button>
              ))}
            </div>

            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setElementFilter('all')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                  elementFilter === 'all' ? 'bg-white/15 border-white/30 text-white' : 'bg-[#0a0d19] border-white/10 text-slate-400'
                }`}
              >
                Todos
              </button>
              {Object.entries(ELEMENT_META).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setElementFilter(key)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                    elementFilter === key ? meta.bg + ' ' + meta.color : 'bg-[#0a0d19] border-white/10 text-slate-400'
                  }`}
                  title={meta.label}
                >
                  {meta.emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setElementFilter('weapon')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                  elementFilter === 'weapon' ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-[#0a0d19] border-white/10 text-slate-400'
                }`}
              >
                ⚔️ Armas
              </button>
            </div>
          </div>

          {/* Collection Grid */}
          {filteredCollectionItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#080b16] p-10 text-center text-xs text-slate-400">
              Nenhum item encontrado. Faça Orações na aba principal para montar sua coleção de Teyvat!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {filteredCollectionItems.slice(0, 120).map((item) => {
                const owned = collectionMap.get(item.id);
                const qty = owned?.quantity || 0;
                const elem = item.element ? ELEMENT_META[item.element] : null;
                const constellation = item.kind === 'character' && qty > 0 ? Math.min(6, qty - 1) : null;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 flex flex-col items-center text-center relative transition-all ${
                      qty === 0
                        ? 'border-white/5 bg-[#070912]/70 opacity-50 grayscale'
                        : item.rank === 5
                          ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/15 to-[#080b16]'
                          : item.rank === 4
                            ? 'border-purple-400/45 bg-gradient-to-b from-purple-500/12 to-[#080b16]'
                            : 'border-sky-500/30 bg-[#090d1a]'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-bold bg-black/70 text-white px-1.5 py-0.5 rounded border border-white/15">
                        ×{qty}
                      </span>
                    )}
                    {constellation !== null && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-mono font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 rounded">
                        C{constellation}
                      </span>
                    )}

                    <div className="w-20 h-20 flex items-center justify-center my-1">
                      <GenshinArtwork
                        splashUrl={item.splashUrl}
                        iconUrl={item.iconUrl}
                        alt={item.name}
                        preferSplash={false}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <p className="text-[11px] font-bold text-white line-clamp-1 w-full" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] mt-0.5">
                      <span className={item.rank === 5 ? 'text-amber-300' : item.rank === 4 ? 'text-purple-300' : 'text-sky-300'}>
                        {'★'.repeat(item.rank)}
                      </span>
                      {elem && <span className={elem.color}>{elem.emoji}</span>}
                    </div>
                    <p className="text-[10px] font-mono font-bold text-emerald-300 mt-0.5">
                      R$ {item.price.toLocaleString('pt-BR')}
                    </p>

                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onSellCard(item.id, item.price);
                          play('cashout');
                        }}
                        className="mt-2 w-full py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-[10px] font-bold text-slate-200 hover:text-emerald-200 transition-all cursor-pointer"
                      >
                        Vender 1×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
