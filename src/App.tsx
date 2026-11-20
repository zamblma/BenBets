import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  ShieldCheck, 
  Shield,
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
  LogOut,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
import { Match, BetSelection, PlacedBet, Transaction, PokemonCard } from './types';
// Source data
import { INITIAL_MATCHES } from './data/mockMatches';
import { fetchBrazilianFootballMatches } from './utils/brazilianFootballApi';
import { fetchRealHockeyMatches, computeLiveOddsFromScore, parseMatchProgress } from './utils/hockeyApi';
// Firebase
import { auth, db } from './firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MUDAE_SEASON_VERSION, getUserData, createUserData, updateBalance, addBet, updateBet, addTransaction, addPokemonCards, removePokemonCard, addWorldCupStickers, removeWorldCupSticker, setWorldCupCollection, addKpopCards, removeKpopCard, addCS2Cards, removeCS2Card, addAnimeCards, removeAnimeCard, setAnimeCollection, getMissions, claimMissionReward, DAILY_MISSIONS, subscribeToLeaderboard, updateUserPresence, markUserOffline, sanitizePlacedBets, recoverValidBalance } from './firebase/db';
import type { MissionProgress, LeaderboardEntry } from './firebase/db';
// Subcomponents
import ApostasInfo from './components/ApostasInfo';
import PixModal from './components/PixModal';
import CrashGame from './components/CrashGame';
import BlackjackGame from './components/BlackjackGame';
import RouletteGame from './components/RouletteGame';
import DiceGame from './components/DiceGame';
import FortuneTiger from './components/FortuneTiger';
import MinesGame from './components/MinesGame';
import PlinkoGame from './components/PlinkoGame';
import DoubleGame from './components/DoubleGame';
import PenaltyGame from './components/PenaltyGame';
import BasketballGame from './components/BasketballGame';
import LoLChests from './components/LoLChests';
import AnimeGacha from './components/AnimeGacha';
import PokemonTCG from './components/PokemonTCG';
import WorldCupAlbum from './components/WorldCupAlbum';
import KpopPhotocards from './components/KpopPhotocards';
import CS2Cases from './components/CS2Cases';
import BetHistoryList from './components/BetHistoryList';
import AuthScreen from './components/AuthScreen';
import HomeMenu from './components/HomeMenu';
import AdminPanel from './components/AdminPanel';
import DailyMissions from './components/DailyMissions';
import OmnitrixLogo from './components/OmnitrixLogo';
import Leaderboard from './components/Leaderboard';
import { useSound } from './hooks/useSound';

