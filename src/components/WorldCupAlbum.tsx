import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, Medal } from 'lucide-react';
import type { PokemonCard } from '../types';

interface Player {
  id: string;
  name: string;
  position: string;
  teamName: string;
  flag: string;
  rarity: string;
}

const PACK_PRICE = 10;

const TEAMS: { id: string; name: string; flag: string }[] = [
  { id: 'bra', name: 'Brasil', flag: '🇧🇷' },
  { id: 'arg', name: 'Argentina', flag: '🇦🇷' },
  { id: 'uru', name: 'Uruguai', flag: '🇺🇾' },
  { id: 'equ', name: 'Equador', flag: '🇪🇨' },
  { id: 'col', name: 'Colômbia', flag: '🇨🇴' },
  { id: 'par', name: 'Paraguai', flag: '🇵🇾' },
  { id: 'ven', name: 'Venezuela', flag: '🇻🇪' },
  { id: 'fra', name: 'França', flag: '🇫🇷' },
  { id: 'ing', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'esp', name: 'Espanha', flag: '🇪🇸' },
  { id: 'por', name: 'Portugal', flag: '🇵🇹' },
  { id: 'ale', name: 'Alemanha', flag: '🇩🇪' },
  { id: 'hol', name: 'Holanda', flag: '🇳🇱' },
  { id: 'ita', name: 'Itália', flag: '🇮🇹' },
  { id: 'bel', name: 'Bélgica', flag: '🇧🇪' },
  { id: 'sui', name: 'Suíça', flag: '🇨🇭' },
  { id: 'din', name: 'Dinamarca', flag: '🇩🇰' },
  { id: 'cro', name: 'Croácia', flag: '🇭🇷' },
  { id: 'srb', name: 'Sérvia', flag: '🇷🇸' },
  { id: 'tur', name: 'Turquia', flag: '🇹🇷' },
  { id: 'sue', name: 'Suécia', flag: '🇸🇪' },
  { id: 'pol', name: 'Polônia', flag: '🇵🇱' },
  { id: 'ukr', name: 'Ucrânia', flag: '🇺🇦' },
  { id: 'eua', name: 'Estados Unidos', flag: '🇺🇸' },
  { id: 'mex', name: 'México', flag: '🇲🇽' },
  { id: 'can', name: 'Canadá', flag: '🇨🇦' },
  { id: 'crc', name: 'Costa Rica', flag: '🇨🇷' },
  { id: 'pan', name: 'Panamá', flag: '🇵🇦' },
  { id: 'jam', name: 'Jamaica', flag: '🇯🇲' },
  { id: 'hon', name: 'Honduras', flag: '🇭🇳' },
  { id: 'jap', name: 'Japão', flag: '🇯🇵' },
  { id: 'cor', name: 'Coreia do Sul', flag: '🇰🇷' },
  { id: 'aus', name: 'Austrália', flag: '🇦🇺' },
  { id: 'ira', name: 'Irã', flag: '🇮🇷' },
  { id: 'ars', name: 'Arábia Saudita', flag: '🇸🇦' },
  { id: 'qat', name: 'Catar', flag: '🇶🇦' },
  { id: 'iraq', name: 'Iraque', flag: '🇮🇶' },
  { id: 'sen', name: 'Senegal', flag: '🇸🇳' },
  { id: 'mar', name: 'Marrocos', flag: '🇲🇦' },
  { id: 'nig', name: 'Nigéria', flag: '🇳🇬' },
  { id: 'egp', name: 'Egito', flag: '🇪🇬' },
  { id: 'cam', name: 'Camarões', flag: '🇨🇲' },
  { id: 'gan', name: 'Gana', flag: '🇬🇭' },
  { id: 'tun', name: 'Tunísia', flag: '🇹🇳' },
  { id: 'alg', name: 'Argélia', flag: '🇩🇿' },
  { id: 'cos', name: 'Costa do Marfim', flag: '🇨🇮' },
  { id: 'mali', name: 'Mali', flag: '🇲🇱' },
  { id: 'nzl', name: 'Nova Zelândia', flag: '🇳🇿' },
];

const POSITIONS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MEI', 'AT'] as const;

