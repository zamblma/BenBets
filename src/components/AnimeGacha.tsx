import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, Search, X } from 'lucide-react';
import { PlacedBet } from '../types';

interface AnimeGachaProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
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
const RARITY_WEIGHTS = [0.55, 0.28, 0.11, 0.05, 0.01];

const PACK_PRICE = 14.90;
const PACK_SIZE = 5;

export default function AnimeGacha({ balance, onUpdateBalance, onAddBetHistory }: AnimeGachaProps) {
  const [tab, setTab] = useState<'gacha' | 'collection'>('gacha');
  const [chars, setChars] = useState<AnimeChar[]>([]);
  const [packResult, setPackResult] = useState<AnimeChar[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [collection, setCollection] = useState<AnimeChar[]>([]);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    const cache = sessionStorage.getItem('animeGachaChars4');
    if (cache) { try { const p = JSON.parse(cache); if (p.length >= 200) { setChars(p); return; } } catch {} }
    const ab = new AbortController();
    const all: AnimeChar[] = [];
    let done = 0;
    const totalPages = 10;
    for (let page = 1; page <= totalPages; page++) {
      fetch(`https://api.jikan.moe/v4/top/characters?page=${page}&limit=25`, { signal: ab.signal })
        .then(r => r.json()).then(d => {
          if (d?.data) d.data.forEach((c: any) => {
            all.push({
              id: `anime_${c.mal_id}`,
              name: c.name,
              series: c.anime?.[0]?.name || c.manga?.[0]?.name || 'Desconhecido',
              image: c.images?.jpg?.image_url || '',
              rarity: 0,
            });
          });
        }).catch(() => {}).finally(() => {
          done++;
          if (done >= totalPages) {
            const weighted = all.map(c => ({ ...c, rarity: rollRarity() }));
            setChars(weighted);
            sessionStorage.setItem('animeGachaChars4', JSON.stringify(weighted));
          }
        });
    }
    return () => ab.abort();
  }, []);

  const rollRarity = (): number => {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
      cum += RARITY_WEIGHTS[i];
      if (r < cum) return i;
    }
    return 0;
  };

  const pick = (): AnimeChar => {
    if (chars.length === 0) return { id: 'unknown', name: '???', series: '???', image: '', rarity: 0 };
    const rar = rollRarity();
    const pool = chars.filter(c => c.rarity === rar);
    if (pool.length === 0) return { ...chars[Math.floor(Math.random() * chars.length)] };
    return { ...pool[Math.floor(Math.random() * pool.length)] };
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE || chars.length === 0) return;
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;

    const result: AnimeChar[] = [];
    for (let i = 0; i < PACK_SIZE; i++) result.push(pick());
    setPackResult(result);

    const delay = 400;
    for (let i = 0; i < PACK_SIZE; i++) {
      await new Promise(r => setTimeout(r, delay));
      if (skipRef.current) break;
      setRevealingIndex(i);
    }

    setCollection(prev => [...prev, ...result]);

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

  const handleSellDuplicates = () => {
    const seen = new Map<string, { count: number; rarity: number }>();
    collection.forEach(c => {
      const e = seen.get(c.id);
      if (e) e.count++;
      else seen.set(c.id, { count: 1, rarity: c.rarity });
    });
    let profit = 0;
    const kept: AnimeChar[] = [];
    collection.forEach(c => {
      const e = seen.get(c.id);
      if (!e) return;
      if (e.count > 1 && e.rarity === 4) {
        profit += (e.count - 1) * 300;
        e.count = 1;
        kept.push(c);
      } else if (e.count > 1) {
        e.count--;
      } else {
        kept.push(c);
      }
    });
    if (profit > 0) onUpdateBalance(profit);
    setCollection(kept);
    if (profit > 0) alert(`Você vendeu repetidas de 5⭐ por R$ ${profit.toFixed(2)}`);
  };

  const uniqueCollection = useMemo(() => {
    const map = new Map<string, AnimeChar>();
    collection.forEach(c => {
      const existing = map.get(c.id);
      if (existing) existing.rarity = c.rarity;
      else map.set(c.id, { ...c });
    });
    let arr = Array.from(map.values());
    if (rarityFilter !== null) arr = arr.filter(c => c.rarity === rarityFilter);
    if (search) arr = arr.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.series.toLowerCase().includes(search.toLowerCase()));
    if (seriesFilter) arr = arr.filter(c => c.series === seriesFilter);
    return arr;
  }, [collection, rarityFilter, search, seriesFilter]);

  const seriesList = useMemo(() => {
    const s = new Set<string>();
    collection.forEach(c => s.add(c.series));
    return Array.from(s).sort();
  }, [collection]);

  const totalChars = chars.length;
  const uniqueCount = new Set(collection.map(c => c.id)).size;

  const hasDuplicates = useMemo(() => {
    const ids = collection.map(c => c.id);
    return new Set(ids).size !== ids.length;
  }, [collection]);

  const hasLegendaryDuplicates = useMemo(() => {
    const seen = new Map<string, number>();
    collection.forEach(c => { if (c.rarity === 4) seen.set(c.id, (seen.get(c.id) || 0) + 1); });
    return Array.from(seen.values()).some(v => v > 1);
  }, [collection]);

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
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
                  <div className="text-[9px] text-slate-400 uppercase font-bold mb-2">Probabilidades por Raridade</div>
                  <div className="grid grid-cols-5 gap-1">
                    {RARITY.map((label, i) => (
                      <div key={i} className="text-center">
                        <div className={`text-[8px] font-bold ${RARITY_COLORS[i]}`}>{'⭐'.repeat(i + 1)}</div>
                        <div className="text-[9px] font-mono text-white">{(RARITY_WEIGHTS[i] * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button onClick={handleOpenPack} disabled={balance < PACK_PRICE || chars.length === 0}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                  <Package className="w-4 h-4" />
                  {chars.length === 0 ? 'Carregando...' : `Abrir Pacote (R$ ${PACK_PRICE.toFixed(2)})`}
                </motion.button>
              </>
            )}

            <AnimatePresence>
              {opening && packResult.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-slate-400">🎴 Personagens:</div>
                    <button onClick={() => { skipRef.current = true; }}
                      className="text-[10px] text-yellow-400/60 hover:text-yellow-400 font-bold uppercase tracking-wider cursor-pointer px-3 py-1 rounded-lg bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors">
                        Pular
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {packResult.map((char, idx) => (
                      <motion.div key={idx}
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={idx <= revealingIndex ? { opacity: 1, scale: 1, y: 0 } : {}}
                        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0 }}
                        className={`bg-gradient-to-b ${RARITY_BG[char.rarity]} border ${RARITY_BORDERS[char.rarity]} rounded-xl overflow-hidden`}
                        style={{ boxShadow: `0 0 15px ${RARITY_GLOW[char.rarity]}` }}>
                        <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                          {char.image ? (
                            <img src={char.image} alt={char.name}
                              className="w-full h-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : null}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-black text-white/30">{initials(char.name)}</span>
                          </div>
                        </div>
                        <div className="p-2 text-center">
                          <p className="text-[9px] font-bold text-slate-200 truncate">{char.name}</p>
                          <p className="text-[7px] text-slate-400 truncate">{char.series}</p>
                          <div className={`text-[8px] font-bold mt-0.5 ${RARITY_COLORS[char.rarity]}`}>
                            {'⭐'.repeat(char.rarity + 1)}
                          </div>
                        </div>
                      </motion.div>
                    ))}
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
                    {hasLegendaryDuplicates ? 'Vender Repetidas (apenas 5⭐ dá lucro)' : 'Limpar Repetidas (sem lucro — só 5⭐ vale)'}
                  </button>
                )}

                {seriesList.filter(s => !seriesFilter || s === seriesFilter).map(series => {
                  const charsInSeries = uniqueCollection.filter(c => c.series === series);
                  if (charsInSeries.length === 0) return null;
                  return (
                    <div key={series} className="bg-[#0d0e16]/60 rounded-xl border border-[#1a1c2a] overflow-hidden">
                      <button onClick={() => setSeriesFilter(seriesFilter === series ? null : series)}
                        className="w-full px-3 py-2 bg-[#07080f] border-b border-[#1a1c2a] flex items-center justify-between cursor-pointer hover:bg-[#0a0b14] transition-colors">
                        <span className="text-[10px] font-bold text-slate-200 truncate">{series}</span>
                        <span className="text-[9px] text-slate-500">{charsInSeries.length}</span>
                      </button>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 p-2">
                        {charsInSeries.map(char => (
                          <div key={char.id}
                            className={`bg-gradient-to-b ${RARITY_BG[char.rarity]} border ${RARITY_BORDERS[char.rarity]} rounded-lg overflow-hidden`}>
                            <div className="aspect-[3/4] bg-[#06070d] relative overflow-hidden">
                              {char.image ? (
                                <img src={char.image} alt={char.name} className="w-full h-full object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : null}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-black text-white/30">{initials(char.name)}</span>
                              </div>
                            </div>
                            <div className="p-1 text-center">
                              <p className="text-[7px] font-bold text-slate-200 truncate">{char.name}</p>
                              <div className={`text-[7px] ${RARITY_COLORS[char.rarity]}`}>{'⭐'.repeat(char.rarity + 1)}</div>
                            </div>
                          </div>
                        ))}
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
