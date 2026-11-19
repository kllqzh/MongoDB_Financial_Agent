# Lab 2 solution: Retail Catalog & Orders

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

GET /products
- Returns an array of product summary documents (product_id, name,
  brand, base_price, inventory_count, and the category breadcrumb)
- Query parameters: category (slug), brand, min_price, max_price,
  limit, page
- Default sort: name ascending
- Page size: 20, max 100

GET /products/:id
- Returns the full product document with all variant attributes, full
  description, current inventory, and category breadcrumb
- 404 if not found.

GET /customers/:id/orders
- This endpoint must serve the customer order history access pattern
  from CONTEXT.md
- Returns the customer's orders sorted by order_date descending, each
  with order summary fields and the embedded line items

POST /orders
- Body: customer_id, line_items (array of {product_id, quantity}),
  shipping_address
- Validates: customer exists, every product exists with
  inventory_count >= quantity, shipping_address is present
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
