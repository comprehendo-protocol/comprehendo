---
topic: js-config-not-autoloaded
status: ready
stub_fields: []
signatures:
  - "tailwind.config.js"
  - "@config \"./tailwind.config.js\";"
  - "@theme"
see_also:
  - v3-directives-removed
vocabularies_served:
  own_terms:
    - tailwind.config.js
    - "@config"
    - "@theme"
  translations:
    - known_tool: postcss
      terms:
        - config file
    - known_tool: vite
      terms:
        - config file not picked up
  task:
    - "fix tailwind theme customization not applying"
    - "fix custom colors missing from tailwind build"
    - "migrate tailwind.config.js to v4"
---

v3 always read `tailwind.config.js` automatically, no reference anywhere
needed. v4's configuration model is CSS-native, `@theme` blocks in the CSS
entry point; a JS config file is still supported for the parts with no
CSS-native equivalent yet, but only when the CSS entry point explicitly
loads it with an `@config "./tailwind.config.js";` directive.

A leftover v3-style config file with no `@config` directive anywhere is
not an error and not a warning, it is simply never read. Every custom
theme value it declares (colors, spacing, fonts) is silently absent from
the build, the exact same silent-success shape `v3-directives-removed`
describes. Confirmed live: a config declaring a custom brand color
produces zero occurrences of that color in the real generated output with
no `@config` directive present anywhere, and the identical config produces
the real color value the moment `@config "./tailwind.config.js";` is
added to the CSS entry point.

## Examples

### TAILWIND_CONFIG_JS_NOT_AUTO_LOADED, a v3-shaped config file nothing references

```pattern
module.exports = {
  content: ['./src/**/*.html'],
  theme: {
    extend: {
      colors: { brand: '#123456' },
    },
  },
};
```
