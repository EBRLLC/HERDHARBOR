# Public Site Repository Governance

## Main branch policy

The public website uses `main` as production source.

- normal work must use pull requests;
- Website CI must be green before merge;
- stacked Marketplace/site work must preserve ancestry;
- emergency work uses a hotfix branch plus PR, not a direct production commit;
- public release/store/AI claims must match the actual application and external distribution state.

## Required Website CI

- complete website test suite;
- Marketplace JavaScript syntax checks;
- internal Marketplace asset-reference checks.

## GitHub enforcement

The repository's server-side branch protection/rules for `main` must require pull requests and the Website CI status check. The repository workflow also audits each push to `main` for merged-PR provenance so an enforcement failure is visible immediately.
