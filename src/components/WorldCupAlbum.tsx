import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Package, Search, Loader2, Sparkles, BookOpen, ArrowLeft, Star, TrendingUp, DollarSign, Trash2, Medal, Shirt, Flag } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  teamId: string;
  teamName: string;
  imageUrl: string;
  rarity: string;
}

interface Team {
  id: string;
  name: string;
  group: string;
  flag: string;
  players: Player[];
}

type RarityLevel = 'Common' | 'Uncommon' | 'Rare' | 'Ultra Rare';

interface Collectible {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  setName: string;
  setSeries: string;
  quantity: number;
}

const PACK_PRICE = 5.90;
const PACK_SIZE = 5;

const TEAMS: Team[] = [
  {
    id: 'bra', name: 'Brasil', group: 'A', flag: '🇧🇷',
    players: [
      { id: 'bra-1', name: 'Vinicius Jr.', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'bra-2', name: 'Neymar', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'bra-3', name: 'Rodrygo', position: 'AT', rarity: 'Rare' },
      { id: 'bra-4', name: 'Raphinha', position: 'AT', rarity: 'Rare' },
      { id: 'bra-5', name: 'Endrick', position: 'AT', rarity: 'Uncommon' },
      { id: 'bra-6', name: 'Alisson', position: 'GOL', rarity: 'Rare' },
      { id: 'bra-7', name: 'Ederson', position: 'GOL', rarity: 'Uncommon' },
      { id: 'bra-8', name: 'Marquinhos', position: 'ZAG', rarity: 'Rare' },
      { id: 'bra-9', name: 'Gabriel Magalhães', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'bra-10', name: 'Danilo', position: 'LD', rarity: 'Common' },
      { id: 'bra-11', name: 'Guilherme Arana', position: 'LE', rarity: 'Common' },
      { id: 'bra-12', name: 'Casemiro', position: 'VOL', rarity: 'Rare' },
      { id: 'bra-13', name: 'Bruno Guimarães', position: 'VOL', rarity: 'Uncommon' },
      { id: 'bra-14', name: 'Paquetá', position: 'MEI', rarity: 'Uncommon' },
      { id: 'bra-15', name: 'Joelinton', position: 'VOL', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'bra', teamName: 'Brasil', imageUrl: '' }))
  },
  {
    id: 'arg', name: 'Argentina', group: 'B', flag: '🇦🇷',
    players: [
      { id: 'arg-1', name: 'Lionel Messi', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'arg-2', name: 'Julian Álvarez', position: 'AT', rarity: 'Rare' },
      { id: 'arg-3', name: 'Lautaro Martínez', position: 'AT', rarity: 'Rare' },
      { id: 'arg-4', name: 'Enzo Fernández', position: 'MEI', rarity: 'Rare' },
      { id: 'arg-5', name: 'Ángel Di María', position: 'AT', rarity: 'Rare' },
      { id: 'arg-6', name: 'Emiliano Martínez', position: 'GOL', rarity: 'Rare' },
      { id: 'arg-7', name: 'Rodrigo De Paul', position: 'MEI', rarity: 'Uncommon' },
      { id: 'arg-8', name: 'Alexis Mac Allister', position: 'MEI', rarity: 'Uncommon' },
      { id: 'arg-9', name: 'Cristian Romero', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'arg-10', name: 'Nicolás Otamendi', position: 'ZAG', rarity: 'Common' },
      { id: 'arg-11', name: 'Nahuel Molina', position: 'LD', rarity: 'Common' },
      { id: 'arg-12', name: 'Marcos Acuña', position: 'LE', rarity: 'Common' },
      { id: 'arg-13', name: 'Leandro Paredes', position: 'VOL', rarity: 'Common' },
      { id: 'arg-14', name: 'Giovani Lo Celso', position: 'MEI', rarity: 'Uncommon' },
      { id: 'arg-15', name: 'Paulo Dybala', position: 'AT', rarity: 'Rare' },
    ].map(p => ({ ...p, teamId: 'arg', teamName: 'Argentina', imageUrl: '' }))
  },
  {
    id: 'fra', name: 'França', group: 'C', flag: '🇫🇷',
    players: [
      { id: 'fra-1', name: 'Kylian Mbappé', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'fra-2', name: 'Antoine Griezmann', position: 'AT', rarity: 'Rare' },
      { id: 'fra-3', name: 'Ousmane Dembélé', position: 'AT', rarity: 'Rare' },
      { id: 'fra-4', name: 'Eduardo Camavinga', position: 'MEI', rarity: 'Rare' },
      { id: 'fra-5', name: 'Aurélien Tchouaméni', position: 'VOL', rarity: 'Uncommon' },
      { id: 'fra-6', name: 'Mike Maignan', position: 'GOL', rarity: 'Rare' },
      { id: 'fra-7', name: 'Dayot Upamecano', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'fra-8', name: 'Ibrahima Konaté', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'fra-9', name: 'Theo Hernández', position: 'LE', rarity: 'Rare' },
      { id: 'fra-10', name: 'Jules Koundé', position: 'LD', rarity: 'Uncommon' },
      { id: 'fra-11', name: 'Adrien Rabiot', position: 'VOL', rarity: 'Common' },
      { id: 'fra-12', name: 'Randal Kolo Muani', position: 'AT', rarity: 'Uncommon' },
      { id: 'fra-13', name: 'Marcus Thuram', position: 'AT', rarity: 'Common' },
      { id: 'fra-14', name: 'Lucas Hernandez', position: 'ZAG', rarity: 'Common' },
      { id: 'fra-15', name: 'Warren Zaïre-Emery', position: 'MEI', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'fra', teamName: 'França', imageUrl: '' }))
  },
  {
    id: 'ing', name: 'Inglaterra', group: 'D', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    players: [
      { id: 'ing-1', name: 'Harry Kane', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'ing-2', name: 'Jude Bellingham', position: 'MEI', rarity: 'Ultra Rare' },
      { id: 'ing-3', name: 'Bukayo Saka', position: 'AT', rarity: 'Rare' },
      { id: 'ing-4', name: 'Phil Foden', position: 'MEI', rarity: 'Rare' },
      { id: 'ing-5', name: 'Declan Rice', position: 'VOL', rarity: 'Rare' },
      { id: 'ing-6', name: 'Jordan Pickford', position: 'GOL', rarity: 'Uncommon' },
      { id: 'ing-7', name: 'John Stones', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'ing-8', name: 'Kyle Walker', position: 'LD', rarity: 'Uncommon' },
      { id: 'ing-9', name: 'Luke Shaw', position: 'LE', rarity: 'Common' },
      { id: 'ing-10', name: 'Harry Maguire', position: 'ZAG', rarity: 'Common' },
      { id: 'ing-11', name: 'Mason Mount', position: 'MEI', rarity: 'Common' },
      { id: 'ing-12', name: 'Marcus Rashford', position: 'AT', rarity: 'Rare' },
      { id: 'ing-13', name: 'Cole Palmer', position: 'MEI', rarity: 'Rare' },
      { id: 'ing-14', name: 'Kieran Trippier', position: 'LD', rarity: 'Common' },
      { id: 'ing-15', name: 'Conor Gallagher', position: 'VOL', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'ing', teamName: 'Inglaterra', imageUrl: '' }))
  },
  {
    id: 'esp', name: 'Espanha', group: 'E', flag: '🇪🇸',
    players: [
      { id: 'esp-1', name: 'Lamine Yamal', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'esp-2', name: 'Pedri', position: 'MEI', rarity: 'Rare' },
      { id: 'esp-3', name: 'Rodri', position: 'VOL', rarity: 'Ultra Rare' },
      { id: 'esp-4', name: 'Álvaro Morata', position: 'AT', rarity: 'Uncommon' },
      { id: 'esp-5', name: 'Dani Olmo', position: 'MEI', rarity: 'Rare' },
      { id: 'esp-6', name: 'Unai Simón', position: 'GOL', rarity: 'Uncommon' },
      { id: 'esp-7', name: 'Aymeric Laporte', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'esp-8', name: 'Pau Cubarsí', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'esp-9', name: 'Dani Carvajal', position: 'LD', rarity: 'Rare' },
      { id: 'esp-10', name: 'Jordi Alba', position: 'LE', rarity: 'Common' },
      { id: 'esp-11', name: 'Fabián Ruiz', position: 'MEI', rarity: 'Common' },
      { id: 'esp-12', name: 'Nico Williams', position: 'AT', rarity: 'Rare' },
      { id: 'esp-13', name: 'Mikel Merino', position: 'VOL', rarity: 'Common' },
      { id: 'esp-14', name: 'Ferran Torres', position: 'AT', rarity: 'Common' },
      { id: 'esp-15', name: 'Gavi', position: 'MEI', rarity: 'Rare' },
    ].map(p => ({ ...p, teamId: 'esp', teamName: 'Espanha', imageUrl: '' }))
  },
  {
    id: 'por', name: 'Portugal', group: 'F', flag: '🇵🇹',
    players: [
      { id: 'por-1', name: 'Cristiano Ronaldo', position: 'AT', rarity: 'Ultra Rare' },
      { id: 'por-2', name: 'Bruno Fernandes', position: 'MEI', rarity: 'Rare' },
      { id: 'por-3', name: 'Bernardo Silva', position: 'MEI', rarity: 'Rare' },
      { id: 'por-4', name: 'Rúben Dias', position: 'ZAG', rarity: 'Rare' },
      { id: 'por-5', name: 'Rafael Leão', position: 'AT', rarity: 'Rare' },
      { id: 'por-6', name: 'Diogo Costa', position: 'GOL', rarity: 'Rare' },
      { id: 'por-7', name: 'João Cancelo', position: 'LD', rarity: 'Uncommon' },
      { id: 'por-8', name: 'Vitinha', position: 'MEI', rarity: 'Uncommon' },
      { id: 'por-9', name: 'Nuno Mendes', position: 'LE', rarity: 'Uncommon' },
      { id: 'por-10', name: 'João Palhinha', position: 'VOL', rarity: 'Uncommon' },
      { id: 'por-11', name: 'João Félix', position: 'AT', rarity: 'Common' },
      { id: 'por-12', name: 'Gonçalo Ramos', position: 'AT', rarity: 'Common' },
      { id: 'por-13', name: 'Diogo Dalot', position: 'LD', rarity: 'Common' },
      { id: 'por-14', name: 'Matheus Nunes', position: 'MEI', rarity: 'Common' },
      { id: 'por-15', name: 'António Silva', position: 'ZAG', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'por', teamName: 'Portugal', imageUrl: '' }))
  },
  {
    id: 'ale', name: 'Alemanha', group: 'G', flag: '🇩🇪',
    players: [
      { id: 'ale-1', name: 'Florian Wirtz', position: 'MEI', rarity: 'Ultra Rare' },
      { id: 'ale-2', name: 'Jamal Musiala', position: 'MEI', rarity: 'Ultra Rare' },
      { id: 'ale-3', name: 'İlkay Gündoğan', position: 'MEI', rarity: 'Rare' },
      { id: 'ale-4', name: 'Kai Havertz', position: 'AT', rarity: 'Rare' },
      { id: 'ale-5', name: 'Joshua Kimmich', position: 'VOL', rarity: 'Rare' },
      { id: 'ale-6', name: 'Marc-André ter Stegen', position: 'GOL', rarity: 'Rare' },
      { id: 'ale-7', name: 'Antonio Rüdiger', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'ale-8', name: 'Jonathan Tah', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'ale-9', name: 'David Raum', position: 'LE', rarity: 'Common' },
      { id: 'ale-10', name: 'Niklas Süle', position: 'ZAG', rarity: 'Common' },
      { id: 'ale-11', name: 'Leroy Sané', position: 'AT', rarity: 'Rare' },
      { id: 'ale-12', name: 'Niclas Füllkrug', position: 'AT', rarity: 'Uncommon' },
      { id: 'ale-13', name: 'Pascal Groß', position: 'VOL', rarity: 'Common' },
      { id: 'ale-14', name: 'Chris Führich', position: 'AT', rarity: 'Common' },
      { id: 'ale-15', name: 'Benjamin Henrichs', position: 'LD', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'ale', teamName: 'Alemanha', imageUrl: '' }))
  },
  {
    id: 'hol', name: 'Holanda', group: 'H', flag: '🇳🇱',
    players: [
      { id: 'hol-1', name: 'Virgil van Dijk', position: 'ZAG', rarity: 'Ultra Rare' },
      { id: 'hol-2', name: 'Frenkie de Jong', position: 'MEI', rarity: 'Rare' },
      { id: 'hol-3', name: 'Memphis Depay', position: 'AT', rarity: 'Rare' },
      { id: 'hol-4', name: 'Cody Gakpo', position: 'AT', rarity: 'Rare' },
      { id: 'hol-5', name: 'Xavi Simons', position: 'MEI', rarity: 'Rare' },
      { id: 'hol-6', name: 'Bart Verbruggen', position: 'GOL', rarity: 'Uncommon' },
      { id: 'hol-7', name: 'Matthijs de Ligt', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'hol-8', name: 'Nathan Aké', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'hol-9', name: 'Denzel Dumfries', position: 'LD', rarity: 'Uncommon' },
      { id: 'hol-10', name: 'Daley Blind', position: 'LE', rarity: 'Common' },
      { id: 'hol-11', name: 'Tijani Reijnders', position: 'MEI', rarity: 'Common' },
      { id: 'hol-12', name: 'Joey Veerman', position: 'MEI', rarity: 'Common' },
      { id: 'hol-13', name: 'Wout Weghorst', position: 'AT', rarity: 'Common' },
      { id: 'hol-14', name: 'Jeremie Frimpong', position: 'LD', rarity: 'Uncommon' },
      { id: 'hol-15', name: 'Micky van der Ven', position: 'ZAG', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'hol', teamName: 'Holanda', imageUrl: '' }))
  },
  {
    id: 'ita', name: 'Itália', group: 'I', flag: '🇮🇹',
    players: [
      { id: 'ita-1', name: 'Federico Chiesa', position: 'AT', rarity: 'Rare' },
      { id: 'ita-2', name: 'Gianluigi Donnarumma', position: 'GOL', rarity: 'Ultra Rare' },
      { id: 'ita-3', name: "Nicolò Barella", position: 'MEI', rarity: 'Rare' },
      { id: 'ita-4', name: 'Alessandro Bastoni', position: 'ZAG', rarity: 'Rare' },
      { id: 'ita-5', name: 'Lorenzo Insigne', position: 'AT', rarity: 'Uncommon' },
      { id: 'ita-6', name: "Giovanni Di Lorenzo", position: 'LD', rarity: 'Uncommon' },
      { id: 'ita-7', name: 'Francesco Acerbi', position: 'ZAG', rarity: 'Common' },
      { id: 'ita-8', name: 'Jorginho', position: 'VOL', rarity: 'Uncommon' },
      { id: 'ita-9', name: 'Sandro Tonali', position: 'VOL', rarity: 'Rare' },
      { id: 'ita-10', name: 'Giacomo Raspadori', position: 'AT', rarity: 'Common' },
      { id: 'ita-11', name: 'Federico Dimarco', position: 'LE', rarity: 'Uncommon' },
      { id: 'ita-12', name: 'Nicolò Zaniolo', position: 'MEI', rarity: 'Common' },
      { id: 'ita-13', name: 'Ciro Immobile', position: 'AT', rarity: 'Common' },
      { id: 'ita-14', name: 'Manuel Locatelli', position: 'VOL', rarity: 'Common' },
      { id: 'ita-15', name: 'Giorgio Scalvini', position: 'ZAG', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'ita', teamName: 'Itália', imageUrl: '' }))
  },
  {
    id: 'uru', name: 'Uruguai', group: 'J', flag: '🇺🇾',
    players: [
      { id: 'uru-1', name: 'Federico Valverde', position: 'MEI', rarity: 'Ultra Rare' },
      { id: 'uru-2', name: 'Darwin Núñez', position: 'AT', rarity: 'Rare' },
      { id: 'uru-3', name: 'Ronald Araújo', position: 'ZAG', rarity: 'Rare' },
      { id: 'uru-4', name: 'Rodrigo Bentancur', position: 'VOL', rarity: 'Uncommon' },
      { id: 'uru-5', name: 'Facundo Pellistri', position: 'AT', rarity: 'Uncommon' },
      { id: 'uru-6', name: 'Sergio Rochet', position: 'GOL', rarity: 'Common' },
      { id: 'uru-7', name: 'José María Giménez', position: 'ZAG', rarity: 'Uncommon' },
      { id: 'uru-8', name: 'Matías Vecino', position: 'VOL', rarity: 'Common' },
      { id: 'uru-9', name: 'Giorgian de Arrascaeta', position: 'MEI', rarity: 'Rare' },
      { id: 'uru-10', name: 'Maximiliano Gómez', position: 'AT', rarity: 'Common' },
      { id: 'uru-11', name: 'Federico Viñas', position: 'AT', rarity: 'Common' },
      { id: 'uru-12', name: 'Mathías Olivera', position: 'LE', rarity: 'Common' },
    ].map(p => ({ ...p, teamId: 'uru', teamName: 'Uruguai', imageUrl: '' }))
  },
];

