import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Package, Search, Loader2, Sparkles, BookOpen, ArrowLeft, Star, TrendingUp, DollarSign, Trash2 } from 'lucide-react';
import type { PokemonCard } from '../types';

const API_BASE = 'https://api.pokemontcg.io/v2';
const PACK_BASE_PRICE = 14.90;
const PACK_OPTIONS = [
  { qty: 1, price: 14.90, label: '1 pacote' },
  { qty: 3, price: 39.90, label: '3 pacotes', badge: '−11%' },
  { qty: 5, price: 59.90, label: '5 pacotes', badge: '−20%' },
  { qty: 10, price: 99.90, label: '10 pacotes', badge: '−33%' },
];
interface PokemonTCGProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

interface TCGCard {
  id: string;
  name: string;
  images: { small: string; large: string };
  rarity?: string;
  set: { name: string; series: string };
}

interface TCGSets {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  total?: number;
  images: { logo: string; symbol: string };
}

function getCardRarityLevel(rarity: string): number {
  if (!rarity || rarity === 'Common') return 0;
  if (rarity === 'Uncommon') return 1;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Rare Holo' || rarity === 'Rare Holo V') return 3;
  if (rarity === 'Rare Ultra' || rarity === 'Rare Rainbow') return 4;
  if (rarity === 'Rare Secret') return 5;
  if (rarity.includes('Rare')) return 2;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getCardRarityLevel(rarity);
  if (lvl === 0) return 'border-slate-700';
  if (lvl === 1) return 'border-green-600 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
  if (lvl === 2) return 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
  if (lvl === 3) return 'border-yellow-400 shadow-[0_0_18px_rgba(234,179,8,0.6)] shimmer-gold';
  if (lvl === 4) return 'border-purple-400 shadow-[0_0_22px_rgba(168,85,247,0.7)] shimmer-rainbow';
  if (lvl === 5) return 'border-red-400 shadow-[0_0_28px_rgba(248,113,113,0.8)] shimmer-rainbow';
  return 'border-slate-700';
}

function getRarityLabel(rarity: string): string {
  const lvl = getCardRarityLevel(rarity);
  if (lvl <= 1) return 'Comum';
  if (lvl === 2) return 'Rara';
  if (lvl === 3) return 'Holográfica';
  if (lvl === 4) return 'Ultra Rara';
  if (lvl === 5) return 'Secret Rara';
  return rarity;
}

