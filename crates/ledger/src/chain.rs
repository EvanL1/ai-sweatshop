use sha2::{Digest, Sha256};

use crate::types::{Block, Transaction};

/// Difficulty: hash must start with this many zero chars
const DIFFICULTY: usize = 3;

/// Compute SHA-256 hash of a block's content (excluding the hash field itself)
pub fn compute_hash(index: u64, timestamp: i64, txs: &[Transaction], prev_hash: &str, nonce: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(index.to_le_bytes());
    hasher.update(timestamp.to_le_bytes());
    hasher.update(prev_hash.as_bytes());
    hasher.update(nonce.to_le_bytes());
    for tx in txs {
        hasher.update(tx.id.as_bytes());
        hasher.update(tx.amount.to_le_bytes());
        hasher.update(tx.timestamp.to_le_bytes());
    }
    hex::encode(hasher.finalize())
}

/// Mine a block: find nonce such that hash starts with DIFFICULTY zeros
pub fn mine_block(
    index: u64,
    session_id: String,
    transactions: Vec<Transaction>,
    previous_hash: String,
) -> Block {
    let timestamp = chrono::Utc::now().timestamp();
    let mut nonce: u64 = 0;
    let prefix = "0".repeat(DIFFICULTY);

    loop {
        let hash = compute_hash(index, timestamp, &transactions, &previous_hash, nonce);
        if hash.starts_with(&prefix) {
            return Block {
                index,
                session_id,
                timestamp,
                transactions,
                previous_hash,
                nonce,
                hash,
            };
        }
        nonce += 1;
    }
}

/// Create the genesis block
pub fn genesis_block() -> Block {
    mine_block(0, "genesis".into(), vec![], "0".repeat(64))
}

/// Validate the entire chain
pub fn validate_chain(chain: &[Block]) -> bool {
    for i in 1..chain.len() {
        let prev = &chain[i - 1];
        let curr = &chain[i];
        if curr.previous_hash != prev.hash {
            return false;
        }
        let expected = compute_hash(
            curr.index, curr.timestamp, &curr.transactions,
            &curr.previous_hash, curr.nonce,
        );
        if curr.hash != expected {
            return false;
        }
    }
    true
}
