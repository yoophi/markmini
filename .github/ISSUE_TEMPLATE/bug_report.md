---
name: Bug report
description: Report a reproducible problem in MarkMini
title: "fix: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a problem. Please include enough context for someone to reproduce it locally.

  - type: dropdown
    id: scope
    attributes:
      label: Scope
      description: Does this affect the viewer-only main line or editing/write flows?
      options:
        - Viewer-only main
        - Editing/write flow
        - Unsure
    validations:
      required: true

  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What is broken?
      placeholder: Briefly describe the problem.
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: List the smallest reliable reproduction steps.
      placeholder: |
        1. Run ...
        2. Open ...
        3. See ...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What should happen?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
      description: What happened instead?
    validations:
      required: true

  - type: textarea
    id: validation
    attributes:
      label: Validation context
      description: Commands, logs, screenshots, OS, or app/runtime versions that help diagnose the issue.
      placeholder: |
        - OS:
        - Command:
        - Relevant output:

  - type: checkboxes
    id: policy
    attributes:
      label: Branch policy check
      options:
        - label: I checked whether this belongs on viewer-only `main` or the editing branch.
          required: false
