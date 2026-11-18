import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Sparkles, TrendingUp, Swords, Search, Loader2, Hammer } from 'lucide-react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface LoLChestsProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId?: string;
  initialTab?: 'chests' | 'sanctum' | 'collection' | 'market';
}

interface LoLItem {
  id: string;
  name: string;
  type: 'champion' | 'skin' | 'essence' | 'cosmetic';
  champion?: string;
  championKey?: string;
  championNumKey?: string;
  skinNum?: number;
  skinId?: string;
  rarity: number;
  rarityLabel: string;
  image: string;
  fallbackImages?: string[];
  icon?: string;
  essenceValue: number;
  price: number;
}

const RARITY_CONFIG: Record<number, { label: string; color: string; border: string; glow: string }> = {
  0: { label: 'Comum', color: 'text-slate-300', border: 'border-slate-500/40', glow: 'rgba(148,163,184,0.2)' },
  1: { label: 'Raro', color: 'text-blue-400', border: 'border-blue-500/40', glow: 'rgba(59,130,246,0.28)' },
  2: { label: 'Épico', color: 'text-purple-400', border: 'border-purple-500/45', glow: 'rgba(168,85,247,0.32)' },
  3: { label: 'Lendário', color: 'text-orange-400', border: 'border-orange-500/50', glow: 'rgba(251,146,60,0.4)' },
  4: { label: 'Mítico', color: 'text-red-400', border: 'border-red-500/55', glow: 'rgba(239,68,68,0.45)' },
  5: { label: 'Santuário (0,5%)', color: 'text-rose-400', border: 'border-rose-500/70', glow: 'rgba(244,63,94,0.58)' },
};

const ART_KEY_OVERRIDES: Record<string, string> = {
  Fiddlesticks: 'FiddleSticks',
};

