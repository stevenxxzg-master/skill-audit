# GitHub Action Usage

## Basic Usage

Add `skill-audit` to your workflow to scan AI agent skills for security issues on every push or PR.

```yaml
name: Skill Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/skill-audit@v1
        with:
          path: './my-skill'
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to the skill directory to scan | `.` |
| `threshold` | Minimum passing score (0-100) | `0` |
| `fail-on-danger` | Fail if any danger-level findings exist | `true` |
| `format` | Output format: `text`, `json`, or `markdown` | `text` |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Security score (0-100) |
| `grade` | Letter grade (A-F) |
| `findings-count` | Total number of findings |
| `report-path` | Path to the generated report file |

## Setting a Threshold

Fail the build if the score drops below a minimum:

```yaml
- uses: anthropics/skill-audit@v1
  with:
    path: './skills/my-agent'
    threshold: 70
```

## PR Auto-Comments

When running on a pull request with `GITHUB_TOKEN` available, skill-audit automatically posts (or updates) a comment with the scan report.

```yaml
name: Skill Audit
on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/skill-audit@v1
        with:
          path: '.'
          threshold: 50
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The comment is updated on subsequent pushes to the same PR (no duplicate comments).

## Using Outputs

Access the scan results in subsequent steps:

```yaml
- uses: anthropics/skill-audit@v1
  id: audit
  with:
    path: './my-skill'
    fail-on-danger: 'false'

- name: Check results
  run: |
    echo "Score: ${{ steps.audit.outputs.score }}"
    echo "Grade: ${{ steps.audit.outputs.grade }}"
    echo "Findings: ${{ steps.audit.outputs.findings-count }}"
```

## Badge in README

Add a dynamic badge to your README using the score output. You can use a workflow that generates and commits a badge, or use the built-in `skill-audit badge` CLI command:

```bash
npx skill-audit badge ./my-skill -o badge.svg
```

Then reference it in your README:

```markdown
![skill-audit](./badge.svg)
```

For a dynamic badge via shields.io, you can use a workflow that writes the score to a gist:

```yaml
- uses: anthropics/skill-audit@v1
  id: audit
  with:
    path: '.'

- name: Update badge
  uses: schneegans/dynamic-badges-action@v1.7.0
  with:
    auth: ${{ secrets.GIST_TOKEN }}
    gistID: <your-gist-id>
    filename: skill-audit.json
    label: skill-audit
    message: "${{ steps.audit.outputs.score }}/100 ${{ steps.audit.outputs.grade }}"
    valColorRange: ${{ steps.audit.outputs.score }}
    minColorRange: 0
    maxColorRange: 100
```

Then in your README:

```markdown
![skill-audit](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<user>/<gist-id>/raw/skill-audit.json)
```

## Full Example Workflow

```yaml
name: Skill Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  pull-requests: write

jobs:
  skill-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/skill-audit@v1
        id: audit
        with:
          path: '.'
          threshold: 50
          fail-on-danger: 'true'
          format: 'text'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: skill-audit-report
          path: ${{ steps.audit.outputs.report-path }}
```
