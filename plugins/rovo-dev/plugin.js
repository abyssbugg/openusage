(function () {
  const PROVIDER_ID = "rovo-dev"
  const LOG_PATH = "~/.rovodev/logs/rovodev.log"
  const CONFIG_PATH = "~/.rovodev/config.yml"
  const RAW_USAGE_MARKER = "[get_usage_data] Raw API response:"

  function readText(ctx, path) {
    try {
      if (!ctx.host.fs.exists(path)) return null
      return ctx.host.fs.readText(path)
    } catch (e) {
      ctx.host.log.warn("read failed for " + path + ": " + String(e))
      return null
    }
  }

  function latestRawUsagePayload(text) {
    if (typeof text !== "string" || !text) return null
    const lines = text.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]
      const idx = line.indexOf(RAW_USAGE_MARKER)
      if (idx === -1) continue
      const payload = line.slice(idx + RAW_USAGE_MARKER.length).trim()
      if (payload) return payload
    }
    return null
  }

  function normalizeNone(value) {
    if (value === null || value === undefined) return null
    const s = String(value).trim()
    if (!s || s === "None" || s === "null") return null
    return s
  }

  function readNumber(payload, key) {
    if (typeof payload !== "string") return null
    const re = new RegExp("['\\\"]" + key + "['\\\"]\\s*:\\s*(None|null|-?\\d+(?:\\.\\d+)?)")
    const m = re.exec(payload)
    if (!m) return null
    const s = normalizeNone(m[1])
    if (s === null) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  function readString(payload, key) {
    if (typeof payload !== "string") return null
    const re = new RegExp("['\\\"]" + key + "['\\\"]\\s*:\\s*['\\\"]([^'\\\"]*)['\\\"]")
    const m = re.exec(payload)
    if (!m) return null
    const s = String(m[1] || "").trim()
    return s || null
  }

  function parsePlanLabel(productType, creditType) {
    const product = String(productType || "").trim().toUpperCase()
    if (product.indexOf("STANDARD") !== -1) return "Standard"
    if (product.indexOf("FREE") !== -1) return "Free"
    const credit = String(creditType || "").trim().toUpperCase()
    if (credit === "PAID") return "Standard"
    return null
  }

  function parseUsagePayload(payload) {
    if (!payload) return null

    const monthlyUsed = readNumber(payload, "monthlyUsed")
    const monthlyTotal = readNumber(payload, "monthlyTotal")
    const monthlyRemaining = readNumber(payload, "monthlyRemaining")
    const allocation = readNumber(payload, "monthlyCreditAllocation")
    const cap = readNumber(payload, "monthlyCreditCap")
    const productType = readString(payload, "productType")
    const creditType = readString(payload, "creditType")

    if (monthlyUsed === null && monthlyRemaining === null) return null

    let limit = null
    if (monthlyTotal !== null && monthlyTotal > 0) {
      limit = monthlyTotal
    } else if (allocation !== null && allocation > 0) {
      limit = allocation
    } else if (cap !== null && cap > 0) {
      limit = cap
    }

    let used = monthlyUsed
    if (used === null && limit !== null && monthlyRemaining !== null) {
      used = limit - monthlyRemaining
    }
    if (used === null) return null

    let remaining = monthlyRemaining
    if ((remaining === null || (monthlyTotal !== null && monthlyTotal < 0)) && limit !== null) {
      remaining = Math.max(0, limit - used)
    }

    return {
      used,
      limit,
      remaining,
      plan: parsePlanLabel(productType, creditType),
    }
  }

  function formatCredits(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return null
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  function probe(ctx) {
    const logText = readText(ctx, LOG_PATH)
    if (!logText) {
      const hasConfig = !!readText(ctx, CONFIG_PATH)
      if (hasConfig) {
        throw "No Rovo Dev usage data yet. Run `/usage` inside Rovo Dev CLI once."
      }
      throw "Rovo Dev not detected. Run `acli rovodev auth login` and `acli rovodev run` first."
    }

    const payload = latestRawUsagePayload(logText)
    const usage = parseUsagePayload(payload)
    if (!usage) {
      throw "No Rovo Dev usage data yet. Run `/usage` inside Rovo Dev CLI once."
    }

    const lines = []
    if (usage.limit !== null && usage.limit > 0) {
      lines.push(ctx.line.progress({
        label: "Monthly credits",
        used: usage.used,
        limit: usage.limit,
        format: { kind: "count", suffix: "credits" },
      }))
    } else {
      const usedText = formatCredits(usage.used)
      if (!usedText) throw "Rovo Dev usage data invalid. Run `/usage` again."
      lines.push(ctx.line.text({ label: "Monthly credits", value: usedText + " used" }))
    }

    if (usage.remaining !== null && usage.limit !== null && usage.limit > 0) {
      const remainingText = formatCredits(usage.remaining)
      if (remainingText !== null) {
        lines.push(ctx.line.text({ label: "Remaining", value: remainingText + " credits" }))
      }
    }

    return usage.plan ? { plan: usage.plan, lines } : { lines }
  }

  globalThis.__usage_plugin = { id: PROVIDER_ID, probe }
})()
