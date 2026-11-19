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

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
  rawBalanceWasInvalid: boolean;
  createdAt?: string;
  lastSeen: number;
  placedBets: PlacedBet[];
  transactions: Transaction[];
  pokemonCollection: PokemonCard[];
  worldCupCollection: PokemonCard[];
  kpopCollection: PokemonCard[];
  cs2Collection: PokemonCard[];
  animeCollection: PokemonCard[];
  totalCards: number;
  uniqueCards: number;
  betsWon: number;
  biggestWin: number;
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

function mapDocToAdminRecord(uid: string, raw: any): { record: AdminUserRecord; needsRepair: boolean } {
  const email = typeof raw?.email === 'string' ? raw.email : '';
  const fallbackName = email ? email.split('@')[0] : 'Agente';
  const displayName = String(raw?.displayName || fallbackName || 'Agente').trim() || 'Agente';
  const { bets, repaired: betsRepaired } = sanitizePlacedBets(raw?.placedBets);
  const { balance, repaired: balRepaired } = recoverValidBalance(raw, bets);
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
    needsRepair: betsRepaired || balRepaired,
    record: {
      uid,
      email,
      displayName,
      balance,
      rawBalanceWasInvalid: balRepaired,
      createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : undefined,
      lastSeen: typeof raw?.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0,
      placedBets: bets,
      transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
      pokemonCollection: Array.isArray(raw?.pokemonCollection) ? raw.pokemonCollection : [],
      worldCupCollection: Array.isArray(raw?.worldCupCollection) ? raw.worldCupCollection : [],
      kpopCollection: Array.isArray(raw?.kpopCollection) ? raw.kpopCollection : [],
      cs2Collection: Array.isArray(raw?.cs2Collection) ? raw.cs2Collection : [],
      animeCollection: Array.isArray(raw?.animeCollection) ? raw.animeCollection : [],
      totalCards,
      uniqueCards,
      betsWon,
      biggestWin,
    },
  };
}

export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map((d) => {
        const { record } = mapDocToAdminRecord(d.id, d.data() || {});
        return {
          uid: record.uid,
          displayName: record.displayName,
          balance: record.balance,
          totalCards: record.totalCards,
          uniqueCards: record.uniqueCards,
          betsWon: record.betsWon,
          totalBets: record.placedBets.length,
          biggestWin: record.biggestWin,
          lastSeen: record.lastSeen,
          createdAt: record.createdAt,
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

export async function removeAnimeCard(uid: string, cardId: string, removeAll = false) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: removeAll ? 0 : c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { animeCollection: updated });
}

export async function setAnimeCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { animeCollection: cards });
}

// Mudae Server-Wide Sync & User Progression
export interface MudaeTowerLevels {
  floor1Rolls: number;
  floor2Reaction: number;
  floor3WishSpawn: number;
  floor4Slots: number;
  floor5Claims: number;
  floor6Rainbow: number;
}

export interface MudaeUserData {
  wishlist: string[];
  disablelist: string[];
  tower: MudaeTowerLevels;
  totalInvestedTower: number;
  rollsUsed: number;
  rollsWindowStart: number;
  claimsUsed: number;
  claimsWindowStart: number;
  lastRtUsed: number;
  totalReactionsCollected: number;
  totalKakeraEarned: number;
}

export interface ServerAnimeClaim {
  cardId: string;
  ownerUid: string;
  ownerName: string;
  keys: number;
  name: string;
  image: string;
  series: string;
  rarity: PokemonCard['rarity'];
}

const MUDAE_LOCAL_PREFIX = 'benbets_mudae_v1_';

export function getDefaultMudaeUserData(): MudaeUserData {
  return {
    wishlist: [],
    disablelist: [],
    tower: {
      floor1Rolls: 0,
      floor2Reaction: 0,
      floor3WishSpawn: 0,
      floor4Slots: 0,
      floor5Claims: 0,
      floor6Rainbow: 0,
    },
    totalInvestedTower: 0,
    rollsUsed: 0,
    rollsWindowStart: 0,
    claimsUsed: 0,
    claimsWindowStart: 0,
    lastRtUsed: 0,
    totalReactionsCollected: 0,
    totalKakeraEarned: 0,
  };
}

function clampMudaeLevel(v: any): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(5, n));
}

function safeMudaeNum(v: any): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

export function sanitizeMudaeUserData(raw: any): MudaeUserData {
  const def = getDefaultMudaeUserData();
  if (!raw || typeof raw !== 'object') return def;
  const rawTower = raw.tower && typeof raw.tower === 'object' ? raw.tower : {};
  return {
    wishlist: Array.isArray(raw.wishlist) ? raw.wishlist.map(String).filter(Boolean) : [],
    disablelist: Array.isArray(raw.disablelist) ? raw.disablelist.map(String).filter(Boolean) : [],
    tower: {
      floor1Rolls: clampMudaeLevel(rawTower.floor1Rolls),
      floor2Reaction: clampMudaeLevel(rawTower.floor2Reaction),
      floor3WishSpawn: clampMudaeLevel(rawTower.floor3WishSpawn),
      floor4Slots: clampMudaeLevel(rawTower.floor4Slots),
      floor5Claims: clampMudaeLevel(rawTower.floor5Claims),
      floor6Rainbow: clampMudaeLevel(rawTower.floor6Rainbow),
    },
    totalInvestedTower: Number(safeMudaeNum(raw.totalInvestedTower).toFixed(2)),
    rollsUsed: Math.floor(safeMudaeNum(raw.rollsUsed)),
    rollsWindowStart: safeMudaeNum(raw.rollsWindowStart),
    claimsUsed: Math.floor(safeMudaeNum(raw.claimsUsed)),
    claimsWindowStart: safeMudaeNum(raw.claimsWindowStart),
    lastRtUsed: safeMudaeNum(raw.lastRtUsed),
    totalReactionsCollected: Math.floor(safeMudaeNum(raw.totalReactionsCollected)),
    totalKakeraEarned: Number(safeMudaeNum(raw.totalKakeraEarned).toFixed(2)),
  };
}

