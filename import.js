'use strict';

const { MongoClient } = require('mongodb');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME   = 'workshop';
const DATA_DIR  = path.join(__dirname, 'data');

function readCSV(filename) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(path.join(DATA_DIR, filename))
      .pipe(parse({ columns: true, trim: true }))
      .on('data', row => rows.push(row))
      .on('end',  () => resolve(rows))
      .on('error', reject);
  });
}

// Weighted-average cost basis tracking per investor+asset
function applyTransaction(holding, type, qty, price) {
  if (type === 'buy') {
    const newTotalCost = holding.totalCost + qty * price;
    const newQty      = holding.quantity + qty;
    holding.totalCost     = newTotalCost;
    holding.quantity      = newQty;
    holding.avgCostBasis  = newQty > 0 ? newTotalCost / newQty : 0;
  } else if (type === 'sell') {
    holding.quantity = Math.max(0, holding.quantity - qty);
    holding.totalCost = holding.quantity * holding.avgCostBasis;
  } else if (type === 'split') {
    // qty is the split ratio (e.g. 2 means 2-for-1)
    if (qty > 0 && holding.quantity > 0) {
      holding.quantity     = holding.quantity * qty;
      holding.avgCostBasis = holding.avgCostBasis / qty;
      holding.totalCost    = holding.quantity * holding.avgCostBasis;
    }
  }
  // dividend: no effect on quantity or cost basis
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // ── Read all CSVs ────────────────────────────────────────────────────────────
  console.log('Reading CSV files…');
  const [rawInvestors, rawAssets, rawTxns, rawSnaps, rawAudit] = await Promise.all([
    readCSV('investors.csv'),
    readCSV('assets.csv'),
    readCSV('transactions.csv'),
    readCSV('price_snapshots.csv'),
    readCSV('audit_log.csv'),
  ]);
  console.log(
    `  investors=${rawInvestors.length}  assets=${rawAssets.length}` +
    `  transactions=${rawTxns.length}  snapshots=${rawSnaps.length}  audit_log=${rawAudit.length}`
  );

  // ── Lookup maps ──────────────────────────────────────────────────────────────
  const assetMap = Object.fromEntries(rawAssets.map(a => [a.asset_id, a]));

  // Latest close price per asset (most recent snapshot_date wins)
  const latestPrice = {};
  for (const s of rawSnaps) {
    const cur = latestPrice[s.asset_id];
    if (!cur || s.snapshot_date > cur.snapshot_date) latestPrice[s.asset_id] = s;
  }

  // ── Build holdings by replaying transactions in date order ───────────────────
  rawTxns.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const holdingsMap = {}; // investor_id → { asset_id → holding state }
  const recentMap   = {}; // investor_id → last-3 raw transaction rows (asc)

  for (const t of rawTxns) {
    const { investor_id, asset_id, transaction_type: type } = t;
    const qty   = parseFloat(t.quantity);
    const price = parseFloat(t.price_per_unit);

    if (!holdingsMap[investor_id]) holdingsMap[investor_id] = {};
    if (!holdingsMap[investor_id][asset_id]) {
      holdingsMap[investor_id][asset_id] = { quantity: 0, avgCostBasis: 0, totalCost: 0 };
    }
    applyTransaction(holdingsMap[investor_id][asset_id], type, qty, price);

    if (!recentMap[investor_id]) recentMap[investor_id] = [];
    recentMap[investor_id].push(t);
    if (recentMap[investor_id].length > 3) recentMap[investor_id].shift();
  }

  // ── Build collection documents ───────────────────────────────────────────────

  // investors — with embedded computed holdings and recent_transactions
  const investorDocs = rawInvestors.map(inv => {
    const holdingStates = holdingsMap[inv.investor_id] || {};

    const holdings = Object.entries(holdingStates)
      .filter(([, h]) => h.quantity > 0)
      .map(([asset_id, h]) => {
        const asset         = assetMap[asset_id] || {};
        const snap          = latestPrice[asset_id];
        const current_price = snap ? parseFloat(parseFloat(snap.close).toFixed(4)) : 0;
        const market_value  = parseFloat((h.quantity * current_price).toFixed(2));
        const gain_loss     = parseFloat(((current_price - h.avgCostBasis) * h.quantity).toFixed(2));
        const gain_loss_pct = h.avgCostBasis > 0
          ? parseFloat((((current_price - h.avgCostBasis) / h.avgCostBasis) * 100).toFixed(2))
          : 0;
        return {
          asset_id,
          symbol:                  asset.symbol   || '',
          name:                    asset.name     || '',
          asset_type:              asset.asset_type || '',
          quantity:                parseFloat(h.quantity.toFixed(6)),
          avg_cost_basis:          parseFloat(h.avgCostBasis.toFixed(4)),
          current_price,
          market_value,
          unrealized_gain_loss:     gain_loss,
          unrealized_gain_loss_pct: gain_loss_pct,
        };
      });

    const portfolio_value = parseFloat(
      holdings.reduce((s, h) => s + h.market_value, 0).toFixed(2)
    );

    // recent_transactions: newest first
    const recent_transactions = (recentMap[inv.investor_id] || [])
      .slice()
      .reverse()
      .map(t => ({
        transaction_id:   t.transaction_id,
        asset_id:         t.asset_id,
        symbol:           (assetMap[t.asset_id] || {}).symbol || '',
        transaction_type: t.transaction_type,
        quantity:         parseFloat(t.quantity),
        total_amount:     parseFloat(t.total_amount),
        transaction_date: new Date(t.transaction_date),
      }));

    return {
      investor_id:   inv.investor_id,
      name:          inv.name,
      email:         inv.email,
      joined_date:   new Date(inv.joined_date),
      base_currency: inv.base_currency,
      risk_tolerance: inv.risk_tolerance,
      portfolio_value,
      holdings,
      recent_transactions,
    };
  });

  // assets
  const assetDocs = rawAssets.map(a => ({
    asset_id:   a.asset_id,
    symbol:     a.symbol,
    name:       a.name,
    asset_type: a.asset_type,
    sector:     a.sector,
    country:    a.country,
    exchange:   a.exchange,
  }));

  // transactions — polymorphic, single collection
  const txnDocs = rawTxns.map(t => ({
    transaction_id:   t.transaction_id,
    investor_id:      t.investor_id,
    asset_id:         t.asset_id,
    transaction_type: t.transaction_type,
    quantity:         parseFloat(t.quantity),
    price_per_unit:   parseFloat(t.price_per_unit),
    total_amount:     parseFloat(t.total_amount),
    fee:              parseFloat(t.fee),
    transaction_date: new Date(t.transaction_date),
  }));

  // price_snapshots
  const snapDocs = rawSnaps.map(s => ({
    asset_id:      s.asset_id,
    snapshot_date: new Date(s.snapshot_date),
    open:          parseFloat(s.open),
    high:          parseFloat(s.high),
    low:           parseFloat(s.low),
    close:         parseFloat(s.close),
    volume:        parseInt(s.volume, 10),
  }));

  // audit_log — fields and types contractual; event_date → BSON Date
  const auditDocs = rawAudit.map(e => ({
    log_id:       e.log_id,
    subject_id:   e.subject_id,
    subject_type: e.subject_type,
    event_type:   e.event_type,
    actor:        e.actor,
    event_date:   new Date(e.event_date),
    details:      e.details,
  }));

  // ── Idempotent: drop all five collections then reinsert ──────────────────────
  const COLS = ['investors', 'assets', 'transactions', 'price_snapshots', 'audit_log'];
  console.log('\nDropping existing collections…');
  for (const name of COLS) {
    await db.collection(name).drop().catch(() => {});
  }

  console.log('Inserting documents…');
  await db.collection('investors').insertMany(investorDocs);
  await db.collection('assets').insertMany(assetDocs);
  await db.collection('transactions').insertMany(txnDocs);
  await db.collection('price_snapshots').insertMany(snapDocs);
  await db.collection('audit_log').insertMany(auditDocs);

  // ── Indexes ──────────────────────────────────────────────────────────────────
  console.log('Creating indexes…');

  await db.collection('investors').createIndex({ investor_id: 1 }, { unique: true });
  await db.collection('investors').createIndex({ email: 1 }, { unique: true });

  await db.collection('assets').createIndex({ asset_id: 1 }, { unique: true });
  await db.collection('assets').createIndex({ symbol: 1 }, { unique: true });
  await db.collection('assets').createIndex({ symbol: 'text', name: 'text' });

  // compound: transaction history page (sort by date, filter by investor)
  await db.collection('transactions').createIndex({ investor_id: 1, transaction_date: -1 });
  // compound: filtered history (add transaction_type filter)
  await db.collection('transactions').createIndex(
    { investor_id: 1, transaction_type: 1, transaction_date: -1 }
  );

  // compound: 90-day price chart (asset + date range, most recent first)
  await db.collection('price_snapshots').createIndex({ asset_id: 1, snapshot_date: -1 });

  // compound: required by contract — investor activity history
  await db.collection('audit_log').createIndex({ subject_id: 1, event_date: -1 });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n=== Import Summary ===\n');
  for (const name of COLS) {
    const col     = db.collection(name);
    const count   = await col.countDocuments();
    const indexes = await col.indexes();
    console.log(`${name}`);
    console.log(`  documents : ${count}`);
    console.log(`  indexes   :`);
    for (const idx of indexes) {
      const keyStr  = JSON.stringify(idx.key);
      const flags   = [idx.unique && 'unique', idx.textIndexVersion && 'text']
                        .filter(Boolean).join(', ');
      console.log(`    ${keyStr}${flags ? `  (${flags})` : ''}`);
    }
    console.log();
  }

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
