import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { PlacedBet, Transaction, PokemonCard } from '../types';

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const ACTIVE_24H_MS = 24 * 60 * 60 * 1000;

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  balance: number;
  totalCards: number;
  uniqueCards: number;
  betsWon: number;
  totalBets: number;
  biggestWin: number;
  lastSeen: number;
  createdAt?: string;
}

export function sanitizePlacedBets(rawBets: any): { bets: PlacedBet[]; repaired: boolean } {
  if (!Array.isArray(rawBets)) return { bets: [], repaired: false };
  let repaired = false;
  const bets: PlacedBet[] = [];

  for (const b of rawBets) {
    if (!b || typeof b !== 'object') {
      repaired = true;
      continue;
    }

    const stakeValid = typeof b.stake === 'number' && Number.isFinite(b.stake) && b.stake >= 0;
    const oddsValid = typeof b.odds === 'number' && Number.isFinite(b.odds) && b.odds >= 0;
    const payoutValid =
      typeof b.potentialPayout === 'number' && Number.isFinite(b.potentialPayout) && b.potentialPayout >= 0;

    if (!stakeValid || !oddsValid || !payoutValid) repaired = true;

    const stake = stakeValid ? b.stake : 0;
    const odds = oddsValid ? b.odds : 1.0;
    const potentialPayout = payoutValid ? b.potentialPayout : b.status === 'won' ? stake : 0;

    let selectionName = typeof b.selectionName === 'string' ? b.selectionName : '';
    if (/NaN/i.test(selectionName)) {
      selectionName = selectionName.replace(/NaNx?/gi, '1.00x');
      repaired = true;
    }

    const cleanBet: PlacedBet = {
      id: String(b.id || `bet-${bets.length}`),
      matchName: String(b.matchName || 'Aposta'),
      selectionName,
      odds,
      stake,
      potentialPayout,
      status: b.status === 'won' || b.status === 'lost' || b.status === 'pending' ? b.status : 'lost',
      placedAt: String(b.placedAt || ''),
      type: b.type === 'sports' || b.type === 'crash' || b.type === 'casino' ? b.type : 'casino',
    };

    if (typeof b.outcomeValue === 'string') {
      let cleanOutcome = b.outcomeValue;
      if (/NaN/i.test(cleanOutcome)) {
        cleanOutcome = /R\$/i.test(cleanOutcome) ? 'R$ 0.00' : '1.00x';
        repaired = true;
      }
      cleanBet.outcomeValue = cleanOutcome;
    }

    bets.push(cleanBet);
  }

  return { bets, repaired };
}

export function recoverValidBalance(
  raw: any,
  sanitizedBets: PlacedBet[]
): { balance: number; repaired: boolean } {
  const rawBal = raw?.balance;
  if (typeof rawBal === 'number' && Number.isFinite(rawBal) && rawBal >= 0) {
    return { balance: rawBal, repaired: false };
  }

  // Saldo corrompido (ex.: NaN/null): recalcula a partir de bônus + transações + apostas válidas
  let est = 20.0;
  const txs: any[] = Array.isArray(raw?.transactions) ? raw.transactions : [];
  for (const tx of txs) {
    if (!tx || typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) continue;
    if (tx.type === 'deposito') est += tx.amount;
    else if (tx.type === 'saque') est -= tx.amount;
  }
  for (const b of sanitizedBets) {
    if (b.status === 'won') {
      est += b.potentialPayout - b.stake;
    } else if (b.status === 'lost' || b.status === 'pending') {
      est -= b.stake;
    }
  }
  const cleanBalance = Math.max(20.0, Number(est.toFixed(2)));
  return { balance: Number.isFinite(cleanBalance) ? cleanBalance : 20.0, repaired: true };
}

export async function getUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data() || {};
  const { bets: cleanBets, repaired: betsRepaired } = sanitizePlacedBets(raw.placedBets);
  const { balance: cleanBalance, repaired: balRepaired } = recoverValidBalance(raw, cleanBets);

  // Auto-cura permanente no Firestore se a conta estava corrompida (ex.: NaN no Aviator)
  if (betsRepaired || balRepaired) {
    updateDoc(ref, {
      balance: cleanBalance,
      placedBets: cleanBets,
    }).catch(() => {});
  }

  return {
    ...raw,
    balance: cleanBalance,
    balanceRepaired: balRepaired,
    placedBets: cleanBets,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    pokemonCollection: Array.isArray(raw.pokemonCollection) ? raw.pokemonCollection : [],
    worldCupCollection: Array.isArray(raw.worldCupCollection) ? raw.worldCupCollection : [],
    kpopCollection: Array.isArray(raw.kpopCollection) ? raw.kpopCollection : [],
    cs2Collection: Array.isArray(raw.cs2Collection) ? raw.cs2Collection : [],
    animeCollection: Array.isArray(raw.animeCollection) ? raw.animeCollection : [],
  } as {
    balance: number;
    balanceRepaired?: boolean;
    displayName?: string;
    placedBets: PlacedBet[];
    transactions: Transaction[];
    pokemonCollection: PokemonCard[];
    worldCupCollection: PokemonCard[];
    kpopCollection: PokemonCard[];
    cs2Collection: PokemonCard[];
    animeCollection: PokemonCard[];
  };
}

