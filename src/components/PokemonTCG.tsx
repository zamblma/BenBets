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

function generatePack(cards: TCGCard[], setName: string, setSeries: string): PokemonCard[] {
  const common = cards.filter(c => !c.rarity || c.rarity === 'Common');
  const uncommon = cards.filter(c => c.rarity === 'Uncommon');
  const rare = cards.filter(c => c.rarity && !['Common', 'Uncommon'].includes(c.rarity));
  const pick = (pool: TCGCard[]) => pool[Math.floor(Math.random() * pool.length)] || cards[Math.floor(Math.random() * cards.length)];

  const result: PokemonCard[] = [];
  for (let i = 0; i < 5; i++) result.push({ ...pick(common), quantity: 1, setName, setSeries, imageUrl: pick(common).images?.small || '' });
  for (let i = 0; i < 3; i++) result.push({ ...pick(uncommon), quantity: 1, setName, setSeries, imageUrl: pick(uncommon).images?.small || '' });
  const rareCard = pick(rare);
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
  const [filterRarity, setFilterRarity] = useState('todas');
  const [sortBy, setSortBy] = useState<string>('rarity');
  const [priceVersion, setPriceVersion] = useState(0);

  const pricesRef = useRef<Record<string, number>>({});
  const allCardIds = useRef<Set<string>>(new Set());
  const skipRef = useRef(false);

  // Collect all unique card ids from collection
  useEffect(() => {
    collection.forEach(c => allCardIds.current.add(c.id));
  }, [collection]);

  // Generate base price from rarity
  const getBasePrice = useCallback((rarity: string): number => {
    const lvl = getCardRarityLevel(rarity);
    if (lvl === 0) return 0.50 + Math.random() * 1.50;
    if (lvl === 1) return 1.00 + Math.random() * 4.00;
    if (lvl === 2) return 5.00 + Math.random() * 15.00;
    if (lvl === 3) return 10.00 + Math.random() * 40.00;
    if (lvl === 4) return 30.00 + Math.random() * 120.00;
    if (lvl === 5) return 50.00 + Math.random() * 450.00;
    return 1.00;
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
  const canBuy = balance >= selectedOption.price && setCards.length > 0;

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

  const fetchSetCards = useCallback(async (setId: string) => {
    setCardsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/cards?q=set.id:${setId}&pageSize=250`);
      const d = await r.json();
      setSetCards(d.data || []);
    } catch {}
    setCardsLoading(false);
  }, []);

  const handleOpenPack = async () => {
    if (!selectedSet || !canBuy) return;
    if (setCards.length === 0) await fetchSetCards(selectedSet.id);

    onUpdateBalance(-selectedOption.price);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);

    const cards = setCards;
    if (cards.length === 0) { setOpening(false); return; }

    const allCards: PokemonCard[] = [];
    for (let i = 0; i < packQty; i++) {
      allCards.push(...generatePack(cards, selectedSet.name, selectedSet.series));
    }
    allCards.sort((a, b) => getCardRarityLevel(a.rarity) - getCardRarityLevel(b.rarity));
    setPackResult(allCards);

    skipRef.current = false;
    const delay = allCards.length <= 9 ? 350 : 200;
    for (let i = 0; i < allCards.length; i++) {
      if (skipRef.current) break;
      await new Promise(r => setTimeout(r, delay));
      setRevealingIndex(i);
    }

    if (!skipRef.current) onCollectionUpdate(allCards);
  };

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
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); onCollectionUpdate(packResult); setTimeout(() => setOpening(false), 600); }} className="text-[10px] text-amber-400/60 hover:text-amber-400 font-bold uppercase tracking-wider transition-colors cursor-pointer">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 justify-items-center max-h-[70vh] overflow-y-auto px-2">
                {packResult.map((card, idx) => {
                  const lvl = getCardRarityLevel(card.rarity);
                  const border = getRarityBorder(card.rarity);
                  const isRare = lvl >= 3;
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
                  <button
                    onClick={() => { setOpening(false); setPackResult([]); }}
                    className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 inline mr-1.5" /> Continuar
                  </button>
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
          <div className="flex gap-2 items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar coleção..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
          </div>
          {setsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sets.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.series.toLowerCase().includes(searchQuery.toLowerCase())).map(set => (
                <button key={set.id} onClick={() => { setSelectedSet(set); fetchSetCards(set.id); setPackQty(1); }} className="bg-[#0d0e16] border border-[#1a1c2a] hover:border-amber-500/30 rounded-xl p-3 text-left transition-all cursor-pointer group">
                  <div className="bg-[#07080f] rounded-lg p-3 flex items-center justify-center aspect-[2/1] mb-2 border border-[#1a1c2a]">
                    {set.images?.logo ? <img src={set.images.logo} alt={set.name} className="h-10 object-contain" loading="lazy" /> : <Package className="w-8 h-8 text-slate-500" />}
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">{set.name}</p>
                  <p className="text-[9px] text-slate-500">{set.series} • {set.printedTotal} cartas</p>
                  <div className="mt-2 bg-amber-500/10 text-amber-400 text-[9px] font-bold py-1 rounded text-center">A partir de R$ 14,90</div>
                </button>
              ))}
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
