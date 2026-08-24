---
topic: bulk-writes-and-idempotency
status: ready
stub_fields: []
signatures:
  - "collection.bulkWrite(operations)"
  - "updateOne(filter, update, { upsert: true })"
see_also:
  - unique-index-and-duplicates
vocabularies_served:
  own_terms:
    - bulkWrite
    - upsert
    - setOnInsert
  translations:
    - known_tool: sql
      terms:
        - "INSERT ... ON CONFLICT"
        - batch insert
    - known_tool: postgres
      terms:
        - "UPSERT"
  task:
    - "write many documents efficiently"
    - "make a write safe to retry"
    - "insert or update in one call"
---

Multi-document writes belong in one `bulkWrite`, ops built up in a loop, one
real database call executed after the loop, never a database call made
INSIDE the loop itself. Direct `insertMany`/`updateMany`/`deleteMany` calls
scattered through application code (not test cleanup) are the smell this
guards: each one is a separate round trip that `bulkWrite` would have
batched, at real, compounding cost as the collection or the batch size
grows. A deliberate one-off exception says why in a comment; the default is
never a per-document call in a loop.

Make writes idempotent: stable keys and set-to-value updates survive a retry
safely, a blind increment does not, running it twice silently double-counts.
Upsert is `updateOne` with `upsert: true` and `$setOnInsert`, paired with a
real unique index, never an application-level check-then-insert (see
`unique-index-and-duplicates` for why that race is real traffic, not a
theoretical edge case).

After a partial `bulkWrite` failure, never blindly retry the whole batch:
the error names which operations actually failed, retry only those, or make
every operation idempotent first so a full retry is safe either way.