export async function getMudaeUserData(uid: string): Promise<MudaeUserData> {
  if (!uid) return getDefaultMudaeUserData();
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.mudaeData) {
        return sanitizeMudaeUserData(data.mudaeData);
      }
    }
  } catch {
    // Fallback to localStorage below
  }
  try {
    const localRaw = localStorage.getItem(`${MUDAE_LOCAL_PREFIX}${uid}`);
    if (localRaw) return sanitizeMudaeUserData(JSON.parse(localRaw));
  } catch { /* ignore */ }
  return getDefaultMudaeUserData();
}

export async function saveMudaeUserData(uid: string, mudaeData: MudaeUserData): Promise<void> {
  const clean = sanitizeMudaeUserData(mudaeData);
  if (!uid) return;
  try {
    localStorage.setItem(`${MUDAE_LOCAL_PREFIX}${uid}`, JSON.stringify(clean));
  } catch { /* quota */ }
  try {
    await setDoc(doc(db, 'users', uid), { mudaeData: clean }, { merge: true });
  } catch { /* ignore */ }
}

function buildClaimsFromDocs(
  docs: Array<{ id: string; data: Record<string, any> }>
): { claims: Record<string, ServerAnimeClaim>; wishCounts: Record<string, number> } {
  const claims: Record<string, ServerAnimeClaim> = {};
  const wishCounts: Record<string, number> = {};

  for (const d of docs) {
    const raw = d.data || {};
    const ownerUid = d.id;
    const ownerName =
      typeof raw.displayName === 'string' && raw.displayName.trim()
        ? raw.displayName.trim()
        : typeof raw.email === 'string' && raw.email.includes('@')
          ? raw.email.split('@')[0]
          : `Jogador ${ownerUid.slice(0, 6)}`;

    const col: PokemonCard[] = Array.isArray(raw.animeCollection) ? raw.animeCollection : [];
    for (const c of col) {
      if (!c || !c.id) continue;
      const keys = typeof c.quantity === 'number' && c.quantity > 0 ? Math.floor(c.quantity) : 1;
      const prev = claims[c.id];
      if (!prev || keys > prev.keys || (keys === prev.keys && ownerUid < prev.ownerUid)) {
        claims[c.id] = {
          cardId: String(c.id),
          ownerUid,
          ownerName,
          keys,
          name: String(c.name || 'Personagem'),
          image: String(c.imageUrl || ''),
          series: String(c.setName || 'Anime'),
          rarity: String(c.rarity || 'Rank C'),
        };
      }
    }

    const mudaeRaw = raw.mudaeData;
    const wishlist: string[] = Array.isArray(mudaeRaw?.wishlist) ? mudaeRaw.wishlist : [];
    const seenWish = new Set<string>();
    for (const charId of wishlist) {
      if (typeof charId === 'string' && charId && !seenWish.has(charId)) {
        seenWish.add(charId);
        wishCounts[charId] = (wishCounts[charId] || 0) + 1;
      }
    }
  }

  return { claims, wishCounts };
}

export function subscribeToServerAnimeClaims(
  onUpdate: (claims: Record<string, ServerAnimeClaim>, wishCounts: Record<string, number>) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
      const { claims, wishCounts } = buildClaimsFromDocs(docs);
      onUpdate(claims, wishCounts);
    },
    (err) => {
      console.warn('[BenBets Mudae] Erro ao sincronizar claims do servidor:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function checkServerAnimeClaim(cardId: string): Promise<ServerAnimeClaim | null> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
    const { claims } = buildClaimsFromDocs(docs);
    return claims[cardId] || null;
  } catch {
    return null;
  }
}

// Admin
export async function getAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => mapDocToAdminRecord(d.id, d.data() || {}).record);
}

export function subscribeToAllUsers(
  onUpdate: (users: AdminUserRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const records: AdminUserRecord[] = snap.docs.map((d) => {
        const { record, needsRepair } = mapDocToAdminRecord(d.id, d.data() || {});
        if (needsRepair) {
          updateDoc(doc(db, 'users', d.id), {
            balance: record.balance,
            placedBets: record.placedBets,
          }).catch(() => {});
        }
        return record;
      });
      onUpdate(records);
    },
    (err) => {
      console.warn('[BenBets Admin] Erro ao escutar usuários no Firestore:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function adminSetBalance(uid: string, balance: number) {
  if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) return;
  await setDoc(doc(db, 'users', uid), { balance: Number(balance.toFixed(2)) }, { merge: true });
}

export async function adminUpdateUserProfile(
  uid: string,
  updates: { displayName?: string; email?: string; balance?: number }
) {
  const payload: Record<string, any> = {};
  if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
    payload.displayName = updates.displayName.trim();
  }
  if (typeof updates.email === 'string' && updates.email.trim()) {
    payload.email = updates.email.trim();
  }
  if (typeof updates.balance === 'number' && Number.isFinite(updates.balance) && updates.balance >= 0) {
    payload.balance = Number(updates.balance.toFixed(2));
  }
  if (Object.keys(payload).length === 0) return;
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
}

export async function adminResetUser(uid: string, clearCollections = false) {
  const payload: Record<string, any> = {
    balance: 20.0,
    placedBets: [],
    transactions: [],
  };
  if (clearCollections) {
    payload.pokemonCollection = [];
    payload.worldCupCollection = [];
    payload.kpopCollection = [];
    payload.cs2Collection = [];
    payload.animeCollection = [];
  }
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
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
