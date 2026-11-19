'use strict';

const express = require('express');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017/workshop';
const PORT = 3000;
const DB_NAME = 'workshop';

const app = express();
app.use(express.json());

async function main() {
  // Single client, connected at startup. Pool sized for a local read-heavy OLTP
  // server: pre-warm 2 connections, cap at 10 for 1 000-investor scale.
  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(DB_NAME);
  console.log('Connected to MongoDB workshop database');

  // ── GET /health ───────────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    try {
      await db.command({ ping: 1 });
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ error: 'Database unreachable' });
    }
  });

  // ── LIST  GET /investors ──────────────────────────────────────────────────
  // Returns summary rows. Sorting by investor_id (default) uses the
  // investor_id_1 index. Filtering by risk_tolerance is an in-memory pass
  // over at most 1 000 documents — acceptable at this scale.
  app.get('/investors', async (req, res) => {
    try {
      const {
        risk_tolerance,
        sort = 'investor_id',
        order = 'asc',
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum  = Math.max(1, parseInt(page,  10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip     = (pageNum - 1) * pageSize;

      const filter = {};
      if (risk_tolerance) {
        const valid = ['conservative', 'moderate', 'aggressive'];
        if (!valid.includes(risk_tolerance)) {
          return res.status(400).json({
            error: `risk_tolerance must be one of: ${valid.join(', ')}`,
          });
        }
        filter.risk_tolerance = risk_tolerance;
      }

      const allowedSorts = {
        investor_id:    'investor_id',
        name:           'name',
        joined_date:    'joined_date',
        portfolio_value:'portfolio_value',
      };
      const sortField = allowedSorts[sort] || 'investor_id';
      const sortDir   = order === 'desc' ? -1 : 1;

      const col = db.collection('investors');
      const [investors, total] = await Promise.all([
        col
          .find(filter, {
            projection: {
              investor_id:    1,
              name:           1,
              email:          1,
              risk_tolerance: 1,
              portfolio_value:1,
              joined_date:    1,
            },
          })
          .sort({ [sortField]: sortDir })
          .skip(skip)
          .limit(pageSize)
          .toArray(),
        col.countDocuments(filter),
      ]);

      res.json({
        data:  investors,
        total,
        page:  pageNum,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DETAIL  GET /investors/:investor_id ───────────────────────────────────
  // Serves the dashboard: investor_id_1 index → single document containing
  // embedded holdings[] and recent_transactions[]. One query, no joins.
  app.get('/investors/:investor_id', async (req, res) => {
    try {
      const investor = await db
        .collection('investors')
        .findOne({ investor_id: req.params.investor_id });

      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      res.json(investor);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── RELATED-DATA  GET /investors/:investor_id/transactions ────────────────
  // Transaction history access pattern. With transaction_type the query hits
  // investor_id_1_transaction_type_1_transaction_date_-1; without it, hits
  // investor_id_1_transaction_date_-1. Both indexes are already in place.
  app.get('/investors/:investor_id/transactions', async (req, res) => {
    try {
      const { transaction_type, since, until, page = '1', limit = '20' } = req.query;

      const pageNum  = Math.max(1, parseInt(page,  10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip     = (pageNum - 1) * pageSize;

      // Verify investor exists before returning empty results
      const investor = await db
        .collection('investors')
        .findOne({ investor_id: req.params.investor_id }, { projection: { _id: 1 } });
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }

      const filter = { investor_id: req.params.investor_id };

      if (transaction_type) {
        const valid = ['buy', 'sell', 'dividend', 'split'];
        if (!valid.includes(transaction_type)) {
          return res.status(400).json({
            error: `transaction_type must be one of: ${valid.join(', ')}`,
          });
        }
        filter.transaction_type = transaction_type;
      }

      if (since || until) {
        filter.transaction_date = {};
        if (since) {
          const d = new Date(since);
          if (isNaN(d)) return res.status(400).json({ error: 'Invalid since date' });
          filter.transaction_date.$gte = d;
        }
        if (until) {
          const d = new Date(until);
          if (isNaN(d)) return res.status(400).json({ error: 'Invalid until date' });
          filter.transaction_date.$lte = d;
        }
      }

      const col = db.collection('transactions');
      const [txns, total] = await Promise.all([
        col.find(filter).sort({ transaction_date: -1 }).skip(skip).limit(pageSize).toArray(),
        col.countDocuments(filter),
      ]);

      res.json({
        data:  txns,
        total,
        page:  pageNum,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── WRITE  POST /transactions ─────────────────────────────────────────────
  // Inserts the transaction document, then updates the investor's embedded
  // holding for buy/sell using aggregation-pipeline update syntax so that
  // avg_cost_basis is recalculated atomically without a read-modify-write.
  app.post('/transactions', async (req, res) => {
    try {
      const {
        investor_id,
        asset_id,
        transaction_type,
        quantity,
        price_per_unit,
        total_amount,
        fee,
        transaction_date,
      } = req.body;

      // Required fields
      const required = { investor_id, asset_id, transaction_type, total_amount };
      const missing  = Object.entries(required)
        .filter(([, v]) => v == null || v === '')
        .map(([k]) => k);
      if (missing.length) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const validTypes = ['buy', 'sell', 'dividend', 'split'];
      if (!validTypes.includes(transaction_type)) {
        return res.status(400).json({
          error: `transaction_type must be one of: ${validTypes.join(', ')}`,
        });
      }

      const txnDate = transaction_date ? new Date(transaction_date) : new Date();
      if (isNaN(txnDate)) {
        return res.status(400).json({ error: 'Invalid transaction_date' });
      }

      // Validate investor and asset exist in parallel
      const [investor, asset] = await Promise.all([
        db.collection('investors').findOne({ investor_id }, { projection: { _id: 1, holdings: 1 } }),
        db.collection('assets').findOne({ asset_id }, { projection: { asset_id: 1, symbol: 1, name: 1, asset_type: 1 } }),
      ]);
      if (!investor) return res.status(400).json({ error: 'investor_id not found' });
      if (!asset)    return res.status(400).json({ error: 'asset_id not found' });

      const transaction_id = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const doc = {
        transaction_id,
        investor_id,
        asset_id,
        transaction_type,
        quantity:       quantity       ?? 0,
        price_per_unit: price_per_unit ?? 0,
        total_amount,
        fee:            fee            ?? 0,
        transaction_date: txnDate,
      };

      await db.collection('transactions').insertOne(doc);

      // Update embedded holdings and recent_transactions for buy/sell
      if (transaction_type === 'buy' || transaction_type === 'sell') {
        const qty   = Number(quantity)       || 0;
        const price = Number(price_per_unit) || 0;
        const delta = transaction_type === 'buy' ? qty : -qty;

        const holdingExists = investor.holdings?.some(h => h.asset_id === asset_id);

        if (holdingExists && transaction_type === 'buy') {
          // Recalculate avg_cost_basis atomically with pipeline update
          await db.collection('investors').updateOne(
            { investor_id },
            [{
              $set: {
                holdings: {
                  $map: {
                    input: '$holdings',
                    as: 'h',
                    in: {
                      $cond: {
                        if: { $eq: ['$$h.asset_id', asset_id] },
                        then: {
                          $mergeObjects: ['$$h', {
                            quantity: { $add: ['$$h.quantity', delta] },
                            avg_cost_basis: {
                              $divide: [
                                {
                                  $add: [
                                    { $multiply: ['$$h.quantity', '$$h.avg_cost_basis'] },
                                    { $multiply: [qty, price] },
                                  ],
                                },
                                { $add: ['$$h.quantity', qty] },
                              ],
                            },
                          }],
                        },
                        else: '$$h',
                      },
                    },
                  },
                },
              },
            }],
          );
        } else if (holdingExists && transaction_type === 'sell') {
          await db.collection('investors').updateOne(
            { investor_id, 'holdings.asset_id': asset_id },
            { $inc: { 'holdings.$.quantity': delta } },
          );
        } else if (transaction_type === 'buy') {
          // First buy of this asset — push a new holding entry
          await db.collection('investors').updateOne(
            { investor_id },
            {
              $push: {
                holdings: {
                  asset_id,
                  symbol:                 asset.symbol,
                  name:                   asset.name,
                  asset_type:             asset.asset_type,
                  quantity:               qty,
                  avg_cost_basis:         price,
                  current_price:          price,
                  market_value:           qty * price,
                  unrealized_gain_loss:   0,
                  unrealized_gain_loss_pct: 0,
                },
              },
            },
          );
        }

        // Prepend to recent_transactions, keep only the latest 3
        const summary = {
          transaction_id,
          asset_id,
          symbol:           asset.symbol,
          transaction_type,
          quantity:         qty,
          total_amount,
          transaction_date: txnDate,
        };
        await db.collection('investors').updateOne(
          { investor_id },
          [{
            $set: {
              recent_transactions: {
                $slice: [{ $concatArrays: [[summary], '$recent_transactions'] }, 3],
              },
            },
          }],
        );
      }

      res.status(201).json(doc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── READ  GET /subjects/:subject_id/audit-log ─────────────────────────────
  // Investor activity history. Uses subject_id_1_event_date_-1 compound index
  // for all filter combinations (subject_id alone, or with event_date range).
  app.get('/subjects/:subject_id/audit-log', async (req, res) => {
    try {
      const { event_type, since, limit = '20', offset = '0' } = req.query;

      const lim  = Math.min(100, Math.max(1, parseInt(limit, 10)  || 20));
      const skip = Math.max(0,              parseInt(offset, 10)  || 0);

      const filter = { subject_id: req.params.subject_id };
      if (event_type) filter.event_type = event_type;
      if (since) {
        const d = new Date(since);
        if (isNaN(d)) return res.status(400).json({ error: 'Invalid since date' });
        filter.event_date = { $gte: d };
      }

      const logs = await db
        .collection('audit_log')
        .find(filter, {
          projection: { log_id: 1, event_date: 1, event_type: 1, actor: 1, details: 1, _id: 0 },
        })
        .sort({ event_date: -1 })
        .skip(skip)
        .limit(lim)
        .toArray();

      res.json({ data: logs, limit: lim, offset: skip });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

  process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
