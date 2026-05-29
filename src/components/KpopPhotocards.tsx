import React, { useState, useRef } from 'react';
import { Medal, Package, BookOpen, Star, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';

const PACK_PRICE = 50;

interface KpopMember {
  id: string;
  name: string;
  groupName: string;
  groupColor: string;
}

const GROUPS: { name: string; color: string; members: { name: string }[] }[] = [
  { name: 'BTS', color: 'purple-400', members: [
    { name: 'RM' }, { name: 'Jin' }, { name: 'Suga' }, { name: 'J-Hope' },
    { name: 'Jimin' }, { name: 'V' }, { name: 'Jungkook' },
  ]},
  { name: 'BLACKPINK', color: 'pink-400', members: [
    { name: 'Jisoo' }, { name: 'Jennie' }, { name: 'Rosé' }, { name: 'Lisa' },
  ]},
  { name: 'TWICE', color: 'hotpink', members: [
    { name: 'Nayeon' }, { name: 'Jeongyeon' }, { name: 'Momo' }, { name: 'Sana' },
    { name: 'Jihyo' }, { name: 'Mina' }, { name: 'Dahyun' }, { name: 'Chaeyoung' }, { name: 'Tzuyu' },
  ]},
  { name: 'NewJeans', color: 'blue-300', members: [
    { name: 'Minji' }, { name: 'Hanni' }, { name: 'Danielle' }, { name: 'Haerin' }, { name: 'Hyein' },
  ]},
  { name: 'Stray Kids', color: 'red-400', members: [
    { name: 'Bang Chan' }, { name: 'Lee Know' }, { name: 'Changbin' }, { name: 'Hyunjin' },
    { name: 'Han' }, { name: 'Felix' }, { name: 'Seungmin' }, { name: 'I.N' },
  ]},
  { name: '(G)I-DLE', color: 'rose-400', members: [
    { name: 'Soyeon' }, { name: 'Miyeon' }, { name: 'Minnie' }, { name: 'Yuqi' }, { name: 'Shuhua' },
  ]},
  { name: 'LE SSERAFIM', color: 'sky-400', members: [
    { name: 'Sakura' }, { name: 'Kim Chaewon' }, { name: 'Huh Yunjin' }, { name: 'Kazuha' }, { name: 'Hong Eunchae' },
  ]},
  { name: 'aespa', color: 'violet-400', members: [
    { name: 'Karina' }, { name: 'Winter' }, { name: 'Giselle' }, { name: 'Ningning' },
  ]},
  { name: 'ENHYPEN', color: 'orange-400', members: [
    { name: 'Jungwon' }, { name: 'Heeseung' }, { name: 'Jay' }, { name: 'Jake' },
    { name: 'Sunghoon' }, { name: 'Sunoo' }, { name: 'Ni-ki' },
  ]},
  { name: 'ITZY', color: 'lime-400', members: [
    { name: 'Yeji' }, { name: 'Lia' }, { name: 'Ryujin' }, { name: 'Chaeryeong' }, { name: 'Yuna' },
  ]},
];

const ALL_MEMBERS: KpopMember[] = [];
for (const g of GROUPS) {
  for (const m of g.members) {
    ALL_MEMBERS.push({ id: `${g.name}-${m.name}`.replace(/[^a-zA-Z0-9]/g, '_'), name: m.name, groupName: g.name, groupColor: g.color });
  }
}

const POSITIONS = ['Leader', 'Vocal', 'Dancer', 'Rapper', 'Visual', 'Center'] as const;

function getRarityLevel(rarity: string): number {
  if (rarity === 'Ultra Rare') return 3;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 3) return 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]';
  if (lvl === 2) return 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]';
  if (lvl === 1) return 'border-cyan-500/50';
  return 'border-slate-600/30';
}

function getRarityLabel(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 3) return 'Super Rara';
  if (lvl === 2) return 'Rara';
  if (lvl === 1) return 'Incomum';
  return 'Comum';
}

function getBasePrice(rarity: string): number {
  const lvl = getRarityLevel(rarity);
  return lvl === 0 ? 0.50 + Math.random() : lvl === 1 ? 1.5 + Math.random() * 3 : lvl === 2 ? 5 + Math.random() * 10 : lvl === 3 ? 10 + Math.random() * 25 : 1;
}