const NAME_POOLS: Record<string, { first: string[]; last: string[]; stars: string[] }> = {
  brasil: {
    first: ['Lucas', 'Gabriel', 'Rafael', 'Matheus', 'Felipe', 'Bruno', 'Pedro', 'João', 'Gustavo', 'Diego', 'Thiago', 'Carlos', 'Marcos', 'Alexandre', 'Eduardo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Almeida', 'Barbosa', 'Gomes', 'Ribeiro', 'Carvalho', 'Araújo', 'Melo', 'Nunes'],
    stars: ['Vinicius Jr.', 'Rodrygo', 'Raphinha', 'Endrick', 'Alisson', 'Marquinhos', 'Bruno Guimarães', 'Gabriel Magalhães', 'Ederson', 'Paquetá'],
  },
  argentina: {
    first: ['Lionel', 'Julian', 'Lautaro', 'Enzo', 'Rodrigo', 'Alexis', 'Nicolas', 'Alejandro', 'Emiliano', 'Leandro', 'Giovani', 'Cristian', 'Nahuel', 'Marcos', 'Gonzalo'],
    last: ['Martínez', 'Fernández', 'Álvarez', 'De Paul', 'Mac Allister', 'Romero', 'Molina', 'Tagliafico', 'Paredes', 'Lo Celso', 'Garnacho', 'Otamendi', 'Dybala', 'Di María', 'Acuña'],
    stars: ['Lionel Messi', 'Julian Álvarez', 'Enzo Fernández', 'Alexis Mac Allister', 'Cristian Romero', 'Rodrigo De Paul', 'Lautaro Martínez', 'Alejandro Garnacho'],
  },
  uefa: {
    first: ['Harry', 'Jude', 'Bukayo', 'Phil', 'Declan', 'Cole', 'Anthony', 'Kieran', 'John', 'Jordan', 'Luke', 'Ezri', 'Conor', 'Jarrod', 'Marcus'],
    last: ['Kane', 'Bellingham', 'Saka', 'Foden', 'Rice', 'Palmer', 'Gordon', 'Trippier', 'Stones', 'Pickford', 'Shaw', 'Konsa', 'Gallagher', 'Bowen', 'Rashford'],
    stars: ['Harry Kane', 'Jude Bellingham', 'Bukayo Saka', 'Phil Foden', 'Declan Rice', 'Cole Palmer', 'Virgil van Dijk', 'Frenkie de Jong', 'Memphis Depay', 'Cody Gakpo'],
  },
  africa: {
    first: ['Sadio', 'Mohamed', 'Victor', 'André', 'Achraf', 'Riyad', 'Nicolas', 'Wilfried', 'Edouard', 'Kalidou', 'Yves', 'Samuel', 'Kelechi', 'Ismaila', 'Franck'],
    last: ['Mané', 'Salah', 'Osimhen', 'Ayew', 'Hakimi', 'Mahrez', 'Pépé', 'Zaha', 'Mendy', 'Koulibaly', 'Bissouma', 'Chukwueze', 'Iheanacho', 'Sarr', 'Kessié'],
    stars: ['Sadio Mané', 'Mohamed Salah', 'Victor Osimhen', 'André Onana', 'Achraf Hakimi', 'Riyad Mahrez', 'Edouard Mendy', 'Kalidou Koulibaly'],
  },
  asia: {
    first: ['Take', 'Min', 'Hee', 'Sho', 'Wataru', 'Daichi', 'Ritsu', 'Takefusa', 'Hiroki', 'Kaoru', 'Ao', 'Yuki', 'Sei', 'Kento', 'Gaku'],
    last: ['Kubo', 'Minamino', 'Son', 'Endo', 'Kamada', 'Doan', 'Mitoma', 'Tanaka', 'Ito', 'Moriyasu', 'Tomiyasu', 'Soma', 'Muto', 'Nakamura', 'Haraguchi'],
    stars: ['Son Heung-min', 'Takefusa Kubo', 'Wataru Endo', 'Daichi Kamada', 'Kaoru Mitoma', 'Mehdi Taremi', 'Sardar Azmoun', 'Alireza Jahanbakhsh'],
  },
  concacaf: {
    first: ['Christian', 'Weston', 'Tyler', 'Gio', 'Tim', 'Matt', 'Antonee', 'Brenden', 'Ricardo', 'Sergiño', 'Folarin', 'Malik', 'Cade', 'Djordje', 'Zack'],
    last: ['Pulisic', 'McKennie', 'Adams', 'Reyna', 'Weah', 'Turner', 'Robinson', 'Aaronson', 'Pepi', 'Dest', 'Balogun', 'Tillman', 'Cowell', 'Mihailovic', 'Steffen'],
    stars: ['Christian Pulisic', 'Weston McKennie', 'Tyler Adams', 'Gio Reyna', 'Tim Weah', 'Folarin Balogun', 'Raúl Jiménez', 'Hirving Lozano'],
  },
  others: {
    first: ['James', 'Daniel', 'Oliver', 'William', 'Noah', 'Liam', 'Mason', 'Ethan', 'Alexander', 'Benjamin', 'Samuel', 'Ryan', 'Jack', 'Thomas', 'Leo'],
    last: ['Middleton', 'Gray', 'Brown', 'Davies', 'Wilson', 'Taylor', 'Walker', 'Hall', 'Green', 'Clark', 'Johnson', 'Edwards', 'Smith', 'Moore', 'Reed'],
    stars: ['Luka Modrić', 'Dominik Livaković', 'Joško Gvardiol', 'Marcelo Brozović', 'Mateo Kovačić', 'Andrej Kramarić', 'Ivan Perišić', 'Mislav Oršić'],
  },
};