export async function createUserData(uid: string, email: string, displayName?: string) {
  const ref = doc(db, 'users', uid);
  const data = {
    email,
    displayName: displayName || email.split('@')[0],
    balance: 20.00,
    placedBets: [],
    transactions: [],
    pokemonCollection: [],
    worldCupCollection: [],
    kpopCollection: [],
    cs2Collection: [],
    animeCollection: [],
    lastSeen: Date.now(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return data;
}

export async function updateBalance(uid: string, newBalance: number) {
  if (typeof newBalance !== 'number' || !Number.isFinite(newBalance) || newBalance < 0) return;
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { balance: Number(newBalance.toFixed(2)), lastSeen: Date.now() });
}

export async function updateUserPresence(uid: string) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { lastSeen: Date.now() });
}

export async function markUserOffline(uid: string) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { lastSeen: 0 });
}

function sumCollectionStats(raw: any): { uniqueCards: number; totalCards: number } {
  const keys = [
    'pokemonCollection',
    'worldCupCollection',
    'kpopCollection',
    'cs2Collection',
    'animeCollection',
  ];
  let uniqueCards = 0;
  let totalCards = 0;
  for (const k of keys) {
    const arr = raw?.[k];
    if (!Array.isArray(arr)) continue;
    uniqueCards += arr.length;
    for (const c of arr) {
      totalCards += typeof c?.quantity === 'number' && c.quantity > 0 ? c.quantity : 1;
    }
  }
  return { uniqueCards, totalCards };
}

export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map((d) => {
        const raw = d.data() || {};
        const fallbackName = raw.email ? String(raw.email).split('@')[0] : 'Agente';
        const displayName = String(raw.displayName || fallbackName || 'Agente').trim() || 'Agente';
        const { bets } = sanitizePlacedBets(raw.placedBets);
        const { balance } = recoverValidBalance(raw, bets);
        const { uniqueCards, totalCards } = sumCollectionStats(raw);

        let betsWon = 0;
        let biggestWin = 0;
        for (const b of bets) {
          if (b?.status === 'won') {
            betsWon += 1;
            const payout = typeof b.potentialPayout === 'number' && Number.isFinite(b.potentialPayout) ? b.potentialPayout : 0;
            if (payout > biggestWin) biggestWin = payout;
          }
        }

        return {
          uid: d.id,
          displayName,
          balance,
          totalCards,
          uniqueCards,
          betsWon,
          totalBets: bets.length,
          biggestWin,
          lastSeen: typeof raw.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
        };
      });
      onUpdate(entries);
    },
    (err) => {
      console.warn('[BenBets] Erro no snapshot da coleção users:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function addBet(uid: string, bet: PlacedBet) {
  const { bets } = sanitizePlacedBets([bet]);
  const cleanBet = bets[0];
  if (!cleanBet) return;
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { placedBets: arrayUnion(cleanBet) });
}

export async function updateBet(uid: string, betId: string, updates: Partial<PlacedBet>) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const bets: PlacedBet[] = data.placedBets || [];
  const updated = bets.map(b => b.id === betId ? { ...b, ...updates } : b);
  await updateDoc(ref, { placedBets: updated });
}

export async function addTransaction(uid: string, tx: Transaction) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { transactions: arrayUnion(tx) });
}

export async function addPokemonCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.pokemonCollection || [];
  const merged: PokemonCard[] = [...existing];

  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) {
      merged[idx].quantity += 1;
    } else {
      merged.push(newCard);
    }
  }

  await updateDoc(ref, { pokemonCollection: merged });
}

export async function removePokemonCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.pokemonCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { pokemonCollection: updated });
}

export async function addWorldCupStickers(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.worldCupCollection || [];
  const merged: PokemonCard[] = [...existing];

  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) {
      merged[idx].quantity += 1;
    } else {
      merged.push(newCard);
    }
  }

  await updateDoc(ref, { worldCupCollection: merged });
}

export async function removeWorldCupSticker(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.worldCupCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { worldCupCollection: updated });
}

export async function setWorldCupCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { worldCupCollection: cards });
}

export async function addKpopCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.kpopCollection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { kpopCollection: merged });
}

export async function removeKpopCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.kpopCollection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { kpopCollection: updated });
}

