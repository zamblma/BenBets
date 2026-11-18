import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Medal, Package, BookOpen, Star, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PokemonCard } from '../types';
import { fetchWikiThumbnails } from '../utils/wikiImages';
import { useSound } from '../hooks/useSound';

const PACK_PRICE = 50;

const GROUPS: { name: string; wiki: string; members: string[] }[] = [
  { name: 'BTS', wiki: 'BTS', members: ['RM', 'Jin', 'Suga', 'J-Hope', 'Jimin', 'V', 'Jungkook'] },
  { name: 'BLACKPINK', wiki: 'Blackpink', members: ['Jisoo', 'Jennie', 'Rosé', 'Lisa'] },
  { name: 'TWICE', wiki: 'Twice', members: ['Nayeon', 'Jeongyeon', 'Momo', 'Sana', 'Jihyo', 'Mina', 'Dahyun', 'Chaeyoung', 'Tzuyu'] },
  { name: 'NewJeans', wiki: 'NewJeans', members: ['Minji', 'Hanni', 'Danielle', 'Haerin', 'Hyein'] },
  { name: 'Stray Kids', wiki: 'Stray_Kids', members: ['Bang Chan', 'Lee Know', 'Changbin', 'Hyunjin', 'Han', 'Felix', 'Seungmin', 'I.N'] },
  { name: '(G)I-DLE', wiki: '(G)I-dle', members: ['Soyeon', 'Miyeon', 'Minnie', 'Yuqi', 'Shuhua'] },
  { name: 'LE SSERAFIM', wiki: 'Le_Sserafim', members: ['Sakura', 'Kim Chaewon', 'Huh Yunjin', 'Kazuha', 'Hong Eunchae'] },
  { name: 'aespa', wiki: 'Aespa', members: ['Karina', 'Winter', 'Giselle', 'Ningning'] },
  { name: 'ENHYPEN', wiki: 'Enhypen', members: ['Jungwon', 'Heeseung', 'Jay', 'Jake', 'Sunghoon', 'Sunoo', 'Ni-ki'] },
  { name: 'ITZY', wiki: 'Itzy', members: ['Yeji', 'Lia', 'Ryujin', 'Chaeryeong', 'Yuna'] },
  { name: 'SEVENTEEN', wiki: 'Seventeen_(South_Korean_band)', members: ['S.Coups', 'Jeonghan', 'Joshua', 'Jun', 'Hoshi', 'Wonwoo', 'Woozi', 'DK', 'Mingyu', 'The8', 'Seungkwan', 'Vernon', 'Dino'] },
  { name: 'NCT 127', wiki: 'NCT_127', members: ['Taeil', 'Johnny', 'Taeyong', 'Yuta', 'Doyoung', 'Jaehyun', 'Jungwoo', 'Mark', 'Haechan'] },
  { name: 'EXO', wiki: 'Exo', members: ['Suho', 'Xiumin', 'Baekhyun', 'Chen', 'Chanyeol', 'D.O.', 'Kai', 'Sehun'] },
  { name: 'Red Velvet', wiki: 'Red_Velvet_(group)', members: ['Irene', 'Seulgi', 'Wendy', 'Joy', 'Yeri'] },
  { name: 'MAMAMOO', wiki: 'Mamamoo', members: ['Solar', 'Moonbyul', 'Wheein', 'Hwasa'] },
  { name: 'IVE', wiki: 'Ive_(group)', members: ['Yujin', 'Gaeul', 'Rei', 'Wonyoung', 'Liz', 'Leeseo'] },
  { name: 'ATEEZ', wiki: 'Ateez', members: ['Hongjoong', 'Seonghwa', 'Yunho', 'Yeosang', 'San', 'Mingi', 'Wooyoung', 'Jongho'] },
  { name: 'Dreamcatcher', wiki: 'Dreamcatcher_(group)', members: ['JiU', 'SuA', 'Siyeon', 'Handong', 'Yoohyeon', 'Dami', 'Gahyeon'] },
  { name: 'ZEROBASEONE', wiki: 'Zerobaseone', members: ['Zhang Hao', 'Sung Hanbin', 'Matthew', 'Taerae', 'Ricky', 'Gyuvin', 'Gunwook', 'Yujin', 'Jiwoong'] },
  { name: 'RIIZE', wiki: 'Riize', members: ['Shotaro', 'Eunseok', 'Sungchan', 'Wonbin', 'Seunghan', 'Sohee', 'Anton'] },
];