const regionMap: Record<string, keyof typeof NAME_POOLS> = {
  bra: 'brasil', arg: 'argentina', uru: 'others', equ: 'others', col: 'others', par: 'others', ven: 'others',
  fra: 'uefa', ing: 'uefa', esp: 'uefa', por: 'uefa', ale: 'uefa', hol: 'uefa', ita: 'uefa',
  bel: 'uefa', sui: 'uefa', din: 'uefa', cro: 'others', srb: 'others', tur: 'others', sue: 'uefa', pol: 'others', ukr: 'others',
  eua: 'concacaf', mex: 'concacaf', can: 'concacaf', crc: 'others', pan: 'others', jam: 'others', hon: 'others',
  jap: 'asia', cor: 'asia', aus: 'asia', ira: 'asia', ars: 'asia', qat: 'asia', iraq: 'asia',
  sen: 'africa', mar: 'africa', nig: 'africa', egp: 'africa', cam: 'africa', gan: 'africa', tun: 'africa', alg: 'africa', cos: 'africa', mali: 'africa',
  nzl: 'others',
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateSquad(team: typeof TEAMS[number], teamIdx: number): Player[] {
  const region = regionMap[team.id] || 'others';
  const pool = NAME_POOLS[region];
  const players: Player[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < 12; i++) {
    const star = i < 2 || (i < 3 && region === 'brasil' || region === 'argentina');
    const rarity: string = star ? (i === 0 ? 'Ultra Rare' : 'Rare') : (i < 5 ? "Uncommon" : "Common");
    const pos = POSITIONS[i % POSITIONS.length];
    let name: string;

    if (star && i < pool.stars.length) {
      name = pool.stars[i];
    } else {
      const r = seededRandom(teamIdx * 100 + i);
      const fi = Math.floor(r * pool.first.length);
      const li = Math.floor(seededRandom(teamIdx * 100 + i + 50) * pool.last.length);
      name = `${pool.first[fi]} ${pool.last[li]}`;
    }

    const key = name + team.id;
    if (usedNames.has(key)) {
      name = name + ' Jr.';
    }
    usedNames.add(key);

    players.push({
      id: `${team.id}-${i}`,
      name,
      position: pos,
      teamName: team.name,
      flag: team.flag,
      rarity,
    });
  }
  return players;
}

const ALL_PLAYERS: Player[] = TEAMS.flatMap((team, i) => generateSquad(team, i));

function getRarityLevel(rarity: string): number {
  if (rarity === 'Ultra Rare') return 3;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 0) return 'border-slate-700';
  if (lvl === 1) return 'border-green-600 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
  if (lvl === 2) return 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
  if (lvl === 3) return 'border-purple-400 shadow-[0_0_22px_rgba(168,85,247,0.7)] shimmer-rainbow';
  return 'border-slate-700';
}

function getRarityLabel(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 0) return 'Comum';
  if (lvl === 1) return 'Incomum';
  if (lvl === 2) return 'Rara';
  if (lvl === 3) return 'Super Rara';
  return 'Comum';
}

const COMMON = ALL_PLAYERS.filter(p => p.rarity === 'Common');
const UNCOMMON = ALL_PLAYERS.filter(p => p.rarity === 'Uncommon');
const RARE = ALL_PLAYERS.filter(p => p.rarity === 'Rare' || p.rarity === 'Ultra Rare');

