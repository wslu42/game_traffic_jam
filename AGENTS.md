# AGENTS.md

## Purpose

This repository contains browser-based interactive games or learning activities
published as a static website, typically through GitHub Pages.

Preserve the repository's existing structure and conventions. Each game or
activity should remain self-contained unless an existing shared asset is
intentionally used by multiple activities.

## Repository structure

- Treat the root `index.html` as the portal or landing page when one exists.
- Keep each game or activity in its own existing subdirectory.
- Follow the repository's current directory convention. Do not reorganize
  existing activities merely to make directory names uniform.
- Keep activity-specific HTML, CSS, JavaScript, images, audio, and other media
  close to the activity that uses them.
- Keep shared assets at repository level when they are genuinely shared.
- Use relative paths so the site works correctly from the GitHub Pages
  repository subpath.
- Preserve clear navigation from each activity back to the repository's portal
  when the repository provides one.

## Development principles

- Prefer plain HTML, CSS, and JavaScript unless the existing activity already
  uses another approach or the user explicitly requests one.
- Avoid adding frameworks, build systems, external CDNs, trackers, or new
  dependencies without a clear need and explicit approval.
- Preserve the intended rules, educational content, and behavior of existing
  games unless the requested change intentionally modifies them.
- Make interfaces responsive and touch-friendly.
- Traditional Chinese (`zh-Hant`) is the default UI language unless the user
  explicitly requests otherwise.
- Use accessible semantic HTML where practical, including meaningful control
  labels, visible keyboard focus, and appropriate live announcements for
  changing results.
- Respect `prefers-reduced-motion`; essential interaction must not depend solely
  on animation.
- Do not advertise browser, input, or device capabilities that have not been
  verified. Document known platform limitations honestly.

## Assets and media

- Keep activity-specific media with the activity that uses it.
- Prefer descriptive, lowercase, hyphenated filenames for new assets unless
  matching an existing naming convention is more important.
- Verify image, audio, CSS, JavaScript, and navigation paths from the deployed
  GitHub Pages repository subpath, not only from a local file.
- Provide a reasonable browser-native fallback when prerecorded media cannot
  load, when practical.
- Do not commit generated temporary files, local editor settings, test output,
  credentials, API keys, tokens, or other secrets.

## Adding or changing a game

When adding a new activity:

1. Create a self-contained activity directory using the repository's existing
   directory convention.
2. Include an `index.html` and any activity-local assets required by the game.
3. Add or update the portal entry when the repository has a landing page.
4. Add a clear way to return to the portal when applicable.
5. Update README documentation, activity lists, or activity counts when the
   repository currently maintains them.
6. Start the new game's visible version at `v1.0.0`.
7. Verify all paths and navigation under the GitHub Pages repository subpath.
8. Test the activity before committing.

When modifying an existing activity:

- Preserve unrelated behavior and files.
- Keep the change focused on the requested scope.
- Re-test the affected interaction paths and any shared functionality touched by
  the change.
- Apply the game-version rules below before committing.

## Visible game versions and cache busting

Every mini-game must display its own `vMAJOR.MINOR.PATCH` version in small text
in or directly below the game's header.

The visible version in that game's `index.html` is the source of truth.

For every pushed change affecting a game:

- Increment its patch version at minimum.
- A backward-compatible feature may increment the minor version.
- An incompatible change may increment the major version.
- Reset lower version components when increasing a higher component.
- New games start at `v1.0.0`.
- Update the visible version label and its accessible label together.
- Update every local CSS and JavaScript URL's
  `?v=MAJOR.MINOR.PATCH` query together with the visible version when those
  assets are referenced by the game.
- Changes to shared game assets require version bumps for every affected game.
- Documentation-only changes do not require a game version bump.
- Before committing, verify that visible versions and asset-query versions
  match.

After every push, report the affected games and their exact visible versions.

If the change does not require a game version bump, explicitly report that game
versions are unchanged.

## Git handling

- Inspect the current branch and working-tree status before making changes.
- Preserve unrelated user changes.
- Keep each commit focused on one logical change.
- Use concise imperative commit messages.
- Do not use destructive commands such as `git reset --hard`, `git clean`,
  force pushes, history rewriting, or branch deletion unless explicitly
  authorized.
