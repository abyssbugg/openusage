# Factory (Droid)

> Reverse-engineered, undocumented API. May change without notice.

## Overview

- **Protocol:** REST (JSON)
- **Base URL:** `https://api.factory.ai`
- **Auth provider:** WorkOS (`api.workos.com`)
- **Client ID:** `client_01HNM792M5G5G1A2THWPXKFMXB`
- **Usage limits:** percentages for current Factory UI limits
- **Token counts:** integers (raw token counts, legacy response)
- **Timestamps:** unix milliseconds
- **Billing period:** ~27 days (monthly)

## Endpoints

### POST /api/organization/subscription/usage

Returns Factory subscription usage. Current responses expose UI-style limits; older responses expose raw token allowances.

#### Headers

| Header | Required | Value |
|---|---|---|
| Authorization | yes | `Bearer <access_token>` |
| Content-Type | yes | `application/json` |
| Accept | no | `application/json` |

#### Request Body

```json
{
  "useCache": true
}
```

#### Response
Current UI-style response shape:

```jsonc
{
  "usage": {
    "plan": "Standard",
    "extraUsage": {
      "remainingUsd": 0
    },
    "standardUsage": {
      "fiveHour": {
        "usedPercent": 2,
        "startDate": 1770623326000,
        "endDate": 1770641326000
      },
      "weekly": {
        "usedRatio": 0.01,
        "startDate": 1770623326000,
        "endDate": 1771228126000
      },
      "monthly": {
        "usedPercent": 1,
        "startDate": 1770623326000,
        "endDate": 1773128926000
      }
    },
    "droidCore": {
      "enabled": true
    },
    "managedComputers": {
      "usedHours": 0,
      "includedHours": 10,
      "startDate": 1770623326000,
      "endDate": 1772178526000
    }
  }
}
```

Legacy token response shape:

```jsonc
{
  "usage": {
    "startDate": 1770623326000,         // billing period start (unix ms)
    "endDate": 1772956800000,           // billing period end (unix ms)
    "standard": {
      "userTokens": 0,                  // user's token usage
      "orgTotalTokensUsed": 5000000,    // org total tokens used
      "orgOverageUsed": 0,              // overage tokens used
      "basicAllowance": 20000000,       // base allowance
      "totalAllowance": 20000000,       // total (base + bonus)
      "orgOverageLimit": 0,             // overage limit
      "usedRatio": 0.25                 // usage ratio (0-1)
    },
    "premium": {
      "userTokens": 0,
      "orgTotalTokensUsed": 0,
      "orgOverageUsed": 0,
      "basicAllowance": 0,              // 0 for Pro, >0 for Max/Enterprise
      "totalAllowance": 0,
      "orgOverageLimit": 0,
      "usedRatio": 0
    }
  },
  "source": "cache",                    // "cache" or "live"
  "cacheUpdated": false
}
```

### Plan Detection

Plan is read from `usage.plan`, `usage.planName`, `usage.tier`, `usage.usageMode`, or `usage.currentUsageMode` when present.

If `droidCore.enabled`, `droidCore.available`, or `droidCore.included` is true, Usage appends `+ Droid Core`.

For legacy responses, plan is inferred from `standard.totalAllowance`:

| Allowance | Plan |
|---|---|
| 200M+ | Max |
| 20M+ | Pro |
| >0 | Basic |

Premium tokens (`premium.totalAllowance > 0`) are only available on Max/Enterprise plans.

## Authentication

### Token Location

- `~/.factory/auth.v2.file` + `~/.factory/auth.v2.key` (current droid auth store; AES-256-GCM encrypted JSON)
- `~/.factory/auth.encrypted` (legacy droid auth file)
- `~/.factory/auth.json` (older droid auth file)
- macOS keychain entry (when droid uses keyring-backed storage)

```jsonc
{
  "access_token": "<WorkOS JWT>",       // ~1329 chars, 7-day lifetime
  "refresh_token": "<token>"            // 25-char WorkOS session token
}
```

### JWT Payload Structure

```jsonc
{
  "exp": 1738900000,                    // expiry (unix seconds)
  "org_id": "org_xxx",                  // organization ID
  "email": "user@example.com",
  "roles": ["owner"]
}
```

### Token Refresh

Access tokens have a 7-day lifetime. Refreshed when within 24 hours of expiry or on 401/403.

```
POST https://api.workos.com/user_management/authenticate
Content-Type: application/x-www-form-urlencoded
```

```
grant_type=refresh_token
&refresh_token=<refresh_token>
&client_id=client_01HNM792M5G5G1A2THWPXKFMXB
```

#### Response

```jsonc
{
  "access_token": "<new_jwt>",
  "refresh_token": "<new_refresh_token>",
  "user": { ... },
  "organization_id": "org_xxx"
}
```

## Prerequisites

The droid CLI must be installed and authenticated:

```bash
# Install droid CLI (if not already installed)
# Then authenticate:
droid
# Follow OAuth flow in browser
```

This creates auth data in the droid auth store (file and/or keychain, depending on droid version/configuration).
