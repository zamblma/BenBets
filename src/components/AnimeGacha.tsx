import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, Search, X, Sparkles } from 'lucide-react';
import { PlacedBet, PokemonCard } from '../types';
import { getAnimeGachaPackData, recordAnimeGachaPack, addAnimeCards, removeAnimeCard, setAnimeCollection } from '../firebase/db';

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
const RARITY_BORDERS = ['border-slate-500/30', 'border-blue-500/30', 'border-purple-500/30', 'border-orange-500/30', 'border-red-500/30'];
const RARITY_BG = ['from-slate-900/60', 'from-blue-900/60', 'from-purple-900/60', 'from-orange-900/60', 'from-red-900/60'];
const RARITY_GLOW: Record<number, string> = {
  0: 'rgba(148,163,184,0.1)',
  1: 'rgba(59,130,246,0.15)',
  2: 'rgba(168,85,247,0.2)',
  3: 'rgba(251,146,60,0.25)',
  4: 'rgba(239,68,68,0.3)',
};
const RARITY_WEIGHTS = [0.60, 0.275, 0.10, 0.02, 0.005];
const RARITY_PRICES = [0.50, 1.50, 5.00, 25.00, 100.00];
const PACK_PRICE = 24.99;
const PACK_SIZE = 1;
const MAX_PACKS_PER_HOUR = 5;
const HOUR_MS = 3600000;

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