export async function addCS2Cards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.cs2Collection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { cs2Collection: merged });
}

export async function removeCS2Card(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.cs2Collection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { cs2Collection: updated });
}

export async function getAnimeGachaPackData(uid: string): Promise<{ count: number; firstPackTime: number }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { count: 0, firstPackTime: 0 };
  const data = snap.data();
  return {
    count: data.animeGachaPacksOpened || 0,
    firstPackTime: data.animeGachaFirstPackTime || 0,
  };
}

export async function recordAnimeGachaPack(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const now = Date.now();
  const firstPackTime = data.animeGachaFirstPackTime || 0;
  const count = data.animeGachaPacksOpened || 0;
  const HOUR_MS = 3600000;

  if (now - firstPackTime >= HOUR_MS) {
    await updateDoc(ref, { animeGachaFirstPackTime: now, animeGachaPacksOpened: 1 });
  } else {
    await updateDoc(ref, { animeGachaPacksOpened: count + 1 });
  }
}

export async function addAnimeCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { animeCollection: merged });
}

export async function removeAnimeCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { animeCollection: updated });
}

export async function setAnimeCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { animeCollection: cards });
}

// Admin
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => {
    const raw = d.data() || {};
    const { bets } = sanitizePlacedBets(raw.placedBets);
    const { balance } = recoverValidBalance(raw, bets);
    return { uid: d.id, ...raw, balance, placedBets: bets } as any;
  });
}

export async function adminSetBalance(uid: string, balance: number) {
  if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) return;
  await updateDoc(doc(db, 'users', uid), { balance: Number(balance.toFixed(2)) });
}

// Daily Missions
export interface Mission {
  id: string;
  title: string;
  desc: string;
  icon: string;
  target: number;
  reward: number;
}

export interface MissionProgress {
  current: number;
  completed: boolean;
  claimed: boolean;
  date: string;
}

export const DAILY_MISSIONS: Mission[] = [
  { id: 'blackjack_wins', title: 'Mestre do Blackjack', desc: 'Ganhe 3 mãos de blackjack', icon: '🃏', target: 3, reward: 10 },
  { id: 'crash_cashout', title: 'Aviador', desc: 'Faça cashout 2 vezes', icon: '✈️', target: 2, reward: 8 },
  { id: 'roulette_spins', title: 'Roleta', desc: 'Gire a roleta 5 vezes', icon: '🎡', target: 5, reward: 6 },
  { id: 'dice_rolls', title: 'Dados', desc: 'Jogue os dados 3 vezes', icon: '🎲', target: 3, reward: 5 },
  { id: 'fortune_spins', title: 'Tigre da Sorte', desc: 'Gire o Fortune Tiger 3 vezes', icon: '🐯', target: 3, reward: 7 },
  { id: 'pokemon_packs', title: 'Pokémon Trainer', desc: 'Abra 2 pacotes Pokémon', icon: '⚡', target: 2, reward: 12 },
];

export async function getMissions(uid: string): Promise<Record<string, MissionProgress>> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  const saved = data.missions || {};
  const today = new Date().toDateString();
  // Reset if outdated
  for (const key of Object.keys(saved)) {
    if (saved[key].date !== today) delete saved[key];
  }
  return saved;
}

export async function updateMissionProgress(uid: string, missionId: string, increment: number) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const missions: Record<string, MissionProgress> = data.missions || {};
  const today = new Date().toDateString();
  let m = missions[missionId];
  // Reset diário: se a missão pertence a outro dia, zera o progresso
  if (!m || m.date !== today) {
    m = { current: 0, completed: false, claimed: false, date: today };
  }
  if (m.completed && !m.claimed) return; // waiting claim
  if (m.claimed) return; // already done
  m.current += increment;
  m.date = today;
  const missionDef = DAILY_MISSIONS.find(x => x.id === missionId);
  if (missionDef && m.current >= missionDef.target) m.completed = true;
  missions[missionId] = m;
  await updateDoc(ref, { missions });
}

export async function claimMissionReward(uid: string, missionId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const missions: Record<string, MissionProgress> = data.missions || {};
  const today = new Date().toDateString();
  const m = missions[missionId];
  // Só permite resgate do dia atual (reset a cada 24h acontece em getMissions/updateMissionProgress)
  if (!m || m.date !== today || !m.completed || m.claimed) return;
  const missionDef = DAILY_MISSIONS.find(x => x.id === missionId);
  if (!missionDef) return;
  m.claimed = true;
  const { bets } = sanitizePlacedBets(data.placedBets);
  const { balance: baseBal } = recoverValidBalance(data, bets);
  await updateDoc(ref, { missions, balance: Number((baseBal + missionDef.reward).toFixed(2)), lastSeen: Date.now() });
}
