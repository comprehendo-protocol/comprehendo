---
topic: indexing-and-scan-performance
status: ready
stub_fields: []
signatures:
  - "createIndex({ a: 1, b: 1, c: 1 })"
  - "find({ field: /^prefix/ })"
see_also:
  - destructive-delete-filters
vocabularies_served:
  own_terms:
    - ESR
    - compound index
    - explain
    - COLLSCAN
  translations:
    - known_tool: postgres
      terms:
        - composite index
        - "EXPLAIN ANALYZE"
    - known_tool: sql
      terms:
        - "LIKE 'prefix%'"
        - "LIKE '%text%'"
  task:
    - "why is this query slow despite having an index"
    - "order fields in a compound index"
    - "paginate a large collection efficiently"
---

A compound index only serves a left-to-right PREFIX of its own field order.
Order fields to match the query, equality first: Equality, Sort, Range
(ESR). A query that filters on a field the index lists third gets no help
from that index at all if the first two fields are not also constrained.

An unanchored regex (no leading `^`) cannot use an index's sorted key order,
even when the field IS indexed. Confirmed live via `explain('executionStats')`
against a real indexed field: an anchored `/^prefix/` produces tight index
bounds and examines only the matching keys; the same query unanchored
produces full-range bounds and examines every indexed entry, applying the
regex to each one, a real, measurable degradation that widens with
collection size, not a small-collection quirk.

`$skip` does not scale: it still has to walk past every skipped document
internally, so page 500 costs roughly 500 times what page 1 does. Range or
keyset pagination on an indexed sort key, with `_id` as a tie-breaker, is
the version that stays flat regardless of page number.

Modeling: embed data that is bounded and read together; reference data that
is unbounded (comments, events, logs) as its own collection. `$elemMatch`
showing up often signals the modeling is wrong, a field queried
independently belongs on the document itself or in its own collection, not
buried inside an array element.
