import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Sparkles, Search, Loader2, ShieldCheck, Coins, Layers, Eye, EyeOff, Swords } from 'lucide-react';
import type { PlacedBet, PokemonCard } from '../types';
import { useSound } from '../hooks/useSound';

type ValorantTier = 'Select' | 'Deluxe' | 'Premium' | 'Exclusive' | 'Ultra';

interface ValorantSkinItem {
  id: string;
  name: string;
  tier: ValorantTier;
  tierLabel: string;
  weapon: string;
  isMelee: boolean;
  imageUrl: string;
  fallbackUrl?: string;
  vpReal: number;
  price: number; // 10× Real BRL
}

interface ValorantGachaProps {
  balance: number;
  onUpdateBalance: (delta: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

const CATALOG_CACHE_KEY = 'benbets_valorant_catalog_v1';
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

const TIER_BY_UUID: Record<string, ValorantTier> = {
  '12683d76-48d7-84a3-4e09-6985794f0445': 'Select',
  '0cebb8be-46d7-c12a-d306-e9907bfc5a25': 'Deluxe',
  '60bca009-4182-7998-dee7-b8a2558dc369': 'Premium',
  'e046854e-406c-37f4-6607-19a9ba8426fc': 'Exclusive',
  '411e4a55-4e59-7757-41f0-86a53f101bb5': 'Ultra',
};

const TIER_META: Record<
  ValorantTier,
  {
    label: string;
    vpReal: number;
    basePrice10x: number;
    color: string;
    border: string;
    bg: string;
    glow: string;
    rank: number;
  }
> = {
  Select: {
    label: 'Select',
    vpReal: 875,
    basePrice10x: 320,
    color: 'text-sky-300',
    border: 'border-sky-400/45',
    bg: 'from-sky-500/15 to-[#0b111d]',
    glow: 'rgba(56,189,248,0.25)',
    rank: 1,
  },
  Deluxe: {
    label: 'Deluxe',
    vpReal: 1275,
    basePrice10x: 460,
    color: 'text-emerald-300',
    border: 'border-emerald-400/45',
    bg: 'from-emerald-500/15 to-[#0b111d]',
    glow: 'rgba(16,185,129,0.28)',
    rank: 2,
  },
  Premium: {
    label: 'Premium',
    vpReal: 1775,
    basePrice10x: 650,
    color: 'text-fuchsia-300',
    border: 'border-fuchsia-400/55',
    bg: 'from-fuchsia-500/18 to-[#0b111d]',
    glow: 'rgba(217,70,239,0.32)',
    rank: 3,
  },
  Exclusive: {
    label: 'Exclusive',
    vpReal: 2175,
    basePrice10x: 950,
    color: 'text-orange-300',
    border: 'border-orange-400/60',
    bg: 'from-orange-500/20 to-[#0b111d]',
    glow: 'rgba(249,115,22,0.36)',
    rank: 4,
  },
  Ultra: {
    label: 'Ultra',
    vpReal: 2475,
    basePrice10x: 1250,
    color: 'text-amber-300',
    border: 'border-amber-400/70',
    bg: 'from-amber-500/22 to-[#0b111d]',
    glow: 'rgba(251,191,36,0.45)',
    rank: 5,
  },
};

const KNOWN_GUNS = [
  'Vandal', 'Phantom', 'Operator', 'Sheriff', 'Ghost', 'Classic', 'Spectre',
  'Odin', 'Ares', 'Judge', 'Bucky', 'Bulldog', 'Guardian', 'Marshal',
  'Outlaw', 'Stinger', 'Frenzy', 'Shorty',
];

const CAPSULES = [
  {
    id: 'standard' as const,
    name: 'Cápsula Padrão',
    subtitle: '1× Skin Oficial',
    price: 450,
    count: 1,
    badge: '10× Real',
    desc: 'Pool completo com Select, Deluxe, Premium, Exclusive, Ultra e chance de Faca.',
    accent: 'border-sky-400/40 from-sky-500/15 to-[#0b1220]',
    btn: 'from-sky-500 to-cyan-500 text-slate-950',
    odds: { Select: 0.45, Deluxe: 0.28, Premium: 0.16, Exclusive: 0.07, Ultra: 0.025, Melee: 0.015 },
  },
  {
    id: 'radiant' as const,
    name: 'Cápsula Radiante',
    subtitle: '1× Alta Raridade',
    price: 850,
    count: 1,
    badge: '7% Faca • 9% Ultra',
    desc: 'Chances ampliadas para skins Premium, Exclusive, Ultra e Facas (até R$ 2.600).',
    accent: 'border-[#ff4655]/55 from-[#ff4655]/20 to-[#0f1320]',
    btn: 'from-[#ff4655] to-rose-500 text-white',
    odds: { Select: 0.1, Deluxe: 0.22, Premium: 0.32, Exclusive: 0.2, Ultra: 0.09, Melee: 0.07 },
  },
  {
    id: 'nightmarket' as const,
    name: 'Mercado Noturno',
    subtitle: '5× Skins (Deluxe+ Garantida)',
    price: 2000,
    count: 5,
    badge: '5× Pack • Melhor Valor',
    desc: 'Revela 5 skins de uma vez com pelo menos 1 Premium+ garantida e bônus de Facas.',
    accent: 'border-amber-400/55 from-amber-500/18 to-[#12101e]',
    btn: 'from-amber-400 to-orange-400 text-slate-950',
    odds: { Select: 0.28, Deluxe: 0.3, Premium: 0.22, Exclusive: 0.12, Ultra: 0.05, Melee: 0.03 },
  },
];

function detectWeaponAndMelee(displayName: string): { weapon: string; isMelee: boolean } {
  const lower = displayName.toLowerCase();
  for (const gun of KNOWN_GUNS) {
    if (lower.includes(gun.toLowerCase())) {
      return { weapon: gun, isMelee: false };
    }
  }
  return { weapon: 'Faca / Melee', isMelee: true };
}

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function computeValorantPrice(id: string, tier: ValorantTier, isMelee: boolean): { price: number; vpReal: number } {
  const meta = TIER_META[tier];
  const jitter = ((hashStr(id) % 100) / 100) * 0.12; // +0% to +12%
  if (isMelee) {
    // Melee real value: 3.550 - 5.350 VP (R$ 150 - R$ 260) -> 10x = R$ 1.500 - R$ 2.600
    const meleeBaseByTier: Record<ValorantTier, { price: number; vp: number }> = {
      Select: { price: 1500, vp: 3550 },
      Deluxe: { price: 1700, vp: 3550 },
      Premium: { price: 1950, vp: 3550 },
      Exclusive: { price: 2250, vp: 4350 },
      Ultra: { price: 2500, vp: 5350 },
    };
    const m = meleeBaseByTier[tier];
    return { price: Math.min(2600, Math.round(m.price * (1 + jitter * 0.5))), vpReal: m.vp };
  }
  return {
    price: Math.round(meta.basePrice10x * (1 + jitter)),
    vpReal: meta.vpReal,
  };
}

const FALLBACK_SKINS: ValorantSkinItem[] = [
  {
    id: 'val-fallback-reaver-vandal',
    name: 'Vandal Saqueador',
    tier: 'Premium',
    tierLabel: 'Premium',
    weapon: 'Vandal',
    isMelee: false,
    imageUrl: 'https://media.valorant-api.com/weaponskinchromas/092a25a4-422f-f577-37ac-26a5d489c155/fullrender.png',
    vpReal: 1775,
    price: 690,
  },
  {
    id: 'val-fallback-prime-vandal',
    name: 'Vandal Sublime',
    tier: 'Premium',
    tierLabel: 'Premium',
    weapon: 'Vandal',
    isMelee: false,
    imageUrl: 'https://media.valorant-api.com/weaponskinchromas/42162780-4673-b59c-4918-52b9749996d5/fullrender.png',
    vpReal: 1775,
    price: 700,
  },
  {
    id: 'val-fallback-elderflame-vandal',
    name: 'Vandal Ancifogo',
    tier: 'Ultra',
    tierLabel: 'Ultra',
    weapon: 'Vandal',
    isMelee: false,
    imageUrl: 'https://media.valorant-api.com/weaponskinchromas/44b01012-4090-657b-924c-a99923502223/fullrender.png',
    vpReal: 2475,
    price: 1320,
  },
  {
    id: 'val-fallback-oni-phantom',
    name: 'Phantom Oni',
    tier: 'Premium',
    tierLabel: 'Premium',
    weapon: 'Phantom',
    isMelee: false,
    imageUrl: 'https://media.valorant-api.com/weaponskinchromas/380c1759-456d-401c-6848-c3a2520f7221/fullrender.png',
    vpReal: 1775,
    price: 680,
  },
];

function ValorantWeaponImg({
  src,
  fallback,
  alt,
  className,
}: {
  src: string;
  fallback?: string;
  alt: string;
  className?: string;
}) {
  const candidates = useMemo(() => Array.from(new Set([src, fallback].filter(Boolean) as string[])), [src, fallback]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [src, fallback]);

  if (idx >= candidates.length) {
    return <span className="text-3xl select-none text-[#ff4655]/70">🔫</span>;
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

export default function ValorantGacha({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: ValorantGachaProps) {
  const { play } = useSound();
  const [catalog, setCatalog] = useState<ValorantSkinItem[]>(FALLBACK_SKINS);
  const [loadingApi, setLoadingApi] = useState(true);
  const [activeTab, setActiveTab] = useState<'store' | 'collection'>('store');

  const [isOpening, setIsOpening] = useState(false);
  const [openingLabel, setOpeningLabel] = useState('');
  const [lastResults, setLastResults] = useState<ValorantSkinItem[]>([]);
  const [soldInResultIdx, setSoldInResultIdx] = useState<Set<number>>(new Set());

  // Collection filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | ValorantTier | 'Melee'>('all');
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSkins() {
      try {
        const cachedRaw = localStorage.getItem(CATALOG_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.ts && Date.now() - cached.ts < CATALOG_TTL_MS && Array.isArray(cached.items) && cached.items.length > 100) {
            if (!cancelled) {
              setCatalog(cached.items);
              setLoadingApi(false);
            }
            return;
          }
        }
      } catch { /* ignore */ }

      try {
        const res = await fetch('https://valorant-api.com/v1/weapons/skins?language=pt-BR');
        const json = await res.json();
        const rawList: any[] = Array.isArray(json?.data) ? json.data : [];
        const parsed: ValorantSkinItem[] = [];

        for (const s of rawList) {
          const uuid = String(s?.uuid || '');
          const name = String(s?.displayName || '').trim();
          const tier = s?.contentTierUuid ? TIER_BY_UUID[String(s.contentTierUuid)] : undefined;
          if (!uuid || !name || !tier) continue;
          if (/(padrão|standard|random favorite|aleatória favorita)/i.test(name)) continue;

          const chromaRender = s?.chromas?.[0]?.fullRender;
          const displayIcon = s?.displayIcon;
          const imageUrl = chromaRender || displayIcon;
          if (!imageUrl || typeof imageUrl !== 'string') continue;

          const { weapon, isMelee } = detectWeaponAndMelee(name);
          const id = `val-${uuid}`;
          const { price, vpReal } = computeValorantPrice(id, tier, isMelee);

          parsed.push({
            id,
            name,
            tier,
            tierLabel: TIER_META[tier].label,
            weapon,
            isMelee,
            imageUrl,
            fallbackUrl: displayIcon && displayIcon !== imageUrl ? displayIcon : undefined,
            vpReal,
            price,
          });
        }

        if (!cancelled && parsed.length > 50) {
          setCatalog(parsed);
          try {
            localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: parsed }));
          } catch { /* quota */ }
        }
      } catch (err) {
        console.warn('[ValorantGacha] Falha ao carregar valorant-api.com, usando fallback:', err);
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    }
    loadSkins();
    return () => {
      cancelled = true;
    };
  }, []);

