import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Search, Loader2, Sparkles, BookOpen, ArrowLeft, Star, TrendingUp, DollarSign, Trash2, Crosshair, Timer, ChevronDown } from 'lucide-react';
import type { PokemonCard } from '../types';

const CASE_PRICE = 12.90;

interface CSSkin {
  id: string;
  name: string;
  rarity: string;
  weapon: string;
  rarityLevel: number;
  minPrice: number;
  maxPrice: number;
}

interface CS2CaseData {
  id: string;
  name: string;
  image: string;
  price: number;
  items: CSSkin[];
}

const ALL_CASES: CS2CaseData[] = [
  {
    id: 'cs20',
    name: 'CS20 Case',
    image: '🎯',
    price: 12.90,
    items: [
      { id: 'cs20_1', name: 'Stalker', rarity: 'Mil-Spec', weapon: 'AUG', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'cs20_2', name: 'Verdigris', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'cs20_3', name: 'Lead Conduit', rarity: 'Mil-Spec', weapon: 'USP-S', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'cs20_4', name: 'Spectre', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'cs20_5', name: 'Buddy', rarity: 'Mil-Spec', weapon: 'Five-SeveN', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'cs20_6', name: 'Whitefish', rarity: 'Restricted', weapon: 'MAC-10', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_7', name: 'Runic', rarity: 'Restricted', weapon: 'PP-Bizon', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_8', name: 'Incinegator', rarity: 'Restricted', weapon: 'XM1014', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_9', name: 'Tooth Fairy', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_10', name: 'Bloodsport', rarity: 'Classified', weapon: 'MP7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_11', name: 'Atheris', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_12', name: 'Legion of Anubis', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'cs20_13', name: 'Printstream', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'fracture',
    name: 'Fracture Case',
    image: '💥',
    price: 12.90,
    items: [
      { id: 'frc_1', name: 'Fragments', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'frc_2', name: 'Mount Fuji', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'frc_3', name: 'Toy Soldier', rarity: 'Mil-Spec', weapon: 'Nova', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'frc_4', name: 'Ivory', rarity: 'Mil-Spec', weapon: 'P2000', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'frc_5', name: 'Hazard', rarity: 'Restricted', weapon: 'SG 553', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_6', name: 'Ensnared', rarity: 'Restricted', weapon: 'MAC-10', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_7', name: 'Cassette', rarity: 'Restricted', weapon: 'P250', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_8', name: 'Neo-Noir', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_9', name: 'Emphorosaur-S', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_10', name: 'Justice', rarity: 'Classified', weapon: 'MAG-7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_11', name: 'Wildfire', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'frc_12', name: 'Printstream', rarity: 'Covert', weapon: 'M4A1-S', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'snakebite',
    name: 'Snakebite Case',
    image: '🐍',
    price: 12.90,
    items: [
      { id: 'snk_1', name: 'Distressed', rarity: 'Mil-Spec', weapon: 'CZ75-Auto', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'snk_2', name: 'Epicenter', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'snk_3', name: 'Food Chain', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'snk_4', name: 'Ziggy', rarity: 'Mil-Spec', weapon: 'XM1014', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'snk_5', name: 'Boost Protocol', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_6', name: 'Roadblock', rarity: 'Restricted', weapon: 'UMP-45', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_7', name: 'Tom Cat', rarity: 'Restricted', weapon: 'AUG', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_8', name: 'Cyber Security', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'snk_9', name: 'Eye of the Emperor', rarity: 'Classified', weapon: 'FAMAS', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'snk_10', name: 'Rat Rod', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'snk_11', name: 'Trigger Discipline', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'dreams',
    name: 'Dreams & Nightmares',
    image: '🌙',
    price: 12.90,
    items: [
      { id: 'dr_1', name: 'Dream', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'dr_2', name: 'Sakkaku', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'dr_3', name: 'Dream', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'dr_4', name: 'Night', rarity: 'Mil-Spec', weapon: 'P2000', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'dr_5', name: 'Red', rarity: 'Mil-Spec', weapon: 'XM1014', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'dr_6', name: 'Dream', rarity: 'Restricted', weapon: 'AWP', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_7', name: 'Night', rarity: 'Restricted', weapon: 'FAMAS', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_8', name: 'Night', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_9', name: 'Night', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_10', name: 'Night', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_11', name: 'Night', rarity: 'Classified', weapon: 'M4A1-S', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_12', name: 'Night', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'dr_13', name: 'Night', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'dr_14', name: 'Dream', rarity: 'Covert', weapon: 'M4A4', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'kilowatt',
    name: 'Kilowatt Case',
    image: '⚡',
    price: 12.90,
    items: [
      { id: 'kw_1', name: 'X-Ray', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'kw_2', name: 'Power Load', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'kw_3', name: 'Heirloom', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.50, maxPrice: 3 },
      { id: 'kw_4', name: 'Kush Kit', rarity: 'Restricted', weapon: 'PP-Bizon', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_5', name: 'Concrete Jungle', rarity: 'Restricted', weapon: 'MP9', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_6', name: 'Copper Coated', rarity: 'Restricted', weapon: 'G3SG1', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_7', name: 'Vektor', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_8', name: 'Fade', rarity: 'Classified', weapon: 'SSG 08', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_9', name: 'Crescendo', rarity: 'Classified', weapon: 'MAG-7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_10', name: 'Koi', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'kw_11', name: 'Hot Rod', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
];

function getRarityColor(level: number): string {
  switch (level) {
    case 0: return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', glow: 'rgba(59,130,246,0.3)' };
    case 1: return { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'rgba(168,85,247,0.3)' };
    case 2: return { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-400', glow: 'rgba(236,72,153,0.3)' };
    case 3: return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', glow: 'rgba(239,68,68,0.3)' };
    default: return { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-400', glow: 'rgba(100,116,139,0.3)' };
  }
}

function getRarityLabel(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec (Azul)';
    case 1: return 'Restricted (Roxa)';
    case 2: return 'Classified (Rosa)';
    case 3: return 'Covert (Vermelha)';
    default: return 'Desconhecida';
  }
}

const RARITY_WEIGHTS = [0.7992, 0.1598, 0.032, 0.0064];
const RARITY_LABELS_SIMPLE = ['Mil-Spec', 'Restricted', 'Classified', 'Covert'];

function pickWeightedItem(caseData: CS2CaseData): CSSkin {
  const roll = Math.random();
  let cumulative = 0;
  let chosenLevel = 0;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    cumulative += RARITY_WEIGHTS[i];
    if (roll < cumulative) { chosenLevel = i; break; }
  }
  const pool = caseData.items.filter(s => s.rarityLevel === chosenLevel);
  if (pool.length === 0) {
    const fallback = caseData.items.filter(s => s.rarityLevel === 0);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateStripItems(caseData: CS2CaseData, winner: CSSkin, winnerIndex: number): CSSkin[] {
  const items: CSSkin[] = [];
  for (let i = 0; i < 50; i++) {
    if (i === winnerIndex) {
      items.push(winner);
    } else {
      items.push(pickWeightedItem(caseData));
    }
  }
  return items;
}

const ITEM_WIDTH = 88;
const CONTAINER_WIDTH = 600;

interface CS2CasesProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

export default function CS2Cases({
  balance,
  onUpdateBalance,
  userId,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: CS2CasesProps) {
  const [tab, setTab] = useState<'cases' | 'collection' | 'market'>('cases');
  const [selectedCase, setSelectedCase] = useState<CS2CaseData | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<CSSkin | null>(null);
  const [resultPrice, setResultPrice] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [stripItems, setStripItems] = useState<CSSkin[]>([]);
  const [stripX, setStripX] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newPrices: Record<string, number> = {};
    ALL_CASES.forEach(c => {
      c.items.forEach(skin => {
        const price = skin.minPrice + Math.random() * (skin.maxPrice - skin.minPrice);
        newPrices[skin.id] = Math.round(price * 100) / 100;
      });
    });
    setPrices(newPrices);
    const interval = setInterval(() => {
      setPrices(prev => {
        const updated = { ...prev };
        ALL_CASES.forEach(c => {
          c.items.forEach(skin => {
            const current = updated[skin.id] ?? (skin.minPrice + skin.maxPrice) / 2;
            const change = (Math.random() - 0.5) * 1.5;
            const newPrice = Math.max(skin.minPrice * 0.5, Math.min(skin.maxPrice * 1.5, current + change));
            updated[skin.id] = Math.round(newPrice * 100) / 100;
          });
        });
        return updated;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const openCase = useCallback(() => {
    if (!selectedCase || rolling) return;
    if (balance < CASE_PRICE) return;

    setRolling(true);
    setShowResult(false);
    setResult(null);
    onUpdateBalance(-CASE_PRICE);

    const winner = pickWeightedItem(selectedCase);
    const winnerIndex = 35 + Math.floor(Math.random() * 8);
    const items = generateStripItems(selectedCase, winner, winnerIndex);
    setStripItems(items);
    setStripX(CONTAINER_WIDTH);

    const targetX = -(winnerIndex * ITEM_WIDTH - CONTAINER_WIDTH / 2 + ITEM_WIDTH / 2);

    requestAnimationFrame(() => {
      const startX = CONTAINER_WIDTH;
      const endX = targetX;
      const duration = 3500;
      const startTime = performance.now();

      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentX = startX + (endX - startX) * eased;
        setStripX(currentX);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setStripX(endX);
          setResult(winner);
          setResultPrice(
            Math.round((winner.minPrice + Math.random() * (winner.maxPrice - winner.minPrice)) * 100) / 100
          );
          setShowResult(true);
          setRolling(false);
        }
      }
      requestAnimationFrame(animate);
    });
  }, [selectedCase, rolling, balance, onUpdateBalance]);

  const handleKeep = useCallback(() => {
    if (!result || !selectedCase) return;
    const card: PokemonCard = {
      id: result.id,
      name: `${result.weapon} | ${result.name}`,
      imageUrl: '',
      rarity: getRarityLabel(result.rarityLevel),
      setName: selectedCase.name,
      setSeries: 'CS2',
      quantity: 1,
    };
    onCollectionUpdate([card]);
    setShowResult(false);
    setResult(null);
  }, [result, selectedCase, onCollectionUpdate]);

  const handleSellNow = useCallback(() => {
    if (!result) return;
    onUpdateBalance(resultPrice);
    setShowResult(false);
    setResult(null);
  }, [result, resultPrice, onUpdateBalance]);

  const sellPrice = useCallback((card: PokemonCard): number => {
    return prices[card.id] ?? 0;
  }, [prices]);

  const handleSellSingle = useCallback((card: PokemonCard) => {
    onSellCard(card.id, sellPrice(card));
  }, [onSellCard, sellPrice]);

  const handleSellAllDups = useCallback(() => {
    const dupePrices: Record<string, number> = {};
    collection.forEach(c => {
      if (c.quantity > 1) {
        dupePrices[c.id] = sellPrice(c);
      }
    });
    onSellAllDuplicates(dupePrices);
  }, [collection, onSellAllDuplicates, sellPrice]);

  const filteredCollection = collection
    .filter(c => c.setSeries === 'CS2')
    .filter(c => {
      if (rarityFilter !== null) {
        const rarLevels: Record<string, number> = {
          'Mil-Spec (Azul)': 0,
          'Restricted (Roxa)': 1,
          'Classified (Rosa)': 2,
          'Covert (Vermelha)': 3,
        };
        return rarLevels[c.rarity] === rarityFilter;
      }
      return true;
    })
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const rarityCounts: Record<number, { total: number; collected: number }> = { 0: { total: 0, collected: 0 }, 1: { total: 0, collected: 0 }, 2: { total: 0, collected: 0 }, 3: { total: 0, collected: 0 } };
  ALL_CASES.forEach(c => c.items.forEach(s => {
    rarityCounts[s.rarityLevel].total++;
    if (collection.some(cc => cc.id === s.id)) rarityCounts[s.rarityLevel].collected++;
  }));

  const totalItems = ALL_CASES.reduce((sum, c) => sum + c.items.length, 0);
  const collectedItems = collection.filter(c => c.setSeries === 'CS2').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#161a2b]/40 via-[#0e1017] to-[#161a2b]/20 p-5 rounded-2xl border border-orange-950/45 flex items-center gap-4">
        <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20 text-orange-400">
          <Crosshair className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-extrabold text-white text-base">CS2 Case Opening</h3>
          <p className="text-slate-400 text-xs">Abra caixas e ganhe skins raras do Counter-Strike 2</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Progresso</div>
          <div className="text-sm font-bold text-white">{collectedItems}/{totalItems}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#1a1c2a] pb-2">
        {[
          { id: 'cases' as const, label: 'Caixas', icon: '📦' },
          { id: 'collection' as const, label: 'Coleção', icon: '📚' },
          { id: 'market' as const, label: 'Mercado', icon: '💰' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              tab === t.id
                ? 'bg-brand text-slate-950 border-brand shadow-[0_0_10px_rgba(0,255,135,0.2)]'
                : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d] hover:bg-[#141624]'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'cases' && !selectedCase && (
          <motion.div key="case-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {ALL_CASES.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-4 text-center hover:border-orange-500/30 transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-2">{c.image}</div>
                <div className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">{c.name}</div>
                <div className="text-xs text-slate-500 mt-1">R$ {c.price.toFixed(2)}</div>
              </button>
            ))}
          </motion.div>
        )}

        {tab === 'cases' && selectedCase && (
          <motion.div key="case-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <button onClick={() => setSelectedCase(null)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> Voltar
            </button>

            <div className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">{selectedCase.image}</div>
                <div>
                  <h4 className="text-lg font-bold text-white">{selectedCase.name}</h4>
                  <p className="text-sm text-slate-400">R$ {CASE_PRICE.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{selectedCase.items.length} skins possíveis</p>
                </div>
              </div>

              {/* Odds table */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {[
                  { level: 0, label: 'Mil-Spec', chance: '79,92%', color: 'text-blue-400' },
                  { level: 1, label: 'Restricted', chance: '15,98%', color: 'text-purple-400' },
                  { level: 2, label: 'Classified', chance: '3,20%', color: 'text-pink-400' },
                  { level: 3, label: 'Covert', chance: '0,64%', color: 'text-red-400' },
                ].map(o => (
                  <div key={o.level} className={`bg-[#0a0b12] border border-[#1a1d2d] rounded-lg p-2 text-center ${o.color}`}>
                    <div className="text-xs font-bold">{o.label}</div>
                    <div className="text-lg font-black">{o.chance}</div>
                    <div className="text-[10px] opacity-60">
                      {rarityCounts[o.level].collected}/{rarityCounts[o.level].total}
                    </div>
                  </div>
                ))}
              </div>

              {/* Open button */}
              <div className="relative overflow-hidden" style={{ height: rolling || showResult ? '220px' : 'auto', transition: 'height 0.3s' }}>
                {!rolling && !showResult && (
                  <button
                    onClick={openCase}
                    disabled={balance < CASE_PRICE}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                      balance < CASE_PRICE
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                    }`}
                  >
                    Abrir Caixa — R$ {CASE_PRICE.toFixed(2)}
                  </button>
                )}

                {/* Spinning strip */}
                {(rolling || showResult) && (
                  <div className="relative">
                    <div className="relative overflow-hidden rounded-xl border border-[#1a1d2d] bg-[#0a0b12]" style={{ height: '160px' }}>
                      {/* Fixed selector indicator */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                      </div>
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-24 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent rounded-full" />

                      {/* Strip */}
                      <div
                        ref={stripRef}
                        className="flex gap-1.5 items-center py-8 absolute"
                        style={{ transform: `translateX(${stripX}px)`, transition: 'none', willChange: 'transform' }}
                      >
                        {(rolling ? stripItems : [result!]).map((item, i) => {
                          const rColor = getRarityColor(item.rarityLevel);
                          return (
                            <div
                              key={rolling ? `strip-${i}` : 'result'}
                              className={`shrink-0 w-[80px] rounded-lg border ${rColor.border} ${rColor.bg} p-1.5 text-center`}
                              style={{ boxShadow: `0 0 6px ${rColor.glow}` }}
                            >
                              <div className="text-[9px] font-mono text-slate-400 truncate">{item.weapon}</div>
                              <div className={`text-[10px] font-bold ${rColor.text} truncate leading-tight`}>{item.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Result overlay */}
                    {showResult && result && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-4 text-center"
                      >
                        <div className="text-xs text-slate-500 mb-1">Você ganhou!</div>
                        <div className={`text-base font-bold ${getRarityColor(result.rarityLevel).text}`}>
                          {result.weapon} | {result.name}
                        </div>
                        <div className={`text-xs ${getRarityColor(result.rarityLevel).text} opacity-70`}>
                          {getRarityLabel(result.rarityLevel)}
                        </div>
                        <div className="text-lg font-black text-brand mt-1">R$ {resultPrice.toFixed(2)}</div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleSellNow}
                            className="flex-1 py-2 bg-brand text-slate-950 rounded-xl text-xs font-bold hover:shadow-[0_0_12px_rgba(0,255,135,0.3)] transition-all cursor-pointer"
                          >
                            Vender por R$ {resultPrice.toFixed(2)}
                          </button>
                          <button
                            onClick={handleKeep}
                            className="flex-1 py-2 bg-[#1a1d2d] text-slate-200 rounded-xl text-xs font-bold hover:bg-[#242738] transition-all cursor-pointer border border-[#2a2d3d]"
                          >
                            Guardar na Coleção
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Case contents */}
              <div className="mt-4">
                <h5 className="text-sm font-bold text-slate-300 mb-2">Conteúdo da Caixa</h5>
                {[0, 1, 2, 3].map(level => {
                  const items = selectedCase.items.filter(s => s.rarityLevel === level);
                  if (items.length === 0) return null;
                  const rColor = getRarityColor(level);
                  return (
                    <div key={level} className="mb-2">
                      <div className={`text-xs font-bold ${rColor.text} mb-1`}>{getRarityLabel(level)}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(s => {
                          const owned = collection.some(c => c.id === s.id && c.setSeries === 'CS2');
                          return (
                            <div
                              key={s.id}
                              className={`text-[10px] px-2 py-1 rounded-lg border ${rColor.border} ${rColor.bg} ${
                                owned ? 'opacity-60' : ''
                              }`}
                            >
                              {s.weapon} | {s.name}
                              {owned && <span className="text-brand ml-1">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar skin..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0e16] border border-[#1a1d2d] rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/30"
                />
              </div>
              <button
                onClick={() => setRarityFilter(null)}
                className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  rarityFilter === null ? 'bg-brand text-slate-950 border-brand' : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d]'
                }`}
              >
                Todas
              </button>
              {[
                { level: 0, label: 'Azul', color: 'text-blue-400' },
                { level: 1, label: 'Roxa', color: 'text-purple-400' },
                { level: 2, label: 'Rosa', color: 'text-pink-400' },
                { level: 3, label: 'Vermelha', color: 'text-red-400' },
              ].map(r => (
                <button
                  key={r.level}
                  onClick={() => setRarityFilter(rarityFilter === r.level ? null : r.level)}
                  className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${r.color} ${
                    rarityFilter === r.level ? 'bg-opacity-20 border-opacity-60' : 'bg-[#0d0e16] border-[#1a1d2d]'
                  } ${rarityFilter === r.level ? 'bg-white/5' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {filteredCollection.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">Nenhuma skin na coleção</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {filteredCollection.map(card => {
                  const rarLevel: Record<string, number> = {
                    'Mil-Spec (Azul)': 0,
                    'Restricted (Roxa)': 1,
                    'Classified (Rosa)': 2,
                    'Covert (Vermelha)': 3,
                  };
                  const level = rarLevel[card.rarity] ?? 0;
                  const rColor = getRarityColor(level);
                  const price = prices[card.id] ?? 0;
                  return (
                    <div
                      key={card.id}
                      className={`bg-[#0d0e16] border ${rColor.border} rounded-xl p-3 text-center`}
                      style={{ boxShadow: `0 0 8px ${rColor.glow}` }}
                    >
                      <div className="text-3xl mb-1">🔫</div>
                      <div className={`text-[10px] font-mono text-slate-500 truncate`}>
                        {card.name.split(' | ')[0]}
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {card.name.split(' | ')[1] || card.name}
                      </div>
                      <div className={`text-[10px] ${rColor.text}`}>{card.rarity}</div>
                      <div className="text-xs font-bold text-brand mt-1">R$ {price.toFixed(2)}</div>
                      {card.quantity > 1 && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{card.quantity}x</div>
                      )}
                      {card.quantity > 1 && (
                        <button
                          onClick={() => handleSellSingle(card)}
                          className="mt-1.5 w-full py-1 bg-[#1a1d2d] text-slate-300 rounded-lg text-[10px] font-bold hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer border border-[#2a2d3d]"
                        >
                          Vender 1x R$ {price.toFixed(2)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-white">Mercado de Skins CS2</div>
                <TrendingUp className="w-4 h-4 text-brand" />
              </div>
              <p className="text-[10px] text-slate-500">Preços flutuam a cada 20s</p>

              {collection.filter(c => c.setSeries === 'CS2' && c.quantity > 1).length > 0 && (
                <button
                  onClick={handleSellAllDups}
                  className="mt-3 w-full py-2.5 bg-brand/10 border border-brand/30 text-brand rounded-xl text-xs font-bold hover:bg-brand/20 transition-all cursor-pointer"
                >
                  Vender Todas Repetidas
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ALL_CASES.flatMap(c => c.items).map(skin => {
                const owned = collection.filter(c => c.id === skin.id && c.setSeries === 'CS2');
                const quantity = owned.reduce((sum, c) => sum + c.quantity, 0);
                const rColor = getRarityColor(skin.rarityLevel);
                const price = prices[skin.id] ?? 0;
                const trend = Math.random() > 0.5 ? 'up' : 'down';

                if (quantity <= 1) return null;

                return (
                  <div
                    key={skin.id}
                    className={`bg-[#0d0e16] border ${rColor.border} rounded-xl p-3 text-center`}
                  >
                    <div className={`text-[10px] font-mono ${rColor.text}`}>{skin.weapon}</div>
                    <div className="text-xs font-bold text-white truncate">{skin.name}</div>
                    <div className="text-[10px] text-slate-400">{getRarityLabel(skin.rarityLevel)}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className="text-xs font-bold text-brand">R$ {price.toFixed(2)}</span>
                      <span className={`text-[10px] ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                        {trend === 'up' ? '↑' : '↓'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">{quantity - 1} repetidas</div>
                    <button
                      onClick={() => {
                        const card = owned[0];
                        if (card) handleSellSingle(card);
                      }}
                      className="mt-1.5 w-full py-1 bg-[#1a1d2d] text-slate-300 rounded-lg text-[10px] font-bold hover:bg-brand/20 hover:text-brand transition-all cursor-pointer border border-[#2a2d3d]"
                    >
                      Vender 1x R$ {price.toFixed(2)}
                    </button>
                  </div>
                );
              })}
              {collection.filter(c => c.setSeries === 'CS2' && c.quantity > 1).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                  Nenhuma skin repetida para vender
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress summary */}
      {tab === 'collection' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(level => {
            const rColor = getRarityColor(level);
            const pct = rarityCounts[level].total > 0
              ? Math.round((rarityCounts[level].collected / rarityCounts[level].total) * 100)
              : 0;
            return (
              <div key={level} className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-3">
                <div className={`text-[10px] font-bold ${rColor.text}`}>{getRarityLabel(level)}</div>
                <div className="text-lg font-black text-white mt-0.5">{rarityCounts[level].collected}/{rarityCounts[level].total}</div>
                <div className="w-full h-1.5 bg-[#1a1d2d] rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${level === 0 ? 'bg-blue-500' : level === 1 ? 'bg-purple-500' : level === 2 ? 'bg-pink-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
