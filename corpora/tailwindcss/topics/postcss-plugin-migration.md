---
topic: postcss-plugin-migration
status: ready
stub_fields: []
signatures:
  - "require('tailwindcss')"
  - "@tailwindcss/postcss"
see_also:
  - v3-directives-removed
vocabularies_served:
  own_terms:
    - postcss.config.js
    - "@tailwindcss/postcss"
    - PostCSS plugin
  translations:
    - known_tool: autoprefixer
      terms:
        - postcss plugin
    - known_tool: vite
      terms:
        - "@tailwindcss/vite"
  task:
    - "fix tailwindcss build error in postcss"
    - "migrate postcss.config.js to tailwind v4"
    - "fix trying to use tailwindcss directly as a PostCSS plugin"
---

v3's PostCSS integration was the `tailwindcss` package itself, handed
straight to `postcss([...])` as a plugin. v4 split that integration into
its own package, `@tailwindcss/postcss`; the `tailwindcss` package's
default export stopped being a valid PostCSS plugin at all. Every v3-era
`postcss.config.js` (`plugins: { tailwindcss: {}, autoprefixer: {} }`,
however it is written, an object literal or the string-keyed form
`postcss-load-config` resolves the same way) throws the moment a real
build actually runs PostCSS, before any CSS is processed.

This one is loud, not silent: the package's own error names the fix
directly. The two-part migration is install `@tailwindcss/postcss`, then
point the config at it instead of `tailwindcss` itself.

## Examples

### TAILWIND_POSTCSS_PLUGIN_MOVED, the v3 plugin usage throws before any CSS is processed

```javascript
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
const result = await postcss([tailwindcss]).process('@tailwind base;', { from: undefined });
console.log(result.css);
```
