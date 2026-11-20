export interface Match {
  id: string;
  sport: 'Futebol' | 'Basquete' | 'Tênis' | 'E-Sports' | 'MMA' | 'Vôlei' | 'Hóquei';
  league: string;
  countryFlag?: string;
  phase?: string;
  venue?: string;
  teamHome: string;
  teamAway: string;
  badgeHome?: string;
  badgeAway?: string;
  colorHome?: string;
  colorAway?: string;
  logoHome?: string;
  logoAway?: string;
  time: string;
  isLive: boolean;
  isFinished?: boolean;
  scoreHome?: number;
  scoreAway?: number;
  timeElapsed?: string;
  liveEvent?: string;
  stats?: {
    possessionHome?: number;
    shotsHome?: number;
    shotsAway?: number;
    shotsOnTargetHome?: number;
    shotsOnTargetAway?: number;
    redCardsHome?: number;
    redCardsAway?: number;
    xgHome?: number;
    xgAway?: number;
    detailLabel?: string;
  };
  baseOdds?: {
    home: number;
    draw?: number;
    away: number;
  };
  odds: {
    home: number;
    draw?: number; // Basquete/Tênis/MMA/Vôlei/E-Sports don't have draw
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

export interface PlacedBetLeg {
  matchId: string;
  matchName: string;
  pickedOutcome: 'home' | 'draw' | 'away';
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
  type: 'sports' | 'crash' | 'casino';
  outcomeValue?: string;
  matchId?: string;
  pickedOutcome?: 'home' | 'draw' | 'away';
  legs?: PlacedBetLeg[];
}

export interface Transaction {
  id: string;
  type: 'deposito' | 'saque';
  amount: number;
  status: 'concluido' | 'pendente';
  date: string;
  pixKey?: string;
}

export interface PokemonCard {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  setName: string;
  setSeries: string;
  quantity: number;
}
