import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  TowerControl,
  Star,
  ShieldBan,
  Users,
  Terminal,
  Clock,
  KeyRound,
  Search,
  RefreshCw,
  Trash2,
  Crown,
  X,
  Check,
  Store,
  Tag,
  ShoppingCart,
  Globe,
  Sparkles,
  Radio,
  Zap,
} from 'lucide-react';
import { PlacedBet, PokemonCard } from '../types';
import {
  MudaeLiveOrb,
  MudaeLiveRoll,
  MudaeMarketListing,
  MudaeTowerLevels,
  MudaeUserData,
  ServerAnimeClaim,
  acknowledgeMudaeSalesReceipts,
  buyMudaeMarketListing,
  cancelMudaeMarketListing,
  checkServerAnimeClaim,
  collectLiveMudaeOrb,
  getDefaultMudaeUserData,
  getLastUserDataLoadedAt,
  getMudaeUserData,
  listMudaeCharacterForSale,
  markLiveMudaeRollClaimed,
  publishLiveMudaeRoll,
  resetAllUsersMudaeCollections,
  saveMudaeUserData,
  subscribeToServerAnimeClaims,
} from '../firebase/db';
import { useSound } from '../hooks/useSound';

interface AnimeGachaProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  userName?: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number, removeAll?: boolean) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
  onClearLocalCollection?: () => void;
}

type RollMode = 'wa' | 'ha' | 'ma';
type MudaeTab = 'roll' | 'harem' | 'market' | 'tower' | 'lists' | 'server';
type CharGender = 'Female' | 'Male' | 'Other';

interface MudaeChar {
  id: string;
  name: string;
  series: string;
  image: string;
  gender: CharGender;
  favourites: number;
  claimRank: number;
  baseValue: number;
  tierIndex: number; // 0=C, 1=B, 2=A, 3=S, 4=S+
  tierLabel: string;
  role?: string;
}

const HOUR_MS = 3600_000;
const CLAIM_WINDOW_MS = 45_000;
const MAX_FREE_ROLLS_PER_HOUR = 5;
const MAX_EXTRA_ROLLS_PER_HOUR = 2;
const EXTRA_ROLL_COST = 100.0;
const BASE_RT_COST = 120.0;
const MUDAE_ACTIVE_POOL_TOTAL = 128_125;
const MUDAE_LEGACY_POOL_TOTAL = 129_254;
const CATALOG_CACHE_KEY = 'mudaeAnimeCatalog_v10';
const AVATAR_FIX_CACHE_KEY = 'mudaeAvatarFixCache_v1';

function isUsablePortraitUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('http')) return false;
  const low = url.toLowerCase();
  return !low.includes('default.jpg') && !low.includes('questionmark') && !low.includes('placeholder');
}

const resolvedPortraitMemory = new Map<string, string>();
const catalogPortraitById = new Map<string, string>();
const catalogPortraitByName = new Map<string, string>();
const inflightPortraitLookups = new Map<string, Promise<string | null>>();

try {
  const savedFixes = localStorage.getItem(AVATAR_FIX_CACHE_KEY);
  if (savedFixes) {
    const parsed = JSON.parse(savedFixes);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (isUsablePortraitUrl(v)) resolvedPortraitMemory.set(k, v);
      }
    }
  }
} catch {
  /* ignore storage errors */
}

function savePortraitFixToCache(keys: string[], url: string) {
  if (!isUsablePortraitUrl(url)) return;
  for (const k of keys) {
    if (k) resolvedPortraitMemory.set(k, url);
  }
  try {
    const out: Record<string, string> = {};
    let count = 0;
    for (const [k, v] of resolvedPortraitMemory.entries()) {
      out[k] = v;
      count += 1;
      if (count >= 400) break;
    }
    localStorage.setItem(AVATAR_FIX_CACHE_KEY, JSON.stringify(out));
  } catch {
    /* ignore quota */
  }
}

function indexCatalogPortraits(items: Array<{ id?: string; name?: string; image?: string }>) {
  for (const item of items) {
    if (!isUsablePortraitUrl(item?.image)) continue;
    if (item.id) catalogPortraitById.set(item.id, item.image);
    if (item.name) catalogPortraitByName.set(item.name.trim().toLowerCase(), item.image);
  }
}

// 2.585 páginas de 50 personagens cobrem todo o universo Mudae (~128.125 ativos / ~129.254 com legados)
const TIER_PAGE_RANGES: Array<[number, number]> = [
  [301, 2585], // Rank C (#15.001 – #129.254 • +114.250 personagens, R$ 3–5)
  [31, 300],   // Rank B (#1.501 – #15.000 • 13.500 personagens, R$ 5–7)
  [6, 30],     // Rank A (#251 – #1.500 • 1.250 personagens, R$ 140–680)
  [2, 5],      // Rank S (#51 – #250 • 200 personagens, R$ 750–1.750)
  [1, 1],      // Rank S+ Ícone (#1 – #50 • Top 50 canônico, R$ 1.766–3.450)
];

function getTierWeights(luckMultiplier: number): number[] {
  return [
    62.0, // C (~62,0% base - R$ 3–5)
    30.5, // B (~30,5% base - R$ 5–7)
    5.8 * luckMultiplier, // A (~5,8% base)
    1.4 * luckMultiplier, // S (~1,4% base)
    0.30 * luckMultiplier, // S+ Ícone (~0,30% base)
  ];
}

