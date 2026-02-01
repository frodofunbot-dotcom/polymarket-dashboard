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

export interface DashboardData {
  balance: number;
  todayPnl: number;
  todayWins: number;
  todayLosses: number;
  todayWinRate: number;
  todaySpent: number;
  todayRevenue: number;
  openPositions: Position[];
  todayTrades: Trade[];
  lastUpdated: string;
  walletAddress: string;
}
