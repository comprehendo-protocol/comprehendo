---
topic: unique-index-and-duplicates
status: ready
stub_fields: []
signatures:
  - "createIndex(field, { unique: true })"
  - "E11000"
see_also:
  - destructive-delete-filters
vocabularies_served:
  own_terms:
    - unique index
    - E11000
    - duplicate key
  translations:
    - known_tool: postgres
      terms:
        - unique constraint
        - "23505"
    - known_tool: sql
      terms:
        - "UNIQUE KEY violation"
  task:
    - "prevent duplicate documents"
    - "fix E11000 duplicate key error"
    - "enforce uniqueness safely"
---

Uniqueness is a (partial) unique index, never an application-level
check-then-insert. The race is real, not theoretical: two requests can both
run the "does this already exist" check before either one inserts, both pass,
and both insert, because the check and the insert are two separate round
trips with nothing atomic connecting them. A unique index is enforced by the
server on the single insert itself, so it is the one thing that actually
closes that window.

Confirmed live: inserting a document whose indexed field value already
exists throws a real E11000 duplicate key error, naming the collection, the
index, and the offending value, even when the calling code never checked
first. This is a hard rejection to catch and answer as a conflict, never a
signal to retry the same insert unchanged.

## Examples

### MONGODB_DUPLICATE_KEY, a real unique-index rejection

```javascript
import { MongoServerError } from 'mongodb';
throw new MongoServerError({
  errmsg:
    'E11000 duplicate key error collection: app.uniq_test index: email_1 dup key: { email: "a@example.com" }',
  code: 11000,
});
```
