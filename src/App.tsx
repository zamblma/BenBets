import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  ShieldCheck, 
  HelpCircle, 
  Wallet, 
  Play, 
  Percent, 
  Search, 
  Dribbble, 
  Activity, 
  Gamepad2, 
  Cpu, 
  Menu, 
  ChevronRight, 
  TrendingUp, 
  Check, 
  AlertTriangle,
  Flame,
  Award,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
import { Match, BetSelection, PlacedBet, Transaction, PokemonCard } from './types';
// Source data
import { INITIAL_MATCHES } from './data/mockMatches';
// Firebase
import { auth, db } from './firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getUserData, createUserData, updateBalance, addBet, updateBet, addTransaction, addPokemonCards, removePokemonCard } from './firebase/db';
// Subcomponents
import ApostasInfo from './components/ApostasInfo';
import PixModal from './components/PixModal';
import CrashGame from './components/CrashGame';
import SlotGame from './components/SlotGame';
import PokemonTCG from './components/PokemonTCG';
import WorldCupAlbum from './components/WorldCupAlbum';
import BetHistoryList from './components/BetHistoryList';
import AuthScreen from './components/AuthScreen';

export default function App() {
  // Firebase Auth
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  // Navigation & Category states
  const [selectedSport, setSelectedSport] = useState<string>('Cassino');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom modals/drawers
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isPixOpen, setIsPixOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active user data
  const [balance, setBalance] = useState<number>(20.00);
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [pokemonCollection, setPokemonCollection] = useState<PokemonCard[]>([]);
  const [showBonus, setShowBonus] = useState(false);
  const [userName, setUserName] = useState('');

  // Firebase auth listener + load user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const data = await getUserData(user.uid);
        if (data) {
          setBalance(data.balance);
          setPlacedBets(data.placedBets || []);
          setTransactions(data.transactions || []);
          setPokemonCollection(data.pokemonCollection || []);
          setUserName(data.displayName || '');
          if (data.transactions.length === 0 && data.balance === 20) {
            setShowBonus(true);
            setTimeout(() => setShowBonus(false), 4500);
          }
        }
      }
      setAuthLoading(false);
      setInitialDataLoaded(true);
    });
    return () => unsub();
  }, []);

  // Debounced sync to Firestore when state changes
  useEffect(() => {
    if (!firebaseUser || !initialDataLoaded) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await updateBalance(firebaseUser.uid, balance);
      } catch {}
    }, 500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [balance, firebaseUser, initialDataLoaded]);

  // Dynamic Live Matches State Feed
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);

  // Periodic score updates and minor odds drifting (Simulation of feed data)
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      setMatches((prevMatches) => 
        prevMatches.map((match) => {
          if (!match.isLive) return match;
          
          let hScore = match.scoreHome;
          let aScore = match.scoreAway;
          let elapsed = match.timeElapsed;
          const probability = Math.random();

          // Sport specific progress rules
          if (match.sport === 'Futebol') {
            if (probability < 0.1) {
              if (Math.random() > 0.5) {
                hScore = (hScore ?? 0) + 1;
              } else {
                aScore = (aScore ?? 0) + 1;
              }
            }
            if (elapsed) {
              const minutes = parseInt(elapsed.replace("'", ""));
              if (!isNaN(minutes)) {
                elapsed = minutes < 90 ? `${minutes + 1}'` : "90'";
              }
            }
          } else if (match.sport === 'Basquete') {
            if (probability < 0.5) {
              hScore = (hScore ?? 100) + Math.floor(Math.random() * 3) + 1;
              aScore = (aScore ?? 100) + Math.floor(Math.random() * 3) + 1;
            }
          } else if (match.sport === 'Tênis') {
            if (probability < 0.15) {
              // Drift games score within set
              elapsed = `Set 4 - G: ${Math.floor(Math.random() * 6)}-${Math.floor(Math.random() * 6)}`;
            }
          } else if (match.sport === 'E-Sports') {
            if (probability < 0.25) {
              if (Math.random() > 0.5) {
                hScore = (hScore ?? 0) + 1;
              } else {
                aScore = (aScore ?? 0) + 1;
              }
              // Reset CS match cap
              if ((hScore ?? 0) > 13 || (aScore ?? 0) > 13) {
                hScore = 0;
                aScore = 0;
              }
            }
          }

          // Random odds drift (fluctuations up/down 4%)
          const drift = () => 0.98 + Math.random() * 0.04;
          const newOdds = {
            home: parseFloat(Math.max(1.01, match.odds.home * drift()).toFixed(2)),
            draw: match.odds.draw ? parseFloat(Math.max(1.01, match.odds.draw * drift()).toFixed(2)) : undefined,
            away: parseFloat(Math.max(1.01, match.odds.away * drift()).toFixed(2))
          };

          return {
            ...match,
            scoreHome: hScore,
            scoreAway: aScore,
            timeElapsed: elapsed,
            odds: newOdds
          };
        })
      );
    }, 7500);

    return () => clearInterval(scoreInterval);
  }, []);

  // Periodic sports betting simulation settlement engine (Resolves a pending sports bet every 20 seconds)
  useEffect(() => {
    const settleInterval = setInterval(() => {
      setPlacedBets((prevBets) => {
        const pendingSportsIdx = prevBets.findIndex(b => b.status === 'pending' && b.type === 'sports');
        if (pendingSportsIdx === -1) return prevBets;

        const updated = [...prevBets];
        const bet = updated[pendingSportsIdx];
        const playerWon = Math.random() > 0.45; // 55% chance to win for playful satisfaction

        if (playerWon) {
          updated[pendingSportsIdx] = {
            ...bet,
            status: 'won',
          };
          setBalance((b) => b + bet.potentialPayout);
          if (firebaseUser) updateBet(firebaseUser.uid, bet.id, { status: 'won' }).catch(() => {});
        } else {
          updated[pendingSportsIdx] = {
            ...bet,
            status: 'lost'
          };
          if (firebaseUser) updateBet(firebaseUser.uid, bet.id, { status: 'lost' }).catch(() => {});
        }
        return updated;
      });
    }, 22000);

    return () => clearInterval(settleInterval);
  }, [firebaseUser]);

  // Handler to toggle selection in the slip
  const handleOddsClick = (match: Match, outcomeType: 'home' | 'draw' | 'away', oddsValue: number) => {
    let outcomeLabel = '';
    if (outcomeType === 'home') outcomeLabel = `${match.teamHome} (Vence)`;
    else if (outcomeType === 'away') outcomeLabel = `${match.teamAway} (Vence)`;
    else outcomeLabel = 'Empate';

    // Check if match already has selection
    const existingIndex = selections.findIndex(s => s.matchId === match.id);

    if (existingIndex !== -1) {
      const existingSelection = selections[existingIndex];
      // If same selection, remove it. If different, update odds.
      if (existingSelection.type === outcomeType) {
        setSelections(prev => prev.filter(s => s.matchId !== match.id));
      } else {
        setSelections(prev => prev.map(s => s.matchId === match.id ? {
          matchId: match.id,
          matchName: `${match.teamHome} x ${match.teamAway}`,
          type: outcomeType,
          selectionName: outcomeLabel,
          odds: oddsValue,
        } : s));
      }
    } else {
      // Add new selection
      const newSel: BetSelection = {
        matchId: match.id,
        matchName: `${match.teamHome} x ${match.teamAway}`,
        type: outcomeType,
        selectionName: outcomeLabel,
        odds: oddsValue,
      };
      setSelections(prev => [...prev, newSel]);
    }
  };

  const handleRemoveSelection = (matchId: string) => {
    setSelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleClearSelections = () => {
    setSelections([]);
  };

  const handleDepositSuccess = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  const handleWithdrawSuccess = (amount: number): boolean => {
    if (balance >= amount) {
      setBalance(prev => prev - amount);
      return true;
    }
    return false;
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    if (firebaseUser) addTransaction(firebaseUser.uid, newTx).catch(() => {});
  };

  const handleAddPlacedBet = (newBet: PlacedBet) => {
    setPlacedBets(prev => [newBet, ...prev]);
    if (firebaseUser) addBet(firebaseUser.uid, newBet).catch(() => {});
  };

  const handleSettleAction = (betId: string, status: 'won' | 'lost', payOut: number) => {
    setPlacedBets(prev => prev.map(b => b.id === betId ? { ...b, status, potentialPayout: payOut } : b));
    if (status === 'won' && payOut > 0) {
      setBalance(prev => prev + payOut);
    }
    if (firebaseUser) updateBet(firebaseUser.uid, betId, { status, potentialPayout: payOut }).catch(() => {});
  };

  const handlePokemonCollectionUpdate = (cards: PokemonCard[]) => {
    setPokemonCollection(prev => {
      const merged = [...prev];
      for (const newCard of cards) {
        const idx = merged.findIndex(c => c.id === newCard.id);
        if (idx >= 0) merged[idx].quantity += 1;
        else merged.push(newCard);
      }
      if (firebaseUser) addPokemonCards(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellPokemonCard = (cardId: string, price: number) => {
    setPokemonCollection(prev => prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0));
    setBalance(prev => prev + price);
    if (firebaseUser) removePokemonCard(firebaseUser.uid, cardId).catch(() => {});
  };

  const handleSellAllDuplicates = (prices: Record<string, number>) => {
    setPokemonCollection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = pokemonCollection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    setBalance(prev => prev + total);
    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const existing: PokemonCard[] = data.pokemonCollection || [];
        const updated = existing.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c);
        updateDoc(ref, { pokemonCollection: updated });
      }).catch(() => {});
    }
  };

  // Filtered Matches selector
  const filteredMatches = matches.filter(match => {
    const matchesSearch = 
      match.teamHome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teamAway.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.league.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedSport === 'Todos') {
      return matchesSearch;
    }
    return match.sport === selectedSport && matchesSearch;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#06070d] font-sans text-slate-100 flex flex-col justify-between">
      
      {/* 🇧🇷 NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0c0d14]/90 border-b border-[#1c1e2d] backdrop-blur-md px-4 py-3 md:px-8 lg:px-12">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Slogan */}
          <button onClick={() => { setSelectedSport('Cassino'); window.scrollTo({ top: 0, behavior: 'smooth' }); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 cursor-pointer text-left">
            <div className="bg-gradient-to-tr from-brand to-emerald-400 text-slate-950 p-2.5 rounded-xl font-black tracking-tighter text-sm font-display leading-none rotate-2 shadow-[0_0_15px_rgba(0,255,135,0.3)]">
              BB
            </div>
            <div>
              <h1 className="font-extrabold text-brand font-sans text-lg tracking-tight leading-none">
                BenBets
              </h1>
              <p className="text-[9px] text-slate-400 font-medium">Ambiente Demonstração Legal • Lei 14.790/2023</p>
            </div>
          </button>

          {/* User Account Controls */}
          <div className="flex items-center gap-4">
            
            {/* Mobile Hamburger */}
            <button 
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-2 border border-[#1c1e2d] text-slate-400 hover:text-brand rounded-xl hover:bg-[#161826] transition-colors cursor-pointer"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Balance Component */}
            <div className="bg-[#07080f] px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-[#1b1e2e] flex items-center gap-2.5">
              <div className="p-1 bg-brand/10 rounded-lg text-brand md:block hidden animate-pulse">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Minha Conta</span>
                <span className="font-mono text-brand font-extrabold text-sm md:text-base tracking-tight select-none">
                  R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button 
                onClick={() => setIsPixOpen(true)}
                className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg bg-brand/20 hover:bg-brand text-slate-950 font-black text-lg leading-none cursor-pointer transition-all hover:shadow-[0_0_10px_rgba(0,255,135,0.3)] shrink-0"
                title="Depositar / Sacar"
              >
                +
              </button>
            </div>

            {/* Logout */}
            {firebaseUser && (
              <button 
                onClick={() => signOut(auth)}
                className="p-2 border border-[#1c1e2d] text-slate-400 hover:text-rose-400 rounded-xl hover:bg-[#161826] transition-colors cursor-pointer block"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}

            {/* Regulation Manual */}
            <button 
              onClick={() => setIsInfoOpen(true)}
              className="p-2 border border-[#1c1e2d] text-slate-400 hover:text-brand rounded-xl hover:bg-[#161826] transition-colors cursor-pointer block"
              title="Ler Legislação das Bets"
            >
              <ShieldCheck className="w-5 h-5 text-brand" />
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#0c0d14] border-b border-[#1c1e2d] overflow-hidden"
          >
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {[
                { id: 'Cassino', label: 'Jogos de Cassino', icon: '🚀' },
                { id: 'Pokemon', label: 'Pokémon TCG', icon: '🃏' },
                { id: 'Copa', label: 'Copa do Mundo', icon: '🌍' },
                { id: 'Todos', label: 'Todos Esportes', icon: '⚽' },
                { id: 'Futebol', label: 'Futebol', icon: '⚽' },
                { id: 'Basquete', label: 'Basquete', icon: '🏀' },
                { id: 'Tênis', label: 'Tênis', icon: '🎾' },
                { id: 'E-Sports', label: 'E-Sports', icon: '🎮' }
              ].map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => { setSelectedSport(sport.id); setIsMobileMenuOpen(false); }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border leading-none ${
                    selectedSport === sport.id
                      ? 'bg-brand text-slate-950 border-brand shadow-[0_0_10px_rgba(0,255,135,0.2)]'
                      : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d] hover:bg-[#141624]'
                  }`}
                >
                  <span>{sport.icon}</span>
                  {sport.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Brazil Regulatory Header Notice */}
      <div className="bg-[#0b0c13] border-b border-[#1b1d2c]/60 py-2.5 px-4 text-xs text-center text-slate-300">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="bg-brand/10 border border-brand/20 text-brand px-2 py-0.5 rounded text-[10px] font-bold font-mono">COMPLIANCE NACIONAL</span>
          <p className="text-[11px] font-medium text-slate-300">
            Apostas operadas de acordo com as regras de Jogo Seguro. Domínio exclusivo <span className="font-bold text-brand">.bet.br</span> outorga SPA/MF.
          </p>
        </div>
      </div>

      {/* MAIN CONTAINER GRID */}
      <main className="max-w-[1600px] mx-auto px-4 py-6 md:px-8 lg:px-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 w-full">
        
        {/* LEFT COLUMN: FILTERS & MATCHES/CASINO SELECT (COLS-8) */}
        <section className="col-span-1 lg:col-span-8 space-y-6">
          
          {/* Main Visual Category Switchers */}
          <div className="flex border-b border-[#1a1c2a] overflow-x-auto gap-3 py-1 pb-2 md:pb-3 justify-start scrollbar-thin">
            {[
              { id: 'Cassino', label: 'Jogos de Cassino', icon: '🚀' },
              { id: 'Pokemon', label: 'Pokémon TCG', icon: '🃏' },
              { id: 'Copa', label: 'Copa do Mundo', icon: '🌍' },
              { id: 'Todos', label: 'Todos Esportes', icon: '⚽' },
              { id: 'Futebol', label: 'Futebol', icon: '⚽' },
              { id: 'Basquete', label: 'Basquete', icon: '🏀' },
              { id: 'Tênis', label: 'Tênis', icon: '🎾' },
              { id: 'E-Sports', label: 'E-Sports', icon: '🎮' }
            ].map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer flex items-center gap-2 border leading-none ${
                  selectedSport === sport.id
                    ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_15px_rgba(0,255,135,0.2)]'
                    : 'bg-[#0d0e16] hover:bg-[#141624] text-slate-300 border-[#1a1d2d]'
                }`}
              >
                <span>{sport.icon}</span>
                {sport.label}
              </button>
            ))}
          </div>

          {/* Sub Panels Based on Category */}
          {selectedSport === 'Cassino' ? (
            <div className="space-y-6">
              
              {/* Nested Intro Header */}
              <div className="bg-gradient-to-r from-[#161a2b]/40 via-[#0e1017] to-[#161a2b]/20 p-5 rounded-2xl border border-indigo-950/45 flex items-center gap-4">
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <Flame className="w-6 h-6 animate-pulse text-brand" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Arena de Cassino e Jogos Crash</h3>
                  <p className="text-slate-400 text-xs">Simulador regulado de geradores de números (RNG). Teste jogos de slots e crash de forma auditada.</p>
                </div>
              </div>
              <SlotGame balance={balance} onUpdateBalance={handleDepositSuccess} userId={firebaseUser?.uid || ''} />
              <CrashGame balance={balance} onUpdateBalance={handleDepositSuccess} userId={firebaseUser?.uid || ''} />
            </div>
          ) : selectedSport === 'Pokemon' ? (
            <div className="space-y-6">
              <PokemonTCG
                balance={balance}
                onUpdateBalance={handleDepositSuccess}
                userId={firebaseUser?.uid || ''}
                collection={pokemonCollection}
                onCollectionUpdate={handlePokemonCollectionUpdate}
                onSellCard={handleSellPokemonCard}
                onSellAllDuplicates={handleSellAllDuplicates}
              />
            </div>
          ) : selectedSport === 'Copa' ? (
            <WorldCupAlbum balance={balance} onUpdateBalance={handleDepositSuccess} />
          ) : (
            // SPORTS BOOK LIST DISPLAY
            <div className="space-y-4">
              
              {/* Search match input */}
              <div className="flex gap-2.5 items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar partida, time ou campeonato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Header Titles */}
              <div className="flex justify-between items-center px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand shrink-0 animate-pulse" />
                  Próximos Confrontos ({filteredMatches.length})
                </h2>
                <span className="text-[10px] text-slate-500 uppercase font-mono">FEED AO VIVO EM TEMPO REAL</span>
              </div>

              {/* Match Cards Feed Grid */}
              <div className="space-y-3.5">
                {filteredMatches.length === 0 ? (
                  <div className="bg-[#0d0e16] p-12 rounded-2xl border border-[#1a1c2a] text-center text-slate-500 text-xs">
                     Nenhuma partida encontrada para os critérios selecionados.
                  </div>
                ) : (
                  filteredMatches.map((match) => (
                    <div 
                      key={match.id}
                      className="bg-[#0b0c13]/90 border border-[#1b1e2e]/90 hover:border-[#2b2f47] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 shadow-lg"
                    >
                      {/* Left: League & Teams labels */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#171a29] text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded border border-[#23273e] font-mono uppercase">
                            {match.sport}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {match.league}
                          </span>
                          {match.isLive && (
                            <span className="bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded text-[8px] animate-pulse uppercase shrink-0">
                              Ao vivo
                            </span>
                          )}
                        </div>

                        {/* Teams Name and Live Score */}
                        <div className="flex items-center justify-between md:justify-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100 text-sm">{match.teamHome}</span>
                              {match.isLive && (
                                <span className="font-mono font-black text-rose-500 bg-[#07080f] px-1.5 py-0.5 rounded text-xs border border-rose-950/40">{match.scoreHome}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100 text-sm">{match.teamAway}</span>
                              {match.isLive && (
                                <span className="font-mono font-black text-rose-500 bg-[#07080f] px-1.5 py-0.5 rounded text-xs border border-rose-950/40">{match.scoreAway}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <span>{match.time}</span>
                          {match.isLive && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-rose-400 font-mono text-xs">{match.timeElapsed}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Interactive Odds Buttons */}
                      <div className="flex gap-2 md:self-center">
                        {/* 1 (Vence Home) */}
                        <button
                          onClick={() => handleOddsClick(match, 'home', match.odds.home)}
                          className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                            selections.some(s => s.matchId === match.id && s.type === 'home')
                              ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                              : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                          }`}
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-500">1</span>
                          <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.home.toFixed(2)}</span>
                          <span className="text-[8px] block opacity-50 font-sans tracking-wide">Casa</span>
                        </button>

                        {/* X (Draw Selection - Only if Draw Odds exist) */}
                        {match.odds.draw !== undefined && (
                          <button
                            onClick={() => handleOddsClick(match, 'draw', match.odds.draw!)}
                            className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                              selections.some(s => s.matchId === match.id && s.type === 'draw')
                                ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                                : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                            }`}
                          >
                            <span className="text-[9px] uppercase font-bold text-slate-500">X</span>
                            <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.draw.toFixed(2)}</span>
                            <span className="text-[8px] block opacity-50 font-sans tracking-wide">Empate</span>
                          </button>
                        )}

                        {/* 2 (Vence Away) */}
                        <button
                          onClick={() => handleOddsClick(match, 'away', match.odds.away)}
                          className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                            selections.some(s => s.matchId === match.id && s.type === 'away')
                              ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                              : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                          }`}
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-500">2</span>
                          <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.away.toFixed(2)}</span>
                          <span className="text-[8px] block opacity-50 font-sans tracking-wide">Fora</span>
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* Dynamic Promotion card */}
              <div className="bg-gradient-to-r from-brand/5 to-teal-950/10 p-5 border border-brand/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> Bônus Relâmpago Ativo
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Crie apostas acumuladas com mais de 2 seleções e ganhe acréscimo automático de até <span className="font-bold text-brand">+15% de retorno</span> sem custo adicional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('Flamengo');
                    setSelectedSport('Todos');
                  }}
                  className="bg-brand hover:bg-[#00e074] text-slate-950 font-black text-[10px] uppercase tracking-wider py-2.5 px-3.5 rounded-lg shrink-0 cursor-pointer shadow-md transition-all hover:scale-[1.02]"
                >
                  Ver Jogos Relevantes
                </button>
              </div>

            </div>
          )}

        </section>

        {/* RIGHT COLUMN: ACTIVE BET SLIP & PLACED HISTORY LEDGER */}
        <section className="col-span-1 lg:col-span-4 space-y-6">
          <BetHistoryList
            selections={selections}
            onRemoveSelection={handleRemoveSelection}
            onClearSelections={handleClearSelections}
            balance={balance}
            onUpdateBalance={handleDepositSuccess}
            placedBets={placedBets}
            onAddPlacedBet={handleAddPlacedBet}
            onSettleBet={handleSettleAction}
          />
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#0b0c13] border-t border-[#1b1e2e] text-slate-500 py-8 px-4 mt-12 text-center text-[11px] leading-relaxed">
        <div className="max-w-[1600px] mx-auto space-y-4">
          
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-slate-400 uppercase font-sans font-bold tracking-wider">
            <a href="#rules" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Regras de Jogo</a>
            <span>•</span>
            <a href="#compliance" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Tributação Federal</a>
            <span>•</span>
            <a href="#responsible" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Jogo Responsável 18+</a>
          </div>

          <p className="max-w-3xl mx-auto">
            Este simulador de apostas esportivas e jogos de cassino foi desenvolvido exclusivamente para fins de demonstração regulatória e prototipação de UI, de acordo com o arcabouço técnico brasileiro instituído pela Lei Federal nº 14.790/2023. As transações financeiras, depósitos e saques realizados nesta aplicação são fictícios e simulados localmente.
          </p>

          <div className="text-slate-600 flex justify-center items-center gap-3">
            <span>© {new Date().getFullYear()} BenBets. Todos os direitos reservados.</span>
            <span>•</span>
            <span className="border border-[#1f2334] px-1.5 py-0.2 rounded font-mono text-[9px]">CNPJ SIMULADO OK</span>
          </div>

        </div>
      </footer>

      {/* DYNAMIC TRANSITION SLIDING GUEST DRAWERS */}
      <AnimatePresence>
        {isInfoOpen && (
          <ApostasInfo isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPixOpen && (
          <PixModal 
            isOpen={isPixOpen} 
            onClose={() => setIsPixOpen(false)} 
            balance={balance}
            onDeposit={handleDepositSuccess}
            onWithdraw={handleWithdrawSuccess}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
          />
        )}
      </AnimatePresence>

      {/* Welcome Bonus Toast */}
      <AnimatePresence>
        {showBonus && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-brand/20 to-emerald-900/20 border border-brand/40 rounded-2xl px-6 py-4 shadow-[0_0_30px_rgba(0,255,135,0.15)] backdrop-blur-xl text-center max-w-sm w-[90%]"
          >
            <p className="text-brand font-extrabold text-lg">🎉 Bônus de Boas-Vindas!</p>
            <p className="text-slate-200 text-sm mt-1">
              {userName}, você recebeu <span className="text-brand font-bold">R$ 20,00</span> para começar a apostar!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
