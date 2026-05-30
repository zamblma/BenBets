import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, DollarSign, Sparkles, Package, BookOpen, TrendingUp, Trash2, Swords } from 'lucide-react';
import { PlacedBet } from '../types';

interface LoLChestsProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
}

interface LoLItem {
  id: string;
  name: string;
  type: 'champion' | 'skin' | 'emote' | 'ward' | 'essence';
  champion?: string;
  rarity: number;
  rarityLabel: string;
  image: string;
  essenceValue: number;
  price: number;
}

const RARITY_CONFIG: Record<number, { label: string; color: string; border: string; glow: string }> = {
  0: { label: 'Comum', color: 'text-slate-300', border: 'border-slate-500/30', glow: 'rgba(148,163,184,0.2)' },
  1: { label: 'Raro', color: 'text-blue-400', border: 'border-blue-500/30', glow: 'rgba(59,130,246,0.2)' },
  2: { label: 'Épico', color: 'text-purple-400', border: 'border-purple-500/30', glow: 'rgba(168,85,247,0.25)' },
  3: { label: 'Lendário', color: 'text-orange-400', border: 'border-orange-500/30', glow: 'rgba(251,146,60,0.3)' },
  4: { label: 'Mítico', color: 'text-red-400', border: 'border-red-500/30', glow: 'rgba(239,68,68,0.35)' },
};

const CHAMPIONS = [
  'Ahri', 'Akali', 'Ashe', 'Darius', 'Ekko', 'Ezreal', 'Jinx', 'Kai\'Sa', 'Katarina', 'Lee Sin',
  'Lux', 'Master Yi', 'Miss Fortune', 'Pyke', 'Sett', 'Soraka', 'Thresh', 'Vayne', 'Vi', 'Yasuo',
  'Zed', 'Aatrox', 'Aphelios', 'Camille', 'Fiora', 'Irelia', 'Janna', 'Jax', 'Karma', 'Kayn',
  'Kha\'Zix', 'LeBlanc', 'Lucian', 'Mordekaiser', 'Nami', 'Nasus', 'Riven', 'Samira', 'Sylas', 'Talon',
];

const SKINS = [
  { name: 'PROJECT: Vayne', champion: 'Vayne' }, { name: 'K/DA All Out Ahri', champion: 'Ahri' },
  { name: 'Odyssey Yasuo', champion: 'Yasuo' }, { name: 'Star Guardian Jinx', champion: 'Jinx' },
  { name: 'God King Darius', champion: 'Darius' }, { name: 'Elementalist Lux', champion: 'Lux' },
  { name: 'Nightbringer Lee Sin', champion: 'Lee Sin' }, { name: 'True Damage Ekko', champion: 'Ekko' },
  { name: 'Dragonblade Riven', champion: 'Riven' }, { name: 'High Noon Lucian', champion: 'Lucian' },
  { name: 'Dark Star Thresh', champion: 'Thresh' }, { name: 'Spirit Blossom Ahri', champion: 'Ahri' },
  { name: 'Battle Academia Ezreal', champion: 'Ezreal' }, { name: 'PsyOps Sona', champion: 'Sona' },
  { name: 'Sentinel Vayne', champion: 'Vayne' }, { name: 'Coven Evelynn', champion: 'Evelynn' },
  { name: 'Dawnbringer Riven', champion: 'Riven' }, { name: 'Blood Moon Yasuo', champion: 'Yasuo' },
  { name: 'Pool Party Miss Fortune', champion: 'Miss Fortune' }, { name: 'Mecha Kingdoms Jax', champion: 'Jax' },
  { name: 'Battlecast Cho\'Gath', champion: 'Cho\'Gath' }, { name: 'Infernal Mordekaiser', champion: 'Mordekaiser' },
  { name: 'Dark Cosmic Jhin', champion: 'Jhin' }, { name: 'Star Guardian Ahri', champion: 'Ahri' },
  { name: 'Pulsefire Ezreal', champion: 'Ezreal' }, { name: 'Winterblessed Diana', champion: 'Diana' },
  { name: 'Empyrean Pyke', champion: 'Pyke' }, { name: 'Faerie Court Katarina', champion: 'Katarina' },
  { name: 'Storm Dragon Lee Sin', champion: 'Lee Sin' }, { name: 'Crystal Rose Akali', champion: 'Akali' },
];

