# Lab 1 solution: Financial Portfolio Tracker

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
1. Dashboard view
   - This query must return the investor's full list of current
     holdings (one entry per asset with current quantity and current
     market value), the portfolio total in USD, and the three most
     recent transactions
   - It runs on every dashboard load. Investors check daily. Must
     return in under 100ms at the 95th percentile.

2. Transaction history
   - This query must return every transaction for the investor sorted
     by transaction_date descending, with filters by transaction_type
     and date range
   - It runs occasionally, when the investor opens their full history

3. Record a transaction
   - This operation must insert the new transaction document AND update
     the investor's current holding for that asset (quantity, average
     cost basis)
   - Atomicity matters because a transaction recorded without an
     updated holding leaves the dashboard out of sync, and an updated
     holding without a recorded transaction loses the audit trail

4. Subject activity history
   - This query must return the most recent 20 audit_log entries for a given subject, sorted by event_date descending. Each result includes log_id, event_date, event_type, actor, and details.
   - It runs on every profile/chart/dashboard page load: high frequency, latency-sensitive.

The application capabilities I want to support, in priority order:
- Render the dashboard in a single query
- Search the asset universe by symbol or name
- Record buy, sell, dividend, and split transactions while keeping
  holdings in sync
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
