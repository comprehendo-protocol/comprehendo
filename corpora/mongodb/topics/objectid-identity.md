---
topic: objectid-identity
status: ready
stub_fields: []
signatures:
  - "new ObjectId(value)"
  - "ObjectId.isValid(value)"
see_also:
  - immutable-id-field
vocabularies_served:
  own_terms:
    - ObjectId
    - _id
    - BSONError
  translations:
    - known_tool: postgres
      terms:
        - uuid
        - primary key
    - known_tool: mongoose
      terms:
        - Schema.Types.ObjectId
        - cast error
  task:
    - "fix a document that should exist but findOne returns null"
    - "validate an id from a route parameter"
    - "input must be a 24 character hex string"
---

`_id` is a real `ObjectId`, a 12-byte BSON type, never a plain string, even
though it PRINTS as a 24-character hex string everywhere (logs, JSON,
`console.log`). Querying `{_id: someString}` against a document whose real
`_id` is an `ObjectId` matches nothing, silently: no error, no warning,
`findOne` just returns `null`, and the type mismatch is invisible unless you
already suspect it. Confirmed live: the exact same value, as a string,
matches zero documents; as the real `ObjectId`, matches the one it should.

The other direction throws instead of failing silently: `new ObjectId(value)`
with anything that is not a 24-character hex string, a 12-byte buffer, or an
integer raises a real `BSONError` at construction time, before any database
call happens. A route parameter, a query string, a typo, all take this exact
path the instant they reach `new ObjectId(...)` unguarded.

## Examples

### MONGODB_INVALID_OBJECTID_FORMAT, an unvalidated id thrown straight at ObjectId

```javascript
import { ObjectId } from 'mongodb';
new ObjectId('not-a-valid-hex-string');
```
