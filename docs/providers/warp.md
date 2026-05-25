# Warp

> Reverse-engineered from Warp's local macOS state. These fields are not a public API and may change without notice.

## Overview

- macOS provider
- Local-only; no network calls
- Primary usage source: `~/Library/Preferences/dev.warp.Warp-Stable.plist`
- Preview/canary fallbacks: `dev.warp.Warp-Preview.plist`, `dev.warp.Warp-Canary.plist`
- Optional plan source: `~/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Stable/warp.sqlite`

## Plugin metric

- `Requests`
  - `used`: `AIRequestLimitInfo.num_requests_used_since_refresh`
  - `limit`: `AIRequestLimitInfo.limit`
  - `resetsAt`: `AIRequestLimitInfo.next_refresh_time`
  - `periodDurationMs`: derived from `AIRequestQuotaInfoSetting.cycle_history[*].end_date` when available
- Fallback key: `AIAssistantRequestLimitInfo`
- Detail line: `Cycle` from `request_limit_refresh_duration`

## Plan label

Usage reads `teams.billing_metadata_json` from `warp.sqlite` and uses `tier.name` when present.

## Notes

- If Warp has not written request-limit data yet, Usage shows `Warp usage data unavailable. Open Warp and try again.`
- Voice and codebase quota fields are intentionally ignored for now. The request quota is the main billing signal.