const EMOTES = ['? Alguém?', 'Foco!', 'GG WP', 'Incrível', 'Muito Bem', 'Puxa', 'Vamos lá', 'Comemoração', 'Tristeza', 'Provocação'];
const WARDS = ['Torre Sentinela', 'Totem Visão', 'Lente do Vidente', 'Faro Zumbi', 'Totem Controle'];

function generateItems(): LoLItem[] {
  const items: LoLItem[] = [];
  let id = 0;

  CHAMPIONS.forEach(ch => {
    const rarity = Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 2 : 3;
    items.push({
      id: `lol_ch_${id++}`, name: ch, type: 'champion', rarity: Math.min(rarity, 3),
      rarityLabel: RARITY_CONFIG[Math.min(rarity, 3)].label, image: 'champion',
      essenceValue: rarity === 0 ? 90 : rarity === 1 ? 270 : rarity === 2 ? 810 : 1620,
      price: rarity === 0 ? 4.90 : rarity === 1 ? 12.90 : rarity === 2 ? 29.90 : 49.90,
    });
  });

  SKINS.forEach(sk => {
    const rarity = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : Math.random() < 0.9 ? 3 : 4;
    items.push({
      id: `lol_sk_${id++}`, name: sk.name, type: 'skin', champion: sk.champion, rarity,
      rarityLabel: RARITY_CONFIG[rarity].label, image: 'skin',
      essenceValue: rarity === 1 ? 270 : rarity === 2 ? 810 : rarity === 3 ? 1620 : 3240,
      price: rarity === 1 ? 14.90 : rarity === 2 ? 39.90 : rarity === 3 ? 79.90 : 149.90,
    });
  });

  EMOTES.forEach(e => {
    items.push({
      id: `lol_em_${id++}`, name: e, type: 'emote', rarity: 0,
      rarityLabel: 'Comum', image: 'emote', essenceValue: 60, price: 2.90,
    });
  });

  WARDS.forEach(w => {
    items.push({
      id: `lol_wa_${id++}`, name: w, type: 'ward', rarity: 1,
      rarityLabel: 'Raro', image: 'ward', essenceValue: 150, price: 5.90,
    });
  });

  return items;
}

const ALL_ITEMS = generateItems();

interface ChestDef {
  id: string;
  name: string; price: number; tier: string;
  description: string; icon: string;
  contents: { type: string; qty: number }[];
  weights: number[];
}

const CHESTS: ChestDef[] = [
  { id: 'basic', name: 'Baú Comum', price: 4.90, tier: 'Comum', icon: '📦', description: 'Campeões e emotes',
    contents: [{ type: 'champion', qty: 1 }, { type: 'emote', qty: 1 }],
    weights: [0.50, 0.35, 0.12, 0.03, 0] },
  { id: 'premium', name: 'Baú Premium', price: 14.90, tier: 'Premium', icon: '🎁', description: 'Skins raras e campeões',
    contents: [{ type: 'skin', qty: 1 }, { type: 'champion', qty: 1 }, { type: 'essence', qty: 1 }],
    weights: [0, 0.40, 0.35, 0.20, 0.05] },
  { id: 'legendary', name: 'Baú Lendário', price: 39.90, tier: 'Lendário', icon: '🏆', description: 'Skins lendárias e míticas',
    contents: [{ type: 'skin', qty: 2 }, { type: 'essence', qty: 2 }],
    weights: [0, 0, 0.30, 0.50, 0.20] },
];

function pickItem(type: string, rarityLevel: number): LoLItem {
  const pool = ALL_ITEMS.filter(i => i.type === type && i.rarity === rarityLevel);
  if (pool.length === 0) {
    const fallback = ALL_ITEMS.filter(i => i.type === type);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollRarity(weights: number[]): number {
  const roll = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) return i;
  }
  return 0;
}

