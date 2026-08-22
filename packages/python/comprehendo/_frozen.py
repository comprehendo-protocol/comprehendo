"""The port's ``Object.freeze``.

JavaScript freezes a published value in place so nothing holding it can
re-point it afterwards (a published twin code means exactly one thing, RFC
section 11). Python has no such call, and the two obvious substitutes both
break something load-bearing: ``MappingProxyType`` is not JSON-serializable,
which would break the byte-identical serialization proof CC2 [01] rests on,
and a frozen dataclass would rename the wire fields into attributes, which is
the translation layer CC2 forbids.

So a frozen shape here is a ``dict``/``list`` SUBCLASS that refuses every
mutating method. It serializes exactly like the builtin it subclasses,
because ``json`` walks the real storage, and it still answers
``twin["fixes"][0]["title"]`` the way the doc's own example does.

@see .mdd/docs/01-cc2-shape-identity.md
"""

from __future__ import annotations

from typing import Any, NoReturn, TypeVar, cast

__all__ = ["FrozenDict", "FrozenList", "freeze"]

T = TypeVar("T")


def _refuse(what: str) -> NoReturn:
    raise TypeError(
        f"comprehendo: this {what} is frozen. A published shape (a twin, an "
        "entry, an explanation) is what something else is already holding, and "
        "a value whose meaning can change after publication is the failure the "
        "freeze exists to rule out. Build a new one instead."
    )


class FrozenDict(dict[str, Any]):
    """A mapping that answers reads and refuses writes."""

    __slots__ = ()

    def __setitem__(self, key: str, value: Any) -> NoReturn:  # noqa: D105
        _refuse("shape")

    def __delitem__(self, key: str) -> NoReturn:  # noqa: D105
        _refuse("shape")

    def clear(self) -> NoReturn:  # noqa: D102
        _refuse("shape")

    def pop(self, *args: Any, **kwargs: Any) -> NoReturn:  # noqa: D102
        _refuse("shape")

    def popitem(self) -> NoReturn:  # noqa: D102
        _refuse("shape")

    def setdefault(self, *args: Any, **kwargs: Any) -> NoReturn:  # noqa: D102
        _refuse("shape")

    def update(self, *args: Any, **kwargs: Any) -> NoReturn:  # noqa: D102
        _refuse("shape")

    # The in-place operators and `pop` deliberately narrow their supertypes to
    # "never returns": refusing every mutation IS the contract, and an override
    # that stayed Liskov-compatible would have to be able to succeed.
    def __ior__(self, other: Any) -> NoReturn:  # type: ignore[misc]
        _refuse("shape")


class FrozenList(list[Any]):
    """A sequence that answers reads and refuses writes."""

    __slots__ = ()

    def __setitem__(self, index: Any, value: Any) -> NoReturn:  # noqa: D105
        _refuse("list")

    def __delitem__(self, index: Any) -> NoReturn:  # noqa: D105
        _refuse("list")

    def __iadd__(self, other: Any) -> NoReturn:  # type: ignore[misc]
        _refuse("list")

    def __imul__(self, other: Any) -> NoReturn:  # type: ignore[misc]
        _refuse("list")

    def append(self, value: Any) -> NoReturn:  # noqa: D102
        _refuse("list")

    def extend(self, values: Any) -> NoReturn:  # noqa: D102
        _refuse("list")

    def insert(self, index: Any, value: Any) -> NoReturn:  # noqa: D102
        _refuse("list")

    def remove(self, value: Any) -> NoReturn:  # noqa: D102
        _refuse("list")

    def pop(self, index: Any = -1) -> NoReturn:  # noqa: D102
        _refuse("list")

    def clear(self) -> NoReturn:  # noqa: D102
        _refuse("list")

    def sort(self, *args: Any, **kwargs: Any) -> NoReturn:  # noqa: D102
        _refuse("list")

    def reverse(self) -> NoReturn:  # noqa: D102
        _refuse("list")


def freeze(value: T) -> T:
    """Deep-freeze a shape, leaving anything already frozen alone.

    Typed as shape-preserving on purpose: a frozen twin IS a twin, it answers
    every read the mapping answered and serializes to the same bytes. Key order
    is preserved, which is what makes the frozen copy serialize byte-identically
    to the value it was built from (CC2 [01]).
    """
    return cast(T, _freeze(value))


def _freeze(value: Any) -> Any:
    if isinstance(value, (FrozenDict, FrozenList)):
        return value
    if isinstance(value, dict):
        return FrozenDict((key, _freeze(item)) for key, item in value.items())
    if isinstance(value, (list, tuple)):
        return FrozenList(_freeze(item) for item in value)
    return value
