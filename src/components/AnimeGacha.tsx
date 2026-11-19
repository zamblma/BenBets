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
} from 'lucide-react';
import { PlacedBet, PokemonCard } from '../types';
import {
  MudaeTowerLevels,
  MudaeUserData,
  ServerAnimeClaim,
  checkServerAnimeClaim,
  getDefaultMudaeUserData,
  getMudaeUserData,
  saveMudaeUserData,
  subscribeToServerAnimeClaims,
} from '../firebase/db';
import { useSound } from '../hooks/useSound';

interface AnimeGachaProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number, removeAll?: boolean) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

type RollMode = 'wa' | 'ha' | 'ma';
type MudaeTab = 'roll' | 'harem' | 'tower' | 'lists' | 'server';
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

interface KakeraCrystal {
  id: string;
  label: string;
  emoji: string;
  baseValue: number;
  colorClass: string;
  glowStyle: string;
  collected: boolean;
}

interface RollEntry {
  instanceId: string;
  char: MudaeChar;
  mode: RollMode;
  rolledAt: number;
  expiresAt: number;
  crystal: KakeraCrystal | null;
  isWish: boolean;
  claimedHereByMe: boolean;
  grantedKeyHere: number;
}

const HOUR_MS = 3600_000;
const CLAIM_WINDOW_MS = 45_000;
const EXTRA_ROLL_COST = 1.5;
const BASE_RT_COST = 12.0;
const CATALOG_CACHE_KEY = 'mudaeAnimeCatalog_v1';

const TIER_CONFIG = [
  { label: 'Rank C', badge: 'text-slate-300 bg-slate-500/15 border-slate-500/40', embed: '#64748b', cardGlow: '' },
  { label: 'Rank B', badge: 'text-sky-300 bg-sky-500/15 border-sky-400/45', embed: '#38bdf8', cardGlow: 'shadow-[0_0_16px_rgba(56,189,248,0.22)]' },
  { label: 'Rank A', badge: 'text-purple-300 bg-purple-500/20 border-purple-400/50', embed: '#a855f7', cardGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
  { label: 'Rank S', badge: 'text-amber-300 bg-amber-500/20 border-amber-400/60', embed: '#f59e0b', cardGlow: 'shadow-[0_0_26px_rgba(245,158,11,0.4)]' },
  { label: 'Rank S+ Top 5', badge: 'text-rose-200 bg-gradient-to-r from-rose-500/30 to-amber-500/30 border-rose-400/70', embed: '#f43f5e', cardGlow: 'shadow-[0_0_32px_rgba(244,63,94,0.45)]' },
];

const KAKERA_CRYSTALS: Array<Omit<KakeraCrystal, 'id' | 'collected'> & { weight: number; requiresFloor6?: boolean }> = [
  { label: 'R$ Roxo', emoji: '🟣', baseValue: 1.5, colorClass: 'from-purple-600/35 to-purple-900/50 border-purple-400/60 text-purple-200', glowStyle: '0 0 18px rgba(168,85,247,0.45)', weight: 30 },
  { label: 'R$ Azul', emoji: '🔵', baseValue: 2.5, colorClass: 'from-blue-600/35 to-blue-900/50 border-blue-400/60 text-blue-200', glowStyle: '0 0 18px rgba(59,130,246,0.45)', weight: 25 },
  { label: 'R$ Turquesa', emoji: '🩵', baseValue: 4.0, colorClass: 'from-cyan-500/35 to-teal-900/50 border-cyan-400/60 text-cyan-200', glowStyle: '0 0 18px rgba(34,211,238,0.45)', weight: 18 },
  { label: 'R$ Verde', emoji: '🟢', baseValue: 6.5, colorClass: 'from-emerald-500/35 to-emerald-900/50 border-emerald-400/60 text-emerald-200', glowStyle: '0 0 20px rgba(16,185,129,0.5)', weight: 12 },
  { label: 'R$ Amarelo', emoji: '🟡', baseValue: 10.0, colorClass: 'from-yellow-500/35 to-amber-900/50 border-yellow-400/70 text-yellow-200', glowStyle: '0 0 22px rgba(250,204,21,0.55)', weight: 8 },
  { label: 'R$ Laranja', emoji: '🟠', baseValue: 16.0, colorClass: 'from-orange-500/40 to-orange-950/60 border-orange-400/75 text-orange-200', glowStyle: '0 0 24px rgba(249,115,22,0.6)', weight: 4.5 },
  { label: 'R$ Vermelho', emoji: '🔴', baseValue: 26.0, colorClass: 'from-rose-500/45 to-red-950/65 border-rose-400/80 text-rose-100', glowStyle: '0 0 28px rgba(244,63,94,0.7)', weight: 2.0 },
  { label: 'R$ Arco-Íris', emoji: '🌈', baseValue: 45.0, colorClass: 'from-pink-500/45 via-amber-400/35 to-cyan-500/45 border-white/75 text-white', glowStyle: '0 0 32px rgba(236,72,153,0.75)', weight: 1.5, requiresFloor6: true },
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
    title: 'Torre das Roletas ($rolls)',
    subtitle: 'Aumenta os rolls gratuitos por ciclo de 1 hora',
    effectText: (lvl) => `+${lvl * 2} rolls grátis/hora (Total: ${10 + lvl * 2}/h)`,
    baseCost: 18,
    multiplier: 1.7,
    accent: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  },
  {
    key: 'floor2Reaction',
    floorNum: 2,
    title: 'Amplificador de R$ (Kakera)',
    subtitle: 'Multiplica o R$ ganho em todos os cristais de reação',
    effectText: (lvl) => `+${lvl * 15}% de R$ em cada reação clicada`,
    baseCost: 22,
    multiplier: 1.75,
    accent: 'text-cyan-300 border-cyan-500/35 bg-cyan-500/10',
  },
  {
    key: 'floor3WishSpawn',
    floorNum: 3,
    title: 'Ímã da Wishlist ($wish)',
    subtitle: 'Aumenta drasticamente a chance de rolar sua Wishlist',
    effectText: (lvl) => `Peso da Wishlist ×${(2.5 + lvl * 0.75).toFixed(2)}`,
    baseCost: 28,
    multiplier: 1.8,
    accent: 'text-pink-300 border-pink-500/35 bg-pink-500/10',
  },
  {
    key: 'floor4Slots',
    floorNum: 4,
    title: 'Expansão de Listas ($wl / $dl)',
    subtitle: 'Libera mais vagas na Wishlist e Disablelist',
    effectText: (lvl) => `${5 + lvl * 2} Wishlist slots • ${4 + lvl} Disablelist slots`,
    baseCost: 20,
    multiplier: 1.65,
    accent: 'text-violet-300 border-violet-500/35 bg-violet-500/10',
  },
  {
    key: 'floor5Claims',
    floorNum: 5,
    title: 'Aliança Suprema ($claim & $rt)',
    subtitle: 'Concede Claims extras por hora e reduz custo de $rt',
    effectText: (lvl) => `${1 + (lvl >= 1 ? 1 : 0) + (lvl >= 4 ? 1 : 0)} claims/h • $rt R$ ${Math.max(4.5, BASE_RT_COST - lvl * 1.5).toFixed(2)}`,
    baseCost: 45,
    multiplier: 1.9,
    accent: 'text-amber-300 border-amber-500/35 bg-amber-500/10',
  },
  {
    key: 'floor6Rainbow',
    floorNum: 6,
    title: 'Prisma Arco-Íris & Chaos Keys',
    subtitle: 'Desbloqueia cristal 🌈 R$ 45 e chance de +2 Keys ao casar repetida',
    effectText: (lvl) => (lvl === 0 ? 'Bloqueado (Nv 1 libera 🌈 Arco-Íris)' : `🌈 Liberado • ${lvl * 12}% chance de +2 Keys`),
    baseCost: 55,
    multiplier: 1.95,
    accent: 'text-rose-300 border-rose-500/35 bg-rose-500/10',
  },
];