// Individual Wikipedia article titles mapped to member IDs (group photo serves as fallback)
const IDOL_WIKI_MAP: Record<string, string> = {
  'BTS-RM': 'RM_(rapper)',
  'BTS-Jin': 'Jin_(singer)',
  'BTS-Suga': 'Suga_(rapper)',
  'BTS-J_Hope': 'J-Hope',
  'BTS-Jimin': 'Jimin',
  'BTS-V': 'V_(singer)',
  'BTS-Jungkook': 'Jungkook',
  'BLACKPINK-Jisoo': 'Jisoo',
  'BLACKPINK-Jennie': 'Jennie_(singer)',
  'BLACKPINK-Ros_': 'Rosé_(singer)',
  'BLACKPINK-Lisa': 'Lisa_(rapper)',
  'TWICE-Nayeon': 'Nayeon',
  'TWICE-Jeongyeon': 'Jeongyeon',
  'TWICE-Momo': 'Momo_(singer)',
  'TWICE-Sana': 'Sana_(singer)',
  'TWICE-Jihyo': 'Jihyo',
  'TWICE-Mina': 'Mina_(Japanese_singer)',
  'TWICE-Dahyun': 'Dahyun',
  'TWICE-Chaeyoung': 'Chaeyoung',
  'TWICE-Tzuyu': 'Tzuyu',
  'NewJeans-Minji': 'Minji_(singer)',
  'NewJeans-Hanni': 'Hanni_(singer)',
  'NewJeans-Danielle': 'Danielle_(singer)',
  'NewJeans-Haerin': 'Haerin',
  'NewJeans-Hyein': 'Hyein',
  'Stray_Kids-Bang_Chan': 'Bang_Chan',
  'Stray_Kids-Lee_Know': 'Lee_Know',
  'Stray_Kids-Changbin': 'Changbin',
  'Stray_Kids-Hyunjin': 'Hyunjin',
  'Stray_Kids-Han': 'Han_(rapper)',
  'Stray_Kids-Felix': 'Felix_(rapper)',
  'Stray_Kids-Seungmin': 'Seungmin',
  'Stray_Kids-I_N': 'I.N',
  '_G_I_DLE-Soyeon': 'Jeon_So-yeon',
  '_G_I_DLE-Miyeon': 'Cho_Mi-yeon',
  '_G_I_DLE-Minnie': 'Minnie_(singer)',
  '_G_I_DLE-Yuqi': 'Song_Yuqi',
  '_G_I_DLE-Shuhua': 'Yeh_Shu-hua',
  'LE_SSERAFIM-Sakura': 'Sakura_Miyawaki',
  'LE_SSERAFIM-Kim_Chaewon': 'Kim_Chae-won_(singer,_born_2000)',
  'LE_SSERAFIM-Huh_Yunjin': 'Huh_Yun-jin',
  'LE_SSERAFIM-Kazuha': 'Kazuha_(singer)',
  'LE_SSERAFIM-Hong_Eunchae': 'Hong_Eun-chae',
  'aespa-Karina': 'Karina_(South_Korean_singer)',
  'aespa-Winter': 'Winter_(singer)',
  'aespa-Giselle': 'Giselle_(singer)',
  'aespa-Ningning': 'Ningning',
  'ENHYPEN-Jungwon': 'Yang_Jung-won',
  'ENHYPEN-Heeseung': 'Heeseung',
  'ENHYPEN-Sunghoon': 'Park_Sung-hoon_(singer)',
  'ENHYPEN-Ni_ki': 'Ni-ki',
  'ITZY-Yeji': 'Hwang_Ye-ji',
  'ITZY-Lia': 'Lia_(singer)',
  'ITZY-Ryujin': 'Shin_Ryu-jin',
  'ITZY-Chaeryeong': 'Lee_Chae-ryeong',
  'ITZY-Yuna': 'Shin_Yu-na',
  'SEVENTEEN-S_Coups': 'S.Coups',
  'SEVENTEEN-Jeonghan': 'Jeonghan',
  'SEVENTEEN-Joshua': 'Joshua_(singer)',
  'SEVENTEEN-Jun': 'Wen_Junhui',
  'SEVENTEEN-Hoshi': 'Hoshi_(singer)',
  'SEVENTEEN-Wonwoo': 'Wonwoo',
  'SEVENTEEN-Woozi': 'Woozi',
  'SEVENTEEN-DK': 'DK_(singer)',
  'SEVENTEEN-Mingyu': 'Kim_Min-gyu_(singer)',
  'SEVENTEEN-The8': 'The8',
  'SEVENTEEN-Seungkwan': 'Seungkwan',
  'SEVENTEEN-Vernon': 'Vernon_(rapper)',
  'SEVENTEEN-Dino': 'Dino_(South_Korean_singer)',
  'NCT_127-Johnny': 'Johnny_(singer)',
  'NCT_127-Taeyong': 'Taeyong',
  'NCT_127-Yuta': 'Yuta_Nakamoto',
  'NCT_127-Doyoung': 'Doyoung_(singer)',
  'NCT_127-Jaehyun': 'Jaehyun_(singer)',
  'NCT_127-Jungwoo': 'Kim_Jung-woo_(singer)',
  'NCT_127-Mark': 'Mark_Lee_(singer)',
  'NCT_127-Haechan': 'Haechan',
  'EXO-Suho': 'Suho_(singer)',
  'EXO-Xiumin': 'Xiumin',
  'EXO-Baekhyun': 'Baekhyun',
  'EXO-Chen': 'Chen_(singer)',
  'EXO-Chanyeol': 'Chanyeol',
  'EXO-D_O_': 'D.O._(entertainer)',
  'EXO-Kai': 'Kai_(entertainer)',
  'EXO-Sehun': 'Sehun',
  'Red_Velvet-Irene': 'Irene_(singer)',
  'Red_Velvet-Seulgi': 'Seulgi',
  'Red_Velvet-Wendy': 'Wendy_(singer)',
  'Red_Velvet-Joy': 'Joy_(singer)',
  'Red_Velvet-Yeri': 'Yeri_(singer)',
  'MAMAMOO-Solar': 'Solar_(singer)',
  'MAMAMOO-Moonbyul': 'Moonbyul',
  'MAMAMOO-Wheein': 'Wheein',
  'MAMAMOO-Hwasa': 'Hwasa',
  'IVE-Yujin': 'An_Yu-jin',
  'IVE-Gaeul': 'Gaeul',
  'IVE-Rei': 'Rei_(singer)',
  'IVE-Wonyoung': 'Jang_Won-young',
  'IVE-Liz': 'Liz_(singer)',
  'IVE-Leeseo': 'Leeseo',
  'ATEEZ-Hongjoong': 'Kim_Hong-joong',
  'ATEEZ-Seonghwa': 'Seonghwa',
  'ATEEZ-San': 'Choi_San',
  'ZEROBASEONE-Zhang_Hao': 'Zhang_Hao_(singer)',
  'ZEROBASEONE-Sung_Hanbin': 'Sung_Han-bin',
  'RIIZE-Shotaro': 'Shotaro_(singer)',
  'RIIZE-Wonbin': 'Wonbin_(singer)',
  'RIIZE-Anton': 'Anton_(singer)',
};

