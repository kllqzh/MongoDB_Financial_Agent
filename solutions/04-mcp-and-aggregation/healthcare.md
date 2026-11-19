# Lab 3 solution: Healthcare Clinic Management

> Try the lab first. Consult this only if you're stuck or want to compare after.

## Step 2: filled-in aggregation prompt

```
I want to add a GET /reports/top-diagnoses
endpoint to server.js. It should answer this question:

What are the top 10 most common diagnoses, grouped by icd10_code,
showing the count, the human-readable description, and the proportion of
visits in which the diagnosis was primary versus secondary?

Use the MongoDB MCP server to:
1. Inspect the relevant collection's structure and a few sample documents.
2. Identify which fields you need.
3. Construct the aggregation pipeline.
4. Run the pipeline against the live data and confirm the result is sensible.
5. Add the endpoint to server.js with the working pipeline.
6. Restart the server so Express picks up the new route. The server was
   started during Lab 2 and does not hot-reload routes.

Show me the pipeline before you write the endpoint. I want to read it.

Constraints:
- Use the aggregation framework. Don't pull all documents into memory and
  reduce in JS.
- The pipeline must run efficiently. After you build it, run explain() on
  it via the MCP and confirm it uses indexes where possible. If it does a
  COLLSCAN, propose an index that would fix it.
```