const PLAYERS_BY_TEAM = Object.fromEntries(TEAMS.map(t => [t.id, t.players]));

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

function generatePlayerImage(name: string): string {
  const colors = ['1e3a5f', '2d5a27', '5a2d2d', '2d3a5a', '4a2d5a', '5a4a2d', '2d5a4a', '5a2d3a'];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=128&bold=true&font-size=0.4`;
}

function generatePack(team: Team): Collectible[] {
  const pool = team.players;
  const result: Collectible[] = [];

  const common = pool.filter(p => p.rarity === 'Common');
  const uncommon = pool.filter(p => p.rarity === 'Uncommon');
  const rare = pool.filter(p => p.rarity === 'Rare' || p.rarity === 'Ultra Rare');

  const pick = (arr: typeof pool) => arr[Math.floor(Math.random() * arr.length)];

  for (let i = 0; i < 2; i++) {
    const p = common.length > 0 ? pick(common) : pick(pool);
    result.push({ id: p.id, name: p.name, imageUrl: generatePlayerImage(p.name), rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  }
  for (let i = 0; i < 2; i++) {
    const p = uncommon.length > 0 ? pick(uncommon) : pick(pool);
    result.push({ id: p.id, name: p.name, imageUrl: generatePlayerImage(p.name), rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  }
  const p = rare.length > 0 ? pick(rare) : pick(pool);
  result.push({ id: p.id, name: p.name, imageUrl: generatePlayerImage(p.name), rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });

  return result;
}

const POSITION_LABELS: Record<string, string> = {
  GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral D', LE: 'Lateral E',
  VOL: 'Volante', MEI: 'Meia', AT: 'Atacante'
};

export default function WorldCupAlbum({ balance, onUpdateBalance }: { balance: number; onUpdateBalance: (amount: number) => void }) {
  const [view, setView] = useState<'teams' | 'collection'>('teams');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [packResult, setPackResult] = useState<Collectible[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [collection, setCollection] = useState<Collectible[]>(() => {
    try { return JSON.parse(localStorage.getItem('wcCollection') || '[]'); } catch { return []; }
  });
  const skipRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('wcCollection', JSON.stringify(collection));
  }, [collection]);

  const handleOpenPack = async () => {
    if (!selectedTeam) return;
    if (balance < PACK_PRICE) return;
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;

    const allCards = generatePack(selectedTeam);

    setPackResult(allCards);

    for (let i = 0; i < allCards.length; i++) {
      if (skipRef.current) break;
      await new Promise(r => setTimeout(r, 300));
      setRevealingIndex(i);
    }

    if (!skipRef.current) {
      setCollection(prev => {
        const merged = [...prev];
        for (const c of allCards) {
          const idx = merged.findIndex(x => x.id === c.id);
          if (idx >= 0) merged[idx].quantity += 1;
          else merged.push(c);
        }
        return merged;
      });
    }
  };

  const handleSellCard = (cardId: string) => {
    setCollection(prev => {
      const p = prev.find(c => c.id === cardId);
      if (!p) return prev;
      const price = getBasePrice(p.rarity);
      onUpdateBalance(price);
      return prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
    });
  };

  const handleSellAllDuplicates = () => {
    let total = 0;
    setCollection(prev => {
      let newColl = [...prev];
      for (const c of newColl) {
        if (c.quantity > 1) {
          const extras = c.quantity - 1;
          total += getBasePrice(c.rarity) * extras;
          c.quantity = 1;
        }
      }
      onUpdateBalance(total);
      return newColl;
    });
  };

  const getBasePrice = (rarity: string): number => {
    const lvl = getRarityLevel(rarity);
    if (lvl === 0) return 0.50 + Math.random();
    if (lvl === 1) return 1.50 + Math.random() * 3;
    if (lvl === 2) return 5 + Math.random() * 10;
    if (lvl === 3) return 15 + Math.random() * 35;
    return 1;
  };

  const filteredTeams = TEAMS.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-900/20 via-[#0e1017] to-green-900/10 p-5 rounded-2xl border border-green-950/40 flex items-center gap-4">
        <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 text-green-400">
          <Medal className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-white text-base">🌍 Álbum Copa do Mundo 2026</h3>
          <p className="text-slate-400 text-xs">R$ {PACK_PRICE.toFixed(2)} o pacote • Monte seu álbum de figurinhas virtuais</p>
        </div>
      </div>

      <div className="flex border-b border-[#1a1c2a] bg-[#0d0e16] rounded-xl p-1">
        <button onClick={() => { setView('teams'); setSelectedTeam(null); setPackResult([]); }} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'teams' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <Flag className="w-4 h-4" /> Times
        </button>
        <button onClick={() => setView('collection')} className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${view === 'collection' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          <BookOpen className="w-4 h-4" /> Álbum ({collection.length})
        </button>
      </div>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="text-center max-w-lg w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-green-400 font-extrabold text-lg mb-2">
                🎴 Pacote — {selectedTeam?.flag} {selectedTeam?.name}
              </motion.h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-slate-500 text-xs">{revealingIndex + 1} de {packResult.length} figurinhas</p>
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); setCollection(prev => { const merged = [...prev]; for (const c of packResult) { const idx = merged.findIndex(x => x.id === c.id); if (idx >= 0) merged[idx].quantity += 1; else merged.push(c); } return merged; }); setTimeout(() => setOpening(false), 800); }} className="text-[10px] text-green-400/60 hover:text-green-400 font-bold uppercase tracking-wider transition-colors cursor-pointer">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 justify-items-center">
                {packResult.map((card, idx) => {
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ rotateY: 180, opacity: 0, scale: 0.3 }}
                      animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}}
                      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                      className={`bg-[#1a1c2a] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} shadow-lg ${isRare ? 'relative' : ''}`}
                    >
                      {isRare && (
                        <div className="absolute -top-1 -right-1 z-10">
                          <Star className={`w-4 h-4 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-amber-400'}`} fill="currentColor" />
                        </div>
                      )}
                      <div className="bg-[#07080f] p-3 flex items-center justify-center w-full aspect-[3/4]">
                        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-contain" />
                      </div>
                      {(idx <= revealingIndex) && (
                        <div className="p-2 text-center">
                          <p className="text-[9px] font-bold text-slate-200 truncate">{card.name}</p>
                          <p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
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

      {/* TEAMS GRID */}
      {view === 'teams' && !selectedTeam && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar time ou grupo..." className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-white">✕</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredTeams.map(team => (
              <button key={team.id} onClick={() => { setSelectedTeam(team); setPackResult([]); }} className="bg-[#0d0e16] border border-[#1a1c2a] hover:border-green-500/30 rounded-xl p-4 text-left transition-all cursor-pointer group">
                <div className="text-4xl mb-2">{team.flag}</div>
                <p className="text-xs font-bold text-slate-200 group-hover:text-green-400 transition-colors">{team.name}</p>
                <p className="text-[9px] text-slate-500">Grupo {team.group} • {team.players.length} jogadores</p>
                <div className="mt-2 bg-green-500/10 text-green-400 text-[9px] font-bold py-1 rounded text-center">R$ {PACK_PRICE.toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TEAM DETAIL */}
      {view === 'teams' && selectedTeam && !opening && (
        <div className="space-y-4">
          <button onClick={() => { setSelectedTeam(null); setPackResult([]); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para times
          </button>

          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-5xl">{selectedTeam.flag}</div>
            <div className="flex-1">
              <h3 className="font-extrabold text-white text-base">{selectedTeam.name}</h3>
              <p className="text-xs text-slate-400">Grupo {selectedTeam.group} • {selectedTeam.players.length} jogadores</p>
              <div className="flex items-center gap-2 text-xs mt-2">
                <span className="text-slate-500">Saldo:</span>
                <span className="font-mono font-bold text-green-400">R$ {balance.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleOpenPack}
              disabled={balance < PACK_PRICE}
              className={`bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-slate-950 font-bold px-5 py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Package className="w-4 h-4" /> Comprar Pacote (R$ {PACK_PRICE.toFixed(2)})
            </button>
          </div>

          <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Jogadores</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {selectedTeam.players.map(p => {
                const isOwned = collection.some(c => c.id === p.id);
                const qty = collection.find(c => c.id === p.id)?.quantity || 0;
                return (
                  <div key={p.id} className={`bg-[#07080f] rounded-xl p-2 text-center border ${isOwned ? 'border-green-600/40' : 'border-[#1a1c2a] opacity-50'}`}>
                    <div className="bg-[#0d0e16] rounded-lg p-2 mb-1 flex items-center justify-center aspect-square">
                      <img src={generatePlayerImage(p.name)} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                    </div>
                    <p className="text-[8px] font-bold text-slate-200 truncate">{p.name}</p>
                    <div className="flex items-center justify-center gap-1">
                      <Shirt className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-[7px] text-slate-500">{POSITION_LABELS[p.position] || p.position}</span>
                    </div>
                    {isOwned && <span className="text-[8px] text-green-400 font-bold">×{qty}</span>}
                    {!isOwned && <span className="text-[8px] text-slate-600">—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ALBUM COLLECTION */}
      {view === 'collection' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400"><span className="text-green-400 font-bold">{collection.length}</span> figurinhas únicas</p>
            {collection.some(c => c.quantity > 1) && (
              <button onClick={handleSellAllDuplicates} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer">
                Vender Repetidas
              </button>
            )}
          </div>
          {collection.length === 0 ? (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma figurinha ainda</p>
              <p className="text-slate-500 text-xs mt-1">Compre pacotes para montar seu álbum!</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {collection.map(card => {
                const isRare = getRarityLevel(card.rarity) >= 2;
                const border = getRarityBorder(card.rarity);
                return (
                  <div key={card.id} className={`bg-[#0d0e16] rounded-xl overflow-hidden border-2 ${border} transition-all group relative`}>
                    <div className="bg-[#07080f] p-2 flex items-center justify-center aspect-[3/4]">
                      <img src={card.imageUrl} alt={card.name} className="w-full h-full object-contain" loading="lazy" />
                    </div>
                    <div className="p-2 text-center">
                      <p className="text-[9px] font-bold text-slate-200 truncate">{card.name}</p>
                      <p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
                      {card.quantity > 1 && <span className="text-[8px] text-slate-500">×{card.quantity}</span>}
                    </div>
                    {card.quantity > 1 && (
                      <button
                        onClick={() => handleSellCard(card.id)}
                        className="absolute top-1 right-1 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        R$ {getBasePrice(card.rarity).toFixed(2)}
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
