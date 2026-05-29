import React, { useState, useRef, useMemo } from 'react';
import { Medal, Package, BookOpen, Star, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';

const PACK_PRICE = 50;

const GROUPS: { name: string; color: string; members: string[] }[] = [
  { name: 'BTS', color: 'purple-400', members: ['RM', 'Jin', 'Suga', 'J-Hope', 'Jimin', 'V', 'Jungkook'] },
  { name: 'BLACKPINK', color: 'pink-400', members: ['Jisoo', 'Jennie', 'Rosé', 'Lisa'] },
  { name: 'TWICE', color: 'hotpink', members: ['Nayeon', 'Jeongyeon', 'Momo', 'Sana', 'Jihyo', 'Mina', 'Dahyun', 'Chaeyoung', 'Tzuyu'] },
  { name: 'NewJeans', color: 'blue-300', members: ['Minji', 'Hanni', 'Danielle', 'Haerin', 'Hyein'] },
  { name: 'Stray Kids', color: 'red-400', members: ['Bang Chan', 'Lee Know', 'Changbin', 'Hyunjin', 'Han', 'Felix', 'Seungmin', 'I.N'] },
  { name: '(G)I-DLE', color: 'rose-400', members: ['Soyeon', 'Miyeon', 'Minnie', 'Yuqi', 'Shuhua'] },
  { name: 'LE SSERAFIM', color: 'sky-400', members: ['Sakura', 'Kim Chaewon', 'Huh Yunjin', 'Kazuha', 'Hong Eunchae'] },
  { name: 'aespa', color: 'violet-400', members: ['Karina', 'Winter', 'Giselle', 'Ningning'] },
  { name: 'ENHYPEN', color: 'orange-400', members: ['Jungwon', 'Heeseung', 'Jay', 'Jake', 'Sunghoon', 'Sunoo', 'Ni-ki'] },
  { name: 'ITZY', color: 'lime-400', members: ['Yeji', 'Lia', 'Ryujin', 'Chaeryeong', 'Yuna'] },
  { name: 'SEVENTEEN', color: 'amber-400', members: ['S.Coups', 'Jeonghan', 'Joshua', 'Jun', 'Hoshi', 'Wonwoo', 'Woozi', 'DK', 'Mingyu', 'The8', 'Seungkwan', 'Vernon', 'Dino'] },
  { name: 'NCT 127', color: 'cyan-400', members: ['Taeil', 'Johnny', 'Taeyong', 'Yuta', 'Doyoung', 'Jaehyun', 'Jungwoo', 'Mark', 'Haechan'] },
  { name: 'EXO', color: 'teal-400', members: ['Suho', 'Xiumin', 'Baekhyun', 'Chen', 'Chanyeol', 'D.O.', 'Kai', 'Sehun'] },
  { name: 'Red Velvet', color: 'red-300', members: ['Irene', 'Seulgi', 'Wendy', 'Joy', 'Yeri'] },
  { name: 'MAMAMOO', color: 'green-400', members: ['Solar', 'Moonbyul', 'Wheein', 'Hwasa'] },
  { name: 'IVE', color: 'yellow-300', members: ['Yujin', 'Gaeul', 'Rei', 'Wonyoung', 'Liz', 'Leeseo'] },
  { name: 'ATEEZ', color: 'indigo-400', members: ['Hongjoong', 'Seonghwa', 'Yunho', 'Yeosang', 'San', 'Mingi', 'Wooyoung', 'Jongho'] },
  { name: 'Dreamcatcher', color: 'fuchsia-400', members: ['JiU', 'SuA', 'Siyeon', 'Handong', 'Yoohyeon', 'Dami', 'Gahyeon'] },
  { name: 'ZEROBASEONE', color: 'lime-300', members: ['Zhang Hao', 'Sung Hanbin', 'Matthew', 'Taerae', 'Ricky', 'Gyuvin', 'Gunwook', 'Yujin', 'Jiwoong'] },
  { name: 'RIIZE', color: 'blue-400', members: ['Shotaro', 'Eunseok', 'Sungchan', 'Wonbin', 'Seunghan', 'Sohee', 'Anton'] },
];

const ALL_MEMBERS = GROUPS.flatMap(g =>
  g.members.map(m => ({ id: `${g.name}-${m}`.replace(/[^a-zA-Z0-9]/g, '_'), name: m, groupName: g.name, groupColor: g.color }))
);

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
  const pick = (arr: typeof ALL_MEMBERS) => arr[Math.floor(Math.random() * arr.length)];
  const result: PokemonCard[] = [];
  for (let i = 0; i < 3; i++) { const m = pick(ALL_MEMBERS); result.push({ id: m.id, name: m.name, imageUrl: '', rarity: 'Common', setName: m.groupName, setSeries: 'K-pop', quantity: 1 }); }
  for (let i = 0; i < 2; i++) { const m = pick(ALL_MEMBERS); result.push({ id: m.id, name: m.name, imageUrl: '', rarity: 'Uncommon', setName: m.groupName, setSeries: 'K-pop', quantity: 1 }); }
  const r = pick(ALL_MEMBERS); result.push({ id: r.id, name: r.name, imageUrl: '', rarity: Math.random() < 0.3 ? 'Ultra Rare' : 'Rare', setName: r.groupName, setSeries: 'K-pop', quantity: 1 });
  return result;
}

