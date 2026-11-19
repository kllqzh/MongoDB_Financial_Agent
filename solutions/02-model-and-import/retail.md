# Lab 1 solution: Retail Catalog & Orders

> Try the lab first. Consult this only if you're stuck or want to compare after.

## Step 3: filled-in schema prompt

```
I am building the application described in CONTEXT.md. I want you to propose
a MongoDB schema for it.

Read CONTEXT.md first. Pay particular attention to the access patterns
section.

The CSV files in ./data/ are normalized in a relational style. I do NOT
want a one-to-one translation. I want a document model that serves the
application's access patterns.

The application's most important access patterns are:
1. Product detail page
   - This query must return the product, its category breadcrumb,
     current inventory, and all variant attributes
   - It runs on every product page view; it is the highest-traffic
     query in the application

2. Customer order history
   - This query must return all orders for a given customer, sorted by
     order_date descending, with order summary fields and the embedded
     line items
   - It runs every time a customer visits their orders page

3. Place an order
   - This operation must insert a new order with embedded line items
     and decrement the inventory_count for each product in the order
   - Atomicity matters because an order recorded without an inventory
     decrement oversells, and a decrement without the order under-sells.
     The two must commit together.

4. Subject activity history
   - This query must return the most recent 20 audit_log entries for a given subject, sorted by event_date descending. Each result includes log_id, event_date, event_type, actor, and details.
   - It runs on every profile/chart/dashboard page load: high frequency, latency-sensitive.

The application capabilities I want to support, in priority order:
- Browse the catalog by category with brand and price filters
- View a single product with full detail in one query
- Place an order atomically with inventory updates
- Append-only audit_log collection with a compound index on (subject_id, event_date desc) that serves the activity-history query at low latency.

Propose the schema as a list of MongoDB collections. For each collection,
give me:
- The fields, with types and example values
- An explanation of WHY this shape (which access pattern it serves)
- The decision: did you embed or reference any related data, and why
- The indexes you would create, and which queries they support

Ask me any relevant questions about the document model we're building until you're fully confident it meets the requirements and my instructions.

Do NOT write any import code yet. Schema proposal first. I want to review
it before we touch the database.
```