- Do not change Git configuration, remotes, repository protection, or deployment
  settings unless explicitly requested.
- Explicit user instructions such as `no commit`, `local-only`, `no push`, or
  use a branch/PR override the default workflow below.

## Default workflow: commit and push to `main`

Ordinary requested repository changes are authorized to be committed and pushed
directly to `main` through the owner's connected GitHub account without asking
again for routine commit/push approval.

A request to inspect, discuss, explain, review, or plan does not by itself
authorize code changes.

Before editing:

1. Inspect repository status and the current branch.
2. Fetch `origin`.
3. Synchronize local `main` with the latest `origin/main` using a normal
   fast-forward or other non-destructive integration when needed.
4. Preserve unrelated work and do not rewrite existing branch history.

Before committing:

1. Run checks appropriate to the affected activity.
2. Review the exact intended diff.
3. Confirm that unrelated changes are not included.
4. Verify required visible-version and cache-busting updates.

Immediately before pushing:

1. Fetch `origin` again.
2. Confirm the commit is based on the latest remote `main`.
3. If remote `main` advanced, incorporate those changes without discarding work
   and repeat any checks affected by the integration.

Push only intended, verified commits. Never force-push.

If a push is rejected because remote `main` advanced, fetch the latest remote
state, integrate it normally, review the resulting diff, repeat affected
verification, and retry the push without rewriting published history.

If direct pushes are prevented by repository protection, use a task branch and
pull request rather than changing protection settings.

Pushing `main` may trigger the repository's existing GitHub Pages deployment.
Do not change deployment settings or initiate a separate manual deployment
unless explicitly requested.

## Branches and pull requests

Use a task branch and pull request only when:

- the user explicitly requests one, or
- repository protection requires one.

When a branch is needed:

- Use lowercase, hyphenated names in the format
  `<type>/<short-description>`.
- Allowed types are:
  - `feat/` for new functionality
  - `fix/` for bug fixes
  - `chore/` for documentation, maintenance, and repository structure
- Base the branch on the latest `origin/main`.
- Do not create stacked pull requests unless explicitly requested.
- Never merge a pull request unless explicitly requested.

Before creating a pull request:

- fetch `origin`
- verify the intended base and head branches
- review the exact diff against the intended base

After creating a pull request, verify its URL, base branch, head branch, and
mergeability.

## Verification

Use judgment based on the scope of the change.

For affected activities, verify as applicable:

- portal navigation into the activity
- return navigation back to the portal
- narrow mobile and desktop layouts
- touch interaction
- keyboard interaction and visible focus
- game start and primary controls
- input and game-state behavior
- results and scoring
- reset or replay behavior
- audio and media loading
- browser console errors
- missing assets or incorrect relative paths
- automated tests already present in the repository

When adding a new activity or modifying shared portal, navigation, or shared
assets, also check existing activity links and behaviors that could reasonably
be affected.

Do not claim a check was completed if it was not possible in the current
environment. Record checks that could not be completed.

## Deployment and completion reporting

A successful Git push does not prove that the deployed GitHub Pages site is
already live.

After pushing:

- verify the remote commit
- inspect the associated deployment or workflow status when available
- check the deployed page when practical
- do not claim that the live website is updated unless deployment was actually
  verified

If deployment is pending, failed, or cannot be checked, state that clearly.

When the live deployment cannot yet be verified, tell the user which visible
game version or versions they should expect to see after refreshing once the
deployment completes.

Report:

- what changed
- the commit or commit URL
- affected games and their exact visible versions
- or, when applicable, that game versions are unchanged
- checks performed
- deployment status
- known limitations
- checks that could not be completed

For a needed rollback, prefer a focused `git revert` commit over rewriting
published history.

## Collaboration

- Treat user requests as the source of product intent.
- Ask for clarification only when a decision would materially change scope,
  design, data, or behavior.
- State important assumptions before implementing them.
- For multi-file, structural, or user-visible changes, share a concise plan
  before implementation.
- Preserve user-authored work and unrelated changes.
- When multiple agents work in parallel, assign clear, non-overlapping file
  ownership where possible.
- Record decisions that affect future work in `README.md` or another project
  document when requested.
- Respond to the user in Traditional Chinese as used in Taiwan by default.
- Accept user requests, code comments, and engineering discussion in either
  Traditional Chinese or English.