function computeMudaeValueAndTier(claimRank: number): { baseValue: number; tierIndex: number; tierLabel: string } {
  const rank = Math.max(1, claimRank);
  // Mudae power-curve rank valuation scaled to BenBets R$
  const rawKakera = Math.round(1450 * Math.pow(rank, -0.48));
  const baseValue = Math.max(5.0, Math.min(150.0, Number((rawKakera / 10).toFixed(2))));

  let tierIndex = 0;
  if (rank <= 5) tierIndex = 4;
  else if (rank <= 25) tierIndex = 3;
  else if (rank <= 75) tierIndex = 2;
  else if (rank <= 150) tierIndex = 1;

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

// Curated fallback catalog with real AniList IDs/images in case AniList rate-limits
const FALLBACK_SEED: Array<{ id: number; name: string; series: string; gender: CharGender; favourites: number; image: string }> = [
  { id: 45627, name: 'Levi Ackerman', series: 'Attack on Titan', gender: 'Male', favourites: 138000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png' },
  { id: 127691, name: 'Satoru Gojo', series: 'Jujutsu Kaisen', gender: 'Male', favourites: 129500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-Um2kqT0uS6aL.png' },
  { id: 40, name: 'Monkey D. Luffy', series: 'One Piece', gender: 'Male', favourites: 118000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-chJF5P2dF99H.png' },
  { id: 62, name: 'Roronoa Zoro', series: 'One Piece', gender: 'Male', favourites: 112000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-W8kU27aF8267.png' },
  { id: 27, name: 'Killua Zoldyck', series: 'Hunter x Hunter', gender: 'Male', favourites: 109000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z9v2sR91P92G.png' },
  { id: 40881, name: 'Mikasa Ackerman', series: 'Attack on Titan', gender: 'Female', favourites: 96000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1P23nN4N.png' },
  { id: 124381, name: 'Zero Two', series: 'DARLING in the FRANXX', gender: 'Female', favourites: 92000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b124381-21T6r09P91v7.png' },
  { id: 89362, name: 'Rem', series: 'Re:ZERO', gender: 'Female', favourites: 88000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b89362-56W1dS0f1v58.png' },
  { id: 137079, name: 'Makima', series: 'Chainsaw Man', gender: 'Female', favourites: 84500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b137079-B3wX2sM9209s.png' },
  { id: 176754, name: 'Frieren', series: 'Frieren: Beyond Journey\'s End', gender: 'Female', favourites: 81000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b176754-Ya2vX20K03i7.png' },
  { id: 127518, name: 'Nezuko Kamado', series: 'Demon Slayer', gender: 'Female', favourites: 76000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-K9K11r90r21Z.png' },
  { id: 14, name: 'Itachi Uchiha', series: 'Naruto', gender: 'Male', favourites: 74500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9v1P507cW169.png' },
  { id: 89028, name: 'Megumin', series: 'KonoSuba', gender: 'Female', favourites: 72000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b89028-k4N8zR3h1c90.png' },
  { id: 71, name: 'L Lawliet', series: 'Death Note', gender: 'Male', favourites: 70500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b71-9S9P7W4496xX.png' },
  { id: 11, name: 'Edward Elric', series: 'Fullmetal Alchemist: Brotherhood', gender: 'Male', favourites: 69000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b11-0D590s5c38yT.png' },
  { id: 129927, name: 'Marin Kitagawa', series: 'My Dress-Up Darling', gender: 'Female', favourites: 67500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b129927-46c01k6qT367.png' },
  { id: 138101, name: 'Power', series: 'Chainsaw Man', gender: 'Female', favourites: 65000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b138101-kY6V0W8B57V5.png' },
  { id: 246, name: 'Son Goku', series: 'Dragon Ball Z', gender: 'Male', favourites: 63500, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b246-P009X9N6419X.png' },
  { id: 497, name: 'Saber', series: 'Fate/stay night', gender: 'Female', favourites: 61000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b497-w201r5942u2W.png' },
  { id: 206, name: 'Spike Spiegel', series: 'Cowboy Bebop', gender: 'Male', favourites: 59000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b206-N5t0M4X0d11n.png' },
  { id: 1555, name: 'Hinata Hyuga', series: 'Naruto', gender: 'Female', favourites: 56000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1555-510N625p03W1.png' },
  { id: 121102, name: 'Mai Sakurajima', series: 'Rascal Does Not Dream', gender: 'Female', favourites: 55000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b121102-32t5Y542R76J.png' },
  { id: 132645, name: 'Yor Forger', series: 'SPY x FAMILY', gender: 'Female', favourites: 53000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b132645-41G5P7Y2j24H.png' },
  { id: 131582, name: 'Anya Forger', series: 'SPY x FAMILY', gender: 'Female', favourites: 51000, image: 'https://s4.anilist.co/file/anilistcdn/character/large/b131582-9p52r97L228L.png' },
];

function buildFallbackCatalog(): MudaeChar[] {
  const sorted = [...FALLBACK_SEED].sort((a, b) => b.favourites - a.favourites);
  return sorted.map((item, idx) => {
    const rank = idx + 1;
    const { baseValue, tierIndex, tierLabel } = computeMudaeValueAndTier(rank);
    return {
      id: `anilist_${item.id}`,
      name: item.name,
      series: item.series,
      image: item.image,
      gender: item.gender,
      favourites: item.favourites,
      claimRank: rank,
      baseValue,
      tierIndex,
      tierLabel,
      role: 'Main',
    };
  });
}

let cachedMudaeMemory: MudaeChar[] | null = null;

const ANILIST_MUDAE_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    characters(sort: [FAVOURITES_DESC]) {
      id
      name {
        full
      }
      gender
      favourites
      image {
        large
      }
      media(sort: [POPULARITY_DESC], perPage: 1) {
        edges {
          characterRole
          node {
            title {
              romaji
              english
            }
          }
        }
      }
    }
  }
}
`;

function normalizeGender(raw: any): CharGender {
  if (typeof raw !== 'string') return 'Other';
  const g = raw.trim().toLowerCase();
  if (g === 'female') return 'Female';
  if (g === 'male') return 'Male';
  return 'Other';
}

async function fetchMudaeCatalogFromAniList(): Promise<MudaeChar[]> {
  const pages = [1, 2, 3, 4, 5];
  const responses = await Promise.all(
    pages.map(async (page) => {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_MUDAE_QUERY, variables: { page } }),
      });
      if (!res.ok) throw new Error('AniList HTTP error');
      return res.json();
    })
  );

  const rawList: Array<Omit<MudaeChar, 'claimRank' | 'baseValue' | 'tierIndex' | 'tierLabel'>> = [];
  const seen = new Set<number>();

  for (const json of responses) {
    const list = json?.data?.Page?.characters;
    if (!Array.isArray(list)) continue;
    for (const ch of list) {
      if (!ch?.id || seen.has(ch.id)) continue;
      seen.add(ch.id);
      const edge = ch.media?.edges?.[0];
      const titleObj = edge?.node?.title;
      const series = titleObj?.english || titleObj?.romaji || 'Anime';
      const rawRole = edge?.characterRole;
      const role = rawRole === 'MAIN' ? 'Main' : rawRole === 'SUPPORTING' ? 'Supporting' : rawRole === 'BACKGROUND' ? 'Background' : undefined;
      rawList.push({
        id: `anilist_${ch.id}`,
        name: ch.name?.full || 'Personagem',
        series,
        image: ch.image?.large || '',
        gender: normalizeGender(ch.gender),
        favourites: typeof ch.favourites === 'number' && Number.isFinite(ch.favourites) ? ch.favourites : 1000,
        role,
      });
    }
  }

  rawList.sort((a, b) => b.favourites - a.favourites);

  return rawList.map((item, idx) => {
    const claimRank = idx + 1;
    const { baseValue, tierIndex, tierLabel } = computeMudaeValueAndTier(claimRank);
    return {
      ...item,
      claimRank,
      baseValue,
      tierIndex,
      tierLabel,
    };
  });
}

async function fetchMudaeCatalogFromJikan(): Promise<MudaeChar[]> {
  const rawList: Array<Omit<MudaeChar, 'claimRank' | 'baseValue' | 'tierIndex' | 'tierLabel'>> = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 4; page++) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/top/characters?page=${page}&limit=25`);
      if (!res.ok) continue;
      const d = await res.json();
      if (!Array.isArray(d?.data)) continue;
      for (const ch of d.data) {
        if (!ch?.mal_id || seen.has(ch.mal_id)) continue;
        seen.add(ch.mal_id);
        const series = Array.isArray(ch.nicknames) && ch.nicknames[0] ? ch.nicknames[0] : 'MyAnimeList Top';
        // Alternate heuristic only if Jikan fallback runs
        const genderGuess: CharGender = rawList.length % 2 === 0 ? 'Male' : 'Female';
        rawList.push({
          id: `anime_${ch.mal_id}`,
          name: ch.name || 'Personagem',
          series,
          image: ch.images?.jpg?.image_url || '',
          gender: genderGuess,
          favourites: typeof ch.favorites === 'number' ? ch.favorites : 1500,
          role: 'Main',
        });
      }
      if (page < 4) await new Promise((r) => setTimeout(r, 320));
    } catch {
      // Ignore single page fetch failure
    }
  }

  rawList.sort((a, b) => b.favourites - a.favourites);
  return rawList.map((item, idx) => {
    const claimRank = idx + 1;
    const { baseValue, tierIndex, tierLabel } = computeMudaeValueAndTier(claimRank);
    return { ...item, claimRank, baseValue, tierIndex, tierLabel };
  });
}

function generateKakeraCrystal(
  tierIndex: number,
  floor6Level: number,
  bonusBoost = false
): KakeraCrystal {
  const pool = KAKERA_CRYSTALS.filter((c) => !c.requiresFloor6 || floor6Level >= 1 || tierIndex >= 4);
  const weighted = pool.map((c) => {
    let w = c.weight;
    if (bonusBoost && c.baseValue >= 10) w *= 2.4;
    if (tierIndex >= 3 && c.baseValue >= 6.5) w *= 1.5;
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
    id: `kakera-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: picked.label,
    emoji: picked.emoji,
    baseValue: picked.baseValue,
    colorClass: picked.colorClass,
    glowStyle: picked.glowStyle,
    collected: false,
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
    rank: rankMatch ? Number(rankMatch[1]) : 180,
    favourites: favMatch ? Number(favMatch[1]) : 1000,
    gender,
  };
}

const AvatarWithFallback: React.FC<{ src: string; name: string; className?: string }> = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
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
  return <img src={src} alt={name} className={className} onError={() => setFailed(true)} />;
};

export default function AnimeGacha({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  userId,
  collection,
  onCollectionUpdate,
  onSellCard,
}: AnimeGachaProps) {
  const [tab, setTab] = useState<MudaeTab>('roll');
  const [catalog, setCatalog] = useState<MudaeChar[]>(() => cachedMudaeMemory || buildFallbackCatalog());
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [mudaeData, setMudaeData] = useState<MudaeUserData>(getDefaultMudaeUserData);
  const [serverClaims, setServerClaims] = useState<Record<string, ServerAnimeClaim>>({});
  const [serverWishCounts, setServerWishCounts] = useState<Record<string, number>>({});
  const [rollsHistory, setRollsHistory] = useState<RollEntry[]>([]);
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [lastRollMode, setLastRollMode] = useState<RollMode>('wa');
  const [bannerToast, setBannerToast] = useState<{ text: string; tone: 'success' | 'wish' | 'warn' | 'kakera' } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Filters & Search
  const [haremSearch, setHaremSearch] = useState('');
  const [haremSort, setHaremSort] = useState<'value' | 'rank' | 'keys'>('value');
  const [listSection, setListSection] = useState<'wish' | 'disable'>('wish');
  const [wishSearch, setWishSearch] = useState('');
  const [disableSearch, setDisableSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [serverOwnerFilter, setServerOwnerFilter] = useState<string>('all');
  const [selectedCharModal, setSelectedCharModal] = useState<MudaeChar | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const { play } = useSound();

  const showToast = useCallback((text: string, tone: 'success' | 'wish' | 'warn' | 'kakera' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setBannerToast({ text, tone });
    toastTimerRef.current = window.setTimeout(() => setBannerToast(null), 4200);
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

  // Subscribe in realtime to all Firebase users' claimed characters & wishlists
  useEffect(() => {
    const unsub = subscribeToServerAnimeClaims((claims, wishes) => {
      setServerClaims(claims);
      setServerWishCounts(wishes);
    });
    return () => unsub();
  }, []);

  // Fetch 250 real ranked characters from AniList GraphQL API (with gender + favourites)
  useEffect(() => {
    if (cachedMudaeMemory && cachedMudaeMemory.length >= 150) {
      setCatalog(cachedMudaeMemory);
      return;
    }

    try {
      const rawCache = sessionStorage.getItem(CATALOG_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (Array.isArray(parsed) && parsed.length >= 150) {
          cachedMudaeMemory = parsed;
          setCatalog(parsed);
          return;
        }
      }
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      setLoadingStatus('Sincronizando ranks, gêneros e valores com a AniList API...');
      let loaded: MudaeChar[] = [];
      try {
        loaded = await fetchMudaeCatalogFromAniList();
      } catch {
        /* fallback below */
      }

      if (loaded.length < 80 && !cancelled) {
        setLoadingStatus('Carregando catálogo via Jikan / MyAnimeList API...');
        const jikan = await fetchMudaeCatalogFromJikan();
        if (jikan.length > loaded.length) loaded = jikan;
      }

      if (loaded.length < 30 && !cancelled) {
        loaded = buildFallbackCatalog();
      }

      if (!cancelled && loaded.length > 0) {
        cachedMudaeMemory = loaded;
        setCatalog(loaded);
        try {
          sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(loaded));
        } catch { /* quota */ }
        setLoadingStatus('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Unique series sorted by count
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

  // Derived Mudae limits from Tower floors
  const maxRollsPerHour = 10 + mudaeData.tower.floor1Rolls * 2;
  const maxClaimsPerHour =
    1 + (mudaeData.tower.floor5Claims >= 1 ? 1 : 0) + (mudaeData.tower.floor5Claims >= 4 ? 1 : 0);
  const maxWishSlots = 5 + mudaeData.tower.floor4Slots * 2;
  const maxDisableSlots = 4 + mudaeData.tower.floor4Slots;
  const reactionMultiplier = 1 + mudaeData.tower.floor2Reaction * 0.15;
  const wishSpawnWeight = 2.5 + mudaeData.tower.floor3WishSpawn * 0.75;
  const rtCost = Math.max(4.5, Number((BASE_RT_COST - mudaeData.tower.floor5Claims * 1.5).toFixed(2)));

  // Active roll/claim counters with hourly window auto-reset
  const rollsWindowExpired =
    mudaeData.rollsWindowStart > 0 && now - mudaeData.rollsWindowStart >= HOUR_MS;
  const rollsUsed = rollsWindowExpired ? 0 : mudaeData.rollsUsed;
  const rollsRemaining = Math.max(0, maxRollsPerHour - rollsUsed);
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
    () => rollsHistory.find((r) => r.instanceId === activeRollId) || rollsHistory[0] || null,
    [rollsHistory, activeRollId]
  );

  // Build weighted character pool respecting mode ($wa/$ha/$ma), disablelist, and wishlist weights
  const pickCharacterForRoll = useCallback(
    (mode: RollMode): MudaeChar => {
      const disabledSet = new Set(mudaeData.disablelist);
      const wishSet = new Set(mudaeData.wishlist);

      let pool = catalog.filter((c) => {
        if (mode === 'wa' && c.gender !== 'Female') return false;
        if (mode === 'ha' && c.gender !== 'Male') return false;
        return !disabledSet.has(c.series);
      });

      // Guarantee safe minimum pool so aggressive disablelists never empty the roulette
      if (pool.length < 15) {
        pool = catalog.filter((c) => {
          if (mode === 'wa') return c.gender === 'Female';
          if (mode === 'ha') return c.gender === 'Male';
          return true;
        });
      }
      if (pool.length === 0) pool = catalog;

      const weighted = pool.map((c) => {
        let weight = 1;
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
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [catalog, mudaeData.disablelist, mudaeData.wishlist, wishSpawnWeight]
  );

  const performRoll = useCallback(
    (mode: RollMode, usePaidExtra = false) => {
      if (catalog.length === 0) return;

      if (rollsRemaining <= 0 && !usePaidExtra) {
        play('lose');
        showToast(
          `⏳ Seus ${maxRollsPerHour} rolls gratuitos da hora acabaram! Use "Roll Extra (R$ ${EXTRA_ROLL_COST.toFixed(2)})" ou aguarde ${formatCountdown(rollsResetInMs)}.`,
          'warn'
        );
        return;
      }

      if (usePaidExtra) {
        if (balance < EXTRA_ROLL_COST) {
          play('lose');
          showToast(`Saldo insuficiente para Roll Extra (R$ ${EXTRA_ROLL_COST.toFixed(2)}).`, 'warn');
          return;
        }
        onUpdateBalance(-EXTRA_ROLL_COST);
      } else {
        const ts = Date.now();
        persistMudaeData((prev) => {
          const expired = prev.rollsWindowStart === 0 || ts - prev.rollsWindowStart >= HOUR_MS;
          return {
            ...prev,
            rollsWindowStart: expired ? ts : prev.rollsWindowStart,
            rollsUsed: expired ? 1 : prev.rollsUsed + 1,
          };
        });
      }

      setTab('roll');
      setLastRollMode(mode);
      const char = pickCharacterForRoll(mode);
      const rolledAt = Date.now();
      const isWish = mudaeData.wishlist.includes(char.id);
      const myOwned = myCollectionMap.get(char.id);
      const serverOwner = serverClaims[char.id];
      const alreadyMarriedInServer = Boolean(myOwned || serverOwner);

      let grantedKeyHere = 0;
      if (myOwned) {
        // Rolling your own married character grants +1 (or +2 with Floor 6) Chaos Key!
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

      // Spawn Kakera R$ crystal on married rolls (100%) or 45% chance on free characters
      const crystal =
        alreadyMarriedInServer || Math.random() < 0.45
          ? generateKakeraCrystal(char.tierIndex, mudaeData.tower.floor6Rainbow, Boolean(myOwned))
          : null;

      const entry: RollEntry = {
        instanceId: `roll-${rolledAt}-${Math.random().toString(36).slice(2, 6)}`,
        char,
        mode,
        rolledAt,
        expiresAt: rolledAt + CLAIM_WINDOW_MS,
        crystal,
        isWish,
        claimedHereByMe: false,
        grantedKeyHere,
      };

      setRollsHistory((prev) => [entry, ...prev].slice(0, 8));
      setActiveRollId(entry.instanceId);

      if (isWish) {
        play('legendary');
        showToast(`🌟 ALERTA DE WISHLIST! ${char.name} (#${char.claimRank}) apareceu!`, 'wish');
      } else if (myOwned) {
        play('rare');
        showToast(
          `🔑 Chaos Key +${grantedKeyHere} em ${char.name}! Valor aumentado em +${grantedKeyHere * 10}% + Cristal R$ gerado!`,
          'kakera'
        );
      } else if (char.tierIndex >= 3) {
        play('rare');
      } else {
        play('cardFlip');
      }
    },
    [
      catalog.length,
      rollsRemaining,
      maxRollsPerHour,
      rollsResetInMs,
      balance,
      onUpdateBalance,
      persistMudaeData,
      pickCharacterForRoll,
      mudaeData.wishlist,
      mudaeData.tower.floor6Rainbow,
      myCollectionMap,
      serverClaims,
      onCollectionUpdate,
      play,
      showToast,
    ]
  );

  // Claim / Marriage (💖 Casar) with server-wide Firebase exclusivity check
  const handleClaimEntry = useCallback(
    async (entry: RollEntry) => {
      if (claimingId) return;
      const char = entry.char;
      const ts = Date.now();

      if (ts > entry.expiresAt) {
        play('lose');
        showToast(`⏳ O tempo de reivindicação para ${char.name} expirou!`, 'warn');
        return;
      }

      if (myCollectionMap.has(char.id) || serverClaims[char.id]) {
        const owner = serverClaims[char.id]?.ownerName || 'você';
        play('lose');
        showToast(`💍 ${char.name} já está casado(a) com ${owner} neste servidor!`, 'warn');
        return;
      }

      if (claimsRemaining <= 0) {
        play('lose');
        showToast(
          `💔 Você já usou seu Claim deste ciclo! Use "$rt" (R$ ${rtCost.toFixed(2)}) ou aguarde ${formatCountdown(claimsResetInMs)}.`,
          'warn'
        );
        return;
      }

      setClaimingId(entry.instanceId);
      try {
        // Live check against Firestore to avoid claim race conditions between users
        const liveOwner = await checkServerAnimeClaim(char.id);
        if (liveOwner) {
          play('lose');
          showToast(`💔 Tarde demais! ${liveOwner.ownerName} acabou de casar com ${char.name}!`, 'warn');
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

        // Consume claim slot & remove from wishlist automatically if wished
        persistMudaeData((prev) => {
          const expired = prev.claimsWindowStart === 0 || ts - prev.claimsWindowStart >= HOUR_MS;
          return {
            ...prev,
            claimsWindowStart: expired ? ts : prev.claimsWindowStart,
            claimsUsed: expired ? 1 : prev.claimsUsed + 1,
            wishlist: prev.wishlist.filter((id) => id !== char.id),
          };
        });

        // Mark entry claimed & ensure a bonus post-marriage reaction crystal is ready
        const bonusCrystal =
          entry.crystal || generateKakeraCrystal(char.tierIndex, mudaeData.tower.floor6Rainbow, true);
        setRollsHistory((prev) =>
          prev.map((r) =>
            r.instanceId === entry.instanceId
              ? { ...r, claimedHereByMe: true, crystal: bonusCrystal }
              : r
          )
        );

        if (onAddBetHistory) {
          onAddBetHistory({
            id: `mudae-claim-${ts}`,
            matchName: 'Mudae Bot ($claim)',
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
        showToast(
          `💖 Casamento confirmado! ${char.name} agora é exclusivamente seu no servidor!`,
          'success'
        );
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
      onCollectionUpdate,
      persistMudaeData,
      mudaeData.tower.floor6Rainbow,
      onAddBetHistory,
      play,
      showToast,
    ]
  );

  // Collect Kakera R$ reaction crystal
  const handleCollectCrystal = useCallback(
    (entry: RollEntry) => {
      if (!entry.crystal || entry.crystal.collected) return;
      const myOwned = myCollectionMap.get(entry.char.id);
      const serverOwner = serverClaims[entry.char.id];
      const keys = myOwned?.quantity || serverOwner?.keys || 1;
      const keyBonus = 1 + Math.min(0.6, Math.max(0, keys - 1) * 0.1);
      const payout = Number((entry.crystal.baseValue * reactionMultiplier * keyBonus).toFixed(2));

      setRollsHistory((prev) =>
        prev.map((r) =>
          r.instanceId === entry.instanceId && r.crystal
            ? { ...r, crystal: { ...r.crystal, collected: true } }
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
      showToast(`${entry.crystal.emoji} Reação coletada! +R$ ${payout.toFixed(2)} no seu saldo!`, 'kakera');
    },
    [myCollectionMap, serverClaims, reactionMultiplier, onUpdateBalance, persistMudaeData, play, showToast]
  );

  // Reset claim cooldown ($rt) using R$
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

  // Toggle wishlist ($wish)
  const toggleWishlist = useCallback(
    (char: MudaeChar) => {
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
        wishlist: exists
          ? prev.wishlist.filter((id) => id !== char.id)
          : [...prev.wishlist, char.id],
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

  // Toggle disablelist ($disable)
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
        exists
          ? `✅ Série "${seriesName}" reativada nas roletas.`
          : `🚫 Série "${seriesName}" bloqueada ($disable) — mais chance para o restante!`,
        'success'
      );
    },
    [mudaeData.disablelist, maxDisableSlots, persistMudaeData, play, showToast]
  );

  // Tower upgrade ($kt)
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
        tower: {
          ...prev.tower,
          [floor.key]: prev.tower[floor.key] + 1,
        },
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

  // Demolish Tower ($destroy) — 100% refund of invested R$
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

  // Divorce ($divorce) — releases character back to server and pays full R$ value
  const handleDivorce = useCallback(
    (card: PokemonCard, payoutValue: number) => {
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

  // Discord Command Bar handler ($wa, /wa, $ha, /ha, $ma, $claim, $rt, $kt, $mm, $wish, $disable, $server)
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
      if (activeRoll) {
        handleClaimEntry(activeRoll);
      } else {
        showToast('Role um personagem com $wa ou $ha primeiro para casar!', 'warn');
      }
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
    if (cmd === '$kt' || cmd === '/kt' || cmd === '$tower' || cmd === 'r$tower') {
      setTab('tower');
      play('click');
      return;
    }
    if (cmd === '$wish' || cmd === '/wish' || cmd === '$wl' || cmd === '/wl') {
      setTab('lists');
      setListSection('wish');
      if (arg) setWishSearch(arg);
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
      `Comando "${raw}" não reconhecido. Use $wa, $ha, $ma, $claim, $rt, $mm, $kt, $wish ou $disable.`,
      'warn'
    );
  };

  // Enrich personal harem cards with live catalog info
  const enrichedHarem = useMemo(() => {
    const list = collection.map((card) => {
      const cat = catalogById.get(card.id);
      const parsed = parseCardMetadata(card);
      const rank = cat?.claimRank ?? parsed.rank;
      const favourites = cat?.favourites ?? parsed.favourites;
      const gender = cat?.gender ?? parsed.gender;
      const tierInfo = cat
        ? { baseValue: cat.baseValue, tierIndex: cat.tierIndex, tierLabel: cat.tierLabel }
        : computeMudaeValueAndTier(rank);
      const keys = Math.max(1, card.quantity || 1);
      const divorceValue = getEffectiveValue(tierInfo.baseValue, keys);
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
  }, [collection, catalogById, haremSearch, haremSort]);

  const totalHaremValue = useMemo(
    () => enrichedHarem.reduce((sum, x) => sum + x.divorceValue, 0),
    [enrichedHarem]
  );

  const totalChaosKeys = useMemo(
    () => enrichedHarem.reduce((sum, x) => sum + Math.max(0, x.keys - 1), 0),
    [enrichedHarem]
  );

  // Server-wide ownership grouping
  const serverClaimsList = useMemo(() => {
    return (Object.values(serverClaims) as ServerAnimeClaim[])
      .map((claim) => {
        const cat = catalogById.get(claim.cardId);
        const rank = cat?.claimRank ?? 180;
        const valInfo = cat ? { baseValue: cat.baseValue, tierIndex: cat.tierIndex, tierLabel: cat.tierLabel } : computeMudaeValueAndTier(rank);
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

  // Filtered Wishlist & Disablelist search
  const wishCatalogResults = useMemo(() => {
    const q = wishSearch.trim().toLowerCase();
    const source = q
      ? catalog.filter((c) => c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q))
      : catalog;
    return source.slice(0, 36);
  }, [catalog, wishSearch]);

  const filteredSeriesList = useMemo(() => {
    const q = disableSearch.trim().toLowerCase();
    if (!q) return availableSeries.slice(0, 48);
    return availableSeries.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 48);
  }, [availableSeries, disableSearch]);

  const totalTowerLevel =
    mudaeData.tower.floor1Rolls +
    mudaeData.tower.floor2Reaction +
    mudaeData.tower.floor3WishSpawn +
    mudaeData.tower.floor4Slots +
    mudaeData.tower.floor5Claims +
    mudaeData.tower.floor6Rainbow;

  const activeServerOwner = activeRoll ? serverClaims[activeRoll.char.id] : undefined;
  const activeOwnedByMe = activeRoll ? myCollectionMap.has(activeRoll.char.id) || activeRoll.claimedHereByMe || activeServerOwner?.ownerUid === userId : false;
  const activeClaimSecondsLeft = activeRoll ? Math.max(0, Math.ceil((activeRoll.expiresAt - now) / 1000)) : 0;

  return (
    <div className="space-y-4">
      {/* Header Mudae Bot + Discord Status HUD */}
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
              <span className="text-[10px] font-mono font-bold bg-[#5865F2]/20 text-indigo-300 border border-[#5865F2]/40 px-2 py-0.5 rounded-full">
                DISCORD SERVER SYNC
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 px-2 py-0.5 rounded-full">
                {catalog.length} Personagens • AniList Rank
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
              Role com <span className="text-pink-300 font-mono font-bold">$wa</span> /{' '}
              <span className="text-sky-300 font-mono font-bold">$ha</span>, reivindique casamentos exclusivos no servidor Firebase, colete cristais de R$ e evolua sua Torre R$.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <div className="bg-[#070912]/90 border border-[#1d2236] rounded-xl px-3 py-2">
              <p className="text-[9px] font-mono uppercase text-slate-500">🎲 Rolls / Hora</p>
              <p className={`text-sm font-black font-mono ${rollsRemaining > 0 ? 'text-brand' : 'text-amber-400'}`}>
                {rollsRemaining}/{maxRollsPerHour}
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
              <p className="text-[9px] text-slate-500 font-mono">×{reactionMultiplier.toFixed(2)} Reação</p>
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
            { id: 'roll' as MudaeTab, label: '🎲 Roleta ($wa / $ha)', count: null },
            { id: 'harem' as MudaeTab, label: '💍 Meu Harém ($mm)', count: enrichedHarem.length },
            { id: 'tower' as MudaeTab, label: '🏰 Torre R$ ($kt)', count: totalTowerLevel },
            { id: 'lists' as MudaeTab, label: '🌟 Wish & Disablelist', count: mudaeData.wishlist.length },
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

      {/* TAB 1: ROLLS ($wa / $ha / $ma) */}
      {tab === 'roll' && (
        <div className="space-y-4">
          {/* Discord Command Input + Quick Roll Buttons */}
          <div className="bg-[#0b0d16] border border-[#23273d] rounded-2xl p-3.5 sm:p-4 space-y-3">
            <form onSubmit={handleCommandSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Terminal className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Digite comando Discord: $wa, /wa, $ha, /ha, $ma, $claim, $rt, $kt, $mm, $wish..."
                  className="w-full bg-[#06070d] border border-[#252940] focus:border-brand/60 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-extrabold text-xs cursor-pointer transition-all shrink-0"
              >
                Enviar
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => performRoll('wa', rollsRemaining <= 0)}
                className="group relative overflow-hidden rounded-xl p-3 border border-pink-500/40 bg-gradient-to-br from-pink-600/20 to-[#0d0f1a] hover:border-pink-400 text-left cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-pink-300 bg-pink-500/20 border border-pink-400/40 px-2 py-0.5 rounded-md">
                    $wa / /wa
                  </span>
                  <span className="text-base">♀️</span>
                </div>
                <p className="text-sm font-extrabold text-white mt-1.5">Roleta Waifu (Anime)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {rollsRemaining > 0 ? 'Grátis (usa 1 roll da hora)' : `Roll Extra • R$ ${EXTRA_ROLL_COST.toFixed(2)}`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => performRoll('ha', rollsRemaining <= 0)}
                className="group relative overflow-hidden rounded-xl p-3 border border-sky-500/40 bg-gradient-to-br from-sky-600/20 to-[#0d0f1a] hover:border-sky-400 text-left cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-sky-300 bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 rounded-md">
                    $ha / /ha
                  </span>
                  <span className="text-base">♂️</span>
                </div>
                <p className="text-sm font-extrabold text-white mt-1.5">Roleta Husbando (Anime)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {rollsRemaining > 0 ? 'Grátis (usa 1 roll da hora)' : `Roll Extra • R$ ${EXTRA_ROLL_COST.toFixed(2)}`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => performRoll('ma', rollsRemaining <= 0)}
                className="group relative overflow-hidden rounded-xl p-3 border border-purple-500/40 bg-gradient-to-br from-purple-600/20 to-[#0d0f1a] hover:border-purple-400 text-left cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-purple-300 bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 rounded-md">
                    $ma / /ma
                  </span>
                  <span className="text-base">🎴</span>
                </div>
                <p className="text-sm font-extrabold text-white mt-1.5">Roleta Mista (Todos)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {rollsRemaining > 0 ? 'Grátis (usa 1 roll da hora)' : `Roll Extra • R$ ${EXTRA_ROLL_COST.toFixed(2)}`}
                </p>
              </button>
            </div>

            {claimsRemaining <= 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/35 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-amber-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Seus claims deste ciclo acabaram (reset em <span className="font-mono font-bold">{formatCountdown(claimsResetInMs)}</span>). Quer casar agora?
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

          {/* Discord Mudae Embed Card Display */}
          {activeRoll ? (
            <motion.div
              key={activeRoll.instanceId}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`bg-[#111422] rounded-2xl border overflow-hidden border-l-4 ${
                activeRoll.isWish
                  ? 'border-pink-400 shadow-[0_0_28px_rgba(244,114,182,0.35)]'
                  : 'border-[#252a42] ' + TIER_CONFIG[activeRoll.char.tierIndex].cardGlow
              }`}
              style={{ borderLeftColor: activeRoll.isWish ? '#f472b6' : TIER_CONFIG[activeRoll.char.tierIndex].embed }}
            >
              {/* Discord bot message bar */}
              <div className="px-4 py-2.5 bg-[#090b13] border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white">Mudae</span>
                  <span className="text-[9px] font-mono font-black bg-[#5865F2] text-white px-1.5 py-0.5 rounded uppercase">
                    APP
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Comando <span className="text-brand font-bold">${activeRoll.mode}</span>
                  </span>
                  {activeRoll.isWish && (
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
                  ) : activeServerOwner ? (
                    <span className="text-amber-300 font-bold">
                      💍 Pertence a {activeServerOwner.ownerName}
                    </span>
                  ) : activeClaimSecondsLeft > 0 ? (
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full border ${
                        activeClaimSecondsLeft <= 10
                          ? 'text-rose-300 bg-rose-500/20 border-rose-400/50 animate-pulse'
                          : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                      }`}
                    >
                      ⏱️ {activeClaimSecondsLeft}s para casar
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold">⏳ Tempo expirado</span>
                  )}
                </div>
              </div>

              {/* Embed Card Body */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
                <div className="relative mx-auto md:mx-0 w-52 sm:w-60 aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-[#07080f] shadow-xl">
                  <AvatarWithFallback
                    src={activeRoll.char.image}
                    name={activeRoll.char.name}
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
                  <div>
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
                  </div>

                  {/* Mudae Rank / Value Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Claim Rank</p>
                      <p className="text-base font-black font-mono text-white">#{activeRoll.char.claimRank}</p>
                    </div>
                    <div className="bg-[#080a12] border border-[#1d2236] rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500 font-mono uppercase">Valor Base R$</p>
                      <p className="text-base font-black font-mono text-brand">
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

                  {/* Ownership Status & Action Reactions */}
                  <div className="space-y-2.5">
                    {!activeOwnedByMe && !activeServerOwner && (
                      <button
                        type="button"
                        disabled={activeClaimSecondsLeft <= 0 || claimsRemaining <= 0 || claimingId === activeRoll.instanceId}
                        onClick={() => handleClaimEntry(activeRoll)}
                        className={`w-full py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          activeClaimSecondsLeft > 0 && claimsRemaining > 0
                            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:brightness-110 text-white shadow-[0_0_24px_rgba(244,63,94,0.4)] hover:scale-[1.01]'
                            : 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <Heart className="w-5 h-5 fill-current" />
                        <span>
                          {claimingId === activeRoll.instanceId
                            ? 'Verificando servidor Firebase...'
                            : activeClaimSecondsLeft <= 0
                              ? 'Tempo de Reivindicação Expirado'
                              : claimsRemaining <= 0
                                ? `Sem Claim Disponível (Use $rt por R$ ${rtCost.toFixed(2)})`
                                : `💖 Casar / Reivindicar ${activeRoll.char.name} (${activeClaimSecondsLeft}s)`}
                        </span>
                      </button>
                    )}

                    {activeServerOwner && !activeOwnedByMe && (
                      <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-amber-200 font-bold">
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            Exclusivo no servidor: <strong className="text-white">{activeServerOwner.ownerName}</strong> já casou com {activeRoll.char.name}!
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-300 shrink-0">
                          🔑 {Math.max(0, activeServerOwner.keys - 1)} keys
                        </span>
                      </div>
                    )}

                    {activeOwnedByMe && (
                      <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-200 font-bold">
                          <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            {activeRoll.claimedHereByMe
                              ? `Você acabou de casar com ${activeRoll.char.name}!`
                              : activeRoll.grantedKeyHere > 0
                                ? `Você já é casado(a) com ${activeRoll.char.name}! +${activeRoll.grantedKeyHere} Chaos Key adicionada!`
                                : `Este personagem faz parte do seu Harém no servidor!`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Kakera / R$ Crystal Reaction */}
                    {activeRoll.crystal && (
                      <div className="pt-1">
                        {!activeRoll.crystal.collected ? (
                          <button
                            type="button"
                            onClick={() => handleCollectCrystal(activeRoll)}
                            style={{ boxShadow: activeRoll.crystal.glowStyle }}
                            className={`w-full py-3 px-4 rounded-xl border bg-gradient-to-r ${activeRoll.crystal.colorClass} font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.01] transition-all animate-pulse`}
                          >
                            <span className="text-xl">{activeRoll.crystal.emoji}</span>
                            <span>
                              Coletar Reação {activeRoll.crystal.label} (+R${' '}
                              {(
                                activeRoll.crystal.baseValue *
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
                              ).toFixed(2)}
                              )
                            </span>
                          </button>
                        ) : (
                          <div className="w-full py-2.5 px-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-xs font-mono font-bold text-center">
                            ✅ Cristal {activeRoll.crystal.emoji} {activeRoll.crystal.label} coletado neste spawn!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Next Roll shortcut */}
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
                      onClick={() => performRoll(lastRollMode, rollsRemaining <= 0)}
                      className="px-4 py-2 rounded-xl bg-brand hover:bg-[#00e276] text-slate-950 font-black text-xs cursor-pointer transition-all"
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
                Pronto para começar no servidor Mudae!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Clique em <span className="text-pink-300 font-mono font-bold">$wa</span> (Waifus),{' '}
                <span className="text-sky-300 font-mono font-bold">$ha</span> (Husbandos) ou digite o comando na barra acima. Personagens casados ficam exclusivos seus para todo o servidor Firebase!
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => performRoll('wa', false)}
                  className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs cursor-pointer"
                >
                  Rodar $wa (Waifus)
                </button>
                <button
                  type="button"
                  onClick={() => performRoll('ha', false)}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Rodar $ha (Husbandos)
                </button>
              </div>
            </div>
          )}

          {/* Recent Session Rolls Strip */}
          {rollsHistory.length > 1 && (
            <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-3.5 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Últimos Rolls da Sessão (clique para inspecionar ou reivindicar antes do tempo acabar)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {rollsHistory.map((item) => {
                  const isActive = activeRoll?.instanceId === item.instanceId;
                  const owner = serverClaims[item.char.id];
                  const secLeft = Math.max(0, Math.ceil((item.expiresAt - now) / 1000));
                  return (
                    <button
                      key={item.instanceId}
                      type="button"
                      onClick={() => setActiveRollId(item.instanceId)}
                      className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-brand/15 border-brand'
                          : item.isWish
                            ? 'bg-pink-500/10 border-pink-400/50'
                            : 'bg-[#070911] border-[#1c2033] hover:border-slate-500'
                      }`}
                    >
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-black/50 mb-1 relative">
                        <AvatarWithFallback src={item.char.image} name={item.char.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[8px] font-mono font-black bg-black/75 text-white px-1 rounded">
                          #{item.char.claimRank}
                        </span>
                        {item.crystal && !item.crystal.collected && (
                          <span className="absolute top-1 right-1 text-xs">{item.crystal.emoji}</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-white truncate">{item.char.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 truncate">
                        {owner ? `💍 ${owner.ownerName}` : secLeft > 0 ? `⏱️ ${secLeft}s` : `R$ ${item.char.baseValue.toFixed(0)}`}
                      </p>
                    </button>
                  );
                })}
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
              <p className="text-sm font-bold text-white">Seu harém ainda está vazio</p>
              <p className="text-xs text-slate-400">
                Vá para a aba <span className="text-brand font-bold">Roleta ($wa / $ha)</span> e clique em 💖 Casar quando encontrar um personagem disponível!
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
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5">
                      <p className="text-xs font-extrabold text-white truncate">{item.card.name}</p>
                      <p className="text-[10px] text-indigo-300 truncate">{item.series}</p>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 mt-auto">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Valor</span>
                      <span className="text-brand font-black">R$ {item.divorceValue.toFixed(2)}</span>
                    </div>
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

      {/* TAB 3: R$ TOWER ($kt / R$tower) */}
      {tab === 'tower' && (
        <div className="space-y-4">
          <div className="bg-[#0b0d16] border border-cyan-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold font-display text-white flex items-center gap-2">
                <TowerControl className="w-5 h-5 text-cyan-400" />
                Torre R$ ($kt / R$tower)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Construa andares permanentes para turbinar seus rolls, multiplicadores de reação R$, Wishlist e Claims no servidor.
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

                    {/* Progress Pips */}
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

      {/* TAB 4: WISHLIST ($wish) & DISABLELIST ($disable) */}
      {tab === 'lists' && (
        <div className="space-y-4">
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
              <span>Wishlist ($wish) • {mudaeData.wishlist.length}/{maxWishSlots}</span>
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

          {listSection === 'wish' ? (
            <div className="space-y-4">
              {/* Active Wishlist */}
              <div className="bg-[#0b0d16] border border-pink-500/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      🌟 Sua Wishlist ({mudaeData.wishlist.length}/{maxWishSlots} slots)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Bônus atual de spawn: <span className="text-pink-300 font-mono font-bold">×{wishSpawnWeight.toFixed(2)}</span> + Alerta imediato ao rolar!
                    </p>
                  </div>
                </div>

                {mudaeData.wishlist.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    Nenhum personagem na sua Wishlist ainda. Adicione abaixo no catálogo!
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
                            <AvatarWithFallback src={char.image} name={char.name} className="w-10 h-12 rounded-lg object-cover shrink-0" />
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

              {/* Search & Add Wishlist */}
              <div className="bg-[#0b0d16] border border-[#1d2236] rounded-2xl p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={wishSearch}
                    onChange={(e) => setWishSearch(e.target.value)}
                    placeholder="Buscar personagem ou anime para adicionar na Wishlist..."
                    className="w-full bg-[#06070d] border border-[#23273d] focus:border-pink-400/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                  {wishCatalogResults.map((char) => {
                    const wished = mudaeData.wishlist.includes(char.id);
                    const owner = serverClaims[char.id];
                    return (
                      <div
                        key={char.id}
                        className="flex items-center justify-between gap-2 bg-[#070911] border border-[#1c2033] rounded-xl p-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarWithFallback src={char.image} name={char.name} className="w-10 h-12 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{char.name}</p>
                            <p className="text-[10px] text-indigo-300 truncate">{char.series}</p>
                            <p className="text-[9px] font-mono text-slate-400">
                              #{char.claimRank} • {char.gender === 'Female' ? '$wa' : char.gender === 'Male' ? '$ha' : '$ma'} • R$ {char.baseValue.toFixed(2)}
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
                    Desative séries que você não coleciona para concentrar a roleta nos personagens que procura.
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
                          {s.count} personagens • Top #{s.topRank}
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

      {/* TAB 5: SERVER HAREM (ALL FIREBASE USERS) */}
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
                  {serverClaimsList.length} personagens já reivindicados no servidor por {serverOwners.length} jogadores.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
              Nenhum personagem reivindicado encontrado com esse filtro. Seja o primeiro a casar!
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
                      <AvatarWithFallback src={claim.image} name={claim.name} className="w-full h-full object-cover" />
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
                <AvatarWithFallback src={selectedCharModal.image} name={selectedCharModal.name} className="w-full h-full object-cover" />
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