  const pools = useMemo(() => {
    const byTier: Record<ValorantTier, ValorantSkinItem[]> = {
      Select: [],
      Deluxe: [],
      Premium: [],
      Exclusive: [],
      Ultra: [],
    };
    const melees: ValorantSkinItem[] = [];
    for (const s of catalog) {
      if (s.isMelee) melees.push(s);
      else byTier[s.tier].push(s);
    }
    return { byTier, melees };
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
        const isMelee = c.setSeries === 'Faca / Melee';
        const tier: ValorantTier =
          c.rarity.includes('Ultra') ? 'Ultra' :
          c.rarity.includes('Exclusive') ? 'Exclusive' :
          c.rarity.includes('Premium') ? 'Premium' :
          c.rarity.includes('Deluxe') ? 'Deluxe' : 'Select';
        rec[c.id] = computeValorantPrice(c.id, tier, isMelee).price;
      }
    }
    return rec;
  }, [catalog, collection]);

  const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const rollOneFromOdds = useCallback(
    (odds: Record<'Select' | 'Deluxe' | 'Premium' | 'Exclusive' | 'Ultra' | 'Melee', number>, minPremium = false): ValorantSkinItem => {
      if (minPremium) {
        const highPool = [...pools.byTier.Premium, ...pools.byTier.Exclusive, ...pools.byTier.Ultra, ...pools.melees];
        if (highPool.length) return pickRandom(highPool);
      }
      const r = Math.random();
      let acc = 0;
      const order: Array<'Melee' | ValorantTier> = ['Melee', 'Ultra', 'Exclusive', 'Premium', 'Deluxe', 'Select'];
      for (const bucket of order) {
        acc += odds[bucket];
        if (r < acc) {
          if (bucket === 'Melee' && pools.melees.length) return pickRandom(pools.melees);
          if (bucket !== 'Melee' && pools.byTier[bucket].length) return pickRandom(pools.byTier[bucket]);
        }
      }
      return pickRandom(catalog);
    },
    [catalog, pools]
  );

  const handleOpenCapsule = (capsule: (typeof CAPSULES)[number]) => {
    if (isOpening || balance < capsule.price) return;

    onUpdateBalance(-capsule.price);
    setIsOpening(true);
    setOpeningLabel(capsule.name);
    setSoldInResultIdx(new Set());
    setLastResults([]);

    const rolled: ValorantSkinItem[] = [];
    for (let i = 0; i < capsule.count; i++) {
      // Night Market guarantees at least 1 Premium+ on the last slot if none yet
      const needsGuarantee =
        capsule.id === 'nightmarket' &&
        i === capsule.count - 1 &&
        !rolled.some((x) => x.isMelee || TIER_META[x.tier].rank >= 3);
      rolled.push(rollOneFromOdds(capsule.odds, needsGuarantee));
    }

    rolled.sort((a, b) => {
      if (a.isMelee !== b.isMelee) return a.isMelee ? -1 : 1;
      return b.price - a.price;
    });

    const hasTopDrop = rolled.some((x) => x.isMelee || x.tier === 'Ultra' || x.tier === 'Exclusive');
    if (hasTopDrop) play('bigwin');
    else play('win');

    const cardsToAdd: PokemonCard[] = rolled.map((skin) => ({
      id: skin.id,
      name: skin.name,
      imageUrl: skin.imageUrl,
      rarity: skin.isMelee ? `Faca ${skin.tierLabel}` : skin.tierLabel,
      setName: `${skin.vpReal} VP`,
      setSeries: skin.weapon,
      quantity: 1,
    }));

    const totalValue = rolled.reduce((s, x) => s + x.price, 0);

    setTimeout(() => {
      setIsOpening(false);
      setLastResults(rolled);
      onCollectionUpdate(cardsToAdd);

      if (onAddBetHistory) {
        onAddBetHistory({
          id: `val-${Date.now()}`,
          matchName: `Valorant — ${capsule.name}`,
          selectionName: rolled[0] ? `${rolled[0].name} (${rolled[0].isMelee ? 'Faca' : rolled[0].tierLabel})` : capsule.name,
          odds: Number((totalValue / capsule.price).toFixed(2)),
          stake: capsule.price,
          potentialPayout: totalValue,
          status: totalValue >= capsule.price ? 'won' : 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          type: 'casino',
          outcomeValue: `R$ ${totalValue.toLocaleString('pt-BR')}`,
        });
      }
    }, 1150);
  };

  const handleQuickSell = (skin: ValorantSkinItem, idx: number) => {
    if (soldInResultIdx.has(idx)) return;
    setSoldInResultIdx((prev) => new Set(prev).add(idx));
    onSellCard(skin.id, skin.price);
    play('cashout');
  };

  const duplicatesInfo = useMemo(() => {
    let count = 0;
    let totalValue = 0;
    for (const c of collection) {
      if (c.quantity > 1) {
        const extra = c.quantity - 1;
        count += extra;
        totalValue += (priceLookup[c.id] || 320) * extra;
      }
    }
    return { count, totalValue };
  }, [collection, priceLookup]);

  const totalCollectionValue = useMemo(() => {
    return collection.reduce((sum, c) => sum + (priceLookup[c.id] || 320) * c.quantity, 0);
  }, [collection, priceLookup]);

  const filteredCollection = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = showMissing ? catalog : catalog.filter((s) => collectionMap.has(s.id));
    return list
      .filter((s) => {
        if (tierFilter === 'Melee' && !s.isMelee) return false;
        if (tierFilter !== 'all' && tierFilter !== 'Melee' && s.tier !== tierFilter) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.weapon.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ownA = collectionMap.has(a.id) ? 1 : 0;
        const ownB = collectionMap.has(b.id) ? 1 : 0;
        if (ownA !== ownB) return ownB - ownA;
        if (a.isMelee !== b.isMelee) return a.isMelee ? -1 : 1;
        return b.price - a.price;
      });
  }, [catalog, collectionMap, search, tierFilter, showMissing]);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#ff4655]/35 bg-gradient-to-br from-[#190c14] via-[#111827] to-[#0a0f1c] p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,70,85,0.2),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.12),transparent_55%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#ff4655]/20 border border-[#ff4655]/50 flex items-center justify-center text-[#ff4655] shadow-[0_0_24px_rgba(255,70,85,0.3)] shrink-0">
              <Crosshair className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black font-display text-white">
                  VALORANT — Skins & Mercado Noturno
                </h2>
                <span className="text-[9px] font-mono font-bold bg-[#ff4655]/20 text-rose-200 border border-[#ff4655]/45 px-2 py-0.5 rounded-full">
                  10× Valor Real (VP)
                </span>
                <span className="text-[9px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full">
                  {loadingApi ? 'Carregando Valorant-API...' : `Valorant-API • ${catalog.length.toLocaleString('pt-BR')} Skins HD`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300/90 mt-0.5">
                Tiers oficiais (Select, Deluxe, Premium, Exclusive, Ultra + Facas 2×) com renders HD em português.
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1.5 bg-[#070a14] p-1 rounded-xl border border-white/10 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'store'
                  ? 'bg-[#ff4655] text-white shadow-[0_0_16px_rgba(255,70,85,0.4)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cápsulas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collection')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'collection'
                  ? 'bg-[#ff4655] text-white shadow-[0_0_16px_rgba(255,70,85,0.4)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Arsenal ({collection.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'store' ? (
        <div className="space-y-4">
          {/* Tier Reference Strip (10x Values) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['Select', 'Deluxe', 'Premium', 'Exclusive', 'Ultra'] as ValorantTier[]).map((t) => {
              const m = TIER_META[t];
              return (
                <div key={t} className={`rounded-xl border ${m.border} bg-[#090d18] p-2 text-center`}>
                  <p className={`text-[10px] font-black uppercase ${m.color}`}>{m.label}</p>
                  <p className="text-[11px] font-mono font-bold text-white mt-0.5">R$ {m.basePrice10x}+</p>
                  <p className="text-[9px] font-mono text-slate-400">{m.vpReal} VP</p>
                </div>
              );
            })}
            <div className="rounded-xl border border-[#ff4655]/60 bg-[#180c14] p-2 text-center">
              <p className="text-[10px] font-black uppercase text-[#ff4655]">🗡️ Facas</p>
              <p className="text-[11px] font-mono font-bold text-white mt-0.5">R$ 1.500–2.600</p>
              <p className="text-[9px] font-mono text-rose-300/80">3.550–5.350 VP</p>
            </div>
          </div>

          {/* Capsule Cards */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {CAPSULES.map((cap) => {
                const canAfford = balance >= cap.price;
                return (
                  <div
                    key={cap.id}
                    className={`rounded-2xl border bg-gradient-to-b ${cap.accent} p-4 flex flex-col justify-between gap-3 relative overflow-hidden`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-black/40 border border-white/15 text-slate-200">
                          {cap.badge}
                        </span>
                        <span className="text-xs font-mono font-black text-emerald-300">
                          R$ {cap.price.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <h3 className="text-base font-black font-display text-white">{cap.name}</h3>
                      <p className="text-[10px] font-mono text-slate-300 mt-0.5">{cap.subtitle}</p>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{cap.desc}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isOpening || !canAfford}
                      onClick={() => handleOpenCapsule(cap)}
                      className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${cap.btn} font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2`}
                    >
                      {loadingApi && isOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                      <span>Abrir por R$ {cap.price.toLocaleString('pt-BR')}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Opening Overlay */}
            <AnimatePresence>
              {isOpening && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 rounded-2xl bg-[#070a12]/95 backdrop-blur-sm border border-[#ff4655]/50 flex flex-col items-center justify-center p-6"
                >
                  <motion.div
                    animate={{ rotate: 360, scale: [0.9, 1.15, 0.95] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 rounded-2xl border-2 border-[#ff4655] bg-[#ff4655]/20 flex items-center justify-center shadow-[0_0_50px_rgba(255,70,85,0.65)]"
                  >
                    <Crosshair className="w-10 h-10 text-[#ff4655]" />
                  </motion.div>
                  <p className="mt-4 text-sm font-black uppercase tracking-widest text-white">
                    Descriptografando {openingLabel}...
                  </p>
                  <p className="text-[10px] font-mono text-rose-300 mt-1">VALORANT PROTOCOL • 10× REAL</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Results Grid */}
          {lastResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-[#080c16] p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <Swords className="w-4 h-4 text-[#ff4655]" />
                  Skins Reveladas ({lastResults.length}×)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  Valor Total: R$ {lastResults.reduce((s, x) => s + x.price, 0).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className={`grid gap-3 ${lastResults.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'}`}>
                {lastResults.map((skin, idx) => {
                  const meta = TIER_META[skin.tier];
                  const sold = soldInResultIdx.has(idx);
                  return (
                    <motion.div
                      key={`${skin.id}-${idx}`}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.06 }}
                      className={`rounded-xl border bg-gradient-to-b ${meta.bg} ${skin.isMelee ? 'border-[#ff4655]/80 shadow-[0_0_26px_rgba(255,70,85,0.3)]' : meta.border} p-3 flex flex-col justify-between text-center`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono mb-2">
                        <span className={`font-black uppercase ${skin.isMelee ? 'text-[#ff4655]' : meta.color}`}>
                          {skin.isMelee ? `🗡️ Faca ${meta.label}` : meta.label}
                        </span>
                        <span className="text-slate-400">{skin.vpReal} VP</span>
                      </div>

                      <div className="h-24 flex items-center justify-center my-1 px-1">
                        <ValorantWeaponImg
                          src={skin.imageUrl}
                          fallback={skin.fallbackUrl}
                          alt={skin.name}
                          className="max-h-full max-w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]"
                        />
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-extrabold text-white line-clamp-1" title={skin.name}>
                          {skin.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{skin.weapon}</p>
                        <p className="text-xs font-mono font-black text-emerald-300 mt-1">
                          R$ {skin.price.toLocaleString('pt-BR')}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={sold}
                        onClick={() => handleQuickSell(skin, idx)}
                        className={`mt-2.5 w-full py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          sold
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-200 border border-white/10'
                        }`}
                      >
                        {sold ? '✓ Vendida' : `Vender R$ ${skin.price.toLocaleString('pt-BR')}`}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        /* Collection / Arsenal Tab */
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#080c16] p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <p className="text-[10px] text-slate-400">Skins Únicas</p>
                <p className="font-mono font-black text-white">
                  {collection.length} / {catalog.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Valor do Arsenal (10×)</p>
                <p className="font-mono font-black text-emerald-300">
                  R$ {totalCollectionValue.toLocaleString('pt-BR')}
                </p>
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

          {/* Search & Tier Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0a0e19] border border-white/10 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar skin ou arma (ex: Vandal, Saqueador, Faca)..."
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex gap-1 flex-wrap">
              {(['all', 'Melee', 'Ultra', 'Exclusive', 'Premium', 'Deluxe', 'Select'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                    tierFilter === t
                      ? 'bg-[#ff4655] text-white border-[#ff4655]'
                      : 'bg-[#0a0e19] border-white/10 text-slate-300 hover:border-[#ff4655]/45'
                  }`}
                >
                  {t === 'all' ? 'Todas' : t === 'Melee' ? '🗡️ Facas' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Collection Grid */}
          {filteredCollection.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#080c16] p-10 text-center text-xs text-slate-400">
              Nenhuma skin encontrada. Abra cápsulas na aba principal para montar seu arsenal de Valorant!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredCollection.slice(0, 120).map((skin) => {
                const owned = collectionMap.get(skin.id);
                const qty = owned?.quantity || 0;
                const meta = TIER_META[skin.tier];

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl border p-2.5 flex flex-col justify-between text-center relative transition-all ${
                      qty === 0
                        ? 'border-white/5 bg-[#070a12]/70 opacity-45 grayscale'
                        : skin.isMelee
                          ? 'border-[#ff4655]/65 bg-gradient-to-b from-[#ff4655]/15 to-[#090d17]'
                          : `${meta.border} bg-gradient-to-b ${meta.bg}`
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className={`font-black ${skin.isMelee ? 'text-[#ff4655]' : meta.color}`}>
                        {skin.isMelee ? '🗡️ Faca' : meta.label}
                      </span>
                      {qty > 0 && (
                        <span className="bg-black/70 text-white px-1.5 py-0.5 rounded border border-white/15 font-bold">
                          ×{qty}
                        </span>
                      )}
                    </div>

                    <div className="h-20 flex items-center justify-center my-2 px-1">
                      <ValorantWeaponImg
                        src={skin.imageUrl}
                        fallback={skin.fallbackUrl}
                        alt={skin.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-white line-clamp-1" title={skin.name}>
                        {skin.name}
                      </p>
                      <p className="text-[9px] text-slate-400">{skin.weapon} • {skin.vpReal} VP</p>
                      <p className="text-[10px] font-mono font-bold text-emerald-300 mt-0.5">
                        R$ {skin.price.toLocaleString('pt-BR')}
                      </p>
                    </div>

                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onSellCard(skin.id, skin.price);
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

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#ff4655]" />
            <span>Dados & Renders oficiais via valorant-api.com • Cotação 10× valor real</span>
          </div>
        </div>
      )}
    </div>
  );
}
