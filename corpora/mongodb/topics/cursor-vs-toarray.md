---
topic: cursor-vs-toarray
status: ready
stub_fields: []
signatures:
  - "find(query)"
  - "find(query).toArray()"
  - "for await (const doc of cursor)"
see_also:
  - indexing-and-scan-performance
vocabularies_served:
  own_terms:
    - cursor
    - toArray
    - batchSize
    - streaming
  translations:
    - known_tool: postgres
      terms:
        - streaming result set
        - fetch size
    - known_tool: sql
      terms:
        - server-side cursor
  task:
    - "should I use toArray or iterate the cursor"
    - "process query results as they arrive instead of waiting for all of them"
    - "reduce time to the first usable result"
---

`find()` returns a cursor immediately; the server streams matching documents
back in batches as the cursor is iterated. `.toArray()` exhausts that same
cursor internally and hands back one array only once every batch has
arrived, so nothing in your code runs until the LAST document is in, even
though the FIRST one was ready far earlier.

This is a real, size-dependent tradeoff, not a rule to apply everywhere.
Confirmed live, same query, same collection, two real scales: at 8 small
documents, `.toArray()` and the cursor's first document arrive within about
2ms of each other (3.4ms vs 1.8ms), a difference too small to matter. At
5,000 documents (~2KB each), `.toArray()` takes 73 to 92ms before ANY
document is usable; the cursor's first document is ready in about 2ms, a
roughly 35 to 46x gap, consistent across repeated runs. The mechanism is
what makes the size dependency real: batching cost is per-batch, so it
grows with result size and per-document work, and is invisible on a small,
already-paginated query.

Reach for the cursor (`for await (const doc of cursor)`) when the result
set is large or genuinely unbounded, or when per-document work (an API
call, another query, a streamed HTTP response) could start on document one
without waiting for the rest. `.toArray()` is the right, simpler choice for
a small or already-`.limit()`-bounded result set, where the two are
functionally indistinguishable; reaching for a cursor there adds real
complexity for no measurable benefit.
