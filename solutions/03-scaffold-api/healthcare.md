# Lab 2 solution: Healthcare Clinic Management

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

GET /patients
- Returns an array of patient summary documents (patient_id,
  first_name, last_name, date_of_birth, insurance_provider)
- Query parameters: insurance_provider, last_name (prefix match),
  limit, page
- Default sort: last_name ascending
- Page size: 50, max 200

GET /patients/:id
- Returns the patient chart: demographics, visit history sorted by
  visit_date descending, active diagnoses across visits, and current
  prescriptions
- 404 if not found.

GET /visits/:id
- This endpoint must serve the visit detail access pattern from
  CONTEXT.md
- Returns the visit document with all diagnoses and prescriptions
  recorded at that visit, plus the captured vitals

POST /visits
- Body: patient_id, visit_date, visit_type, attending_clinician,
  chief_complaint, vitals object, notes, diagnoses (array of
  {icd10_code, description, diagnosis_type, status}), prescriptions
  (array of {medication_name, dose, dose_unit, frequency,
  duration_days, refills, start_date})
- Validates: patient_id exists, visit_type is one of the allowed
  values, vitals are numeric and within plausible ranges, each
  diagnosis has an icd10_code, each prescription has a medication_name
  and dose
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
