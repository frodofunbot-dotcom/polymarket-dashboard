export interface SniperTrade {
  timestamp: string;
  coin: string;
  slug: string;
  entry_price: number;
  side: string;
  amount_usdc: number;
  time_remaining: number;
  spread: number;
  ask_depth: number;
  book_imbalance: number;
  other_price: number;
  outcome: string; // "WIN", "LOSS", "PENDING", "EXPIRED"
  payout: number;
  profit_loss: number;
  action: string; // "BUY", "DRY_BUY", "SELL", etc.
  order_result: string;
}

export interface CoinStats {
  coin: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
}

export interface HourStats {
  hour: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PriceBandStats {
  band: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface AIAdjustment {
  timestamp: string;
  content: string;
}

export interface CurrentParams {
  [key: string]: any;
}

export interface SniperDashboardData {
  // Hero stats
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  balance: number;

  // Chart data
  cumulativePnl: Array<{ index: number; pnl: number; timestamp: string }>;

  // Breakdown stats
  coinStats: CoinStats[];
  hourStats: HourStats[];
  priceBandStats: PriceBandStats[];

  // Recent trades
  recentTrades: SniperTrade[];

  // AI Brain
  currentParams: CurrentParams;
  strategyJournal: string;
  recentAdjustments: AIAdjustment[];

  // Status
  isDryRun: boolean;
  lastTradeTimestamp: string | null;
  lastUpdated: string;
}
