import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, X, Sparkles } from 'lucide-react';
import { PlacedBet, PokemonCard } from '../types';
import { getAnimeGachaPackData, recordAnimeGachaPack } from '../firebase/db';
import { useSound } from '../hooks/useSound';

interface AnimeGachaProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

interface AnimeChar {
  id: string;
  name: string;
  series: string;
  image: string;
  rarity: number;
  role?: string;
}

const ROLE_LABELS: Record<string, string> = {
  Main: 'Principal',
  Supporting: 'Suporte',
  Background: 'Secundário',
};

const RARITY = ['Comum', 'Raro', 'Super Raro', 'Ultra Raro', 'Lendário'];
const RARITY_COLORS = ['text-slate-300', 'text-blue-400', 'text-purple-400', 'text-orange-400', 'text-red-400'];
const RARITY_FILTER_ACTIVE = [
  'text-slate-200 bg-slate-500/20 border-slate-400/50',
  'text-blue-400 bg-blue-500/20 border-blue-500/50',
  'text-purple-400 bg-purple-500/20 border-purple-500/50',
  'text-orange-400 bg-orange-500/20 border-orange-500/50',
  'text-red-400 bg-red-500/20 border-red-500/50',
];
const RARITY_BG = ['from-slate-900/60', 'from-blue-900/60', 'from-purple-900/60', 'from-orange-900/60', 'from-red-900/60'];
const RARITY_WEIGHTS = [0.60, 0.275, 0.10, 0.02, 0.005];
const RARITY_PRICES = [0.50, 1.50, 5.00, 25.00, 100.00];
const PACK_PRICE = 24.99;
const PACK_SIZE = 1;
const MAX_PACKS_PER_HOUR = 5;
const HOUR_MS = 3600000;
const ANIME_CACHE_KEY = 'animeGachaChars_v7';

let cachedAnimeCharsMemory: AnimeChar[] | null = null;

function getCardValue(rarity: number): number {
  return RARITY_PRICES[rarity] || 0;
}

function getRarityBorder(rarity: number): string {
  if (rarity === 0) return 'border-slate-700';
  if (rarity === 1) return 'border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
  if (rarity === 2) return 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]';
  if (rarity === 3) return 'border-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.6)] shimmer-gold';
  if (rarity === 4) return 'border-red-400 shadow-[0_0_22px_rgba(239,68,68,0.7)] shimmer-rainbow';
  return 'border-slate-700';
}

function getRarityGlowColor(rarity: number): string {
  if (rarity === 4) return 'rgba(239,68,68,0.5)';
  if (rarity === 3) return 'rgba(251,146,60,0.4)';
  if (rarity === 2) return 'rgba(168,85,247,0.2)';
  return 'transparent';
}

const ANILIST_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    characters(sort: [FAVOURITES_DESC]) {
      id
      name {
        full
      }
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

async function fetchFromAniList(): Promise<AnimeChar[]> {
  const pages = [1, 2, 3, 4];
  const responses = await Promise.all(
    pages.map(async (page) => {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { page } }),
      });
      if (!res.ok) throw new Error('AniList HTTP error');
      return res.json();
    })
  );

  const all: AnimeChar[] = [];
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
      all.push({
        id: `anilist_${ch.id}`,
        name: ch.name?.full || 'Personagem',
        series,
        image: ch.image?.large || '',
        rarity: 0,
        role,
      });
    }
  }
  return all;
}

async function fetchFromJikanTop(): Promise<AnimeChar[]> {
  const all: AnimeChar[] = [];
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
        all.push({
          id: `anime_${ch.mal_id}`,
          name: ch.name || 'Personagem',
          series: Array.isArray(ch.nicknames) && ch.nicknames[0] ? ch.nicknames[0] : 'MyAnimeList Top',
          image: ch.images?.jpg?.image_url || '',
          rarity: 0,
          role: 'Main',
        });
      }
      if (page < 4) await new Promise(r => setTimeout(r, 350));
    } catch {
      // Ignore single page error
    }
  }
  return all;
}

