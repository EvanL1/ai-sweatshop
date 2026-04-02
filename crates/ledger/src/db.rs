use rusqlite::{Connection, params};
use crate::types::*;

/// Initialize the SQLite database with required tables
pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS blocks (
            idx       INTEGER PRIMARY KEY,
            session_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            prev_hash TEXT NOT NULL,
            nonce     INTEGER NOT NULL,
            hash      TEXT NOT NULL,
            data      TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id          TEXT PRIMARY KEY,
            block_idx   INTEGER NOT NULL,
            tx_type     TEXT NOT NULL,
            agent_id    TEXT NOT NULL,
            amount      INTEGER NOT NULL,
            currency    TEXT NOT NULL,
            description TEXT NOT NULL,
            timestamp   INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS wallets (
            agent_id  TEXT PRIMARY KEY,
            diamonds  INTEGER NOT NULL DEFAULT 0,
            coins     INTEGER NOT NULL DEFAULT 0,
            prestige  INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS state (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tx_agent ON transactions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_idx);
    ")?;
    Ok(())
}

/// Save a block and its transactions, update wallets
pub fn save_block(conn: &Connection, block: &Block) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "INSERT INTO blocks (idx, session_id, timestamp, prev_hash, nonce, hash, data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            block.index,
            block.session_id,
            block.timestamp,
            block.previous_hash,
            block.nonce,
            block.hash,
            serde_json::to_string(&block.transactions).unwrap_or_default(),
        ],
    )?;

    for t in &block.transactions {
        tx.execute(
            "INSERT INTO transactions (id, block_idx, tx_type, agent_id, amount, currency, description, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                t.id,
                block.index,
                serde_json::to_string(&t.tx_type).unwrap_or_default(),
                t.agent_id,
                t.amount,
                serde_json::to_string(&t.currency).unwrap_or_default(),
                t.description,
                t.timestamp,
            ],
        )?;

        // Update wallet
        let currency_col = match t.currency {
            Currency::Diamond => "diamonds",
            Currency::Coin => "coins",
            Currency::Prestige => "prestige",
        };
        tx.execute(
            &format!(
                "INSERT INTO wallets (agent_id, {col}) VALUES (?1, ?2)
                 ON CONFLICT(agent_id) DO UPDATE SET {col} = {col} + ?2",
                col = currency_col
            ),
            params![t.agent_id, t.amount],
        )?;
    }

    tx.commit()?;
    Ok(())
}

/// Get wallet for an agent
pub fn get_wallet(conn: &Connection, agent_id: &str) -> rusqlite::Result<Wallet> {
    conn.query_row(
        "SELECT agent_id, diamonds, coins, prestige FROM wallets WHERE agent_id = ?1",
        params![agent_id],
        |row| Ok(Wallet {
            agent_id: row.get(0)?,
            diamonds: row.get(1)?,
            coins: row.get(2)?,
            prestige: row.get(3)?,
        }),
    ).or_else(|_| Ok(Wallet { agent_id: agent_id.to_string(), ..Default::default() }))
}

/// Get company-wide wallet (sum of all agents)
pub fn get_company_wallet(conn: &Connection) -> rusqlite::Result<Wallet> {
    conn.query_row(
        "SELECT COALESCE(SUM(diamonds),0), COALESCE(SUM(coins),0), COALESCE(SUM(prestige),0) FROM wallets",
        [],
        |row| Ok(Wallet {
            agent_id: "company".to_string(),
            diamonds: row.get(0)?,
            coins: row.get(1)?,
            prestige: row.get(2)?,
        }),
    )
}

/// Get total block count
pub fn block_count(conn: &Connection) -> rusqlite::Result<u64> {
    conn.query_row("SELECT COUNT(*) FROM blocks", [], |r| r.get(0))
}

/// Get total transaction count
pub fn tx_count(conn: &Connection) -> rusqlite::Result<u64> {
    conn.query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
}

/// Get the last block hash (for chaining)
pub fn last_block_hash(conn: &Connection) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT hash FROM blocks ORDER BY idx DESC LIMIT 1",
        [],
        |r| r.get(0),
    ).optional()
}

/// rusqlite optional helper
trait OptionalExt<T> {
    fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalExt<T> for rusqlite::Result<T> {
    fn optional(self) -> rusqlite::Result<Option<T>> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

/// Get recent blocks for the chain explorer
pub fn get_recent_blocks(conn: &Connection, limit: u32) -> rusqlite::Result<Vec<Block>> {
    let mut stmt = conn.prepare(
        "SELECT idx, session_id, timestamp, prev_hash, nonce, hash, data
         FROM blocks ORDER BY idx DESC LIMIT ?1"
    )?;
    let blocks = stmt.query_map(params![limit], |row| {
        let data: String = row.get(6)?;
        let transactions: Vec<Transaction> = serde_json::from_str(&data).unwrap_or_default();
        Ok(Block {
            index: row.get(0)?,
            session_id: row.get(1)?,
            timestamp: row.get(2)?,
            previous_hash: row.get(3)?,
            nonce: row.get(4)?,
            hash: row.get(5)?,
            transactions,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(blocks)
}
