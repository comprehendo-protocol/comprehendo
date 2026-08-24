---
topic: v3-directives-removed
status: ready
stub_fields: []
signatures:
  - "@tailwind base;"
  - "@import \"tailwindcss\";"
see_also:
  - postcss-plugin-migration
  - js-config-not-autoloaded
vocabularies_served:
  own_terms:
    - "@tailwind"
    - "@import \"tailwindcss\""
  translations:
    - known_tool: sass
      terms:
        - "@use"
    - known_tool: postcss
      terms:
        - "@import"
  task:
    - "fix tailwind classes not applying"
    - "fix tailwind build producing empty css"
    - "migrate @tailwind directives to v4"
---

v3's CSS entry point was three directives, `@tailwind base;`,
`@tailwind components;`, `@tailwind utilities;`, each expanded into real
generated rules at build time. v4 replaced all three with one CSS-native
statement, `@import "tailwindcss";`.

This migration trap is the dangerous kind: silent, not loud. A real v4
build handed the old three-directive file exits 0, prints no warning, and
produces a stylesheet containing only the license comment, nothing else.
Every real utility class an agent's markup uses is absent from the output,
with nothing pointing at why. Confirmed live: real markup using
`bg-red-500` against the old directives produces a 1-line output file with
zero occurrences of that class; the identical build with
`@import "tailwindcss";` instead produces a real, populated stylesheet
with the class present.

## Examples

### TAILWIND_V3_DIRECTIVES_SILENT_NOOP, the old entry point builds clean and produces nothing

```pattern
@tailwind base;
@tailwind components;
@tailwind utilities;
```
