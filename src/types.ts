export interface Match {
  id: string;
  sport: 'Futebol' | 'Basquete' | 'Tênis' | 'E-Sports';
  league: string;
  teamHome: string;
  teamAway: string;
  logoHome?: string;
  logoAway?: string;
  time: string;
  isLive: boolean;
  scoreHome?: number;
  scoreAway?: number;
  timeElapsed?: string;
  odds: {
    home: number;
    draw?: number; // Basquete/Tênis don't have draw
    away: number;
  };
}

export interface BetSelection {
  matchId: string;
  matchName: string;
  type: 'home' | 'draw' | 'away';
  selectionName: string;
  odds: number;
}

export interface PlacedBet {
  id: string;
  matchName: string;
  selectionName: string;
  odds: number;
  stake: number;
  potentialPayout: number;
  status: 'pending' | 'won' | 'lost';
  placedAt: string;
  type: 'sports' | 'casino' | 'crash';
  outcomeValue?: string;
}

export interface Transaction {
  id: string;
  type: 'deposito' | 'saque';
  amount: number;
  status: 'concluido' | 'pendente';
  date: string;
  pixKey?: string;
}
