# Lab 2 solution: Financial Portfolio Tracker

> Try the lab first. Consult this only if you're stuck or want to compare after.

## Step 2: filled-in API scaffold prompt

```
Build a Node.js REST API for the application described in CONTEXT.md and
the schema you imported into mongodb://localhost:27017/library.

Stack:
- Express
- mongodb driver (already in package.json)
- Listen on port 3000
- Write the server to ./server.js

Use the MongoDB Agent Skills you have available. I want MongoDB-native
queries, not generic database code.

Endpoints:

GET /health
- Returns 200 with { "status": "ok" } when the database is reachable.

GET /investors/:id/dashboard
- Returns the dashboard payload: an array of holdings (asset, quantity,
  current market value), the portfolio total in USD, and the three most
  recent transactions
- Query parameters: none beyond the path
- Default sort: holdings sorted by current_market_value descending
- Page size: not paginated; the holdings array is bounded by the
  investor's portfolio size

GET /assets/:id
- Returns the asset details (symbol, name, asset_type, sector,
  exchange) plus the most recent 90 days of price snapshots
- 404 if not found.

GET /investors/:id/transactions
- This endpoint must serve the transaction history access pattern from
  CONTEXT.md
- Returns the investor's transactions sorted by transaction_date
  descending. Query params: type (filter by transaction_type), from,
  to (date range), limit (default 50, max 200), page

POST /investors/:id/transactions
- Body: asset_id, transaction_type, quantity, price_per_unit, fee,
  transaction_date
- Validates: asset_id exists, transaction_type is one of
  buy/sell/dividend/split, quantity and price_per_unit are numeric and
  non-negative, transaction_date is a valid ISO date
- Returns 201 with the created document, or 400 with an error.

GET /subjects/:subject_id/audit-log
- Returns an array of audit_log entries for one subject: log_id, event_date, event_type, actor, details.
- Query parameters: event_type (filter to one event_type), since (ISO date filter), limit (default 20, max 100), offset
- Default sort: event_date descending
- Page size: 20

Code requirements:
- Single MongoClient instance, connected at startup.
- Use the schema you proposed in Lab 1. Do not reshape data on the fly.
- Use indexes you created in Lab 1. The list endpoint sort and the detail
  endpoint lookup must hit indexes.
- Error handling: 500 for unexpected, 404 for not-found, 400 for bad input.

Write server.js. Then start it and test each endpoint with curl.
```