const ALL_MEMBERS = GROUPS.flatMap(g =>
  g.members.map(m => {
    const id = `${g.name}-${m}`.replace(/[^a-zA-Z0-9]/g, '_');
    return {
      id,
      name: m,
      groupName: g.name,
      groupWiki: g.wiki,
      idolWiki: IDOL_WIKI_MAP[id],
    };
  })
);
const MEMBER_BY_ID = new Map(ALL_MEMBERS.map(m => [m.id, m]));
const GROUP_BY_NAME = new Map(GROUPS.map(g => [g.name, g]));

function getRarityLevel(rarity: string): number {
  if (rarity === 'Ultra Rare') return 3;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 3) return 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.65)] shimmer-rainbow';
  if (lvl === 2) return 'border-pink-400 shadow-[0_0_14px_rgba(236,72,153,0.45)]';
  if (lvl === 1) return 'border-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.2)]';
  return 'border-slate-700/70';
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
  return lvl === 0 ? 0.05 + Math.random() * 0.10 : lvl === 1 ? 0.15 + Math.random() * 0.25 : lvl === 2 ? 0.60 + Math.random() * 1.40 : lvl === 3 ? 12.00 + Math.random() * 65.00 : 0.10;
}

function genPack(wikiPhotos: Record<string, string>): PokemonCard[] {
  const pick = () => ALL_MEMBERS[Math.floor(Math.random() * ALL_MEMBERS.length)];
  const toCard = (m: typeof ALL_MEMBERS[number], rarity: string): PokemonCard => ({
    id: m.id,
    name: m.name,
    imageUrl: (m.idolWiki && wikiPhotos[m.idolWiki]) || wikiPhotos[m.groupWiki] || '',
    rarity,
    setName: m.groupName,
    setSeries: 'K-pop',
    quantity: 1,
  });
  const result: PokemonCard[] = [];
  for (let i = 0; i < 3; i++) result.push(toCard(pick(), 'Common'));
  for (let i = 0; i < 2; i++) result.push(toCard(pick(), 'Uncommon'));
  result.push(toCard(pick(), Math.random() < 0.3 ? 'Ultra Rare' : 'Rare'));
  return result;
}

