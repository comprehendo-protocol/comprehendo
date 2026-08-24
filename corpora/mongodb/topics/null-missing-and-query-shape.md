---
topic: null-missing-and-query-shape
status: ready
stub_fields: []
signatures:
  - "{ field: null }"
  - "$exists: false"
see_also:
  - objectid-identity
vocabularies_served:
  own_terms:
    - $exists
    - aggregation pipeline
    - Promise.all
  translations:
    - known_tool: sql
      terms:
        - "IS NULL"
        - "IS NOT NULL"
    - known_tool: postgres
      terms:
        - "column IS NULL"
  task:
    - "query for a missing field"
    - "why does field null match documents without that field"
    - "avoid sequential awaits on independent queries"
---

`null` is not "missing". `{field: null}` matches a document where `field` is
explicitly set to `null` AND a document where `field` is entirely absent,
both, silently, with no way to tell from the result which case each document
is. Confirmed live: three documents, one with `tag: null`, one with no `tag`
field at all, one with a real value; `{tag: null}` matched both the first two
and only the first two, treating "set to null" and "never set" as the same
condition. `$exists: false` is the query for "the field is not there";
`{field: null}` alone is never a safe way to ask that question.

Two related, non-obvious shapes worth carrying together: reads are
aggregation pipelines, not bare `find()`, once a query needs to reshape,
join, or compute rather than just filter; and independent `await`s never
run in sequence, if a second query does not need the first one's result,
both belong in one `Promise.all`, sequential awaits on independent reads
stack real round-trip latency for nothing.

Arrays past about three levels of nesting stop being queryable in any
practical way; a model that needs one is the wrong model, flatten it before
the query gets written, not after it gets slow.
