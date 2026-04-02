use serde::{Deserialize, Serialize};

/// Currency types in the Sweatshop economy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Currency {
    Diamond,  // Hard currency — anchored to real API cost
    Coin,     // Soft currency — earned by completing tasks
    Prestige, // Bound currency — milestones, daily login
}

/// Transaction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxType {
    TaskReward,     // Agent completed a tool use → +coins
    TurnBonus,      // Agent completed a turn (Stop) → +coins
    CollabBonus,    // Sub-agent finished (SubagentStop) → +coins
    SessionSettle,  // Session ended → ROI-based bonus
    WagePayment,    // Periodic salary → -diamonds
    FurnitureBuy,   // Bought furniture → -coins
    TierUpgrade,    // Office upgrade → -coins -prestige
    Tax,            // Upkeep tax → -coins
    PrestigeAward,  // Milestone → +prestige
    DailyCheckin,   // Daily login → +prestige
}

/// A single economic transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub tx_type: TxType,
    pub agent_id: String,
    pub amount: i64, // positive = income, negative = expense (in milli-units)
    pub currency: Currency,
    pub description: String,
    pub timestamp: i64,
}

/// A block in the chain (one per session or time window)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub session_id: String,
    pub timestamp: i64,
    pub transactions: Vec<Transaction>,
    pub previous_hash: String,
    pub nonce: u64,
    pub hash: String,
}

/// Wallet balance for a single agent
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Wallet {
    pub agent_id: String,
    pub diamonds: i64,
    pub coins: i64,
    pub prestige: i64,
}

/// Office tier progression
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OfficeTier {
    Garage,   // 3 desks
    Startup,  // 6 desks
    Studio,   // 12 desks
    Campus,   // 20 desks
}

impl OfficeTier {
    pub fn max_desks(self) -> usize {
        match self {
            Self::Garage => 3,
            Self::Startup => 6,
            Self::Studio => 12,
            Self::Campus => 20,
        }
    }

    pub fn upgrade_cost(self) -> Option<(i64, i64)> {
        // (coins, prestige) needed to reach NEXT tier
        match self {
            Self::Garage => Some((5_000_000, 2_000_000)),   // 5k coins, 2k prestige
            Self::Startup => Some((20_000_000, 10_000_000)),
            Self::Studio => Some((100_000_000, 50_000_000)),
            Self::Campus => None, // max tier
        }
    }

    pub fn next(self) -> Option<Self> {
        match self {
            Self::Garage => Some(Self::Startup),
            Self::Startup => Some(Self::Studio),
            Self::Studio => Some(Self::Campus),
            Self::Campus => None,
        }
    }
}

/// Global economy state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomyStats {
    pub total_blocks: u64,
    pub total_transactions: u64,
    pub total_coins_minted: i64,
    pub total_coins_burned: i64,
    pub total_diamonds_spent: i64,
    pub office_tier: OfficeTier,
    pub company_wallet: Wallet,
}

/// API request to submit a transaction
#[derive(Debug, Deserialize)]
pub struct TxRequest {
    pub tx_type: TxType,
    pub agent_id: String,
    pub amount: i64,
    pub currency: Currency,
    pub description: String,
    pub session_id: Option<String>,
}

/// Coin unit: 1 coin = 1000 milli-coins
pub const COIN_UNIT: i64 = 1_000;
