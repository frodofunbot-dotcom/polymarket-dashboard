export interface Position {
  asset: string;
  conditionId: string;
  title: string;
  outcome: string;
  outcomeIndex: number;
  size: number;
  avgPrice: number;
  curPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  redeemable: boolean;
  slug: string;
  endDate: string;
}

export interface Trade {
  timestamp: number;
  title: string;
  side: "BUY" | "SELL";
  outcome: string;
  price: number;
  size: number;
  usdcSize: number;
  conditionId: string;
  transactionHash: string;
  outcomeIndex: number;
  slug: string;
}

export interface ArbStats {
  totalSets: number;
  totalSpent: number;
  totalLegs: number;
  sets: ArbSet[];
}

export interface ArbSet {
  timestamp: number;
  legs: number;
  totalCost: number;
  outcomes: string[];
}

export interface DashboardData {
  usdcBalance: number;
  portfolioValue: number;
  positionValue: number;
  totalPnl: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  totalPositions: number;
  positions: Position[];
  trades: Trade[];
  arbStats: ArbStats;
  lastUpdated: string;
  walletAddress: string;
}
