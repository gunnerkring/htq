# Iteration Labels

## Current Baseline

- `v1`
  Saved release checkpoint for the first polished public build.
- `codex/v2`
  Active working branch for the next round of improvements and upgrades.

## Suggested Labeling Going Forward

Use this pattern so checkpoints stay easy to understand:

1. `v2-alpha1`
   First meaningful checkpoint for the next generation of work.
2. `v2-beta1`
   Feature-complete enough for wider testing.
3. `v2-rc1`
   Release candidate after polish and bug fixes.
4. `v2`
   Final shipped version.

## Branch Naming

- `codex/v2`
  Main working branch for the next release train.
- `codex/v2-<feature>`
  Optional side branches for focused chunks of work.

Examples:

- `codex/v2-history`
- `codex/v2-ui-polish`
- `codex/v2-reporting`

## Recommended Workflow

1. Keep `v1` untouched as the rollback point.
2. Build new work on `codex/v2`.
3. Add alpha, beta, or rc tags at major checkpoints.
4. Tag `v2` only when the next release is ready to publish.

## Practical Naming Suggestion

If we start making upgrades now, the first checkpoint I would use is:

- `v2-alpha1`

That keeps the current release clear as `v1` while giving the next set of improvements a clean place to grow.