function generatePhotocards(): PokemonCard[] {
  const pick = (arr: KpopMember[]) => arr[Math.floor(Math.random() * arr.length)];
  const result: PokemonCard[] = [];
  for (let i = 0; i < 3; i++) {
    const m = pick(ALL_MEMBERS);
    result.push({ id: m.id, name: m.name, imageUrl: '', rarity: 'Common' as string, setName: m.groupName, setSeries: 'K-pop', quantity: 1 });
    result[result.length - 1].rarity = 'Common';
  }
  for (let i = 0; i < 2; i++) {
    const m = pick(ALL_MEMBERS);
    result.push({ id: m.id, name: m.name, imageUrl: '', rarity: 'Uncommon' as string, setName: m.groupName, setSeries: 'K-pop', quantity: 1 });
  }
  const r = pick(ALL_MEMBERS);
  result.push({ id: r.id, name: r.name, imageUrl: '', rarity: Math.random() < 0.3 ? 'Ultra Rare' : 'Rare', setName: r.groupName, setSeries: 'K-pop', quantity: 1 });
  return result;
}

function getMemberImage(member: KpopMember): string {
  const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || member.name[0];
  const colors: Record<string, string> = {
    'purple-400': '7c3aed', 'pink-400': 'db2777', 'hotpink': 'd946ef',
    'blue-300': '3b82f6', 'red-400': 'ef4444', 'rose-400': 'e11d48',
    'sky-400': '38bdf8', 'violet-400': '7c3aed', 'orange-400': 'f97316', 'lime-400': '65a30d',
  };
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${colors[member.groupColor] || '7c3aed'}&color=fff&size=128&bold=true&font-size=0.4`;
}

export default function KpopPhotocards({ balance, onUpdateBalance, collection, onCollectionUpdate, onSellCard, onSellAllDuplicates }: {
  balance: number; onUpdateBalance: (amount: number) => void; userId: string; collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void; onSellCard: (cardId: string, price: number) => void; onSellAllDuplicates: (prices: Record<string, number>) => void;
}) {
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [filterRarity, setFilterRarity] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const skipRef = useRef(false);

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE) return;
    onUpdateBalance(-PACK_PRICE); setOpening(true); setPackResult([]); setRevealingIndex(-1); skipRef.current = false;
    const allCards = generatePhotocards(); setPackResult(allCards);
    for (let i = 0; i < allCards.length; i++) {
      if (skipRef.current) break; await new Promise(r => setTimeout(r, 300)); setRevealingIndex(i);
    }
    if (!skipRef.current) onCollectionUpdate(allCards);
  };

  const handleSell = (cardId: string) => { const card = collection.find(c => c.id === cardId); if (card) onSellCard(cardId, getBasePrice(card.rarity)); };
  const handleSellAll = () => { const prices: Record<string, number> = {}; for (const c of collection) if (c.quantity > 1) prices[c.id] = getBasePrice(c.rarity); onSellAllDuplicates(prices); };

  const totalMembers = ALL_MEMBERS.length;
  const uniqueCount = collection.length;
  const progress = Math.round((uniqueCount / totalMembers) * 100);

  const filteredCollection = collection.filter(c => {
    if (filterRarity !== 'todas' && getRarityLevel(c.rarity) !== parseInt(filterRarity)) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.setName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-pink-900/20 via-[#0e1017] to-purple-900/10 p-5 rounded-2xl border border-pink-950/40 flex items-center gap-4">
        <div className="bg-pink-500/10 p-3 rounded-xl border border-pink-500/20 text-pink-400"><Medal className="w-6 h-6" /></div>
        <div className="flex-1">
          <h3 className="font-extrabold text-white text-base">🎴 K-pop Photocards</h3>
          <p className="text-slate-400 text-xs">R$ {PACK_PRICE.toFixed(2)} o pacote • {totalMembers} photocards • {GROUPS.length} grupos</p>
        </div>
        <button onClick={handleOpenPack} disabled={balance < PACK_PRICE} className={`bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-slate-950 font-bold px-5 py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Package className="w-4 h-4" /> Comprar (R$ {PACK_PRICE.toFixed(2)})
        </button>
      </div>

      <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400"><span className="text-pink-400 font-bold">{uniqueCount}</span>/{totalMembers} photocards • {GROUPS.length} grupos</p>
          <p className="text-xs font-bold text-pink-400">{progress}%</p>
        </div>
        <div className="h-2 bg-[#07080f] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {uniqueCount > 0 && uniqueCount < totalMembers && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">Continue comprando pacotes para completar a coleção!</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-pink-400" /> Sua coleção</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 pl-6 pr-2 py-1.5 w-24 focus:outline-none focus:border-pink-500/50" />
          </div>
          <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-pink-500/50">
            <option value="todas">Todas raridades</option>
            <option value="0">Comum</option>
            <option value="1">Incomum</option>
            <option value="2">Rara</option>
            <option value="3">Super Rara</option>
          </select>
          {collection.some(c => c.quantity > 1) && <button onClick={handleSellAll} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer">Vender Repetidas</button>}
        </div>
      </div>

      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="text-center max-w-lg w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-pink-400 font-extrabold text-lg mb-2">🎴 Pacote de Photocards</motion.h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-slate-500 text-xs">{revealingIndex + 1} de {packResult.length} photocards</p>
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); onCollectionUpdate(packResult); setTimeout(() => setOpening(false), 800); }} className="text-xs sm:text-sm text-pink-400/60 hover:text-pink-400 font-bold uppercase tracking-wider transition-colors cursor-pointer px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-pink-500/5 hover:bg-pink-500/10">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 justify-items-center">
                {packResult.map((card, idx) => {
                  const member = ALL_MEMBERS.find(p => p.id === card.id);
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  return (
                    <motion.div key={idx} initial={{ rotateY: 180, opacity: 0, scale: 0.3 }} animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}} transition={{ type: 'spring', stiffness: 180, damping: 18 }} className={`bg-[#1a1c2a] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} shadow-lg ${isRare ? 'relative' : ''}`}>
                      {isRare && <div className="absolute -top-1 -right-1 z-10"><Star className={`w-4 h-4 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-pink-400'}`} fill="currentColor" /></div>}
                      <div className="bg-[#07080f] p-3 flex items-center justify-center w-full aspect-[3/4]">
                        {member && <img src={getMemberImage(member)} alt={card.name} className="w-full h-full object-contain" />}
                      </div>
                      {idx <= revealingIndex && <div className="p-2 text-center"><p className="text-[9px] font-bold text-slate-200 truncate">{card.name}</p><p className={`text-[7px] font-bold ${isRare ? 'text-pink-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p></div>}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {collection.length === 0 ? (
        <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-bold">Nenhum photocard ainda</p>
          <p className="text-slate-500 text-xs mt-1">Compre pacotes para começar sua coleção de {totalMembers} photocards de {GROUPS.length} grupos!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-3">
            <div className="flex gap-2 items-center">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nome ou grupo..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
            </div>
          </div>
          {filteredCollection.length === 0 ? (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
              <p className="text-slate-400 text-sm font-bold">Nenhum resultado</p>
              <p className="text-slate-500 text-xs mt-1">Tente ajustar os filtros ou busca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {filteredCollection.map(card => {
                const member = ALL_MEMBERS.find(m => m.id === card.id);
                const isRare = getRarityLevel(card.rarity) >= 2;
                const price = getBasePrice(card.rarity);
                return (
                  <div key={card.id} className={`bg-[#0d0e16] rounded-xl overflow-hidden border-2 transition-all group relative ${getRarityBorder(card.rarity)}`}>
                    <div className="bg-[#07080f] p-2 flex items-center justify-center aspect-[3/4]">
                      {member && <img src={getMemberImage(member)} alt={card.name} className="w-full h-full object-contain" />}
                    </div>
                    <div className="p-2 text-center">
                      <p className="text-[9px] font-bold text-slate-200 truncate group-hover:text-pink-400 transition-colors">{card.name}</p>
                      <span className={`text-[7px] font-bold ${isRare ? 'text-pink-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</span>
                      <span className="text-[7px] text-slate-500 ml-1">{card.setName}</span>
                      {card.quantity > 1 && <span className="ml-1 text-[8px] text-slate-500">x{card.quantity}</span>}
                    </div>
                    {card.quantity > 1 && (
                      <button onClick={() => onSellCard(card.id, price)} className="absolute top-1 right-1 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                        R$ {price.toFixed(2)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
