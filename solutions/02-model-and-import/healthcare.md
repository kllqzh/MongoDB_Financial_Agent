# Lab 1 solution: Healthcare Clinic Management

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
1. Patient chart view
   - This query must return the patient's demographics, their visit
     history sorted by visit_date descending, all active diagnoses
     across visits, and their current prescriptions
   - It runs as the most common clinician query during a visit; speed
     is a usability requirement (clinicians wait on it in front of the
     patient)

2. Visit detail
   - This query must return the visit metadata, all diagnoses recorded
     at that visit, all prescriptions issued at that visit, and the
     vitals captured
   - It runs every time a clinician opens a specific visit

3. Record a visit
   - This operation must save the visit record, all diagnoses recorded,
     and all prescriptions issued, in a single atomic operation
   - Atomicity matters because a partially saved visit (visit plus some
     diagnoses but missing prescriptions) is a clinical record gap

4. Subject activity history
   - This query must return the most recent 20 audit_log entries for a given subject, sorted by event_date descending. Each result includes log_id, event_date, event_type, actor, and details.
   - It runs on every profile/chart/dashboard page load: high frequency, latency-sensitive.

The application capabilities I want to support, in priority order:
- Open a patient chart with demographics, visit history, active
  diagnoses, and current prescriptions
- Record a complete visit (vitals, diagnoses, prescriptions) atomically
- Report on visits by date range and patients by diagnosis
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
