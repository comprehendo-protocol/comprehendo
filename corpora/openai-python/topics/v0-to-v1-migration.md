---
topic: v0-to-v1-migration
status: ready
stub_fields: []
signatures:
  - "openai.OpenAI(api_key=...)"
  - "client.chat.completions.create(...)"
  - "client.completions.create(...)"
  - "client.embeddings.create(...)"
  - "client.moderations.create(...)"
see_also:
  - authentication
vocabularies_served:
  own_terms:
    - openai
    - ChatCompletion
    - client
    - resource
  translations:
    - known_tool: langchain
      terms:
        - ChatOpenAI
        - llm client
    - known_tool: httpx
      terms:
        - client instance
        - base_url
  task:
    - "call the chat completions API"
    - "migrate from openai 0.x to 1.x"
    - "fix ChatCompletion is no longer supported"
---

The 1.0.0 release replaced the whole module-level API (`openai.ChatCompletion`,
`openai.Completion`, `openai.Embedding`, `openai.Moderation`, and their
siblings) with an instantiated client whose resources are attributes, not
module functions. Every one of the old names still exists as an attribute on
the `openai` module, but reading it does not return the old class: it returns
a proxy whose only job is to raise `APIRemovedInV1` naming exactly which
symbol was accessed, before any network call and before any credential is
checked. Nothing about the request is wrong; the shape of the call is what
changed.

The migration is mechanical, one resource at a time: instantiate a client
once (`client = openai.OpenAI()`), then call the resource as an attribute
path on it, `.create(...)` at the end exactly as it always was.

| v0 (removed) | v1 |
|---|---|
| `openai.ChatCompletion.create(...)` | `client.chat.completions.create(...)` |
| `openai.Completion.create(...)` | `client.completions.create(...)` |
| `openai.Embedding.create(...)` | `client.embeddings.create(...)` |
| `openai.Moderation.create(...)` | `client.moderations.create(...)` |
| `openai.api_key = "sk-..."` | `openai.OpenAI(api_key="sk-...")` |

The package's own `openai migrate` command rewrites a codebase automatically
for the common cases; this table is what it is rewriting to.

## Examples

### OPENAI_API_REMOVED_V0, the v0 module-level API raises before any network call

```python
import openai
openai.ChatCompletion.create(model="gpt-4", messages=[])
```