export default function KpopPhotocards({
  balance,
  onUpdateBalance,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}) {
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [filterRarity, setFilterRarity] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const skipRef = useRef(false);
  const skipHandledRef = useRef(false);
  const [wikiPhotos, setWikiPhotos] = useState<Record<string, string>>({});
  const { play } = useSound();

  // Fetch individual idol + group portraits in <=50-title Wikipedia API batches
  useEffect(() => {
    const titles = [
      ...Object.values(IDOL_WIKI_MAP),
      ...GROUPS.map(g => g.wiki),
    ];
    fetchWikiThumbnails(titles, 500, 'kpop_idols_v1').then(map => {
      setWikiPhotos(map);
    });
  }, []);

  const resolvePhoto = (card: PokemonCard): string | null => {
    const member = MEMBER_BY_ID.get(card.id);
    if (member?.idolWiki && wikiPhotos[member.idolWiki]) return wikiPhotos[member.idolWiki];
    if (card.imageUrl) return card.imageUrl;
    if (member?.groupWiki && wikiPhotos[member.groupWiki]) return wikiPhotos[member.groupWiki];
    const grp = GROUP_BY_NAME.get(card.setName);
    if (grp && wikiPhotos[grp.wiki]) return wikiPhotos[grp.wiki];
    return null;
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE || opening) return;
    play('reveal');
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;
    skipHandledRef.current = false;

    const allCards = genPack(wikiPhotos);
    setPackResult(allCards);
    for (let i = 0; i < allCards.length; i++) {
      await new Promise(r => setTimeout(r, 280));
      if (skipRef.current) break;
      setRevealingIndex(i);
      if (getRarityLevel(allCards[i].rarity) >= 2) play('rare');
    }
    if (!skipRef.current) onCollectionUpdate(allCards);
  };

  const handleSellAll = () => {
    const prices: Record<string, number> = {};
    for (const c of collection) if (c.quantity > 1) prices[c.id] = getBasePrice(c.rarity);
    onSellAllDuplicates(prices);
  };

  const totalMembers = ALL_MEMBERS.length;
  const uniqueCount = useMemo(() => new Set(collection.map(c => c.id)).size, [collection]);
  const progress = Math.round((uniqueCount / totalMembers) * 100);

  const groupedCollection = useMemo(() => {
    const groups: Record<string, PokemonCard[]> = {};
    const filtered = filterRarity === 'todas'
      ? collection
      : collection.filter(c => getRarityLevel(c.rarity) === parseInt(filterRarity));
    for (const card of filtered) {
      if (
        searchQuery &&
        !card.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !card.setName.toLowerCase().includes(searchQuery.toLowerCase())
      ) continue;
      (groups[card.setName] ??= []).push(card);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [collection, filterRarity, searchQuery]);

  const colors = ['bg-purple-600', 'bg-pink-600', 'bg-sky-600', 'bg-amber-600', 'bg-emerald-600', 'bg-rose-600', 'bg-indigo-600', 'bg-teal-600'];
  const getColor = (name: string) => colors[name.length % colors.length];

  return (
    <div className="space-y-4">
      <div className="omnitrix-panel relative overflow-hidden p-4 sm:p-5 rounded-2xl border-pink-500/25 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-pink-400/70 to-transparent" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-pink-500/15 p-3 rounded-xl border border-pink-500/30 text-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.2)] shrink-0">
            <Medal className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold font-display text-white text-base">🎴 K-pop Photocards</h3>
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                Wikipedia Portraits API
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              R$ {PACK_PRICE.toFixed(2)} o pacote • {totalMembers} photocards • {GROUPS.length} grupos
            </p>
          </div>
        </div>
        <button onClick={handleOpenPack} disabled={balance < PACK_PRICE}
          className={`bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 text-white font-black px-5 py-3 rounded-xl text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-[0_0_18px_rgba(236,72,153,0.3)] ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Package className="w-4 h-4" /> Comprar (R$ {PACK_PRICE.toFixed(2)})
        </button>
      </div>

      <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400"><span className="text-pink-400 font-bold font-mono">{uniqueCount}</span>/{totalMembers} photocards • {GROUPS.length} grupos</p>
          <p className="text-xs font-bold font-mono text-pink-400">{progress}%</p>
        </div>
        <div className="h-2.5 bg-[#06070d] rounded-full overflow-hidden border border-[#1a1c2a]">
          <div className="h-full bg-gradient-to-r from-pink-600 via-fuchsia-500 to-pink-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(236,72,153,0.35)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-pink-400" /> Sua coleção</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar idol ou grupo..."
              className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 pl-7 pr-2.5 py-1.5 w-36 focus:outline-none focus:border-pink-500/50" />
          </div>
          <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-pink-500/50">
            <option value="todas">Todas raridades</option>
            <option value="0">Comum</option>
            <option value="1">Incomum</option>
            <option value="2">Rara</option>
            <option value="3">Super Rara</option>
          </select>
          {collection.some(c => c.quantity > 1) && (
            <button onClick={handleSellAll} className="bg-brand/15 hover:bg-brand text-brand hover:text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] border border-brand/30 transition-all cursor-pointer">
              Vender Repetidas
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <div className="text-center max-w-3xl w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-pink-400 font-extrabold font-display text-lg mb-2">
                🎴 Pacote de Photocards
              </motion.h3>
              <div className="flex items-center justify-center gap-3 mb-5">
                <p className="text-slate-400 text-xs">{Math.min(revealingIndex + 1, packResult.length)} de {packResult.length} photocards</p>
                {revealingIndex < packResult.length - 1 ? (
                  <button
                    onClick={() => {
                      if (skipHandledRef.current) return;
                      skipHandledRef.current = true;
                      skipRef.current = true;
                      setRevealingIndex(packResult.length - 1);
                      onCollectionUpdate(packResult);
                    }}
                    className="text-xs text-pink-300 font-bold uppercase tracking-wider cursor-pointer px-3 py-1 rounded-lg bg-pink-500/15 border border-pink-500/30"
                  >
                    Revelar Tudo
                  </button>
                ) : (
                  <button
                    onClick={() => { setOpening(false); setPackResult([]); }}
                    className="text-xs text-slate-950 bg-brand hover:bg-[#00e074] font-black uppercase tracking-wider cursor-pointer px-4 py-1.5 rounded-lg"
                  >
                    Concluir
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 justify-items-center">
                {packResult.map((card, idx) => {
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  const photo = resolvePhoto(card);
                  return (
                    <motion.div key={idx}
                      initial={{ rotateY: 180, opacity: 0, scale: 0.35 }}
                      animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}}
                      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                      className={`w-full max-w-[125px] bg-[#0c0e18] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} ${isRare ? 'holo-foil' : ''} shadow-lg relative`}
                    >
                      {isRare && (
                        <div className="absolute top-1.5 right-1.5 z-20">
                          <Star className={`w-3.5 h-3.5 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-pink-400'}`} fill="currentColor" />
                        </div>
                      )}
                      <div className="aspect-[2/3] relative overflow-hidden bg-[#06070d]">
                        {photo ? (
                          <img src={photo} alt={card.name} className="w-full h-full object-cover object-top"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className={`w-full h-full ${getColor(card.setName)} flex items-center justify-center`}>
                            <span className="text-3xl font-black text-white/85">{card.name[0]}</span>
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 text-[7px] font-mono font-bold bg-black/75 text-pink-300 px-1.5 py-0.5 rounded border border-white/10">
                          {card.setName}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      </div>
                      {idx <= revealingIndex && (
                        <div className="p-1.5 text-center bg-[#080a12]">
                          <p className="text-[10px] font-bold text-slate-100 truncate">{card.name}</p>
                          <p className={`text-[8px] font-bold ${isRare ? 'text-pink-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {collection.length === 0 ? (
        <div className="omnitrix-card rounded-2xl p-10 text-center">
          <BookOpen className="w-10 h-10 text-pink-400/60 mx-auto mb-3" />
          <p className="text-slate-200 text-sm font-bold">Nenhum photocard ainda</p>
          <p className="text-slate-400 text-xs mt-1">Compre pacotes para começar sua coleção de {totalMembers} photocards de {GROUPS.length} grupos!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedCollection.map(([groupName, cards]) => {
            const group = GROUP_BY_NAME.get(groupName);
            const groupMembers = group ? group.members.length : cards.length;
            return (
              <div key={groupName} className="bg-[#090b13] border border-[#1a1c2a] rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#06070d] border-b border-[#1a1c2a]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${getColor(groupName)}`} />
                    <span className="text-xs font-extrabold text-slate-100">{groupName}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-pink-400">{cards.length}/{groupMembers}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-2.5">
                  {cards.map(card => {
                    const isRare = getRarityLevel(card.rarity) >= 2;
                    const price = getBasePrice(card.rarity);
                    const photo = resolvePhoto(card);
                    return (
                      <div key={card.id}
                        className={`bg-[#06070d] rounded-xl border overflow-hidden transition-all duration-200 group relative hover:scale-[1.03] hover:z-10 ${getRarityBorder(card.rarity)} ${isRare ? 'holo-foil' : ''}`}>
                        <div className="aspect-[2/3] relative overflow-hidden bg-[#070910]">
                          {photo ? (
                            <img src={photo} alt={card.name} className="w-full h-full object-cover object-top" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className={`w-full h-full ${getColor(card.setName)} flex items-center justify-center`}>
                              <span className="text-2xl font-black text-white/80">{card.name[0]}</span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                        </div>
                        <div className="p-1.5 text-center bg-[#070910]">
                          <p className="text-[9px] font-bold text-slate-100 truncate">{card.name}</p>
                          <p className={`text-[7px] font-bold ${isRare ? 'text-pink-400' : 'text-slate-400'}`}>
                            {getRarityLabel(card.rarity)}
                            {card.quantity > 1 && <span className="text-brand ml-1">×{card.quantity}</span>}
                          </p>
                        </div>
                        {card.quantity > 1 && (
                          <button onClick={() => onSellCard(card.id, price)}
                            className="absolute top-1 right-1 z-20 bg-brand hover:bg-[#00e074] text-slate-950 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 shadow">
                            R$ {price.toFixed(2)}
                          </button>
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
