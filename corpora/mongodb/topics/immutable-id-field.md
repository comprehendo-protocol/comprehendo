---
topic: immutable-id-field
status: ready
stub_fields: []
signatures:
  - "updateOne(filter, { $set: { _id, ...rest } })"
see_also:
  - objectid-identity
vocabularies_served:
  own_terms:
    - immutable field
    - code 66
    - $set
  translations:
    - known_tool: postgres
      terms:
        - primary key update
    - known_tool: sql
      terms:
        - "UPDATE ... SET id ="
  task:
    - "fix Performing an update on the path _id would modify the immutable field"
    - "why does updateOne throw code 66"
    - "spreading a whole document into $set"
---

Identity goes in the filter of a write, never its body. The realistic way
this breaks: a document is round-tripped through JSON (`JSON.parse(
JSON.stringify(doc))`, an API boundary, a cache, a queue message), which
turns its real `ObjectId` `_id` into a plain string, and the WHOLE object,
identity field included, gets spread back into an update's `$set`. MongoDB
compares `_id` by BSON type and value together, so a string standing in for
the stored `ObjectId` reads as a real attempt to change it, not restate it,
and the server refuses.

Confirmed live: restating the exact same `ObjectId` INSTANCE in `$set` is a
silent no-op, no error at all, because nothing about the field actually
changed. Restating it as a string (the JSON-round-trip shape), or as any
other real `ObjectId`, throws every time, same real error, same code.

## Examples

### MONGODB_ID_TYPE_MISMATCH_ON_UPDATE, a JSON-round-tripped _id spread back into $set

```javascript
import { MongoServerError } from 'mongodb';
throw new MongoServerError({
  errmsg: "Performing an update on the path '_id' would modify the immutable field '_id'",
  code: 66,
});
```