export default function LoLChests({ balance, onUpdateBalance, onAddBetHistory }: LoLChestsProps) {
  const [tab, setTab] = useState<'chests' | 'collection' | 'market'>('chests');
  const [selectedChest, setSelectedChest] = useState<ChestDef | null>(null);
  const [result, setResult] = useState<{ item: LoLItem; essence?: boolean }[] | null>(null);
  const [opening, setOpening] = useState(false);
  const [collection, setCollection] = useState<LoLItem[]>([]);
  const [essence, setEssence] = useState(0);
  const [stats, setStats] = useState({ opens: 0, legendary: 0, mythic: 0 });

  const handleOpen = () => {
    if (!selectedChest) return;
    if (selectedChest.price > balance) { alert('Saldo insuficiente'); return; }

    onUpdateBalance(-selectedChest.price);
    setOpening(true);
    setResult(null);
    setStats(s => ({ ...s, opens: s.opens + 1 }));

    setTimeout(() => {
      const drops: { item: LoLItem; essence?: boolean }[] = [];
      for (const content of selectedChest.contents) {
        if (content.type === 'essence') {
          const amt = 50 + Math.floor(Math.random() * 200);
          setEssence(prev => prev + amt);
          drops.push({ item: { id: 'essence', name: `${amt} de Essência`, type: 'essence', rarity: 0, rarityLabel: 'Essência', image: 'essence', essenceValue: 0, price: 0 }, essence: true });
        } else {
          const rarity = rollRarity(selectedChest.weights);
          const item = pickItem(content.type, rarity);
          drops.push({ item });
          setCollection(prev => [...prev, item]);
          if (rarity >= 3) setStats(s => ({ ...s, legendary: rarity === 3 ? s.legendary + 1 : s.legendary, mythic: rarity === 4 ? s.mythic + 1 : s.mythic }));
        }
      }
      setResult(drops);
      setOpening(false);

      if (onAddBetHistory) {
        onAddBetHistory({
          id: `lol-${Date.now()}`,
          matchName: 'Baús LoL',
          selectionName: drops.map(d => d.item.name).join(', '),
          odds: 0, stake: selectedChest.price, potentialPayout: 0,
          status: 'won', placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino', outcomeValue: drops.some(d => d.item.rarity >= 3) ? 'LENDÁRIO!' : 'ABERTO',
        });
      }
    }, 1500);
  };

  const handleSellAllDuplicates = () => {
    const seen = new Map<string, number>();
    collection.forEach(c => seen.set(c.id, (seen.get(c.id) || 0) + 1));
    let total = 0;
    const kept: LoLItem[] = [];
    collection.forEach(c => {
      const count = seen.get(c.id) || 0;
      if (count > 1) {
        total += c.essenceValue * (count - 1);
        seen.set(c.id, 1);
        kept.push(c);
      } else {
        kept.push(c);
      }
    });
    if (total > 0) {
      setEssence(prev => prev + total);
      setCollection(kept);
    }
  };

  const typeIcon: Record<string, string> = { champion: '⚔️', skin: '👗', emote: '😊', ward: '👁️', essence: '💠' };

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0d0e16] to-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Swords className="w-3 h-3 text-blue-400" /> Baús do Invocador
          </span>
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className="text-cyan-300 font-bold">💠 {essence}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{stats.opens} abertos</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {[
          { id: 'chests' as const, label: 'Baús', icon: '📦' },
          { id: 'collection' as const, label: 'Coleção', icon: '📚' },
          { id: 'market' as const, label: 'Essência', icon: '💠' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
              tab === t.id ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'chests' && (
          <motion.div key="chests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Chest selection */}
            <div className="grid grid-cols-3 gap-2">
              {CHESTS.map(chest => (
                <button key={chest.id} onClick={() => { setSelectedChest(chest); setResult(null); }}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedChest?.id === chest.id
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-[#0d0e16]/60 border-[#1a1c2a] hover:border-blue-500/30'
                  }`}>
                  <div className="text-2xl mb-1">{chest.icon}</div>
                  <div className="text-[10px] font-bold text-white">{chest.name}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">R$ {chest.price.toFixed(2)}</div>
                </button>
              ))}
            </div>

            {selectedChest && (
              <>
                {/* Weights display */}
                <div className="bg-[#0d0e16]/60 rounded-xl p-3 border border-[#1a1c2a]">
                  <div className="text-[9px] text-slate-400 uppercase font-bold mb-2">Probabilidades</div>
                  <div className="grid grid-cols-5 gap-1">
                    {[0,1,2,3,4].map(lvl => (
                      <div key={lvl} className="text-center">
                        <div className={`text-[8px] font-bold ${RARITY_CONFIG[lvl].color}`}>{RARITY_CONFIG[lvl].label}</div>
                        <div className="text-[9px] font-mono text-white">{(selectedChest.weights[lvl] * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button onClick={handleOpen} disabled={opening || selectedChest.price > balance}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-800 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                  <Play className="w-4 h-4" />
                  {opening ? 'Abrindo...' : `Abrir ${selectedChest.name} — R$ ${selectedChest.price.toFixed(2)}`}
                </motion.button>
              </>
            )}

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-2">🎉 Você recebeu:</div>
                  <div className="space-y-2">
                    {result.map((drop, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[#06070d] rounded-lg p-2.5">
                        <span className="text-xl">{drop.essence ? '💠' : typeIcon[drop.item.type] || '📦'}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">{drop.item.name}</div>
                          {drop.item.champion && (
                            <div className="text-[9px] text-slate-400">{drop.item.champion}</div>
                          )}
                        </div>
                        {!drop.essence && (
                          <div className={`text-[9px] font-bold ${RARITY_CONFIG[drop.item.rarity]?.color || 'text-slate-400'}`}>
                            {drop.item.rarityLabel}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {collection.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">Nenhum item na coleção ainda.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                {[...new Map(collection.map(c => [c.id, c])).values()].map(item => {
                  const qty = collection.filter(c => c.id === item.id).length;
                  return (
                    <div key={item.id} className={`bg-[#0d0e16] border ${RARITY_CONFIG[item.rarity]?.border || 'border-[#1a1c2a]'} rounded-xl p-2.5`}>
                      <div className="text-lg mb-1">{typeIcon[item.type] || '📦'}</div>
                      <div className="text-[10px] font-bold text-white leading-tight">{item.name}</div>
                      {item.champion && <div className="text-[8px] text-slate-400">{item.champion}</div>}
                      <div className="flex justify-between items-center mt-1.5">
                        <div className={`text-[8px] font-bold ${RARITY_CONFIG[item.rarity]?.color || 'text-slate-400'}`}>
                          {item.rarityLabel}
                        </div>
                        {qty > 1 && <div className="text-[8px] text-slate-500">x{qty}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {collection.filter(c => collection.filter(x => x.id === c.id).length > 1).length > 0 && (
              <button onClick={handleSellAllDuplicates}
                className="w-full py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-amber-500/20 transition-colors">
                Vender Repetidas por Essência
              </button>
            )}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-[#0d0e16]/60 rounded-xl p-4 border border-[#1a1c2a] text-center">
              <div className="text-3xl mb-2">💠</div>
              <div className="text-2xl font-bold text-cyan-300 font-mono">{essence}</div>
              <div className="text-[10px] text-slate-400 mt-1">Essência Total</div>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-3 leading-relaxed">
              Acumule essência vendendo itens repetidos. Use para craftar itens específicos no futuro.
            </p>
            <div className="mt-4 space-y-2">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Histórico de Essência</h4>
              <div className="bg-[#0d0e16]/60 rounded-xl p-3 border border-[#1a1c2a]">
                <p className="text-[10px] text-slate-400">Você ganhou essência ao abrir baús e vender repetidas.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