export default function AnimeGacha({ balance, onUpdateBalance, onAddBetHistory, userId, collection, onCollectionUpdate, onSellCard, onSellAllDuplicates }: AnimeGachaProps) {
  const [tab, setTab] = useState<'gacha' | 'collection'>('gacha');
  const [chars, setChars] = useState<AnimeChar[]>([]);
  const [packResult, setPackResult] = useState<AnimeChar[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null);
  const [packData, setPackData] = useState({ count: 0, firstPackTime: 0 });
  const skipRef = useRef(false);
  const [starBurst, setStarBurst] = useState<{ show: boolean; rarity: number }>({ show: false, rarity: 0 });
  const [rareFlash, setRareFlash] = useState<{ show: boolean; rarity: number; label: string }>({ show: false, rarity: 0, label: '' });
  const [cardRevealed, setCardRevealed] = useState(false);
  const [canClose, setCanClose] = useState(false);

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
    const cache = sessionStorage.getItem('animeGachaChars5');
    if (cache) { try { const p = JSON.parse(cache); if (p.length >= 200) { setChars(p); return; } } catch {} }
    let cancelled = false;
    const all: AnimeChar[] = [];
    const MAX_PAGES = 200;

    const load = async () => {
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (cancelled) return;
        if (page > 1) await new Promise(r => setTimeout(r, 450));
        try {
          const res = await fetch(`https://api.jikan.moe/v4/top/characters?page=${page}&limit=25`);
          if (res.status === 429) { await new Promise(r => setTimeout(r, 1000)); page--; continue; }
          const d = await res.json();
          if (!d?.data || d.data.length === 0) break;
          d.data.forEach((c: any) => {
            all.push({
              id: `anime_${c.mal_id}`,
              name: c.name,
              series: c.anime?.[0]?.name || c.manga?.[0]?.name || 'Desconhecido',
              image: c.images?.jpg?.image_url || '',
              rarity: 0,
              role: c.anime?.[0]?.role,
            });
          });
          if (all.length % 250 === 0) setChars([...all]);
        } catch {}
      }
      if (!cancelled) {
        setChars(all);
        sessionStorage.setItem('animeGachaChars5', JSON.stringify(all));
      }
    };
    load();
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

    onUpdateBalance(-PACK_PRICE);
    if (userId) await recordAnimeGachaPack(userId);
    if (userId) getAnimeGachaPackData(userId).then(setPackData);
    setOpening(true);
    setPackResult([]);
    setCardRevealed(false);
    setCanClose(false);
    skipRef.current = false;

    const result: AnimeChar[] = [];
    for (let i = 0; i < PACK_SIZE; i++) result.push(pick());
    setPackResult(result);

    const bestRarity = Math.max(...result.map(c => c.rarity));

    await new Promise(r => setTimeout(r, 600));
    setCardRevealed(true);

    if (bestRarity >= 3) {
      const labels = ['', '', '', '✨ Super Raro!', '⭐ Lendário!'];
      setRareFlash({ show: true, rarity: bestRarity, label: labels[bestRarity] });
      setStarBurst({ show: true, rarity: bestRarity });
      await new Promise(r => setTimeout(r, 2500));
      setStarBurst(prev => ({ ...prev, show: false }));
      await new Promise(r => setTimeout(r, 500));
      setRareFlash(prev => ({ ...prev, show: false }));
    } else {
      await new Promise(r => setTimeout(r, 800));
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
      if (!map.has(c.id)) map.set(c.id, { ...c });
    });
    let arr = Array.from(map.values());
    if (rarityFilter !== null) arr = arr.filter(c => {
      const idx = RARITY.indexOf(c.rarity);
      return idx === rarityFilter;
    });
    if (search) arr = arr.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.setSeries.toLowerCase().includes(search.toLowerCase()));
    if (seriesFilter) arr = arr.filter(c => c.setSeries === seriesFilter);
    return arr;
  }, [collection, rarityFilter, search, seriesFilter]);

  const seriesList = useMemo(() => {
    const s = new Set<string>();
    collection.forEach(c => s.add(c.setSeries));
    return Array.from(s).sort();
  }, [collection]);

  const totalChars = chars.length;
  const uniqueCount = new Set(collection.map(c => c.id)).size;

  const hasDuplicates = useMemo(() => {
    return collection.some(c => c.quantity > 1);
  }, [collection]);

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const isSpecial = (r: number) => r >= 3;

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      <div className="bg-gradient-to-r from-[#0d0e16] to-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" /> Anime Gacha
          </span>
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className="text-yellow-400 font-bold">{uniqueCount}/{totalChars}</span>
          </span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {[
          { id: 'gacha' as const, label: 'Gacha', icon: '🎴' },
          { id: 'collection' as const, label: 'Coleção', icon: '📚' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
              tab === t.id ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Star burst overlay for high rarity pulls */}
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
            {/* Background radial gradient */}
            <div className={`absolute inset-0 ${starBurst.rarity === 4 ? 'bg-red-900/40' : 'bg-orange-900/40'}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,200,0,0.15),transparent_70%)]" />

            {/* Expanding rings */}
            {[0, 0.3, 0.6].map((delay, i) => (
              <div key={i} className={`absolute w-40 h-40 rounded-full border-2 ${starBurst.rarity === 4 ? 'border-red-400/40' : 'border-orange-400/40'} pulse-ring`} style={{ animationDelay: `${delay}s` }} />
            ))}

            {/* Floating star particles */}
            <div className="absolute">
              {['⭐', '✨', '💫', '🌟', '⭐'].map((emoji, i) => (
                <span key={i} className={`absolute text-2xl float-p${i + 1}`}
                  style={{ left: `${(i - 2) * 30}px`, top: '20px' }}>
                  {emoji}
                </span>
              ))}
            </div>

            {/* Central star */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: [0, 1.8, 1], rotate: [-180, 0, 360] }}
              transition={{ duration: 1.2, times: [0, 0.6, 1], ease: 'easeOut' }}
              className="relative z-10"
            >
              <span className="text-8xl sm:text-9xl block"
                style={{ filter: 'drop-shadow(0 0 60px rgba(255,200,0,0.9)) drop-shadow(0 0 120px rgba(255,200,0,0.4))' }}>
                {starBurst.rarity === 4 ? '👑' : '⭐'}
              </span>
            </motion.div>

            {/* Text label */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 1, 0], y: [60, 0, 0, 0, -20], scale: [0.5, 1.1, 1, 1, 0.9] }}
              transition={{ duration: 2.2, times: [0, 0.15, 0.3, 0.8, 1] }}
              className="absolute bottom-[25%] text-center z-20"
            >
              <span className={`text-4xl sm:text-6xl font-black block ${starBurst.rarity === 4 ? 'text-red-400' : 'text-orange-400'}`}
                style={{ textShadow: `0 0 40px ${starBurst.rarity === 4 ? 'rgba(239,68,68,0.8)' : 'rgba(251,146,60,0.8)'}, 0 0 80px ${starBurst.rarity === 4 ? 'rgba(239,68,68,0.4)' : 'rgba(251,146,60,0.4)'}` }}>
                {starBurst.rarity === 4 ? '⭐ LENDÁRIO!' : '✨ SUPER RARO!'}
              </span>
              <span className="text-sm text-white/60 mt-2 block font-bold">Personagem de altíssima raridade!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rare flash for individual card reveals */}
      <AnimatePresence>
        {rareFlash.show && (
          <motion.div
            key="rareflash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] pointer-events-none screen-shake"
          >
            {/* Color flash */}
            <motion.div
              animate={{ opacity: [0, 0.5, 0.3, 0] }}
              transition={{ duration: 1.5, times: [0, 0.08, 0.3, 1] }}
              className={`absolute inset-0 ${rareFlash.rarity === 4 ? 'bg-gradient-radial from-red-500/60' : 'bg-gradient-radial from-orange-500/60'}`}
              style={{ background: `radial-gradient(circle at center, ${rareFlash.rarity === 4 ? 'rgba(239,68,68,0.5)' : 'rgba(251,146,60,0.5)'}, transparent 70%)` }}
            />

            {/* Expanding ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-32 h-32 rounded-full border-2 ${rareFlash.rarity === 4 ? 'border-red-400' : 'border-orange-400'} pulse-ring`} />
              <div className={`absolute w-32 h-32 rounded-full border ${rareFlash.rarity === 4 ? 'border-red-400/50' : 'border-orange-400/50'} pulse-ring`} style={{ animationDelay: '0.2s' }} />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                initial={{ opacity: 0, y: 40, scale: 0.3 }}
                animate={{ opacity: [0, 1, 1, 0], y: [40, 0, 0, -15], scale: [0.3, 1.2, 1, 0.95] }}
                transition={{ duration: 1.5, times: [0, 0.12, 0.6, 1] }}
                className="text-center relative z-10"
              >
                <span className="text-6xl sm:text-7xl block mb-3"
                  style={{ filter: `drop-shadow(0 0 30px ${rareFlash.rarity === 4 ? 'rgba(239,68,68,0.8)' : 'rgba(251,146,60,0.8)'})` }}>
                  {rareFlash.rarity === 4 ? '👑' : '✨'}
                </span>
                <span className={`text-3xl sm:text-5xl font-black block ${rareFlash.rarity === 4 ? 'text-red-400' : 'text-orange-400'}`}
                  style={{ textShadow: `0 0 30px ${rareFlash.rarity === 4 ? 'rgba(239,68,68,0.8)' : 'rgba(251,146,60,0.8)'}` }}>
                  {rareFlash.label}
                </span>
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {tab === 'gacha' ? (
          <motion.div key="gacha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {chars.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 animate-pulse">🎴</div>
                <p className="text-slate-400 text-xs">Carregando personagens da Jikan API...</p>
              </div>
            ) : (
              <>
                <div className="bg-[#0d0e16]/60 rounded-xl p-4 border border-[#1a1c2a] text-center">
                  <div className="text-2xl mb-1">🎴</div>
                  <div className="text-lg font-bold text-white">Pacote de Personagens</div>
                  <div className="text-[10px] text-slate-400 mt-1">{totalChars} personagens disponíveis</div>
                </div>

                  <div className="bg-[#0d0e16]/60 rounded-xl p-3 border border-[#1a1c2a]">
                    <div className="text-[9px] text-slate-400 uppercase font-bold mb-2">Probabilidades & Valores</div>
                    <div className="grid grid-cols-5 gap-1">
                      {RARITY.map((label, i) => (
                        <div key={i} className="text-center">
                          <div className={`text-[8px] font-bold ${RARITY_COLORS[i]}`}>{'⭐'.repeat(i + 1)}</div>
                          <div className="text-[9px] font-mono text-white">{(RARITY_WEIGHTS[i] * 100).toFixed(0)}%</div>
                          <div className="text-[8px] font-mono text-brand mt-0.5">R$ {getCardValue(i).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                <div className="bg-[#0d0e16]/60 rounded-xl p-3 border border-[#1a1c2a] flex items-center justify-between">
                  <span className="text-[9px] text-slate-400">
                    Pacotes disponíveis: <span className={`font-bold ${packsRemaining > 0 ? 'text-green-400' : 'text-red-400'}`}>{packsRemaining}/{MAX_PACKS_PER_HOUR}</span>
                    <span className="text-slate-600 ml-1">por hora</span>
                  </span>
                  {nextReset && packsUsed >= MAX_PACKS_PER_HOUR && (
                    <span className="text-[8px] text-yellow-400">
                      ⏳ Reset em {Math.ceil((nextReset - Date.now()) / 60000)}min
                    </span>
                  )}
                </div>

                <motion.button onClick={handleOpenPack}
                  disabled={balance < PACK_PRICE || chars.length === 0 || packsUsed >= MAX_PACKS_PER_HOUR}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                  <Package className="w-4 h-4" />
                  {chars.length === 0 ? 'Carregando...' : packsUsed >= MAX_PACKS_PER_HOUR ? 'Limite atingido' : `Abrir Pacote (R$ ${PACK_PRICE.toFixed(2)})`}
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
                  className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                  onClick={() => canClose && closePack()}
                >
                  <div className="text-center max-w-sm w-full">
                    <motion.h3
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-yellow-400/70 font-bold text-xs mb-6 uppercase tracking-widest"
                    >
                      🎴 Pacote de Personagens
                    </motion.h3>

                    {/* Single centered card */}
                    {packResult.map((char, idx) => {
                      const isRare = isSpecial(char.rarity);
                      const isNew = !collection.some(c => c.id === char.id);
                      const glowColor = getRarityGlowColor(char.rarity);
                      return (
                        <motion.div
                          key={idx}
                          initial={{ rotateY: 180, opacity: 0, scale: 0.6 }}
                          animate={cardRevealed ? { rotateY: 0, opacity: 1, scale: 1 } : {}}
                          transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0 }}
                          className={`relative mx-auto w-56 sm:w-64 bg-gradient-to-b ${RARITY_BG[char.rarity]} border-[3px] ${getRarityBorder(char.rarity)} rounded-2xl overflow-hidden ${isRare ? 'card-glow-pulse' : ''}`}
                          style={{ '--glow-color': glowColor } as React.CSSProperties}
                        >
                          {/* Shimmer overlay for rare */}
                          {isRare && cardRevealed && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 0.4, 0.2, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className={`absolute inset-0 z-10 pointer-events-none ${char.rarity === 4 ? 'bg-gradient-to-t from-red-500/20 via-transparent to-red-500/10' : 'bg-gradient-to-t from-yellow-400/20 via-transparent to-yellow-400/10'}`}
                            />
                          )}

                          {/* NEW badge */}
                          {isNew && cardRevealed && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', delay: 0.3 }}
                              className="absolute top-2 left-2 z-20 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg"
                            >
                              NEW
                            </motion.div>
                          )}

                          {/* Character image */}
                          <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                            {char.image ? (
                              <img src={char.image} alt={char.name}
                                className={`w-full h-full object-cover relative z-0 ${isRare ? 'brightness-110 saturate-110' : ''}`}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-4xl font-black text-white/20">{initials(char.name)}</span>
                            </div>
                            {/* Gradient overlay at bottom of image */}
                            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                          </div>

                          {/* Card info */}
                          <div className="p-3 text-center relative z-10 bg-gradient-to-t from-[#0a0b12] to-transparent">
                            <p className="text-sm font-bold text-white truncate">{char.name}</p>
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">{char.series}</p>
                            {char.role && (
                              <p className="text-[8px] text-slate-500 mt-0.5">{ROLE_LABELS[char.role] || char.role}</p>
                            )}
                            <div className={`text-xs font-bold mt-1.5 ${RARITY_COLORS[char.rarity]}`}>
                              {'⭐'.repeat(char.rarity + 1)} <span className="text-[9px] ml-1">{RARITY[char.rarity]}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Close instruction */}
                    <AnimatePresence>
                      {canClose && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-8"
                        >
                          {packResult.some(c => isSpecial(c.rarity)) && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: [0, 1.15, 1] }}
                              transition={{ type: 'spring', stiffness: 200 }}
                              className="text-yellow-400 font-extrabold text-sm mb-4 flex items-center justify-center gap-2"
                            >
                              <Star className="w-4 h-4 fill-yellow-400" />
                              Personagem Especial Encontrado!
                              <Star className="w-4 h-4 fill-yellow-400" />
                            </motion.div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); closePack(); }}
                            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black px-8 py-3 rounded-xl text-sm transition-all cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)]"
                          >
                            <Sparkles className="w-4 h-4 inline mr-1.5" /> Fechar
                          </button>
                          <p className="text-slate-500 text-[9px] mt-3 animate-pulse">Toque em qualquer lugar para fechar</p>
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
                    className="flex-1 min-w-0 bg-[#0d0e16] border border-[#1a1c2a] rounded-lg px-2.5 py-1.5 text-[10px] text-white placeholder-slate-500 outline-none focus:border-yellow-500/50" />
                  {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-white cursor-pointer p-1"><X className="w-3 h-3" /></button>}
                </div>

                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => { setRarityFilter(null); setSeriesFilter(null); }}
                    className={`px-2 py-1 rounded-lg text-[8px] font-bold border cursor-pointer transition-colors ${!rarityFilter && !seriesFilter ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400'}`}>
                    Todos
                  </button>
                  {RARITY.map((_, i) => (
                    <button key={i} onClick={() => setRarityFilter(rarityFilter === i ? null : i)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-bold border cursor-pointer transition-colors ${rarityFilter === i ? `${RARITY_COLORS[i]} bg-${RARITY_COLORS[i].split('-')[1]}-500/20 border-${RARITY_COLORS[i].split('-')[1]}-500/50` : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400'}`}>
                      {'⭐'.repeat(i + 1)}
                    </button>
                  ))}
                  {seriesFilter && (
                    <button onClick={() => setSeriesFilter(null)}
                      className="px-2 py-1 rounded-lg text-[8px] font-bold border border-red-500/30 text-red-400 bg-red-500/10 cursor-pointer">
                      <X className="w-2.5 h-2.5 inline mr-0.5" /> {seriesFilter}
                    </button>
                  )}
                </div>

                {hasDuplicates && (
                  <button onClick={handleSellDuplicates}
                    className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-emerald-500/20 transition-colors">
                    Vender Repetidas
                  </button>
                )}

                {seriesList.filter(s => !seriesFilter || s === seriesFilter).map(series => {
                  const charsInSeries = uniqueCollection.filter(c => c.setSeries === series);
                  if (charsInSeries.length === 0) return null;
                  return (
                    <div key={series} className="bg-[#0d0e16]/60 rounded-xl border border-[#1a1c2a] overflow-hidden">
                      <button onClick={() => setSeriesFilter(seriesFilter === series ? null : series)}
                        className="w-full px-3 py-2 bg-[#07080f] border-b border-[#1a1c2a] flex items-center justify-between cursor-pointer hover:bg-[#0a0b14] transition-colors">
                        <span className="text-[10px] font-bold text-slate-200 truncate">{series}</span>
                        <span className="text-[9px] text-slate-500">{charsInSeries.length}</span>
                      </button>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 p-2">
                        {charsInSeries.map(char => {
                          const rarityIdx = RARITY.indexOf(char.rarity);
                          const rIdx = rarityIdx >= 0 ? rarityIdx : 0;
                          const qty = char.quantity || 1;
                          return (
                          <div key={char.id}
                            className={`bg-gradient-to-b ${RARITY_BG[rIdx]} border ${getRarityBorder(rIdx)} rounded-lg overflow-hidden relative group`}>
                            <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                              {char.imageUrl ? (
                                <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : null}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-black text-white/30">{initials(char.name)}</span>
                              </div>
                            </div>
                            <div className="p-1 text-center">
                              <p className="text-[7px] font-bold text-slate-200 truncate">{char.name}</p>
                              <div className={`text-[7px] ${RARITY_COLORS[rIdx]}`}>{'⭐'.repeat(rIdx + 1)}</div>
                              {qty > 1 && <span className="text-[7px] text-slate-500">×{qty}</span>}
                            </div>
                            {qty > 1 && (
                              <button onClick={() => handleSellCard(char.id)}
                                className="absolute top-0.5 right-0.5 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[6px] font-bold px-1 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-10">
                                R$ {getCardValue(rIdx).toFixed(2)}
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
