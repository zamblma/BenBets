import { useState, useEffect, useRef, useMemo } from 'react';
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
}

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
const RARITY_FAV_THRESHOLDS = [
  { max: 49, rarity: 0 },
  { max: 299, rarity: 1 },
  { max: 999, rarity: 2 },
  { max: 4999, rarity: 3 },
  { max: Infinity, rarity: 4 },
];

const PACK_PRICE = 24.99;
const PACK_SIZE = 1;
const MAX_PACKS_PER_HOUR = 5;
const HOUR_MS = 3600000;

function getCardValue(rarity: number): number {
  return RARITY_PRICES[rarity] || 0;
}

function rarityFromFavorites(fav: number): number {
  for (const t of RARITY_FAV_THRESHOLDS) {
    if (fav <= t.max) return t.rarity;
  }
  return 0;
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

  const packsUsed = packData.count;
  const nextReset = packData.firstPackTime > 0 ? packData.firstPackTime + HOUR_MS : null;
  const packsRemaining = Math.max(0, MAX_PACKS_PER_HOUR - packsUsed);

  useEffect(() => {
    if (!userId) return;
    getAnimeGachaPackData(userId).then(setPackData);
  }, [userId]);

  useEffect(() => {
    const cache = sessionStorage.getItem('animeGachaChars4');
    if (cache) { try { const p = JSON.parse(cache); if (p.length >= 200) { setChars(p); return; } } catch {} }
    const ab = new AbortController();
    const all: AnimeChar[] = [];
    let done = 0;
    const totalPages = 20;
    for (let page = 1; page <= totalPages; page++) {
      const delay = page === 1 ? 0 : 350;
      setTimeout(() => {
        if (ab.signal.aborted) return;
        fetch(`https://api.jikan.moe/v4/top/characters?page=${page}&limit=25`, { signal: ab.signal })
          .then(r => r.json()).then(d => {
            if (d?.data) d.data.forEach((c: any) => {
              const fav = c.favorites ?? 0;
              all.push({
                id: `anime_${c.mal_id}`,
                name: c.name,
                series: c.anime?.[0]?.name || c.manga?.[0]?.name || 'Desconhecido',
                image: c.images?.jpg?.image_url || '',
                rarity: fav > 0 ? rarityFromFavorites(fav) : 0,
              });
            });
          }).catch(() => {}).finally(() => {
            done++;
            if (done >= totalPages) {
              setChars(all);
              sessionStorage.setItem('animeGachaChars4', JSON.stringify(all));
            }
          });
      }, delay);
    }
    return () => ab.abort();
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
    const pool = chars.filter(c => c.rarity === rar);
    if (pool.length === 0) return { ...chars[Math.floor(Math.random() * chars.length)] };
    return { ...pool[Math.floor(Math.random() * pool.length)] };
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE || chars.length === 0) return;
    if (packsUsed >= MAX_PACKS_PER_HOUR) return;

    onUpdateBalance(-PACK_PRICE);
    if (userId) await recordAnimeGachaPack(userId);
    if (userId) getAnimeGachaPackData(userId).then(setPackData);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;

    const result: AnimeChar[] = [];
    for (let i = 0; i < PACK_SIZE; i++) result.push(pick());
    setPackResult(result);

    const bestRarity = Math.max(...result.map(c => c.rarity));

    if (bestRarity >= 3) {
      setStarBurst({ show: true, rarity: bestRarity });
      await new Promise(r => setTimeout(r, 2000));
      setStarBurst(prev => ({ ...prev, show: false }));
    }

    const delay = 400;
    for (let i = 0; i < PACK_SIZE; i++) {
      await new Promise(r => setTimeout(r, delay));
      if (skipRef.current) break;
      setRevealingIndex(i);
    }

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

    setTimeout(() => { setOpening(false); setPackResult([]); }, 600);
  };

  useEffect(() => {
    if (revealingIndex < 0 || revealingIndex >= packResult.length) return;
    const card = packResult[revealingIndex];
    if (card.rarity >= 3) {
      const labels = ['', '', '', '✨ Super Raro!', '⭐ Lendário!'];
      setRareFlash({ show: true, rarity: card.rarity, label: labels[card.rarity] });
      const t = setTimeout(() => setRareFlash(prev => ({ ...prev, show: false })), 1200);
      return () => clearTimeout(t);
    }
  }, [revealingIndex, packResult]);

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
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none bg-black/60"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: [0, 1.5, 0.8, 1.2, 1],
                rotate: [-180, 0, 360, 720, 1080],
              }}
              transition={{ duration: 1.8, times: [0, 0.3, 0.5, 0.7, 1] }}
            >
              <motion.span
                animate={{
                  scale: [1, 1.4, 0.9, 1.3, 1],
                  opacity: [0, 1, 0.5, 1, 0],
                }}
                transition={{ duration: 1.8, times: [0, 0.1, 0.3, 0.5, 1] }}
                className="text-8xl sm:text-9xl block"
                style={{ filter: 'drop-shadow(0 0 80px rgba(255,200,0,0.8))' }}
              >
                ⭐
              </motion.span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: [0, 1, 1, 0], y: [50, 0, 0, -30] }}
              transition={{ duration: 1.8, times: [0, 0.15, 0.6, 1] }}
              className="absolute bottom-[30%] text-center"
            >
              <span className={`text-3xl sm:text-5xl font-black drop-shadow-[0_0_40px_rgba(255,255,255,0.6)] ${starBurst.rarity === 4 ? 'text-red-400' : 'text-orange-400'}`}>
                {starBurst.rarity === 4 ? '⭐ LENDÁRIO!' : '✨ SUPER RARO!'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rare flash for individual card reveals */}
      <AnimatePresence>
        {rareFlash.show && (
          <motion.div
            key="rareflash"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 1] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.2, times: [0, 0.1, 0.4, 1] }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ opacity: [0, 0.6, 0.4, 0] }}
              transition={{ duration: 1.2, times: [0, 0.1, 0.4, 1] }}
              className={`absolute inset-0 ${rareFlash.rarity === 4 ? 'bg-red-500' : 'bg-orange-500'}`}
            />
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -20] }}
              transition={{ duration: 1.2, times: [0, 0.15, 0.5, 1] }}
              className="relative z-10 text-center px-4"
            >
              <span className="text-5xl sm:text-7xl block mb-2">{rareFlash.rarity === 4 ? '⭐' : '✨'}</span>
              <span className="text-2xl sm:text-4xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{rareFlash.label}</span>
            </motion.span>
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
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto"
                >
                  <div className="text-center max-w-2xl w-full py-4">
                    <motion.h3
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-yellow-400 font-extrabold text-lg mb-2"
                    >
                      🎴 Pacote de Personagens
                    </motion.h3>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <p className="text-slate-500 text-xs">
                        {revealingIndex + 1} de {packResult.length} personagens revelados
                      </p>
                      <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); }}
                        className="text-xs sm:text-sm text-yellow-400/60 hover:text-yellow-400 font-bold uppercase tracking-wider transition-colors cursor-pointer px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-yellow-500/5 hover:bg-yellow-500/10 ml-auto">
                          Pular
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 justify-items-center max-h-[70vh] overflow-y-auto px-2">
                      {packResult.map((char, idx) => {
                        const isRare = isSpecial(char.rarity);
                        const isNew = !collection.some(c => c.id === char.id);
                        return (
                        <motion.div key={idx}
                          initial={{ rotateY: 180, opacity: 0, scale: 0.3, y: 40 }}
                          animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1, y: 0 } : {}}
                          transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0 }}
                          className={`bg-gradient-to-b ${RARITY_BG[char.rarity]} border-[2px] ${getRarityBorder(char.rarity)} rounded-xl overflow-hidden relative`}
                          style={{ boxShadow: `0 0 15px ${RARITY_GLOW[char.rarity]}` }}>
                          {isRare && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={idx <= revealingIndex ? { opacity: [0, 0.5, 0.3] } : {}}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute inset-0 bg-gradient-to-t from-yellow-400/20 via-transparent to-transparent pointer-events-none z-10"
                            />
                          )}
                          {isNew && revealingIndex >= idx && (
                            <div className="absolute top-1 left-1 z-20 bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-lg">NEW</div>
                          )}
                          <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                            {char.image ? (
                              <img src={char.image} alt={char.name}
                                className={`w-full h-full object-cover relative z-0 ${isRare ? 'opacity-90' : ''}`}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-3xl font-black text-white/30">{initials(char.name)}</span>
                            </div>
                          </div>
                          <div className="p-2 text-center relative z-10">
                            <p className="text-[9px] font-bold text-slate-200 truncate">{char.name}</p>
                            <p className="text-[7px] text-slate-400 truncate">{char.series}</p>
                            <div className={`text-[8px] font-bold mt-0.5 ${RARITY_COLORS[char.rarity]}`}>
                              {'⭐'.repeat(char.rarity + 1)}
                            </div>
                          </div>
                        </motion.div>
                      )})}
                    </div>
                    {revealingIndex >= packResult.length - 1 && (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        {packResult.some(c => isSpecial(c.rarity)) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.2, 1] }}
                            transition={{ type: 'spring', stiffness: 200 }}
                            className="text-yellow-400 font-extrabold text-sm mt-4 flex items-center justify-center gap-2"
                          >
                            <Star className="w-5 h-5 fill-yellow-400" /> Personagem&nbsp;
                            {packResult.filter(c => isSpecial(c.rarity)).length > 1 ? 'Especiais' : 'Especial'} Encontrado
                            {packResult.filter(c => isSpecial(c.rarity)).length > 1 ? 's' : ''}! <Star className="w-5 h-5 fill-yellow-400" />
                          </motion.div>
                        )}
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <button
                            onClick={() => {
                              setOpening(false);
                              setPackResult([]);
                            }}
                            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm transition-all cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4 inline mr-1.5" /> Fechar
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {revealingIndex < packResult.length - 1 && (
                      <p className="mt-4 text-yellow-400/60 text-xs animate-pulse">✨ Revelando personagens...</p>
                    )}
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
