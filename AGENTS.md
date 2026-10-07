# Repository Instructions

## Git Handling

- Ordinary repository work may be committed and pushed directly to `main` without additional confirmation. A feature branch or pull request is not required unless the user requests one.
- Check the current branch and working-tree status before changing files or committing. Preserve existing user changes and include only task-related changes in each commit.
- Before pushing to `main`, fetch from `origin` and incorporate any upstream changes without discarding local work. Resolve conflicts carefully and run checks appropriate to the changes.
- Use clear, concise commit messages that describe the resulting change.
- Do not force-push, rewrite published history, delete branches, or discard local changes unless the user explicitly authorizes that operation.
- Report the commit and push outcome, including any checks performed or blockers.

## Visible Game Versions

- Each mini-game displays its own `vMAJOR.MINOR.PATCH` version in small text below the game name in its header. The visible version in that game's `index.html` is the source of truth.
- For every pushed change affecting a game, increment its patch version at minimum. New features may increment the minor version, and incompatible changes may increment the major version. Reset lower components when increasing a higher component. New games start at `v1.0.0`.
- Update the version label, its accessible label, and every local CSS and JavaScript URL's `?v=MAJOR.MINOR.PATCH` query together in the affected game's HTML. This avoids loading cached assets from an older release.
- Changes to shared game assets require bumping every affected game's version. Documentation-only changes do not require a game version bump.
- Verify that visible versions and asset query versions match before committing.
- After every push, report the affected games and their exact visible versions along with the commit. For changes without a game version bump, explicitly report that game versions are unchanged.
- A successful push does not confirm GitHub Pages deployment. Only claim the deployment is live after checking the deployed page; otherwise tell the user which version to look for after refreshing.
