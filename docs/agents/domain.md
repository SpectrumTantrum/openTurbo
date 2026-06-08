# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** for ADRs that touch the area you're about to work in.

If either path does not exist, proceed silently. Do not flag its absence or suggest creating it upfront. The producer skill creates domain docs lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```text
/
|-- CONTEXT.md
|-- docs/adr/
|   |-- 0001-local-first-desktop-storage.md
|   `-- 0002-provider-interface.md
`-- src/
```

## Use the glossary's vocabulary

When your output names a domain concept in an issue title, a refactor proposal, a hypothesis, or a test name, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, either reconsider whether the term belongs in this project or note it for the producer skill to resolve.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> Contradicts ADR-0007 (provider interface) -- but worth reopening because...
