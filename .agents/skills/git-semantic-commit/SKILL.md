---
name: git-semantic-commit
description: Analyze git changes and create a semantic commit
---

# Git Semantic Commit Skill

This skill guides the agent in analyzing git changes and creating a commit message following the Conventional Commits specification.

## Workflow

1.  **Check Git Status**
    -   Run `git status` to see the current state of the repository.

2.  **Handle Staging**
    -   **If files are staged:** Proceed to step 3.
    -   **If files are modified but not staged:** Ask the user if they want to stage all changes (`git add .`) or specific files.
        -   *Action:* Run `git add <files>` based on user response.
    -   **If no changes:** Inform the user and exit.

3.  **Analyze Diff**
    -   Run `git diff --cached` to view the changes to be committed.
    -   Analyze the code changes to understand:
        -   **What** was changed (new feature, bug fix, refactor, etc.).
        -   **Where** it was changed (scope: e.g., `popup`, `background`, `utils`).
        -   **Why** it was changed.

4.  **Generate Semantic Commit Message**
    -   Construct a commit message using the format: `type(scope): description`
    -   **Types:**
        -   `feat`: A new feature
        -   `fix`: A bug fix
        -   `docs`: Documentation only changes
        -   `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
        -   `refactor`: A code change that neither fixes a bug nor adds a feature
        -   `perf`: A code change that improves performance
        -   `test`: Adding missing tests or correcting existing tests
        -   `build`: Changes to build system or dependencies
        -   `ci`: Changes to CI configuration files and scripts
        -   `chore`: Other changes that don't modify src or test files
        -   `revert`: Reverts a previous commit
    -   **Scope:** Optional but recommended (e.g., `(auth)`, `(parser)`).
    -   **Description:** Short, imperative mood (e.g., "add", "fix", "update"), no period at the end.

5.  **Review and Commit**
    -   Present the generated commit message to the user.
    -   **Ask for confirmation** or allow the user to edit the message.
    -   *Action:* Run `git commit -m "your message"` upon approval.

## Example

**Diff:**
```diff
- const url = 'http://example.com';
+ const url = 'https://example.com';
```

**Reasoning:**
The protocol was changed from http to https for security. This is a fix or refactor. The scope is likely global or configuration.

**Commit Message:**
`fix(config): update url to use https`
