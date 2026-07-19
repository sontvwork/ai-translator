---
name: create-pr
description: Create a GitHub pull request via GitHub MCP from the current branch or a branch name given by the user
---

# Create Pull Request Skill

This skill guides the agent in creating a pull request on GitHub (repo `sontvwork/ai-translator`, base `main`) using the GitHub MCP tools. It works on the current branch, or on an existing branch whose name the user provides.

## Workflow

1.  **Determine Target Branch**
    -   **If the user provides a branch name** (e.g. `/create-pr feat/add-dark-mode`): use it as the target branch.
        -   Run `git fetch origin <branch>` to verify it exists on origin and fetch its latest state.
        -   **If it is not on origin but exists locally:** run `git push -u origin <branch>`.
        -   **If it exists neither on origin nor locally:** inform the user and exit.
        -   Do NOT touch the working tree or switch branches. Skip steps 2 and 4, and use `origin/<branch>` instead of `HEAD` in step 5.
    -   **If no branch is provided:** run `git branch --show-current` to get the current branch.
        -   **If on `main` or `master`:** You MUST create a new branch before proceeding.
            -   Derive a branch name from the changes using the `type/kebab-description` convention (see the `git-semantic-commit` skill, e.g. `feat/add-dark-mode`).
            -   Present the suggested branch name to the user for confirmation or editing.
            -   *Action:* Run `git checkout -b <branch-name>` upon approval.

2.  **Check Working Tree** *(current-branch mode only)*
    -   Run `git status` to check for uncommitted changes.
    -   **If there are uncommitted changes:** Commit them first following the `git-semantic-commit` skill workflow.
    -   **If the tree is clean and there are no commits ahead of `origin/main`:** Inform the user there is nothing to create a PR for and exit.

3.  **Check for Existing PR**
    -   Call `mcp__github__list_pull_requests` with `owner: sontvwork`, `repo: ai-translator`, `head: sontvwork:<branch>`, `state: open`.
    -   **If an open PR already exists for this branch:** Report the existing PR URL and exit. In current-branch mode, push the latest commits (`git push`) first.

4.  **Push Branch** *(current-branch mode only)*
    -   Run `git push -u origin <branch>`.

5.  **Compose PR Title and Body**
    -   Run `git log origin/main..<ref> --oneline` and review the diff summary (`git diff origin/main...<ref> --stat`), where `<ref>` is `HEAD` in current-branch mode or `origin/<branch>` when the user provided a branch name.
    -   **Title:** Follow Conventional Commits format `type(scope): description`.
        -   If the branch has a single commit, reuse its message.
        -   If multiple commits, summarize the primary change.
    -   **Body:** A `## Summary` section (1-3 sentences on what and why), followed by a `## Changes` bullet list of notable changes.

6.  **Create PR and Report**
    -   Present the title and body to the user for confirmation or editing.
    -   *Action:* Call `mcp__github__create_pull_request` with `owner: sontvwork`, `repo: ai-translator`, `base: main`, `head: <branch>`, and the composed title and body upon approval.
    -   Report the URL of the created pull request.

## Example

**Branch:** `feat/add-dark-mode` with commit `feat(popup): add dark mode toggle`

**PR Title:**
`feat(popup): add dark mode toggle`

**PR Body:**
```markdown
## Summary
Adds a dark mode toggle to the popup so users can switch themes manually.

## Changes
- Add theme toggle button to popup header
- Persist theme preference via chrome.storage
```
