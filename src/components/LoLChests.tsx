import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Sparkles, TrendingUp, Swords, Search, Loader2, Hammer } from 'lucide-react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface LoLChestsProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId?: string;
}

interface LoLItem {
  id: string;
  name: string;
  type: 'champion' | 'skin' | 'essence';
  champion?: string;
  championKey?: string;
  skinNum?: number;
  rarity: number;
  rarityLabel: string;
  image: string;
  icon?: string;
  essenceValue: number;
  price: number;
}

const RARITY_CONFIG: Record<number, { label: string; color: string; border: string; glow: string }> = {
  0: { label: 'Comum', color: 'text-slate-300', border: 'border-slate-500/40', glow: 'rgba(148,163,184,0.2)' },
  1: { label: 'Raro', color: 'text-blue-400', border: 'border-blue-500/40', glow: 'rgba(59,130,246,0.28)' },
  2: { label: 'Épico', color: 'text-purple-400', border: 'border-purple-500/45', glow: 'rgba(168,85,247,0.32)' },
  3: { label: 'Lendário', color: 'text-orange-400', border: 'border-orange-500/50', glow: 'rgba(251,146,60,0.4)' },
  4: { label: 'Mítico', color: 'text-red-400', border: 'border-red-500/55', glow: 'rgba(239,68,68,0.45)' },
};

const MYTHIC_KEYWORDS = ['prestígio', 'prestige', 'hextec', 'hextech', 'vitoriosa', 'victorious', 'cinzas', 'ashen'];
const LEGENDARY_KEYWORDS = [
  'elementalista', 'guardiã estelar', 'guardião estelar', 'projeto', 'k/da',
  'deus-rei', 'emissário', 'florescer espiritual', 'cósmico', 'estrela negra',
  'pulsefire', 'empiriano', 'imortal', 'odisseia', 'arcana',
];

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

function getDeterministicChampRarity(champKey: string, title: string): number {
  const h = deterministicHash(champKey + title);
  if (h < 50) return 0;
  if (h < 82) return 1;
  if (h < 95) return 2;
  return 3;
}

