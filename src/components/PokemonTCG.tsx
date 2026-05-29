import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Package, ChevronRight, Search, Loader2, Sparkles, BookOpen, ArrowLeft, X } from 'lucide-react';
import type { PokemonCard } from '../types';

interface PokemonTCGProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
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

const API_BASE = 'https://api.pokemontcg.io/v2';
const PACK_PRICE = 5;

export default function PokemonTCG({ balance, onUpdateBalance, userId, collection, onCollectionUpdate }: PokemonTCGProps) {
  const [view, setView] = useState<'sets' | 'collection'>('sets');
  const [sets, setSets] = useState<TCGSets[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<TCGSets | null>(null);
  const [setCards, setSetCards] = useState<TCGCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [opening, setOpening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const cached = sessionStorage.getItem('pokemonSets');
    if (cached) {
      setSets(JSON.parse(cached));
      setSetsLoading(false);
      return;
    }
    fetch(`${API_BASE}/sets?orderBy=-releaseDate&pageSize=20`)
      .then(r => r.json())
      .then(d => {
        const list: TCGSets[] = d.data || [];
        setSets(list);
        sessionStorage.setItem('pokemonSets', JSON.stringify(list));
      })
      .catch(() => {})
      .finally(() => setSetsLoading(false));
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
    if (!selectedSet || balance < PACK_PRICE) return;
    if (setCards.length === 0) {
      await fetchSetCards(selectedSet.id);
    }
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);

    const cards = setCards.length > 0 ? setCards : [];
    if (cards.length === 0) {
      setOpening(false);
      return;
    }

    const common = cards.filter(c => !c.rarity || c.rarity === 'Common');
    const uncommon = cards.filter(c => c.rarity === 'Uncommon');
    const rare = cards.filter(c => c.rarity && c.rarity !== 'Common' && c.rarity !== 'Uncommon');

    const picks: TCGCard[] = [];
    for (let i = 0; i < 5; i++) {
      if (common.length > 0) picks.push(common[Math.floor(Math.random() * common.length)]);
      else picks.push(cards[Math.floor(Math.random() * cards.length)]);
    }
    for (let i = 0; i < 3; i++) {
      if (uncommon.length > 0) picks.push(uncommon[Math.floor(Math.random() * uncommon.length)]);
      else picks.push(cards[Math.floor(Math.random() * cards.length)]);
    }
    if (rare.length > 0) picks.push(rare[Math.floor(Math.random() * rare.length)]);
    else picks.push(cards[Math.floor(Math.random() * cards.length)]);

    const result: PokemonCard[] = picks.map(c => ({
      id: c.id,
      name: c.name,
      imageUrl: c.images?.small || '',
      rarity: c.rarity || 'Common',
      setName: selectedSet.name,
      setSeries: selectedSet.series,
      quantity: 1,
    }));

    setPackResult(result);

    for (let i = 0; i < result.length; i++) {
      await new Promise(r => setTimeout(r, 300));
      setRevealingIndex(i);
    }

    onCollectionUpdate(result);
  };

  const getRarityColor = (rarity: string) => {
    if (rarity === 'Rare Holo' || rarity === 'Rare Holo V') return 'text-yellow-400';
    if (rarity === 'Rare Ultra' || rarity === 'Rare Rainbow') return 'text-purple-400';
    if (rarity === 'Rare Secret') return 'text-red-400';
    if (rarity === 'Common') return 'text-slate-400';
    if (rarity === 'Uncommon') return 'text-green-400';
    if (rarity?.includes('Rare')) return 'text-amber-400';
    return 'text-slate-400';
  };

  const filteredSets = sets.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.series.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Infos Header */}
      <div className="bg-gradient-to-r from-amber-900/20 via-[#0e1017] to-amber-900/10 p-5 rounded-2xl border border-amber-950/40 flex items-center gap-4">
        <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
          <Gift className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-white text-base">Pokémon TCG — Pacotes & Coleção</h3>
          <p className="text-slate-400 text-xs">Compre pacotes por R$ {PACK_PRICE.toFixed(2)} e complete sua coleção de cartas!</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1c2a] bg-[#0d0e16] rounded-xl p-1">
        <button onClick={() => { setView('sets'); setSelectedSet(null); setPackResult([]); }} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'sets' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <Package className="w-4 h-4" /> Coleções
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
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => {}}
          >
            <div className="text-center max-w-lg w-full">
              <motion.h3
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-amber-400 font-extrabold text-lg mb-4"
              >
                🎴 Abrindo Pacote — {selectedSet?.name}
              </motion.h3>
              <div className="grid grid-cols-4 gap-3 justify-items-center">
                {packResult.map((card, idx) => (
                  <motion.div
                    key={card.id}
                    initial={{ rotateY: 180, opacity: 0, scale: 0.5 }}
                    animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="bg-[#1a1c2a] rounded-xl overflow-hidden border border-[#2a2d47] shadow-lg"
                  >
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full aspect-[2/3] object-cover"
                      loading="lazy"
                    />
                    <div className="p-1.5 text-center">
                      <p className="text-[8px] font-bold text-slate-200 truncate">{card.name}</p>
                      <span className={`text-[7px] font-bold ${getRarityColor(card.rarity)}`}>{card.rarity}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              {revealingIndex >= packResult.length - 1 && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => { setOpening(false); setPackResult([]); }}
                  className="mt-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 inline mr-1.5" /> Continuar
                </motion.button>
              )}
              {revealingIndex < packResult.length - 1 && (
                <p className="mt-4 text-amber-400/60 text-xs animate-pulse">Revelando cartas...</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETS VIEW */}
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
              {filteredSets.map(set => (
                <button
                  key={set.id}
                  onClick={() => { setSelectedSet(set); fetchSetCards(set.id); }}
                  className="bg-[#0d0e16] border border-[#1a1c2a] hover:border-amber-500/30 rounded-xl p-3 text-left transition-all cursor-pointer group"
                >
                  <div className="bg-[#07080f] rounded-lg p-3 flex items-center justify-center aspect-[2/1] mb-2 border border-[#1a1c2a]">
                    {set.images?.logo ? (
                      <img src={set.images.logo} alt={set.name} className="h-10 object-contain" loading="lazy" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-500" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">{set.name}</p>
                  <p className="text-[9px] text-slate-500">{set.series} • {set.printedTotal} cartas</p>
                  <div className="mt-2 bg-amber-500/10 text-amber-400 text-[9px] font-bold py-1 rounded text-center">Abrir Pacote R$ {PACK_PRICE.toFixed(2)}</div>
                </button>
              ))}
              {filteredSets.length === 0 && <div className="col-span-full text-center text-slate-500 text-xs py-8">Nenhuma coleção encontrada.</div>}
            </div>
          )}
        </div>
      )}

      {/* SET DETAIL */}
      {view === 'sets' && selectedSet && !opening && (
        <div className="space-y-4">
          <button onClick={() => { setSelectedSet(null); setPackResult([]); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para coleções
          </button>

          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-[#07080f] rounded-xl p-4 flex items-center justify-center w-24 h-24 border border-[#1a1c2a]">
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
            <button
              onClick={handleOpenPack}
              disabled={balance < PACK_PRICE || cardsLoading}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-[#151724] disabled:text-[#383d5a] disabled:cursor-not-allowed text-slate-950 font-black px-5 py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_12px_rgba(255,191,0,0.2)]"
            >
              {cardsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Comprar R$ {PACK_PRICE.toFixed(2)}
            </button>
          </div>

          {cardsLoading && (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
          )}
        </div>
      )}

      {/* COLLECTION VIEW */}
      {view === 'collection' && (
        <div className="space-y-3">
          {collection.length === 0 ? (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
              <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma carta na coleção</p>
              <p className="text-slate-500 text-xs mt-1">Compre pacotes para começar sua coleção!</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400"><span className="text-amber-400 font-bold">{collection.length}</span> cartas únicas na coleção</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {collection.map(card => (
                  <div key={card.id} className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl overflow-hidden hover:border-amber-500/30 transition-all group">
                    <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                    <div className="p-2 text-center">
                      <p className="text-[9px] font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">{card.name}</p>
                      <span className={`text-[7px] font-bold ${getRarityColor(card.rarity)}`}>{card.rarity}</span>
                      {card.quantity > 1 && <span className="ml-1 text-[8px] text-slate-500">x{card.quantity}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
