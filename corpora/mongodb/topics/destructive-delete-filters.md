---
topic: destructive-delete-filters
status: ready
stub_fields: []
signatures:
  - "collection.deleteMany(filter) where filter negates a status field"
see_also:
  - unique-index-and-duplicates
vocabularies_served:
  own_terms:
    - deleteMany
    - negated filter
    - $ne
    - $nin
  translations:
    - known_tool: sql
      terms:
        - "DELETE FROM ... WHERE x != y"
    - known_tool: ops
      terms:
        - cleanup script
        - data wipe
  task:
    - "write a safe delete filter"
    - "delete everything except one status"
    - "why did deleteMany remove almost everything"
---

A `deleteMany` filter built on a negation (`$ne`, `$nin`, `$not`) against a
version or status field deletes everything EXCEPT the named value, the
opposite of how a filter shaped like a normal, narrow query usually reads.
Confirmed live, real and disposable: five documents, four `status:
"archived"` and one `status: "active"`; a filter that reads like "find the
active one" instead matches and deletes the four archived ones, a 4-out-of-5
wipe from a filter that looked like routine cleanup. Never build a delete
filter this way: name what to DELETE, never what to keep. Run the filter as
a count first and look at the number before calling `deleteMany` for real; a
match count that surprises you was about to be an incident.

## Examples

### MONGODB_NEGATED_DELETE_FILTER, a wipe disguised as a narrow cleanup

```pattern
const filter = { status: { $ne: 'active' } };
collection.deleteMany(filter);
```