function pickTargetTierIndex(luckMultiplier: number): number {
  const weights = getTierWeights(luckMultiplier);
  const total = weights.reduce((acc, w) => acc + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

const TIER_CONFIG = [
  { label: 'Rank C', badge: 'text-slate-300 bg-slate-500/15 border-slate-500/40', embed: '#64748b', cardGlow: '' },
  { label: 'Rank B', badge: 'text-sky-300 bg-sky-500/15 border-sky-400/45', embed: '#38bdf8', cardGlow: 'shadow-[0_0_16px_rgba(56,189,248,0.22)]' },
  { label: 'Rank A', badge: 'text-purple-300 bg-purple-500/20 border-purple-400/50', embed: '#a855f7', cardGlow: 'shadow-[0_0_22px_rgba(168,85,247,0.34)]' },
  { label: 'Rank S', badge: 'text-amber-300 bg-amber-500/20 border-amber-400/65', embed: '#f59e0b', cardGlow: 'shadow-[0_0_28px_rgba(245,158,11,0.45)]' },
  { label: 'Rank S+ Ícone', badge: 'text-rose-200 bg-gradient-to-r from-rose-500/35 to-amber-500/35 border-rose-400/75', embed: '#f43f5e', cardGlow: 'shadow-[0_0_36px_rgba(244,63,94,0.55)]' },
];

const KAKERA_CRYSTALS: Array<Omit<MudaeLiveOrb, 'id' | 'collectedByUid' | 'collectedByName'> & { weight: number; requiresFloor6?: boolean }> = [
  { label: 'Orbe Roxo', emoji: '🟣', baseValue: 6.0, colorClass: 'from-purple-600/35 to-purple-900/50 border-purple-400/60 text-purple-200', glowStyle: '0 0 18px rgba(168,85,247,0.45)', weight: 32 },
  { label: 'Orbe Azul', emoji: '🔵', baseValue: 12.0, colorClass: 'from-blue-600/35 to-blue-900/50 border-blue-400/60 text-blue-200', glowStyle: '0 0 18px rgba(59,130,246,0.45)', weight: 25 },
  { label: 'Orbe Turquesa', emoji: '🩵', baseValue: 22.0, colorClass: 'from-cyan-500/35 to-teal-900/50 border-cyan-400/60 text-cyan-200', glowStyle: '0 0 18px rgba(34,211,238,0.45)', weight: 18 },
  { label: 'Orbe Verde', emoji: '🟢', baseValue: 38.0, colorClass: 'from-emerald-500/35 to-emerald-900/50 border-emerald-400/60 text-emerald-200', glowStyle: '0 0 20px rgba(16,185,129,0.5)', weight: 12 },
  { label: 'Orbe Amarelo', emoji: '🟡', baseValue: 65.0, colorClass: 'from-yellow-500/35 to-amber-900/50 border-yellow-400/70 text-yellow-200', glowStyle: '0 0 22px rgba(250,204,21,0.55)', weight: 7 },
  { label: 'Orbe Laranja', emoji: '🟠', baseValue: 110.0, colorClass: 'from-orange-500/40 to-orange-950/60 border-orange-400/75 text-orange-200', glowStyle: '0 0 24px rgba(249,115,22,0.6)', weight: 3.5 },
  { label: 'Orbe Vermelho', emoji: '🔴', baseValue: 190.0, colorClass: 'from-rose-500/45 to-red-950/65 border-rose-400/80 text-rose-100', glowStyle: '0 0 28px rgba(244,63,94,0.7)', weight: 1.7 },
  { label: 'Orbe Arco-Íris', emoji: '🌈', baseValue: 350.0, colorClass: 'from-pink-500/45 via-amber-400/35 to-cyan-500/45 border-white/75 text-white', glowStyle: '0 0 32px rgba(236,72,153,0.75)', weight: 0.8, requiresFloor6: true },
];

const POPULAR_ANIMES_PRESETS = [
  'One Piece',
  'Naruto',
  'Bleach',
  'Dragon Ball Z',
  'Jujutsu Kaisen',
  'Demon Slayer',
  'Attack on Titan',
  'Hunter x Hunter',
  'Solo Leveling',
  'Chainsaw Man',
  'Blue Lock',
  'My Hero Academia',
  "JoJo's Bizarre Adventure",
  'Death Note',
  'Fullmetal Alchemist',
  'Black Clover',
  'Fairy Tail',
  'Sword Art Online',
  'Tokyo Ghoul',
  'Re:ZERO',
  'Frieren',
  'SPY x FAMILY',
  'Haikyuu!!',
  'Overlord',
  'Steins;Gate',
  'Code Geass',
  'Berserk',
  'Dandadan',
];

interface TowerFloorDef {
  key: keyof MudaeTowerLevels;
  floorNum: number;
  title: string;
  subtitle: string;
  effectText: (level: number) => string;
  baseCost: number;
  multiplier: number;
  accent: string;
}

const TOWER_FLOORS: TowerFloorDef[] = [
  {
    key: 'floor1Rolls',
    floorNum: 1,
    title: 'Sorte de Raridades ($luck)',
    subtitle: 'Aumenta a chance de aparecer Rank A, S e S+ (mantém 5+2 rolls)',
    effectText: (lvl) => `+${lvl * 10}% chance de Tiers Raros (Peso ×${(1 + lvl * 0.10).toFixed(2)})`,
    baseCost: 65,
    multiplier: 1.75,
    accent: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  },
  {
    key: 'floor2Reaction',
    floorNum: 2,
    title: 'Amplificador de Orbe R$',
    subtitle: 'Multiplica o R$ ganho em todos os Orbes coletados no servidor',
    effectText: (lvl) => `+${lvl * 15}% de R$ em cada Orbe coletado`,
    baseCost: 75,
    multiplier: 1.8,
    accent: 'text-cyan-300 border-cyan-500/35 bg-cyan-500/10',
  },
  {
    key: 'floor3WishSpawn',
    floorNum: 3,
    title: 'Ímã da Wishlist ($wish)',
    subtitle: 'Aumenta drasticamente a chance de rolar sua Wishlist',
    effectText: (lvl) => `Peso da Wishlist ×${(2.5 + lvl * 0.75).toFixed(2)}`,
    baseCost: 85,
    multiplier: 1.8,
    accent: 'text-pink-300 border-pink-500/35 bg-pink-500/10',
  },
  {
    key: 'floor4Slots',
    floorNum: 4,
    title: 'Expansão de Listas ($wl / $dl)',
    subtitle: 'Libera mais vagas na Wishlist e Disablelist',
    effectText: (lvl) => `${5 + lvl * 2} Wishlist slots • ${4 + lvl} Disablelist slots`,
    baseCost: 60,
    multiplier: 1.7,
    accent: 'text-violet-300 border-violet-500/35 bg-violet-500/10',
  },
  {
    key: 'floor5Claims',
    floorNum: 5,
    title: 'Aliança Suprema ($claim & $rt)',
    subtitle: 'Concede Claims extras por hora e reduz custo de $rt',
    effectText: (lvl) => `${1 + (lvl >= 1 ? 1 : 0) + (lvl >= 4 ? 1 : 0)} claims/h • $rt R$ ${Math.max(45, BASE_RT_COST - lvl * 15).toFixed(2)}`,
    baseCost: 130,
    multiplier: 1.9,
    accent: 'text-amber-300 border-amber-500/35 bg-amber-500/10',
  },
  {
    key: 'floor6Rainbow',
    floorNum: 6,
    title: 'Prisma Arco-Íris & Chaos Keys',
    subtitle: 'Desbloqueia Orbe 🌈 R$ 350 e chance de +2 Keys ao casar repetida',
    effectText: (lvl) => (lvl === 0 ? 'Bloqueado (Nv 1 libera 🌈 Arco-Íris)' : `🌈 Liberado • ${lvl * 12}% chance de +2 Keys`),
    baseCost: 180,
    multiplier: 1.95,
    accent: 'text-rose-300 border-rose-500/35 bg-rose-500/10',
  },
];

function normalizeMudaeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Canonical Mudae TOP 1000 scale (ka = R$) with user's exact #16-#30 examples & top icons
const MUDAE_CANONICAL_TOP: Record<string, { rank: number; ka: number }> = {
  'zero two': { rank: 1, ka: 3450 },
  'rem': { rank: 2, ka: 3280 },
  'megumin': { rank: 3, ka: 3120 },
  'saber': { rank: 4, ka: 2980 },
  'altria pendragon': { rank: 4, ka: 2980 },
  'mai sakurajima': { rank: 5, ka: 2890 },
  'mikasa ackerman': { rank: 6, ka: 2840 },
  'power': { rank: 7, ka: 2760 },
  'makima': { rank: 8, ka: 2710 },
  'satoru gojo': { rank: 9, ka: 2680 },
  'levi': { rank: 10, ka: 2640 },
  'levi ackerman': { rank: 10, ka: 2640 },
  'yor forger': { rank: 11, ka: 2520 },
  'asuna yuuki': { rank: 12, ka: 2460 },
  'rias gremory': { rank: 13, ka: 2410 },
  'kurisu makise': { rank: 14, ka: 2340 },
  'albedo': { rank: 15, ka: 2280 },
  'nico robin': { rank: 16, ka: 2195 },
  'miku nakano': { rank: 17, ka: 2159 },
  'emilia': { rank: 18, ka: 2168 },
  'kirby': { rank: 19, ka: 1939 },
  'marin kitagawa': { rank: 20, ka: 2069 },
  'nezuko kamado': { rank: 21, ka: 2186 },
  'frieren': { rank: 22, ka: 2061 },
  'violet evergarden': { rank: 23, ka: 2061 },
  'aqua': { rank: 24, ka: 2134 },
  'hange zoe': { rank: 25, ka: 1766 },
  'ram': { rank: 26, ka: 2195 },
  'shinobu kochou': { rank: 27, ka: 2038 },
  'shinobu kocho': { rank: 27, ka: 2038 },
  'monkey d luffy': { rank: 28, ka: 2222 },
  'reze': { rank: 29, ka: 1966 },
  'rin tohsaka': { rank: 30, ka: 1887 },
  'roronoa zoro': { rank: 31, ka: 1750 },
  'killua zoldyck': { rank: 32, ka: 1710 },
  'itachi uchiha': { rank: 33, ka: 1680 },
  'l lawliet': { rank: 34, ka: 1640 },
  'naruto uzumaki': { rank: 35, ka: 1620 },
  'son goku': { rank: 36, ka: 1590 },
  'edward elric': { rank: 37, ka: 1540 },
  'eren yeager': { rank: 38, ka: 1510 },
  'nami': { rank: 39, ka: 1490 },
  'sasuke uchiha': { rank: 40, ka: 1460 },
  'ichigo kurosaki': { rank: 41, ka: 1420 },
  'boa hancock': { rank: 42, ka: 1390 },
  'kaguya shinomiya': { rank: 43, ka: 1360 },
  'esdeath': { rank: 44, ka: 1320 },
  'ai hoshino': { rank: 45, ka: 1350 },
  'hinata hyuga': { rank: 46, ka: 1290 },
  'chika fujiwara': { rank: 47, ka: 1240 },
  'anya forger': { rank: 48, ka: 1280 },
  'spike spiegel': { rank: 49, ka: 1180 },
  'kurumi tokisaki': { rank: 50, ka: 1210 },
};

function getCanonicalMatch(name?: string): { rank: number; ka: number } | null {
  if (!name) return null;
  const norm = normalizeMudaeName(name);
  return MUDAE_CANONICAL_TOP[norm] || null;
}

// Mudae ka = R$ curve: TOP 30 (R$ 1.766–3.450), Rank S (R$ 750–1.750), Rank A (R$ 140–680),
// while common low-rank Rank B and Rank C characters cost strictly R$ 3,00 to R$ 7,00.
function computeMudaeValueAndTier(
  claimRank: number,
  favourites = 1000,
  name?: string
): { baseValue: number; tierIndex: number; tierLabel: string } {
  const canonical = getCanonicalMatch(name);
  if (canonical) {
    const tierIndex = canonical.rank <= 30 ? 4 : 3;
    return {
      baseValue: canonical.ka,
      tierIndex,
      tierLabel: TIER_CONFIG[tierIndex].label,
    };
  }

  const rank = Math.max(1, claimRank);
  const favs = Math.max(0, favourites);

  let tierIndex = 0;
  let baseValue = 4;

  if (favs >= 50000 || rank <= 35) {
    tierIndex = 4;
    const progress = Math.min(1, Math.max(0, (Math.max(50000, favs) - 50000) / 85000));
    baseValue = Math.min(3450, Math.round(1766 + progress * 1684));
  } else if (favs >= 24000 || rank <= 250) {
    tierIndex = 3;
    const progress = Math.min(1, Math.max(0, (Math.max(24000, favs) - 24000) / 26000));
    baseValue = Math.min(1750, Math.round(750 + progress * 1000));
  } else if (favs >= 9500 || rank <= 1500) {
    tierIndex = 2;
    const progress = Math.min(1, Math.max(0, (Math.max(9500, favs) - 9500) / 14500));
    baseValue = Math.min(680, Math.round(140 + progress * 540));
  } else if (favs >= 1800 || rank <= 15000) {
    tierIndex = 1;
    const progress = Math.min(1, Math.max(0, (Math.max(1800, favs) - 1800) / 7700));
    baseValue = Math.max(5, Math.min(7, Math.round(5 + progress * 2)));
  } else {
    tierIndex = 0;
    const progress = Math.min(1, Math.max(0, Math.min(1800, favs) / 1800));
    baseValue = Math.max(3, Math.min(5, Math.round(3 + progress * 2)));
  }

  return {
    baseValue,
    tierIndex,
    tierLabel: TIER_CONFIG[tierIndex].label,
  };
}

function getEffectiveValue(baseValue: number, keys: number): number {
  const extraKeys = Math.max(0, keys - 1);
  return Number((baseValue * (1 + extraKeys * 0.1)).toFixed(2));
}

function getFloorUpgradeCost(def: TowerFloorDef, currentLevel: number): number {
  return Number((def.baseCost * Math.pow(def.multiplier, currentLevel)).toFixed(2));
}

const FALLBACK_SEED: Array<{ id: number; name: string; series: string; gender: CharGender; favourites: number; image: string }> = [
  // Rank S+ Ícones (IDs e retratos oficiais verificados)
  { id: 45627, name: 'Levi Ackerman', series: 'Attack on Titan', gender: 'Male', favourites: 138000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png' },
  { id: 127691, name: 'Satoru Gojo', series: 'Jujutsu Kaisen', gender: 'Male', favourites: 129500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png' },
  { id: 40, name: 'Monkey D. Luffy', series: 'ONE PIECE', gender: 'Male', favourites: 118000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png' },
  { id: 124381, name: 'Zero Two', series: 'DARLING in the FRANXX', gender: 'Female', favourites: 92000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b124381-2gAVq76HPfL2.png' },
  { id: 88575, name: 'Rem', series: 'Re:ZERO', gender: 'Female', favourites: 88000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b88575-Ayu8UPDA8NS6.png' },
  { id: 137080, name: 'Makima', series: 'Chainsaw Man', gender: 'Female', favourites: 84500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png' },
  { id: 176754, name: 'Frieren', series: "Frieren: Beyond Journey's End", gender: 'Female', favourites: 81000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png' },
  { id: 127518, name: 'Nezuko Kamado', series: 'Demon Slayer: Kimetsu no Yaiba', gender: 'Female', favourites: 76000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png' },
  { id: 89361, name: 'Megumin', series: 'KonoSuba', gender: 'Female', favourites: 72000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b89361-tq8PQQ4MmF0M.png' },
  { id: 133676, name: 'Marin Kitagawa', series: 'My Dress-Up Darling', gender: 'Female', favourites: 67500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b133676-kV2czE3C8Qls.png' },
  // Rank S
  { id: 62, name: 'Roronoa Zoro', series: 'ONE PIECE', gender: 'Male', favourites: 46000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png' },
  { id: 27, name: 'Killua Zoldyck', series: 'Hunter x Hunter', gender: 'Male', favourites: 44000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg' },
  { id: 14, name: 'Itachi Uchiha', series: 'Naruto', gender: 'Male', favourites: 39000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png' },
  { id: 40881, name: 'Mikasa Ackerman', series: 'Attack on Titan', gender: 'Female', favourites: 36000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png' },
  { id: 497, name: 'Saber', series: 'Fate/stay night', gender: 'Female', favourites: 31000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b497-Yg5pNmC8kxzs.png' },
  // Rank A
  { id: 11, name: 'Edward Elric', series: 'Fullmetal Alchemist', gender: 'Male', favourites: 21500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b11-TA5Nuk7EDUZG.jpg' },
  { id: 71, name: 'L Lawliet', series: 'Death Note', gender: 'Male', favourites: 20500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png' },
  { id: 246, name: 'Son Goku', series: 'Dragon Ball', gender: 'Male', favourites: 19500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png' },
  { id: 1555, name: 'Hinata Hyuga', series: 'Naruto', gender: 'Female', favourites: 18500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1555-Q41GLTV3FvYF.png' },
  { id: 127222, name: 'Mai Sakurajima', series: 'Rascal Does Not Dream', gender: 'Female', favourites: 17500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127222-Jh5hhP7vZ7s1.png' },
  { id: 138102, name: 'Yor Forger', series: 'SPY x FAMILY', gender: 'Female', favourites: 16500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b138102-ZOAu9jI2d5ke.png' },
  { id: 137079, name: 'Power', series: 'Chainsaw Man', gender: 'Female', favourites: 15500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b137079-6yLEUYR3bmpr.png' },
  { id: 1, name: 'Spike Spiegel', series: 'Cowboy Bebop', gender: 'Male', favourites: 14500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1-ChxaldmieFlQ.png' },
  // Rank B (R$ 5–7) — Femininos e Masculinos com fotos reais verificadas
  { id: 145, name: 'Sakura Haruno', series: 'Naruto', gender: 'Female', favourites: 2910, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b145-IorfpI8arxeX.png' },
  { id: 249, name: 'Yuki Nagato', series: 'Haruhi Suzumiya', gender: 'Female', favourites: 2945, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b249-2YImP6IQTe8t.png' },
  { id: 191672, name: 'Akari Watanabe', series: 'More Than a Married Couple', gender: 'Female', favourites: 3059, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b191672-MozVAnqyv9oZ.png' },
  { id: 141122, name: 'Kei Karuizawa', series: 'Classroom of the Elite', gender: 'Female', favourites: 3012, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b141122-6Zk52eU3VK3O.png' },
  { id: 122191, name: 'Hanako Koyanagi', series: 'Wotakoi', gender: 'Female', favourites: 3034, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b122191-sigwgpeam2U1.png' },
  { id: 24312, name: 'Hinata Kawamoto', series: 'March comes in like a lion', gender: 'Female', favourites: 2998, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b24312-A39sjFFj3Zrg.png' },
  { id: 2552, name: 'Misaki Nakahara', series: 'Welcome to the N-H-K', gender: 'Female', favourites: 2991, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b2552-KCehpCmmitMV.jpg' },
  { id: 68583, name: 'Akane Tsunemori', series: 'PSYCHO-PASS', gender: 'Female', favourites: 2989, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b68583-sEP2wyE2Tk7a.png' },
  { id: 5186, name: 'Lucy Heartfilia', series: 'Fairy Tail', gender: 'Female', favourites: 4561, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b5186-izgXf2S86K9u.png' },
  { id: 45887, name: 'Sasha Blouse', series: 'Attack on Titan', gender: 'Female', favourites: 8221, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b45887-QPtJH0KwqthW.jpg' },
  { id: 4839, name: 'Gray Fullbuster', series: 'Fairy Tail', gender: 'Male', favourites: 3638, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b4839-p2SBgjdTxHxk.png' },
  { id: 46484, name: 'Reiner Braun', series: 'Attack on Titan', gender: 'Male', favourites: 7807, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b46484-P6A2GjNQn49F.png' },
  { id: 1694, name: 'Neji Hyuuga', series: 'Naruto', gender: 'Male', favourites: 2614, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1694-TL4obouDwJ7k.jpg' },
  { id: 129132, name: 'Muzan Kibutsuji', series: 'Demon Slayer: Kimetsu no Yaiba', gender: 'Male', favourites: 2118, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b129132-4nIZakUZ1o8W.jpg' },
  { id: 3149, name: 'Tobi', series: 'Naruto: Shippuden', gender: 'Male', favourites: 3064, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b3149-j6cl8A9yup51.png' },
  { id: 84681, name: 'Yukine', series: 'Noragami', gender: 'Male', favourites: 3059, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b84681-vFMPNxeDkoqt.png' },
  { id: 137222, name: 'Kou Minamoto', series: 'Toilet-Bound Hanako-kun', gender: 'Male', favourites: 3042, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b137222-ojZAO84oI2Hp.png' },
  { id: 124704, name: 'Saichi Sugimoto', series: 'Golden Kamuy', gender: 'Male', favourites: 3038, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b124704-bndQyaj7X9dv.png' },
  { id: 145342, name: 'Takemichi Hanagaki', series: 'Tokyo Revengers', gender: 'Male', favourites: 3028, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b145342-GSUutL83jGgI.png' },
  { id: 206, name: 'Shigure Souma', series: 'Fruits Basket', gender: 'Male', favourites: 1801, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b206-4HokrxTIqu7L.jpg' },
  // Rank C (R$ 3–5) — Femininos e Masculinos comuns com fotos reais verificadas
  { id: 73995, name: 'Sumire Hanano', series: 'Chihayafuru 2', gender: 'Female', favourites: 52, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b73995-zmAMQkG9nTUF.png' },
  { id: 19662, name: 'Ukraine', series: 'Hetalia Axis Powers', gender: 'Female', favourites: 21, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b19662-hfG0ASfwOqaZ.jpg' },
  { id: 2425, name: 'Himeka Kuujou', series: 'Kamichama Karin', gender: 'Female', favourites: 18, image: 'https://s4.anilist.co/file/anilistcdn/character/large/2425.jpg' },
  { id: 5255, name: 'Rizel Iwaki', series: 'Rizelmine', gender: 'Female', favourites: 10, image: 'https://s4.anilist.co/file/anilistcdn/character/large/5255.jpg' },
  { id: 9811, name: 'Michiru Satomi', series: 'IGPX 2', gender: 'Female', favourites: 3, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b9811-aIS8UIYoOSuD.png' },
  { id: 1689, name: 'Shuro Tsukasa', series: 'Ceres, Celestial Legend', gender: 'Female', favourites: 2, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1689-xzzB94F9geqk.jpg' },
  { id: 1690, name: 'Suzumi Aogiri', series: 'Ceres, Celestial Legend', gender: 'Female', favourites: 2, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1690-5o65GgAxbEjr.png' },
  { id: 3001, name: 'Maiku Kamishiro', series: 'Please☆Twins!', gender: 'Female', favourites: 2, image: 'https://s4.anilist.co/file/anilistcdn/character/large/3001.jpg' },
  { id: 1875, name: 'Reiko Oota', series: 'Destiny of the Shrine Maiden', gender: 'Female', favourites: 2, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1875-H2r6SHgUlQvN.jpg' },
  { id: 9382, name: 'Gold', series: 'Demon Flowers', gender: 'Female', favourites: 0, image: 'https://s4.anilist.co/file/anilistcdn/character/large/9382.jpg' },
  { id: 138850, name: 'Sousuke Shima', series: 'Skip and Loafer', gender: 'Male', favourites: 1612, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b138850-eqwZ11Q6sLrl.png' },
  { id: 127116, name: 'Haruki Shiga', series: 'I Want to Eat Your Pancreas', gender: 'Male', favourites: 1610, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127116-u2fIKMSYDdVj.png' },
  { id: 152004, name: 'Tsuchigomori', series: 'Toilet-Bound Hanako-kun', gender: 'Male', favourites: 1604, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b152004-h2AbqFq0zZOZ.png' },
  { id: 36829, name: 'Akihiko Kayaba', series: 'Sword Art Online', gender: 'Male', favourites: 262, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b36829-X5zITNEQ7xij.png' },
  { id: 121942, name: 'Usagi', series: 'JUNI TAISEN', gender: 'Male', favourites: 207, image: 'https://s4.anilist.co/file/anilistcdn/character/large/121942-vPUkECWBhh3D.jpg' },
  { id: 15810, name: 'Estellise Sidos Heurassein', series: 'Tales of Vesperia', gender: 'Male', favourites: 46, image: 'https://s4.anilist.co/file/anilistcdn/character/large/15810.jpg' },
  { id: 259, name: 'Satoshi Imamiya', series: 'Abenobashi', gender: 'Male', favourites: 16, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b259-Cux73x7T2w2l.png' },
  { id: 263, name: 'Sayaka Imamiya', series: 'Abenobashi', gender: 'Male', favourites: 5, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b263-XRQYvVHlCj7e.png' },
  { id: 9684, name: 'Mariabella Everlasting', series: 'Orphen', gender: 'Male', favourites: 1, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b9684-6FRT7L9cFCEF.png' },
  { id: 2431, name: 'Heinz Schneider', series: 'El Cazador de la Bruja', gender: 'Male', favourites: 0, image: 'https://s4.anilist.co/file/anilistcdn/character/large/2431.jpg' },
];

type RawCharSeed = Omit<MudaeChar, 'claimRank' | 'baseValue' | 'tierIndex' | 'tierLabel'> & {
  globalRank?: number;
};

function buildCatalogFromSeeds(seeds: RawCharSeed[]): MudaeChar[] {
  const dedup = new Map<string, RawCharSeed>();
  for (const s of seeds) {
    if (!s.id) continue;
    const prev = dedup.get(s.id);
    if (!prev) {
      dedup.set(s.id, s);
    } else if ((!prev.image && s.image) || s.favourites > prev.favourites || (!prev.globalRank && s.globalRank)) {
      dedup.set(s.id, {
        ...s,
        series: s.series && s.series !== 'Anime' ? s.series : prev.series || s.series,
        image: s.image || prev.image || '',
        favourites: Math.max(prev.favourites, s.favourites),
        globalRank: s.globalRank ?? prev.globalRank,
      });
    }
  }

  const allItems = Array.from(dedup.values());
  const usedRanks = new Set<number>();
  for (const item of allItems) {
    const canon = getCanonicalMatch(item.name);
    if (canon) usedRanks.add(canon.rank);
  }

  allItems.sort((a, b) => {
    const canonA = getCanonicalMatch(a.name);
    const canonB = getCanonicalMatch(b.name);
    if (canonA && canonB) return canonA.rank - canonB.rank || b.favourites - a.favourites;
    if (canonA && !canonB) return -1;
    if (!canonA && canonB) return 1;
    return b.favourites - a.favourites;
  });

  let nextFreeRank = 1;
  const result = allItems.map((item) => {
    const canon = getCanonicalMatch(item.name);
    let claimRank: number;
    if (canon) {
      claimRank = canon.rank;
    } else {
      const minEstimatedRank =
        item.favourites >= 50000
          ? 1
          : item.favourites >= 24000
            ? 36
            : item.favourites >= 9500
              ? 251
              : item.favourites >= 1800
                ? 1501
                : 15001;
      while (usedRanks.has(nextFreeRank)) nextFreeRank += 1;
      let estimatedRank = item.globalRank
        ? Math.max(item.globalRank, minEstimatedRank)
        : Math.max(nextFreeRank, minEstimatedRank);
      while (usedRanks.has(estimatedRank) && estimatedRank < MUDAE_LEGACY_POOL_TOTAL) {
        estimatedRank += 1;
      }
      if (usedRanks.has(estimatedRank)) {
        estimatedRank = nextFreeRank;
        while (usedRanks.has(estimatedRank)) estimatedRank += 1;
      }
      claimRank = Math.min(MUDAE_LEGACY_POOL_TOTAL, estimatedRank);
      usedRanks.add(claimRank);
      if (claimRank >= nextFreeRank) nextFreeRank = claimRank + 1;
    }
    const { baseValue, tierIndex, tierLabel } = computeMudaeValueAndTier(
      claimRank,
      item.favourites,
      item.name
    );
    return {
      ...item,
      claimRank,
      baseValue,
      tierIndex,
      tierLabel,
    };
  });
  indexCatalogPortraits(result);
  return result;
}

function mergeCatalogChars(existing: MudaeChar[], incoming: RawCharSeed[]): MudaeChar[] {
  const existingSeeds: RawCharSeed[] = existing.map((c) => ({
    id: c.id,
    name: c.name,
    series: c.series,
    image: c.image,
    gender: c.gender,
    favourites: c.favourites,
    role: c.role,
    globalRank: c.claimRank,
  }));
  return buildCatalogFromSeeds([...existingSeeds, ...incoming]);
}

function buildFallbackCatalog(): MudaeChar[] {
  let rankBOffset = 0;
  let rankCOffset = 0;
  return buildCatalogFromSeeds(
    FALLBACK_SEED.map((s) => {
      let globalRank: number | undefined;
      if (s.favourites >= 1800 && s.favourites < 9500) {
        globalRank = 1580 + rankBOffset * 470;
        rankBOffset += 1;
      } else if (s.favourites < 1800) {
        globalRank = 15400 + rankCOffset * 2650;
        rankCOffset += 1;
      }
      return {
        id: `anilist_${s.id}`,
        name: s.name,
        series: s.series,
        image: s.image,
        gender: s.gender,
        favourites: s.favourites,
        role: 'Main',
        ...(globalRank !== undefined ? { globalRank } : {}),
      };
    })
  );
}

let cachedMudaeMemory: MudaeChar[] | null = null;
let loadedWavePageMemory = 0;
const loadedPagesMemory = new Set<number>();

function saveCatalogToStorage(list: MudaeChar[]) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(list.slice(0, 2200)));
  } catch {
    /* ignore storage quota */
  }
}

function pickRandomPageForTier(tierIndex: number): number {
  const [minP, maxP] = TIER_PAGE_RANGES[tierIndex] || TIER_PAGE_RANGES[0];
  const unloaded: number[] = [];
  for (let p = minP; p <= maxP; p++) {
    if (!loadedPagesMemory.has(p)) unloaded.push(p);
  }
  const pool =
    unloaded.length > 0
      ? unloaded
      : Array.from({ length: maxP - minP + 1 }, (_, idx) => minP + idx);
  return pool[Math.floor(Math.random() * pool.length)];
}

type ApiSourceStatus = 'loading' | 'anilist' | 'jikan' | 'fallback';

function hashGenderFallback(seedKey: string): CharGender {
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

function normalizeGender(raw: any, idHint?: string | number, nameHint?: string): CharGender {
  if (typeof raw === 'string') {
    const g = raw.trim().toLowerCase();
    if (g === 'female') return 'Female';
    if (g === 'male') return 'Male';
    if (g === 'non-binary' || g === 'other') return 'Other';
  }
  // Páginas profundas da AniList muitas vezes vêm com gender: null — distribuímos deterministicamente p/ $wa/$ha
  return hashGenderFallback(`${idHint ?? ''}:${nameHint ?? ''}`);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function mapAniListNode(ch: any, fallbackSeries?: string, globalRank?: number): RawCharSeed | null {
  if (!ch?.id) return null;
  const edge = ch.media?.edges?.[0];
  const node = ch.media?.nodes?.[0] || edge?.node;
  const titleObj = node?.title;
  const series = titleObj?.english || titleObj?.romaji || fallbackSeries || 'Anime';
  const rawRole = edge?.characterRole;
  const role =
    rawRole === 'MAIN'
      ? 'Main'
      : rawRole === 'SUPPORTING'
        ? 'Supporting'
        : rawRole === 'BACKGROUND'
          ? 'Background'
          : undefined;
  const rawImg = ch.image?.large || '';
  return {
    id: `anilist_${ch.id}`,
    name: ch.name?.full || 'Personagem',
    series,
    image: isUsablePortraitUrl(rawImg) ? rawImg : '',
    gender: normalizeGender(ch.gender, ch.id, ch.name?.full),
    favourites: typeof ch.favourites === 'number' && Number.isFinite(ch.favourites) ? ch.favourites : 400,
    role,
    ...(typeof globalRank === 'number' ? { globalRank } : {}),
  };
}

let edgeProxyDisabled =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('github.io') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

function getMudaeEdgeProxyUrl(): string {
  const configured = (import.meta as any).env?.VITE_MUDAE_PROXY_URL;
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  if (edgeProxyDisabled) return '';
  return '/api/mudae';
}

async function loadPrebuiltStaticCatalog(): Promise<{ seeds: RawCharSeed[]; pagesLoaded: number[] }> {
  try {
    const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '');
    const res = await fetchWithTimeout(`${base}/mudae-catalog.json`, undefined, 2200);
    if (!res.ok) return { seeds: [], pagesLoaded: [] };
    const json = await res.json();
    const rawSeeds: RawCharSeed[] = Array.isArray(json?.seeds) ? json.seeds : [];
    const validSeeds = rawSeeds.filter((s) => s?.id && isUsablePortraitUrl(s.image));
    const pagesLoaded: number[] = Array.isArray(json?.pagesLoaded) ? json.pagesLoaded : [];
    return { seeds: validSeeds, pagesLoaded };
  } catch {
    return { seeds: [], pagesLoaded: [] };
  }
}

async function resolveCharacterPortraitAuto(name: string, charId?: string): Promise<string | null> {
  const trimmedName = (name || '').trim();
  if (!trimmedName && !charId) return null;
  const normName = trimmedName.toLowerCase();

  if (charId) {
    const mem = resolvedPortraitMemory.get(charId) || catalogPortraitById.get(charId);
    if (isUsablePortraitUrl(mem)) return mem;
  }
  if (normName) {
    const mem = resolvedPortraitMemory.get(normName) || catalogPortraitByName.get(normName);
    if (isUsablePortraitUrl(mem)) return mem;
  }

  const dedupKey = charId || normName;
  const inflight = inflightPortraitLookups.get(dedupKey);
  if (inflight) return inflight;

  const task = (async (): Promise<string | null> => {
    const numericId = charId?.startsWith('anilist_') ? Number(charId.replace('anilist_', '')) : NaN;
    const validId = Number.isInteger(numericId) && numericId > 0 ? numericId : null;

    // 1) Tenta endpoint Serverless com Edge Cache se disponível
    const proxyBase = getMudaeEdgeProxyUrl();
    if (proxyBase) {
      try {
        const qs = validId ? `ids=${validId}` : `q=${encodeURIComponent(trimmedName)}`;
        const pRes = await fetchWithTimeout(`${proxyBase}?${qs}`, undefined, 2200);
        if (pRes.ok) {
          const ct = pRes.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const pJson = await pRes.json();
            const first = Array.isArray(pJson?.seeds) ? pJson.seeds[0] : null;
            if (isUsablePortraitUrl(first?.image)) {
              savePortraitFixToCache([charId || '', normName], first.image);
              return first.image;
            }
          } else {
            edgeProxyDisabled = true;
          }
        } else if (pRes.status === 404) {
          edgeProxyDisabled = true;
        }
      } catch {
        /* fallback direto para AniList */
      }
    }

    // 2) Tenta AniList GraphQL por ID ou busca exata
    try {
      const query = validId
        ? `
          query ($id: Int, $search: String) {
            byId: Page(page: 1, perPage: 1) { characters(id: $id) { id image { large } } }
            bySearch: Page(page: 1, perPage: 1) { characters(search: $search, sort: [FAVOURITES_DESC]) { id image { large } } }
          }
        `
        : `
          query ($search: String) {
            bySearch: Page(page: 1, perPage: 1) { characters(search: $search, sort: [FAVOURITES_DESC]) { id image { large } } }
          }
        `;
      const res = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query,
            variables: validId ? { id: validId, search: trimmedName } : { search: trimmedName },
          }),
        },
        2400
      );
      if (res.ok) {
        const json = await res.json();
        const cand =
          json?.data?.byId?.characters?.[0]?.image?.large ||
          json?.data?.bySearch?.characters?.[0]?.image?.large ||
          '';
        if (isUsablePortraitUrl(cand)) {
          savePortraitFixToCache([charId || '', normName], cand);
          return cand;
        }
      }
    } catch {
      /* tenta Jikan em seguida */
    }

    // 3) Fallback Jikan (MyAnimeList)
    if (trimmedName) {
      try {
        const jRes = await fetchWithTimeout(
          `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(trimmedName)}&limit=1`,
          undefined,
          1600
        );
        if (jRes.ok) {
          const jJson = await jRes.json();
          const url = jJson?.data?.[0]?.images?.jpg?.image_url || '';
          if (isUsablePortraitUrl(url)) {
            savePortraitFixToCache([charId || '', normName], url);
            return url;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return null;
  })();

  inflightPortraitLookups.set(dedupKey, task);
  try {
    return await task;
  } finally {
    inflightPortraitLookups.delete(dedupKey);
  }
}

// Hidratação ultrarrápida (~100ms) por chave primária id_in para preencher retratos do catálogo base
async function fetchAniListSeedsByIds(ids: number[]): Promise<RawCharSeed[]> {
  if (ids.length === 0) return [];
  const seeds: RawCharSeed[] = [];
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
      const res = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables: { ids: chunk } }),
        },
        2400
      );
      if (!res.ok) continue;
      const json = await res.json();
      const list = json?.data?.Page?.characters;
      if (!Array.isArray(list)) continue;
      for (const ch of list) {
        const mapped = mapAniListNode(ch);
        if (mapped) seeds.push(mapped);
      }
    } catch {
      /* ignore timeout or rate limit */
    }
  }
  return seeds;
}

// Fallback automático para a API Jikan (MyAnimeList) quando a AniList limitar (HTTP 429) ou falhar
async function fetchJikanPagesFallback(pages: number[]): Promise<RawCharSeed[]> {
  const seeds: RawCharSeed[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = Math.max(1, pages[i]);
    const fastJikanPage = ((p - 1) % 100) + 1;
    try {
      const res = await fetchWithTimeout(
        `https://api.jikan.moe/v4/characters?page=${fastJikanPage}&limit=25&order_by=favorites&sort=desc`,
        undefined,
        1500
      );
      if (!res.ok) continue;
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      list.forEach((ch: any, idxInPage: number) => {
        if (!ch?.mal_id) return;
        const rawFav = typeof ch.favorites === 'number' && Number.isFinite(ch.favorites) ? ch.favorites : 500;
        const scaledFav = Math.round(rawFav * 0.65);
        const globalRank = Math.min(MUDAE_LEGACY_POOL_TOTAL, (p - 1) * 50 + idxInPage * 2 + 1);
        const rawImg = ch.images?.jpg?.image_url || '';
        seeds.push({
          id: `mal_${ch.mal_id}`,
          name: ch.name || 'Personagem',
          series: Array.isArray(ch.nicknames) && ch.nicknames[0] ? String(ch.nicknames[0]) : 'Anime Catalog (MAL)',
          image: isUsablePortraitUrl(rawImg) ? rawImg : '',
          gender: normalizeGender(undefined, ch.mal_id, ch.name),
          favourites: scaledFav,
          role: 'Main',
          globalRank,
        });
      });
      if (i < pages.length - 1) {
        await new Promise((r) => setTimeout(r, 260));
      }
    } catch {
      /* ignore individual page failure */
    }
  }
  return seeds;
}

// Fetch arbitrary explicit list of AniList pages (respeitando o limite de profundidade page<=100 da AniList p/ zero HTTP 400 + suporte a Proxy Edge /api/mudae)
async function fetchAniListPagesList(
  pages: number[],
  onSourceUsed?: (src: 'anilist' | 'jikan') => void
): Promise<RawCharSeed[]> {
  const cappedPages = pages.slice(0, 2);

  // Tenta Edge Proxy Serverless (/api/mudae) se ativo fora do GitHub Pages
  const proxyBase = getMudaeEdgeProxyUrl();
  if (proxyBase) {
    try {
      const res = await fetchWithTimeout(`${proxyBase}?pages=${cappedPages.join(',')}`, undefined, 2500);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          const seeds: RawCharSeed[] = Array.isArray(json?.seeds) ? json.seeds : [];
          if (seeds.length > 0) {
            for (const p of cappedPages) loadedPagesMemory.add(p);
            onSourceUsed?.(json.source === 'jikan' ? 'jikan' : 'anilist');
            return seeds;
          }
        } else {
          edgeProxyDisabled = true;
        }
      } else if (res.status === 404) {
        edgeProxyDisabled = true;
      }
    } catch {
      /* segue para chamada direta à AniList */
    }
  }

  // AniList rejeita com HTTP 400 qualquer Page(page > 100): mapeia páginas lógicas >100 para ID_DESC / ID dentro de 1..100
  const fields = cappedPages.map((p, i) => {
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
  try {
    const res = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query }),
      },
      2400
    );
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
    const json = await res.json();
    const data = json?.data || {};
    const seeds: RawCharSeed[] = [];

    for (let i = 0; i < cappedPages.length; i++) {
      const pageNum = cappedPages[i];
      loadedPagesMemory.add(pageNum);
      const list = data[`p${i}`]?.characters;
      if (!Array.isArray(list)) continue;
      list.forEach((ch: any, idxInPage: number) => {
        const globalRank = Math.min(MUDAE_LEGACY_POOL_TOTAL, (pageNum - 1) * 50 + idxInPage + 1);
        const mapped = mapAniListNode(ch, undefined, globalRank);
        if (mapped) seeds.push(mapped);
      });
    }
    if (seeds.length > 0) {
      onSourceUsed?.('anilist');
      return seeds;
    }
    throw new Error('AniList empty payload');
  } catch {
    const jikanSeeds = await fetchJikanPagesFallback(cappedPages);
    if (jikanSeeds.length > 0) {
      for (const p of cappedPages) loadedPagesMemory.add(p);
      onSourceUsed?.('jikan');
    }
    return jikanSeeds;
  }
}

async function fetchRandomUnloadedPageForTier(
  tierIndex: number,
  timeoutMs = 1400,
  secondRandomTier?: number
): Promise<RawCharSeed[]> {
  const pages = [pickRandomPageForTier(tierIndex)];
  if (secondRandomTier !== undefined) {
    const secondPage = pickRandomPageForTier(secondRandomTier);
    if (!pages.includes(secondPage)) pages.push(secondPage);
  }
  try {
    const timeoutPromise = new Promise<RawCharSeed[]>((resolve) =>
      window.setTimeout(() => resolve([]), timeoutMs)
    );
    return await Promise.race([
      fetchAniListPagesList(pages).catch(() => []),
      timeoutPromise,
    ]);
  } catch {
    return [];
  }
}

async function searchAndImportFromGlobalApi(searchTerm: string): Promise<RawCharSeed[]> {
  const q = searchTerm.trim();
  if (!q) return [];
  const collected: RawCharSeed[] = [];

  try {
    const query = `
      query ($search: String) {
        mediaPage: Page(page: 1, perPage: 4) {
          media(search: $search, type: ANIME, sort: [POPULARITY_DESC]) {
            title { romaji english }
            characters(sort: [FAVOURITES_DESC, ROLE], perPage: 25) {
              edges {
                role
                node {
                  id
                  name { full }
                  gender
                  favourites
                  image { large }
                }
              }
            }
          }
        }
        charPage: Page(page: 1, perPage: 40) {
          characters(search: $search, sort: [FAVOURITES_DESC]) {
            id
            name { full }
            gender
            favourites
            image { large }
            media(sort: [POPULARITY_DESC], perPage: 1) {
              edges {
                characterRole
                node { title { romaji english } }
              }
            }
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search: q } }),
    });
    if (res.ok) {
      const json = await res.json();
      const mediaList = json?.data?.mediaPage?.media;
      if (Array.isArray(mediaList)) {
        for (const m of mediaList) {
          const animeTitle = m?.title?.english || m?.title?.romaji || q;
          const edges = m?.characters?.edges;
          if (!Array.isArray(edges)) continue;
          for (const edge of edges) {
            if (!edge?.node?.id) continue;
            collected.push({
              id: `anilist_${edge.node.id}`,
              name: edge.node.name?.full || 'Personagem',
              series: animeTitle,
              image: edge.node.image?.large || '',
              gender: normalizeGender(edge.node.gender, edge.node.id, edge.node.name?.full),
              favourites:
                typeof edge.node.favourites === 'number' && Number.isFinite(edge.node.favourites)
                  ? edge.node.favourites
                  : 500,
              role: edge.role === 'MAIN' ? 'Main' : edge.role === 'SUPPORTING' ? 'Supporting' : undefined,
            });
          }
        }
      }

      const directChars = json?.data?.charPage?.characters;
      if (Array.isArray(directChars)) {
        for (const ch of directChars) {
          const mapped = mapAniListNode(ch, q);
          if (mapped) collected.push(mapped);
        }
      }
    }
  } catch {
    /* Try Jikan fallback */
  }

  if (collected.length < 10) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=25`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d?.data)) {
          d.data.forEach((ch: any, idx: number) => {
            if (!ch?.mal_id) return;
            collected.push({
              id: `anime_${ch.mal_id}`,
              name: ch.name || 'Personagem',
              series: Array.isArray(ch.nicknames) && ch.nicknames[0] ? ch.nicknames[0] : q,
              image: ch.images?.jpg?.image_url || '',
              gender: idx % 2 === 0 ? 'Male' : 'Female',
              favourites: typeof ch.favorites === 'number' ? ch.favorites : 600,
              role: 'Main',
            });
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return collected;
}

function generateOrbCrystal(
  tierIndex: number,
  floor6Level: number,
  bonusBoost = false
): MudaeLiveOrb {
  const pool = KAKERA_CRYSTALS.filter((c) => !c.requiresFloor6 || floor6Level >= 1 || tierIndex >= 4);
  const weighted = pool.map((c) => {
    let w = c.weight;
    if (bonusBoost && c.baseValue >= 38) w *= 2.2;
    if (tierIndex >= 3 && c.baseValue >= 22) w *= 1.4;
    return { item: c, w };
  });

  const totalW = weighted.reduce((acc, x) => acc + x.w, 0);
  let r = Math.random() * totalW;
  let picked = weighted[0].item;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) {
      picked = x.item;
      break;
    }
  }

  return {
    id: `orb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: picked.label,
    emoji: picked.emoji,
    baseValue: picked.baseValue,
    colorClass: picked.colorClass,
    glowStyle: picked.glowStyle,
  };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function parseCardMetadata(card: PokemonCard): { rank: number; favourites: number; gender: CharGender } {
  const s = String(card.setSeries || '');
  const rankMatch = s.match(/Rank\s*#(\d+)/i);
  const favMatch = s.match(/(\d+)\s*favs/i);
  const gender: CharGender = s.includes('$wa') || s.includes('Feminino')
    ? 'Female'
    : s.includes('$ha') || s.includes('Masculino')
      ? 'Male'
      : 'Other';
  return {
    rank: rankMatch ? Number(rankMatch[1]) : 450,
    favourites: favMatch ? Number(favMatch[1]) : 1000,
    gender,
  };
}

const AvatarWithFallback: React.FC<{ src: string; name: string; charId?: string; className?: string }> = ({
  src,
  name,
  charId,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (isUsablePortraitUrl(src)) return src;
    const normName = (name || '').trim().toLowerCase();
    const cached =
      (charId ? resolvedPortraitMemory.get(charId) || catalogPortraitById.get(charId) : '') ||
      (normName ? resolvedPortraitMemory.get(normName) || catalogPortraitByName.get(normName) : '');
    return isUsablePortraitUrl(cached) ? cached : '';
  });

  useEffect(() => {
    setFailed(false);
    if (isUsablePortraitUrl(src)) {
      setResolvedSrc(src);
      return;
    }
    const normName = (name || '').trim().toLowerCase();
    const immediate =
      (charId ? resolvedPortraitMemory.get(charId) || catalogPortraitById.get(charId) : '') ||
      (normName ? resolvedPortraitMemory.get(normName) || catalogPortraitByName.get(normName) : '');
    setResolvedSrc(isUsablePortraitUrl(immediate) ? immediate : '');
  }, [src, name, charId]);

  useEffect(() => {
    if (!failed && isUsablePortraitUrl(resolvedSrc)) return;
    let cancelled = false;
    resolveCharacterPortraitAuto(name, charId).then((found) => {
      if (!cancelled && isUsablePortraitUrl(found) && found !== resolvedSrc) {
        setResolvedSrc(found);
        setFailed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [failed, resolvedSrc, name, charId]);

  if (!isUsablePortraitUrl(resolvedSrc) || failed) {
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-purple-900/70 via-[#121629] to-emerald-900/50 text-white font-black font-display ${className}`}>
        <span className="text-xl sm:text-2xl tracking-wider">{initials || '★'}</span>
      </div>
    );
  }
  return <img src={resolvedSrc} alt={name} className={className} onError={() => setFailed(true)} />;
};

export default function AnimeGacha({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  userId,
  userName = 'Jogador',
  collection,
  onCollectionUpdate,
  onSellCard,
  onClearLocalCollection,
}: AnimeGachaProps) {
  const [tab, setTab] = useState<MudaeTab>('roll');
  const [catalog, setCatalog] = useState<MudaeChar[]>(() => cachedMudaeMemory || buildFallbackCatalog());
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [apiSourceStatus, setApiSourceStatus] = useState<ApiSourceStatus>('loading');
  const [expandingApi, setExpandingApi] = useState(false);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [autoWishLoading, setAutoWishLoading] = useState(false);
  const [rollingMode, setRollingMode] = useState<RollMode | null>(null);
  const [mudaeData, setMudaeData] = useState<MudaeUserData>(getDefaultMudaeUserData);
  const [serverClaims, setServerClaims] = useState<Record<string, ServerAnimeClaim>>({});
  const [serverWishCounts, setServerWishCounts] = useState<Record<string, number>>({});
  const [marketListings, setMarketListings] = useState<MudaeMarketListing[]>([]);
  const [serverLiveRolls, setServerLiveRolls] = useState<MudaeLiveRoll[]>([]);
  const [localLiveRolls, setLocalLiveRolls] = useState<MudaeLiveRoll[]>([]);
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  const [autoFocusLive, setAutoFocusLive] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [lastRollMode, setLastRollMode] = useState<RollMode>('wa');
  const [bannerToast, setBannerToast] = useState<{ text: string; tone: 'success' | 'wish' | 'warn' | 'kakera' } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [collectingOrbId, setCollectingOrbId] = useState<string | null>(null);

  // Filters & Search
  const [haremSearch, setHaremSearch] = useState('');
  const [haremSort, setHaremSort] = useState<'value' | 'rank' | 'keys'>('value');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketSort, setMarketSort] = useState<'priceAsc' | 'priceDesc' | 'value'>('priceAsc');
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null);
  const [sellModalItem, setSellModalItem] = useState<{ card: PokemonCard; baseValue: number; rank: number; series: string } | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState<string>('');
  const [listSection, setListSection] = useState<'wish' | 'disable'>('wish');
  const [wishSearch, setWishSearch] = useState('');
  const [disableSearch, setDisableSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [serverOwnerFilter, setServerOwnerFilter] = useState<string>('all');
  const [selectedCharModal, setSelectedCharModal] = useState<MudaeChar | null>(null);
  const [confirmGlobalReset, setConfirmGlobalReset] = useState(false);
  const [resettingGlobal, setResettingGlobal] = useState(false);

  const toastTimerRef = useRef<number | null>(null);
  const rollingLockRef = useRef(false);
  const prefetchedByTierRef = useRef<Record<number, MudaeChar[]>>({});
  const lastAutoWishSearchRef = useRef<string>('');
  const processedReceiptIdsRef = useRef<Set<string>>(new Set());
  const seenRemoteRollIdsRef = useRef<Set<string>>(new Set());
  const catalogRef = useRef<MudaeChar[]>(catalog);
  catalogRef.current = catalog;
  const recentLiveCharIdsRef = useRef<Set<string>>(new Set());
  recentLiveCharIdsRef.current = new Set(localLiveRolls.map((r) => r.char.id));
  const autoFocusRef = useRef(autoFocusLive);
  autoFocusRef.current = autoFocusLive;
  const wishRef = useRef<string[]>(mudaeData.wishlist);
  wishRef.current = mudaeData.wishlist;
  const { play } = useSound();

  const showToast = useCallback((text: string, tone: 'success' | 'wish' | 'warn' | 'kakera' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setBannerToast({ text, tone });
    toastTimerRef.current = window.setTimeout(() => setBannerToast(null), 5000);
  }, []);

  // 1s live timer tick for claim window (45s) and hourly reset countdown
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Load user's Mudae progression data
  useEffect(() => {
    if (!userId) return;
    getMudaeUserData(userId).then((loaded) => setMudaeData(loaded));
  }, [userId]);

  // Subscribe in realtime to server claims, wishlists, P2P market listings, sales receipts & LIVE ROLLS
  useEffect(() => {
    const unsub = subscribeToServerAnimeClaims(
      (claims, wishes, listings, unseenReceipts, liveRolls) => {
        setServerClaims(claims);
        setServerWishCounts(wishes);
        setMarketListings(listings);
        setServerLiveRolls(liveRolls);

        // Alert / auto-focus when another online user rolls in real time!
        if (liveRolls.length > 0) {
          const newest = liveRolls[0];
          const isNewRemote =
            newest.rollerUid !== userId &&
            !seenRemoteRollIdsRef.current.has(newest.instanceId) &&
            Date.now() - newest.rolledAt < 18_000;

          for (const r of liveRolls) seenRemoteRollIdsRef.current.add(r.instanceId);

          if (isNewRemote) {
            if (autoFocusRef.current) {
              setActiveRollId(newest.instanceId);
            }
            const isMyWish = wishRef.current.includes(newest.char.id);
            if (isMyWish) {
              play('legendary');
              showToast(
                `🌟 WISHLIST AO VIVO! @${newest.rollerName} acabou de rolar ${newest.char.name} — CORRE PARA CASAR!`,
                'wish'
              );
            } else if (newest.orb && !newest.orb.collectedByUid) {
              play('tick');
              showToast(
                `🔴 AO VIVO: @${newest.rollerName} rolou ${newest.char.name} com ${newest.orb.emoji} Orbe R$ ${newest.orb.baseValue.toFixed(0)}!`,
                'kakera'
              );
            }
          }
        }

        if (userId && unseenReceipts.length > 0) {
          const fresh = unseenReceipts.filter((r) => !processedReceiptIdsRef.current.has(r.id));
          if (fresh.length > 0) {
            const loadedAt = getLastUserDataLoadedAt();
            const ackIds: string[] = [];
            for (const r of fresh) {
              processedReceiptIdsRef.current.add(r.id);
              ackIds.push(r.id);
              if (r.soldAt > loadedAt) {
                onSellCard(r.cardId, r.price, true);
              }
              showToast(
                `💰 VENDA P2P! ${r.buyerName} comprou ${r.cardName} por +R$ ${r.price.toFixed(2)}!`,
                'kakera'
              );
              play('cashout');
            }
            acknowledgeMudaeSalesReceipts(userId, ackIds).catch(() => {});
          }
        }
      },
      userId
    );
    return () => unsub();
  }, [userId, onSellCard, play, showToast]);

  const syncTokenRef = useRef(0);

  const syncCatalogFromApi = useCallback(async (forceRefresh = false) => {
    const token = ++syncTokenRef.current;
    const isStale = () => syncTokenRef.current !== token;

    if (forceRefresh) {
      cachedMudaeMemory = null;
      loadedWavePageMemory = 0;
      loadedPagesMemory.clear();
      prefetchedByTierRef.current = {};
      try {
        localStorage.removeItem(CATALOG_CACHE_KEY);
      } catch {}
    }

    if (!forceRefresh && cachedMudaeMemory && cachedMudaeMemory.length >= 50) {
      indexCatalogPortraits(cachedMudaeMemory);
      setCatalog(cachedMudaeMemory);
      setApiSourceStatus('anilist');
      if (cachedMudaeMemory.length >= 400) return;
    }

    if (!forceRefresh) {
      try {
        const rawCache = localStorage.getItem(CATALOG_CACHE_KEY);
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (Array.isArray(parsed) && parsed.length >= 50) {
            const validImgCount = parsed.filter((c) => isUsablePortraitUrl(c?.image)).length;
            if (validImgCount >= 30) {
              indexCatalogPortraits(parsed);
              cachedMudaeMemory = parsed;
              loadedWavePageMemory = Math.max(loadedWavePageMemory, 220);
              for (const p of [1, 2, 4, 6, 12, 22, 35, 65]) {
                loadedPagesMemory.add(p);
              }
              setCatalog(parsed);
              setApiSourceStatus('anilist');
              if (parsed.length >= 400) return;
            }
          }
        }
      } catch { /* ignore */ }
    }

    setApiSourceStatus('loading');
    let detectedSource: 'anilist' | 'jikan' | null = null;
    const recordSource = (src: 'anilist' | 'jikan') => {
      if (!detectedSource) detectedSource = src;
      else if (detectedSource !== src && src === 'anilist') detectedSource = 'anilist';
    };

    try {
      setLoadingStatus('Carregando catálogo pré-processado...');
      const safetyBannerTimer = window.setTimeout(() => {
        if (!isStale()) setLoadingStatus('');
      }, 1400);

      // 1) Carrega instantaneamente (~30ms) o catálogo pré-processado em public/mudae-catalog.json (zero HTTP 429!)
      const staticData = await loadPrebuiltStaticCatalog();
      if (isStale()) {
        window.clearTimeout(safetyBannerTimer);
        return;
      }

      let currentCatalog = buildFallbackCatalog();
      if (staticData.seeds.length > 0) {
        currentCatalog = mergeCatalogChars(currentCatalog, staticData.seeds);
        for (const p of staticData.pagesLoaded) loadedPagesMemory.add(p);
        loadedWavePageMemory = Math.max(loadedWavePageMemory, 65);
        recordSource('anilist');
      }

      // Hidrata quaisquer IDs do catálogo base que ainda estejam sem retrato verificado
      const baseMissingIds = currentCatalog
        .filter((c) => !isUsablePortraitUrl(c.image) && c.id.startsWith('anilist_'))
        .map((c) => Number(c.id.replace('anilist_', '')))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (baseMissingIds.length > 0) {
        const hydrated = await fetchAniListSeedsByIds(baseMissingIds);
        if (!isStale() && hydrated.length > 0) {
          currentCatalog = mergeCatalogChars(currentCatalog, hydrated);
          recordSource('anilist');
        }
      }

      // Se o JSON estático ainda estiver vazio/indisponível, busca 1 onda inicial enxuta antes de liberar o spinner
      if (currentCatalog.length < 150) {
        const wave1 = await fetchAniListPagesList([1, 350], recordSource);
        if (!isStale() && wave1.length > 0) {
          currentCatalog = mergeCatalogChars(currentCatalog, wave1);
        }
      }

      window.clearTimeout(safetyBannerTimer);
      if (isStale()) return;

      cachedMudaeMemory = currentCatalog;
      setCatalog(currentCatalog);
      saveCatalogToStorage(currentCatalog);
      if (detectedSource) setApiSourceStatus(detectedSource);
      setLoadingStatus('');

      // Expansão sequencial e gentil em background (1 lote a cada 1.4s p/ evitar HTTP 429 no cliente)
      await new Promise((r) => setTimeout(r, 900));
      if (isStale()) return;

      for (const warmupTier of [0, 1]) {
        if (isStale()) return;
        try {
          const seeds = await fetchRandomUnloadedPageForTier(warmupTier, 2400);
          if (seeds.length > 0 && !isStale()) {
            prefetchedByTierRef.current[warmupTier] = buildCatalogFromSeeds(seeds);
            currentCatalog = mergeCatalogChars(catalogRef.current, seeds);
            cachedMudaeMemory = currentCatalog;
            saveCatalogToStorage(currentCatalog);
            setCatalog(currentCatalog);
            setApiSourceStatus('anilist');
          }
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      const batches: number[][] = [
        [180, 950],
        [45, 520],
        [760, 1480],
        [95, 1950],
      ];

      for (const pageBatch of batches) {
        if (isStale()) return;
        await new Promise((r) => setTimeout(r, 1400));
        if (isStale()) return;
        try {
          const batch = await fetchAniListPagesList(pageBatch, recordSource);
          if (batch.length > 0 && !isStale()) {
            currentCatalog = mergeCatalogChars(catalogRef.current, batch);
            cachedMudaeMemory = currentCatalog;
            loadedWavePageMemory = Math.max(loadedWavePageMemory, Math.max(...pageBatch));
            setCatalog(currentCatalog);
            if (detectedSource) setApiSourceStatus(detectedSource);
          }
        } catch {
          // Pula lote silenciosamente sem quebrar a fila
        }
      }

      if (!isStale() && currentCatalog.length > 0) {
        saveCatalogToStorage(currentCatalog);
        if (!detectedSource) setApiSourceStatus('fallback');
      }
    } catch {
      if (!isStale()) {
        setCatalog(buildFallbackCatalog());
        setApiSourceStatus('fallback');
      }
    } finally {
      if (!isStale()) setLoadingStatus('');
    }
  }, []);

  // Multi-wave AniList + Jikan hydration with Rank C/B majority
  useEffect(() => {
    syncCatalogFromApi(false);
    return () => {
      syncTokenRef.current += 1;
    };
  }, [syncCatalogFromApi]);

  // On-demand catalog expansion (+400 characters per click em lotes enxutos de 2 páginas)
  const handleExpandCatalog = useCallback(async () => {
    if (expandingApi) return;
    setExpandingApi(true);
    try {
      const basePage = Math.max(20, loadedWavePageMemory + 1);
      let working = catalogRef.current;
      for (let w = 0; w < 4; w++) {
        const s = basePage + w * 2;
        setLoadingStatus(`Importando mais animes (páginas ${s}–${s + 1})...`);
        const batch = await fetchAniListPagesList([s, s + 1], (src) => setApiSourceStatus(src));
        if (batch.length > 0) {
          working = mergeCatalogChars(working, batch);
          cachedMudaeMemory = working;
          loadedWavePageMemory = s + 1;
          setCatalog(working);
          saveCatalogToStorage(working);
        }
        await new Promise((r) => setTimeout(r, 650));
      }
      play('levelup');
      showToast(`🌌 Catálogo expandido! Agora há ${working.length} personagens na roleta!`, 'success');
    } catch {
      showToast('API ocupada no momento. Tente novamente em instantes.', 'warn');
    } finally {
      setLoadingStatus('');
      setExpandingApi(false);
    }
  }, [expandingApi, play, showToast]);

  // Search & inject any anime or character globally
  const handleGlobalApiSearch = useCallback(
    async (queryStr: string) => {
      const q = queryStr.trim();
      if (!q || searchingGlobal) return;
      setSearchingGlobal(true);
      try {
        const found = await searchAndImportFromGlobalApi(q);
        if (found.length === 0) {
          showToast(`Nenhum personagem encontrado na API para "${q}".`, 'warn');
          return;
        }
        const beforeCount = catalogRef.current.length;
        const merged = mergeCatalogChars(catalogRef.current, found);
        const addedCount = Math.max(0, merged.length - beforeCount);
        cachedMudaeMemory = merged;
        saveCatalogToStorage(merged);
        setCatalog(merged);
        setWishSearch(q);
        play('rare');
        showToast(
          `🎬 API Global: ${found.length} personagens de "${q}" sincronizados (${addedCount} novos na roleta)!`,
          'success'
        );
      } finally {
        setSearchingGlobal(false);
      }
    },
    [searchingGlobal, play, showToast]
  );

  const prefetchTierBuffer = useCallback((tierIdx: number) => {
    if (prefetchedByTierRef.current[tierIdx]?.length) return;
    fetchRandomUnloadedPageForTier(tierIdx, 2500)
      .then((seeds) => {
        if (seeds.length === 0) return;
        const converted = buildCatalogFromSeeds(seeds);
        prefetchedByTierRef.current[tierIdx] = converted;
        setCatalog((prev) => {
          const updated = mergeCatalogChars(prev, seeds);
          cachedMudaeMemory = updated;
          saveCatalogToStorage(updated);
          return updated;
        });
      })
      .catch(() => {});
  }, []);

  // Auto-busca silenciosa na API Global (129k+) ao digitar na Wishlist quando houver poucos resultados locais
  useEffect(() => {
    if (tab !== 'lists' || listSection !== 'wish') return;
    const q = wishSearch.trim();
    if (q.length < 3 || searchingGlobal) return;
    const lower = q.toLowerCase();
    if (lastAutoWishSearchRef.current === lower) return;

    const localHits = catalogRef.current.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.series.toLowerCase().includes(lower)
    ).length;
    if (localHits >= 4) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      lastAutoWishSearchRef.current = lower;
      setAutoWishLoading(true);
      try {
        const found = await searchAndImportFromGlobalApi(q);
        if (!cancelled && found.length > 0) {
          setCatalog((prev) => {
            const merged = mergeCatalogChars(prev, found);
            cachedMudaeMemory = merged;
            saveCatalogToStorage(merged);
            return merged;
          });
        }
      } finally {
        if (!cancelled) setAutoWishLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, listSection, wishSearch, searchingGlobal]);

  const persistMudaeData = useCallback(
    (updater: (prev: MudaeUserData) => MudaeUserData) => {
      setMudaeData((prev) => {
        const next = updater(prev);
        if (userId) saveMudaeUserData(userId, next).catch(() => {});
        return next;
      });
    },
    [userId]
  );

  // Merge server live rolls + optimistic local rolls (preferring server state so Orbs/Claims stay synchronized)
  const mergedLiveRolls = useMemo(() => {
    const map = new Map<string, MudaeLiveRoll>();
    for (const r of serverLiveRolls) {
      map.set(r.instanceId, r);
    }
    for (const r of localLiveRolls) {
      if (!map.has(r.instanceId)) {
        map.set(r.instanceId, r);
      }
    }
    return Array.from(map.values())
      .map((roll) => {
        const canon = getCanonicalMatch(roll.char.name);
        if (canon) {
          const tIdx = canon.rank <= 30 ? 4 : 3;
          return {
            ...roll,
            char: {
              ...roll.char,
              claimRank: canon.rank,
              baseValue: canon.ka,
              tierIndex: tIdx,
              tierLabel: TIER_CONFIG[tIdx].label,
            },
          };
        }
        const computed = computeMudaeValueAndTier(roll.char.claimRank, roll.char.favourites, roll.char.name);
        return {
          ...roll,
          char: {
            ...roll.char,
            baseValue: computed.baseValue,
            tierIndex: computed.tierIndex,
            tierLabel: computed.tierLabel,
          },
        };
      })
      .sort((a, b) => b.rolledAt - a.rolledAt)
      .slice(0, 16);
  }, [serverLiveRolls, localLiveRolls]);

  // Lookup helpers
  const catalogById = useMemo(() => {
    const map = new Map<string, MudaeChar>();
    for (const c of catalog) map.set(c.id, c);
    return map;
  }, [catalog]);

  const myCollectionMap = useMemo(() => {
    const map = new Map<string, PokemonCard>();
    for (const card of collection) map.set(card.id, card);
    return map;
  }, [collection]);

  const listingByCardId = useMemo(() => {
    const map = new Map<string, MudaeMarketListing>();
    for (const l of marketListings) map.set(l.cardId, l);
    return map;
  }, [marketListings]);

  const availableSeries = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; topRank: number }>();
    for (const c of catalog) {
      const existing = counts.get(c.series);
      if (existing) {
        existing.count += 1;
        existing.topRank = Math.min(existing.topRank, c.claimRank);
      } else {
        counts.set(c.series, { name: c.series, count: 1, topRank: c.claimRank });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.topRank - b.topRank);
  }, [catalog]);

  const tierCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const c of catalog) {
      if (c.tierIndex >= 0 && c.tierIndex <= 4) counts[c.tierIndex] += 1;
    }
    return counts;
  }, [catalog]);

  // Strict 5 Free Rolls + 2 Extra Rolls (R$ 100 each) per hour!
  const luckMultiplier = 1 + mudaeData.tower.floor1Rolls * 0.10;
  const tierProbabilities = useMemo(() => {
    const weights = getTierWeights(luckMultiplier);
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / total) * 100);
  }, [luckMultiplier]);
  const maxClaimsPerHour =
    1 + (mudaeData.tower.floor5Claims >= 1 ? 1 : 0) + (mudaeData.tower.floor5Claims >= 4 ? 1 : 0);
  const maxWishSlots = 5 + mudaeData.tower.floor4Slots * 2;
  const maxDisableSlots = 4 + mudaeData.tower.floor4Slots;
  const reactionMultiplier = 1 + mudaeData.tower.floor2Reaction * 0.15;
  const wishSpawnWeight = 2.5 + mudaeData.tower.floor3WishSpawn * 0.75;
  const rtCost = Math.max(45.0, Number((BASE_RT_COST - mudaeData.tower.floor5Claims * 15).toFixed(2)));

  const rollsWindowExpired =
    mudaeData.rollsWindowStart > 0 && now - mudaeData.rollsWindowStart >= HOUR_MS;
  const freeRollsUsed = rollsWindowExpired ? 0 : Math.min(MAX_FREE_ROLLS_PER_HOUR, mudaeData.rollsUsed);
  const extraRollsUsed = rollsWindowExpired ? 0 : Math.min(MAX_EXTRA_ROLLS_PER_HOUR, mudaeData.extraRollsUsed);
  const freeRollsRemaining = Math.max(0, MAX_FREE_ROLLS_PER_HOUR - freeRollsUsed);
  const extraRollsRemaining = Math.max(0, MAX_EXTRA_ROLLS_PER_HOUR - extraRollsUsed);
  const rollsResetInMs =
    mudaeData.rollsWindowStart > 0 && !rollsWindowExpired
      ? Math.max(0, mudaeData.rollsWindowStart + HOUR_MS - now)
      : 0;

  const claimsWindowExpired =
    mudaeData.claimsWindowStart > 0 && now - mudaeData.claimsWindowStart >= HOUR_MS;
  const claimsUsed = claimsWindowExpired ? 0 : mudaeData.claimsUsed;
  const claimsRemaining = Math.max(0, maxClaimsPerHour - claimsUsed);
  const claimsResetInMs =
    mudaeData.claimsWindowStart > 0 && !claimsWindowExpired
      ? Math.max(0, mudaeData.claimsWindowStart + HOUR_MS - now)
      : 0;

  const activeRoll = useMemo(
    () => mergedLiveRolls.find((r) => r.instanceId === activeRollId) || mergedLiveRolls[0] || null,
    [mergedLiveRolls, activeRollId]
  );

  // Sorteia instantaneamente (0ms) priorizando o buffer pré-carregado daquele Tier e bonecos com retrato
  const pickCharacterForRoll = useCallback(
    (
      mode: RollMode,
      targetTier?: number,
      freshTierPool?: MudaeChar[],
      fallbackCatalog?: MudaeChar[]
    ): MudaeChar => {
      const globalSource = fallbackCatalog || catalogRef.current;
      const disabledSet = new Set(mudaeData.disablelist);
      const wishSet = new Set(mudaeData.wishlist);

      const filterByModeAndDisable = (list: MudaeChar[], applyDisable = true) =>
        list.filter((c) => {
          if (mode === 'wa' && c.gender !== 'Female') return false;
          if (mode === 'ha' && c.gender !== 'Male') return false;
          return applyDisable ? !disabledSet.has(c.series) : true;
        });

      const primaryBase = freshTierPool && freshTierPool.length > 0 ? freshTierPool : globalSource;
      let pool = filterByModeAndDisable(primaryBase, true);
      if (pool.length === 0) pool = filterByModeAndDisable(globalSource, true);
      if (pool.length === 0) pool = filterByModeAndDisable(globalSource, false);
      if (pool.length === 0) pool = globalSource;

      const globalFiltered = filterByModeAndDisable(globalSource, true);
      const wishMatchesGlobal = globalFiltered.filter((c) => wishSet.has(c.id));

      if (targetTier !== undefined) {
        // Pequeno bônus de Wishlist cross-tier (+0,35% por wish, máx 1,5%) sem quebrar raridade
        const upgradeChance = Math.min(0.015, wishMatchesGlobal.length * 0.0035);
        if (wishMatchesGlobal.length > 0 && Math.random() < upgradeChance) {
          const wishWithImg = wishMatchesGlobal.filter((c) => Boolean(c.image));
          const wishPool = wishWithImg.length > 0 ? wishWithImg : wishMatchesGlobal;
          return wishPool[Math.floor(Math.random() * wishPool.length)];
        }

        let candidatePool = pool.filter((c) => c.tierIndex === targetTier);

        // Injeta desejos da Wishlist que pertençam ao mesmo tier para que possam sair no roll daquele tier
        if (candidatePool.length > 0) {
          const sameTierWishes = wishMatchesGlobal.filter((c) => c.tierIndex === targetTier);
          const seenIds = new Set(candidatePool.map((c) => c.id));
          for (const w of sameTierWishes) {
            if (!seenIds.has(w.id)) {
              candidatePool.push(w);
              seenIds.add(w.id);
            }
          }
        }

        if (candidatePool.length === 0) {
          candidatePool = globalFiltered.filter((c) => c.tierIndex === targetTier);
        }
        if (candidatePool.length === 0) {
          for (let t = targetTier - 1; t >= 0; t--) {
            candidatePool = globalFiltered.filter((c) => c.tierIndex === t);
            if (candidatePool.length > 0) break;
          }
        }
        if (candidatePool.length === 0) {
          for (let t = targetTier + 1; t <= 4; t++) {
            candidatePool = globalFiltered.filter((c) => c.tierIndex === t);
            if (candidatePool.length > 0) break;
          }
        }
        if (candidatePool.length === 0) candidatePool = pool;

        // Prioriza personagens com foto carregada e evita repetir cards ainda no palco ao vivo
        const withImages = candidatePool.filter((c) => Boolean(c.image));
        if (withImages.length > 0) candidatePool = withImages;
        const unseenInLive = candidatePool.filter((c) => !recentLiveCharIdsRef.current.has(c.id));
        if (unseenInLive.length > 0) candidatePool = unseenInLive;

        const weightedTier = candidatePool.map((c) => ({
          char: c,
          weight: wishSet.has(c.id) ? wishSpawnWeight : 1,
        }));
        const totalTierW = weightedTier.reduce((sum, x) => sum + x.weight, 0);
        let tr = Math.random() * totalTierW;
        for (const item of weightedTier) {
          tr -= item.weight;
          if (tr <= 0) return item.char;
        }
        return candidatePool[Math.floor(Math.random() * candidatePool.length)];
      }

      let finalPool = pool;
      const poolWithImages = finalPool.filter((c) => Boolean(c.image));
      if (poolWithImages.length > 0) finalPool = poolWithImages;
      const poolUnseen = finalPool.filter((c) => !recentLiveCharIdsRef.current.has(c.id));
      if (poolUnseen.length > 0) finalPool = poolUnseen;

      const tierWeights = getTierWeights(luckMultiplier);
      const weighted = finalPool.map((c) => {
        let weight = tierWeights[c.tierIndex] ?? 0.5;
        if (wishSet.has(c.id)) {
          weight *= wishSpawnWeight;
        }
        return { char: c, weight };
      });

      const totalW = weighted.reduce((sum, x) => sum + x.weight, 0);
      let r = Math.random() * totalW;
      for (const item of weighted) {
        r -= item.weight;
        if (r <= 0) return item.char;
      }
      return finalPool[Math.floor(Math.random() * finalPool.length)];
    },
    [mudaeData.disablelist, mudaeData.wishlist, luckMultiplier, wishSpawnWeight]
  );

  const performRoll = useCallback(
    (mode: RollMode) => {
      if (rollingLockRef.current) return;

      const usingPaidExtra = freeRollsRemaining <= 0;

      if (usingPaidExtra) {
        if (extraRollsRemaining <= 0) {
          play('lose');
          showToast(
            `⏳ Limite de ${MAX_FREE_ROLLS_PER_HOUR} Grátis + ${MAX_EXTRA_ROLLS_PER_HOUR} Extras atingido! Aguarde ${formatCountdown(rollsResetInMs)} ou dispute nos rolls ao vivo do servidor!`,
            'warn'
          );
          return;
        }
        if (balance < EXTRA_ROLL_COST) {
          play('lose');
          showToast(`Saldo insuficiente para Roll Extra (R$ ${EXTRA_ROLL_COST.toFixed(2)}).`, 'warn');
          return;
        }
      }

      rollingLockRef.current = true;
      setRollingMode(mode);

      try {
        const targetTier = pickTargetTierIndex(luckMultiplier);
        const workingCatalog = catalogRef.current;
        let freshTierBatch: MudaeChar[] | undefined;

        // Execução 100% instantânea (0ms): usa buffer pré-carregado se pronto ou catálogo atual; busca novas páginas só em background
        const buffered = prefetchedByTierRef.current[targetTier];
        if (buffered && buffered.length > 0) {
          freshTierBatch = buffered;
          delete prefetchedByTierRef.current[targetTier];
        }
        prefetchTierBuffer(targetTier);

        if (workingCatalog.length === 0) return;

        if (usingPaidExtra) {
          onUpdateBalance(-EXTRA_ROLL_COST);
        }

        const rolledAt = Date.now();
        const windowExpired = mudaeData.rollsWindowStart === 0 || rolledAt - mudaeData.rollsWindowStart >= HOUR_MS;
        const nextRollsWindowStart = windowExpired ? rolledAt : mudaeData.rollsWindowStart;
        const nextFreeUsed = windowExpired ? (usingPaidExtra ? 0 : 1) : (usingPaidExtra ? freeRollsUsed : freeRollsUsed + 1);
        const nextExtraUsed = windowExpired ? (usingPaidExtra ? 1 : 0) : (usingPaidExtra ? extraRollsUsed + 1 : extraRollsUsed);

        setMudaeData((prev) => ({
          ...prev,
          rollsWindowStart: nextRollsWindowStart,
          rollsUsed: nextFreeUsed,
          extraRollsUsed: nextExtraUsed,
        }));

        setTab('roll');
        setLastRollMode(mode);
        const char = pickCharacterForRoll(mode, targetTier, freshTierBatch, workingCatalog);
        recentLiveCharIdsRef.current.add(char.id);
        const isWish = mudaeData.wishlist.includes(char.id);
        const myOwned = myCollectionMap.get(char.id);
        const serverOwner = serverClaims[char.id];
        const alreadyMarriedInServer = Boolean(myOwned || serverOwner);

        let grantedKeyHere = 0;
        if (myOwned) {
          const bonusKeyChance = mudaeData.tower.floor6Rainbow * 0.12;
          const gainedKeys = Math.random() < bonusKeyChance ? 2 : 1;
          grantedKeyHere = gainedKeys;
          const cardsToAdd: PokemonCard[] = [];
          for (let i = 0; i < gainedKeys; i++) {
            cardsToAdd.push({
              id: char.id,
              name: char.name,
              imageUrl: char.image,
              rarity: char.tierLabel,
              setName: char.series,
              setSeries: `Rank #${char.claimRank} • ${char.gender === 'Female' ? '$wa Feminino' : char.gender === 'Male' ? '$ha Masculino' : '$ma Especial'} • ${char.favourites} favs`,
              quantity: 1,
            });
          }
          onCollectionUpdate(cardsToAdd);
        }

        // 100% chance of Orb on married rolls, 65% chance on free rolls for intense server competition!
        const orb =
          alreadyMarriedInServer || Math.random() < 0.65
            ? generateOrbCrystal(char.tierIndex, mudaeData.tower.floor6Rainbow, Boolean(myOwned))
            : null;

        const liveRoll: MudaeLiveRoll = {
          instanceId: `roll-${userId.slice(0, 5)}-${rolledAt}-${Math.random().toString(36).slice(2, 6)}`,
          rollerUid: userId,
          rollerName: userName,
          mode,
          rolledAt,
          expiresAt: rolledAt + CLAIM_WINDOW_MS,
          char: {
            id: char.id,
            name: char.name,
            series: char.series,
            image: char.image,
            gender: char.gender,
            favourites: char.favourites,
            claimRank: char.claimRank,
            baseValue: char.baseValue,
            tierIndex: char.tierIndex,
            tierLabel: char.tierLabel,
          },
          ...(grantedKeyHere > 0 ? { grantedKeyToRoller: grantedKeyHere } : {}),
          orb,
        };

        setLocalLiveRolls((prev) => [liveRoll, ...prev].slice(0, 8));
        setActiveRollId(liveRoll.instanceId);

        // Broadcast live roll to ALL online Firebase users immediately!
        if (userId) {
          publishLiveMudaeRoll(userId, liveRoll, {
            rollsWindowStart: nextRollsWindowStart,
            rollsUsed: nextFreeUsed,
            extraRollsUsed: nextExtraUsed,
          }).catch(() => {});
        }

        if (isWish) {
          play('legendary');
          showToast(`🌟 ALERTA DE WISHLIST! ${char.name} (#${char.claimRank} • R$ ${char.baseValue.toFixed(0)}) apareceu!`, 'wish');
        } else if (myOwned) {
          play('rare');
          showToast(
            `🔑 Chaos Key +${grantedKeyHere} em ${char.name}! Valor +${grantedKeyHere * 10}% + Orbe R$ no servidor!`,
            'kakera'
          );
        } else if (char.tierIndex >= 3) {
          play('legendary');
          showToast(`🔥 ${char.tierLabel.toUpperCase()}! ${char.name} (R$ ${char.baseValue.toFixed(2)}) apareceu ao vivo!`, 'wish');
        } else {
          play('cardFlip');
        }

        // Pré-busca em background do próximo Tier provável para manter o pool sempre renovado
        const nextPrefetchTier = pickTargetTierIndex(luckMultiplier);
        prefetchTierBuffer(nextPrefetchTier);
      } finally {
        rollingLockRef.current = false;
        setRollingMode(null);
      }
    },
    [
      freeRollsRemaining,
      extraRollsRemaining,
      rollsResetInMs,
      balance,
      luckMultiplier,
      mudaeData.disablelist,
      mudaeData.rollsWindowStart,
      mudaeData.wishlist,
      mudaeData.tower.floor6Rainbow,
      onUpdateBalance,
      freeRollsUsed,
      extraRollsUsed,
      pickCharacterForRoll,
      prefetchTierBuffer,
      myCollectionMap,
      serverClaims,
      onCollectionUpdate,
      userId,
      userName,
      play,
      showToast,
    ]
  );

  // Claim / Snipe Marriage on any Live Roll (own or another online player's roll!)
  const handleClaimLiveRoll = useCallback(
    async (roll: MudaeLiveRoll) => {
      if (claimingId) return;
      const char = roll.char;
      const ts = Date.now();

      if (ts > roll.expiresAt) {
        play('lose');
        showToast(`⏳ O tempo de 45s para casar com ${char.name} expirou!`, 'warn');
        return;
      }

      if (roll.claimedByUid || myCollectionMap.has(char.id) || serverClaims[char.id]) {
        const owner = roll.claimedByName || serverClaims[char.id]?.ownerName || 'alguém';
        play('lose');
        showToast(`💍 ${char.name} já foi reivindicado(a) por ${owner}!`, 'warn');
        return;
      }

      if (claimsRemaining <= 0) {
        play('lose');
        showToast(
          `💔 Você está sem Claim! Use "$rt" (R$ ${rtCost.toFixed(2)}) ou aguarde ${formatCountdown(claimsResetInMs)}.`,
          'warn'
        );
        return;
      }

      setClaimingId(roll.instanceId);
      try {
        const lockResult = await markLiveMudaeRollClaimed(userId, userName, roll);
        if (!lockResult.ok) {
          play('lose');
          showToast(
            `💔 Tarde demais! ${lockResult.alreadyTakenBy} foi mais rápido e casou com ${char.name}!`,
            'warn'
          );
          return;
        }

        const newCard: PokemonCard = {
          id: char.id,
          name: char.name,
          imageUrl: char.image,
          rarity: char.tierLabel,
          setName: char.series,
          setSeries: `Rank #${char.claimRank} • ${char.gender === 'Female' ? '$wa Feminino' : char.gender === 'Male' ? '$ha Masculino' : '$ma Especial'} • ${char.favourites} favs`,
          quantity: 1,
        };
        onCollectionUpdate([newCard]);

        persistMudaeData((prev) => {
          const expired = prev.claimsWindowStart === 0 || ts - prev.claimsWindowStart >= HOUR_MS;
          return {
            ...prev,
            claimsWindowStart: expired ? ts : prev.claimsWindowStart,
            claimsUsed: expired ? 1 : prev.claimsUsed + 1,
            wishlist: prev.wishlist.filter((id) => id !== char.id),
          };
        });

        setLocalLiveRolls((prev) =>
          prev.map((r) =>
            r.instanceId === roll.instanceId ? { ...r, claimedByUid: userId, claimedByName: userName } : r
          )
        );

        if (onAddBetHistory) {
          onAddBetHistory({
            id: `mudae-claim-${ts}`,
            matchName: roll.rollerUid === userId ? 'Mudae Bot ($claim)' : `Mudae Snipe (@${roll.rollerName})`,
            selectionName: `${char.name} (${char.series})`,
            odds: 0,
            stake: 0,
            potentialPayout: char.baseValue,
            status: 'won',
            placedAt: new Date().toLocaleTimeString('pt-BR'),
            type: 'casino',
            outcomeValue: `Rank #${char.claimRank}`,
          });
        }

        play(char.tierIndex >= 3 ? 'legendary' : 'win');
        if (roll.rollerUid !== userId) {
          showToast(
            `⚡ SNIPE ÉPICO! Você casou com ${char.name} (R$ ${char.baseValue.toFixed(2)}) antes de @${roll.rollerName}!`,
            'success'
          );
        } else {
          showToast(
            `💖 Casamento confirmado! ${char.name} (R$ ${char.baseValue.toFixed(2)}) agora é exclusivamente seu!`,
            'success'
          );
        }
      } finally {
        setClaimingId(null);
      }
    },
    [
      claimingId,
      myCollectionMap,
      serverClaims,
      claimsRemaining,
      rtCost,
      claimsResetInMs,
      userId,
      userName,
      onCollectionUpdate,
      persistMudaeData,
      onAddBetHistory,
      play,
      showToast,
    ]
  );

  // Competitive Orb Collection across all online players!
  const handleCollectLiveOrb = useCallback(
    async (roll: MudaeLiveRoll) => {
      if (!roll.orb || roll.orb.collectedByUid || collectingOrbId) return;

      setCollectingOrbId(roll.instanceId);
      try {
        const res = await collectLiveMudaeOrb(userId, userName, roll);
        if (!res.ok) {
          play('lose');
          showToast(
            `💨 Quase! ${res.alreadyTakenBy || 'Outro jogador'} pegou o Orbe antes de você!`,
            'warn'
          );
          return;
        }

        const myOwned = myCollectionMap.get(roll.char.id);
        const serverOwner = serverClaims[roll.char.id];
        const keys = myOwned?.quantity || serverOwner?.keys || 1;
        const keyBonus = 1 + Math.min(0.6, Math.max(0, keys - 1) * 0.1);
        const payout = Number((roll.orb.baseValue * reactionMultiplier * keyBonus).toFixed(2));

        setLocalLiveRolls((prev) =>
          prev.map((r) =>
            r.instanceId === roll.instanceId && r.orb
              ? { ...r, orb: { ...r.orb, collectedByUid: userId, collectedByName: userName } }
              : r
          )
        );

        onUpdateBalance(payout);
        persistMudaeData((prev) => ({
          ...prev,
          totalReactionsCollected: prev.totalReactionsCollected + 1,
          totalKakeraEarned: Number((prev.totalKakeraEarned + payout).toFixed(2)),
        }));

        play('cashout');
        if (roll.rollerUid !== userId) {
          showToast(
            `⚡ ROUBO AO VIVO! Você pegou ${roll.orb.emoji} ${roll.orb.label} de @${roll.rollerName} (+R$ ${payout.toFixed(2)})!`,
            'kakera'
          );
        } else {
          showToast(
            `${roll.orb.emoji} Orbe coletado! +R$ ${payout.toFixed(2)} no seu saldo!`,
            'kakera'
          );
        }
      } finally {
        setCollectingOrbId(null);
      }
    },
    [
      collectingOrbId,
      userId,
      userName,
      myCollectionMap,
      serverClaims,
      reactionMultiplier,
      onUpdateBalance,
      persistMudaeData,
      play,
      showToast,
    ]
  );

  // Reset claim ($rt)
  const handleResetClaim = useCallback(() => {
    if (claimsRemaining > 0) {
      showToast('Você ainda tem Claim disponível neste ciclo!', 'warn');
      return;
    }
    if (balance < rtCost) {
      play('lose');
      showToast(`Saldo insuficiente para usar $rt (Custo: R$ ${rtCost.toFixed(2)}).`, 'warn');
      return;
    }
    onUpdateBalance(-rtCost);
    persistMudaeData((prev) => ({
      ...prev,
      claimsUsed: Math.max(0, prev.claimsUsed - 1),
      lastRtUsed: Date.now(),
    }));
    play('levelup');
    showToast(`⚡ $rt ativado (-R$ ${rtCost.toFixed(2)})! +1 Claim liberado imediatamente!`, 'success');
  }, [claimsRemaining, balance, rtCost, onUpdateBalance, persistMudaeData, play, showToast]);

  // P2P Market
  const handleOpenSellModal = (card: PokemonCard, baseValue: number, rank: number, series: string) => {
    setSellModalItem({ card, baseValue, rank, series });
    setSellPriceInput(Number((baseValue * 1.5).toFixed(2)).toString());
  };

  const handleConfirmListForSale = async () => {
    if (!sellModalItem || !userId) return;
    const parsedPrice = Number(sellPriceInput.replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 1) {
      showToast('Digite um preço válido a partir de R$ 1,00.', 'warn');
      return;
    }
    const created = await listMudaeCharacterForSale(userId, userName, {
      card: sellModalItem.card,
      price: parsedPrice,
      rank: sellModalItem.rank,
      series: sellModalItem.series,
      baseValue: sellModalItem.baseValue,
    });
    setMudaeData((prev) => ({
      ...prev,
      marketListings: [created, ...prev.marketListings.filter((l) => l.cardId !== created.cardId)],
    }));
    setSellModalItem(null);
    play('levelup');
    showToast(`🏷️ ${created.card.name} anunciado no Mercado P2P por R$ ${created.price.toFixed(2)}!`, 'success');
  };

  const handleCancelListing = async (cardId: string, cardName: string) => {
    if (!userId) return;
    await cancelMudaeMarketListing(userId, cardId);
    setMudaeData((prev) => ({
      ...prev,
      marketListings: prev.marketListings.filter((l) => l.cardId !== cardId),
    }));
    play('click');
    showToast(`🚫 Anúncio de ${cardName} removido do Mercado P2P.`, 'warn');
  };

  const handleBuyMarketListing = async (listing: MudaeMarketListing) => {
    if (!userId || buyingListingId) return;
    if (listing.sellerUid === userId) {
      showToast('Você já é dono deste anúncio.', 'warn');
      return;
    }
    if (balance < listing.price) {
      play('lose');
      showToast(`Saldo insuficiente! Você precisa de R$ ${listing.price.toFixed(2)}.`, 'warn');
      return;
    }

    setBuyingListingId(listing.id);
    try {
      const res = await buyMudaeMarketListing(userId, userName, listing);
      if (!res.ok || !res.card) {
        play('lose');
        showToast(res.error || 'Não foi possível concluir a compra.', 'warn');
        return;
      }

      onUpdateBalance(-listing.price);
      const qty = Math.max(1, res.card.quantity || 1);
      const cardsToGrant: PokemonCard[] = [];
      for (let i = 0; i < qty; i++) {
        cardsToGrant.push({ ...res.card, quantity: 1 });
      }
      onCollectionUpdate(cardsToGrant);

      persistMudaeData((prev) => ({
        ...prev,
        wishlist: prev.wishlist.filter((id) => id !== listing.cardId),
      }));

      if (onAddBetHistory) {
        onAddBetHistory({
          id: `mudae-buy-${Date.now()}`,
          matchName: 'Mudae Mercado P2P ($market)',
          selectionName: `${res.card.name} (de ${listing.sellerName})`,
          odds: 0,
          stake: listing.price,
          potentialPayout: listing.baseValue,
          status: 'won',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: 'Comprado',
        });
      }

      play('win');
      showToast(
        `🛒 Compra P2P concluída! ${res.card.name} agora é seu (pago R$ ${listing.price.toFixed(2)} para ${listing.sellerName})!`,
        'success'
      );
    } finally {
      setBuyingListingId(null);
    }
  };

  // Toggle wishlist
  const toggleWishlist = useCallback(
    (char: { id: string; name: string }) => {
      const exists = mudaeData.wishlist.includes(char.id);
      if (!exists && mudaeData.wishlist.length >= maxWishSlots) {
        play('lose');
        showToast(
          `Lista cheia (${mudaeData.wishlist.length}/${maxWishSlots}). Evolua o Andar 4 da Torre R$ ou remova alguém!`,
          'warn'
        );
        return;
      }
      persistMudaeData((prev) => ({
        ...prev,
        wishlist: exists ? prev.wishlist.filter((id) => id !== char.id) : [...prev.wishlist, char.id],
      }));
      play('click');
      showToast(
        exists
          ? `${char.name} removido(a) da Wishlist.`
          : `🌟 ${char.name} adicionado(a) à Wishlist (Peso ×${wishSpawnWeight.toFixed(2)})!`,
        exists ? 'warn' : 'wish'
      );
    },
    [mudaeData.wishlist, maxWishSlots, persistMudaeData, play, showToast, wishSpawnWeight]
  );

  // Toggle disablelist
  const toggleDisableSeries = useCallback(
    (seriesName: string) => {
      const exists = mudaeData.disablelist.includes(seriesName);
      if (!exists && mudaeData.disablelist.length >= maxDisableSlots) {
        play('lose');
        showToast(
          `Disablelist cheia (${mudaeData.disablelist.length}/${maxDisableSlots}). Evolua o Andar 4 da Torre R$!`,
          'warn'
        );
        return;
      }
      persistMudaeData((prev) => ({
        ...prev,
        disablelist: exists
          ? prev.disablelist.filter((s) => s !== seriesName)
          : [...prev.disablelist, seriesName],
      }));
      play('click');
      showToast(
        exists ? `✅ Série "${seriesName}" reativada.` : `🚫 Série "${seriesName}" bloqueada ($disable)!`,
        'success'
      );
    },
    [mudaeData.disablelist, maxDisableSlots, persistMudaeData, play, showToast]
  );

  // Tower
  const handleBuildTowerFloor = useCallback(
    (floor: TowerFloorDef) => {
      const currentLevel = mudaeData.tower[floor.key];
      if (currentLevel >= 5) return;
      const cost = getFloorUpgradeCost(floor, currentLevel);
      if (balance < cost) {
        play('lose');
        showToast(`Saldo insuficiente para Andar ${floor.floorNum} (Custo: R$ ${cost.toFixed(2)}).`, 'warn');
        return;
      }
      onUpdateBalance(-cost);
      persistMudaeData((prev) => ({
        ...prev,
        tower: { ...prev.tower, [floor.key]: prev.tower[floor.key] + 1 },
        totalInvestedTower: Number((prev.totalInvestedTower + cost).toFixed(2)),
      }));
      if (onAddBetHistory) {
        onAddBetHistory({
          id: `mudae-tower-${Date.now()}`,
          matchName: 'Mudae Torre R$ ($kt)',
          selectionName: `${floor.title} (Nível ${currentLevel + 1})`,
          odds: 0,
          stake: cost,
          potentialPayout: 0,
          status: 'won',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: `Nível ${currentLevel + 1}`,
        });
      }
      play('levelup');
      showToast(`🏰 ${floor.title} evoluído para Nível ${currentLevel + 1}!`, 'success');
    },
    [mudaeData.tower, balance, onUpdateBalance, persistMudaeData, onAddBetHistory, play, showToast]
  );

  const handleDestroyTower = useCallback(() => {
    const refund = mudaeData.totalInvestedTower;
    if (refund <= 0) return;
    onUpdateBalance(refund);
    persistMudaeData((prev) => ({
      ...prev,
      tower: {
        floor1Rolls: 0,
        floor2Reaction: 0,
        floor3WishSpawn: 0,
        floor4Slots: 0,
        floor5Claims: 0,
        floor6Rainbow: 0,
      },
      totalInvestedTower: 0,
    }));
    play('cashout');
    showToast(`🧨 Torre demolida ($destroy)! Reembolso integral de +R$ ${refund.toFixed(2)} creditado!`, 'kakera');
  }, [mudaeData.totalInvestedTower, onUpdateBalance, persistMudaeData, play, showToast]);

  // Divorce ($divorce)
  const handleDivorce = useCallback(
    async (card: PokemonCard, payoutValue: number) => {
      if (userId) await cancelMudaeMarketListing(userId, card.id).catch(() => {});
      onSellCard(card.id, payoutValue, true);
      setServerClaims((prev) => {
        if (prev[card.id]?.ownerUid !== userId) return prev;
        const copy = { ...prev };
        delete copy[card.id];
        return copy;
      });
      play('cashout');
      showToast(`💔 Você divorciou de ${card.name} ($divorce) e recebeu +R$ ${payoutValue.toFixed(2)}!`, 'kakera');
    },
    [onSellCard, userId, play, showToast]
  );

  const handleGlobalResetCollections = async () => {
    if (!confirmGlobalReset) {
      setConfirmGlobalReset(true);
      window.setTimeout(() => setConfirmGlobalReset(false), 5000);
      return;
    }
    setResettingGlobal(true);
    try {
      const updatedUsers = await resetAllUsersMudaeCollections();
      if (onClearLocalCollection) onClearLocalCollection();
      setLocalLiveRolls([]);
      setServerLiveRolls([]);
      setConfirmGlobalReset(false);
      play('levelup');
      showToast(`🧹 Coleções Mudae de ${updatedUsers} usuários resetadas no Firebase!`, 'success');
    } catch {
      showToast('Erro ao resetar coleções globais no Firebase.', 'warn');
    } finally {
      setResettingGlobal(false);
    }
  };

  // Discord Command Bar
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput.trim();
    if (!raw) return;
    const normalized = raw.toLowerCase();
    const cmd = normalized.split(/\s+/)[0];
    const arg = raw.slice(cmd.length).trim();
    setCommandInput('');

    if (cmd === '$wa' || cmd === '/wa' || cmd === '$w' || cmd === '/w') {
      performRoll('wa');
      return;
    }
    if (cmd === '$ha' || cmd === '/ha' || cmd === '$h' || cmd === '/h') {
      performRoll('ha');
      return;
    }
    if (cmd === '$ma' || cmd === '/ma' || cmd === '$m' || cmd === '/m') {
      performRoll('ma');
      return;
    }
    if (cmd === '$claim' || cmd === '/claim' || cmd === '$marry' || cmd === '/marry') {
      if (activeRoll) handleClaimLiveRoll(activeRoll);
      else showToast('Nenhum roll ativo no palco para casar!', 'warn');
      return;
    }
    if (cmd === '$rt' || cmd === '/rt') {
      handleResetClaim();
      return;
    }
    if (cmd === '$mm' || cmd === '/mm' || cmd === '$harem') {
      setTab('harem');
      play('click');
      return;
    }
    if (cmd === '$market' || cmd === '/market' || cmd === '$loja' || cmd === '$sell') {
      setTab('market');
      play('click');
      return;
    }
    if (cmd === '$kt' || cmd === '/kt' || cmd === '$tower' || cmd === 'r$tower') {
      setTab('tower');
      play('click');
      return;
    }
    if (cmd === '$anime' || cmd === '/anime' || cmd === '$search' || cmd === '/search') {
      setTab('lists');
      setListSection('wish');
      if (arg) handleGlobalApiSearch(arg);
      return;
    }
    if (cmd === '$wish' || cmd === '/wish' || cmd === '$wl' || cmd === '/wl') {
      setTab('lists');
      setListSection('wish');
      if (arg) {
        setWishSearch(arg);
        handleGlobalApiSearch(arg);
      }
      play('click');
      return;
    }
    if (cmd === '$disable' || cmd === '/disable' || cmd === '$dl' || cmd === '/dl') {
      setTab('lists');
      setListSection('disable');
      if (arg) setDisableSearch(arg);
      play('click');
      return;
    }
    if (cmd === '$server' || cmd === '/server' || cmd === '$top' || cmd === '/top') {
      setTab('server');
      play('click');
      return;
    }

    showToast(
      `Comando "${raw}" desconhecido. Use $wa, $ha, $ma, $claim, $rt, $mm, $market, $kt, $wish, $anime <nome> ou $disable.`,
      'warn'
    );
  };

  // Enrich personal harem cards
  const enrichedHarem = useMemo(() => {
    const list = collection.map((card) => {
      const cat = catalogById.get(card.id);
      const parsed = parseCardMetadata(card);
      const rank = getCanonicalMatch(card.name)?.rank ?? cat?.claimRank ?? parsed.rank;
      const favourites = cat?.favourites ?? parsed.favourites;
      const gender = cat?.gender ?? parsed.gender;
      const tierInfo = cat
        ? { baseValue: cat.baseValue, tierIndex: cat.tierIndex, tierLabel: cat.tierLabel }
        : computeMudaeValueAndTier(rank, favourites, card.name);
      const keys = Math.max(1, card.quantity || 1);
      const divorceValue = getEffectiveValue(tierInfo.baseValue, keys);
      const activeListing = listingByCardId.get(card.id);
      return {
        card,
        rank,
        favourites,
        gender,
        series: cat?.series || card.setName || 'Anime',
        image: cat?.image || card.imageUrl,
        baseValue: tierInfo.baseValue,
        tierIndex: tierInfo.tierIndex,
        tierLabel: tierInfo.tierLabel,
        keys,
        divorceValue,
        activeListing,
      };
    });

    const filtered = haremSearch.trim()
      ? list.filter(
          (x) =>
            x.card.name.toLowerCase().includes(haremSearch.toLowerCase()) ||
            x.series.toLowerCase().includes(haremSearch.toLowerCase())
        )
      : list;

    return filtered.sort((a, b) => {
      if (haremSort === 'rank') return a.rank - b.rank;
      if (haremSort === 'keys') return b.keys - a.keys || b.divorceValue - a.divorceValue;
      return b.divorceValue - a.divorceValue;
    });
  }, [collection, catalogById, listingByCardId, haremSearch, haremSort]);

  const totalHaremValue = useMemo(
    () => enrichedHarem.reduce((sum, x) => sum + x.divorceValue, 0),
    [enrichedHarem]
  );

  const totalChaosKeys = useMemo(
    () => enrichedHarem.reduce((sum, x) => sum + Math.max(0, x.keys - 1), 0),
    [enrichedHarem]
  );

  const filteredMarketListings = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    const enriched = marketListings.map((l) => {
      const cat = catalogById.get(l.cardId);
      const parsed = parseCardMetadata(l.card);
      const rank = getCanonicalMatch(l.card.name)?.rank ?? cat?.claimRank ?? l.rank ?? parsed.rank;
      const favs = cat?.favourites ?? parsed.favourites;
      const tierInfo = cat
        ? { baseValue: cat.baseValue, tierIndex: cat.tierIndex, tierLabel: cat.tierLabel }
        : computeMudaeValueAndTier(rank, favs, l.card.name);
      return {
        ...l,
        image: cat?.image || l.card.imageUrl,
        series: cat?.series || l.series || l.card.setName,
        rank,
        tierIndex: tierInfo.tierIndex,
        currentBaseValue: getEffectiveValue(tierInfo.baseValue, l.card.quantity || 1),
      };
    });

    const filtered = q
      ? enriched.filter(
          (l) =>
            l.card.name.toLowerCase().includes(q) ||
            l.series.toLowerCase().includes(q) ||
            l.sellerName.toLowerCase().includes(q)
        )
      : enriched;

    return filtered.sort((a, b) => {
      if (marketSort === 'priceDesc') return b.price - a.price;
      if (marketSort === 'value') return b.currentBaseValue - a.currentBaseValue;
      return a.price - b.price;
    });
  }, [marketListings, catalogById, marketSearch, marketSort]);

  const serverClaimsList = useMemo(() => {
    return (Object.values(serverClaims) as ServerAnimeClaim[])
      .map((claim) => {
        const cat = catalogById.get(claim.cardId);
        const rank = getCanonicalMatch(claim.name)?.rank ?? cat?.claimRank ?? 350;
        const favs = cat?.favourites ?? 2000;
        const valInfo = cat
          ? { baseValue: cat.baseValue, tierIndex: cat.tierIndex, tierLabel: cat.tierLabel }
          : computeMudaeValueAndTier(rank, favs, claim.name);
        return {
          ...claim,
          image: cat?.image || claim.image,
          series: cat?.series || claim.series,
          rank,
          tierIndex: valInfo.tierIndex,
          tierLabel: valInfo.tierLabel,
          effectiveValue: getEffectiveValue(valInfo.baseValue, claim.keys),
        };
      })
      .sort((a, b) => b.effectiveValue - a.effectiveValue);
  }, [serverClaims, catalogById]);

  const serverOwners = useMemo(() => {
    const map = new Map<string, { uid: string; name: string; count: number; value: number }>();
    for (const c of serverClaimsList) {
      const prev = map.get(c.ownerUid);
      if (prev) {
        prev.count += 1;
        prev.value += c.effectiveValue;
      } else {
        map.set(c.ownerUid, { uid: c.ownerUid, name: c.ownerName, count: 1, value: c.effectiveValue });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [serverClaimsList]);

  const filteredServerClaims = useMemo(() => {
    return serverClaimsList.filter((c) => {
      if (serverOwnerFilter !== 'all' && c.ownerUid !== serverOwnerFilter) return false;
      if (!serverSearch.trim()) return true;
      const q = serverSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.series.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q)
      );
    });
  }, [serverClaimsList, serverOwnerFilter, serverSearch]);

  const wishCatalogResults = useMemo(() => {
    const q = wishSearch.trim().toLowerCase();
    const source = q
      ? catalog.filter((c) => c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q))
      : catalog;
    return source.slice(0, 60);
  }, [catalog, wishSearch]);

  const filteredSeriesList = useMemo(() => {
    const q = disableSearch.trim().toLowerCase();
    if (!q) return availableSeries.slice(0, 72);
    return availableSeries.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 72);
  }, [availableSeries, disableSearch]);

  const totalTowerLevel =
    mudaeData.tower.floor1Rolls +
    mudaeData.tower.floor2Reaction +
    mudaeData.tower.floor3WishSpawn +
    mudaeData.tower.floor4Slots +
    mudaeData.tower.floor5Claims +
    mudaeData.tower.floor6Rainbow;

  const activeServerOwner = activeRoll ? serverClaims[activeRoll.char.id] : undefined;
  const activeOwnedByMe = activeRoll
    ? myCollectionMap.has(activeRoll.char.id) || activeRoll.claimedByUid === userId || activeServerOwner?.ownerUid === userId
    : false;
  const activeMarketListing = activeRoll ? listingByCardId.get(activeRoll.char.id) : undefined;
  const activeClaimSecondsLeft = activeRoll ? Math.max(0, Math.ceil((activeRoll.expiresAt - now) / 1000)) : 0;
  const activeIsMyWish = activeRoll ? mudaeData.wishlist.includes(activeRoll.char.id) : false;

  return (
    <div className="space-y-4">
      {/* Header Mudae Bot + Live HUD */}
      <div className="omnitrix-panel rounded-2xl p-4 sm:p-5 border-purple-500/25 relative overflow-hidden">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-400/70 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.14),transparent_60%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl">🤖</span>
              <h2 className="text-base sm:text-xl font-extrabold font-display text-white">
                Mudae Anime Bot
              </h2>
              <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/45 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" /> MULTIPLAYER AO VIVO
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 px-2 py-0.5 rounded-full">
                🌐 Pool Mudae: {MUDAE_ACTIVE_POOL_TOTAL.toLocaleString('pt-BR')} Bonecos ({MUDAE_LEGACY_POOL_TOTAL.toLocaleString('pt-BR')} c/ Legados) • {catalog.length} em Cache ({availableSeries.length} Animes)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  apiSourceStatus === 'anilist'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : apiSourceStatus === 'jikan'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                      : apiSourceStatus === 'loading'
                        ? 'bg-purple-500/15 text-purple-200 border-purple-400/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                }`}
              >
                {apiSourceStatus === 'anilist'
                  ? '🟢 API AniList Conectada'
                  : apiSourceStatus === 'jikan'
                    ? '🟢 API Jikan (MAL) Ativa'
                    : apiSourceStatus === 'loading'
                      ? '🔄 Sincronizando API...'
                      : '🟠 Catálogo Base'}
              </span>
              <button
                type="button"
                disabled={apiSourceStatus === 'loading'}
                onClick={() => syncCatalogFromApi(true)}
                className="text-[10px] font-mono font-bold bg-[#0d1222] hover:bg-[#17203a] text-slate-200 border border-white/15 px-2.5 py-0.5 rounded-full cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
                title="Forçar recarregamento do catálogo da API (AniList + Jikan)"
              >
                <RefreshCw className={`w-3 h-3 ${apiSourceStatus === 'loading' ? 'animate-spin' : ''}`} />
                <span>Recarregar API</span>
              </button>
              <button
                type="button"
                disabled={expandingApi}
                onClick={handleExpandCatalog}
                className="text-[10px] font-mono font-bold bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/45 px-2.5 py-0.5 rounded-full cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{expandingApi ? 'Importando...' : '+400 Bonecos API'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[9px] font-mono">
              <span className="text-slate-400">Tiers no catálogo:</span>
              <span className="bg-slate-500/15 border border-slate-500/30 text-slate-200 px-1.5 py-0.5 rounded">C: {tierCounts[0]}</span>
              <span className="bg-sky-500/15 border border-sky-400/35 text-sky-300 px-1.5 py-0.5 rounded">B: {tierCounts[1]}</span>
              <span className="bg-purple-500/15 border border-purple-400/35 text-purple-300 px-1.5 py-0.5 rounded">A: {tierCounts[2]}</span>
              <span className="bg-amber-500/15 border border-amber-400/40 text-amber-300 px-1.5 py-0.5 rounded">S: {tierCounts[3]}</span>
              <span className="bg-rose-500/20 border border-rose-400/45 text-rose-200 px-1.5 py-0.5 rounded">S+: {tierCounts[4]}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
              Tabela oficial Mudae (<span className="text-slate-300">Rank B/C R$ 3–7</span> • <span className="text-brand font-bold">TOP Mudae até R$ 3.450</span>). Rolls ao vivo no servidor para disputar Orbes ou dar Snipe!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <div className="bg-[#070912]/90 border border-[#1d2236] rounded-xl px-3 py-2">
              <p className="text-[9px] font-mono uppercase text-slate-500">🎲 Rolls (5+2)</p>
              <p className={`text-sm font-black font-mono ${freeRollsRemaining > 0 ? 'text-brand' : extraRollsRemaining > 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                {freeRollsRemaining} Grátis • {extraRollsRemaining} Extra
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                {rollsResetInMs > 0 ? `Reset ${formatCountdown(rollsResetInMs)}` : 'Ciclo pronto'}
              </p>
            </div>

            <div className="bg-[#070912]/90 border border-[#1d2236] rounded-xl px-3 py-2">
              <p className="text-[9px] font-mono uppercase text-slate-500">💖 Claims</p>
              <p className={`text-sm font-black font-mono ${claimsRemaining > 0 ? 'text-pink-400' : 'text-rose-400'}`}>
                {claimsRemaining}/{maxClaimsPerHour}
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                {claimsResetInMs > 0 ? `Reset ${formatCountdown(claimsResetInMs)}` : 'Casamento pronto'}
              </p>
            </div>

            <div className="bg-[#070912]/90 border border-[#1d2236] rounded-xl px-3 py-2">
              <p className="text-[9px] font-mono uppercase text-slate-500">🏰 Torre R$</p>
              <p className="text-sm font-black font-mono text-cyan-300">Nv. {totalTowerLevel}/30</p>
              <p className="text-[9px] text-slate-500 font-mono">×{luckMultiplier.toFixed(2)} Sorte • ×{reactionMultiplier.toFixed(2)} Orbe</p>
            </div>

            <div className="bg-[#070912]/90 border border-[#1d2236] rounded-xl px-3 py-2">
              <p className="text-[9px] font-mono uppercase text-slate-500">💍 Seu Harém</p>
              <p className="text-sm font-black font-mono text-amber-300">{enrichedHarem.length} casados</p>
              <p className="text-[9px] text-emerald-400 font-mono font-bold">R$ {totalHaremValue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="relative z-10 flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-white/5">
          {[
            { id: 'roll' as MudaeTab, label: '🎲 Roleta Ao Vivo ($wa / $ha)', count: mergedLiveRolls.length || null },
            { id: 'harem' as MudaeTab, label: '💍 Meu Harém ($mm)', count: enrichedHarem.length },
            { id: 'market' as MudaeTab, label: '🏪 Mercado P2P ($market)', count: marketListings.length },
            { id: 'tower' as MudaeTab, label: '🏰 Torre R$ ($kt)', count: totalTowerLevel },
            { id: 'lists' as MudaeTab, label: '🌟 Wish & Animes', count: mudaeData.wishlist.length },
            { id: 'server' as MudaeTab, label: '🌐 Servidor Firebase', count: serverClaimsList.length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                play('click');
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                tab === item.id
                  ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_16px_rgba(0,255,135,0.25)]'
                  : 'bg-[#080a13] border-[#1c2033] text-slate-300 hover:border-purple-400/50 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {item.count !== null && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                    tab === item.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Toast Feedback */}
      <AnimatePresence>
        {bannerToast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-xl px-4 py-2.5 border text-xs font-bold flex items-center justify-between gap-3 ${
              bannerToast.tone === 'wish'
                ? 'bg-pink-500/20 border-pink-400/70 text-pink-100 shadow-[0_0_24px_rgba(244,114,182,0.3)]'
                : bannerToast.tone === 'kakera'
                  ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                  : bannerToast.tone === 'warn'
                    ? 'bg-rose-500/15 border-rose-500/45 text-rose-200'
                    : 'bg-emerald-500/15 border-emerald-400/55 text-emerald-200'
            }`}
          >
            <span>{bannerToast.text}</span>
            <button type="button" onClick={() => setBannerToast(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingStatus && (
        <div className="bg-[#0b0e18] border border-purple-500/25 rounded-xl px-4 py-2 text-[11px] text-purple-300 flex items-center gap-2 font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{loadingStatus}</span>
        </div>
      )}

      {/* TAB 1: ROLLS ($wa / $ha / $ma) + SERVER LIVE MULTIPLAYER FEED */}
      {tab === 'roll' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-[#23273d] rounded-2xl p-3.5 sm:p-4 space-y-3">
            <form onSubmit={handleCommandSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Terminal className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Comandos Discord: $wa, /wa, $ha, /ha, $ma, $claim, $rt, $market, $kt, $mm, $anime Bleach..."
                  className="w-full bg-[#06070d] border border-[#252940] focus:border-brand/60 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={rollingMode !== null}
                className="px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white font-extrabold text-xs cursor-pointer transition-all shrink-0"
              >
                {rollingMode ? 'Rolando...' : 'Enviar'}
              </button>
            </form>

            {/* Chances Reais de Drop por Tier */}
            <div className="bg-[#070912] border border-[#1c2136] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
              <span className="text-slate-400 font-bold">🎲 Chances Reais por Roll:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-200 border border-slate-500/30">
                  Rank C (R$ 3–5): <strong>{tierProbabilities[0].toFixed(1)}%</strong>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30">
                  Rank B (R$ 5–7): <strong>{tierProbabilities[1].toFixed(1)}%</strong>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-400/35">
                  Rank A: <strong>{tierProbabilities[2].toFixed(1)}%</strong>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/40">
                  Rank S: <strong>{tierProbabilities[3].toFixed(1)}%</strong>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/45">
                  Rank S+ Ícone: <strong>{tierProbabilities[4].toFixed(2)}%</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { mode: 'wa' as RollMode, cmd: '$wa / /wa', title: 'Roleta Waifu (Anime)', emoji: '♀️', border: 'border-pink-500/40 hover:border-pink-400 from-pink-600/20', badge: 'text-pink-300 bg-pink-500/20 border-pink-400/40' },
                { mode: 'ha' as RollMode, cmd: '$ha / /ha', title: 'Roleta Husbando (Anime)', emoji: '♂️', border: 'border-sky-500/40 hover:border-sky-400 from-sky-600/20', badge: 'text-sky-300 bg-sky-500/20 border-sky-400/40' },
                { mode: 'ma' as RollMode, cmd: '$ma / /ma', title: 'Roleta Mista (Todos)', emoji: '🎴', border: 'border-purple-500/40 hover:border-purple-400 from-purple-600/20', badge: 'text-purple-300 bg-purple-500/20 border-purple-400/40' },
              ]).map((btn) => {
                const blocked = rollingMode !== null || (freeRollsRemaining <= 0 && extraRollsRemaining <= 0);
                const isRollingThis = rollingMode === btn.mode;
                return (
                  <button
                    key={btn.mode}
                    type="button"
                    disabled={blocked}
                    onClick={() => performRoll(btn.mode)}
                    className={`group relative overflow-hidden rounded-xl p-3 border bg-gradient-to-br to-[#0d0f1a] text-left transition-all ${
                      blocked
                        ? 'opacity-50 border-slate-700 cursor-not-allowed'
                        : `${btn.border} cursor-pointer hover:scale-[1.01]`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-black border px-2 py-0.5 rounded-md ${btn.badge}`}>
                        {btn.cmd}
                      </span>
                      <span className="text-base">{btn.emoji}</span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-1.5">
                      {isRollingThis ? 'Sorteando na API...' : btn.title}
                    </p>
                    <p className="text-[10px] mt-0.5 font-mono">
                      {isRollingThis ? (
                        <span className="text-purple-300 animate-pulse">
                          ⏳ Buscando entre {MUDAE_LEGACY_POOL_TOTAL.toLocaleString('pt-BR')} bonecos (pág. 1–2.585)...
                        </span>
                      ) : freeRollsRemaining > 0 ? (
                        <span className="text-emerald-300">Grátis ({freeRollsRemaining}/5 restantes)</span>
                      ) : extraRollsRemaining > 0 ? (
                        <span className="text-amber-300 font-bold">
                          🔥 Roll Extra ({extraRollsRemaining}/2) • R$ {EXTRA_ROLL_COST.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-rose-400">⏳ Reset em {formatCountdown(rollsResetInMs)}</span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>

            {claimsRemaining <= 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/35 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-amber-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Seus claims deste ciclo acabaram (reset em <span className="font-mono font-bold">{formatCountdown(claimsResetInMs)}</span>).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetClaim}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] font-mono cursor-pointer shrink-0 transition-all"
                >
                  ⚡ Usar $rt (-R$ {rtCost.toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* LIVE MULTIPLAYER ROLLS STRIP */}
          {mergedLiveRolls.length > 0 && (
            <div className="bg-[#0b0d16] border border-rose-500/30 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <p className="text-[11px] font-mono uppercase tracking-wider text-rose-200 font-black">
                    Rolls Ao Vivo do Servidor — Clique p/ Disputar Orbe ou Casar!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoFocusLive((v) => !v)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border cursor-pointer transition-all flex items-center gap-1 ${
                    autoFocusLive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#070911] border-slate-700 text-slate-400'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>{autoFocusLive ? 'Auto-Focar Ao Vivo: ON' : 'Auto-Focar Ao Vivo: OFF'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {mergedLiveRolls.slice(0, 8).map((item) => {
                  const isActive = activeRoll?.instanceId === item.instanceId;
                  const owner = item.claimedByName || serverClaims[item.char.id]?.ownerName;
                  const secLeft = Math.max(0, Math.ceil((item.expiresAt - now) / 1000));
                  const isMyRoll = item.rollerUid === userId;
                  const orbAvailable = Boolean(item.orb && !item.orb.collectedByUid);
                  return (
                    <button
                      key={item.instanceId}
                      type="button"
                      onClick={() => setActiveRollId(item.instanceId)}
                      className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isActive
                          ? 'bg-brand/15 border-brand shadow-[0_0_12px_rgba(0,255,135,0.2)]'
                          : orbAvailable
                            ? 'bg-amber-500/10 border-amber-400/55 hover:border-amber-300'
                            : 'bg-[#070911] border-[#1c2033] hover:border-slate-500'
                      }`}
                    >
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-black/50 mb-1 relative">
                        <AvatarWithFallback src={item.char.image} name={item.char.name} charId={item.char.id} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[8px] font-mono font-black bg-black/80 text-white px-1 rounded">
                          #{item.char.claimRank}
                        </span>
                        {item.orb && (
                          <span
                            className={`absolute top-1 right-1 text-xs ${
                              orbAvailable ? 'animate-bounce' : 'opacity-40 grayscale'
                            }`}
                            title={orbAvailable ? `Orbe R$ ${item.orb.baseValue} disponível!` : `Pegou: ${item.orb.collectedByName}`}
                          >
                            {item.orb.emoji}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-white truncate">{item.char.name}</p>
                      <p className="text-[9px] font-mono text-indigo-300 truncate">
                        @{isMyRoll ? 'Você' : item.rollerName}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 truncate">
                        {owner ? `💍 ${owner}` : secLeft > 0 ? `⏱️ ${secLeft}s • R$${item.char.baseValue.toFixed(0)}` : `R$ ${item.char.baseValue.toFixed(0)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeRoll ? (
            <motion.div
              key={activeRoll.instanceId}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`bg-[#111422] rounded-2xl border overflow-hidden border-l-4 ${
                activeIsMyWish
                  ? 'border-pink-400 shadow-[0_0_28px_rgba(244,114,182,0.35)]'
                  : 'border-[#252a42] ' + TIER_CONFIG[activeRoll.char.tierIndex].cardGlow
              }`}
              style={{ borderLeftColor: activeIsMyWish ? '#f472b6' : TIER_CONFIG[activeRoll.char.tierIndex].embed }}
            >
              <div className="px-4 py-2.5 bg-[#090b13] border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-white">Mudae</span>
                  <span className="text-[9px] font-mono font-black bg-[#5865F2] text-white px-1.5 py-0.5 rounded uppercase">
                    APP
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    🎲 Rolado por{' '}
                    <strong className={activeRoll.rollerUid === userId ? 'text-brand' : 'text-amber-300'}>
                      @{activeRoll.rollerUid === userId ? 'Você' : activeRoll.rollerName}
                    </strong>{' '}
                    (<span className="text-brand font-bold">${activeRoll.mode}</span>)
                  </span>
                  {activeIsMyWish && (
                    <span className="text-[10px] font-mono font-black bg-pink-500/25 text-pink-200 border border-pink-400/60 px-2 py-0.5 rounded-full animate-pulse">
                      🌟 SUA WISHLIST!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {activeOwnedByMe ? (
                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Casado(a) com você
                    </span>
                  ) : activeRoll.claimedByName || activeServerOwner ? (
                    <span className="text-amber-300 font-bold">
                      💍 Pertence a {activeRoll.claimedByName || activeServerOwner?.ownerName}
                    </span>
                  ) : activeClaimSecondsLeft > 0 ? (
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full border ${
                        activeClaimSecondsLeft <= 10
                          ? 'text-rose-300 bg-rose-500/20 border-rose-400/50 animate-pulse'
                          : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                      }`}
                    >
                      ⏱️ {activeClaimSecondsLeft}s {activeRoll.rollerUid !== userId ? 'para SNIPAR!' : 'para casar'}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold">⏳ Tempo expirado</span>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
                <div className="relative mx-auto md:mx-0 w-52 sm:w-60 aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-[#07080f] shadow-xl">
                  <AvatarWithFallback
                    src={activeRoll.char.image}
                    name={activeRoll.char.name}
                    charId={activeRoll.char.id}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border backdrop-blur-md ${TIER_CONFIG[activeRoll.char.tierIndex].badge}`}>
                      #{activeRoll.char.claimRank} • {activeRoll.char.tierLabel}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-slate-200 backdrop-blur-md">
                      {activeRoll.char.gender === 'Female' ? '♀️ $wa' : activeRoll.char.gender === 'Male' ? '♂️ $ha' : '⚧️ $ma'}
                    </span>
                  </div>
                  {(myCollectionMap.get(activeRoll.char.id)?.quantity || activeServerOwner?.keys || 0) > 1 && (
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-amber-500/90 text-slate-950 shadow">
                        🔑 {(myCollectionMap.get(activeRoll.char.id)?.quantity || activeServerOwner?.keys || 1) - 1} Chaos Key(s)
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black font-display text-white">
                        {activeRoll.char.name}
                      </h3>
                      <p className="text-sm font-bold text-indigo-300 mt-0.5">{activeRoll.char.series}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(activeRoll.char)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all flex items-center gap-1.5 ${
                        mudaeData.wishlist.includes(activeRoll.char.id)
                          ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                          : 'bg-[#080a12] border-[#252a42] text-slate-300 hover:border-pink-400/60 hover:text-pink-200'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${mudaeData.wishlist.includes(activeRoll.char.id) ? 'fill-pink-400 text-pink-400' : ''}`} />
                      <span>{mudaeData.wishlist.includes(activeRoll.char.id) ? 'Na Wishlist' : 'Add Wishlist'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Claim Rank</p>
                      <p className="text-base font-black font-mono text-white">#{activeRoll.char.claimRank}</p>
                    </div>
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Valor R$ (Fama)</p>
                      <p className={`text-base font-black font-mono ${activeRoll.char.tierIndex >= 3 ? 'text-amber-300' : activeRoll.char.tierIndex === 2 ? 'text-brand' : 'text-slate-300'}`}>
                        R$ {getEffectiveValue(activeRoll.char.baseValue, myCollectionMap.get(activeRoll.char.id)?.quantity || activeServerOwner?.keys || 1).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Likes (AniList)</p>
                      <p className="text-base font-black font-mono text-rose-300">
                        ♥️ {activeRoll.char.favourites.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Wishes no Server</p>
                      <p className="text-base font-black font-mono text-pink-300">
                        🌟 {serverWishCounts[activeRoll.char.id] || 0}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {!activeOwnedByMe && !activeServerOwner && !activeRoll.claimedByUid && (
                      <button
                        type="button"
                        disabled={activeClaimSecondsLeft <= 0 || claimsRemaining <= 0 || claimingId === activeRoll.instanceId}
                        onClick={() => handleClaimLiveRoll(activeRoll)}
                        className={`w-full py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          activeClaimSecondsLeft > 0 && claimsRemaining > 0
                            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:brightness-110 text-white shadow-[0_0_24px_rgba(244,63,94,0.4)] hover:scale-[1.01]'
                            : 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <Heart className="w-5 h-5 fill-current" />
                        <span>
                          {claimingId === activeRoll.instanceId
                            ? 'Confirmando no servidor...'
                            : activeClaimSecondsLeft <= 0
                              ? 'Tempo de Reivindicação Expirado'
                              : claimsRemaining <= 0
                                ? `Sem Claim Disponível (Use $rt por R$ ${rtCost.toFixed(2)})`
                                : activeRoll.rollerUid !== userId
                                  ? `⚡ SNIPE! Casar antes de @${activeRoll.rollerName} (${activeClaimSecondsLeft}s)`
                                  : `💖 Casar / Reivindicar ${activeRoll.char.name} (${activeClaimSecondsLeft}s)`}
                        </span>
                      </button>
                    )}

                    {(activeServerOwner || activeRoll.claimedByName) && !activeOwnedByMe && (
                      <div className="space-y-2">
                        <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-amber-200 font-bold">
                            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              Exclusivo no servidor: <strong className="text-white">{activeRoll.claimedByName || activeServerOwner?.ownerName}</strong> casou com {activeRoll.char.name}!
                            </span>
                          </div>
                          {activeServerOwner && (
                            <span className="text-[10px] font-mono text-amber-300 shrink-0">
                              🔑 {Math.max(0, activeServerOwner.keys - 1)} keys
                            </span>
                          )}
                        </div>

                        {activeMarketListing && activeMarketListing.sellerUid !== userId && (
                          <button
                            type="button"
                            disabled={balance < activeMarketListing.price || buyingListingId === activeMarketListing.id}
                            onClick={() => handleBuyMarketListing(activeMarketListing)}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>
                              🛒 À venda no Mercado P2P! Comprar de {activeMarketListing.sellerName} por R$ {activeMarketListing.price.toFixed(2)}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {activeOwnedByMe && (
                      <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-200 font-bold">
                          <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            {activeRoll.grantedKeyToRoller && activeRoll.rollerUid === userId
                              ? `Você rolou seu próprio casamento! +${activeRoll.grantedKeyToRoller} Chaos Key adicionada!`
                              : `Você é casado(a) com ${activeRoll.char.name} no servidor!`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* LIVE COMPETITIVE ORB */}
                    {activeRoll.orb && (
                      <div className="pt-1">
                        {!activeRoll.orb.collectedByUid ? (
                          <button
                            type="button"
                            disabled={collectingOrbId === activeRoll.instanceId}
                            onClick={() => handleCollectLiveOrb(activeRoll)}
                            style={{ boxShadow: activeRoll.orb.glowStyle }}
                            className={`w-full py-3 px-4 rounded-xl border bg-gradient-to-r ${activeRoll.orb.colorClass} font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.01] transition-all animate-pulse`}
                          >
                            <span className="text-xl">{activeRoll.orb.emoji}</span>
                            <span>
                              {collectingOrbId === activeRoll.instanceId
                                ? 'Pegando Orbe...'
                                : activeRoll.rollerUid !== userId
                                  ? `⚡ ROUBAR ${activeRoll.orb.label} de @${activeRoll.rollerName} (+R$ ${(
                                      activeRoll.orb.baseValue *
                                      reactionMultiplier *
                                      (1 +
                                        Math.min(
                                          0.6,
                                          Math.max(
                                            0,
                                            (myCollectionMap.get(activeRoll.char.id)?.quantity ||
                                              activeServerOwner?.keys ||
                                              1) - 1
                                          ) * 0.1
                                        ))
                                    ).toFixed(2)})!`
                                  : `Coletar ${activeRoll.orb.label} (+R$ ${(
                                      activeRoll.orb.baseValue *
                                      reactionMultiplier *
                                      (1 +
                                        Math.min(
                                          0.6,
                                          Math.max(
                                            0,
                                            (myCollectionMap.get(activeRoll.char.id)?.quantity ||
                                              activeServerOwner?.keys ||
                                              1) - 1
                                          ) * 0.1
                                        ))
                                    ).toFixed(2)})`}
                            </span>
                          </button>
                        ) : (
                          <div className="w-full py-2.5 px-4 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-200 text-xs font-mono font-bold text-center">
                            {activeRoll.orb.emoji} Orbe pego por{' '}
                            <strong className="text-white">
                              @{activeRoll.orb.collectedByUid === userId ? 'Você' : activeRoll.orb.collectedByName}
                            </strong>!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => toggleDisableSeries(activeRoll.char.series)}
                      className="text-[11px] font-mono text-slate-400 hover:text-rose-300 cursor-pointer transition-colors"
                    >
                      🚫 $disable {activeRoll.char.series}
                    </button>
                    <button
                      type="button"
                      disabled={freeRollsRemaining <= 0 && extraRollsRemaining <= 0}
                      onClick={() => performRoll(lastRollMode)}
                      className="px-4 py-2 rounded-xl bg-brand hover:bg-[#00e276] disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer transition-all"
                    >
                      Rodar Novamente (${lastRollMode}) →
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-8 text-center space-y-3">
              <div className="text-4xl">🎲</div>
              <h3 className="text-base sm:text-lg font-extrabold font-display text-white">
                Pronto para rodar ao vivo no servidor!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você tem <strong className="text-emerald-300">5 rolls grátis</strong> e até <strong className="text-amber-300">2 rolls extras (R$ 100,00)</strong> por hora. Rank B/C valem <strong className="text-slate-200">R$ 3–7</strong> e estrelas do TOP Mudae até <strong className="text-brand">R$ 3.450,00</strong>!
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => performRoll('wa')}
                  className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs cursor-pointer"
                >
                  Rodar $wa (Waifus)
                </button>
                <button
                  type="button"
                  onClick={() => performRoll('ha')}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Rodar $ha (Husbandos)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY HAREM ($mm) */}
      {tab === 'harem' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold font-display text-white">
                💍 Meu Harém Exclusivo ($mm)
              </h3>
              <p className="text-[11px] text-slate-400">
                {enrichedHarem.length} personagens casados • {totalChaosKeys} 🔑 Chaos Keys • Valor Total:{' '}
                <span className="text-brand font-mono font-bold">R$ {totalHaremValue.toFixed(2)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={haremSearch}
                  onChange={(e) => setHaremSearch(e.target.value)}
                  placeholder="Filtrar harém..."
                  className="bg-[#06070d] border border-[#23273d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand/50"
                />
              </div>
              <select
                value={haremSort}
                onChange={(e) => setHaremSort(e.target.value as 'value' | 'rank' | 'keys')}
                className="bg-[#06070d] border border-[#23273d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
              >
                <option value="value">Maior R$ Valor</option>
                <option value="rank">Melhor Rank (#)</option>
                <option value="keys">Mais Chaos Keys</option>
              </select>
            </div>
          </div>

          {enrichedHarem.length === 0 ? (
            <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-8 text-center space-y-2">
              <p className="text-3xl">💔</p>
              <p className="text-sm font-bold text-white">Seu harém está vazio nesta temporada</p>
              <p className="text-xs text-slate-400">
                Rode na aba <span className="text-brand font-bold">Roleta Ao Vivo</span> para casar ou compre de outros jogadores no <span className="text-cyan-300 font-bold">Mercado P2P</span>!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {enrichedHarem.map((item) => (
                <div
                  key={item.card.id}
                  className={`bg-[#0b0e18] border rounded-2xl overflow-hidden flex flex-col ${
                    TIER_CONFIG[item.tierIndex].cardGlow
                  } border-[#232842]`}
                >
                  <div
                    onClick={() => {
                      const cat = catalogById.get(item.card.id);
                      if (cat) setSelectedCharModal(cat);
                    }}
                    className="aspect-[3/4] relative bg-[#070911] cursor-pointer group"
                  >
                    <AvatarWithFallback
                      src={item.image}
                      name={item.card.name}
                      charId={item.card.id}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className={`absolute top-2 left-2 text-[9px] font-mono font-black px-1.5 py-0.5 rounded border backdrop-blur-md ${TIER_CONFIG[item.tierIndex].badge}`}>
                      #{item.rank}
                    </span>
                    {item.keys > 1 && (
                      <span className="absolute top-2 right-2 text-[9px] font-mono font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded shadow">
                        🔑 {item.keys - 1}
                      </span>
                    )}
                    {item.activeListing && (
                      <span className="absolute top-9 left-2 text-[9px] font-mono font-black bg-emerald-500/95 text-slate-950 px-1.5 py-0.5 rounded shadow">
                        📢 P2P R$ {item.activeListing.price.toFixed(0)}
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5">
                      <p className="text-xs font-extrabold text-white truncate">{item.card.name}</p>
                      <p className="text-[10px] text-indigo-300 truncate">{item.series}</p>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-1.5 mt-auto">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Valor</span>
                      <span className="text-brand font-black">R$ {item.divorceValue.toFixed(2)}</span>
                    </div>

                    {item.activeListing ? (
                      <button
                        type="button"
                        onClick={() => handleCancelListing(item.card.id, item.card.name)}
                        className="w-full py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[10px] font-bold cursor-pointer transition-all"
                      >
                        🚫 Cancelar Venda (R$ {item.activeListing.price.toFixed(2)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenSellModal(item.card, item.divorceValue, item.rank, item.series)}
                        className="w-full py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-[10px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Vender p/ Jogadores</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDivorce(item.card, item.divorceValue)}
                      className="w-full py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[10px] font-bold cursor-pointer transition-all"
                    >
                      💔 Divorciar (+R$ {item.divorceValue.toFixed(2)})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: P2P MARKETPLACE ($market) */}
      {tab === 'market' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-cyan-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold font-display text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-cyan-400" />
                Mercado P2P Entre Usuários ($market)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Compre personagens diretamente de outros jogadores do servidor ou anuncie os seus na aba <strong className="text-white">Meu Harém ($mm)</strong>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  placeholder="Buscar personagem, anime ou vendedor..."
                  className="bg-[#06070d] border border-[#23273d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
              <select
                value={marketSort}
                onChange={(e) => setMarketSort(e.target.value as 'priceAsc' | 'priceDesc' | 'value')}
                className="bg-[#06070d] border border-[#23273d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
              >
                <option value="priceAsc">Menor Preço</option>
                <option value="priceDesc">Maior Preço</option>
                <option value="value">Maior Valor Base</option>
              </select>
            </div>
          </div>

          {filteredMarketListings.length === 0 ? (
            <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-8 text-center space-y-2">
              <p className="text-3xl">🏪</p>
              <p className="text-sm font-bold text-white">Nenhum personagem à venda no momento</p>
              <p className="text-xs text-slate-400">
                Vá até <span className="text-brand font-bold">Meu Harém ($mm)</span> e clique em <span className="text-cyan-300 font-bold">Vender p/ Jogadores</span> para anunciar!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredMarketListings.map((listing) => {
                const isMine = listing.sellerUid === userId;
                const keys = Math.max(1, listing.card.quantity || 1);
                return (
                  <div
                    key={listing.id}
                    className={`bg-[#0b0e18] border rounded-2xl overflow-hidden flex flex-col ${
                      isMine ? 'border-cyan-400/55' : 'border-[#232842]'
                    }`}
                  >
                    <div className="aspect-[3/4] relative bg-[#070911]">
                      <AvatarWithFallback src={listing.image} name={listing.card.name} charId={listing.cardId} className="w-full h-full object-cover" />
                      <span className={`absolute top-2 left-2 text-[9px] font-mono font-black px-1.5 py-0.5 rounded border backdrop-blur-md ${TIER_CONFIG[listing.tierIndex].badge}`}>
                        #{listing.rank}
                      </span>
                      {keys > 1 && (
                        <span className="absolute top-2 right-2 text-[9px] font-mono font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                          🔑 {keys - 1}
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-2.5">
                        <p className="text-xs font-extrabold text-white truncate">{listing.card.name}</p>
                        <p className="text-[10px] text-indigo-300 truncate">{listing.series}</p>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 mt-auto">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400 truncate">
                          Vendedor: <strong className={isMine ? 'text-cyan-300' : 'text-amber-300'}>{isMine ? 'Você' : listing.sellerName}</strong>
                        </span>
                        <span className="text-slate-400 shrink-0">Base R$ {listing.currentBaseValue.toFixed(0)}</span>
                      </div>

                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => handleCancelListing(listing.cardId, listing.card.name)}
                          className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/55 text-amber-200 font-black text-xs cursor-pointer transition-all"
                        >
                          🚫 Cancelar (R$ {listing.price.toFixed(2)})
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={balance < listing.price || buyingListingId === listing.id}
                          onClick={() => handleBuyMarketListing(listing)}
                          className={`w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            balance >= listing.price
                              ? 'bg-brand hover:bg-[#00e276] text-slate-950 shadow-[0_0_14px_rgba(0,255,135,0.2)]'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>
                            {buyingListingId === listing.id
                              ? 'Comprando...'
                              : `Comprar • R$ ${listing.price.toFixed(2)}`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: R$ TOWER ($kt / R$tower) */}
      {tab === 'tower' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-cyan-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold font-display text-white flex items-center gap-2">
                <TowerControl className="w-5 h-5 text-cyan-400" />
                Torre R$ ($kt / R$tower)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Aumente sua sorte de raridades, bônus de Orbes R$, Wishlist e Claims.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] font-mono uppercase text-slate-500">Investido na Torre</p>
                <p className="text-sm font-black font-mono text-cyan-300">
                  R$ {mudaeData.totalInvestedTower.toFixed(2)}
                </p>
              </div>
              {mudaeData.totalInvestedTower > 0 && (
                <button
                  type="button"
                  onClick={handleDestroyTower}
                  className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/50 text-rose-200 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>$destroy (Reembolso 100%)</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TOWER_FLOORS.map((floor) => {
              const lvl = mudaeData.tower[floor.key];
              const isMax = lvl >= 5;
              const cost = getFloorUpgradeCost(floor, lvl);
              const canAfford = balance >= cost;
              return (
                <div
                  key={floor.key}
                  className="bg-[#0b0e18] border border-[#1f243b] rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${floor.accent}`}>
                          ANDAR {floor.floorNum}
                        </span>
                        <h4 className="text-sm font-extrabold text-white mt-1.5">{floor.title}</h4>
                        <p className="text-[11px] text-slate-400">{floor.subtitle}</p>
                      </div>
                      <span className="text-xs font-mono font-black text-white bg-[#131729] border border-white/10 px-2.5 py-1 rounded-lg">
                        Nv. {lvl}/5
                      </span>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map((pip) => (
                        <div
                          key={pip}
                          className={`h-2 flex-1 rounded-full ${
                            pip <= lvl ? 'bg-brand shadow-[0_0_8px_rgba(0,255,135,0.5)]' : 'bg-[#171b2e]'
                          }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs font-mono text-emerald-300 bg-[#070912] border border-[#1b2033] rounded-lg px-3 py-1.5">
                      ✨ Efeito atual: {floor.effectText(lvl)}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isMax || !canAfford}
                    onClick={() => handleBuildTowerFloor(floor)}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isMax
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 cursor-default'
                        : canAfford
                          ? 'bg-brand hover:bg-[#00e276] text-slate-950 shadow-[0_0_16px_rgba(0,255,135,0.2)]'
                          : 'bg-[#121627] border border-[#232842] text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax
                      ? '✅ Andar Maximizado (Nível 5)'
                      : `Construir Nível ${lvl + 1} • R$ ${cost.toFixed(2)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: WISHLIST, GLOBAL ANIME SEARCH & DISABLELIST */}
      {tab === 'lists' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setListSection('wish')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-all flex items-center gap-2 ${
                  listSection === 'wish'
                    ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                    : 'bg-[#0b0d16] border-[#1d2236] text-slate-400 hover:text-white'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>Wishlist & Buscar Animes • {mudaeData.wishlist.length}/{maxWishSlots}</span>
              </button>

              <button
                type="button"
                onClick={() => setListSection('disable')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-all flex items-center gap-2 ${
                  listSection === 'disable'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-[#0b0d16] border-[#1d2236] text-slate-400 hover:text-white'
                }`}
              >
                <ShieldBan className="w-4 h-4" />
                <span>Disablelist ($disable) • {mudaeData.disablelist.length}/{maxDisableSlots}</span>
              </button>
            </div>
          </div>

          {listSection === 'wish' ? (
            <div className="space-y-4">
              <div className="bg-[#0b0d16] border border-pink-500/25 rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    🌟 Sua Wishlist ({mudaeData.wishlist.length}/{maxWishSlots} slots)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Bônus atual de spawn: <span className="text-pink-300 font-mono font-bold">×{wishSpawnWeight.toFixed(2)}</span> + Alerta mesmo quando outro jogador rolar!
                  </p>
                </div>

                {mudaeData.wishlist.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1">
                    Nenhum personagem desejado ainda. Busque qualquer anime ou personagem abaixo!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {mudaeData.wishlist.map((id) => {
                      const char = catalogById.get(id);
                      const owner = serverClaims[id];
                      if (!char) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-2 bg-[#070911] border border-pink-500/35 rounded-xl p-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarWithFallback src={char.image} name={char.name} charId={char.id} className="w-10 h-12 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{char.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                #{char.claimRank} • R$ {char.baseValue.toFixed(2)}
                              </p>
                              <p className="text-[9px] font-mono text-amber-300 truncate">
                                {owner ? `💍 ${owner.ownerName}` : '🟢 Livre no servidor'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(char)}
                            className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20 cursor-pointer shrink-0"
                            title="Remover da Wishlist"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span>Buscar & Importar Qualquer Anime na API Global (150.000+ Personagens)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Digite o nome de qualquer anime ou personagem e clique em <strong className="text-purple-300">Importar da API</strong>.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleGlobalApiSearch(wishSearch);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={wishSearch}
                      onChange={(e) => setWishSearch(e.target.value)}
                      placeholder="Ex: Bleach, Solo Leveling, One Piece, Blue Lock, JoJo, Ichigo..."
                      className="w-full bg-[#06070d] border border-[#23273d] focus:border-purple-400/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searchingGlobal || !wishSearch.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs cursor-pointer shrink-0 transition-all"
                  >
                    {searchingGlobal || autoWishLoading ? 'Buscando API...' : '🌐 Importar da API'}
                  </button>
                </form>

                {autoWishLoading && (
                  <p className="text-[10px] font-mono text-purple-300 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Consultando API Global (129k+) para "{wishSearch.trim()}"...
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_ANIMES_PRESETS.map((anime) => (
                    <button
                      key={anime}
                      type="button"
                      disabled={searchingGlobal}
                      onClick={() => handleGlobalApiSearch(anime)}
                      className="px-2.5 py-1 rounded-full bg-[#070912] hover:bg-purple-500/20 border border-[#22273d] hover:border-purple-400/50 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer transition-all"
                    >
                      + {anime}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[28rem] overflow-y-auto pr-1 pt-1">
                  {wishCatalogResults.map((char) => {
                    const wished = mudaeData.wishlist.includes(char.id);
                    const owner = serverClaims[char.id];
                    return (
                      <div
                        key={char.id}
                        className="flex items-center justify-between gap-2 bg-[#070911] border border-[#1c2033] rounded-xl p-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarWithFallback src={char.image} name={char.name} charId={char.id} className="w-10 h-12 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{char.name}</p>
                            <p className="text-[10px] text-indigo-300 truncate">{char.series}</p>
                            <p className="text-[9px] font-mono text-slate-400">
                              #{char.claimRank} • ♥️ {char.favourites.toLocaleString('pt-BR')} • R$ {char.baseValue.toFixed(0)}
                              {owner ? ` • 💍` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleWishlist(char)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer shrink-0 ${
                            wished
                              ? 'bg-pink-500/25 border-pink-400 text-pink-200'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:border-pink-400/50'
                          }`}
                        >
                          {wished ? '✓ Wish' : '+ Wish'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0b0d16] border border-rose-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    🚫 Disablelist de Séries ({mudaeData.disablelist.length}/{maxDisableSlots} slots)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Desative séries indesejadas entre os {availableSeries.length} animes carregados.
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={disableSearch}
                    onChange={(e) => setDisableSearch(e.target.value)}
                    placeholder="Buscar anime..."
                    className="bg-[#06070d] border border-[#23273d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-400/60"
                  />
                </div>
              </div>

              {mudaeData.disablelist.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-2 border-b border-white/5">
                  {mudaeData.disablelist.map((series) => (
                    <button
                      key={series}
                      type="button"
                      onClick={() => toggleDisableSeries(series)}
                      className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30"
                    >
                      <span>🚫 {series}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                {filteredSeriesList.map((s) => {
                  const disabled = mudaeData.disablelist.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => toggleDisableSeries(s.name)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        disabled
                          ? 'bg-rose-500/15 border-rose-400/60 text-rose-200'
                          : 'bg-[#070911] border-[#1c2033] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{s.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {s.count} bonecos • Top #{s.topRank}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold shrink-0">
                        {disabled ? '🚫 Desativado' : 'Ativo'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SERVER HAREM (ALL FIREBASE USERS) */}
      {tab === 'server' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold font-display text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand" />
                  Casamentos Exclusivos do Servidor Firebase
                </h3>
                <p className="text-[11px] text-slate-400">
                  {serverClaimsList.length} personagens reivindicados no servidor por {serverOwners.length} jogadores.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serverSearch}
                    onChange={(e) => setServerSearch(e.target.value)}
                    placeholder="Buscar personagem ou dono..."
                    className="bg-[#06070d] border border-[#23273d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>
                <select
                  value={serverOwnerFilter}
                  onChange={(e) => setServerOwnerFilter(e.target.value)}
                  className="bg-[#06070d] border border-[#23273d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                >
                  <option value="all">Todos os Jogadores ({serverOwners.length})</option>
                  {serverOwners.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.name} ({o.count} • R$ {o.value.toFixed(0)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={resettingGlobal}
                  onClick={handleGlobalResetCollections}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    confirmGlobalReset
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {resettingGlobal
                    ? 'Resetando...'
                    : confirmGlobalReset
                      ? '⚠️ Confirmar Reset Geral'
                      : '🧹 Resetar Coleções'}
                </button>
              </div>
            </div>

            {serverOwners.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {serverOwners.slice(0, 8).map((o, idx) => (
                  <button
                    key={o.uid}
                    type="button"
                    onClick={() => setServerOwnerFilter(serverOwnerFilter === o.uid ? 'all' : o.uid)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono border cursor-pointer transition-all ${
                      serverOwnerFilter === o.uid
                        ? 'bg-brand text-slate-950 border-brand font-black'
                        : 'bg-[#070911] border-[#1f2438] text-slate-300 hover:border-brand/40'
                    }`}
                  >
                    #{idx + 1} {o.name}: {o.count} (R$ {o.value.toFixed(0)})
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredServerClaims.length === 0 ? (
            <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-8 text-center text-xs text-slate-400">
              Nenhum personagem reivindicado nesta temporada ainda. Seja o primeiro a casar na Roleta!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredServerClaims.map((claim) => {
                const isMine = claim.ownerUid === userId;
                return (
                  <div
                    key={claim.cardId}
                    className={`bg-[#0b0e18] border rounded-2xl overflow-hidden ${
                      isMine ? 'border-brand/55' : 'border-[#21263d]'
                    }`}
                  >
                    <div className="aspect-[3/4] relative bg-[#070911]">
                      <AvatarWithFallback src={claim.image} name={claim.name} charId={claim.cardId} className="w-full h-full object-cover" />
                      <span className={`absolute top-2 left-2 text-[9px] font-mono font-black px-1.5 py-0.5 rounded border backdrop-blur-md ${TIER_CONFIG[claim.tierIndex].badge}`}>
                        #{claim.rank}
                      </span>
                      {claim.keys > 1 && (
                        <span className="absolute top-2 right-2 text-[9px] font-mono font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                          🔑 {claim.keys - 1}
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-2.5">
                        <p className="text-xs font-extrabold text-white truncate">{claim.name}</p>
                        <p className="text-[10px] text-indigo-300 truncate">{claim.series}</p>
                      </div>
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-1 text-[10px] font-mono">
                      <span className={`truncate font-bold ${isMine ? 'text-brand' : 'text-amber-300'}`}>
                        💍 {isMine ? 'Você' : claim.ownerName}
                      </span>
                      <span className="text-emerald-300 font-black shrink-0">
                        R$ {claim.effectiveValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* P2P Sell Price Modal */}
      <AnimatePresence>
        {sellModalItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSellModalItem(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0d101b] border border-cyan-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <Tag className="w-4 h-4 text-cyan-400" />
                    Anunciar no Mercado P2P
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sellModalItem.card.name} (#{sellModalItem.rank}) • Valor Base R$ {sellModalItem.baseValue.toFixed(2)}
                  </p>
                </div>
                <button type="button" onClick={() => setSellModalItem(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-mono text-slate-400 uppercase">Preço de Venda (R$)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={sellPriceInput}
                  onChange={(e) => setSellPriceInput(e.target.value)}
                  className="w-full bg-[#06070d] border border-[#252a42] focus:border-cyan-400 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white outline-none"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {[1.2, 1.5, 2, 3].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setSellPriceInput(Number((sellModalItem.baseValue * mult).toFixed(2)).toString())}
                      className="py-1.5 rounded-lg bg-[#080b15] hover:bg-cyan-500/20 border border-[#232842] text-[10px] font-mono font-bold text-cyan-300 cursor-pointer"
                    >
                      {mult}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSellModalItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmListForSale}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Publicar Anúncio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character Quick Inspect Modal */}
      <AnimatePresence>
        {selectedCharModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCharModal(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0d101b] border border-[#2a304d] rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl"
            >
              <div className="aspect-[3/4] relative bg-black">
                <AvatarWithFallback src={selectedCharModal.image} name={selectedCharModal.name} charId={selectedCharModal.id} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedCharModal(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-black text-white">{selectedCharModal.name}</h4>
                  <span className="text-xs font-mono font-black text-brand">
                    R$ {selectedCharModal.baseValue.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-indigo-300">{selectedCharModal.series}</p>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span>Rank #{selectedCharModal.claimRank}</span>
                  <span>♥️ {selectedCharModal.favourites.toLocaleString('pt-BR')}</span>
                  <span>{selectedCharModal.gender === 'Female' ? '♀️ $wa' : selectedCharModal.gender === 'Male' ? '♂️ $ha' : '⚧️ $ma'}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