const CHROMA_SUFFIX_RE =
  /\((rubi|peridoto|safira|obsidiana|pérola|perola|quartzo-rosa|quartzo|turquesa|olho de gato|tanzanita|citrino|esmeralda|ametista|água-marinha|agua-marinha|meteoro|jaspe|arco-íris|arco-iris|dourado|dourada|cobalto|âmbar|ambar|granada|ônix|onix|topázio|topazio|coral|ruby|peridot|sapphire|obsidian|pearl|rose quartz|turquoise|catseye|cat's eye|tanzanite|citrine|emerald|amethyst|aquamarine|meteorite|jasper|rainbow|golden)\)\s*$/i;

function isChromaSkin(sk: any): boolean {
  if (!sk) return false;
  if (sk.parentSkin !== undefined && sk.parentSkin !== null) return true;
  if (sk.isChroma === true) return true;
  return CHROMA_SUFFIX_RE.test(String(sk.name || ''));
}

function stripTrailingParens(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function normalizeDDragonArtKey(champKey: string): string {
  return ART_KEY_OVERRIDES[champKey] || champKey;
}

function resolveCDragonAsset(assetPath?: string, branch: 'latest' | 'pbe' = 'latest'): string {
  if (!assetPath) return '';
  if (assetPath.startsWith('https://') || assetPath.startsWith('http://')) return assetPath;
  const cleaned = assetPath.replace(/^\/?lol-game-data\/assets\//i, '').replace(/^\/+/, '');
  return `https://raw.communitydragon.org/${branch}/plugins/rcp-be-lol-game-data/global/default/${cleaned.toLowerCase()}`;
}

function getLoLImageCandidates(item: LoLItem, ddVersion: string): string[] {
  const candidates: string[] = [];
  const artKey = item.championKey ? normalizeDDragonArtKey(item.championKey) : '';

  if (item.image) {
    candidates.push(item.image.replace('/Fiddlesticks_', '/FiddleSticks_'));
  }

  // Para skins, priorizar todas as artes específicas da própria skin antes de cair na skin base (_0)
  if (artKey && typeof item.skinNum === 'number' && item.skinNum > 0) {
    candidates.push(
      `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${artKey}_${item.skinNum}.jpg`,
      `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${artKey}_${item.skinNum}.jpg`
    );
  }

  if (Array.isArray(item.fallbackImages)) {
    candidates.push(...item.fallbackImages);
  }

  if (item.championNumKey && item.skinId) {
    candidates.push(
      `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${item.championNumKey}/${item.skinId}.jpg`,
      `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${item.championNumKey}/${item.skinId}.jpg`,
      `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${item.championNumKey}/${item.skinId}.jpg`,
      `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${item.championNumKey}/${item.skinId}.jpg`
    );
  }

  if (artKey) {
    if (typeof item.skinNum === 'number' && item.skinNum === 0) {
      candidates.push(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${artKey}_0.jpg`);
    }
    candidates.push(`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${artKey}_0.jpg`);
  }

  if (item.icon) {
    candidates.push(item.icon);
  } else if (item.championKey) {
    candidates.push(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${item.championKey}.png`);
  }

  const seen = new Set<string>();
  return candidates.filter((url) => {
    if (!url || !url.startsWith('https://') || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function LoLArtImage({ item, ddVersion, className }: { item: LoLItem; ddVersion: string; className?: string }) {
  const candidates = useMemo(() => getLoLImageCandidates(item, ddVersion), [item, ddVersion]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [item.id, item.image]);

  if (idx >= candidates.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090d1a] p-2 text-center">
        <span className="text-2xl mb-1">⚔️</span>
        <span className="text-[9px] font-bold text-slate-400 line-clamp-2">{item.name}</span>
      </div>
    );
  }

  return (
    <img
      src={candidates[idx]}
      alt={item.name}
      className={className}
      loading="lazy"
      onError={() => setIdx((prev) => prev + 1)}
    />
  );
}

const SPARK_RP = 400;
const SPARK_PRICE_BRL = 12.90;
const SANCTUM_S_PITY = 40;
const SANCTUM_A_PITY = 10;
const SANCTUM_S_RATE = 0.005;
const SANCTUM_A_RATE = 0.10;

const SANCTUM_THEMATIC_KEYWORDS = [
  'k/da', 'true damage', 'guardiã estelar', 'guardião estelar',
  'congregação', 'bruxa', 'coven', 'projeto', 'florescer espiritual',
  'empiriano', 'firestarter', 'ignição',
];
const SANCTUM_THEMATIC_CHAMPS = new Set(['Akali', 'Ahri', 'Evelynn', 'Kaisa', 'Seraphine']);

const SANCTUM_MYTHIC_ESSENCE_TABLE: { qty: number; weight: number }[] = [
  { qty: 5, weight: 0.65 },
  { qty: 10, weight: 0.25 },
  { qty: 25, weight: 0.08 },
  { qty: 50, weight: 0.02 },
];

const SANCTUM_COSMETICS = [
  { id: 'emote_akali_mic', name: 'Emote K/DA FIRESTARTER', label: 'Emote Exclusivo • +2 EM', iconId: 4657 },
  { id: 'icon_akali_neon', name: 'Ícone Dragão Neon K/DA', label: 'Ícone de Invocador • +2 EM', iconId: 4658 },
  { id: 'icon_kda_crown', name: 'Ícone Assinatura Ignição', label: 'Ícone de Evento • +2 EM', iconId: 4659 },
  { id: 'emote_akali_kunai', name: 'Emote Kunai Cromática', label: 'Emote Animado • +2 EM', iconId: 5800 },
];

function rollMythicEssenceAmount(): number {
  const r = Math.random();
  let cum = 0;
  for (const row of SANCTUM_MYTHIC_ESSENCE_TABLE) {
    cum += row.weight;
    if (r < cum) return row.qty;
  }
  return 5;
}

function buildAkaliSanctumItem(
  version: string,
  overrides?: { name?: string; loadScreen?: string; splash?: string; skinId?: string; skinNum?: number }
): LoLItem {
  const skinId = overrides?.skinId || '84102';
  const skinNum = overrides?.skinNum ?? 102;
  const fallbackList = [
    overrides?.splash || '',
    `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/84/${skinId}.jpg`,
    `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/84/${skinId}.jpg`,
    `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Akali_${skinNum}.jpg`,
    `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Akali_${skinNum}.jpg`,
    'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Akali_15.jpg',
    'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Akali_13.jpg',
  ].filter(Boolean);

  return {
    id: 'lol_sanctum_akali_84102',
    name: overrides?.name || 'Akali K/DA FIRESTARTER (Ignição)',
    type: 'skin',
    champion: 'Akali',
    championKey: 'Akali',
    championNumKey: '84',
    skinNum,
    skinId,
    rarity: 5,
    rarityLabel: RARITY_CONFIG[5].label,
    image:
      overrides?.loadScreen ||
      `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/84/${skinId}.jpg`,
    fallbackImages: fallbackList,
    icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/Akali.png`,
    essenceValue: 3500,
    price: 516.00,
  };
}

const MYTHIC_KEYWORDS = ['prestígio', 'prestige', 'hextec', 'hextech', 'vitoriosa', 'victorious', 'cinzas', 'ashen'];
const LEGENDARY_KEYWORDS = [
  'elementalista', 'guardiã estelar', 'guardião estelar', 'projeto', 'k/da',
  'deus-rei', 'emissário', 'florescer espiritual', 'cósmico', 'estrela negra',
  'pulsefire', 'empiriano', 'imortal', 'odisseia', 'arcana',
];

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

function getDeterministicChampRarity(champKey: string, title: string): number {
  const h = deterministicHash(champKey + title);
  if (h < 50) return 0;
  if (h < 82) return 1;
  if (h < 95) return 2;
  return 3;
}

function getDeterministicSkinRarity(skinId: string, skinName: string): number {
  const lower = skinName.toLowerCase();
  if (MYTHIC_KEYWORDS.some((kw) => lower.includes(kw))) return 4;
  if (LEGENDARY_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  const h = deterministicHash(skinId + skinName);
  if (h < 35) return 1;
  if (h < 78) return 2;
  if (h < 95) return 3;
  return 4;
}

function getEssenceAndPrice(rarity: number, isSkin: boolean) {
  if (!isSkin) {
    return {
      essenceValue: rarity === 0 ? 90 : rarity === 1 ? 270 : rarity === 2 ? 630 : 1260,
      price: rarity === 0 ? 4.90 : rarity === 1 ? 12.90 : rarity === 2 ? 29.90 : 49.90,
    };
  }
  return {
    essenceValue: rarity === 1 ? 270 : rarity === 2 ? 675 : rarity === 3 ? 1350 : 2700,
    price: rarity === 1 ? 14.90 : rarity === 2 ? 39.90 : rarity === 3 ? 79.90 : 149.90,
  };
}

// Offline fallback items with real Data Dragon image paths
const FALLBACK_VERSION = '15.1.1';
const FALLBACK_CHAMPS = [
  { id: 'Ahri', key: '103', name: 'Ahri', skins: [{ num: 0, name: 'default' }, { num: 27, name: 'Florescer Espiritual' }, { num: 28, name: 'K/DA ALL OUT' }] },
  { id: 'Akali', key: '84', name: 'Akali', skins: [{ num: 0, name: 'default' }, { num: 9, name: 'K/DA Akali' }, { num: 13, name: 'K/DA ALL OUT Akali' }, { num: 15, name: 'K/DA Akali Prestígio (2022)' }, { num: 16, name: 'Guardiã Estelar Akali' }] },
  { id: 'Yasuo', key: '157', name: 'Yasuo', skins: [{ num: 0, name: 'default' }, { num: 10, name: 'Emissário da Escuridão' }, { num: 17, name: 'Odisseia' }] },
  { id: 'Jinx', key: '222', name: 'Jinx', skins: [{ num: 0, name: 'default' }, { num: 4, name: 'Guardiã Estelar' }, { num: 37, name: 'Arcane' }] },
  { id: 'Lux', key: '99', name: 'Lux', skins: [{ num: 0, name: 'default' }, { num: 7, name: 'Elementalista' }, { num: 15, name: 'Cósmica' }] },
  { id: 'Darius', key: '122', name: 'Darius', skins: [{ num: 0, name: 'default' }, { num: 15, name: 'Deus-Rei' }] },
  { id: 'Vayne', key: '67', name: 'Vayne', skins: [{ num: 0, name: 'default' }, { num: 11, name: 'PROJETO: Vayne' }] },
  { id: 'LeeSin', key: '64', name: 'Lee Sin', skins: [{ num: 0, name: 'default' }, { num: 11, name: 'Punhos Divinos' }] },
  { id: 'Ezreal', key: '81', name: 'Ezreal', skins: [{ num: 0, name: 'default' }, { num: 5, name: 'Pulsefire' }] },
];

function buildFallbackItems(): LoLItem[] {
  const items: LoLItem[] = [];
  for (const ch of FALLBACK_CHAMPS) {
    const artKey = normalizeDDragonArtKey(ch.id);
    for (const sk of ch.skins) {
      const isChamp = sk.num === 0;
      const rarity = isChamp
        ? getDeterministicChampRarity(ch.id, ch.name)
        : getDeterministicSkinRarity(`${ch.id}_${sk.num}`, sk.name);
      const { essenceValue, price } = getEssenceAndPrice(rarity, !isChamp);
      const skinId = `${ch.key}${String(sk.num).padStart(3, '0')}`;
      items.push({
        id: isChamp ? `lol_ch_${ch.id}` : `lol_sk_${ch.id}_${sk.num}`,
        name: isChamp ? ch.name : `${sk.name}`,
        type: isChamp ? 'champion' : 'skin',
        champion: isChamp ? undefined : ch.name,
        championKey: ch.id,
        championNumKey: ch.key,
        skinNum: sk.num,
        skinId,
        rarity,
        rarityLabel: RARITY_CONFIG[rarity].label,
        image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${artKey}_${sk.num}.jpg`,
        icon: `https://ddragon.leagueoflegends.com/cdn/${FALLBACK_VERSION}/img/champion/${ch.id}.png`,
        essenceValue,
        price,
      });
    }
  }
  return items;
}

let cachedDDragonItems: LoLItem[] | null = null;
let cachedDDragonVersion: string | null = null;
let cachedAkaliSanctumItem: LoLItem | null = null;
let cachedChromaMigrationMap: Map<string, LoLItem> = new Map();

interface ChestDef {
  id: string;
  name: string;
  price: number;
  tier: string;
  description: string;
  icon: string;
  contents: { type: 'champion' | 'skin' | 'essence'; qty: number }[];
  weights: number[];
}

const CHESTS: ChestDef[] = [
  {
    id: 'basic', name: 'Baú Hextec Comum', price: 4.90, tier: 'Comum', icon: '📦',
    description: '1 Campeão + 1 Skin aleatória',
    contents: [{ type: 'champion', qty: 1 }, { type: 'skin', qty: 1 }],
    weights: [0.46, 0.34, 0.14, 0.05, 0.01],
  },
  {
    id: 'premium', name: 'Baú Mestre-Artesão', price: 14.90, tier: 'Premium', icon: '🎁',
    description: '2 Skins raras + Essência Laranja',
    contents: [{ type: 'skin', qty: 2 }, { type: 'champion', qty: 1 }, { type: 'essence', qty: 1 }],
    weights: [0, 0.36, 0.38, 0.20, 0.06],
  },
  {
    id: 'legendary', name: 'Orbe Lendário', price: 39.90, tier: 'Lendário', icon: '🏆',
    description: '3 Skins Épicas/Lendárias/Míticas + Essência',
    contents: [{ type: 'skin', qty: 3 }, { type: 'essence', qty: 1 }],
    weights: [0, 0, 0.28, 0.50, 0.22],
  },
];

function pickItem(poolSource: LoLItem[], type: 'champion' | 'skin', rarityLevel: number): LoLItem {
  const exact = poolSource.filter(i => i.type === type && i.rarity === rarityLevel);
  if (exact.length > 0) return exact[Math.floor(Math.random() * exact.length)];
  const sameType = poolSource.filter(i => i.type === type);
  if (sameType.length > 0) return sameType[Math.floor(Math.random() * sameType.length)];
  return poolSource[Math.floor(Math.random() * poolSource.length)];
}

function rollRarity(weights: number[]): number {
  const roll = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) return i;
  }
  return 0;
}

interface SanctumDrop {
  item: LoLItem;
  tier: 'S' | 'A' | 'B';
  mythicEssence?: number;
  orangeEssence?: number;
  isNew?: boolean;
  note?: string;
}

function readStoredLoLState(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function LoLChests({ balance, onUpdateBalance, onAddBetHistory, userId, initialTab }: LoLChestsProps) {
  const storageKey = `benbets_lol_${userId || 'guest'}`;

  const [allItems, setAllItems] = useState<LoLItem[]>(() => cachedDDragonItems || buildFallbackItems());
  const [ddVersion, setDdVersion] = useState<string>(() => cachedDDragonVersion || FALLBACK_VERSION);
  const [chromaMigrationMap, setChromaMigrationMap] = useState<Map<string, LoLItem>>(() => cachedChromaMigrationMap);
  const [akaliSanctumSkin, setAkaliSanctumSkin] = useState<LoLItem>(() => cachedAkaliSanctumItem || buildAkaliSanctumItem(FALLBACK_VERSION));
  const [loadingApi, setLoadingApi] = useState<boolean>(() => !cachedDDragonItems);

  const [tab, setTab] = useState<'chests' | 'sanctum' | 'collection' | 'market'>(initialTab || 'chests');
  const [selectedChest, setSelectedChest] = useState<ChestDef | null>(CHESTS[0]);
  const [result, setResult] = useState<{ item: LoLItem; essence?: boolean; isNew?: boolean }[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [opening, setOpening] = useState(false);

  // Santuário: Akali K/DA FIRESTARTER (Ignição)
  const [sanctumOpening, setSanctumOpening] = useState(false);
  const [sanctumResult, setSanctumResult] = useState<SanctumDrop[] | null>(null);
  const [revealedSanctumCount, setRevealedSanctumCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [forgeMessage, setForgeMessage] = useState('');
  const { play } = useSound();

  const [collection, setCollection] = useState<LoLItem[]>(() => {
    const parsed = readStoredLoLState(storageKey);
    return Array.isArray(parsed?.collection) ? parsed.collection : [];
  });

  const [essence, setEssence] = useState<number>(() => {
    const parsed = readStoredLoLState(storageKey);
    return typeof parsed?.essence === 'number' ? parsed.essence : 0;
  });

  const [mythicEssence, setMythicEssence] = useState<number>(() => {
    const parsed = readStoredLoLState(storageKey);
    return typeof parsed?.mythicEssence === 'number' ? parsed.mythicEssence : 0;
  });

  const [sanctumPity, setSanctumPity] = useState<number>(() => {
    const parsed = readStoredLoLState(storageKey);
    return typeof parsed?.sanctumPity === 'number' ? parsed.sanctumPity : 0;
  });

  const [sanctumAPity, setSanctumAPity] = useState<number>(() => {
    const parsed = readStoredLoLState(storageKey);
    return typeof parsed?.sanctumAPity === 'number' ? parsed.sanctumAPity : 0;
  });

  const [sanctumPulls, setSanctumPulls] = useState<number>(() => {
    const parsed = readStoredLoLState(storageKey);
    return typeof parsed?.sanctumPulls === 'number' ? parsed.sanctumPulls : 0;
  });

  const [stats, setStats] = useState<{ opens: number; legendary: number; mythic: number }>(() => {
    const parsed = readStoredLoLState(storageKey);
    return parsed?.stats || { opens: 0, legendary: 0, mythic: 0 };
  });

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  // Reload user state when userId changes
  useEffect(() => {
    const parsed = readStoredLoLState(storageKey);
    if (parsed) {
      setCollection(Array.isArray(parsed.collection) ? parsed.collection : []);
      setEssence(typeof parsed.essence === 'number' ? parsed.essence : 0);
      setMythicEssence(typeof parsed.mythicEssence === 'number' ? parsed.mythicEssence : 0);
      setSanctumPity(typeof parsed.sanctumPity === 'number' ? parsed.sanctumPity : 0);
      setSanctumAPity(typeof parsed.sanctumAPity === 'number' ? parsed.sanctumAPity : 0);
      setSanctumPulls(typeof parsed.sanctumPulls === 'number' ? parsed.sanctumPulls : 0);
      setStats(parsed.stats || { opens: 0, legendary: 0, mythic: 0 });
    }
  }, [storageKey]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ collection, essence, mythicEssence, sanctumPity, sanctumAPity, sanctumPulls, stats })
      );
    } catch {}
  }, [storageKey, collection, essence, mythicEssence, sanctumPity, sanctumAPity, sanctumPulls, stats]);

  // Re-hydrate legacy collection URLs and migrate old chromas to their real parent skin once catalog loads
  useEffect(() => {
    if (allItems.length === 0) return;
    setCollection((prev) => {
      if (prev.length === 0) return prev;
      const byId = new Map<string, LoLItem>();
      const realSkinsByChampAndName = new Map<string, LoLItem>();
      allItems.forEach((it) => {
        byId.set(it.id, it);
        if (it.type === 'skin' && it.championKey) {
          realSkinsByChampAndName.set(`${it.championKey}::${it.name.toLowerCase().trim()}`, it);
        }
      });
      byId.set(akaliSanctumSkin.id, akaliSanctumSkin);

      let changed = false;
      const hydrated = prev.map((c) => {
        const migratedParent = chromaMigrationMap.get(c.id);
        if (migratedParent) {
          changed = true;
          return migratedParent;
        }
        if (c.type === 'skin' && CHROMA_SUFFIX_RE.test(c.name)) {
          const byNameParent = realSkinsByChampAndName.get(
            `${c.championKey || ''}::${stripTrailingParens(c.name).toLowerCase()}`
          );
          if (byNameParent) {
            changed = true;
            return byNameParent;
          }
        }

        const match = byId.get(c.id);
        const brokenUrl = !c.image || !c.image.startsWith('https://') || c.image.includes('/Fiddlesticks_');
        if (match && (brokenUrl || !c.championNumKey || !c.skinId || (match.fallbackImages && !c.fallbackImages))) {
          changed = true;
          return {
            ...c,
            image: match.image,
            icon: match.icon || c.icon,
            championNumKey: match.championNumKey,
            skinId: match.skinId,
            fallbackImages: match.fallbackImages,
          };
        }
        if (brokenUrl) {
          changed = true;
          return {
            ...c,
            image: c.image ? c.image.replace('/Fiddlesticks_', '/FiddleSticks_') : (c.icon || ''),
          };
        }
        return c;
      });
      return changed ? hydrated : prev;
    });
  }, [allItems, akaliSanctumSkin, chromaMigrationMap]);

  // Fetch Riot Data Dragon pt_BR champions & skins (excluding chromas) + CDragon Akali 84.json
  useEffect(() => {
    if (cachedDDragonItems && cachedAkaliSanctumItem) {
      setAllItems(cachedDDragonItems);
      setDdVersion(cachedDDragonVersion || FALLBACK_VERSION);
      setChromaMigrationMap(cachedChromaMigrationMap);
      setAkaliSanctumSkin(cachedAkaliSanctumItem);
      setLoadingApi(false);
      return;
    }

    let cancelled = false;
    (async () => {
      let resolvedVer = cachedDDragonVersion || FALLBACK_VERSION;

      try {
        if (!cachedDDragonItems) {
          try {
            const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
            if (vRes.ok) {
              const versions = await vRes.json();
              if (Array.isArray(versions) && versions[0]) resolvedVer = versions[0];
            }
          } catch {}

          const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${resolvedVer}/data/pt_BR/championFull.json`);
          if (!cRes.ok) throw new Error('DataDragon failed');
          const cJson = await cRes.json();
          const dataObj = cJson?.data;
          if (!dataObj) throw new Error('Invalid championFull payload');

          const parsed: LoLItem[] = [];
          const migrationMap = new Map<string, LoLItem>();

          for (const champ of Object.values(dataObj) as any[]) {
            const champKey = champ.id;
            const artKey = normalizeDDragonArtKey(champKey);
            const champNumKey = String(champ.key || '');
            const champName = champ.name;
            const icon = `https://ddragon.leagueoflegends.com/cdn/${resolvedVer}/img/champion/${champKey}.png`;

            const realByNum = new Map<number, LoLItem>();
            const realBySkinId = new Map<string, LoLItem>();
            const realByLowerName = new Map<string, LoLItem>();

            // Champion base entry
            const chRarity = getDeterministicChampRarity(champKey, champ.title || '');
            const chPricing = getEssenceAndPrice(chRarity, false);
            const baseSkinId = champNumKey ? `${champNumKey}000` : '0';
            const chItem: LoLItem = {
              id: `lol_ch_${champKey}`,
              name: champName,
              type: 'champion',
              championKey: champKey,
              championNumKey: champNumKey || undefined,
              skinNum: 0,
              skinId: baseSkinId,
              rarity: chRarity,
              rarityLabel: RARITY_CONFIG[chRarity].label,
              image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${artKey}_0.jpg`,
              icon,
              essenceValue: chPricing.essenceValue,
              price: chPricing.price,
            };
            parsed.push(chItem);
            realByNum.set(0, chItem);

            // 1ª passada: apenas skins reais autônomas (ignora cromas com parentSkin / sufixo de cor)
            if (Array.isArray(champ.skins)) {
              for (const sk of champ.skins) {
                if (!sk || sk.num === 0 || isChromaSkin(sk)) continue;
                const skName = sk.name === 'default' ? champName : sk.name;
                const skIdStr = String(sk.id || (champNumKey ? `${champNumKey}${String(sk.num).padStart(3, '0')}` : sk.num));
                const skRarity = getDeterministicSkinRarity(skIdStr, skName);
                const skPricing = getEssenceAndPrice(skRarity, true);
                const skinItem: LoLItem = {
                  id: `lol_sk_${champKey}_${sk.num}`,
                  name: skName,
                  type: 'skin',
                  champion: champName,
                  championKey: champKey,
                  championNumKey: champNumKey || undefined,
                  skinNum: sk.num,
                  skinId: skIdStr,
                  rarity: skRarity,
                  rarityLabel: RARITY_CONFIG[skRarity].label,
                  image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${artKey}_${sk.num}.jpg`,
                  icon,
                  essenceValue: skPricing.essenceValue,
                  price: skPricing.price,
                };
                parsed.push(skinItem);
                realByNum.set(Number(sk.num), skinItem);
                realBySkinId.set(skIdStr, skinItem);
                realByLowerName.set(String(skName).toLowerCase().trim(), skinItem);
              }

              // 2ª passada: mapear cromas antigos para a skin principal pai
              for (const sk of champ.skins) {
                if (!sk || sk.num === 0 || !isChromaSkin(sk)) continue;
                const skName = String(sk.name || '');
                const parent =
                  (sk.parentSkin !== undefined && sk.parentSkin !== null
                    ? realByNum.get(Number(sk.parentSkin)) || realBySkinId.get(String(sk.parentSkin))
                    : undefined) ||
                  realByLowerName.get(stripTrailingParens(skName).toLowerCase());
                if (parent) {
                  migrationMap.set(`lol_sk_${champKey}_${sk.num}`, parent);
                }
              }
            }
          }

          if (!cancelled && parsed.length > 0) {
            cachedDDragonItems = parsed;
            cachedDDragonVersion = resolvedVer;
            cachedChromaMigrationMap = migrationMap;
            setAllItems(parsed);
            setDdVersion(resolvedVer);
            setChromaMigrationMap(migrationMap);
          }
        }
      } catch {
        // Keep fallback
      }

      // Sync Akali 84.json from CommunityDragon (latest + PBE fallback) for Sanctum showcase
      try {
        const findAkaliFirestarter = (json: any) => {
          const skinsArr = Array.isArray(json?.skins) ? json.skins : [];
          return skinsArr.find(
            (s: any) => Number(s?.id) === 84102 || /firestarter|igni[cç][aã]o|ignition/i.test(String(s?.name || ''))
          );
        };

        let akaliJson: any = null;
        let sourceBranch: 'latest' | 'pbe' = 'latest';
        try {
          const rPt = await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/pt_br/v1/champions/84.json');
          if (rPt.ok) akaliJson = await rPt.json();
        } catch {}
        if (!akaliJson) {
          try {
            const rDef = await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/84.json');
            if (rDef.ok) akaliJson = await rDef.json();
          } catch {}
        }

        let firestarter = findAkaliFirestarter(akaliJson);
        if (!firestarter) {
          try {
            const rPbe = await fetch('https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champions/84.json');
            if (rPbe.ok) {
              const pbeJson = await rPbe.json();
              const pbeSkin = findAkaliFirestarter(pbeJson);
              if (pbeSkin) {
                firestarter = pbeSkin;
                sourceBranch = 'pbe';
              }
            }
          } catch {}
        }

        const built = buildAkaliSanctumItem(resolvedVer, firestarter ? {
          name: firestarter.name || 'Akali K/DA FIRESTARTER (Ignição)',
          loadScreen: resolveCDragonAsset(firestarter.loadScreenPath, sourceBranch),
          splash: resolveCDragonAsset(firestarter.splashPath, sourceBranch),
          skinId: String(firestarter.id || '84102'),
          skinNum: firestarter.id ? Number(firestarter.id) % 1000 : 102,
        } : undefined);
        if (!cancelled) {
          cachedAkaliSanctumItem = built;
          setAkaliSanctumSkin(built);
        }
      } catch {
        // Keep default Akali Sanctum skin metadata
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleOpen = () => {
    if (!selectedChest || opening) return;
    if (selectedChest.price > balance) { alert('Saldo insuficiente'); return; }

    play('packOpen');
    onUpdateBalance(-selectedChest.price);
    setOpening(true);
    setResult(null);
    setRevealedCount(0);
    setStats(s => ({ ...s, opens: s.opens + 1 }));

    const ownedBefore = new Set(collection.map(c => c.id));

    setTimeout(() => {
      const drops: { item: LoLItem; essence?: boolean; isNew?: boolean }[] = [];
      const newlyCollected: LoLItem[] = [];
      let legendCount = 0;
      let mythicCount = 0;

      for (const content of selectedChest.contents) {
        if (content.type === 'essence') {
          const amt = 90 + Math.floor(Math.random() * 260);
          setEssence(prev => prev + amt);
          drops.push({
            item: {
              id: `essence-${Date.now()}`,
              name: `${amt} de Essência`,
              type: 'essence',
              rarity: 0,
              rarityLabel: 'Essência',
              image: '',
              essenceValue: 0,
              price: 0,
            },
            essence: true,
          });
        } else {
          for (let q = 0; q < content.qty; q++) {
            const rarity = rollRarity(selectedChest.weights);
            const item = pickItem(allItems, content.type, rarity);
            const isNew = !ownedBefore.has(item.id);
            ownedBefore.add(item.id);
            drops.push({ item, isNew });
            newlyCollected.push(item);
            if (item.rarity === 3) legendCount++;
            if (item.rarity === 4) mythicCount++;
          }
        }
      }

      setCollection(prev => [...prev, ...newlyCollected]);
      if (legendCount > 0 || mythicCount > 0) {
        setStats(s => ({ ...s, legendary: s.legendary + legendCount, mythic: s.mythic + mythicCount }));
      }
      setResult(drops);
      setOpening(false);

      drops.forEach((drop, idx) => {
        setTimeout(() => {
          setRevealedCount(idx + 1);
          if (drop.essence) {
            play('cardFlip');
          } else {
            play(drop.item.rarity >= 3 ? 'legendary' : drop.item.rarity === 2 ? 'rare' : 'cardFlip');
          }
        }, idx * 220);
      });

      if (onAddBetHistory) {
        onAddBetHistory({
          id: `lol-${Date.now()}`,
          matchName: 'Baús LoL',
          selectionName: drops.map(d => d.item.name).join(', '),
          odds: 0, stake: selectedChest.price, potentialPayout: 0,
          status: 'won', placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino', outcomeValue: drops.some(d => d.item.rarity >= 3) ? 'LENDÁRIO!' : 'ABERTO',
        });
      }
    }, 750);
  };

  const pickSanctumTierAItem = () => {
    const thematic = allItems.filter((i) => {
      if (i.type !== 'skin' || i.rarity < 2 || i.rarity > 3) return false;
      if (i.championKey && SANCTUM_THEMATIC_CHAMPS.has(i.championKey)) return true;
      const lower = i.name.toLowerCase();
      return SANCTUM_THEMATIC_KEYWORDS.some((kw) => lower.includes(kw));
    });
    const pool = thematic.length > 0 ? thematic : allItems.filter((i) => i.type === 'skin' && i.rarity >= 2);
    return pool[Math.floor(Math.random() * pool.length)] || allItems[0];
  };

  const handleSanctumPull = (count: 1 | 10) => {
    if (sanctumOpening) return;
    const cost = Number((count * SPARK_PRICE_BRL).toFixed(2));
    if (cost > balance) { alert('Saldo insuficiente'); return; }

    play('packOpen');
    onUpdateBalance(-cost);
    setSanctumOpening(true);
    setSanctumResult(null);
    setRevealedSanctumCount(0);

    const ownedBefore = new Set(collection.map((c) => c.id));
    let sPity = sanctumPity;
    let aPity = sanctumAPity;

    setTimeout(() => {
      const drops: SanctumDrop[] = [];
      const newlyCollected: LoLItem[] = [];
      let meEarned = 0;
      let oeEarned = 0;
      let sWins = 0;
      let aWins = 0;

      for (let i = 0; i < count; i++) {
        sPity += 1;
        aPity += 1;

        const r = Math.random();
        // Sem soft pity: chance estritamente 0,5% do giro 1 ao 39; garantia exata no 40º giro
        if (sPity >= SANCTUM_S_PITY || r < SANCTUM_S_RATE) {
          sPity = 0;
          aPity = 0;
          sWins += 1;
          meEarned += 100;
          const isNew = !ownedBefore.has(akaliSanctumSkin.id);
          ownedBefore.add(akaliSanctumSkin.id);
          newlyCollected.push(akaliSanctumSkin);
          drops.push({
            item: akaliSanctumSkin,
            tier: 'S',
            mythicEssence: 100,
            isNew,
            note: 'Variante Mítica +100 EM',
          });
        } else if (aPity >= SANCTUM_A_PITY || r < SANCTUM_S_RATE + SANCTUM_A_RATE) {
          aPity = 0;
          aWins += 1;
          const skin = pickSanctumTierAItem();
          const isNew = !ownedBefore.has(skin.id);
          ownedBefore.add(skin.id);
          newlyCollected.push(skin);
          drops.push({
            item: skin,
            tier: 'A',
            isNew,
            note: 'Espólio Tier A (10%)',
          });
        } else {
          if (Math.random() < 0.65) {
            const meAmt = rollMythicEssenceAmount();
            const bonusOe = 75;
            meEarned += meAmt;
            oeEarned += bonusOe;
            drops.push({
              item: {
                id: `sanctum_me_${Date.now()}_${i}`,
                name: `${meAmt} Essência Mítica`,
                type: 'essence',
                rarity: 2,
                rarityLabel: 'Tier B (89,5%)',
                image: '',
                essenceValue: bonusOe,
                price: 0,
              },
              tier: 'B',
              mythicEssence: meAmt,
              orangeEssence: bonusOe,
              note: `+${meAmt} EM & +${bonusOe} 💠`,
            });
          } else {
            const cos = SANCTUM_COSMETICS[Math.floor(Math.random() * SANCTUM_COSMETICS.length)];
            const bonusMe = 2;
            const bonusOe = 50;
            meEarned += bonusMe;
            oeEarned += bonusOe;
            drops.push({
              item: {
                id: `sanctum_${cos.id}_${Date.now()}_${i}`,
                name: cos.name,
                type: 'cosmetic',
                champion: 'Evento Santuário',
                rarity: 1,
                rarityLabel: 'Tier B (89,5%)',
                image: `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${cos.iconId}.png`,
                icon: `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/Akali.png`,
                essenceValue: bonusOe,
                price: 0,
              },
              tier: 'B',
              mythicEssence: bonusMe,
              orangeEssence: bonusOe,
              note: cos.label,
            });
          }
        }
      }

      if (newlyCollected.length > 0) {
        setCollection((prev) => [...prev, ...newlyCollected]);
      }
      if (meEarned > 0) setMythicEssence((prev) => prev + meEarned);
      if (oeEarned > 0) setEssence((prev) => prev + oeEarned);
      setSanctumPity(sPity);
      setSanctumAPity(aPity);
      setSanctumPulls((prev) => prev + count);
      setStats((s) => ({
        opens: s.opens + count,
        legendary: s.legendary + aWins,
        mythic: s.mythic + sWins,
      }));
      setSanctumResult(drops);
      setSanctumOpening(false);

      const stepMs = count === 1 ? 0 : 180;
      drops.forEach((drop, idx) => {
        setTimeout(() => {
          setRevealedSanctumCount(idx + 1);
          play(drop.tier === 'S' ? 'legendary' : drop.tier === 'A' ? 'rare' : 'cardFlip');
        }, idx * stepMs);
      });

      if (onAddBetHistory) {
        const outcome = sWins > 0 ? 'AKALI FIRESTARTER!' : aWins > 0 ? `TIER A (${aWins}×)` : 'TIER B (EM)';
        onAddBetHistory({
          id: `lol-sanctum-${Date.now()}`,
          matchName: 'Santuário LoL — Akali',
          selectionName: `${count}× Centelha Ancestral (${count * SPARK_RP} RP)`,
          odds: 0,
          stake: cost,
          potentialPayout: sWins > 0 ? akaliSanctumSkin.price : 0,
          status: 'won',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: outcome,
        });
      }
    }, 820);
  };

  const handleForgeCapsule = (cost: number, minRarity: number, label: string) => {
    if (essence < cost) return;
    const pool = allItems.filter(i => i.type === 'skin' && i.rarity >= minRarity && i.rarity <= 4);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || allItems[0];
    setEssence(prev => prev - cost);
    setCollection(prev => [...prev, chosen]);
    play(chosen.rarity >= 3 ? 'legendary' : 'rare');
    setForgeMessage(`${label}: você forjou ${chosen.name} (${chosen.rarityLabel})!`);
    setTimeout(() => setForgeMessage(''), 4000);
  };

  const handleForgeMythicStore = (cost: number) => {
    if (mythicEssence < cost) return;
    const pool = allItems.filter(i => i.type === 'skin' && i.rarity === 4);
    const fallbackPool = allItems.filter(i => i.type === 'skin' && i.rarity >= 3);
    const source = pool.length > 0 ? pool : fallbackPool;
    const chosen = source[Math.floor(Math.random() * source.length)] || allItems[0];
    setMythicEssence(prev => prev - cost);
    setCollection(prev => [...prev, chosen]);
    play('legendary');
    setForgeMessage(`Loja Mítica: você resgatou ${chosen.name} (${chosen.rarityLabel}) por ${cost} EM!`);
    setTimeout(() => setForgeMessage(''), 4500);
  };

  const handleSellAllDuplicates = () => {
    const seen = new Set<string>();
    let total = 0;
    const kept: LoLItem[] = [];
    collection.forEach(c => {
      if (seen.has(c.id)) {
        total += c.essenceValue;
      } else {
        seen.add(c.id);
        kept.push(c);
      }
    });
    if (total > 0) {
      setEssence(prev => prev + total);
      setCollection(kept);
      play('cashout');
    }
  };

  const uniqueCollection = useMemo(() => {
    const map = new Map<string, { item: LoLItem; qty: number }>();
    for (const c of collection) {
      const entry = map.get(c.id);
      if (entry) entry.qty += 1;
      else map.set(c.id, { item: c, qty: 1 });
    }
    return Array.from(map.values())
      .filter(({ item }) => rarityFilter === null || item.rarity === rarityFilter)
      .filter(({ item }) =>
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.champion || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.item.rarity - a.item.rarity);
  }, [collection, rarityFilter, searchQuery]);

  const hasAkaliSanctum = useMemo(
    () => collection.some((c) => c.id === akaliSanctumSkin.id),
    [collection, akaliSanctumSkin.id]
  );

  const duplicateCount = collection.length - new Set(collection.map(c => c.id)).size;

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

      <div className="bg-[#070910] border border-blue-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-lg text-blue-400 shrink-0">
            <Swords className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold font-display text-white">Baús & Santuário LoL</span>
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                Riot Data Dragon v{ddVersion}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {allItems.length} campeões & skins oficiais + Santuário Akali (0,5%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono shrink-0">
          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold px-2 py-1 rounded-lg">
            💠 {essence}
          </span>
          <span className="bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 font-bold px-2 py-1 rounded-lg">
            🟣 {mythicEssence} EM
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'chests' as const, label: 'Baús', icon: '📦', activeCls: 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.22)]' },
          { id: 'sanctum' as const, label: 'Santuário Akali (0,5%)', icon: '🔥', activeCls: 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.28)]' },
          { id: 'collection' as const, label: `Coleção (${new Set(collection.map(c => c.id)).size})`, icon: '📚', activeCls: 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.22)]' },
          { id: 'market' as const, label: 'Forja & Essência', icon: '💠', activeCls: 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.22)]' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[110px] py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold border transition-all duration-200 cursor-pointer ${
              tab === t.id
                ? t.activeCls
                : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:border-blue-500/30'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loadingApi && (
        <div className="text-[10px] font-mono text-blue-300 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando catálogo oficial Riot Data Dragon...
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'chests' && (
          <motion.div key="chests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CHESTS.map(chest => (
                <button key={chest.id} onClick={() => { setSelectedChest(chest); setResult(null); }}
                  className={`p-3.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    selectedChest?.id === chest.id
                      ? 'bg-blue-500/15 border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.25)]'
                      : 'bg-[#080a12] border-[#1a1c2a] hover:border-blue-500/35'
                  }`}>
                  <div className="text-3xl mb-1.5">{chest.icon}</div>
                  <div className="text-xs font-extrabold text-white">{chest.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{chest.description}</div>
                  <div className="text-xs font-mono font-bold text-brand mt-1.5">R$ {chest.price.toFixed(2)}</div>
                </button>
              ))}
            </div>

            {selectedChest && (
              <>
                <div className="bg-[#080a12] rounded-xl p-3 border border-[#1a1c2a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Probabilidades — {selectedChest.name}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4].map(lvl => (
                      <div key={lvl} className="bg-[#06070d] border border-[#1a1c2a] rounded-lg p-1.5 text-center">
                        <div className={`text-[9px] font-bold ${RARITY_CONFIG[lvl].color}`}>{RARITY_CONFIG[lvl].label}</div>
                        <div className="text-xs font-mono font-bold text-white">{(selectedChest.weights[lvl] * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button onClick={handleOpen} disabled={opening || selectedChest.price > balance}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.28)] transition-all">
                  <Play className="w-4 h-4" />
                  {opening ? 'Abrindo Baú Hextec...' : `Abrir ${selectedChest.name} — R$ ${selectedChest.price.toFixed(2)}`}
                </motion.button>
              </>
            )}

            <AnimatePresence>
              {opening && selectedChest && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#070910] border border-blue-500/30 rounded-2xl p-6 text-center relative overflow-hidden"
                >
                  <div className="flex flex-col items-center justify-center py-2">
                    <div
                      className="w-24 h-24 rounded-full border-2 border-blue-400/70 bg-[#0b1020] flex items-center justify-center gacha-pack-charge relative"
                      style={{ '--charge-color': 'rgba(59,130,246,0.55)' } as CSSProperties}
                    >
                      <div className="absolute inset-1 rounded-full border border-dashed border-cyan-400/50 animate-omnitrix-spin" />
                      <span className="text-4xl relative z-10">{selectedChest.icon}</span>
                    </div>
                    <p className="text-xs font-mono text-blue-300 mt-4 animate-pulse">
                      Energizando núcleo Hextec...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {result && !opening && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-[#070910] border border-blue-500/25 rounded-2xl p-4 shadow-[0_0_26px_rgba(59,130,246,0.12)] space-y-4">
                  <div className="text-xs font-bold text-brand flex items-center justify-between">
                    <span>🎉 Recompensas Desbloqueadas:</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.min(revealedCount, result.length)}/{result.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {result.map((drop, i) => {
                      const cfg = RARITY_CONFIG[drop.item.rarity] || RARITY_CONFIG[0];
                      const isShown = i < revealedCount;
                      if (!isShown) {
                        return (
                          <div key={`pending-${i}`}
                            className="aspect-[3/4] rounded-xl border-2 border-blue-500/30 gacha-card-back flex flex-col items-center justify-center p-2">
                            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                            <span className="text-[8px] font-mono text-slate-400 mt-1.5">HEXTEC</span>
                          </div>
                        );
                      }
                      if (drop.essence) {
                        return (
                          <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#0b0e18] border border-cyan-500/35 rounded-xl p-3 flex flex-col items-center justify-center text-center aspect-[3/4]">
                            <span className="text-4xl mb-2">💠</span>
                            <div className="text-xs font-extrabold text-cyan-300">{drop.item.name}</div>
                            <span className="text-[9px] text-slate-400 mt-1">Essência Laranja</span>
                          </motion.div>
                        );
                      }
                      const isTopRarity = drop.item.rarity >= 3;
                      return (
                        <motion.div key={i} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 170, damping: 16 }}
                          className={`rounded-xl overflow-hidden border-2 ${cfg.border} bg-[#080a12] holo-foil relative flex flex-col ${isTopRarity ? 'gacha-float' : ''}`}
                          style={{ boxShadow: `0 0 18px ${cfg.glow}` }}>
                          {isTopRarity && (
                            <div
                              className="gacha-light-beam opacity-60"
                              style={{ '--beam-color': cfg.glow } as CSSProperties}
                            />
                          )}
                          <div className="aspect-[3/4] relative bg-[#06070d] overflow-hidden z-10">
                            <LoLArtImage item={drop.item} ddVersion={ddVersion} className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-transparent" />
                            {drop.isNew && (
                              <span className="absolute top-1.5 left-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-full bg-brand text-slate-950 shadow">
                                NEW
                              </span>
                            )}
                            <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/75 border border-white/10 ${cfg.color}`}>
                              {drop.item.rarityLabel}
                            </span>
                          </div>
                          <div className="p-2 text-center bg-[#06070d] relative z-10">
                            <div className="text-[10px] font-extrabold text-white truncate">{drop.item.name}</div>
                            {drop.item.champion && <div className="text-[8px] text-slate-400 truncate">{drop.item.champion}</div>}
                            <div className="text-[8px] font-mono text-cyan-300 mt-0.5">+{drop.item.essenceValue} 💠 se repetida</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {revealedCount >= result.length && selectedChest && balance >= selectedChest.price && (
                    <button
                      onClick={handleOpen}
                      className="w-full py-2.5 bg-[#121727] hover:bg-[#192038] text-blue-300 border border-blue-500/40 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      🔄 Abrir Outro {selectedChest.name} (R$ {selectedChest.price.toFixed(2)})
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === 'sanctum' && (
          <motion.div key="sanctum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Banner Showcase Akali K/DA FIRESTARTER */}
            <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-br from-[#140812] via-[#090814] to-[#06070d] p-4 relative overflow-hidden shadow-[0_0_32px_rgba(244,63,94,0.16)]">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-rose-500/80 to-transparent" />
              <div className="grid grid-cols-1 sm:grid-cols-[175px_1fr] gap-4 items-center">
                <div
                  className="aspect-[3/4] max-w-[190px] w-full mx-auto rounded-xl overflow-hidden border-2 border-rose-500/65 bg-[#06070d] relative holo-foil gacha-float"
                  style={{ boxShadow: '0 0 26px rgba(244,63,94,0.42)' }}
                >
                  <div className="gacha-light-beam opacity-70" style={{ '--beam-color': 'rgba(244,63,94,0.58)' } as CSSProperties} />
                  <div className="relative w-full h-full z-10">
                    <LoLArtImage item={akaliSanctumSkin} ddVersion={ddVersion} className="w-full h-full object-cover object-top" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white shadow">
                      Tier S • 0,5%
                    </span>
                    {hasAkaliSanctum && (
                      <span className="absolute bottom-2 left-2 right-2 text-center text-[8px] font-black px-2 py-1 rounded-lg bg-brand/90 text-slate-950 shadow">
                        ✓ NA COLEÇÃO
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 min-w-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/35 text-rose-300">
                        O Santuário • Variante Mítica
                      </span>
                      <span className="text-[9px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        Hard Pity: 16.000 RP
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black font-display text-white leading-tight">
                      {akaliSanctumSkin.name}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 leading-relaxed">
                      Estatísticas reais do Santuário LoL: cada <strong className="text-slate-200">Centelha Ancestral</strong> custa{' '}
                      <span className="text-amber-300 font-mono font-bold">400 RP (R$ {SPARK_PRICE_BRL.toFixed(2)})</span>.
                    </p>
                  </div>

                  {/* Tabela oficial de Drop Rates */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-[#06070d]/90 border border-rose-500/35 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-bold text-rose-400">TIER S</div>
                      <div className="text-sm font-black font-mono text-white">0,5%</div>
                      <div className="text-[8px] text-slate-400">Akali + 100 EM</div>
                    </div>
                    <div className="bg-[#06070d]/90 border border-purple-500/30 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-bold text-purple-400">TIER A</div>
                      <div className="text-sm font-black font-mono text-white">10,0%</div>
                      <div className="text-[8px] text-slate-400">Garantido em 10</div>
                    </div>
                    <div className="bg-[#06070d]/90 border border-cyan-500/25 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-bold text-cyan-300">TIER B</div>
                      <div className="text-sm font-black font-mono text-white">89,5%</div>
                      <div className="text-[8px] text-slate-400">EM / Ícone / Emote</div>
                    </div>
                  </div>

                  <div className="text-[9px] text-rose-200/80 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                    ⚠️ Sem soft pity: a chance do 1º ao 39º giro é estritamente 0,5% (1 em 200). Cerca de 82,2% dos jogadores precisam atingir os 40 giros (16.000 RP).
                  </div>
                </div>
              </div>

              {/* Barras de Pity */}
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-rose-300 font-bold">
                      Garantia Tier S (Hard Pity): {sanctumPity}/{SANCTUM_S_PITY} Centelhas
                    </span>
                    <span className="text-slate-400">
                      Faltam {SANCTUM_S_PITY - sanctumPity} ({((SANCTUM_S_PITY - sanctumPity) * SPARK_RP).toLocaleString('pt-BR')} RP • R$ {((SANCTUM_S_PITY - sanctumPity) * SPARK_PRICE_BRL).toFixed(2)})
                    </span>
                  </div>
                  <div className="h-2 bg-[#06070d] rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, (sanctumPity / SANCTUM_S_PITY) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                      <span className="text-purple-300 font-bold">Garantia Tier A: {sanctumAPity}/{SANCTUM_A_PITY}</span>
                      <span className="text-slate-500">Faltam {SANCTUM_A_PITY - sanctumAPity}</span>
                    </div>
                    <div className="h-1.5 bg-[#06070d] rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, (sanctumAPity / SANCTUM_A_PITY) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 bg-[#06070d] border border-[#1a1c2a] rounded-lg px-2.5 py-1">
                    Total gasto: <strong className="text-white">{sanctumPulls}</strong> ({(sanctumPulls * SPARK_RP).toLocaleString('pt-BR')} RP)
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Invocação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <motion.button
                onClick={() => handleSanctumPull(1)}
                disabled={sanctumOpening || SPARK_PRICE_BRL > balance}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,63,94,0.28)] transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> 1× Centelha Ancestral
                </span>
                <span className="text-[10px] font-mono font-bold opacity-90">
                  R$ {SPARK_PRICE_BRL.toFixed(2)} • {SPARK_RP} RP
                </span>
              </motion.button>

              <motion.button
                onClick={() => handleSanctumPull(10)}
                disabled={sanctumOpening || SPARK_PRICE_BRL * 10 > balance}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_24px_rgba(244,63,94,0.35)] transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <Play className="w-4 h-4" /> 10× Centelhas Ancestrais
                </span>
                <span className="text-[10px] font-mono font-extrabold">
                  R$ {(SPARK_PRICE_BRL * 10).toFixed(2)} • 4.000 RP (Garante Tier A)
                </span>
              </motion.button>
            </div>

            <AnimatePresence>
              {sanctumOpening && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#0a0710] border border-rose-500/35 rounded-2xl p-6 text-center relative overflow-hidden"
                >
                  <div className="flex flex-col items-center justify-center py-2">
                    <div
                      className="w-24 h-24 rounded-full border-2 border-rose-400/75 bg-[#180a16] flex items-center justify-center gacha-pack-charge relative"
                      style={{ '--charge-color': 'rgba(244,63,94,0.65)' } as CSSProperties}
                    >
                      <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/60 animate-omnitrix-spin" />
                      <span className="text-4xl relative z-10">🔥</span>
                    </div>
                    <p className="text-xs font-mono text-rose-300 mt-4 animate-pulse">
                      Canalizando Centelha Ancestral no Santuário...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {sanctumResult && !sanctumOpening && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#090710] border border-rose-500/30 rounded-2xl p-4 shadow-[0_0_28px_rgba(244,63,94,0.14)] space-y-4"
                >
                  <div className="text-xs font-bold text-rose-300 flex items-center justify-between">
                    <span>🔥 Espólios do Santuário:</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.min(revealedSanctumCount, sanctumResult.length)}/{sanctumResult.length}
                    </span>
                  </div>

                  <div className={`grid gap-2.5 ${sanctumResult.length === 1 ? 'grid-cols-1 max-w-[210px] mx-auto' : 'grid-cols-2 sm:grid-cols-5'}`}>
                    {sanctumResult.map((drop, i) => {
                      const isShown = i < revealedSanctumCount;
                      if (!isShown) {
                        return (
                          <div key={`sanctum-pending-${i}`}
                            className="aspect-[3/4] rounded-xl border-2 border-rose-500/30 gacha-card-back flex flex-col items-center justify-center p-2">
                            <Sparkles className="w-5 h-5 text-rose-400 animate-pulse" />
                            <span className="text-[8px] font-mono text-rose-300/80 mt-1.5">SANTUÁRIO</span>
                          </div>
                        );
                      }

                      if (drop.tier === 'B') {
                        const isCosmetic = drop.item.type === 'cosmetic';
                        return (
                          <motion.div
                            key={i}
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#0b0e18] border border-cyan-500/30 rounded-xl p-2.5 flex flex-col items-center justify-center text-center aspect-[3/4] relative overflow-hidden"
                          >
                            <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-cyan-300">
                              TIER B
                            </span>
                            {isCosmetic && drop.item.image ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-cyan-400/40 mb-2 bg-[#06070d]">
                                <LoLArtImage item={drop.item} ddVersion={ddVersion} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <span className="text-3xl mb-1.5">🟣</span>
                            )}
                            <div className="text-[10px] font-extrabold text-white line-clamp-2 leading-tight">{drop.item.name}</div>
                            <div className="text-[8px] font-mono text-fuchsia-300 mt-1">{drop.note}</div>
                            {drop.orangeEssence && (
                              <div className="text-[8px] font-mono text-cyan-300">+{drop.orangeEssence} 💠</div>
                            )}
                          </motion.div>
                        );
                      }

                      const cfg = RARITY_CONFIG[drop.item.rarity] || RARITY_CONFIG[3];
                      const isS = drop.tier === 'S';
                      return (
                        <motion.div
                          key={i}
                          initial={{ rotateY: 90, opacity: 0 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 170, damping: 16 }}
                          className={`rounded-xl overflow-hidden border-2 ${isS ? 'border-rose-400 gacha-float' : cfg.border} bg-[#080a12] holo-foil relative flex flex-col`}
                          style={{ boxShadow: isS ? '0 0 26px rgba(244,63,94,0.65)' : `0 0 18px ${cfg.glow}` }}
                        >
                          <div
                            className="gacha-light-beam opacity-75"
                            style={{ '--beam-color': isS ? 'rgba(244,63,94,0.65)' : cfg.glow } as CSSProperties}
                          />
                          <div className="aspect-[3/4] relative bg-[#06070d] overflow-hidden z-10">
                            <LoLArtImage item={drop.item} ddVersion={ddVersion} className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-transparent" />
                            {drop.isNew && (
                              <span className="absolute top-1.5 left-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-full bg-brand text-slate-950 shadow">
                                NEW
                              </span>
                            )}
                            <span className={`absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded bg-black/80 border border-white/15 ${isS ? 'text-rose-400' : 'text-purple-300'}`}>
                              {isS ? 'TIER S!' : 'TIER A'}
                            </span>
                          </div>
                          <div className="p-2 text-center bg-[#06070d] relative z-10">
                            <div className="text-[10px] font-extrabold text-white truncate">{drop.item.name}</div>
                            <div className={`text-[8px] font-mono mt-0.5 ${isS ? 'text-rose-300 font-bold' : 'text-purple-300'}`}>
                              {drop.note}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {revealedSanctumCount >= sanctumResult.length && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {balance >= SPARK_PRICE_BRL && (
                        <button
                          onClick={() => handleSanctumPull(1)}
                          className="w-full py-2.5 bg-[#1b0b15] hover:bg-[#27101f] text-rose-300 border border-rose-500/40 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                        >
                          🔄 Girar +1× Centelha (R$ {SPARK_PRICE_BRL.toFixed(2)})
                        </button>
                      )}
                      {balance >= SPARK_PRICE_BRL * 10 && (
                        <button
                          onClick={() => handleSanctumPull(10)}
                          className="w-full py-2.5 bg-[#1f0d1a] hover:bg-[#2d1326] text-amber-300 border border-amber-500/40 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                        >
                          🔥 Girar +10× Centelhas (R$ {(SPARK_PRICE_BRL * 10).toFixed(2)})
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar campeão ou skin..."
                  className="w-full bg-[#06070d] border border-[#1a1c2a] rounded-xl text-xs text-slate-200 pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button onClick={() => setRarityFilter(null)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${rarityFilter === null ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400'}`}>
                Todas
              </button>
              {[0, 1, 2, 3, 4, 5].map(lvl => (
                <button key={lvl} onClick={() => setRarityFilter(rarityFilter === lvl ? null : lvl)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${RARITY_CONFIG[lvl].color} ${rarityFilter === lvl ? 'bg-white/10 border-white/25' : 'bg-[#080a12] border-[#1a1c2a]'}`}>
                  {RARITY_CONFIG[lvl].label}
                </button>
              ))}
            </div>

            {duplicateCount > 0 && (
              <button onClick={handleSellAllDuplicates}
                className="w-full py-2.5 bg-cyan-500/10 border border-cyan-500/35 text-cyan-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-cyan-500/20 transition-all">
                Desmontar {duplicateCount} Repetida{duplicateCount > 1 ? 's' : ''} por Essência 💠
              </button>
            )}

            {uniqueCollection.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-10">Nenhum item na coleção ainda.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
                {uniqueCollection.map(({ item, qty }) => {
                  const cfg = RARITY_CONFIG[item.rarity] || RARITY_CONFIG[0];
                  return (
                    <div key={item.id} className={`bg-[#070910] border-2 ${cfg.border} rounded-xl overflow-hidden holo-foil transition-transform hover:scale-[1.02]`}
                      style={{ boxShadow: `0 0 10px ${cfg.glow}` }}>
                      <div className="aspect-[3/4] relative bg-[#06070d]">
                        <LoLArtImage item={item} ddVersion={ddVersion} className="w-full h-full object-cover object-top" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#070910] via-transparent to-transparent" />
                        {qty > 1 && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-mono font-bold bg-black/80 text-brand border border-brand/30 px-1.5 py-0.5 rounded-md">
                            ×{qty}
                          </span>
                        )}
                      </div>
                      <div className="p-2 text-center">
                        <div className="text-[10px] font-extrabold text-white truncate">{item.name}</div>
                        {item.champion && <div className="text-[8px] text-slate-400 truncate">{item.champion}</div>}
                        <div className={`text-[8px] font-bold mt-0.5 ${cfg.color}`}>{item.rarityLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#070910] rounded-2xl p-5 border border-cyan-500/25 text-center shadow-[0_0_24px_rgba(6,182,212,0.1)]">
                <div className="text-3xl mb-1">💠</div>
                <div className="text-3xl font-black text-cyan-300 font-mono">{essence}</div>
                <div className="text-[11px] text-slate-400 mt-1">Essência Laranja Acumulada</div>
              </div>
              <div className="bg-[#070910] rounded-2xl p-5 border border-fuchsia-500/30 text-center shadow-[0_0_24px_rgba(217,70,239,0.12)]">
                <div className="text-3xl mb-1">🟣</div>
                <div className="text-3xl font-black text-fuchsia-300 font-mono">{mythicEssence} EM</div>
                <div className="text-[11px] text-slate-400 mt-1">Essência Mítica (Santuário)</div>
              </div>
            </div>

            {forgeMessage && (
              <div className="bg-brand/10 border border-brand/35 text-brand text-xs font-bold p-3 rounded-xl text-center">
                ✨ {forgeMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleForgeCapsule(1200, 2, 'Cápsula Épica+')}
                disabled={essence < 1200}
                className="p-4 rounded-xl border border-purple-500/35 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5" /> Cápsula Épica+
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">1.200 💠</span>
                </div>
                <p className="text-[10px] text-slate-400">Forja 1 skin garantida Épica, Lendária ou Mítica.</p>
              </button>

              <button
                onClick={() => handleForgeCapsule(3000, 3, 'Cápsula Lendária+')}
                disabled={essence < 3000}
                className="p-4 rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-orange-300 flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5" /> Cápsula Lendária/Mítica
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">3.000 💠</span>
                </div>
                <p className="text-[10px] text-slate-400">Forja 1 skin garantida Lendária ou Mítica.</p>
              </button>

              <button
                onClick={() => handleForgeMythicStore(125)}
                disabled={mythicEssence < 125}
                className="p-4 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-fuchsia-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Loja Mítica
                  </span>
                  <span className="text-xs font-mono font-bold text-fuchsia-300">125 🟣 EM</span>
                </div>
                <p className="text-[10px] text-slate-400">Resgata 1 skin Mítica (Prestígio / Hextec / Cinzas) garantida.</p>
              </button>
            </div>

            <div className="bg-[#080a12] rounded-xl p-3.5 border border-[#1a1c2a] space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-cyan-400" /> Estatísticas da Conta LoL
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-white">{stats.opens}</div>
                  <div className="text-[9px] text-slate-500">Baús & Centelhas</div>
                </div>
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-orange-400">{stats.legendary}</div>
                  <div className="text-[9px] text-slate-500">Lendários / Tier A</div>
                </div>
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-red-400">{stats.mythic}</div>
                  <div className="text-[9px] text-slate-500">Míticos / Tier S</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