function generatePack(): PokemonCard[] {
  const pick = (arr: Player[]) => arr[Math.floor(Math.random() * arr.length)];
  const result: PokemonCard[] = [];
  for (let i = 0; i < 2; i++) { const p = pick(COMMON); result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 }); }
  for (let i = 0; i < 2; i++) { const p = pick(UNCOMMON); result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 }); }
  const p = pick(RARE); result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  return result;
}

export default function WorldCupAlbum({ balance, onUpdateBalance, collection, onCollectionUpdate, onSellCard, onSellAllDuplicates }: {
  balance: number; onUpdateBalance: (amount: number) => void; userId: string; collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void; onSellCard: (cardId: string, price: number) => void; onSellAllDuplicates: (prices: Record<string, number>) => void;
}) {
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const skipRef = useRef(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return; fetchedRef.current = true;
    const cache = sessionStorage.getItem('wcPlayerPhotos');
    if (cache) { try { setPhotos(JSON.parse(cache)); return; } catch {} }
    const results: Record<string, string> = {};
    let done = ALL_PLAYERS.length;
    for (const p of ALL_PLAYERS.slice(0, 30)) {
      done--;
      const name = encodeURIComponent(p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${name}`).then(r => r.json()).then(d => { if (d?.player?.[0]?.strThumb) results[p.id] = d.player[0].strThumb + '/preview'; }).catch(() => {}).finally(() => { if (done <= 0) { setPhotos({ ...results }); sessionStorage.setItem('wcPlayerPhotos', JSON.stringify(results)); } });
    }
  }, []);

  const getPlayerImage = (player: Player): string => {
    if (photos[player.id]) return photos[player.id];
    const colors = ['1e3a5f', '2d5a27', '5a2d2d', '2d3a5a', '4a2d5a', '5a4a2d', '2d5a4a', '5a2d3a'];
    const hash = player.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];
    const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=128&bold=true&font-size=0.4`;
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE) return;
    onUpdateBalance(-PACK_PRICE); setOpening(true); setPackResult([]); setRevealingIndex(-1); skipRef.current = false;
    const allCards = generatePack(); setPackResult(allCards);
    for (let i = 0; i < allCards.length; i++) {
      if (skipRef.current) break; await new Promise(r => setTimeout(r, 300)); setRevealingIndex(i);
    }
    if (!skipRef.current) onCollectionUpdate(allCards);
  };

  const handleSell = (cardId: string) => { const card = collection.find(c => c.id === cardId); if (card) onSellCard(cardId, getBasePrice(card.rarity)); };
  const handleSellAll = () => { const prices: Record<string, number> = {}; for (const c of collection) if (c.quantity > 1) prices[c.id] = getBasePrice(c.rarity); onSellAllDuplicates(prices); };
  const getBasePrice = (r: string): number => { const l = getRarityLevel(r); return l === 0 ? 0.50 + Math.random() : l === 1 ? 1.5 + Math.random() * 3 : l === 2 ? 5 + Math.random() * 10 : l === 3 ? 15 + Math.random() * 35 : 1; };

  const totalPlayers = ALL_PLAYERS.length;
  const uniqueCount = collection.length;
  const progress = Math.round((uniqueCount / totalPlayers) * 100);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-900/20 via-[#0e1017] to-green-900/10 p-5 rounded-2xl border border-green-950/40 flex items-center gap-4">
        <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 text-green-400"><Medal className="w-6 h-6" /></div>
        <div className="flex-1">
          <h3 className="font-extrabold text-white text-base">🌍 Álbum Copa do Mundo 2026</h3>
          <p className="text-slate-400 text-xs">R$ {PACK_PRICE.toFixed(2)} o pacote • {totalPlayers} figurinhas • {TEAMS.length} seleções</p>
        </div>
        <button onClick={handleOpenPack} disabled={balance < PACK_PRICE} className={`bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-slate-950 font-bold px-5 py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Package className="w-4 h-4" /> Comprar (R$ {PACK_PRICE.toFixed(2)})
        </button>
      </div>

      <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400"><span className="text-green-400 font-bold">{uniqueCount}</span>/{totalPlayers} figurinhas • {TEAMS.length} seleções</p>
          <p className="text-xs font-bold text-green-400">{progress}%</p>
        </div>
        <div className="h-2 bg-[#07080f] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {uniqueCount > 0 && uniqueCount < totalPlayers && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">Continue comprando pacotes para completar o álbum!</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-green-400" /> Sua coleção</p>
        {collection.some(c => c.quantity > 1) && <button onClick={handleSellAll} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer">Vender Repetidas</button>}
      </div>

      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="text-center max-w-lg w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-green-400 font-extrabold text-lg mb-2">🎴 Pacote de Figurinhas</motion.h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-slate-500 text-xs">{revealingIndex + 1} de {packResult.length} figurinhas</p>
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); onCollectionUpdate(packResult); setTimeout(() => setOpening(false), 800); }} className="text-[10px] text-green-400/60 hover:text-green-400 font-bold uppercase tracking-wider transition-colors cursor-pointer">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 justify-items-center">
                {packResult.map((card, idx) => {
                  const player = ALL_PLAYERS.find(p => p.id === card.id);
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  return (
                    <motion.div key={idx} initial={{ rotateY: 180, opacity: 0, scale: 0.3 }} animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}} transition={{ type: 'spring', stiffness: 180, damping: 18 }} className={`bg-[#1a1c2a] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} shadow-lg ${isRare ? 'relative' : ''}`}>
                      {isRare && <div className="absolute -top-1 -right-1 z-10"><Star className={`w-4 h-4 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-amber-400'}`} fill="currentColor" /></div>}
                      <div className="bg-[#07080f] p-3 flex items-center justify-center w-full aspect-[3/4]">
                        {player && <img src={getPlayerImage(player)} alt={card.name} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${card.name.split(' ').map(w => w[0]).join('')}&background=1e3a5f&color=fff&size=128`; }} />}
                      </div>
                      {idx <= revealingIndex && <div className="p-2 text-center"><p className="text-[9px] font-bold text-slate-200 truncate">{card.name}</p><p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p></div>}
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
          <p className="text-slate-400 text-sm font-bold">Nenhuma figurinha ainda</p>
          <p className="text-slate-500 text-xs mt-1">Compre pacotes para montar seu álbum e completar as {totalPlayers} figurinhas de {TEAMS.length} seleções!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {TEAMS.map(team => {
            const teamPlayers = ALL_PLAYERS.filter(p => p.teamName === team.name);
            const owned = teamPlayers.filter(p => collection.some(c => c.id === p.id));
            const ownedCount = owned.length;
            return (
              <div key={team.id} className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between bg-[#07080f] border-b border-[#1a1c2a]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{team.flag}</span>
                    <span className="text-xs font-bold text-slate-200">{team.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{ownedCount}/{teamPlayers.length}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 p-3">
                  {teamPlayers.map(player => {
                    const sticker = collection.find(c => c.id === player.id);
                    const isRare = getRarityLevel(player.rarity) >= 2;
                    return (
                      <div key={player.id} className={`bg-[#07080f] rounded-lg border overflow-hidden transition-all group relative ${sticker ? (isRare ? getRarityBorder(player.rarity) : 'border-green-600/30') : 'border-[#1a1c2a] opacity-40'}`}>
                        <div className="p-1.5 flex items-center justify-center aspect-[3/4]">
                          {sticker ? (
                            <img src={getPlayerImage(player)} alt={player.name} className="w-full h-full object-contain" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${player.name.split(' ').map(w => w[0]).join('')}&background=1e3a5f&color=fff&size=128`; }} />
                          ) : (
                            <div className="flex flex-col items-center gap-0.5"><span className="text-lg">{player.flag}</span><span className="text-[6px] text-slate-600 text-center leading-tight">???</span></div>
                          )}
                        </div>
                        <div className="p-1 text-center">
                          <p className={`text-[7px] font-bold truncate ${sticker ? 'text-slate-200' : 'text-slate-600'}`}>{sticker ? player.name : '???'}</p>
                          {sticker && <p className={`text-[6px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(player.rarity)}</p>}
                          {sticker && sticker.quantity > 1 && <span className="text-[7px] text-slate-500">×{sticker.quantity}</span>}
                        </div>
                        {sticker && sticker.quantity > 1 && (
                          <button onClick={() => handleSell(sticker.id)} className="absolute top-0.5 right-0.5 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[6px] font-bold px-1 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100">R$ {getBasePrice(player.rarity).toFixed(2)}</button>
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
