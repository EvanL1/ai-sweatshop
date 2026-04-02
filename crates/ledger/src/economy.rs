use crate::types::*;

/// Logarithmic reward scaling — diminishing returns for repeated tasks in a day
pub fn task_reward(base: i64, completions_today: u32) -> i64 {
    if completions_today == 0 {
        return base;
    }
    let scale = 1.0 / (1.0 + (completions_today as f64).ln());
    (base as f64 * scale) as i64
}

/// WC3-style upkeep: more agents = lower efficiency
pub fn upkeep_rate(agent_count: usize) -> f64 {
    match agent_count {
        0..=3 => 1.0,
        4..=6 => 0.85,
        _ => 0.70,
    }
}

/// Calculate reward for a tool use completion
pub fn tool_reward(tool_name: &str) -> i64 {
    let base = match tool_name {
        "Write" | "Edit" => 50 * COIN_UNIT,
        "Bash" => 40 * COIN_UNIT,
        "Read" | "Grep" | "Glob" => 15 * COIN_UNIT,
        "Agent" => 80 * COIN_UNIT,
        _ => 20 * COIN_UNIT,
    };
    base
}

/// Calculate reward for completing a turn (Stop event)
pub fn turn_reward() -> i64 {
    100 * COIN_UNIT
}

/// Calculate reward for sub-agent collaboration
pub fn collab_reward() -> i64 {
    200 * COIN_UNIT
}

/// Calculate session settlement bonus based on ROI
pub fn session_settle_reward(tasks_completed: u32, tokens_used: i64) -> i64 {
    if tokens_used <= 0 {
        return 0;
    }
    let roi = tasks_completed as f64 / (tokens_used as f64 / 1000.0);
    let base = 500 * COIN_UNIT;
    (base as f64 * roi.min(3.0)) as i64
}

/// Diamond cost per second for an active agent (wage)
pub fn wage_per_second(agent_type: &str, level: &str) -> i64 {
    let base = match agent_type {
        "claude" => 15,
        "codex" => 10,
        "gemini" => 8,
        _ => 6,
    };
    let mult = match level {
        "lead" => 20,
        "senior" => 15,
        "junior" => 10,
        "intern" => 5,
        _ => 10,
    };
    base * mult // milli-diamonds per second
}

/// Check if office can be upgraded
pub fn can_upgrade(tier: OfficeTier, wallet: &Wallet) -> bool {
    match tier.upgrade_cost() {
        Some((coins, prestige)) => wallet.coins >= coins && wallet.prestige >= prestige,
        None => false,
    }
}
