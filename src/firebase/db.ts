import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';
import type { PlacedBet, Transaction } from '../types';

export async function getUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as {
    balance: number;
    placedBets: PlacedBet[];
    transactions: Transaction[];
  };
}

export async function createUserData(uid: string, email: string) {
  const ref = doc(db, 'users', uid);
  const data = {
    email,
    balance: 20.00,
    placedBets: [],
    transactions: [],
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return data;
}

export async function updateBalance(uid: string, newBalance: number) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { balance: newBalance });
}

export async function addBet(uid: string, bet: PlacedBet) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { placedBets: arrayUnion(bet) });
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
