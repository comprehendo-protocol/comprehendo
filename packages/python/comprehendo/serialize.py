"""The canonical serialization CC2 [01] freezes.

"Byte-identical" is literal, not "semantically equivalent": field order, key
casing, and null-versus-absent all matter. The kit states the bytes as
`JSON.stringify(value, null, 2)` plus one trailing newline, key order as
authored, and this is the Python side of that one definition.

Three settings carry the whole contract, and each is a place a default would
have been wrong:

- ``indent=2`` with the default separators, which Python already spells the
  same way JavaScript does (``", "`` collapses to ``","`` on an indented
  line, and ``": "`` stays).
- ``ensure_ascii=False``. Python escapes non-ASCII by default and JavaScript
  does not, so the default would write ``\\u00e9`` where the kit has ``é``:
  same document, different bytes, which is exactly the failure this contract
  names.
- ``sort_keys`` left OFF, deliberately. Key order is the AUTHORED order in
  both ports, so sorting here would reorder every shape and silently break
  the round-trip it exists to prove.

@see .mdd/docs/01-cc2-shape-identity.md
"""

from __future__ import annotations

import json
from typing import Any

__all__ = ["canonical"]


def canonical(value: Any) -> str:
    """The canonical bytes of one shape: two-space indent, authored key order,
    one trailing newline.

    A shape serialized here and the kit's own fixture file are byte-identical
    when they carry the same document.
    """
    return f"{json.dumps(value, indent=2, ensure_ascii=False, separators=(',', ': '))}\n"
