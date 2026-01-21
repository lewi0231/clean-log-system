# GitHub Workflow

> Using GitHub CLI (`gh`) to manage issues and pull requests efficiently.

---

## Overview

The GitHub CLI (`gh`) provides a command-line interface for managing GitHub issues and pull requests. This workflow is particularly useful when reviewing issues and working through them one by one, creating a PR for each issue.

---

## Prerequisites

1. **Install GitHub CLI**: [Installation guide](https://cli.github.com/manual/installation)
2. **Authenticate**: Run `gh auth login` to authenticate with your GitHub account
3. **Verify**: Run `gh auth status` to confirm authentication

---

## Common Workflows

### Listing Issues

```bash
# List all open issues
gh issue list

# List issues with specific labels
gh issue list --label "bug"

# List issues assigned to you
gh issue list --assignee @me

# List issues in a specific state
gh issue list --state closed

# Filter by author
gh issue list --author "username"

# Search with custom query
gh issue list --search "is:issue is:open label:enhancement"
```

### Creating Issues

```bash
# Create an issue interactively (opens editor)
gh issue create

# Create an issue with title and body
gh issue create --title "Fix authentication bug" --body "Description of the issue"

# Create an issue with labels
gh issue create --title "Add dark mode" --body "Implement dark mode theme" --label "enhancement"

# Create an issue and assign it
gh issue create --title "Update dependencies" --body "Update all npm packages" --assignee @me

# Create an issue from a file
gh issue create --title "Fix bug" --body-file bug-description.md
```

### Creating Pull Requests

```bash
# Create a PR interactively (opens browser)
gh pr create

# Create a PR with title and body
gh pr create --title "Fix authentication bug" --body "Fixes #123"

# Create a PR from current branch to main
gh pr create --base main --head feature-branch --title "Add feature" --body "Description"

# Create a PR and link to an issue
gh pr create --title "Fix bug" --body "Closes #123"

# Create a PR with reviewers
gh pr create --title "Add feature" --body "Description" --reviewer username1,username2

# Create a PR as draft
gh pr create --draft --title "WIP: Add feature" --body "Work in progress"

# Create a PR and auto-merge when ready
gh pr create --title "Fix bug" --body "Fixes #123" --auto-merge
```

### Working Through Issues

A typical workflow for reviewing and addressing issues:

```bash
# 1. List open issues
gh issue list

# 2. View a specific issue
gh issue view 123

# 3. Create a branch for the issue
git checkout -b fix/issue-123

# 4. Make your changes and commit
git add .
git commit -m "Fix: Address issue #123"

# 5. Push the branch
git push origin fix/issue-123

# 6. Create a PR linked to the issue
gh pr create --title "Fix: Issue #123" --body "Closes #123" --base main

# 7. After PR is merged, close the issue (if not auto-closed)
gh issue close 123
```

---

## Useful Commands

### Viewing Issues and PRs

```bash
# View an issue
gh issue view 123

# View a PR
gh pr view 456

# View PR checks
gh pr checks 456

# View PR diff
gh pr diff 456
```

### Managing PRs

```bash
# List PRs
gh pr list

# List PRs with specific state
gh pr list --state merged

# Checkout a PR locally
gh pr checkout 456

# Merge a PR
gh pr merge 456

# Merge with squash
gh pr merge 456 --squash

# Close a PR
gh pr close 456
```

### Managing Issues

```bash
# View an issue
gh issue view 123

# Comment on an issue
gh issue comment 123 --body "This is a comment"

# Close an issue
gh issue close 123

# Reopen an issue
gh issue reopen 123

# Add labels to an issue
gh issue edit 123 --add-label "bug,priority-high"

# Assign an issue
gh issue edit 123 --add-assignee @me
```

---

## Best Practices

### Issue Management

1. **Use descriptive titles**: Clear, concise titles that explain the issue
2. **Include context**: Add relevant information, steps to reproduce, expected vs actual behavior
3. **Link related issues**: Use `#123` to reference other issues
4. **Use labels**: Organize issues with appropriate labels (bug, enhancement, documentation, etc.)

### Pull Request Management

1. **Link to issues**: Always reference the related issue in the PR description (e.g., "Fixes #123" or "Closes #123")
2. **Descriptive titles**: Use clear titles that explain what the PR does
3. **Detailed descriptions**: Include context, changes made, and testing notes
4. **Small, focused PRs**: Keep PRs focused on a single issue or feature
5. **Use draft PRs**: Mark work-in-progress PRs as drafts

### Workflow Tips

1. **One issue per PR**: Create a separate PR for each issue to keep changes focused and reviewable
2. **Branch naming**: Use descriptive branch names like `fix/issue-123` or `feature/add-dark-mode`
3. **Regular updates**: Keep issues updated with progress and close them when resolved
4. **Auto-close issues**: Use "Closes #123" or "Fixes #123" in PR descriptions to auto-close issues when merged

---

## Example: Complete Workflow

```bash
# 1. List open issues
gh issue list

# 2. View issue details
gh issue view 123

# 3. Create and switch to a new branch
git checkout -b fix/issue-123

# 4. Make changes, test, and commit
git add .
git commit -m "Fix: Resolve authentication timeout issue (#123)"

# 5. Push branch
git push origin fix/issue-123

# 6. Create PR linked to issue
gh pr create \
  --title "Fix: Authentication timeout issue" \
  --body "This PR resolves the authentication timeout issue reported in #123.

Changes:
- Increased session timeout duration
- Added automatic token refresh
- Improved error handling

Closes #123" \
  --base main \
  --reviewer @me

# 7. After PR is reviewed and merged, the issue will auto-close
# If needed, manually close:
gh issue close 123
```

---

## Integration with Git Workflow

This GitHub CLI workflow integrates seamlessly with standard Git practices:

```bash
# Standard Git workflow
git checkout main
git pull origin main
git checkout -b fix/issue-123

# Make changes
# ... edit files ...

git add .
git commit -m "Fix: Issue #123"
git push origin fix/issue-123

# Create PR via CLI
gh pr create --title "Fix: Issue #123" --body "Closes #123"
```

---

## Troubleshooting

### Authentication Issues

```bash
# Check authentication status
gh auth status

# Re-authenticate if needed
gh auth login

# Switch accounts
gh auth switch
```

### Repository Not Found

```bash
# Set the repository context
gh repo set-default owner/repo

# Or specify repo in commands
gh issue list --repo owner/repo
```

---

*Last updated: January 20, 2026*
