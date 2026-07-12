# Innovatrix — Odoo Hackathon 2026

[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=youtube)](ADD_DEMO_LINK_HERE)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **Note:** Replace `ADD_DEMO_LINK_HERE` above with the public application demo video link before final submission.

Team Innovatrix's submission for the Odoo Hackathon 2026 virtual round — an 8-hour build against a surprise problem statement.

## Table of Contents

- [Team](#team)
- [Problem Statement](#problem-statement)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Contribution Workflow](#contribution-workflow)
- [License](#license)

## Team

**Innovatrix**

| Name | Role |
|---|---|
| Sahil Patel | Team Lead |
| Devasya Joshi | Member |
| Gaurav Rathva | Member |
| Pranjal Shah | Member |

Evaluator: Pawan Gupta

## Problem Statement

_[To be added after selection — 12 Jul 2026, 08:30 AM]_

## Tech Stack

_[To be added once the problem statement and stack are finalized]_

## Features

_[To be added as the application takes shape]_

## Getting Started

### Prerequisites

_[List runtime/tooling requirements here once chosen, e.g. Node.js, Python, a database, etc.]_

### Installation

```bash
# [Add install steps once the stack is chosen]
```

### Running Locally

```bash
# [Add run steps once the stack is chosen]
```

## Contribution Workflow

This repo uses `main`, a `dev` integration branch, four role-based feature branches, and a shared `experiments` branch:

```
main         (stable, demo-ready — only dev merges in here)
├── dev      (integration/testing — feature branches merge here first)
│   ├── feature/frontend-ui           — UI/UX, components, responsiveness, styling
│   ├── feature/backend-api           — server, business logic, APIs
│   ├── feature/database-integration  — data modeling, DB setup, third-party integrations
│   └── feature/testing-docs          — testing, validation, docs, deployment/demo prep
└── experiments  (shared scratch space, not merged into main directly)
```

The role split holds regardless of the eventual tech stack, since it separates by concern, not framework. Feature branches merge into `dev` for integration and testing; `dev` merges into `main` once stable, keeping `main` demo-ready at all times. `experiments` is a shared scratch space for spikes and proofs of concept — useful work is cherry-picked into a feature branch rather than merged directly into `main`.

## License

Released under the [MIT License](LICENSE).
