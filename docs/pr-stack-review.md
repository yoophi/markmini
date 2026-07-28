# PR Stack Review

Last reviewed: 2026-04-28

## Summary

The current open PR stack is clean from GitHub's mergeability perspective, but most branches are sequential product-polish branches that build on the same file-action and dirty-draft safety work. They should be reviewed and merged from oldest to newest to avoid unnecessary conflict resolution.

GitHub reports `mergeStateStatus=CLEAN` for the open PRs listed below. No status checks are currently reported on these branches because the Validation workflow is itself still pending in PR #46 and has not landed on `main` yet.

## Recommended merge order

1. #26 `feat: replace file action prompts with in-app dialogs`
2. #28 `feat: replace unsaved-change confirm with in-app dialog`
3. #30 `feat: add inline success feedback for file actions`
4. #32 `feat: guard dirty drafts on window close`
5. #34 `feat: add save-and-continue unsaved dialog action`
6. #36 `chore: refine unsaved dialog copy by action`
7. #38 `feat: guard delete action with unsaved dialog`
8. #40 `refactor: extract unsaved change guard hook`
9. #42 `test: cover document safety store flows`
10. #44 `docs: align README with file action flows`
11. #46 `ci: add validation workflow`
12. #48 `test: cover unsaved change guard hook`
13. #50 `docs: document validation workflow`

## Issue status guidance

The related issues (#25, #27, #29, #31, #33, #35, #37, #39, #41, #43, #45, #47, #49) should stay open until their PRs are merged. Each PR already includes a closing keyword for its issue.

## Next product-facing work

After this stack is reconciled, the next useful product-facing slice is document list search/filtering. File actions and dirty-draft safety are now covered, so improving navigation within larger Markdown folders is the next natural user-facing improvement.