function TeamCrest({ name, badge, color, logo }: { name: string; badge: string; color: string; logo?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (logo && !imgFailed) {
    return (
      <img
        src={logo}
        alt={name}
        onError={() => setImgFailed(true)}
        className="w-6 h-6 object-contain rounded-md bg-white/5 p-0.5 border border-white/10 shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="w-7 h-6 rounded-lg bg-[#070910] text-[9px] font-mono font-black flex items-center justify-center shrink-0 border"
      style={{ borderColor: `${color}66`, color }}
    >
      {badge}
    </span>
  );
}

export default function App() {
  const { muted, toggleMute } = useSound();
  // Firebase Auth
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  // Navigation & Category states
  const [selectedSport, setSelectedSport] = useState<string>('Home');
  const [sportFilter, setSportFilter] = useState<string>('todas');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('todas');
  const [selectedCasinoGame, setSelectedCasinoGame] = useState<string | null>(null);
  const [casinoCategory, setCasinoCategory] = useState<'all' | 'originals' | 'slots' | 'table'>('all');
  const [selectedColecionavel, setSelectedColecionavel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuickBet, setActiveQuickBet] = useState<{ matchId: string; type: 'home' | 'draw' | 'away' } | null>(null);
  const [quickBetStake, setQuickBetStake] = useState<string>('20');
  const [quickBetFeedback, setQuickBetFeedback] = useState<{ matchId: string; text: string } | null>(null);
  const settledBetIdsRef = useRef<Set<string>>(new Set());
  
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
  const [worldCupCollection, setWorldCupCollection] = useState<PokemonCard[]>([]);
  const [kpopCollection, setKpopCollection] = useState<PokemonCard[]>([]);
  const [cs2Collection, setCs2Collection] = useState<PokemonCard[]>([]);
  const [animeCollection, setAnimeCollection] = useState<PokemonCard[]>([]);
  const [showBonus, setShowBonus] = useState(false);
  const [userName, setUserName] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [missionsRecord, setMissionsRecord] = useState<Record<string, MissionProgress>>({});
  const [leaderboardRaw, setLeaderboardRaw] = useState<LeaderboardEntry[]>(() => {
    try {
      const cached = localStorage.getItem('benbets_leaderboard_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardPermissionError, setLeaderboardPermissionError] = useState(false);

  // Cache local do usuário (backup quando o Firestore estiver indisponível)
  const [loadError, setLoadError] = useState('');

  // Firebase auth listener + load user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setInitialDataLoaded(false);
        setAuthLoading(false);
        return;
      }

      const applyData = (d: any) => {
        const { bets: cleanBets } = sanitizePlacedBets(d?.placedBets);
        const { balance: safeBalance } = recoverValidBalance(d, cleanBets);
        setBalance(safeBalance);
        setPlacedBets(cleanBets);
        const txs = Array.isArray(d?.transactions) ? d.transactions : [];
        setTransactions(txs);
        setPokemonCollection(Array.isArray(d?.pokemonCollection) ? d.pokemonCollection : []);
        setWorldCupCollection(Array.isArray(d?.worldCupCollection) ? d.worldCupCollection : []);
        setKpopCollection(Array.isArray(d?.kpopCollection) ? d.kpopCollection : []);
        setCs2Collection(Array.isArray(d?.cs2Collection) ? d.cs2Collection : []);
        setAnimeCollection(Array.isArray(d?.animeCollection) ? d.animeCollection : []);
        setUserName(d?.displayName || '');
      };
      const saveLocal = (d: any) => {
        try { localStorage.setItem(`benbets_user_${user.uid}`, JSON.stringify(d)); } catch { /* quota cheia */ }
      };
      const loadLocal = (): any | null => {
        try {
          const raw = localStorage.getItem(`benbets_user_${user.uid}`);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (parsed && parsed.mudaeSeasonVersion !== MUDAE_SEASON_VERSION) {
            parsed.animeCollection = [];
            parsed.mudaeSeasonVersion = MUDAE_SEASON_VERSION;
          }
          return parsed;
        } catch { return null; }
      };

      let gotData = false;
      try {
        const data = await getUserData(user.uid);
        if (data) {
          let resolvedData = data;
          if (data.balanceRepaired) {
            const cached = loadLocal();
            if (
              cached &&
              typeof cached.balance === 'number' &&
              Number.isFinite(cached.balance) &&
              cached.balance > data.balance
            ) {
              resolvedData = { ...data, balance: cached.balance };
              updateBalance(user.uid, cached.balance).catch(() => {});
            }
          }
          applyData(resolvedData);
          saveLocal(resolvedData);
          gotData = true;
          const txs = Array.isArray(resolvedData.transactions) ? resolvedData.transactions : [];
          if (txs.length === 0 && resolvedData.balance === 20) {
            setShowBonus(true);
            setTimeout(() => setShowBonus(false), 4500);
          }
        } else {
          // Documento de usuário não existia no Firestore: cria automaticamente para sincronizar no ranking
          try {
            const fallbackName = user.displayName || user.email?.split('@')[0] || 'Agente';
            const newData = await createUserData(user.uid, user.email || '', fallbackName);
            applyData(newData);
            saveLocal(newData);
            gotData = true;
            setShowBonus(true);
            setTimeout(() => setShowBonus(false), 4500);
          } catch (createErr) {
            console.error('Falha ao auto-criar usuário no Firestore:', createErr);
            setBalance(20);
            gotData = false;
          }
        }
      } catch (err) {
        console.error('Falha ao carregar dados do usuário:', err);
        const cached = loadLocal();
        if (cached) {
          applyData(cached);
          gotData = true;
          console.warn('[BenBets] Firestore indisponível, usando cache local.');
        } else {
          setBalance(20);
          gotData = false;
          setLoadError('Não foi possível carregar seus dados do servidor. Verifique sua conexão ou faça login novamente.');
        }
      } finally {
        setAuthLoading(false);
        // Só libera o sync de escrita para o Firestore se temos dados reais
        // (nunca sobrescreve o banco com o padrão de R$ 20)
        setInitialDataLoaded(gotData);
      }
    });
    return () => unsub();
  }, []);

  const adjustBalanceSafe = useCallback((delta: number) => {
    if (typeof delta !== 'number' || !Number.isFinite(delta)) return;
    setBalance(prev => {
      const base = typeof prev === 'number' && Number.isFinite(prev) && prev >= 0 ? prev : 20;
      return Math.max(0, Number((base + delta).toFixed(2)));
    });
  }, []);

  // Debounced sync to Firestore when state changes
  useEffect(() => {
    if (!firebaseUser || !initialDataLoaded) return;
    if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await updateBalance(firebaseUser.uid, balance);
      } catch { /* Firestore indisponível: o cache local já tem o saldo */ }
      // Manter o cache local atualizado mesmo se o Firestore falhar
      try {
        const cached = localStorage.getItem(`benbets_user_${firebaseUser.uid}`);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(`benbets_user_${firebaseUser.uid}`, JSON.stringify({
          ...parsed,
          balance,
        }));
      } catch { /* quota cheia */ }
    }, 500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [balance, firebaseUser, initialDataLoaded]);

  // Load daily missions
  const loadMissions = async () => {
    if (!firebaseUser) return;
    try {
      const rec = await getMissions(firebaseUser.uid);
      setMissionsRecord(rec);
    } catch { /* keep previous state */ }
  };

  useEffect(() => {
    if (!firebaseUser) return;
    loadMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  // Atualiza o estado das missões enquanto o modal estiver aberto
  useEffect(() => {
    if (!showMissions || !firebaseUser) return;
    const interval = setInterval(loadMissions, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMissions, firebaseUser]);

  const handleClaimMission = async (missionId: string) => {
    if (!firebaseUser) return;
    await claimMissionReward(firebaseUser.uid, missionId);
    const missionDef = DAILY_MISSIONS.find(m => m.id === missionId);
    if (missionDef) adjustBalanceSafe(missionDef.reward);
    setMissionsRecord(prev => ({
      ...prev,
      [missionId]: { ...prev[missionId], claimed: true, completed: true },
    }));
  };

  // Realtime Firestore leaderboard listener
  useEffect(() => {
    if (!firebaseUser) {
      setLeaderboardRaw([]);
      setLeaderboardLoading(false);
      setLeaderboardPermissionError(false);
      return;
    }
    setLeaderboardLoading(true);
    const unsub = subscribeToLeaderboard(
      (list) => {
        setLeaderboardRaw(list);
        setLeaderboardLoading(false);
        setLeaderboardPermissionError(false);
        try {
          localStorage.setItem('benbets_leaderboard_cache', JSON.stringify(list));
        } catch { /* quota */ }
      },
      (err: any) => {
        setLeaderboardLoading(false);
        if (err?.code === 'permission-denied') {
          setLeaderboardPermissionError(true);
        }
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  // Presence heartbeat (lastSeen) for active online status
  useEffect(() => {
    if (!firebaseUser || !initialDataLoaded) return;
    updateUserPresence(firebaseUser.uid).catch(() => {});

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(firebaseUser.uid).catch(() => {});
      }
    }, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(firebaseUser.uid).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [firebaseUser, initialDataLoaded]);

  // Dynamic Live Matches State Feed (Mock + Real Brazilian Football API)
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [loadingRealMatches, setLoadingRealMatches] = useState(false);
  const [realMatchesCount, setRealMatchesCount] = useState(0);

  const syncRealMatches = useCallback(async (force = false) => {
    setLoadingRealMatches(true);
    try {
      const [brList, hockeyList] = await Promise.all([
        fetchBrazilianFootballMatches(force),
        fetchRealHockeyMatches(force),
      ]);
      const realList = [...brList, ...hockeyList];
      if (realList.length > 0) {
        setRealMatchesCount(realList.length);
        const coveredLeagues = new Set(realList.map((m) => m.league));
        setMatches((prev) => {
          const nonCoveredMocks = prev.filter(
            (m) => !m.id.startsWith('espn-') && !coveredLeagues.has(m.league)
          );
          return [...realList, ...nonCoveredMocks];
        });
      }
    } catch {
      /* Fallback matches remain active */
    } finally {
      setLoadingRealMatches(false);
    }
  }, []);

  useEffect(() => {
    syncRealMatches(false);
    const refreshId = setInterval(() => {
      syncRealMatches(true);
    }, 60_000);
    return () => clearInterval(refreshId);
  }, [syncRealMatches]);

  // Realistic live match progression until official end (isFinished = true)
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      setMatches((prevMatches) =>
        prevMatches.map((match) => {
          if (!match.isLive || match.isFinished) return match;

          // Real ESPN API matches recompute live odds coherently from official score & clock
          if (match.id.startsWith('espn-')) {
            const baseOdds = match.baseOdds || match.odds;
            const liveOdds = computeLiveOddsFromScore({
              sport: match.sport,
              scoreHome: match.scoreHome ?? 0,
              scoreAway: match.scoreAway ?? 0,
              progress: parseMatchProgress(match.sport, match.timeElapsed),
              baseOdds,
            });
            return {
              ...match,
              baseOdds,
              odds: liveOdds,
            };
          }

          let hScore = match.scoreHome ?? 0;
          let aScore = match.scoreAway ?? 0;
          let elapsed = match.timeElapsed || '';
          let liveEvent = match.liveEvent;
          let isLive = true;
          let isFinished = false;
          let timeLabel = match.time;
          const prevStats = match.stats || { possessionHome: 50, shotsHome: 5, shotsAway: 5 };
          let posHome = prevStats.possessionHome ?? 50;
          let shotsH = prevStats.shotsHome ?? 5;
          let shotsA = prevStats.shotsAway ?? 5;
          const probability = Math.random();

          posHome = Math.max(30, Math.min(72, posHome + (Math.random() > 0.5 ? 1 : -1)));

          if (match.sport === 'Futebol') {
            if (probability < 0.08) {
              if (Math.random() > 0.48) {
                hScore += 1;
                shotsH += 1;
                liveEvent = `⚽ GOOOL do ${match.teamHome}! Vibração na arquibancada!`;
              } else {
                aScore += 1;
                shotsA += 1;
                liveEvent = `⚽ GOOOL do ${match.teamAway}! Empurra a defesa para trás!`;
              }
            } else if (probability < 0.35) {
              const homeAtk = Math.random() > 0.45;
              if (homeAtk) shotsH += 1;
              else shotsA += 1;
              const actor = homeAtk ? match.teamHome : match.teamAway;
              const plays = [
                `🎯 Finalização perigosa do ${actor} passa raspando a trave!`,
                `🧤 Goleiro salva à queima-roupa o chute do ${actor}!`,
                `🚩 Escanteio perigoso para o ${actor}`,
                `🟨 Falta tática parada no meio-campo contra o ${actor}`,
              ];
              liveEvent = plays[Math.floor(Math.random() * plays.length)];
            }

            const baseMatch = elapsed.match(/(\d+)/);
            const extraMatch = elapsed.match(/90\+(\d+)/);
            const currentMin = extraMatch
              ? 90 + parseInt(extraMatch[1], 10)
              : baseMatch
                ? parseInt(baseMatch[1], 10)
                : 60;
            const nextMin = currentMin + 3;

            if (nextMin >= 94) {
              isLive = false;
              isFinished = true;
              timeLabel = 'Encerrado';
              elapsed = 'Fim de Jogo';
              liveEvent = `🏁 Apito Final! Placar encerrado: ${match.teamHome} ${hScore} × ${aScore} ${match.teamAway}`;
            } else if (nextMin > 90) {
              elapsed = `90+${nextMin - 90}'`;
            } else {
              elapsed = `${nextMin}'`;
            }
          } else if (match.sport === 'Basquete') {
            const hDelta = probability < 0.7 ? (Math.random() < 0.32 ? 3 : 2) : 0;
            const aDelta = probability > 0.28 ? (Math.random() < 0.3 ? 3 : 2) : 0;
            hScore = (match.scoreHome ?? 80) + hDelta;
            aScore = (match.scoreAway ?? 80) + aDelta;
            if (hDelta > 0) shotsH += 1;
            if (aDelta > 0) shotsA += 1;
            if (hDelta === 3) liveEvent = `🔥 Bola de 3 pontos convertida pelo ${match.teamHome}!`;
            else if (aDelta === 3) liveEvent = `🎯 Chuá de 3 pontos do ${match.teamAway}!`;
            else if (hDelta === 2 || aDelta === 2) {
              liveEvent = `🏀 Bandeja no garrafão de ${hDelta > aDelta ? match.teamHome : match.teamAway}!`;
            }

            const qMatch = elapsed.match(/(\d+)º\s*Qtr\s*•\s*(\d+):(\d+)/i);
            const otMatch = elapsed.match(/OT\s*•\s*(\d+):(\d+)/i);
            let qtr = otMatch ? 5 : qMatch ? parseInt(qMatch[1], 10) : 4;
            let totalSec = otMatch
              ? parseInt(otMatch[1], 10) * 60 + parseInt(otMatch[2], 10)
              : qMatch
                ? parseInt(qMatch[2], 10) * 60 + parseInt(qMatch[3], 10)
                : 120;
            totalSec -= 45;

            if (totalSec <= 0) {
              if (qtr >= 4) {
                if (hScore === aScore) {
                  qtr = 5;
                  totalSec = 90;
                  elapsed = 'OT • 01:30';
                  liveEvent = '⏱️ Prorrogação no basquete! Placar empatado!';
                } else {
                  isLive = false;
                  isFinished = true;
                  timeLabel = 'Encerrado';
                  elapsed = 'Fim de Jogo';
                  liveEvent = `🏁 Fim de Jogo! ${hScore > aScore ? match.teamHome : match.teamAway} vence (${hScore} × ${aScore})!`;
                }
              } else {
                qtr += 1;
                totalSec = 600;
                elapsed = `${qtr}º Qtr • 10:00`;
              }
            } else {
              const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
              const ss = String(totalSec % 60).padStart(2, '0');
              elapsed = qtr >= 5 ? `OT • ${mm}:${ss}` : `${qtr}º Qtr • ${mm}:${ss}`;
            }
          } else if (match.sport === 'Tênis') {
            if (probability < 0.65) {
              const homePoint = Math.random() > 0.48;
              const server = homePoint ? match.teamHome : match.teamAway;
              if (homePoint) shotsH += 1;
              else shotsA += 1;
              if (Math.random() < 0.25) {
                if (homePoint) hScore += 1;
                else aScore += 1;
              }
              if (hScore >= 3 || aScore >= 3) {
                if (hScore === aScore) hScore += 1;
                isLive = false;
                isFinished = true;
                timeLabel = 'Encerrado';
                elapsed = 'Fim de Jogo';
                liveEvent = `🏁 Game, Set & Match para ${hScore > aScore ? match.teamHome : match.teamAway}!`;
              } else {
                const g1 = Math.floor(Math.random() * 6);
                const g2 = Math.floor(Math.random() * 6);
                elapsed = `Set ${Math.min(5, hScore + aScore + 1)} • G: ${g1}-${g2}`;
                liveEvent = Math.random() > 0.5 ? `🎾 Ace no saque de ${server}!` : `🔥 Winner paralelo de ${server}!`;
              }
            }
          } else if (match.sport === 'E-Sports') {
            if (match.league.includes('CS2')) {
              const homeRound = Math.random() > 0.48;
              if (homeRound) hScore += 1;
              else aScore += 1;
              shotsH = hScore;
              shotsA = aScore;
              const actor = homeRound ? match.teamHome : match.teamAway;
              liveEvent = `💣 ${actor} vence o round!`;
              if ((hScore >= 13 || aScore >= 13) && Math.abs(hScore - aScore) >= 2) {
                isLive = false;
                isFinished = true;
                timeLabel = 'Encerrado';
                elapsed = 'Fim de Jogo';
                liveEvent = `🏁 GG! ${hScore > aScore ? match.teamHome : match.teamAway} fecha o mapa (${hScore} × ${aScore})!`;
              } else {
                elapsed = `Mapa 2 • R${hScore + aScore + 1}`;
              }
            } else {
              const timeParts = elapsed.match(/(\d+):(\d+)/);
              const mins = timeParts ? parseInt(timeParts[1], 10) + 4 : 30;
              if (Math.random() < 0.4) {
                const homeMap = Math.random() > 0.48;
                if (homeMap) hScore += 1;
                else aScore += 1;
                shotsH += homeMap ? 3 : 1;
                shotsA += homeMap ? 1 : 3;
                liveEvent = `🐉 ${homeMap ? match.teamHome : match.teamAway} garante o Nexus!`;
              }
              if (mins >= 42 || hScore >= 3 || aScore >= 3) {
                if (hScore === aScore) {
                  if (Math.random() > 0.5) hScore += 1;
                  else aScore += 1;
                }
                isLive = false;
                isFinished = true;
                timeLabel = 'Encerrado';
                elapsed = 'Fim de Jogo';
                liveEvent = `🏁 Série encerrada! Vitória de ${hScore > aScore ? match.teamHome : match.teamAway}!`;
              } else {
                elapsed = `Jogo ${Math.min(5, hScore + aScore + 1)} • ${mins}:15`;
              }
            }
          } else if (match.sport === 'MMA') {
            const rMatch = elapsed.match(/Round\s*(\d+)/i);
            const currentRound = rMatch ? parseInt(rMatch[1], 10) : 4;
            const homeHit = Math.random() > 0.45;
            if (homeHit) {
              hScore += 1;
              shotsH += 5;
            } else {
              aScore += 1;
              shotsA += 5;
            }
            const fighter = homeHit ? match.teamHome : match.teamAway;
            liveEvent = Math.random() > 0.5
              ? `🥊 ${fighter} encaixa sequência forte de golpes!`
              : `🤼 ${fighter} domina na grade!`;

            if (currentRound >= 5 || Math.random() < 0.18) {
              if (hScore === aScore) hScore += 1;
              isLive = false;
              isFinished = true;
              timeLabel = 'Encerrado';
              elapsed = 'Fim de Jogo';
              liveEvent = `🏁 Fim da Luta! Vitória de ${hScore > aScore ? match.teamHome : match.teamAway}!`;
            } else {
              elapsed = `Round ${currentRound + 1} • 03:30`;
            }
          } else if (match.sport === 'Vôlei') {
            const homeSet = Math.random() > 0.46;
            if (homeSet) {
              shotsH += 2;
              if (Math.random() < 0.35) hScore += 1;
            } else {
              shotsA += 2;
              if (Math.random() < 0.35) aScore += 1;
            }
            if (hScore >= 3 || aScore >= 3) {
              if (hScore === aScore) hScore += 1;
              isLive = false;
              isFinished = true;
              timeLabel = 'Encerrado';
              elapsed = 'Fim de Jogo';
              liveEvent = `🏁 Fim de Jogo! ${hScore > aScore ? match.teamHome : match.teamAway} vence por ${hScore} × ${aScore} sets!`;
            } else {
              const p1 = 18 + Math.floor(Math.random() * 6);
              const p2 = 17 + Math.floor(Math.random() * 6);
              elapsed = `${Math.min(5, hScore + aScore + 1)}º Set • ${p1}-${p2}`;
              liveEvent = `🏐 Cortada potente de ${homeSet ? match.teamHome : match.teamAway}!`;
            }
          } else if (match.sport === 'Hóquei') {
            if (probability < 0.11) {
              if (Math.random() > 0.48) {
                hScore += 1;
                shotsH += 1;
                liveEvent = `🥅 GOOOL no gelo do ${match.teamHome}!`;
              } else {
                aScore += 1;
                shotsA += 1;
                liveEvent = `🥅 GOOOL no gelo do ${match.teamAway}!`;
              }
            } else if (probability < 0.44) {
              const homeAtk = Math.random() > 0.46;
              if (homeAtk) shotsH += 1;
              else shotsA += 1;
              const actor = homeAtk ? match.teamHome : match.teamAway;
              const plays = [
                `🏒 Disparo de primeira de ${actor} defendido pelo goleiro!`,
                `⚡ Power Play perigoso armado pelo ${actor}!`,
                `🚨 Disco passa tirando tinta da trave para o ${actor}!`,
              ];
              liveEvent = plays[Math.floor(Math.random() * plays.length)];
            }

            const pMatch = elapsed.match(/(\d+)º\s*Per\s+(\d+):(\d+)/i);
            let period = pMatch ? parseInt(pMatch[1], 10) : 2;
            let totalSec = pMatch
              ? parseInt(pMatch[2], 10) * 60 + parseInt(pMatch[3], 10)
              : 600;
            totalSec -= 105;

            if (totalSec <= 0) {
              if (period >= 3) {
                isLive = false;
                isFinished = true;
                timeLabel = 'Encerrado';
                elapsed = 'Fim de Jogo';
                liveEvent = `🏁 Fim dos 3 Períodos! Placar regulamentar: ${match.teamHome} ${hScore} × ${aScore} ${match.teamAway}`;
              } else {
                period += 1;
                totalSec = 1200;
                elapsed = `${period}º Per 20:00`;
                liveEvent = `🏒 Início do ${period}º Período no gelo!`;
              }
            } else {
              const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
              const ss = String(totalSec % 60).padStart(2, '0');
              elapsed = `${period}º Per ${mm}:${ss}`;
            }
          }

          // Dynamic odds synced mathematically with current score & remaining time
          const baseOdds = match.baseOdds || match.odds;
          const liveOdds = computeLiveOddsFromScore({
            sport: match.sport,
            scoreHome: hScore,
            scoreAway: aScore,
            progress: isFinished ? 1 : parseMatchProgress(match.sport, elapsed),
            baseOdds,
          });

          return {
            ...match,
            isLive,
            isFinished,
            time: timeLabel,
            scoreHome: hScore,
            scoreAway: aScore,
            timeElapsed: elapsed,
            liveEvent,
            stats: {
              ...prevStats,
              possessionHome: posHome,
              shotsHome: shotsH,
              shotsAway: shotsA,
            },
            baseOdds,
            odds: liveOdds,
          };
        })
      );
    }, 6500);

    return () => clearInterval(scoreInterval);
  }, []);

  // REAL SPORTSBOOK SETTLEMENT ENGINE:
  // Only settles pending sports bets AFTER match.isFinished === true based on the REAL final score!
  useEffect(() => {
    const matchesById = new Map<string, Match>(matches.map((m) => [m.id, m]));
    const pendingSports = placedBets.filter(
      (b) => b.status === 'pending' && b.type === 'sports' && !settledBetIdsRef.current.has(b.id)
    );
    if (pendingSports.length === 0) return;

    const getMatchFinalOutcome = (m: Match): 'home' | 'draw' | 'away' | null => {
      if (!m.isFinished) return null;
      if (typeof m.scoreHome !== 'number' || typeof m.scoreAway !== 'number') return null;
      if (m.scoreHome > m.scoreAway) return 'home';
      if (m.scoreHome === m.scoreAway) return 'draw';
      return 'away';
    };

    const resolutions: Array<{ id: string; won: boolean; payout: number; outcomeValue: string }> = [];

    for (const bet of pendingSports) {
      let legsToCheck: Array<{ matchId: string; matchName: string; pickedOutcome: 'home' | 'draw' | 'away' }> = [];

      if (Array.isArray(bet.legs) && bet.legs.length > 0) {
        legsToCheck = bet.legs;
      } else if (bet.matchId && bet.pickedOutcome) {
        legsToCheck = [{ matchId: bet.matchId, matchName: bet.matchName, pickedOutcome: bet.pickedOutcome }];
      } else {
        const legacyMatch = matches.find((m) => `${m.teamHome} x ${m.teamAway}` === bet.matchName);
        if (legacyMatch) {
          const pickedOutcome: 'home' | 'draw' | 'away' = /empate/i.test(bet.selectionName)
            ? 'draw'
            : bet.selectionName.includes(legacyMatch.teamHome)
              ? 'home'
              : 'away';
          legsToCheck = [{ matchId: legacyMatch.id, matchName: bet.matchName, pickedOutcome }];
        }
      }

      if (legsToCheck.length === 0) continue;

      let allFinished = true;
      let allWon = true;
      const scoreParts: string[] = [];

      for (const leg of legsToCheck) {
        const m = matchesById.get(leg.matchId);
        if (!m || !m.isFinished) {
          allFinished = false;
          break;
        }
        const finalOutcome = getMatchFinalOutcome(m);
        if (!finalOutcome) {
          allFinished = false;
          break;
        }
        if (finalOutcome !== leg.pickedOutcome) allWon = false;
        scoreParts.push(`${m.teamHome} ${m.scoreHome ?? 0}×${m.scoreAway ?? 0} ${m.teamAway}`);
      }

      if (allFinished) {
        settledBetIdsRef.current.add(bet.id);
        resolutions.push({
          id: bet.id,
          won: allWon,
          payout: allWon ? bet.potentialPayout : 0,
          outcomeValue: `Placar Final: ${scoreParts.join(' | ')}`,
        });
      }
    }

    if (resolutions.length === 0) return;

    const resMap = new Map(resolutions.map((r) => [r.id, r]));
    setPlacedBets((prev) =>
      prev.map((b) => {
        const r = resMap.get(b.id);
        if (!r) return b;
        return {
          ...b,
          status: r.won ? 'won' : 'lost',
          outcomeValue: r.outcomeValue,
        };
      })
    );

    for (const r of resolutions) {
      if (r.won && Number.isFinite(r.payout) && r.payout > 0) {
        adjustBalanceSafe(r.payout);
      }
      if (firebaseUser) {
        updateBet(firebaseUser.uid, r.id, {
          status: r.won ? 'won' : 'lost',
          outcomeValue: r.outcomeValue,
        }).catch(() => {});
      }
    }
  }, [matches, placedBets, firebaseUser, adjustBalanceSafe]);

  // Open inline quick-bet panel directly inside the match card when clicking 1 / X / 2
  const handleOddsClick = (match: Match, outcomeType: 'home' | 'draw' | 'away') => {
    if (match.isFinished) return;
    setQuickBetFeedback(null);
    setActiveQuickBet((prev) =>
      prev && prev.matchId === match.id && prev.type === outcomeType
        ? null
        : { matchId: match.id, type: outcomeType }
    );
  };

  // Toggle selection into multi-accumulator Cupom slip (optional for +15% combos)
  const handleAddToSlipCombo = (match: Match, outcomeType: 'home' | 'draw' | 'away', oddsValue: number) => {
    if (match.isFinished) return;
    let outcomeLabel = '';
    if (outcomeType === 'home') outcomeLabel = `${match.teamHome} (Vence)`;
    else if (outcomeType === 'away') outcomeLabel = `${match.teamAway} (Vence)`;
    else outcomeLabel = 'Empate';

    const existingIndex = selections.findIndex(s => s.matchId === match.id);
    if (existingIndex !== -1) {
      const existingSelection = selections[existingIndex];
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
      const newSel: BetSelection = {
        matchId: match.id,
        matchName: `${match.teamHome} x ${match.teamAway}`,
        type: outcomeType,
        selectionName: outcomeLabel,
        odds: oddsValue,
      };
      setSelections(prev => [...prev, newSel]);
    }
    setActiveQuickBet(null);
  };

  // Confirm direct single-match bet right inside the match card (settles ONLY when match.isFinished === true)
  const handleConfirmQuickBet = (match: Match, outcomeType: 'home' | 'draw' | 'away', oddsValue: number) => {
    if (match.isFinished) return;
    const rawStake = parseFloat(quickBetStake.replace(',', '.'));
    if (!Number.isFinite(rawStake) || rawStake <= 0) {
      setQuickBetFeedback({ matchId: match.id, text: '⚠️ Digite um valor válido maior que R$ 0,00.' });
      return;
    }
    const safeStake = Number(rawStake.toFixed(2));
    if (safeStake > balance) {
      setQuickBetFeedback({ matchId: match.id, text: '⚠️ Saldo insuficiente para esta aposta.' });
      return;
    }

    const outcomeLabel =
      outcomeType === 'home'
        ? `${match.teamHome} (Vence)`
        : outcomeType === 'away'
          ? `${match.teamAway} (Vence)`
          : 'Empate Final (X)';
    const matchLabel = `${match.teamHome} x ${match.teamAway}`;
    const potentialPayout = Number((safeStake * oddsValue).toFixed(2));

    adjustBalanceSafe(-safeStake);

    const newBet: PlacedBet = {
      id: `bet-sports-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      matchName: matchLabel,
      selectionName: `${outcomeLabel} (@${oddsValue.toFixed(2)})`,
      odds: oddsValue,
      stake: safeStake,
      potentialPayout,
      status: 'pending',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'sports',
      matchId: match.id,
      pickedOutcome: outcomeType,
      legs: [
        {
          matchId: match.id,
          matchName: matchLabel,
          pickedOutcome: outcomeType,
          selectionName: outcomeLabel,
          odds: oddsValue,
        },
      ],
    };

    handleAddPlacedBet(newBet);
    setActiveQuickBet(null);
    setQuickBetFeedback({
      matchId: match.id,
      text: `✅ Aposta confirmada em "${outcomeLabel}" (R$ ${safeStake.toFixed(2)} → R$ ${potentialPayout.toFixed(2)}). Resultado ao apito final!`,
    });
  };

  const handleRemoveSelection = (matchId: string) => {
    setSelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleClearSelections = () => {
    setSelections([]);
  };

  const handleDepositSuccess = useCallback((amount: number) => {
    adjustBalanceSafe(amount);
  }, [adjustBalanceSafe]);

  const handleWithdrawSuccess = (amount: number): boolean => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return false;
    const safeBal = Number.isFinite(balance) && balance >= 0 ? balance : 20;
    if (safeBal >= amount) {
      adjustBalanceSafe(-amount);
      return true;
    }
    return false;
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    if (firebaseUser) addTransaction(firebaseUser.uid, newTx).catch(() => {});
  };

  const handleAddPlacedBet = (newBet: PlacedBet) => {
    const { bets } = sanitizePlacedBets([newBet]);
    const cleanBet = bets[0] || newBet;
    setPlacedBets(prev => [cleanBet, ...prev]);
    if (firebaseUser) addBet(firebaseUser.uid, cleanBet).catch(() => {});
  };

  const handleSettleAction = (betId: string, status: 'won' | 'lost', payOut: number) => {
    const safePayout = typeof payOut === 'number' && Number.isFinite(payOut) && payOut >= 0 ? payOut : 0;
    setPlacedBets(prev => prev.map(b => b.id === betId ? { ...b, status, potentialPayout: safePayout } : b));
    if (status === 'won' && safePayout > 0) {
      adjustBalanceSafe(safePayout);
    }
    if (firebaseUser) updateBet(firebaseUser.uid, betId, { status, potentialPayout: safePayout }).catch(() => {});
  };

  const handlePokemonCollectionUpdate = (cards: PokemonCard[]) => {
    setPokemonCollection(prev => {
      const merged = [...prev];
      for (const newCard of cards) {
        const idx = merged.findIndex(c => c.id === newCard.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + 1 };
        else merged.push(newCard);
      }
      if (firebaseUser) addPokemonCards(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellPokemonCard = (cardId: string, price: number) => {
    setPokemonCollection(prev => prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0));
    adjustBalanceSafe(price);
    if (firebaseUser) removePokemonCard(firebaseUser.uid, cardId).catch(() => {});
  };

  const handleSellAllDuplicates = (prices: Record<string, number>) => {
    setPokemonCollection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = pokemonCollection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    adjustBalanceSafe(total);
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

  const handleWorldCupCollectionUpdate = (cards: PokemonCard[]) => {
    setWorldCupCollection(prev => {
      const merged = [...prev];
      for (const c of cards) {
        const idx = merged.findIndex(x => x.id === c.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + 1 };
        else merged.push(c);
      }
      if (firebaseUser) addWorldCupStickers(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellWorldCupSticker = (cardId: string, price: number) => {
    setWorldCupCollection(prev => prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0));
    adjustBalanceSafe(price);
    if (firebaseUser) removeWorldCupSticker(firebaseUser.uid, cardId).catch(() => {});
  };

  const handleSellAllWorldCupDuplicates = (prices: Record<string, number>) => {
    setWorldCupCollection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = worldCupCollection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    adjustBalanceSafe(total);
    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const existing: PokemonCard[] = data.worldCupCollection || [];
        const updated = existing.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c);
        updateDoc(ref, { worldCupCollection: updated });
      }).catch(() => {});
    }
  };

  const handleKpopCollectionUpdate = (cards: PokemonCard[]) => {
    setKpopCollection(prev => {
      const merged = [...prev];
      for (const c of cards) {
        const idx = merged.findIndex(x => x.id === c.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + 1 };
        else merged.push(c);
      }
      if (firebaseUser) addKpopCards(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellKpopCard = (cardId: string, price: number) => {
    setKpopCollection(prev => prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0));
    adjustBalanceSafe(price);
    if (firebaseUser) removeKpopCard(firebaseUser.uid, cardId).catch(() => {});
  };

  const handleCS2CollectionUpdate = (cards: PokemonCard[]) => {
    setCs2Collection(prev => {
      const merged = [...prev];
      for (const c of cards) {
        const idx = merged.findIndex(x => x.id === c.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + 1 };
        else merged.push(c);
      }
      if (firebaseUser) addCS2Cards(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellCS2Card = (cardId: string, price: number) => {
    setCs2Collection(prev => prev.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0));
    adjustBalanceSafe(price);
    if (firebaseUser) removeCS2Card(firebaseUser.uid, cardId).catch(() => {});
  };

  const handleSellAllCS2Duplicates = (prices: Record<string, number>) => {
    setCs2Collection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = cs2Collection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    adjustBalanceSafe(total);
    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const existing: PokemonCard[] = data.cs2Collection || [];
        const updated = existing.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c);
        updateDoc(ref, { cs2Collection: updated });
      }).catch(() => {});
    }
  };

  const handleAnimeCollectionUpdate = (cards: PokemonCard[]) => {
    setAnimeCollection(prev => {
      const merged = [...prev];
      for (const c of cards) {
        const idx = merged.findIndex(x => x.id === c.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + 1 };
        else merged.push(c);
      }
      if (firebaseUser) addAnimeCards(firebaseUser.uid, cards).catch(() => {});
      return merged;
    });
  };

  const handleSellAnimeCard = (cardId: string, price: number, removeAll = false) => {
    setAnimeCollection(prev =>
      prev
        .map(c => c.id === cardId ? { ...c, quantity: removeAll ? 0 : c.quantity - 1 } : c)
        .filter(c => c.quantity > 0)
    );
    adjustBalanceSafe(price);
    if (firebaseUser) removeAnimeCard(firebaseUser.uid, cardId, removeAll).catch(() => {});
  };

  const handleSellAllAnimeDuplicates = (prices: Record<string, number>) => {
    setAnimeCollection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = animeCollection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    adjustBalanceSafe(total);
    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const existing: PokemonCard[] = data.animeCollection || [];
        const updated = existing.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c);
        updateDoc(ref, { animeCollection: updated });
      }).catch(() => {});
    }
  };

  const handleSellAllKpopDuplicates = (prices: Record<string, number>) => {
    setKpopCollection(prev => prev.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c));
    const total = kpopCollection.filter(c => c.quantity > 1).reduce((sum, c) => sum + (prices[c.id] ?? 0) * (c.quantity - 1), 0);
    adjustBalanceSafe(total);
    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const existing: PokemonCard[] = data.kpopCollection || [];
        const updated = existing.map(c => c.quantity > 1 ? { ...c, quantity: 1 } : c);
        updateDoc(ref, { kpopCollection: updated });
      }).catch(() => {});
    }
  };

  // Sportsbook leagues, status counters, and filtered/grouped matches
  const sportScopedMatches = useMemo(() => {
    if (selectedSport !== 'Todos') return matches.filter((m) => m.sport === selectedSport);
    if (sportFilter !== 'todas') return matches.filter((m) => m.sport === sportFilter);
    return matches;
  }, [matches, selectedSport, sportFilter]);

  const liveMatchesCount = useMemo(
    () => sportScopedMatches.filter((m) => m.isLive && !m.isFinished).length,
    [sportScopedMatches]
  );
  const upcomingMatchesCount = useMemo(
    () => sportScopedMatches.filter((m) => !m.isLive && !m.isFinished).length,
    [sportScopedMatches]
  );
  const finishedMatchesCount = useMemo(
    () => sportScopedMatches.filter((m) => Boolean(m.isFinished)).length,
    [sportScopedMatches]
  );

  const availableLeagues = useMemo(() => {
    const map = new Map<string, { league: string; flag: string; count: number }>();
    for (const m of sportScopedMatches) {
      const existing = map.get(m.league);
      if (existing) existing.count += 1;
      else map.set(m.league, { league: m.league, flag: m.countryFlag || '🏆', count: 1 });
    }
    return Array.from(map.values());
  }, [sportScopedMatches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sportScopedMatches.filter((match) => {
      if (matchStatusFilter === 'live' && (!match.isLive || match.isFinished)) return false;
      if (matchStatusFilter === 'upcoming' && (match.isLive || match.isFinished)) return false;
      if (matchStatusFilter === 'finished' && !match.isFinished) return false;
      if (leagueFilter !== 'todas' && match.league !== leagueFilter) return false;
      if (!q) return true;
      return (
        match.teamHome.toLowerCase().includes(q) ||
        match.teamAway.toLowerCase().includes(q) ||
        match.league.toLowerCase().includes(q) ||
        (match.venue || '').toLowerCase().includes(q) ||
        (match.phase || '').toLowerCase().includes(q)
      );
    });
  }, [sportScopedMatches, matchStatusFilter, leagueFilter, searchQuery]);

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, { league: string; flag: string; phase?: string; sport: string; items: Match[] }>();
    for (const m of filteredMatches) {
      const existing = groups.get(m.league);
      if (existing) {
        existing.items.push(m);
      } else {
        groups.set(m.league, {
          league: m.league,
          flag: m.countryFlag || '🏆',
          phase: m.phase,
          sport: m.sport,
          items: [m],
        });
      }
    }
    return Array.from(groups.values());
  }, [filteredMatches]);

  const liveLeaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!firebaseUser) return leaderboardRaw;
    const allCols = [
      pokemonCollection,
      worldCupCollection,
      kpopCollection,
      cs2Collection,
      animeCollection,
    ];
    let uniqueCards = 0;
    let totalCards = 0;
    for (const col of allCols) {
      uniqueCards += col.length;
      for (const c of col) totalCards += c.quantity || 1;
    }
    let betsWon = 0;
    let biggestWin = 0;
    for (const b of placedBets) {
      if (b.status === 'won') {
        betsWon += 1;
        if (b.potentialPayout > biggestWin) biggestWin = b.potentialPayout;
      }
    }
    const selfName = (userName || firebaseUser.email?.split('@')[0] || 'Você').trim();
    const safeSelfBalance = typeof balance === 'number' && Number.isFinite(balance) && balance >= 0 ? balance : 20;
    const selfEntry: LeaderboardEntry = {
      uid: firebaseUser.uid,
      displayName: selfName,
      balance: safeSelfBalance,
      totalCards,
      uniqueCards,
      betsWon,
      totalBets: placedBets.length,
      biggestWin,
      lastSeen: Date.now(),
    };
    const exists = leaderboardRaw.some((e) => e.uid === firebaseUser.uid);
    if (!exists) return [selfEntry, ...leaderboardRaw];
    return leaderboardRaw.map((e) => (e.uid === firebaseUser.uid ? { ...e, ...selfEntry } : e));
  }, [
    firebaseUser,
    leaderboardRaw,
    userName,
    balance,
    placedBets,
    pokemonCollection,
    worldCupCollection,
    kpopCollection,
    cs2Collection,
    animeCollection,
  ]);

  const myBalanceRank = useMemo(() => {
    if (!firebaseUser || liveLeaderboard.length === 0) return null;
    const sorted = [...liveLeaderboard].sort((a, b) =>
      b.balance !== a.balance ? b.balance - a.balance : b.betsWon - a.betsWon
    );
    const idx = sorted.findIndex((e) => e.uid === firebaseUser.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [firebaseUser, liveLeaderboard]);

  const hasClaimableMission = (Object.values(missionsRecord) as MissionProgress[]).some(
    (m) => m && m.completed && !m.claimed
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center gap-4">
        <OmnitrixLogo size="lg" animated />
        <p className="text-xs font-mono text-brand/80 uppercase tracking-widest animate-pulse">
          Calibrando Omnitrix...
        </p>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  if (showAdmin) {
    return (
      <AdminPanel
        onBack={() => setShowAdmin(false)}
        currentUser={firebaseUser}
        currentBalance={balance}
        currentUserName={userName}
        fallbackLeaderboard={liveLeaderboard}
        onSyncCurrentUserBalance={(val) => {
          if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
            setBalance(val);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-100 flex flex-col justify-between">
      
      {/* 🇧🇷 NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#080a12]/90 border-b border-brand/15 backdrop-blur-xl px-3 py-2.5 md:px-8 lg:px-12 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo & Slogan */}
          <button
            onClick={() => {
              setSelectedSport('Home');
              setSelectedCasinoGame(null);
              setSelectedColecionavel(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer text-left group"
          >
            <OmnitrixLogo size="sm" className="group-hover:scale-105 transition-transform" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black font-display text-lg tracking-tight leading-none text-white">
                  Ben<span className="text-brand">Bets</span>
                </h1>
                <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/25">
                  .bet.br
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">Ambiente Demonstração Legal • Lei 14.790/2023</p>
            </div>
          </button>

          {/* User Account Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Mobile Hamburger */}
            <button 
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-2 border border-[#1c1e2d] text-slate-400 hover:text-brand rounded-xl hover:bg-[#161826] transition-colors cursor-pointer"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Balance Visor (Omnitrix HUD) */}
            <div className="bg-[#06070d]/95 px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl border border-brand/25 shadow-[0_0_20px_rgba(0,255,135,0.08)] flex items-center gap-2.5">
              <div className="hidden sm:flex items-center justify-center p-1.5 bg-brand/10 border border-brand/20 rounded-lg text-brand relative">
                <Wallet className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand animate-pulse" />
              </div>
              <div className="text-right">
                <span className="flex items-center justify-end gap-1 text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand sm:hidden animate-pulse" />
                  Saldo
                </span>
                <span className="font-mono text-brand font-extrabold text-sm md:text-base tracking-tight select-none drop-shadow-[0_0_10px_rgba(0,255,135,0.25)]">
                  R$ {(Number.isFinite(balance) && balance >= 0 ? balance : 20).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button 
                onClick={() => setIsPixOpen(true)}
                className="ml-0.5 w-7 h-7 flex items-center justify-center rounded-lg bg-brand hover:bg-[#00e074] text-slate-950 font-black text-lg leading-none cursor-pointer transition-all shadow-[0_0_12px_rgba(0,255,135,0.3)] hover:scale-105 shrink-0"
                title="Depositar / Sacar / Cupons"
              >
                +
              </button>
            </div>

            {/* Leaderboard shortcut */}
            <button
              onClick={() => { setSelectedSport('Ranking'); setSelectedCasinoGame(null); setSelectedColecionavel(null); }}
              className={`px-2 sm:px-2.5 py-2 border rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedSport === 'Ranking'
                  ? 'bg-brand/15 border-brand text-brand shadow-[0_0_12px_rgba(0,255,135,0.2)]'
                  : 'border-[#1c1e2d] hover:border-brand/40 text-slate-400 hover:text-brand bg-[#0a0c14] hover:bg-[#131726]'
              }`}
              title="Ranking em Tempo Real"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
              {myBalanceRank && (
                <span className="hidden sm:inline font-mono text-[11px] font-extrabold text-brand">
                  #{myBalanceRank}
                </span>
              )}
            </button>

            {/* Daily Missions */}
            <button
              onClick={() => { setShowMissions(true); loadMissions(); }}
              className="relative p-2 border border-[#1c1e2d] hover:border-amber-500/40 text-slate-400 hover:text-amber-400 rounded-xl bg-[#0a0c14] hover:bg-[#131726] transition-colors cursor-pointer block"
              title="Missões Diárias"
            >
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              {hasClaimableMission && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand border-2 border-[#080a12] animate-pulse" />
              )}
            </button>

            {/* Sound toggle */}
            <button
              onClick={toggleMute}
              className={`p-2 border rounded-xl transition-colors cursor-pointer block ${
                muted
                  ? 'border-[#1c1e2d] text-slate-500 hover:text-slate-300 bg-[#0a0c14] hover:bg-[#131726]'
                  : 'border-[#1c1e2d] hover:border-brand/40 text-brand bg-[#0a0c14] hover:bg-[#131726]'
              }`}
              title={muted ? 'Ativar Sons' : 'Silenciar Sons'}
            >
              {muted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Regulation Manual */}
            <button 
              onClick={() => setIsInfoOpen(true)}
              className="p-2 border border-[#1c1e2d] hover:border-brand/40 text-slate-400 hover:text-brand rounded-xl bg-[#0a0c14] hover:bg-[#131726] transition-colors cursor-pointer block"
              title="Ler Legislação das Bets"
            >
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
            </button>

            {/* Admin */}
            <button 
              onClick={() => setShowAdmin(true)}
              className="p-2 border border-[#1c1e2d] hover:border-brand/30 text-slate-500 hover:text-brand rounded-xl bg-[#0a0c14] hover:bg-[#131726] transition-colors cursor-pointer block"
              title="Admin"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Logout */}
            {firebaseUser && (
              <button 
                onClick={async () => {
                  await markUserOffline(firebaseUser.uid).catch(() => {});
                  await signOut(auth);
                }}
                className="p-2 border border-[#1c1e2d] hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-xl bg-[#0a0c14] hover:bg-[#131726] transition-colors cursor-pointer block"
                title="Sair"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
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
            <div className="px-3 py-2 flex flex-wrap gap-1.5 max-h-[50vh] overflow-y-auto">
              {[
                { id: 'Home', label: 'Menu', icon: '🏠' },
                { id: 'Cassino', label: 'Jogos de Cassino', icon: '🚀' },
                { id: 'Colecionaveis', label: 'Colecionáveis', icon: '💎' },
                { id: 'Todos', label: 'Todos os Esportes', icon: '⚽' },
                { id: 'Ranking', label: 'Ranking', icon: '🏆' },
              ].map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => { setSelectedSport(sport.id); setSelectedCasinoGame(null); setSelectedColecionavel(null); setIsMobileMenuOpen(false); }}
                  className={`py-1.5 px-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border leading-none ${
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

      {/* Aviso de falha ao carregar dados do servidor */}
      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-medium px-3 py-2 text-center flex items-center justify-center gap-2"
          >
            <span>⚠️ {loadError}</span>
            <button onClick={() => setLoadError('')} className="text-amber-400 hover:text-amber-200 cursor-pointer font-bold">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Brazil Regulatory Header Notice */}
      <div className="bg-[#0b0c13] border-b border-[#1b1d2c]/60 py-1.5 sm:py-2.5 px-3 text-[10px] sm:text-xs text-center text-slate-300">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
          <span className="bg-brand/10 border border-brand/20 text-brand px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-bold font-mono">COMPLIANCE NACIONAL</span>
          <p className="text-[9px] sm:text-[11px] font-medium text-slate-300">
            Apostas operadas de acordo com as regras de Jogo Seguro. Domínio exclusivo <span className="font-bold text-brand">.bet.br</span> outorga SPA/MF.
          </p>
        </div>
      </div>

      {/* MAIN CONTAINER GRID */}
      <main className="max-w-[1600px] mx-auto px-2 sm:px-3 py-3 md:px-8 lg:px-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-8 w-full">
        
        {/* LEFT COLUMN: FILTERS & MATCHES/CASINO SELECT (COLS-8) */}
        <section className="col-span-1 lg:col-span-8 space-y-4 lg:space-y-6">
          
          {/* Main Visual Category Switchers */}
          <div className="flex border-b border-[#1a1c2a] overflow-x-auto gap-2 py-1 pb-2 md:pb-3 justify-start scrollbar-thin snap-x snap-mandatory -mx-3 md:mx-0 px-3 md:px-0">
            {[
              { id: 'Home', label: 'Menu', icon: '🏠' },
              { id: 'Cassino', label: 'Jogos de Cassino', icon: '🚀' },
              { id: 'Colecionaveis', label: 'Colecionáveis', icon: '💎' },
              { id: 'Todos', label: 'Todos os Esportes', icon: '⚽' },
              { id: 'Ranking', label: 'Ranking', icon: '🏆' },
            ].map((sport) => (
              <button
                key={sport.id}
                onClick={() => { setSelectedSport(sport.id); setSelectedCasinoGame(null); setSelectedColecionavel(null); }}
                className={`py-2 md:py-2.5 px-3 md:px-4 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer flex items-center gap-1.5 md:gap-2 border leading-none shrink-0 snap-al-start ${
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
          {selectedSport === 'Home' ? (
            <HomeMenu
              onSelect={(section) => { setSelectedSport(section); setSelectedCasinoGame(null); setSelectedColecionavel(null); }}
              leaderboard={liveLeaderboard}
              currentUserId={firebaseUser.uid}
            />
          ) : selectedSport === 'Ranking' ? (
            <Leaderboard
              entries={liveLeaderboard}
              currentUserId={firebaseUser.uid}
              loading={leaderboardLoading}
              permissionError={leaderboardPermissionError}
            />
          ) : selectedSport === 'Cassino' ? (() => {
            const CASINO_GAMES = [
              { id: 'mines', name: 'Mines Omnitrix', icon: '💎', desc: 'Campo minado 5×5 — encontre os cristais e saque quando quiser', accent: 'rgba(0,255,135,0.45)', glow: 'rgba(0,255,135,0.22)', chip: '💣', badge: '⚡ NOVO • RTP 98%', meta: '5×5 Grade', category: 'originals' as const },
              { id: 'fortunetiger', name: 'Fortune Tiger', icon: '🐯', desc: 'Slot 3×3 com modo Turbo e multiplicador do tigre', accent: 'rgba(234,179,8,0.42)', glow: 'rgba(234,179,8,0.2)', chip: '🧧', badge: '🔥 Top #1', meta: 'Max 80×', category: 'slots' as const },
              { id: 'aviator', name: 'Aviator Crash', icon: '📈', desc: 'Multiplicador crescente com Auto Cashout em tempo real', accent: 'rgba(6,182,212,0.42)', glow: 'rgba(6,182,212,0.2)', chip: '✈️', badge: '🔥 Crash ao Vivo', meta: 'Auto Saque', category: 'originals' as const },
              { id: 'basketball', name: 'Basquete Street 3×', icon: '🏀', desc: 'Acerte a cesta com RNG por distância, Chuá e Money Ball +25%', accent: 'rgba(249,115,22,0.45)', glow: 'rgba(249,115,22,0.24)', chip: '🏀', badge: '🏀 NOVO • Chuá & Money Ball', meta: '5 Arremessos', category: 'slots' as const },
              { id: 'plinko', name: 'Pirâmide Plinko', icon: '🟣', desc: 'Solte bolas em rajada pelos pinos até 130×', accent: 'rgba(217,70,239,0.42)', glow: 'rgba(217,70,239,0.22)', chip: '🔺', badge: '⚡ NOVO • Max 130×', meta: '8–16 Linhas', category: 'originals' as const },
              { id: 'double', name: 'Double 14×', icon: '⏳', desc: 'Roleta de cores rápida: Vermelho/Preto 2× ou Branco 14×', accent: 'rgba(244,63,94,0.42)', glow: 'rgba(244,63,94,0.22)', chip: '⚫', badge: '⚡ NOVO • 14× Branco', meta: '15 Casas', category: 'originals' as const },
              { id: 'penalty', name: 'Pênalti Campeão', icon: '⚽', desc: 'Escolha o canto, drible o goleiro e multiplique até 79×', accent: 'rgba(16,185,129,0.42)', glow: 'rgba(16,185,129,0.22)', chip: '🥅', badge: '⚽ NOVO • 79× Max', meta: '5 Chutes', category: 'slots' as const },
              { id: 'blackjack', name: 'Blackjack 21', icon: '🃏', desc: 'Estratégia clássica contra o dealer com Dobrar', accent: 'rgba(34,197,94,0.38)', glow: 'rgba(34,197,94,0.18)', chip: '♠️', badge: '♠️ Clássico', meta: 'Paga 2.5×', category: 'table' as const },
              { id: 'roulette', name: 'Roleta Europeia', icon: '🎡', desc: 'Roda europeia 0–36 com histórico dos últimos resultados', accent: 'rgba(225,29,72,0.4)', glow: 'rgba(225,29,72,0.2)', chip: '🔴', badge: '🎡 Clássico', meta: 'Paga 35:1', category: 'table' as const },
              { id: 'dice', name: 'Dados 3D RNG', icon: '🎲', desc: 'Dados 3D com probabilidades transparentes e multiplicador 35×', accent: 'rgba(245,158,11,0.4)', glow: 'rgba(245,158,11,0.2)', chip: '⚀', badge: '🎲 Mesa 3D', meta: 'Até 35×', category: 'table' as const },
            ];
            const filteredGames = casinoCategory === 'all' ? CASINO_GAMES : CASINO_GAMES.filter((g) => g.category === casinoCategory);
            return (
              <div className="space-y-5">
                {selectedCasinoGame === null ? (
                  <>
                    <div className="omnitrix-panel relative overflow-hidden p-3.5 sm:p-5 rounded-2xl">
                      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent pointer-events-none" />
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,135,0.12),transparent_60%)] pointer-events-none" />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="bg-brand/15 p-2.5 sm:p-3 rounded-xl border border-brand/30 shadow-[0_0_16px_rgba(0,255,135,0.2)]">
                            <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                          </div>
                          <div>
                            <h3 className="font-extrabold font-display text-white text-sm sm:text-base flex items-center gap-2">
                              🎰 Cassino BenBets
                              <span className="text-[9px] font-mono bg-brand/15 text-brand border border-brand/30 px-2 py-0.5 rounded-full">
                                10 Jogos Originais & Clássicos
                              </span>
                            </h3>
                            <p className="text-slate-400 text-[10px] sm:text-xs">
                              Basquete Street, Mines, Plinko, Double, Pênaltis, Aviator, Fortune Tiger e clássicos com RNG demonstrativo.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Filtros por categoria */}
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { id: 'all' as const, label: 'Todos (10)', icon: '✨' },
                        { id: 'originals' as const, label: 'Crash & Originais', icon: '⚡' },
                        { id: 'slots' as const, label: 'Slots & Arcade', icon: '🐯' },
                        { id: 'table' as const, label: 'Clássicos de Mesa', icon: '♠️' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCasinoCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer ${
                            casinoCategory === cat.id
                              ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_12px_rgba(0,255,135,0.22)]'
                              : 'bg-[#0d0e16]/75 border-[#1a1c2a] text-slate-300 hover:border-brand/40'
                          }`}
                        >
                          {cat.icon} {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                      {filteredGames.map((game) => (
                        <button
                          key={game.id}
                          onClick={() => setSelectedCasinoGame(game.id)}
                          className="game-card relative p-4 sm:p-5 text-left cursor-pointer group flex flex-col justify-between"
                          style={{ '--card-accent': game.accent, '--card-glow': game.glow } as React.CSSProperties}
                        >
                          <div className="game-card-corner" style={{ background: game.accent.replace(/[\d.]+\)$/, '0.08)') }} />
                          <div className="relative z-10">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-3xl sm:text-4xl game-card-icon">{game.icon}</span>
                              <span className="text-[9px] font-mono font-bold bg-[#070910] text-slate-300 border border-white/10 px-2 py-0.5 rounded-md">
                                {game.meta}
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-extrabold font-display text-white group-hover:text-brand transition-colors mb-1">
                              {game.name}
                            </h4>
                            <p className="text-[9px] sm:text-[11px] text-slate-400 leading-relaxed mb-3">{game.desc}</p>
                            {game.badge && (
                              <span className="inline-block text-[8px] font-bold bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full mb-3">
                                {game.badge}
                              </span>
                            )}
                          </div>
                          <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/5 game-card-play">
                            <span className="text-[8px] sm:text-[9px] text-brand/85 uppercase tracking-[0.12em] font-bold">Jogar Agora</span>
                            <span className="text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => setSelectedCasinoGame(null)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition-colors cursor-pointer"
                      >
                        ← Voltar ao Lobby do Cassino
                      </button>
                      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                        {CASINO_GAMES.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedCasinoGame(g.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                              selectedCasinoGame === g.id
                                ? 'bg-brand text-slate-950 border-brand font-extrabold'
                                : 'bg-[#080a12] border-[#1a1d2e] text-slate-400 hover:text-white hover:border-brand/35'
                            }`}
                          >
                            {g.icon} {g.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedCasinoGame === 'mines' && (
                      <MinesGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'plinko' && (
                      <PlinkoGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'double' && (
                      <DoubleGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'penalty' && (
                      <PenaltyGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'basketball' && (
                      <BasketballGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'aviator' && (
                      <CrashGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'blackjack' && (
                      <BlackjackGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'roulette' && (
                      <RouletteGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'dice' && (
                      <DiceGame balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                    {selectedCasinoGame === 'fortunetiger' && (
                      <FortuneTiger balance={balance} onUpdateBalance={handleDepositSuccess} onAddBetHistory={handleAddPlacedBet} userId={firebaseUser?.uid || ''} />
                    )}
                  </div>
                )}
              </div>
            );
          })() : selectedSport === 'Colecionaveis' ? (
            <div className="space-y-6">
              {selectedColecionavel === null ? (
                <>
                  <div className="omnitrix-panel relative overflow-hidden p-3.5 sm:p-5 rounded-2xl border-purple-500/20">
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.12),transparent_60%)] pointer-events-none" />
                    <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                      <div className="bg-purple-500/15 p-2.5 sm:p-3 rounded-xl border border-purple-500/30 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
                        <Star className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold font-display text-white text-sm sm:text-base">💎 Colecionáveis & Gacha</h3>
                        <p className="text-slate-400 text-[10px] sm:text-xs">Abra pacotes e colecione personagens, cartas, skins e figurinhas com APIs reais!</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { id: 'Anime', name: 'Mudae Anime Bot', icon: '🤖', desc: 'Roletas $wa / $ha, casamento exclusivo no servidor, Torre R$ e Wishlist', accent: 'rgba(168,85,247,0.45)', glow: 'rgba(168,85,247,0.22)', chip: '💖', badge: 'Mudae + AniList API' },
                      { id: 'Pokemon', name: 'Pokémon TCG', icon: '🃏', desc: 'Cartas com raridades, mercado e coleção', accent: 'rgba(245,158,11,0.4)', glow: 'rgba(245,158,11,0.2)', chip: '💥', badge: 'TCGdex CDN' },
                      { id: 'CS2', name: 'CS2 Cases', icon: '🔫', desc: '25 caixas Panorama com Float real (0.00–1.00) e StatTrak™', accent: 'rgba(249,115,22,0.4)', glow: 'rgba(249,115,22,0.2)', chip: '🎯', badge: 'CSGO-API CDN' },
                      { id: 'Kpop', name: 'K-pop Photocards', icon: '🎤', desc: 'Álbuns, Máquina Lucky Draw e Polaroids Assinadas 1/1 (0,5%) de 23 grupos', accent: 'rgba(236,72,153,0.4)', glow: 'rgba(236,72,153,0.2)', chip: '🎵', badge: 'Commons + Wiki API' },
                      { id: 'Copa', name: 'Copa do Mundo', icon: '🌍', desc: 'Álbum de figurinhas da Copa 2026 com craques', accent: 'rgba(16,185,129,0.4)', glow: 'rgba(16,185,129,0.2)', chip: '⚽', badge: 'SportsDB + Flags' },
                      { id: 'LoL', name: 'Baús LoL', icon: '⚔️', desc: 'Campeões e skins oficiais de League of Legends', accent: 'rgba(59,130,246,0.4)', glow: 'rgba(59,130,246,0.2)', chip: '🏆', badge: 'Riot DataDragon' },
                      { id: 'AkaliSanctum', name: 'Santuário: Akali', icon: '🗡️', desc: 'Gacha oficial do LoL: Akali K/DA FIRESTARTER com 0,5% de chance e Pity em 40 (16.000 RP)', accent: 'rgba(244,63,94,0.45)', glow: 'rgba(244,63,94,0.24)', chip: '🔥', badge: '🔥 NOVO • 0,5%' },
                    ].map(game => (
                      <button key={game.id} onClick={() => setSelectedColecionavel(game.id)}
                        className="game-card relative p-4 sm:p-5 text-left cursor-pointer group"
                        style={{ '--card-accent': game.accent, '--card-glow': game.glow } as React.CSSProperties}>
                        <div className="game-card-corner" style={{ background: game.accent.replace('0.4', '0.06') }} />
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <span className="text-3xl sm:text-4xl game-card-icon">{game.icon}</span>
                            <span className="text-lg sm:text-xl game-card-chip">{game.chip}</span>
                          </div>
                          <h4 className="text-sm sm:text-base font-extrabold font-display text-white group-hover:text-purple-300 transition-colors mb-1">{game.name}</h4>
                          <p className="text-[9px] sm:text-[11px] text-slate-400 leading-relaxed mb-3">{game.desc}</p>
                          {game.badge && (
                            <span className="inline-block text-[8px] font-mono font-bold bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full mb-3">{game.badge}</span>
                          )}
                          <div className="flex items-center gap-1.5 game-card-play">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <span className="text-[8px] sm:text-[9px] text-purple-400/80 uppercase tracking-[0.1em] font-bold">Abrir</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <button onClick={() => setSelectedColecionavel(null)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-purple-400 mb-4 transition-colors cursor-pointer">
                    ← Voltar aos Colecionáveis
                  </button>
                  {selectedColecionavel === 'Pokemon' && (
                    <PokemonTCG
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      userId={firebaseUser?.uid || ''}
                      collection={pokemonCollection}
                      onCollectionUpdate={handlePokemonCollectionUpdate}
                      onSellCard={handleSellPokemonCard}
                      onSellAllDuplicates={handleSellAllDuplicates}
                    />
                  )}
                  {selectedColecionavel === 'CS2' && (
                    <CS2Cases
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      onAddBetHistory={handleAddPlacedBet}
                      userId={firebaseUser?.uid || ''}
                      collection={cs2Collection}
                      onCollectionUpdate={handleCS2CollectionUpdate}
                      onSellCard={handleSellCS2Card}
                      onSellAllDuplicates={handleSellAllCS2Duplicates}
                    />
                  )}
                  {selectedColecionavel === 'Copa' && (
                    <WorldCupAlbum
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      userId={firebaseUser?.uid || ''}
                      collection={worldCupCollection}
                      onCollectionUpdate={handleWorldCupCollectionUpdate}
                      onSellCard={handleSellWorldCupSticker}
                      onSellAllDuplicates={handleSellAllWorldCupDuplicates}
                    />
                  )}
                  {selectedColecionavel === 'Kpop' && (
                    <KpopPhotocards
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      onAddBetHistory={handleAddPlacedBet}
                      userId={firebaseUser?.uid || ''}
                      collection={kpopCollection}
                      onCollectionUpdate={handleKpopCollectionUpdate}
                      onSellCard={handleSellKpopCard}
                      onSellAllDuplicates={handleSellAllKpopDuplicates}
                    />
                  )}
                  {selectedColecionavel === 'Anime' && (
                    <AnimeGacha
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      onAddBetHistory={handleAddPlacedBet}
                      userId={firebaseUser?.uid || ''}
                      userName={userName || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Jogador'}
                      collection={animeCollection}
                      onCollectionUpdate={handleAnimeCollectionUpdate}
                      onSellCard={handleSellAnimeCard}
                      onSellAllDuplicates={handleSellAllAnimeDuplicates}
                      onClearLocalCollection={() => setAnimeCollection([])}
                    />
                  )}
                  {(selectedColecionavel === 'LoL' || selectedColecionavel === 'AkaliSanctum') && (
                    <LoLChests
                      balance={balance}
                      onUpdateBalance={handleDepositSuccess}
                      onAddBetHistory={handleAddPlacedBet}
                      userId={firebaseUser?.uid || ''}
                      initialTab={selectedColecionavel === 'AkaliSanctum' ? 'sanctum' : 'chests'}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            // SPORTS BOOK LIST DISPLAY
            <div className="space-y-4">

              {/* Live Sportsbook Overview Bar + Status Filter */}
              <div className="omnitrix-panel rounded-2xl p-3 sm:p-4 border-brand/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                    <Activity className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2 flex-wrap">
                      Sportsbook ao Vivo & Campeonatos
                      <span className="text-[9px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                        {liveMatchesCount} Ao Vivo
                      </span>
                      <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                        {availableLeagues.length} Campeonatos
                      </span>
                      {realMatchesCount > 0 && (
                        <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 px-2 py-0.5 rounded-full">
                          🟢 API ESPN • {realMatchesCount} Jogos Reais (BR & NHL)
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Jogos reais do futebol brasileiro e NHL com escudos, placares e odds dinâmicas + cobertura em 7 esportes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap items-center">
                  <button
                    type="button"
                    onClick={() => syncRealMatches(true)}
                    disabled={loadingRealMatches}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer transition-all flex items-center gap-1 disabled:opacity-60"
                    title="Atualizar jogos reais do futebol brasileiro e NHL"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingRealMatches ? 'animate-spin' : ''}`} />
                    <span>Atualizar API</span>
                  </button>
                  {[
                    { id: 'all' as const, label: `🌐 Todos (${sportScopedMatches.length})` },
                    { id: 'live' as const, label: `🔴 Ao Vivo (${liveMatchesCount})` },
                    { id: 'upcoming' as const, label: `📅 Pré-Jogo (${upcomingMatchesCount})` },
                    { id: 'finished' as const, label: `🏁 Encerrados (${finishedMatchesCount})` },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setMatchStatusFilter(st.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                        matchStatusFilter === st.id
                          ? 'bg-brand text-slate-950 border-brand font-extrabold'
                          : 'bg-[#080a12] border-[#1a1d2e] text-slate-300 hover:border-brand/35'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Esquema Oficial de Apostas Esportivas Reais (1X2 — Tempo Regulamentar) */}
              <div className="bg-[#080b14] border border-brand/25 rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] font-extrabold text-white flex items-center gap-1.5">
                    <span>📖</span>
                    <span>Como Funcionam as Apostas Reais (Mercado 1X2 — Resultado Final)</span>
                  </p>
                  <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    ⏱️ Só liquida ao Apito Final (Fim de Jogo)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-300">
                  <div className="bg-[#05070d] border border-[#1a1f32] rounded-xl px-2.5 py-2">
                    <strong className="text-brand font-mono">1 (Casa):</strong> Ganha somente se o mandante terminar na frente ao fim da partida.
                  </div>
                  <div className="bg-[#05070d] border border-[#1a1f32] rounded-xl px-2.5 py-2">
                    <strong className="text-amber-300 font-mono">X (Empate):</strong> Só vence se o jogo <strong>acabar empatado no apito final</strong> (empatar no meio não paga).
                  </div>
                  <div className="bg-[#05070d] border border-[#1a1f32] rounded-xl px-2.5 py-2">
                    <strong className="text-sky-300 font-mono">2 (Fora):</strong> Ganha somente se o visitante terminar na frente no placar final.
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  💡 Clique em qualquer odd (<strong className="text-white">1</strong>, <strong className="text-white">X</strong> ou <strong className="text-white">2</strong>) para digitar o valor e confirmar <strong className="text-brand">direto no card do jogo</strong>!
                </p>
              </div>

              {/* Sport sub-tabs for Todos os Esportes */}
              {selectedSport === 'Todos' && (
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { id: 'todas', label: 'Todas', icon: '📋' },
                    { id: 'Futebol', label: 'Futebol', icon: '⚽' },
                    { id: 'Basquete', label: 'Basquete', icon: '🏀' },
                    { id: 'Hóquei', label: 'Hóquei', icon: '🏒' },
                    { id: 'E-Sports', label: 'E-Sports', icon: '🎮' },
                    { id: 'Tênis', label: 'Tênis', icon: '🎾' },
                    { id: 'MMA', label: 'MMA', icon: '🥊' },
                    { id: 'Vôlei', label: 'Vôlei', icon: '🏐' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSportFilter(s.id);
                        setLeagueFilter('todas');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                        sportFilter === s.id
                          ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_12px_rgba(0,255,135,0.2)]'
                          : 'bg-[#0d0e16]/75 border-[#1a1c2a] text-slate-300 hover:border-brand/30'
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Championship Filter Chips */}
              {availableLeagues.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    onClick={() => setLeagueFilter('todas')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                      leagueFilter === 'todas'
                        ? 'bg-brand/15 border-brand/50 text-brand'
                        : 'bg-[#080a12] border-[#1a1d2d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🏆 Todos Campeonatos ({sportScopedMatches.length})
                  </button>
                  {availableLeagues.map((lg) => (
                    <button
                      key={lg.league}
                      onClick={() => setLeagueFilter(lg.league)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                        leagueFilter === lg.league
                          ? 'bg-brand/15 border-brand/50 text-brand'
                          : 'bg-[#080a12] border-[#1a1d2d] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lg.flag} {lg.league} ({lg.count})
                    </button>
                  ))}
                </div>
              )}

              {/* Search match input */}
              <div className="flex gap-2.5 items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar partida, time, estádio ou campeonato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-500 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Header Titles */}
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand shrink-0 animate-pulse" />
                  Confrontos ({filteredMatches.length})
                </h2>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-mono">ODDS DINÂMICAS • TEMPO REAL</span>
              </div>

              {/* Matches Grouped by Championship */}
              <div className="space-y-4">
                {groupedMatches.length === 0 ? (
                  <div className="bg-[#0d0e16] p-12 rounded-2xl border border-[#1a1c2a] text-center space-y-2">
                    <p className="text-slate-400 text-xs">Nenhuma partida encontrada para os filtros selecionados.</p>
                    <button
                      onClick={() => {
                        setMatchStatusFilter('all');
                        setLeagueFilter('todas');
                        setSearchQuery('');
                      }}
                      className="text-xs font-bold text-brand hover:underline cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  groupedMatches.map((group) => (
                    <div key={group.league} className="space-y-2.5">
                      {/* Championship Group Header */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#090b13] border border-[#1c2033]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{group.flag}</span>
                          <span className="text-xs font-extrabold font-display text-white truncate">
                            {group.league}
                          </span>
                          <span className="text-[9px] font-mono bg-[#121626] text-brand/90 px-1.5 py-0.5 rounded border border-brand/20 shrink-0">
                            {group.sport}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {group.items.length} {group.items.length === 1 ? 'jogo' : 'jogos'}
                        </span>
                      </div>

                      {group.items.map((match) => {
                        const homeBadge = match.badgeHome || match.teamHome.slice(0, 3).toUpperCase();
                        const awayBadge = match.badgeAway || match.teamAway.slice(0, 3).toUpperCase();
                        const homeColor = match.colorHome || '#00ff87';
                        const awayColor = match.colorAway || '#94a3b8';
                        const totalShotsStat = (match.stats?.shotsHome ?? 0) + (match.stats?.shotsAway ?? 0);
                        const posHome =
                          match.stats?.possessionHome ??
                          (totalShotsStat > 0 && match.stats?.detailLabel
                            ? Math.round(((match.stats?.shotsHome ?? 0) / totalShotsStat) * 100)
                            : undefined);
                        const isQuickOpen = activeQuickBet?.matchId === match.id && !match.isFinished;
                        const selectedQuickType = isQuickOpen ? activeQuickBet.type : null;
                        const quickOdd =
                          selectedQuickType === 'home'
                            ? match.odds.home
                            : selectedQuickType === 'draw'
                              ? (match.odds.draw ?? 1)
                              : selectedQuickType === 'away'
                                ? match.odds.away
                                : 1;
                        const quickLabel =
                          selectedQuickType === 'home'
                            ? `${match.teamHome} vence (1)`
                            : selectedQuickType === 'draw'
                              ? 'Empate Final (X)'
                              : `${match.teamAway} vence (2)`;
                        const parsedQuickStake = parseFloat(quickBetStake.replace(',', '.')) || 0;
                        const quickPotentialReturn = Number((parsedQuickStake * quickOdd).toFixed(2));
                        const matchPlacedBets = placedBets.filter(
                          (b) =>
                            b.type === 'sports' &&
                            (b.matchId === match.id ||
                              b.legs?.some((l) => l.matchId === match.id) ||
                              b.matchName === `${match.teamHome} x ${match.teamAway}`)
                        );

                        return (
                          <div
                            key={match.id}
                            className="omnitrix-card rounded-2xl p-3.5 md:p-4 space-y-3 overflow-hidden relative"
                          >
                            <div
                              className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                                match.isFinished
                                  ? 'bg-slate-500'
                                  : match.isLive
                                    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                                    : 'bg-brand/70 shadow-[0_0_10px_rgba(0,255,135,0.35)]'
                              }`}
                            />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                              {/* Left: Meta, Teams, Live Play-by-Play & Stats */}
                              <div className="flex-1 space-y-2 pl-2 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {match.id.startsWith('espn-') && (
                                    <span className="text-[8px] font-mono font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-1.5 py-0.5 rounded uppercase">
                                      🟢 API REAL
                                    </span>
                                  )}
                                  {match.phase && (
                                    <span className="text-[9px] font-mono font-bold text-slate-300 bg-[#111524] px-2 py-0.5 rounded border border-white/10">
                                      {match.phase}
                                    </span>
                                  )}
                                  {match.venue && (
                                    <span className="text-[10px] text-slate-400">
                                      🏟️ {match.venue}
                                    </span>
                                  )}
                                  {match.isFinished ? (
                                    <span className="bg-slate-700/40 text-slate-200 border border-slate-500/40 font-bold px-2 py-0.5 rounded-full text-[8px] uppercase shrink-0">
                                      🏁 Fim de Jogo
                                    </span>
                                  ) : match.isLive ? (
                                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold px-2 py-0.5 rounded-full text-[8px] flex items-center gap-1 uppercase shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                      Ao vivo
                                    </span>
                                  ) : null}
                                </div>

                                {/* Teams & Score */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between md:justify-start gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <TeamCrest name={match.teamHome} badge={homeBadge} color={homeColor} logo={match.logoHome} />
                                      <span className="font-bold text-slate-100 text-sm truncate">{match.teamHome}</span>
                                    </div>
                                    {(match.isLive || match.isFinished) && (
                                      <span className={`font-mono font-black bg-[#06070d] px-2.5 py-0.5 rounded-md text-xs border min-w-[30px] text-center ${
                                        match.isFinished ? 'text-slate-200 border-slate-600/50' : 'text-rose-400 border-rose-500/30'
                                      }`}>
                                        {match.scoreHome}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between md:justify-start gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <TeamCrest name={match.teamAway} badge={awayBadge} color={awayColor} logo={match.logoAway} />
                                      <span className="font-bold text-slate-100 text-sm truncate">{match.teamAway}</span>
                                    </div>
                                    {(match.isLive || match.isFinished) && (
                                      <span className={`font-mono font-black bg-[#06070d] px-2.5 py-0.5 rounded-md text-xs border min-w-[30px] text-center ${
                                        match.isFinished ? 'text-slate-200 border-slate-600/50' : 'text-rose-400 border-rose-500/30'
                                      }`}>
                                        {match.scoreAway}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Time, Play-by-Play Ticker & Stats Bar */}
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                  <span>{match.time}</span>
                                  {(match.isLive || match.isFinished) && match.timeElapsed && (
                                    <>
                                      <span className="text-slate-600">•</span>
                                      <span className={`font-mono text-xs font-bold ${match.isFinished ? 'text-slate-300' : 'text-rose-400'}`}>
                                        {match.timeElapsed}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {match.liveEvent && (
                                  <div
                                    className={`bg-[#070911] rounded-lg px-2.5 py-1 text-[10px] truncate border ${
                                      match.isLive ? 'border-brand/20 text-slate-200' : 'border-[#1a1f30] text-slate-400'
                                    }`}
                                  >
                                    {match.liveEvent}
                                  </div>
                                )}

                                {match.isLive && posHome !== undefined && (
                                  <div className="space-y-1 pt-0.5 max-w-sm">
                                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                      <span>{posHome}%</span>
                                      <span className="text-slate-500">{match.stats?.detailLabel || 'Domínio'} ({match.stats?.shotsHome ?? 0} × {match.stats?.shotsAway ?? 0})</span>
                                      <span>{100 - posHome}%</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-[#131726] overflow-hidden flex">
                                      <div className="bg-brand/80 h-full transition-all duration-500" style={{ width: `${posHome}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right: Interactive Odds Buttons */}
                              <div className="flex gap-2 md:self-center pl-2 md:pl-0 shrink-0">
                                <button
                                  type="button"
                                  disabled={Boolean(match.isFinished)}
                                  onClick={() => handleOddsClick(match, 'home')}
                                  className={`flex-1 md:w-24 py-2.5 px-3 rounded-xl border text-center transition-all duration-200 flex flex-col justify-center items-center ${
                                    match.isFinished
                                      ? 'opacity-45 bg-[#06070d] border-[#1c1e2d] text-slate-500 cursor-not-allowed'
                                      : (isQuickOpen && selectedQuickType === 'home') || selections.some(s => s.matchId === match.id && s.type === 'home')
                                        ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_18px_rgba(0,255,135,0.4)] scale-[1.02] cursor-pointer'
                                        : 'bg-[#06070d] hover:bg-[#111524] hover:border-brand/40 text-slate-300 border-[#1c1e2d] cursor-pointer'
                                  }`}
                                >
                                  <span className={`text-[9px] uppercase font-bold ${(isQuickOpen && selectedQuickType === 'home') || selections.some(s => s.matchId === match.id && s.type === 'home') ? 'text-slate-900' : 'text-slate-500'}`}>1</span>
                                  <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.home.toFixed(2)}</span>
                                  <span className="text-[8px] block opacity-70 font-sans tracking-wide mt-0.5">{homeBadge}</span>
                                </button>

                                {match.odds.draw !== undefined && (
                                  <button
                                    type="button"
                                    disabled={Boolean(match.isFinished)}
                                    onClick={() => handleOddsClick(match, 'draw')}
                                    className={`flex-1 md:w-24 py-2.5 px-3 rounded-xl border text-center transition-all duration-200 flex flex-col justify-center items-center ${
                                      match.isFinished
                                        ? 'opacity-45 bg-[#06070d] border-[#1c1e2d] text-slate-500 cursor-not-allowed'
                                        : (isQuickOpen && selectedQuickType === 'draw') || selections.some(s => s.matchId === match.id && s.type === 'draw')
                                          ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_18px_rgba(0,255,135,0.4)] scale-[1.02] cursor-pointer'
                                          : 'bg-[#06070d] hover:bg-[#111524] hover:border-brand/40 text-slate-300 border-[#1c1e2d] cursor-pointer'
                                    }`}
                                  >
                                    <span className={`text-[9px] uppercase font-bold ${(isQuickOpen && selectedQuickType === 'draw') || selections.some(s => s.matchId === match.id && s.type === 'draw') ? 'text-slate-900' : 'text-slate-500'}`}>X</span>
                                    <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.draw.toFixed(2)}</span>
                                    <span className="text-[8px] block opacity-70 font-sans tracking-wide mt-0.5">Empate</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={Boolean(match.isFinished)}
                                  onClick={() => handleOddsClick(match, 'away')}
                                  className={`flex-1 md:w-24 py-2.5 px-3 rounded-xl border text-center transition-all duration-200 flex flex-col justify-center items-center ${
                                    match.isFinished
                                      ? 'opacity-45 bg-[#06070d] border-[#1c1e2d] text-slate-500 cursor-not-allowed'
                                      : (isQuickOpen && selectedQuickType === 'away') || selections.some(s => s.matchId === match.id && s.type === 'away')
                                        ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_18px_rgba(0,255,135,0.4)] scale-[1.02] cursor-pointer'
                                        : 'bg-[#06070d] hover:bg-[#111524] hover:border-brand/40 text-slate-300 border-[#1c1e2d] cursor-pointer'
                                  }`}
                                >
                                  <span className={`text-[9px] uppercase font-bold ${(isQuickOpen && selectedQuickType === 'away') || selections.some(s => s.matchId === match.id && s.type === 'away') ? 'text-slate-900' : 'text-slate-500'}`}>2</span>
                                  <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.away.toFixed(2)}</span>
                                  <span className="text-[8px] block opacity-70 font-sans tracking-wide mt-0.5">{awayBadge}</span>
                                </button>
                              </div>
                            </div>

                            {/* Inline Direct Bet Panel right inside the Match Card */}
                            {isQuickOpen && selectedQuickType && (
                              <div className="ml-2 bg-[#070912] border border-brand/40 rounded-xl p-3 space-y-2.5 shadow-[0_0_20px_rgba(0,255,135,0.08)]">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-black text-brand">🎯 {quickLabel}</span>
                                    <span className="font-mono font-bold bg-brand/15 text-brand border border-brand/30 px-2 py-0.5 rounded-md text-[11px]">
                                      @{quickOdd.toFixed(2)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-amber-300">
                                    🏁 Apurado somente no Fim de Jogo
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="flex items-center gap-1.5 bg-[#04050a] border border-[#222840] rounded-lg px-2.5 py-1.5 sm:w-40">
                                    <span className="text-xs font-mono font-bold text-slate-400">R$</span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={quickBetStake}
                                      onChange={(e) => setQuickBetStake(e.target.value)}
                                      placeholder="Valor"
                                      className="w-full bg-transparent text-sm font-mono font-bold text-white outline-none"
                                      autoFocus
                                    />
                                  </div>

                                  <div className="flex flex-wrap gap-1 flex-1">
                                    {[5, 10, 25, 50, 100, 250].map((v) => (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setQuickBetStake(String(v))}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                                          Number(quickBetStake) === v
                                            ? 'bg-brand/20 border-brand text-brand'
                                            : 'bg-[#0b0e18] border-[#1f2438] text-slate-300 hover:border-brand/40'
                                        }`}
                                      >
                                        R${v}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setQuickBetStake(String(Math.floor(Math.max(1, balance))))}
                                      className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-black bg-amber-500/15 border border-amber-400/40 text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                                    >
                                      MAX
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                                  <div className="text-[11px] font-mono text-slate-300">
                                    Retorno se vencer no Fim de Jogo:{' '}
                                    <strong className="text-brand text-sm">R$ {quickPotentialReturn.toFixed(2)}</strong>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAddToSlipCombo(match, selectedQuickType, quickOdd)}
                                      className="px-3 py-2 rounded-lg bg-[#101526] hover:bg-[#182038] border border-[#2a3352] text-[11px] font-bold text-slate-200 cursor-pointer transition-all"
                                      title="Adicionar ao Cupom lateral para fazer aposta Múltipla (+15% bônus)"
                                    >
                                      + Múltipla (Cupom)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={parsedQuickStake <= 0 || parsedQuickStake > balance}
                                      onClick={() => handleConfirmQuickBet(match, selectedQuickType, quickOdd)}
                                      className="px-4 py-2 rounded-lg bg-brand hover:bg-[#00e276] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-[0_0_14px_rgba(0,255,135,0.2)]"
                                    >
                                      ✅ Confirmar Aposta
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Inline confirmation toast for this match */}
                            {quickBetFeedback?.matchId === match.id && (
                              <div className="ml-2 bg-emerald-500/15 border border-emerald-400/45 text-emerald-200 rounded-xl px-3 py-2 text-[11px] font-bold flex items-center justify-between gap-2">
                                <span>{quickBetFeedback.text}</span>
                                <button
                                  type="button"
                                  onClick={() => setQuickBetFeedback(null)}
                                  className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            )}

                            {/* Existing bets placed on this match */}
                            {matchPlacedBets.length > 0 && (
                              <div className="ml-2 flex flex-wrap gap-1.5">
                                {matchPlacedBets.slice(0, 3).map((b) => (
                                  <div
                                    key={b.id}
                                    className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                                      b.status === 'won'
                                        ? 'bg-brand/10 border-brand/40 text-brand font-bold'
                                        : b.status === 'lost'
                                          ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                                          : 'bg-amber-500/10 border-amber-400/35 text-amber-200'
                                    }`}
                                  >
                                    <span>
                                      {b.status === 'won' ? '🏆' : b.status === 'lost' ? '❌' : '⏳'}
                                    </span>
                                    <span className="truncate max-w-[260px]">{b.selectionName}</span>
                                    <span>• R$ {b.stake.toFixed(0)} → R$ {b.potentialPayout.toFixed(2)}</span>
                                    {b.status === 'pending' && <span className="text-[9px] opacity-80">(Fim de Jogo)</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                    setSearchQuery('');
                    setLeagueFilter('todas');
                    setSportFilter('Futebol');
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
        <section className="col-span-1 lg:col-span-4 space-y-4 lg:space-y-6 lg:sticky lg:top-20 lg:self-start">
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
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
          />
        )}
      </AnimatePresence>

      {/* Daily Missions Modal */}
      <AnimatePresence>
        {showMissions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowMissions(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <DailyMissions
                userId={firebaseUser.uid}
                missions={missionsRecord}
                onClaim={handleClaimMission}
              />
            </motion.div>
          </motion.div>
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
