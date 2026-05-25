# Rovo Dev
> Uses the local Rovo Dev CLI log as the usage source.
## Overview
- **CLI:** `acli rovodev`
- **Usage source:** `~/.rovodev/logs/rovodev.log`
- **Metric:** monthly Rovo Dev credits
- **Auth:** no token is read by Usage; the provider reads the latest usage response already logged by Rovo Dev CLI
## Setup
1. Install and authenticate Rovo Dev CLI.
2. Run `acli rovodev run`.
3. Inside Rovo Dev, run `/usage` once.
## Output
Usage reads the latest logged `get_usage_data` response and shows:
- `Monthly credits`: `balance.monthlyUsed` against `userCreditLimits.limits.monthlyCreditAllocation`
- `Remaining`: computed from the monthly allocation and used credits when possible
- `Plan`: inferred from `productType` or `creditType`
## Limitations
- This provider is log-backed, not a direct Rovo Dev API client.
- Data updates after Rovo Dev CLI writes a fresh `/usage` response to `~/.rovodev/logs/rovodev.log`.
- If no usage response exists yet, Usage asks you to run `/usage` inside Rovo Dev CLI once.
