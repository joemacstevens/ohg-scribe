---
description: Create a development journal entry to document major developments, features, or decisions
---
# Development Journal Entry

Use this workflow to create a new journal entry documenting major developments in the project.

## Usage

```
/journal [category] [title]
```

**Categories:**
- `feature` — New feature implementations
- `fix` — Bug fixes  
- `review` — UX reviews, code reviews, audits
- `decision` — Architecture or design decisions
- `milestone` — Major releases or versions

## Steps

1. Create a new file in `.agent/journal/` with the naming format:
   ```
   YYYY-MM-DD-title-slug.md
   ```

2. Use this template structure:

```markdown
---
type: journal-entry
category: [feature|fix|review|decision|milestone]
status: [in-progress|completed]
created: YYYY-MM-DD
project: "[[Open Health/OHG Scribe Desktop/index|OHG Scribe Desktop]]"
tags: []
---
# [Title]

## Summary
Brief executive summary of what was done and why (2-3 sentences).

## Key Decisions
- Decision with rationale
- Another decision with rationale

## Changes Made
- Component or file added/modified
- Another change

## Files Affected
- `path/to/file.tsx`
- `path/to/another.ts`

## Next Steps
- Any follow-up work needed
```

3. After creating the entry, update `.agent/journal/index.md` with a link to the new entry.

## Notes

- Entries automatically sync to Obsidian via symlink
- Use [[wikilinks]] for linking between entries
- Keep entries executive-readable — focus on the "what" and "why", not implementation details
