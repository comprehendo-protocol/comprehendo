"""The kit's JSON Schema subset, validated without a dependency.

The TypeScript kit validates with Ajv. This port ships zero runtime
dependencies and does not want its conformance run to depend on a wheel
resolving either, so this module implements EXACTLY the keyword subset the
ten schemas in `packages/spec/kit/shapes/` use, and nothing else.

The load-bearing decision is what happens on a keyword this module does not
know: it RAISES. A validator that silently ignores what it cannot read
reports green in exactly the case where a schema said something it did not
understand, which is worse than no validator at all. `test_jsonschema_mini.py`
is the anti-vacuity control: this module must reject a missing required
field, a wrong type, a bad enum, a bad const, an anyOf miss, and an unknown
keyword, or the conformance run's green means nothing.
"""

from __future__ import annotations

from typing import Any

__all__ = ["SchemaError", "Validator", "errors_for"]

# Annotation keywords: real JSON Schema, no effect on validity.
_ANNOTATIONS = frozenset({"$schema", "$id", "title", "description", "$comment", "examples"})

# The assertion keywords this validator implements, in the order it applies them.
_SUPPORTED = frozenset(
    {
        "type",
        "required",
        "properties",
        "items",
        "enum",
        "const",
        "anyOf",
        "additionalProperties",
        "$ref",
    }
)


class SchemaError(Exception):
    """A schema this validator cannot read. Never silently ignored."""


def _is_type(value: Any, name: str) -> bool:
    if name == "object":
        return isinstance(value, dict)
    if name == "array":
        return isinstance(value, list)
    if name == "string":
        return isinstance(value, str)
    if name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if name == "boolean":
        return isinstance(value, bool)
    if name == "null":
        return value is None
    raise SchemaError(f'unknown JSON Schema type "{name}"')


class Validator:
    """Validates against a set of schemas registered by their own `$id`."""

    def __init__(self, schemas: dict[str, Any]) -> None:
        self._by_id: dict[str, Any] = {}
        for schema in schemas.values():
            identifier = schema.get("$id")
            if not isinstance(identifier, str):
                raise SchemaError("every kit schema declares an $id")
            self._by_id[identifier] = schema

    def errors(self, schema: Any, value: Any, at: str = "") -> list[str]:
        """Every way `value` fails `schema`, as paths and reasons."""
        if schema is True:
            return []
        if schema is False:
            return [f"{at or '<root>'}: schema is false, nothing validates"]
        if not isinstance(schema, dict):
            raise SchemaError(f"a schema is an object or a boolean, got {type(schema).__name__}")

        unknown = set(schema) - _ANNOTATIONS - _SUPPORTED
        if unknown:
            raise SchemaError(
                f"this validator does not implement {sorted(unknown)}; it is deliberately "
                "the kit's subset and raises rather than reporting a green it did not earn"
            )

        found: list[str] = []
        where = at or "<root>"

        if "$ref" in schema:
            target = self._by_id.get(schema["$ref"])
            if target is None:
                raise SchemaError(f'unresolvable $ref "{schema["$ref"]}"')
            found.extend(self.errors(target, value, at))

        if "type" in schema:
            names = schema["type"]
            names = [names] if isinstance(names, str) else names
            if not any(_is_type(value, name) for name in names):
                found.append(f"{where}: expected type {schema['type']}, got {_describe(value)}")
                return found

        if "const" in schema and value != schema["const"]:
            found.append(f"{where}: expected const {schema['const']!r}, got {value!r}")

        if "enum" in schema and value not in schema["enum"]:
            found.append(f"{where}: {value!r} is not one of {schema['enum']!r}")

        if "anyOf" in schema:
            if all(self.errors(branch, value, at) for branch in schema["anyOf"]):
                found.append(f"{where}: matches none of the anyOf branches")

        if isinstance(value, dict):
            for name in schema.get("required", []):
                if name not in value:
                    found.append(f"{where}: missing required property {name!r}")
            properties = schema.get("properties", {})
            for name, sub in properties.items():
                if name in value:
                    found.extend(self.errors(sub, value[name], f"{at}/{name}"))
            if "additionalProperties" in schema:
                extra = schema["additionalProperties"]
                for name, item in value.items():
                    if name not in properties:
                        found.extend(self.errors(extra, item, f"{at}/{name}"))

        if isinstance(value, list) and "items" in schema:
            for index, item in enumerate(value):
                found.extend(self.errors(schema["items"], item, f"{at}/{index}"))

        return found


def _describe(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    if isinstance(value, str):
        return "string"
    return "number"


def errors_for(schemas: dict[str, Any], schema_file: str, value: Any) -> list[str]:
    """Validate `value` against one kit schema, by file name."""
    validator = Validator(schemas)
    schema = schemas.get(schema_file)
    if schema is None:
        raise SchemaError(f"the kit carries no schema {schema_file}")
    return validator.errors(schema, value)