function getSetCapabilities(series: string): { tier: string; label: string; color: string; holo: boolean; ultra: boolean; secret: boolean } {
  if (series.includes('Scarlet & Violet')) return { tier: 'premium', label: '🔥 Premium', color: 'text-red-400 bg-red-500/10 border-red-500/20', holo: true, ultra: true, secret: true };
  if (series.includes('Sword & Shield')) return { tier: 'modern', label: '🔶 Moderno', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', holo: true, ultra: true, secret: true };
  if (series.includes('Sun & Moon')) return { tier: 'ultra', label: '🟣 Ultra', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', holo: true, ultra: true, secret: true };
  if (series.includes('XY')) return { tier: 'holo', label: '🟡 Holo', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', holo: true, ultra: true, secret: false };
  if (series.includes('Black & White')) return { tier: 'holo', label: '🟡 Holo', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', holo: true, ultra: false, secret: false };
  return { tier: 'classic', label: '🟦 Clássico', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', holo: false, ultra: false, secret: false };
}

function generatePack(cards: TCGCard[], setName: string, setSeries: string): PokemonCard[] {
  const common = cards.filter(c => !c.rarity || c.rarity === 'Common');
  const uncommon = cards.filter(c => c.rarity === 'Uncommon');
  const rarePool = cards.filter(c => c.rarity && !['Common', 'Uncommon'].includes(c.rarity));
  const pick = (pool: TCGCard[], exclude?: Set<string>) => {
    const available = exclude ? pool.filter(c => !exclude.has(c.id)) : pool;
    if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)];
    return available[Math.floor(Math.random() * available.length)];
  };

  const result: PokemonCard[] = [];
  const used = new Set<string>();

  for (let i = 0; i < 5; i++) {
    const c = pick(common, used);
    if (c) { used.add(c.id); }
    result.push({ ...c, quantity: 1, setName, setSeries, imageUrl: c?.images?.small || '' });
  }
  for (let i = 0; i < 3; i++) {
    const c = pick(uncommon, used);
    if (c) { used.add(c.id); }
    result.push({ ...c, quantity: 1, setName, setSeries, imageUrl: c?.images?.small || '' });
  }

  const roll = Math.random();
  let rareCard: TCGCard;
  if (roll < 0.80) {
    rareCard = pick(rarePool.filter(c => c.rarity === 'Rare')) || pick(rarePool);
  } else if (roll < 0.92) {
    rareCard = pick(rarePool.filter(c => c.rarity === 'Rare Holo' || c.rarity?.includes('Rare Holo'))) || pick(rarePool);
  } else if (roll < 0.97) {
    rareCard = pick(rarePool.filter(c => c.rarity === 'Rare Ultra' || c.rarity === 'Rare Rainbow')) || pick(rarePool);
  } else {
    rareCard = pick(rarePool) || pick(cards);
  }
  result.push({ ...rareCard, quantity: 1, setName, setSeries, imageUrl: rareCard.images?.small || '' });

  return result.map(c => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    rarity: c.rarity || 'Common',
    setName: c.setName as string,
    setSeries: c.setSeries as string,
    quantity: 1,
  }));
}

export default function PokemonTCG({ balance, onUpdateBalance, userId, collection, onCollectionUpdate, onSellCard, onSellAllDuplicates }: PokemonTCGProps) {
  const [view, setView] = useState<'sets' | 'collection' | 'market'>('sets');
  const [sets, setSets] = useState<TCGSets[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<TCGSets | null>(null);
  const [setCards, setSetCards] = useState<TCGCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [packQty, setPackQty] = useState(1);
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [opening, setOpening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState<string>('todas');
  const [filterRarity, setFilterRarity] = useState('todas');
  const [sortBy, setSortBy] = useState<string>('rarity');
  const [priceVersion, setPriceVersion] = useState(0);
  const [rareFlash, setRareFlash] = useState<{ show: boolean; rarity: string; label: string }>({ show: false, rarity: '', label: '' });
  const [sellTotal, setSellTotal] = useState(0);

  const pricesRef = useRef<Record<string, number>>({});
  const allCardIds = useRef<Set<string>>(new Set());
  const skipRef = useRef(false);
  const cardsSetIdRef = useRef<string>('');

  // Collect all unique card ids from collection
  useEffect(() => {
    collection.forEach(c => allCardIds.current.add(c.id));
  }, [collection]);

  // Generate base price from rarity
  const getBasePrice = useCallback((rarity: string): number => {
    const lvl = getCardRarityLevel(rarity);
    if (lvl === 0) return 0.02 * 1.05 + Math.random() * (0.08 * 1.05);
    if (lvl === 1) return 0.05 * 1.05 + Math.random() * (0.15 * 1.05);
    if (lvl === 2) return 0.10 * 1.05 + Math.random() * (0.40 * 1.05);
    if (lvl === 3) return 1.00 * 1.05 + Math.random() * (5.00 * 1.05);
    if (lvl === 4) return 10.00 * 1.05 + Math.random() * (50.00 * 1.05);
    if (lvl === 5) return 50.00 * 1.05 + Math.random() * (300.00 * 1.05);
    return 0.10;
  }, []);

  // Market price simulation: update prices every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      const prices = pricesRef.current;
      for (const id of allCardIds.current) {
        const card = collection.find(c => c.id === id);
        if (!card) continue;
        if (!prices[id]) prices[id] = getBasePrice(card.rarity);
        const change = (Math.random() - 0.48) * 0.25; // ±12.5% drift
        prices[id] = Math.max(0.10, prices[id] * (1 + change));
        prices[id] = parseFloat(prices[id].toFixed(2));
      }
      setPriceVersion(v => v + 1);
    }, 20000);
    return () => clearInterval(interval);
  }, [collection, getBasePrice]);

  // Initialize prices for any new cards
  useEffect(() => {
    const prices = pricesRef.current;
    for (const card of collection) {
      if (!prices[card.id]) {
        prices[card.id] = getBasePrice(card.rarity);
      }
    }
  }, [collection, getBasePrice]);

  const selectedOption = PACK_OPTIONS.find(o => o.qty === packQty) || PACK_OPTIONS[0];
  const canBuy = !opening && !cardsLoading && selectedSet && balance >= selectedOption.price && setCards.length > 0;

  const filteredCards = collection
    .filter(c => {
      if (filterRarity !== 'todas' && getCardRarityLevel(c.rarity).toString() !== filterRarity) return false;
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') {
        const pa = pricesRef.current[a.id] ?? getBasePrice(a.rarity);
        const pb = pricesRef.current[b.id] ?? getBasePrice(b.rarity);
        return pa - pb;
      }
      if (sortBy === 'price-desc') {
        const pa = pricesRef.current[a.id] ?? getBasePrice(a.rarity);
        const pb = pricesRef.current[b.id] ?? getBasePrice(b.rarity);
        return pb - pa;
      }
      if (sortBy === 'quantity') return (b.quantity || 1) - (a.quantity || 1);
      return getCardRarityLevel(b.rarity) - getCardRarityLevel(a.rarity);
    });

  useEffect(() => {
    const cached = sessionStorage.getItem('pokemonSets');
    if (cached) { const parsed = JSON.parse(cached); if (parsed.length >= 200) { setSets(parsed); setSetsLoading(false); return; } }
    sessionStorage.removeItem('pokemonSets');
    fetch(`${API_BASE}/sets?orderBy=-releaseDate&pageSize=250`)
      .then(r => r.json()).then(d => {
        const list: TCGSets[] = d.data || [];
        setSets(list);
        sessionStorage.setItem('pokemonSets', JSON.stringify(list));
      }).catch(() => {}).finally(() => setSetsLoading(false));
  }, []);

  const fetchSetCards = useCallback(async (setId: string): Promise<TCGCard[]> => {
    const cacheKey = `pokemonCards_${setId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as TCGCard[];
      if (parsed.length > 0) { setSetCards(parsed); cardsSetIdRef.current = setId; return parsed; }
    }
    setCardsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/cards?q=set.id:${setId}&pageSize=250`);
      const d = await r.json();
      const cards = d.data || [];
      setSetCards(cards);
      cardsSetIdRef.current = setId;
      sessionStorage.setItem(cacheKey, JSON.stringify(cards));
      return cards;
    } catch { return []; }
    finally { setCardsLoading(false); }
  }, []);

  const handleOpenPack = async () => {
    if (!selectedSet || !canBuy) return;

    onUpdateBalance(-selectedOption.price);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);

    let cards = setCards;
    if (cards.length === 0 || cardsSetIdRef.current !== selectedSet.id) {
      cards = await fetchSetCards(selectedSet.id);
    }
    if (cards.length === 0) { setOpening(false); return; }

    const allCards: PokemonCard[] = [];
    for (let i = 0; i < packQty; i++) {
      allCards.push(...generatePack(cards, selectedSet.name, selectedSet.series));
    }
    allCards.sort((a, b) => getCardRarityLevel(b.rarity) - getCardRarityLevel(a.rarity));
    setPackResult(allCards);

    skipRef.current = false;
    const delay = allCards.length <= 9 ? 350 : 200;
    for (let i = 0; i < allCards.length; i++) {
      await new Promise(r => setTimeout(r, delay));
      if (skipRef.current) break;
      setRevealingIndex(i);
    }
  };

  useEffect(() => {
    if (revealingIndex < 0 || revealingIndex >= packResult.length) return;
    const card = packResult[revealingIndex];
    const lvl = getCardRarityLevel(card.rarity);
    if (lvl >= 3) {
      const label = card.rarity === 'Rare Secret' ? '⭐ Secreta' : card.rarity === 'Rare Rainbow' ? '🌈 Arco-Íris' : card.rarity === 'Rare Ultra' ? '💎 Ultra' : '✨ Holo';
      setRareFlash({ show: true, rarity: card.rarity, label });
      const t = setTimeout(() => setRareFlash(prev => ({ ...prev, show: false })), 1200);
      return () => clearTimeout(t);
    }
  }, [revealingIndex, packResult]);

  useEffect(() => {
    if (packResult.length > 0 && revealingIndex >= packResult.length - 1) {
      const dupes = packResult.filter(c => collection.some(x => x.id === c.id));
      setSellTotal(dupes.reduce((s, c) => s + getBasePrice(c.rarity), 0));
    }
  }, [revealingIndex, packResult, getBasePrice, collection]);

  const isSpecial = (r: string) => getCardRarityLevel(r) >= 3;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-900/20 via-[#0e1017] to-amber-900/10 p-5 rounded-2xl border border-amber-950/40 flex items-center gap-4">
        <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
          <Gift className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-white text-base">Pokémon TCG — Pacotes & Coleção</h3>
          <p className="text-slate-400 text-xs">A partir de R$ 14,90 por pacote • Preços reais do mercado brasileiro</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1c2a] bg-[#0d0e16] rounded-xl p-1">
        <button onClick={() => { setView('sets'); setSelectedSet(null); setPackResult([]); }} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'sets' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <Package className="w-4 h-4" /> Coleções
        </button>
        <button onClick={() => { setView('market'); setSelectedSet(null); setPackResult([]); }} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'market' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <TrendingUp className="w-4 h-4" /> Mercado
        </button>
        <button onClick={() => { setView('collection'); setSelectedSet(null); setPackResult([]); }} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'collection' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <BookOpen className="w-4 h-4" /> Minha Coleção ({collection.length})
        </button>
      </div>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto"
          >
            {/* Rare flash overlay */}
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
                    className={`absolute inset-0 ${rareFlash.rarity === 'Rare Secret' ? 'bg-red-500' : rareFlash.rarity === 'Rare Rainbow' ? 'bg-purple-500' : rareFlash.rarity === 'Rare Ultra' ? 'bg-amber-500' : 'bg-yellow-500'}`}
                  />
                  <motion.span
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -20] }}
                    transition={{ duration: 1.2, times: [0, 0.15, 0.5, 1] }}
                    className="relative z-10 text-center px-4"
                  >
                    <span className="text-5xl sm:text-7xl block mb-2">{rareFlash.label.split(' ')[0]}</span>
                    <span className="text-2xl sm:text-4xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{rareFlash.label.slice(rareFlash.label.indexOf(' ') + 1)}</span>
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="text-center max-w-2xl w-full py-4">
              <motion.h3
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-amber-400 font-extrabold text-lg mb-2"
              >
                🎴 {packQty > 1 ? `${packQty} Pacotes` : 'Pacote'} — {selectedSet?.name}
              </motion.h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-slate-500 text-xs">
                  {revealingIndex + 1} de {packResult.length} cartas reveladas
                </p>
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); }} className="text-xs sm:text-sm text-amber-400/60 hover:text-amber-400 font-bold uppercase tracking-wider transition-colors cursor-pointer px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 ml-auto">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 justify-items-center max-h-[70vh] overflow-y-auto px-2">
                {packResult.map((card, idx) => {
                  const lvl = getCardRarityLevel(card.rarity);
                  const border = getRarityBorder(card.rarity);
                  const isRare = lvl >= 3;
                  const isNew = !collection.some(c => c.id === card.id);
                  return (
                    <motion.div
                      key={`${card.id}-${idx}`}
                      initial={{ rotateY: 180, opacity: 0, scale: 0.3, y: 40 }}
                      animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1, y: 0 } : {}}
                      transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0 }}
                      className={`bg-[#1a1c2a] rounded-xl overflow-hidden border-2 ${border} shadow-lg ${isRare ? 'relative' : ''}`}
                    >
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
                      <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover relative z-0" loading="lazy" />
                      <div className="p-1.5 text-center relative z-10">
                        <p className="text-[8px] font-bold text-slate-200 truncate">{card.name}</p>
                        <span className={`text-[7px] font-bold ${getCardRarityLevel(card.rarity) >= 3 ? 'text-yellow-300' : getCardRarityLevel(card.rarity) === 1 ? 'text-green-400' : 'text-slate-400'}`}>
                          {card.rarity === 'Rare Secret' ? '⭐' : card.rarity === 'Rare Rainbow' ? '🌈' : card.rarity === 'Rare Ultra' ? '💎' : ''}
                          {getRarityLabel(card.rarity)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
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
                      <Star className="w-5 h-5 fill-yellow-400" /> Carta&nbsp;
                      {packResult.filter(c => isSpecial(c.rarity)).length > 1 ? 'Especiais' : 'Especial'} Encontrada
                      {packResult.filter(c => isSpecial(c.rarity)).length > 1 ? 's' : ''}! <Star className="w-5 h-5 fill-yellow-400" />
                    </motion.div>
                  )}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        const newCards = packResult.filter(c => !collection.some(x => x.id === c.id));
                        if (newCards.length > 0) onCollectionUpdate(newCards);
                        if (sellTotal > 0) onUpdateBalance(sellTotal);
                        setOpening(false);
                        setPackResult([]);
                      }}
                      className="bg-green-500 hover:bg-green-400 text-slate-950 font-black px-5 py-3 rounded-xl text-sm transition-all cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4 inline mr-1.5" /> Vender Repetidas — R$ {sellTotal.toFixed(2)}
                    </button>
                    <button
                      onClick={() => { onCollectionUpdate(packResult); setOpening(false); setPackResult([]); }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 inline mr-1.5" /> Guardar na Coleção
                    </button>
                  </div>
                </motion.div>
              )}
              {revealingIndex < packResult.length - 1 && (
                <p className="mt-4 text-amber-400/60 text-xs animate-pulse">✨ Revelando cartas...</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETS GRID */}
      {view === 'sets' && !selectedSet && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar coleção..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
            </div>
            <div className="flex gap-1 text-[10px] font-bold flex-wrap">
              <button onClick={() => setSeriesFilter('todas')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'todas' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>Todas</button>
              <button onClick={() => setSeriesFilter('classic')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'classic' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>🟦 Clássico</button>
              <button onClick={() => setSeriesFilter('holo')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'holo' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>🟡 Holo</button>
              <button onClick={() => setSeriesFilter('ultra')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'ultra' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>🟣 Ultra</button>
              <button onClick={() => setSeriesFilter('modern')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'modern' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>🔶 SWSH</button>
              <button onClick={() => setSeriesFilter('premium')} className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${seriesFilter === 'premium' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>🔴 SV</button>
            </div>
          </div>
          {setsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sets.filter(s => {
                const cap = getSetCapabilities(s.series);
                if (seriesFilter !== 'todas' && cap.tier !== seriesFilter) return false;
                if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.series.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                return true;
              }).map(set => {
                const cap = getSetCapabilities(set.series);
                const rarities: { key: string; has: boolean; icon: string; color: string }[] = [
                  { key: 'holo', has: cap.holo, icon: '✨', color: 'text-yellow-300' },
                  { key: 'ultra', has: cap.ultra, icon: '💎', color: 'text-purple-400' },
                  { key: 'secret', has: cap.secret, icon: '⭐', color: 'text-red-400' },
                ];
                return (
                <button key={set.id} onClick={() => { setSelectedSet(set); setPackResult([]); setRevealingIndex(-1); if (selectedSet?.id !== set.id || setCards.length === 0) { setSetCards([]); fetchSetCards(set.id); } setPackQty(1); }} className="bg-[#0d0e16] border border-[#1a1c2a] hover:border-amber-500/30 rounded-xl p-3 text-left transition-all cursor-pointer group relative overflow-hidden">
                  {cap.tier === 'premium' && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/5 to-transparent rounded-bl-full" />}
                  {cap.tier === 'modern' && <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-bl-full" />}
                  {cap.tier === 'ultra' && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full" />}
                  <div className="bg-[#07080f] rounded-lg p-3 flex items-center justify-center aspect-[2/1] mb-2 border border-[#1a1c2a]">
                    {set.images?.logo ? <img src={set.images.logo} alt={set.name} className="h-10 object-contain" loading="lazy" /> : <Package className="w-8 h-8 text-slate-500" />}
                  </div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cap.color}`}>{cap.label}</span>
                    {rarities.filter(r => r.has).map(r => (
                      <span key={r.key} className={`text-[9px] ${r.color}`} title={r.key === 'holo' ? 'Tem Holo' : r.key === 'ultra' ? 'Tem Ultra' : 'Tem Secret'}>{r.icon}</span>
                    ))}
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">{set.name}</p>
                  <p className="text-[9px] text-slate-500">{set.series} • {set.printedTotal} cartas</p>
                  {(() => {
                    const totalCards = set.total || set.printedTotal;
                    const owned = collection.filter(c => c.setName === set.name).length;
                    const pct = Math.min(Math.round((owned / totalCards) * 100), 100);
                    return (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                          <span>{owned}/{totalCards}</span>
                          <span className={pct >= 100 ? 'text-green-400 font-bold' : ''}>{pct < 100 ? pct + '%' : '100%'}</span>
                        </div>
                        <div className="h-1 bg-[#07080f] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-2 bg-amber-500/10 text-amber-400 text-[9px] font-bold py-1 rounded text-center">A partir de R$ 14,90</div>
                </button>
              );
              })}
              {sets.length === 0 && <div className="col-span-full text-center text-slate-500 text-xs py-8">Nenhuma coleção encontrada.</div>}
            </div>
          )}
        </div>
      )}

      {/* SET DETAIL + BUY */}
      {view === 'sets' && selectedSet && !opening && (
        <div className="space-y-4">
          <button onClick={() => { setSelectedSet(null); setPackResult([]); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para coleções
          </button>

          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-[#07080f] rounded-xl p-4 flex items-center justify-center w-24 h-24 border border-[#1a1c2a] shrink-0">
              {selectedSet.images?.logo ? <img src={selectedSet.images.logo} alt={selectedSet.name} className="h-12 object-contain" /> : <Package className="w-8 h-8 text-slate-500" />}
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-white text-base">{selectedSet.name}</h3>
              <p className="text-xs text-slate-400">{selectedSet.series} • {selectedSet.printedTotal} cartas • {selectedSet.releaseDate?.split('-')[0]}</p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-500">Saldo:</span>
                <span className="font-mono font-bold text-amber-400">R$ {balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Set rarity breakdown */}
          {setCards.length > 0 && (() => {
            const counts: Record<string, number> = {};
            for (const c of setCards) {
              const r = c.rarity || 'Common';
              counts[r] = (counts[r] || 0) + 1;
            }
            const groups = [
              { keys: ['Common'], label: 'Comuns', color: 'text-slate-300', bg: 'border-slate-700' },
              { keys: ['Uncommon'], label: 'Incomuns', color: 'text-green-400', bg: 'border-green-600/30' },
              { keys: ['Rare'], label: 'Raras', color: 'text-amber-400', bg: 'border-amber-500/30' },
              { keys: ['Rare Holo', 'Rare Holo V', 'Rare Holo EX', 'Rare Holo GX'], label: 'Holo', color: 'text-yellow-300', bg: 'border-yellow-400/30' },
              { keys: ['Rare Ultra', 'Rare Rainbow'], label: 'Ultra', color: 'text-purple-400', bg: 'border-purple-400/30' },
              { keys: ['Rare Secret'], label: 'Secret', color: 'text-red-400', bg: 'border-red-400/30' },
            ];
            return (
              <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Cartas neste set</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {groups.map(g => {
                    const val = g.keys.reduce((s, k) => s + (counts[k] || 0), 0);
                    return (
                      <div key={g.label} className={`bg-[#07080f] rounded-xl p-2.5 text-center border ${g.bg}`}>
                        <p className={`text-sm font-extrabold ${g.color}`}>{val || '-'}</p>
                        <p className={`text-[8px] font-bold ${g.color}/70`}>{g.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Rarity odds info */}
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Chances por pacote</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-slate-700">
                <p className="text-lg font-extrabold text-slate-400">5</p>
                <p className="text-[9px] text-slate-600 font-bold">Comuns</p>
              </div>
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-green-600/30">
                <p className="text-lg font-extrabold text-green-400">3</p>
                <p className="text-[9px] text-green-400/70 font-bold">Incomuns</p>
              </div>
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-amber-500/30">
                <p className="text-lg font-extrabold text-amber-400">1</p>
                <p className="text-[9px] text-amber-400/70 font-bold">Rara</p>
              </div>
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-yellow-400/30">
                <p className="text-lg font-extrabold text-yellow-300">~12%</p>
                <p className="text-[9px] text-yellow-400/70 font-bold">Holo</p>
              </div>
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-purple-400/30">
                <p className="text-lg font-extrabold text-purple-400">~5%</p>
                <p className="text-[9px] text-purple-400/70 font-bold">Ultra</p>
              </div>
              <div className="bg-[#07080f] rounded-xl p-3 text-center border border-red-400/30">
                <p className="text-lg font-extrabold text-red-400">~3%</p>
                <p className="text-[9px] text-red-400/70 font-bold">Secreta</p>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 mt-2 text-center">80% Rara • 12% Holo • 5% Ultra • 3% Secreta</p>
          </div>

          {/* Quantity selector */}
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quantidade de pacotes</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PACK_OPTIONS.map(opt => {
                const selected = packQty === opt.qty;
                const affordable = balance >= opt.price;
                return (
                  <button
                    key={opt.qty}
                    onClick={() => setPackQty(opt.qty)}
                    disabled={!affordable}
                    className={`relative p-3 rounded-xl border text-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-[#07080f] border-[#1a1c2a] text-slate-300 hover:border-amber-500/30'
                    }`}
                  >
                    {opt.badge && (
                      <span className={`absolute -top-2 -right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${selected ? 'bg-amber-500 text-slate-950' : 'bg-green-500 text-white'}`}>
                        {opt.badge}
                      </span>
                    )}
                    <p className="text-sm font-extrabold">{opt.qty}x</p>
                    <p className="text-[10px] text-slate-400">{opt.label}</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${selected ? 'text-amber-400' : 'text-slate-300'}`}>R$ {opt.price.toFixed(2)}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1a1c2a]">
              <span>Total: <span className="font-bold text-white">{selectedOption.qty} pacote{selectedOption.qty > 1 ? 's' : ''}</span></span>
              <span className="font-mono font-bold text-amber-400 text-sm">R$ {selectedOption.price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleOpenPack}
            disabled={!canBuy || cardsLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-[#151724] disabled:text-[#383d5a] disabled:cursor-not-allowed text-slate-950 font-black py-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,191,0,0.2)]"
          >
            {cardsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {cardsLoading ? 'Carregando cartas...' : `Comprar ${selectedOption.qty} Pacote${selectedOption.qty > 1 ? 's' : ''} — R$ ${selectedOption.price.toFixed(2)}`}
          </button>

          {cardsLoading && <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}
        </div>
      )}

      {/* MARKET */}
      {view === 'market' && (
        <div className="space-y-3">
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-200">Mercado de Cartas</p>
              <p className="text-[10px] text-slate-500">Preços simulados com flutuação a cada 20s</p>
            </div>
            {collection.some(c => c.quantity > 1) && (
              <button onClick={() => onSellAllDuplicates(pricesRef.current)} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer shrink-0" title="Vender todas as cartas repetidas">
                Vender Repetidas
              </button>
            )}
          </div>
          {/* Filters */}
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar carta pelo nome..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
                <option value="todas">Todas raridades</option>
                <option value="0">Comum</option>
                <option value="1">Incomum</option>
                <option value="2">Rara</option>
                <option value="3">Holográfica</option>
                <option value="4">Ultra Rara</option>
                <option value="5">Secret Rara</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
                <option value="rarity">Raridade ▼</option>
                <option value="name">Nome A-Z</option>
                <option value="price">Preço ▲</option>
                <option value="price-desc">Preço ▼</option>
                <option value="quantity">Qtd ▼</option>
              </select>
            </div>
          </div>

          {filteredCards.filter(c => c.quantity > 1).length === 0 ? (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
              <TrendingUp className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma carta repetida</p>
              <p className="text-slate-500 text-xs mt-1">Compre mais pacotes para ter cartas repetidas para vender.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCards.filter(c => c.quantity > 1).map(card => {
                const price = pricesRef.current[card.id] ?? getBasePrice(card.rarity);
                const canSell = card.quantity > 1;
                return (
                  <div key={card.id} className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-3 flex items-center gap-3 hover:border-amber-500/20 transition-all">
                    <img src={card.imageUrl} alt={card.name} className="w-12 h-16 object-cover rounded-lg shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{card.name}</p>
                      <span className={`text-[9px] font-bold ${getCardRarityLevel(card.rarity) >= 3 ? 'text-yellow-300' : 'text-slate-400'}`}>
                        {getRarityLabel(card.rarity)} • {card.setName}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <DollarSign className="w-3 h-3 text-emerald-400" />
                        <span className="font-mono font-bold text-emerald-400 text-xs">R$ {price.toFixed(2)}</span>
                        <span className="text-[8px] text-slate-500">×{card.quantity}</span>
                      </div>
                    </div>
                    {canSell && (
                      <button
                        onClick={() => onSellCard(card.id, price)}
                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" /> R$ {price.toFixed(2)}
                      </button>
                    )}
                    {!canSell && card.quantity === 1 && (
                      <span className="text-[9px] text-slate-600 italic">Única</span>
                    )}
                  </div>
                );
              })}
              <p className="text-center text-[9px] text-slate-600 pt-2">Preços atualizados a cada 20s • {filteredCards.filter(c => c.quantity > 1).length} repetida{filteredCards.filter(c => c.quantity > 1).length > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      )}

      {/* COLLECTION */}
      {view === 'collection' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar carta pelo nome..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
                <option value="todas">Todas raridades</option>
                <option value="0">Comum</option>
                <option value="1">Incomum</option>
                <option value="2">Rara</option>
                <option value="3">Holográfica</option>
                <option value="4">Ultra Rara</option>
                <option value="5">Secret Rara</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
                <option value="rarity">Raridade ▼</option>
                <option value="name">Nome A-Z</option>
                <option value="price">Preço ▲</option>
                <option value="price-desc">Preço ▼</option>
                <option value="quantity">Qtd ▼</option>
              </select>
            </div>
          </div>
          {collection.length === 0 ? (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
              <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma carta na coleção</p>
              <p className="text-slate-500 text-xs mt-1">Compre pacotes para começar sua coleção!</p>
            </div>
          ) : (
            <>
              <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">
                    <span className="text-amber-400 font-bold">{collection.length}</span> cartas únicas
                    <span className="text-slate-600 mx-1">•</span>
                    <span>{collection.reduce((s, c) => s + c.quantity, 0)} total</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {collection.filter(c => getCardRarityLevel(c.rarity) >= 3).length} especiais
                    {collection.some(c => c.quantity > 1) && (
                      <span className="text-slate-600 ml-1">• {collection.filter(c => c.quantity > 1).length} repetidas</span>
                    )}
                  </p>
                </div>
                <div className="h-2 bg-[#07080f] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, collection.length)}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-slate-500">
                  {searchQuery || filterRarity !== 'todas' ? (
                    <><span className="text-slate-300 font-bold">{filteredCards.length}</span> resultados</>
                  ) : (
                    <>{collection.length} cartas únicas</>
                  )}
                </p>
              </div>
              {filteredCards.length === 0 ? (
                <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
                  <p className="text-slate-400 text-sm font-bold">Nenhuma carta com esses filtros</p>
                  <p className="text-slate-500 text-xs mt-1">Tente ajustar os filtros.</p>
                </div>
              ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredCards.map(card => {
                  const price = pricesRef.current[card.id] ?? getBasePrice(card.rarity);
                  return (
                  <div key={card.id} className={`bg-[#0d0e16] rounded-xl overflow-hidden border-2 transition-all group relative ${getRarityBorder(card.rarity)}`}>
                    <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                    <div className="p-2 text-center">
                      <p className="text-[9px] font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">{card.name}</p>
                      <span className={`text-[7px] font-bold ${getCardRarityLevel(card.rarity) >= 3 ? 'text-yellow-300' : getCardRarityLevel(card.rarity) === 1 ? 'text-green-400' : 'text-slate-400'}`}>
                        {getRarityLabel(card.rarity)}
                      </span>
                      {card.quantity > 1 && <span className="ml-1 text-[8px] text-slate-500">x{card.quantity}</span>}
                    </div>
                    {card.quantity > 1 && (
                      <button
                        onClick={() => onSellCard(card.id, price)}
                        className="absolute top-1 right-1 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title={`Vender por R$ ${price.toFixed(2)}`}
                      >
                        R$ {price.toFixed(2)}
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