function getMemberImage(member: typeof ALL_MEMBERS[number], groupPhotos: Record<string, string>): string {
  const fromCache = groupPhotos[member.id] || groupPhotos[member.groupName];
  if (fromCache) return fromCache;
  const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || member.name[0];
  const colors: Record<string, string> = {
    'purple-400': '7c3aed', 'pink-400': 'db2777', 'hotpink': 'd946ef',
    'blue-300': '3b82f6', 'red-400': 'ef4444', 'rose-400': 'e11d48',
    'sky-400': '38bdf8', 'violet-400': '7c3aed', 'orange-400': 'f97316', 'lime-400': '65a30d',
    'amber-400': 'd97706', 'cyan-400': '06b6d4', 'teal-400': '14b8a6', 'red-300': 'f87171',
    'green-400': '22c55e', 'yellow-300': 'facc15', 'indigo-400': '6366f1', 'fuchsia-400': 'd946ef',
    'lime-300': '9ecb3c', 'blue-400': '3b82f6',
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
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const skipRef = useRef(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return; fetchedRef.current = true;
    const cache = sessionStorage.getItem('kpopPhotos');
    if (cache) { try { setPhotos(JSON.parse(cache)); return; } catch {} }

    const results: Record<string, string> = {};
    let done = GROUPS.length;

    for (const group of GROUPS) {
      const q = encodeURIComponent(group.name.replace(/[()!\-]/g, ' ').trim());
      fetch(`https://api.deezer.com/search/artist?q=${q}&limit=1`)
        .then(r => r.json())
        .then(d => {
          const artist = d?.data?.[0];
          if (artist?.picture_medium) {
            const url = artist.picture_medium;
            for (const m of group.members) {
              const id = `${group.name}-${m}`.replace(/[^a-zA-Z0-9]/g, '_');
              results[id] = url;
            }
            results[group.name] = url;
          }
        })
        .catch(() => {})
        .finally(() => {
          done--;
          if (done <= 0) {
            setPhotos({ ...results });
            sessionStorage.setItem('kpopPhotos', JSON.stringify(results));
          }
        });
    }
  }, []);

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

  const groupedCollection = useMemo(() => {
    const groups: Record<string, PokemonCard[]> = {};
    const filtered = filterRarity === 'todas' ? collection : collection.filter(c => getRarityLevel(c.rarity) === parseInt(filterRarity));
    for (const card of filtered) {
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase()) && !card.setName.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      (groups[card.setName] ??= []).push(card);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [collection, filterRarity, searchQuery]);

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
                          {member && <img src={getMemberImage(member, photos)} alt={card.name} className="w-full h-full object-contain" />}
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
        <div className="space-y-4">
          {groupedCollection.map(([groupName, cards]) => {
            const group = GROUPS.find(g => g.name === groupName);
            const groupMembers = group ? group.members.length : cards.length;
            return (
              <div key={groupName} className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between bg-[#07080f] border-b border-[#1a1c2a]">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold text-${group?.color || 'slate-200'}`}>{groupName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{cards.length}/{groupMembers}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 p-3">
                  {cards.map(card => {
                    const member = ALL_MEMBERS.find(m => m.id === card.id);
                    const isRare = getRarityLevel(card.rarity) >= 2;
                    const price = getBasePrice(card.rarity);
                    return (
                      <div key={card.id} className={`bg-[#07080f] rounded-lg border overflow-hidden transition-all group relative ${isRare ? getRarityBorder(card.rarity) : 'border-[#1a1c2a]'}`}>
                        <div className="p-1.5 flex items-center justify-center aspect-[3/4]">
                        {member && <img src={getMemberImage(member, photos)} alt={card.name} className="w-full h-full object-contain" />}
                        </div>
                        <div className="p-1 text-center">
                          <p className="text-[7px] font-bold text-slate-200 truncate">{card.name}</p>
                          <p className={`text-[6px] font-bold ${isRare ? 'text-pink-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
                          {card.quantity > 1 && <span className="text-[7px] text-slate-500">×{card.quantity}</span>}
                        </div>
                        {card.quantity > 1 && (
                          <button onClick={() => onSellCard(card.id, price)} className="absolute top-0.5 right-0.5 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[6px] font-bold px-1 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100">R$ {price.toFixed(2)}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
