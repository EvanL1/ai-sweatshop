mod chain;
mod db;
mod economy;
mod types;

use std::sync::Mutex;
use axum::{
    Router, Json,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use rusqlite::Connection;
use tower_http::cors::CorsLayer;

use types::*;

struct AppState {
    db: Mutex<Connection>,
    pending_txs: Mutex<Vec<Transaction>>,
    next_block_idx: Mutex<u64>,
}

#[tokio::main]
async fn main() {
    let db_path = std::env::var("SWEATSHOP_DB")
        .unwrap_or_else(|_| {
            let dir = dirs_or_default();
            format!("{}/sweatshop-ledger.db", dir)
        });

    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
    db::init_db(&conn).expect("Failed to initialize database");

    // Ensure genesis block exists
    let block_count = db::block_count(&conn).unwrap_or(0);
    if block_count == 0 {
        let genesis = chain::genesis_block();
        db::save_block(&conn, &genesis).expect("Failed to save genesis block");
    }
    let next_idx = db::block_count(&conn).unwrap_or(1);

    let state = std::sync::Arc::new(AppState {
        db: Mutex::new(conn),
        pending_txs: Mutex::new(Vec::new()),
        next_block_idx: Mutex::new(next_idx),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/tx", post(submit_tx))
        .route("/mine", post(mine_block))
        .route("/balance/{agent_id}", get(get_balance))
        .route("/company", get(get_company))
        .route("/chain", get(get_chain))
        .route("/stats", get(get_stats))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port: u16 = std::env::var("LEDGER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7778);

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .expect("Failed to bind");

    eprintln!("⛓ Sweatshop Ledger running on http://127.0.0.1:{}", port);
    axum::serve(listener, app).await.unwrap();
}

fn dirs_or_default() -> String {
    std::env::var("HOME")
        .map(|h| format!("{}/.sweatshop", h))
        .unwrap_or_else(|_| ".".to_string())
}

// --- Handlers ---

async fn health() -> &'static str {
    "ok"
}

async fn submit_tx(
    State(state): State<std::sync::Arc<AppState>>,
    Json(req): Json<TxRequest>,
) -> Result<Json<Transaction>, StatusCode> {
    let tx = Transaction {
        id: uuid::Uuid::new_v4().to_string(),
        tx_type: req.tx_type,
        agent_id: req.agent_id,
        amount: req.amount,
        currency: req.currency,
        description: req.description,
        timestamp: chrono::Utc::now().timestamp(),
    };

    let mut pending = state.pending_txs.lock().unwrap();
    pending.push(tx.clone());

    // Auto-mine when we have enough transactions
    if pending.len() >= 5 {
        drop(pending);
        mine_pending(&state);
    }

    Ok(Json(tx))
}

async fn mine_block(
    State(state): State<std::sync::Arc<AppState>>,
) -> Result<Json<Block>, StatusCode> {
    let block = mine_pending(&state);
    match block {
        Some(b) => Ok(Json(b)),
        None => Err(StatusCode::NO_CONTENT),
    }
}

fn mine_pending(state: &AppState) -> Option<Block> {
    let mut pending = state.pending_txs.lock().unwrap();
    if pending.is_empty() {
        return None;
    }
    let txs: Vec<Transaction> = pending.drain(..).collect();
    drop(pending);

    let db = state.db.lock().unwrap();
    let prev_hash = db::last_block_hash(&db)
        .ok()
        .flatten()
        .unwrap_or_else(|| "0".repeat(64));

    let mut idx = state.next_block_idx.lock().unwrap();
    let session_id = txs.first()
        .map(|t| t.agent_id.clone())
        .unwrap_or_else(|| "unknown".into());

    let block = chain::mine_block(*idx, session_id, txs, prev_hash);
    if let Err(e) = db::save_block(&db, &block) {
        eprintln!("Failed to save block: {}", e);
        return None;
    }
    *idx += 1;
    Some(block)
}

async fn get_balance(
    State(state): State<std::sync::Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Json<Wallet> {
    let db = state.db.lock().unwrap();
    let wallet = db::get_wallet(&db, &agent_id).unwrap_or_default();
    Json(wallet)
}

async fn get_company(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Wallet> {
    let db = state.db.lock().unwrap();
    let wallet = db::get_company_wallet(&db).unwrap_or_default();
    Json(wallet)
}

async fn get_chain(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<Vec<Block>> {
    let db = state.db.lock().unwrap();
    let blocks = db::get_recent_blocks(&db, 20).unwrap_or_default();
    Json(blocks)
}

async fn get_stats(
    State(state): State<std::sync::Arc<AppState>>,
) -> Json<EconomyStats> {
    let db = state.db.lock().unwrap();
    let blocks = db::block_count(&db).unwrap_or(0);
    let txs = db::tx_count(&db).unwrap_or(0);
    let company = db::get_company_wallet(&db).unwrap_or_default();

    Json(EconomyStats {
        total_blocks: blocks,
        total_transactions: txs,
        total_coins_minted: company.coins.max(0),
        total_coins_burned: 0, // TODO: track separately
        total_diamonds_spent: (-company.diamonds).max(0),
        office_tier: OfficeTier::Garage,
        company_wallet: company,
    })
}