export default function AnimeGacha({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  userId,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: AnimeGachaProps) {
  const [tab, setTab] = useState<'gacha' | 'collection'>('gacha');
  const [chars, setChars] = useState<AnimeChar[]>(() => cachedAnimeCharsMemory || []);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [packResult, setPackResult] = useState<AnimeChar[]>([]);
  const [opening, setOpening] = useState(false);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null);
  const [packData, setPackData] = useState({ count: 0, firstPackTime: 0 });
  const skipRef = useRef(false);
  const [starBurst, setStarBurst] = useState<{ show: boolean; rarity: number }>({ show: false, rarity: 0 });
  const [rareFlash, setRareFlash] = useState<{ show: boolean; rarity: number; label: string }>({ show: false, rarity: 0, label: '' });
  const [cardRevealed, setCardRevealed] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const { play } = useSound();

  const firstPackTime = packData.firstPackTime;
  const hourElapsed = firstPackTime > 0 && Date.now() - firstPackTime >= HOUR_MS;
  const packsUsed = hourElapsed ? 0 : packData.count;
  const nextReset = firstPackTime > 0 && !hourElapsed ? firstPackTime + HOUR_MS : null;
  const packsRemaining = Math.max(0, MAX_PACKS_PER_HOUR - packsUsed);

  useEffect(() => {
    if (!userId) return;
    getAnimeGachaPackData(userId).then(setPackData);
  }, [userId]);

  useEffect(() => {
    if (cachedAnimeCharsMemory && cachedAnimeCharsMemory.length > 0) {
      setChars(cachedAnimeCharsMemory);
      return;
    }

    try {
      const cache = sessionStorage.getItem(ANIME_CACHE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed) && parsed.length >= 80) {
          cachedAnimeCharsMemory = parsed;
          setChars(parsed);
          return;
        }
      }
    } catch {}

    let cancelled = false;
    (async () => {
      setLoadingProgress('Conectando à AniList GraphQL API...');
      let loaded: AnimeChar[] = [];
      try {
        loaded = await fetchFromAniList();
      } catch {
        // Fallback to Jikan
      }

      if (loaded.length < 50 && !cancelled) {
        setLoadingProgress('Carregando catálogo via Jikan API...');
        const fallback = await fetchFromJikanTop();
        if (fallback.length > loaded.length) loaded = fallback;
      }

      if (!cancelled && loaded.length > 0) {
        cachedAnimeCharsMemory = loaded;
        setChars(loaded);
        setLoadingProgress('');
        try {
          sessionStorage.setItem(ANIME_CACHE_KEY, JSON.stringify(loaded));
        } catch {}
      } else if (!cancelled) {
        setLoadingProgress('');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const pick = (): AnimeChar => {
    if (chars.length === 0) return { id: 'unknown', name: '???', series: '???', image: '', rarity: 0 };
    const r = Math.random();
    let cum = 0;
    let rar = 0;
    for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
      cum += RARITY_WEIGHTS[i];
      if (r < cum) { rar = i; break; }
    }
    const c = { ...chars[Math.floor(Math.random() * chars.length)] };
    c.rarity = rar;
    return c;
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE || chars.length === 0) return;
    if (packsUsed >= MAX_PACKS_PER_HOUR) return;

    play('packOpen');
    onUpdateBalance(-PACK_PRICE);
    if (userId) await recordAnimeGachaPack(userId);
    if (userId) getAnimeGachaPackData(userId).then(setPackData);
    setOpening(true);
    setPackResult([]);
    setCardRevealed(false);
    setCanClose(false);
    setRareFlash({ show: false, rarity: 0, label: '' });
    setStarBurst({ show: false, rarity: 0 });
    skipRef.current = false;

    const result: AnimeChar[] = [];
    for (let i = 0; i < PACK_SIZE; i++) result.push(pick());
    setPackResult(result);

    const bestRarity = Math.max(...result.map(c => c.rarity));

    // Summoning portal charge anticipation (550ms)
    await new Promise(r => setTimeout(r, 550));
    setCardRevealed(true);

    play(bestRarity >= 4 ? 'legendary' : bestRarity >= 2 ? 'rare' : 'cardFlip');

    if (bestRarity >= 3) {
      const labels = ['', '', '', '✨ Super Raro!', '⭐ Lendário!'];
      setRareFlash({ show: true, rarity: bestRarity, label: labels[bestRarity] });
      setStarBurst({ show: true, rarity: bestRarity });
      await new Promise(r => setTimeout(r, 1400));
      setStarBurst(prev => ({ ...prev, show: false }));
      await new Promise(r => setTimeout(r, 250));
      setRareFlash(prev => ({ ...prev, show: false }));
    } else {
      await new Promise(r => setTimeout(r, 450));
    }

    setCanClose(true);

    const newCards: PokemonCard[] = result.map(c => ({
      id: c.id,
      name: c.name,
      imageUrl: c.image,
      rarity: RARITY[c.rarity],
      setName: c.series,
      setSeries: c.series,
      quantity: 1,
    }));
    onCollectionUpdate(newCards);

    if (onAddBetHistory) {
      const rar = Math.max(...result.map(c => c.rarity));
      onAddBetHistory({
        id: `anime-${Date.now()}`, matchName: 'Anime Gacha',
        selectionName: result.map(c => c.name).join(', '),
        odds: 0, stake: PACK_PRICE, potentialPayout: 0,
        status: 'won', placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino', outcomeValue: RARITY[rar],
      });
    }
  };

  const closePack = () => {
    setOpening(false);
    setPackResult([]);
    setCardRevealed(false);
    setCanClose(false);
  };

  const handleSellDuplicates = () => {
    const prices: Record<string, number> = {};
    const dupes = collection.filter(c => c.quantity > 1);
    dupes.forEach(c => {
      const rarityIdx = RARITY.indexOf(c.rarity);
      prices[c.id] = getCardValue(rarityIdx >= 0 ? rarityIdx : 0);
    });
    if (Object.keys(prices).length > 0) onSellAllDuplicates(prices);
  };

  const handleSellCard = (cardId: string) => {
    const card = collection.find(c => c.id === cardId);
    if (!card || card.quantity <= 1) return;
    const rarityIdx = RARITY.indexOf(card.rarity);
    const value = getCardValue(rarityIdx >= 0 ? rarityIdx : 0);
    onSellCard(cardId, value);
  };

  const uniqueCollection = useMemo(() => {
    const map = new Map<string, PokemonCard>();
    collection.forEach(c => {
      if (!map.has(c.id)) {
        const fixed = { ...c };
        if (fixed.setSeries === 'Desconhecido') {
          const found = chars.find(ch => ch.id === c.id);
          if (found?.series) fixed.setSeries = found.series;
        }
        map.set(c.id, fixed);
      }
    });
    let arr = Array.from(map.values());
    if (rarityFilter !== null) {
      arr = arr.filter(c => RARITY.indexOf(c.rarity) === rarityFilter);
    }
    if (search) {
      arr = arr.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.setSeries.toLowerCase().includes(search.toLowerCase()));
    }
    if (seriesFilter) arr = arr.filter(c => c.setSeries === seriesFilter);
    return arr;
  }, [collection, rarityFilter, search, seriesFilter, chars]);

  const seriesList = useMemo(() => {
    const s = new Set<string>();
    collection.forEach(c => s.add(c.setSeries));
    return Array.from(s).sort();
  }, [collection]);

  const totalChars = chars.length;
  const uniqueCount = new Set(collection.map(c => c.id)).size;
  const hasDuplicates = useMemo(() => collection.some(c => c.quantity > 1), [collection]);
  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isSpecial = (r: number) => r >= 3;

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent" />

      <div className="bg-[#070910] border border-yellow-500/20 rounded-xl p-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-500/15 border border-yellow-500/30 rounded-lg text-yellow-400">
            <Star className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold font-display text-white">Anime Gacha</span>
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                AniList GraphQL API
              </span>
            </div>
            <p className="text-[10px] text-slate-400">200 personagens mais populares em HD</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-yellow-400 shrink-0">{uniqueCount}/{totalChars}</span>
      </div>

      <div className="flex gap-1.5">
        {[
          { id: 'gacha' as const, label: 'Portal Gacha', icon: '🎴' },
          { id: 'collection' as const, label: `Coleção (${uniqueCount})`, icon: '📚' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer ${
              tab === t.id ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.2)]' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Subtle radial celebration overlay for high rarity pulls */}
      <AnimatePresence>
        {starBurst.show && (
          <motion.div
            key="starburst"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          >
            <div
              className="gacha-light-beam"
              style={{ '--beam-color': starBurst.rarity === 4 ? 'rgba(239,68,68,0.24)' : 'rgba(251,146,60,0.22)' } as React.CSSProperties}
            />
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 omnitrix-panel px-5 py-2.5 rounded-full border-amber-400/40"
            >
              <span className={`text-sm sm:text-base font-black ${starBurst.rarity === 4 ? 'text-red-400' : 'text-orange-300'}`}>
                {starBurst.rarity === 4 ? '⭐ LENDÁRIO!' : '✨ SUPER RARO!'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rareFlash.show && (
          <motion.div
            key="rareflash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="fixed inset-0 z-[60] pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${rareFlash.rarity === 4 ? 'rgba(239,68,68,0.22)' : 'rgba(251,146,60,0.2)'}, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {tab === 'gacha' ? (
          <motion.div key="gacha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {chars.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 animate-pulse">🎴</div>
                <p className="text-slate-300 text-xs mb-2 font-semibold">Carregando personagens...</p>
                {loadingProgress && (
                  <p className="text-[10px] font-mono text-brand">{loadingProgress}</p>
                )}
              </div>
            ) : (
              <>
                <div className="bg-[#070910] rounded-2xl p-5 border border-brand/15 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(234,179,8,0.08),transparent_65%)] pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-3xl mb-1.5">🎴</div>
                    <div className="text-lg font-extrabold font-display text-white">Portal de Invocação Anime</div>
                    <div className="text-[11px] text-slate-400 mt-1">{totalChars} personagens lendários disponíveis</div>
                  </div>
                </div>

                <div className="bg-[#080a12] rounded-xl p-3 border border-[#1a1c2a]">
                  <div className="text-[9px] text-slate-400 uppercase font-bold mb-2">Probabilidades & Valores</div>
                  <div className="grid grid-cols-5 gap-1">
                    {RARITY.map((_, i) => (
                      <div key={i} className="text-center bg-[#06070d] rounded-lg p-1.5 border border-[#1a1c2a]">
                        <div className={`text-[8px] font-bold ${RARITY_COLORS[i]}`}>{'⭐'.repeat(i + 1)}</div>
                        <div className="text-[10px] font-mono font-bold text-white mt-0.5">{(RARITY_WEIGHTS[i] * 100).toFixed(1)}%</div>
                        <div className="text-[8px] font-mono text-brand mt-0.5">R$ {getCardValue(i).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#080a12] rounded-xl p-3 border border-[#1a1c2a] flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Pacotes disponíveis: <span className={`font-bold font-mono ${packsRemaining > 0 ? 'text-brand' : 'text-rose-400'}`}>{packsRemaining}/{MAX_PACKS_PER_HOUR}</span>
                    <span className="text-slate-600 ml-1">por hora</span>
                  </span>
                  {nextReset && packsUsed >= MAX_PACKS_PER_HOUR && (
                    <span className="text-[9px] font-mono text-yellow-400">
                      ⏳ Reset em {Math.ceil((nextReset - Date.now()) / 60000)}min
                    </span>
                  )}
                </div>

                <motion.button onClick={handleOpenPack}
                  disabled={balance < PACK_PRICE || chars.length === 0 || packsUsed >= MAX_PACKS_PER_HOUR}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.25)]">
                  <Package className="w-4 h-4" />
                  {packsUsed >= MAX_PACKS_PER_HOUR ? 'Limite horário atingido' : `Invocar Personagem (R$ ${PACK_PRICE.toFixed(2)})`}
                </motion.button>
              </>
            )}

            {/* Pack Opening Overlay */}
            <AnimatePresence>
              {opening && packResult.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 z-50 bg-black/94 backdrop-blur-md flex items-center justify-center p-4"
                  onClick={() => canClose && closePack()}
                >
                  <div className="text-center max-w-sm w-full relative">
                    <motion.h3
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-yellow-400/80 font-bold font-display text-xs mb-5 uppercase tracking-widest"
                    >
                      🎴 Invocação Anime
                    </motion.h3>

                    {!cardRevealed ? (
                      /* Summoning Portal / Omnitrix Core Charging */
                      <div className="py-12 flex flex-col items-center justify-center">
                        {(() => {
                          const r = packResult[0]?.rarity ?? 0;
                          const chargeColor =
                            r === 4
                              ? 'rgba(239,68,68,0.65)'
                              : r === 3
                              ? 'rgba(251,146,60,0.6)'
                              : r === 2
                              ? 'rgba(168,85,247,0.55)'
                              : r === 1
                              ? 'rgba(59,130,246,0.5)'
                              : 'rgba(148,163,184,0.35)';
                          const ringBorder =
                            r === 4
                              ? 'border-red-400'
                              : r === 3
                              ? 'border-orange-400'
                              : r === 2
                              ? 'border-purple-400'
                              : r === 1
                              ? 'border-blue-400'
                              : 'border-slate-400';
                          return (
                            <div
                              className={`w-36 h-36 rounded-full border-4 ${ringBorder} bg-[#080a12] flex items-center justify-center gacha-pack-charge relative`}
                              style={{ '--charge-color': chargeColor } as React.CSSProperties}
                            >
                              <div className={`w-24 h-24 rounded-full border-2 border-dashed ${ringBorder} opacity-60 animate-omnitrix-spin flex items-center justify-center`}>
                                <span className="text-4xl">⚡</span>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="text-xs font-mono text-slate-300 mt-5 animate-pulse">
                          Canalizando energia de invocação...
                        </p>
                      </div>
                    ) : (
                      packResult.map((char, idx) => {
                        const isRare = isSpecial(char.rarity);
                        const isNew = !collection.some(c => c.id === char.id);
                        const glowColor = getRarityGlowColor(char.rarity);
                        return (
                          <div key={idx} className="relative flex justify-center">
                            {char.rarity >= 2 && (
                              <div
                                className="gacha-light-beam"
                                style={{
                                  '--beam-color':
                                    char.rarity === 4
                                      ? 'rgba(239,68,68,0.28)'
                                      : char.rarity === 3
                                      ? 'rgba(251,146,60,0.25)'
                                      : 'rgba(168,85,247,0.22)',
                                } as React.CSSProperties}
                              />
                            )}
                            <motion.div
                              initial={{ rotateY: 90, opacity: 0, scale: 0.7 }}
                              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 130, damping: 15 }}
                              className={`relative z-10 w-56 sm:w-64 bg-gradient-to-b ${RARITY_BG[char.rarity]} border-[3px] ${getRarityBorder(char.rarity)} rounded-2xl overflow-hidden holo-foil ${isRare ? 'card-glow-pulse gacha-float' : ''}`}
                              style={{ '--glow-color': glowColor } as React.CSSProperties}
                            >
                              {isNew && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', delay: 0.2 }}
                                  className="absolute top-2 left-2 z-20 bg-brand text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg"
                                >
                                  NEW
                                </motion.div>
                              )}

                              <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                                {char.image ? (
                                  <img src={char.image} alt={char.name}
                                    className={`w-full h-full object-cover relative z-10 ${isRare ? 'brightness-110 saturate-110' : ''}`}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : null}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-4xl font-black text-white/20">{initials(char.name)}</span>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent z-10" />
                              </div>

                              <div className="p-3 text-center relative z-10 bg-[#080a12]">
                                <p className="text-sm font-extrabold text-white truncate">{char.name}</p>
                                <p className="text-[10px] text-slate-300 truncate mt-0.5 font-medium">{char.series}</p>
                                {char.role && (
                                  <p className="text-[8px] text-slate-500 mt-0.5">{ROLE_LABELS[char.role] || char.role}</p>
                                )}
                                <div className={`text-xs font-bold mt-1.5 ${RARITY_COLORS[char.rarity]}`}>
                                  {'⭐'.repeat(char.rarity + 1)} <span className="text-[9px] ml-1">{RARITY[char.rarity]}</span>
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })
                    )}

                    <AnimatePresence>
                      {canClose && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="mt-7 relative z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-2.5">
                            {packsRemaining > 0 && balance >= PACK_PRICE && (
                              <button
                                onClick={() => handleOpenPack()}
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-slate-950 font-black px-5 py-3 rounded-xl text-xs transition-all cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                              >
                                🔄 Invocar Novamente (R$ {PACK_PRICE.toFixed(2)})
                              </button>
                            )}
                            <button
                              onClick={() => closePack()}
                              className="bg-[#161927] hover:bg-[#1f2438] text-slate-100 border border-[#2b3148] font-bold px-6 py-3 rounded-xl text-xs transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Fechar
                            </button>
                          </div>
                          <p className="text-slate-500 text-[9px] mt-3">Toque fora para fechar</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {collection.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-bold">Nenhum personagem ainda</p>
                <p className="text-slate-500 text-[10px] mt-1">Abra pacotes para começar sua coleção!</p>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 flex-wrap">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar personagem/série..."
                    className="flex-1 min-w-0 bg-[#070910] border border-[#1a1c2a] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-yellow-500/50" />
                  {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-white cursor-pointer p-1"><X className="w-4 h-4" /></button>}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => { setRarityFilter(null); setSeriesFilter(null); }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border cursor-pointer transition-colors ${rarityFilter === null && !seriesFilter ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400'}`}>
                    Todos
                  </button>
                  {RARITY.map((_, i) => (
                    <button key={i} onClick={() => setRarityFilter(rarityFilter === i ? null : i)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer transition-colors ${rarityFilter === i ? RARITY_FILTER_ACTIVE[i] : 'bg-[#080a12] border-[#1a1c2a] text-slate-400'}`}>
                      {'⭐'.repeat(i + 1)}
                    </button>
                  ))}
                  {seriesFilter && (
                    <button onClick={() => setSeriesFilter(null)}
                      className="px-2 py-1 rounded-lg text-[9px] font-bold border border-red-500/30 text-red-400 bg-red-500/10 cursor-pointer">
                      <X className="w-2.5 h-2.5 inline mr-0.5" /> {seriesFilter}
                    </button>
                  )}
                </div>

                {hasDuplicates && (
                  <button onClick={handleSellDuplicates}
                    className="w-full py-2 bg-brand/10 border border-brand/30 text-brand rounded-xl text-[10px] font-bold cursor-pointer hover:bg-brand hover:text-slate-950 transition-colors">
                    Vender Repetidas
                  </button>
                )}

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button onClick={() => setSeriesFilter(null)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-[9px] font-bold border cursor-pointer transition-all ${
                      !seriesFilter ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:text-white'
                    }`}>
                    Todos
                  </button>
                  {seriesList.map(series => {
                    const count = uniqueCollection.filter(c => c.setSeries === series).length;
                    if (count === 0) return null;
                    return (
                      <button key={series} onClick={() => setSeriesFilter(seriesFilter === series ? null : series)}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-[9px] font-bold border cursor-pointer transition-all whitespace-nowrap ${
                          seriesFilter === series ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:text-white'
                        }`}>
                        {series} <span className="text-[8px] opacity-60 ml-1">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {uniqueCollection.map(char => {
                    const rarityIdx = RARITY.indexOf(char.rarity);
                    const rIdx = rarityIdx >= 0 ? rarityIdx : 0;
                    const qty = char.quantity || 1;
                    return (
                      <div key={char.id}
                        className={`bg-gradient-to-b ${RARITY_BG[rIdx]} border ${getRarityBorder(rIdx)} rounded-xl overflow-hidden relative group holo-foil`}>
                        <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                          {char.imageUrl ? (
                            <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover relative z-10"
                              loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : null}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-black text-white/30">{initials(char.name)}</span>
                          </div>
                        </div>
                        <div className="p-1.5 text-center bg-[#070910]">
                          <p className="text-[8px] font-bold text-slate-200 truncate leading-tight">{char.name}</p>
                          <div className={`text-[7px] ${RARITY_COLORS[rIdx]}`}>{'⭐'.repeat(rIdx + 1)}</div>
                          {!seriesFilter && <p className="text-[6px] text-slate-500 truncate mt-0.5">{char.setSeries}</p>}
                          {qty > 1 && <span className="text-[7px] font-mono text-brand">×{qty}</span>}
                        </div>
                        {qty > 1 && (
                          <button onClick={() => handleSellCard(char.id)}
                            className="absolute top-1 right-1 bg-brand hover:bg-[#00e074] text-slate-950 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-20">
                            R$ {getCardValue(rIdx).toFixed(2)}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