function getDeterministicSkinRarity(skinId: string, skinName: string): number {
  const lower = skinName.toLowerCase();
  if (MYTHIC_KEYWORDS.some((kw) => lower.includes(kw))) return 4;
  if (LEGENDARY_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  const h = deterministicHash(skinId + skinName);
  if (h < 35) return 1;
  if (h < 78) return 2;
  if (h < 95) return 3;
  return 4;
}

function getEssenceAndPrice(rarity: number, isSkin: boolean) {
  if (!isSkin) {
    return {
      essenceValue: rarity === 0 ? 90 : rarity === 1 ? 270 : rarity === 2 ? 630 : 1260,
      price: rarity === 0 ? 4.90 : rarity === 1 ? 12.90 : rarity === 2 ? 29.90 : 49.90,
    };
  }
  return {
    essenceValue: rarity === 1 ? 270 : rarity === 2 ? 675 : rarity === 3 ? 1350 : 2700,
    price: rarity === 1 ? 14.90 : rarity === 2 ? 39.90 : rarity === 3 ? 79.90 : 149.90,
  };
}

// Offline fallback items with real Data Dragon image paths
const FALLBACK_VERSION = '15.1.1';
const FALLBACK_CHAMPS = [
  { id: 'Ahri', name: 'Ahri', skins: [{ num: 0, name: 'default' }, { num: 27, name: 'Florescer Espiritual' }, { num: 28, name: 'K/DA ALL OUT' }] },
  { id: 'Yasuo', name: 'Yasuo', skins: [{ num: 0, name: 'default' }, { num: 10, name: 'Emissário da Escuridão' }, { num: 17, name: 'Odisseia' }] },
  { id: 'Jinx', name: 'Jinx', skins: [{ num: 0, name: 'default' }, { num: 4, name: 'Guardiã Estelar' }, { num: 37, name: 'Arcane' }] },
  { id: 'Lux', name: 'Lux', skins: [{ num: 0, name: 'default' }, { num: 7, name: 'Elementalista' }, { num: 15, name: 'Cósmica' }] },
  { id: 'Darius', name: 'Darius', skins: [{ num: 0, name: 'default' }, { num: 15, name: 'Deus-Rei' }] },
  { id: 'Vayne', name: 'Vayne', skins: [{ num: 0, name: 'default' }, { num: 11, name: 'PROJETO: Vayne' }] },
  { id: 'LeeSin', name: 'Lee Sin', skins: [{ num: 0, name: 'default' }, { num: 11, name: 'Punhos Divinos' }] },
  { id: 'Ezreal', name: 'Ezreal', skins: [{ num: 0, name: 'default' }, { num: 5, name: 'Pulsefire' }] },
];

function buildFallbackItems(): LoLItem[] {
  const items: LoLItem[] = [];
  for (const ch of FALLBACK_CHAMPS) {
    for (const sk of ch.skins) {
      const isChamp = sk.num === 0;
      const rarity = isChamp
        ? getDeterministicChampRarity(ch.id, ch.name)
        : getDeterministicSkinRarity(`${ch.id}_${sk.num}`, sk.name);
      const { essenceValue, price } = getEssenceAndPrice(rarity, !isChamp);
      items.push({
        id: isChamp ? `lol_ch_${ch.id}` : `lol_sk_${ch.id}_${sk.num}`,
        name: isChamp ? ch.name : `${sk.name}`,
        type: isChamp ? 'champion' : 'skin',
        champion: isChamp ? undefined : ch.name,
        championKey: ch.id,
        skinNum: sk.num,
        rarity,
        rarityLabel: RARITY_CONFIG[rarity].label,
        image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${ch.id}_${sk.num}.jpg`,
        icon: `https://ddragon.leagueoflegends.com/cdn/${FALLBACK_VERSION}/img/champion/${ch.id}.png`,
        essenceValue,
        price,
      });
    }
  }
  return items;
}

let cachedDDragonItems: LoLItem[] | null = null;
let cachedDDragonVersion: string | null = null;

interface ChestDef {
  id: string;
  name: string;
  price: number;
  tier: string;
  description: string;
  icon: string;
  contents: { type: 'champion' | 'skin' | 'essence'; qty: number }[];
  weights: number[];
}

const CHESTS: ChestDef[] = [
  {
    id: 'basic', name: 'Baú Hextec Comum', price: 4.90, tier: 'Comum', icon: '📦',
    description: '1 Campeão + 1 Skin aleatória',
    contents: [{ type: 'champion', qty: 1 }, { type: 'skin', qty: 1 }],
    weights: [0.46, 0.34, 0.14, 0.05, 0.01],
  },
  {
    id: 'premium', name: 'Baú Mestre-Artesão', price: 14.90, tier: 'Premium', icon: '🎁',
    description: '2 Skins raras + Essência Laranja',
    contents: [{ type: 'skin', qty: 2 }, { type: 'champion', qty: 1 }, { type: 'essence', qty: 1 }],
    weights: [0, 0.36, 0.38, 0.20, 0.06],
  },
  {
    id: 'legendary', name: 'Orbe Lendário', price: 39.90, tier: 'Lendário', icon: '🏆',
    description: '3 Skins Épicas/Lendárias/Míticas + Essência',
    contents: [{ type: 'skin', qty: 3 }, { type: 'essence', qty: 1 }],
    weights: [0, 0, 0.28, 0.50, 0.22],
  },
];

function pickItem(poolSource: LoLItem[], type: 'champion' | 'skin', rarityLevel: number): LoLItem {
  const exact = poolSource.filter(i => i.type === type && i.rarity === rarityLevel);
  if (exact.length > 0) return exact[Math.floor(Math.random() * exact.length)];
  const sameType = poolSource.filter(i => i.type === type);
  if (sameType.length > 0) return sameType[Math.floor(Math.random() * sameType.length)];
  return poolSource[Math.floor(Math.random() * poolSource.length)];
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

export default function LoLChests({ balance, onUpdateBalance, onAddBetHistory, userId }: LoLChestsProps) {
  const storageKey = `benbets_lol_${userId || 'guest'}`;

  const [allItems, setAllItems] = useState<LoLItem[]>(() => cachedDDragonItems || buildFallbackItems());
  const [ddVersion, setDdVersion] = useState<string>(() => cachedDDragonVersion || FALLBACK_VERSION);
  const [loadingApi, setLoadingApi] = useState<boolean>(() => !cachedDDragonItems);

  const [tab, setTab] = useState<'chests' | 'collection' | 'market'>('chests');
  const [selectedChest, setSelectedChest] = useState<ChestDef | null>(CHESTS[0]);
  const [result, setResult] = useState<{ item: LoLItem; essence?: boolean }[] | null>(null);
  const [opening, setOpening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [forgeMessage, setForgeMessage] = useState('');
  const { play } = useSound();

  const [collection, setCollection] = useState<LoLItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.collection)) return parsed.collection;
      }
    } catch {}
    return [];
  });

  const [essence, setEssence] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.essence === 'number') return parsed.essence;
      }
    } catch {}
    return 0;
  });

  const [stats, setStats] = useState<{ opens: number; legendary: number; mythic: number }>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.stats) return parsed.stats;
      }
    } catch {}
    return { opens: 0, legendary: 0, mythic: 0 };
  });

  // Reload user state when userId changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setCollection(Array.isArray(parsed.collection) ? parsed.collection : []);
        setEssence(typeof parsed.essence === 'number' ? parsed.essence : 0);
        setStats(parsed.stats || { opens: 0, legendary: 0, mythic: 0 });
      }
    } catch {}
  }, [storageKey]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ collection, essence, stats }));
    } catch {}
  }, [storageKey, collection, essence, stats]);

  // Fetch Riot Data Dragon pt_BR champions & skins
  useEffect(() => {
    if (cachedDDragonItems) {
      setAllItems(cachedDDragonItems);
      setDdVersion(cachedDDragonVersion || FALLBACK_VERSION);
      setLoadingApi(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let ver = FALLBACK_VERSION;
        try {
          const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
          if (vRes.ok) {
            const versions = await vRes.json();
            if (Array.isArray(versions) && versions[0]) ver = versions[0];
          }
        } catch {}

        const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/pt_BR/championFull.json`);
        if (!cRes.ok) throw new Error('DataDragon failed');
        const cJson = await cRes.json();
        const dataObj = cJson?.data;
        if (!dataObj) throw new Error('Invalid championFull payload');

        const parsed: LoLItem[] = [];
        for (const champ of Object.values(dataObj) as any[]) {
          const champKey = champ.id;
          const champName = champ.name;
          const icon = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${champKey}.png`;

          // Champion base entry
          const chRarity = getDeterministicChampRarity(champKey, champ.title || '');
          const chPricing = getEssenceAndPrice(chRarity, false);
          parsed.push({
            id: `lol_ch_${champKey}`,
            name: champName,
            type: 'champion',
            championKey: champKey,
            skinNum: 0,
            rarity: chRarity,
            rarityLabel: RARITY_CONFIG[chRarity].label,
            image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champKey}_0.jpg`,
            icon,
            essenceValue: chPricing.essenceValue,
            price: chPricing.price,
          });

          // Skins entries
          if (Array.isArray(champ.skins)) {
            for (const sk of champ.skins) {
              if (!sk || sk.num === 0) continue;
              const skName = sk.name === 'default' ? champName : sk.name;
              const skRarity = getDeterministicSkinRarity(String(sk.id || sk.num), skName);
              const skPricing = getEssenceAndPrice(skRarity, true);
              parsed.push({
                id: `lol_sk_${champKey}_${sk.num}`,
                name: skName,
                type: 'skin',
                champion: champName,
                championKey: champKey,
                skinNum: sk.num,
                rarity: skRarity,
                rarityLabel: RARITY_CONFIG[skRarity].label,
                image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champKey}_${sk.num}.jpg`,
                icon,
                essenceValue: skPricing.essenceValue,
                price: skPricing.price,
              });
            }
          }
        }

        if (!cancelled && parsed.length > 0) {
          cachedDDragonItems = parsed;
          cachedDDragonVersion = ver;
          setAllItems(parsed);
          setDdVersion(ver);
        }
      } catch {
        // Keep fallback
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleOpen = () => {
    if (!selectedChest || opening) return;
    if (selectedChest.price > balance) { alert('Saldo insuficiente'); return; }

    play('reveal');
    onUpdateBalance(-selectedChest.price);
    setOpening(true);
    setResult(null);
    setStats(s => ({ ...s, opens: s.opens + 1 }));

    setTimeout(() => {
      const drops: { item: LoLItem; essence?: boolean }[] = [];
      const newlyCollected: LoLItem[] = [];
      let legendCount = 0;
      let mythicCount = 0;

      for (const content of selectedChest.contents) {
        if (content.type === 'essence') {
          const amt = 90 + Math.floor(Math.random() * 260);
          setEssence(prev => prev + amt);
          drops.push({
            item: {
              id: `essence-${Date.now()}`,
              name: `${amt} de Essência`,
              type: 'essence',
              rarity: 0,
              rarityLabel: 'Essência',
              image: '',
              essenceValue: 0,
              price: 0,
            },
            essence: true,
          });
        } else {
          for (let q = 0; q < content.qty; q++) {
            const rarity = rollRarity(selectedChest.weights);
            const item = pickItem(allItems, content.type, rarity);
            drops.push({ item });
            newlyCollected.push(item);
            if (item.rarity === 3) legendCount++;
            if (item.rarity === 4) mythicCount++;
          }
        }
      }

      setCollection(prev => [...prev, ...newlyCollected]);
      if (legendCount > 0 || mythicCount > 0) {
        play('rare');
        setStats(s => ({ ...s, legendary: s.legendary + legendCount, mythic: s.mythic + mythicCount }));
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
    }, 1100);
  };

  const handleForgeCapsule = (cost: number, minRarity: number, label: string) => {
    if (essence < cost) return;
    const pool = allItems.filter(i => i.type === 'skin' && i.rarity >= minRarity);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || allItems[0];
    setEssence(prev => prev - cost);
    setCollection(prev => [...prev, chosen]);
    play(chosen.rarity >= 3 ? 'rare' : 'reveal');
    setForgeMessage(`${label}: você forjou ${chosen.name} (${chosen.rarityLabel})!`);
    setTimeout(() => setForgeMessage(''), 4000);
  };

  const handleSellAllDuplicates = () => {
    const seen = new Set<string>();
    let total = 0;
    const kept: LoLItem[] = [];
    collection.forEach(c => {
      if (seen.has(c.id)) {
        total += c.essenceValue;
      } else {
        seen.add(c.id);
        kept.push(c);
      }
    });
    if (total > 0) {
      setEssence(prev => prev + total);
      setCollection(kept);
      play('cashout');
    }
  };

  const uniqueCollection = useMemo(() => {
    const map = new Map<string, { item: LoLItem; qty: number }>();
    for (const c of collection) {
      const entry = map.get(c.id);
      if (entry) entry.qty += 1;
      else map.set(c.id, { item: c, qty: 1 });
    }
    return Array.from(map.values())
      .filter(({ item }) => rarityFilter === null || item.rarity === rarityFilter)
      .filter(({ item }) =>
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.champion || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.item.rarity - a.item.rarity);
  }, [collection, rarityFilter, searchQuery]);

  const duplicateCount = collection.length - new Set(collection.map(c => c.id)).size;

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

      <div className="bg-[#070910] border border-blue-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-lg text-blue-400 shrink-0">
            <Swords className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold font-display text-white">Baús do Invocador</span>
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                Riot Data Dragon v{ddVersion}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {allItems.length} campeões & skins oficiais com splash vertical
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold px-2.5 py-1 rounded-lg">
            💠 {essence}
          </span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {[
          { id: 'chests' as const, label: 'Baús', icon: '📦' },
          { id: 'collection' as const, label: `Coleção (${new Set(collection.map(c => c.id)).size})`, icon: '📚' },
          { id: 'market' as const, label: 'Forja & Essência', icon: '💠' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-bold border transition-all duration-200 cursor-pointer ${
              tab === t.id
                ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.22)]'
                : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:border-blue-500/30'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loadingApi && (
        <div className="text-[10px] font-mono text-blue-300 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando catálogo oficial Riot Data Dragon...
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'chests' && (
          <motion.div key="chests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CHESTS.map(chest => (
                <button key={chest.id} onClick={() => { setSelectedChest(chest); setResult(null); }}
                  className={`p-3.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    selectedChest?.id === chest.id
                      ? 'bg-blue-500/15 border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.25)]'
                      : 'bg-[#080a12] border-[#1a1c2a] hover:border-blue-500/35'
                  }`}>
                  <div className="text-3xl mb-1.5">{chest.icon}</div>
                  <div className="text-xs font-extrabold text-white">{chest.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{chest.description}</div>
                  <div className="text-xs font-mono font-bold text-brand mt-1.5">R$ {chest.price.toFixed(2)}</div>
                </button>
              ))}
            </div>

            {selectedChest && (
              <>
                <div className="bg-[#080a12] rounded-xl p-3 border border-[#1a1c2a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Probabilidades — {selectedChest.name}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4].map(lvl => (
                      <div key={lvl} className="bg-[#06070d] border border-[#1a1c2a] rounded-lg p-1.5 text-center">
                        <div className={`text-[9px] font-bold ${RARITY_CONFIG[lvl].color}`}>{RARITY_CONFIG[lvl].label}</div>
                        <div className="text-xs font-mono font-bold text-white">{(selectedChest.weights[lvl] * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button onClick={handleOpen} disabled={opening || selectedChest.price > balance}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.28)] transition-all">
                  <Play className="w-4 h-4" />
                  {opening ? 'Abrindo Baú Hextec...' : `Abrir ${selectedChest.name} — R$ ${selectedChest.price.toFixed(2)}`}
                </motion.button>
              </>
            )}

            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-[#070910] border border-blue-500/25 rounded-2xl p-4 shadow-[0_0_26px_rgba(59,130,246,0.12)]">
                  <div className="text-xs font-bold text-brand mb-3">🎉 Recompensas Desbloqueadas:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {result.map((drop, i) => {
                      const cfg = RARITY_CONFIG[drop.item.rarity] || RARITY_CONFIG[0];
                      if (drop.essence) {
                        return (
                          <motion.div key={i} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08 }}
                            className="bg-[#0b0e18] border border-cyan-500/35 rounded-xl p-3 flex flex-col items-center justify-center text-center aspect-[3/4]">
                            <span className="text-4xl mb-2">💠</span>
                            <div className="text-xs font-extrabold text-cyan-300">{drop.item.name}</div>
                            <span className="text-[9px] text-slate-400 mt-1">Essência Laranja</span>
                          </motion.div>
                        );
                      }
                      return (
                        <motion.div key={i} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                          className={`rounded-xl overflow-hidden border-2 ${cfg.border} bg-[#080a12] holo-foil relative flex flex-col`}
                          style={{ boxShadow: `0 0 18px ${cfg.glow}` }}>
                          <div className="aspect-[3/4] relative bg-[#06070d] overflow-hidden">
                            <img src={drop.item.image} alt={drop.item.name} className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-transparent" />
                            <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/75 border border-white/10 ${cfg.color}`}>
                              {drop.item.rarityLabel}
                            </span>
                          </div>
                          <div className="p-2 text-center bg-[#06070d]">
                            <div className="text-[10px] font-extrabold text-white truncate">{drop.item.name}</div>
                            {drop.item.champion && <div className="text-[8px] text-slate-400 truncate">{drop.item.champion}</div>}
                            <div className="text-[8px] font-mono text-cyan-300 mt-0.5">+{drop.item.essenceValue} 💠 se repetida</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar campeão ou skin..."
                  className="w-full bg-[#06070d] border border-[#1a1c2a] rounded-xl text-xs text-slate-200 pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button onClick={() => setRarityFilter(null)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${rarityFilter === null ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#080a12] border-[#1a1c2a] text-slate-400'}`}>
                Todas
              </button>
              {[0, 1, 2, 3, 4].map(lvl => (
                <button key={lvl} onClick={() => setRarityFilter(rarityFilter === lvl ? null : lvl)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer ${RARITY_CONFIG[lvl].color} ${rarityFilter === lvl ? 'bg-white/10 border-white/25' : 'bg-[#080a12] border-[#1a1c2a]'}`}>
                  {RARITY_CONFIG[lvl].label}
                </button>
              ))}
            </div>

            {duplicateCount > 0 && (
              <button onClick={handleSellAllDuplicates}
                className="w-full py-2.5 bg-cyan-500/10 border border-cyan-500/35 text-cyan-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-cyan-500/20 transition-all">
                Desmontar {duplicateCount} Repetida{duplicateCount > 1 ? 's' : ''} por Essência 💠
              </button>
            )}

            {uniqueCollection.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-10">Nenhum item na coleção ainda.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
                {uniqueCollection.map(({ item, qty }) => {
                  const cfg = RARITY_CONFIG[item.rarity] || RARITY_CONFIG[0];
                  return (
                    <div key={item.id} className={`bg-[#070910] border-2 ${cfg.border} rounded-xl overflow-hidden holo-foil transition-transform hover:scale-[1.02]`}
                      style={{ boxShadow: `0 0 10px ${cfg.glow}` }}>
                      <div className="aspect-[3/4] relative bg-[#06070d]">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover object-top" loading="lazy" />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#070910] via-transparent to-transparent" />
                        {qty > 1 && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-mono font-bold bg-black/80 text-brand border border-brand/30 px-1.5 py-0.5 rounded-md">
                            ×{qty}
                          </span>
                        )}
                      </div>
                      <div className="p-2 text-center">
                        <div className="text-[10px] font-extrabold text-white truncate">{item.name}</div>
                        {item.champion && <div className="text-[8px] text-slate-400 truncate">{item.champion}</div>}
                        <div className={`text-[8px] font-bold mt-0.5 ${cfg.color}`}>{item.rarityLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-[#070910] rounded-2xl p-5 border border-cyan-500/25 text-center shadow-[0_0_24px_rgba(6,182,212,0.1)]">
              <div className="text-3xl mb-1">💠</div>
              <div className="text-3xl font-black text-cyan-300 font-mono">{essence}</div>
              <div className="text-[11px] text-slate-400 mt-1">Essência Laranja Acumulada</div>
            </div>

            {forgeMessage && (
              <div className="bg-brand/10 border border-brand/35 text-brand text-xs font-bold p-3 rounded-xl text-center">
                ✨ {forgeMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleForgeCapsule(1200, 2, 'Cápsula Épica+')}
                disabled={essence < 1200}
                className="p-4 rounded-xl border border-purple-500/35 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5" /> Cápsula Épica+
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">1.200 💠</span>
                </div>
                <p className="text-[10px] text-slate-400">Forja 1 skin garantida Épica, Lendária ou Mítica.</p>
              </button>

              <button
                onClick={() => handleForgeCapsule(3000, 3, 'Cápsula Lendária+')}
                disabled={essence < 3000}
                className="p-4 rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-orange-300 flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5" /> Cápsula Lendária/Mítica
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">3.000 💠</span>
                </div>
                <p className="text-[10px] text-slate-400">Forja 1 skin garantida Lendária ou Mítica.</p>
              </button>
            </div>

            <div className="bg-[#080a12] rounded-xl p-3.5 border border-[#1a1c2a] space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-cyan-400" /> Estatísticas da Conta LoL
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-white">{stats.opens}</div>
                  <div className="text-[9px] text-slate-500">Baús abertos</div>
                </div>
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-orange-400">{stats.legendary}</div>
                  <div className="text-[9px] text-slate-500">Lendários</div>
                </div>
                <div className="bg-[#06070d] rounded-lg p-2 border border-[#1a1c2a]">
                  <div className="text-sm font-black font-mono text-red-400">{stats.mythic}</div>
                  <div className="text-[9px] text-slate-500">Míticos</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
