---
topic: authentication
status: ready
stub_fields: []
signatures:
  - "openai.OpenAI(api_key=...)"
  - "OPENAI_API_KEY"
see_also:
  - v0-to-v1-migration
vocabularies_served:
  own_terms:
    - api_key
    - OPENAI_API_KEY
    - AuthenticationError
    - OpenAIError
  translations:
    - known_tool: aws-sdk
      terms:
        - credentials
        - access key
    - known_tool: stripe
      terms:
        - secret key
  task:
    - "authenticate with the OpenAI API"
    - "fix missing credentials"
    - "fix 401 incorrect api key"
---

Two different failures share the word "key" and are easy to conflate.
`OPENAI_MISSING_API_KEY` is a client-side check: the SDK constructs the
client and finds no key anywhere it looks (the `api_key` argument, then
`OPENAI_API_KEY` in the environment), and refuses before sending anything.
`OPENAI_INVALID_API_KEY` is a server answer: a key WAS sent, a real request
reached OpenAI's API, and the server's own 401 says that specific key is not
one it recognizes. The first is "nothing to send"; the second is "sent
something, and it was wrong." Fixing the first means providing a key at all;
fixing the second means providing the CORRECT one, which is a credential
question this corpus cannot answer for the caller.

A key is read in this order: the `api_key` argument to `OpenAI(...)` wins if
present; otherwise the `OPENAI_API_KEY` environment variable (or
`OPENAI_ADMIN_KEY`, for the separate admin client); nothing else is
consulted. A key set in a `.env` file that nothing actually loaded into the
process environment reads as "nothing to send", not as "wrong key."

## Examples

### OPENAI_MISSING_API_KEY, constructing the client finds no key anywhere it looks

```python
import openai
client = openai.OpenAI()
client.chat.completions.create(model="gpt-4", messages=[])
```

### OPENAI_INVALID_API_KEY, a key was sent and the server itself rejected it

```python
import openai
not_a_real_key = "comprehendo-test-placeholder-not-a-real-key-000000"
client = openai.OpenAI(api_key=not_a_real_key)
client.chat.completions.create(model="gpt-4", messages=[{"role": "user", "content": "hi"}])
```
