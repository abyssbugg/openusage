(function () {
  const PLIST_PATHS = [
    "~/Library/Preferences/dev.warp.Warp-Stable.plist",
    "~/Library/Preferences/dev.warp.Warp-Preview.plist",
    "~/Library/Preferences/dev.warp.Warp-Canary.plist",
  ]
  const SQLITE_PATHS = [
    "~/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Stable/warp.sqlite",
    "~/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Preview/warp.sqlite",
    "~/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Canary/warp.sqlite",
  ]
  const PLAN_SQL =
    "SELECT billing_metadata_json FROM teams WHERE billing_metadata_json IS NOT NULL AND billing_metadata_json != '' ORDER BY ROWID DESC LIMIT 1;"
  const REQUEST_INFO_KEYS = ["AIRequestLimitInfo", "AIAssistantRequestLimitInfo"]
  const REFRESH_DURATION_MS = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000,
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value)
  }

  function parseJsonLike(ctx, value) {
    if (isObject(value) || Array.isArray(value)) return value
    return ctx.util.tryParseJson(value)
  }

  function toNumber(value) {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  function pickNumber(obj, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const num = toNumber(obj[keys[i]])
      if (num !== null) return num
    }
    return null
  }

  function readPrefs(ctx) {
    let sawFile = false

    for (let i = 0; i < PLIST_PATHS.length; i += 1) {
      const path = PLIST_PATHS[i]
      if (!ctx.host.fs.exists(path)) continue
      sawFile = true

      try {
        const prefs = parseJsonLike(ctx, ctx.host.plist.read(path))
        if (isObject(prefs)) {
          return { path, prefs, sawFile: true }
        }
        ctx.host.log.warn("plist returned invalid json: " + path)
      } catch (e) {
        ctx.host.log.warn("plist read failed for " + path + ": " + String(e))
      }
    }

    return { path: null, prefs: null, sawFile }
  }

  function normalizeRequestLimitInfo(ctx, raw) {
    const value = parseJsonLike(ctx, raw)
    if (!isObject(value)) return null

    const limit = pickNumber(value, ["limit", "request_limit"])
    const used = pickNumber(value, [
      "num_requests_used_since_refresh",
      "requests_used_since_last_refresh",
      "requestsUsedSinceLastRefresh",
    ])

    if (limit === null || limit <= 0 || used === null) return null

    return {
      limit,
      used: used < 0 ? 0 : used,
      resetsAt: value.next_refresh_time || value.nextRefreshTime || null,
      duration:
        value.request_limit_refresh_duration ||
        value.requestLimitRefreshDuration ||
        null,
    }
  }

  function pickRequestLimitInfo(ctx, prefs) {
    for (let i = 0; i < REQUEST_INFO_KEYS.length; i += 1) {
      const info = normalizeRequestLimitInfo(ctx, prefs[REQUEST_INFO_KEYS[i]])
      if (info) return info
    }
    return null
  }

  function collectCycleEndTimes(ctx, prefs) {
    const quotaInfo = parseJsonLike(ctx, prefs.AIRequestQuotaInfoSetting)
    if (!isObject(quotaInfo) || !Array.isArray(quotaInfo.cycle_history)) {
      return []
    }

    const seen = Object.create(null)
    const endTimes = []

    for (let i = 0; i < quotaInfo.cycle_history.length; i += 1) {
      const entry = quotaInfo.cycle_history[i]
      if (!isObject(entry)) continue

      const endMs = ctx.util.parseDateMs(entry.end_date || entry.endDate)
      if (!Number.isFinite(endMs)) continue

      const key = String(endMs)
      if (seen[key]) continue
      seen[key] = true
      endTimes.push(endMs)
    }

    endTimes.sort((a, b) => a - b)
    return endTimes
  }

  function derivePeriodDurationMs(ctx, prefs, info) {
    const nextRefreshMs = ctx.util.parseDateMs(info.resetsAt)
    const cycleEnds = collectCycleEndTimes(ctx, prefs)

    if (Number.isFinite(nextRefreshMs)) {
      let previousEndMs = null

      for (let i = 0; i < cycleEnds.length; i += 1) {
        const endMs = cycleEnds[i]
        if (endMs < nextRefreshMs) {
          previousEndMs = endMs
        }
      }

      if (
        previousEndMs !== null &&
        Number.isFinite(previousEndMs) &&
        nextRefreshMs > previousEndMs
      ) {
        return nextRefreshMs - previousEndMs
      }
    }

    if (cycleEnds.length >= 2) {
      const latest = cycleEnds[cycleEnds.length - 1]
      const previous = cycleEnds[cycleEnds.length - 2]
      if (latest > previous) return latest - previous
    }

    if (typeof info.duration !== "string") return null
    return REFRESH_DURATION_MS[String(info.duration).trim().toLowerCase()] || null
  }

  function formatCycleLabel(value) {
    if (typeof value !== "string") return null
    const text = value.trim()
    if (!text) return null
    return text
      .replace(/[_-]+/g, " ")
      .replace(/\b([a-z])/g, function (_, letter) {
        return letter.toUpperCase()
      })
  }

  function extractPlanName(metadata) {
    if (!isObject(metadata)) return null

    const tier = isObject(metadata.tier) ? metadata.tier : null
    const rawName = tier && typeof tier.name === "string" ? tier.name : null
    if (!rawName) return null

    const name = rawName.trim()
    return name || null
  }

  function readPlan(ctx) {
    for (let i = 0; i < SQLITE_PATHS.length; i += 1) {
      const path = SQLITE_PATHS[i]
      if (!ctx.host.fs.exists(path)) continue

      try {
        const rows = parseJsonLike(ctx, ctx.host.sqlite.query(path, PLAN_SQL))
        if (!Array.isArray(rows)) continue

        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r]
          if (!isObject(row)) continue

          const rawMetadata =
            row.billing_metadata_json ||
            row.billingMetadataJson ||
            null
          const metadata = parseJsonLike(ctx, rawMetadata)
          const plan = extractPlanName(metadata)
          if (plan) return ctx.fmt.planLabel(plan)
        }
      } catch (e) {
        ctx.host.log.warn("warp sqlite read failed for " + path + ": " + String(e))
      }
    }

    return null
  }

  function probe(ctx) {
    const prefsState = readPrefs(ctx)
    if (!prefsState.prefs) {
      if (prefsState.sawFile) {
        throw "Warp usage data unavailable. Open Warp and try again."
      }
      throw "Warp not detected. Open Warp and try again."
    }

    const info = pickRequestLimitInfo(ctx, prefsState.prefs)
    if (!info) {
      throw "Warp usage data unavailable. Open Warp and try again."
    }

    const line = {
      label: "Requests",
      used: info.used,
      limit: info.limit,
      format: { kind: "count", suffix: "requests" },
    }

    const resetsAt = ctx.util.toIso(info.resetsAt)
    if (resetsAt) line.resetsAt = resetsAt

    const periodDurationMs = derivePeriodDurationMs(ctx, prefsState.prefs, info)
    if (periodDurationMs) line.periodDurationMs = periodDurationMs

    const lines = [ctx.line.progress(line)]
    const cycleLabel = formatCycleLabel(info.duration)
    if (cycleLabel) {
      lines.push(ctx.line.text({ label: "Cycle", value: cycleLabel }))
    }

    ctx.host.log.info("warp usage loaded from " + prefsState.path)

    return {
      plan: readPlan(ctx),
      lines,
    }
  }

  globalThis.__usage_plugin = { id: "warp", probe }
})()
