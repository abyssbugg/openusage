import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const LOG_PATH = "~/.rovodev/logs/rovodev.log"
const CONFIG_PATH = "~/.rovodev/config.yml"

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__usage_plugin
}

function usageLine(values = {}) {
  const used = values.used ?? 178
  const total = values.total ?? -1
  const remaining = values.remaining ?? 0
  const allocation = values.allocation ?? 2000
  const cap = values.cap ?? 1999
  const productType = values.productType ?? "ROVO_DEV_STANDARD"
  const creditType = values.creditType ?? "PAID"

  return "2026-05-01 10:00:00.000 | DEBUG | [get_usage_data] Raw API response: " +
    "{'status': 'OK', " +
    "'balance': {'dailyTotal': None, 'dailyRemaining': None, 'dailyUsed': None, " +
    "'monthlyTotal': " + String(total) + ", 'monthlyRemaining': " + String(remaining) + ", 'monthlyUsed': " + String(used) + "}, " +
    "'userCreditLimits': {'user': {'productType': '" + productType + "'}, " +
    "'limits': {'monthlyCreditAllocation': " + String(allocation) + ", 'monthlyCreditCap': " + String(cap) + ", 'creditType': '" + creditType + "'}}}"
}

describe("rovo-dev plugin", () => {
  beforeEach(() => {
    delete globalThis.__usage_plugin
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("ships plugin metadata with docs links and expected lines", () => {
    const manifest = JSON.parse(readFileSync("plugins/rovo-dev/plugin.json", "utf8"))

    expect(manifest.id).toBe("rovo-dev")
    expect(manifest.name).toBe("Rovo Dev")
    expect(manifest.brandColor).toBe("#0052CC")
    expect(manifest.links).toEqual([
      { label: "Usage docs", url: "https://support.atlassian.com/rovo/docs/view-your-rovo-dev-credit-usage/" },
      { label: "CLI docs", url: "https://support.atlassian.com/rovo/docs/rovo-dev-cli-commands/" },
    ])
    expect(manifest.lines).toEqual([
      { type: "progress", label: "Monthly credits", scope: "overview", primaryOrder: 1 },
      { type: "text", label: "Remaining", scope: "overview" },
    ])
  })

  it("throws when Rovo Dev is not detected", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()

    expect(() => plugin.probe(ctx)).toThrow("Rovo Dev not detected")
  })

  it("asks for /usage when config exists but no log usage exists", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(CONFIG_PATH, "atlassianBillingSite:\n  siteUrl: https://example.atlassian.net\n")

    const plugin = await loadPlugin()

    expect(() => plugin.probe(ctx)).toThrow("Run `/usage` inside Rovo Dev CLI once")
  })

  it("reads monthly credits from the latest raw usage response", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(LOG_PATH, [
      usageLine({ used: 100, allocation: 2000 }),
      "other log line",
      usageLine({ used: 178, allocation: 2000, total: -1, remaining: 0 }),
    ].join("\n"))

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("Standard")
    const monthly = result.lines.find((line) => line.label === "Monthly credits")
    expect(monthly).toEqual({
      type: "progress",
      label: "Monthly credits",
      used: 178,
      limit: 2000,
      format: { kind: "count", suffix: "credits" },
    })
    expect(result.lines.find((line) => line.label === "Remaining")).toEqual({
      type: "text",
      label: "Remaining",
      value: "1,822 credits",
    })
  })

  it("uses monthlyTotal when the response supplies a positive total", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(LOG_PATH, usageLine({ used: 350, total: 500, remaining: 150, allocation: 2000 }))

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    const monthly = result.lines.find((line) => line.label === "Monthly credits")

    expect(monthly.used).toBe(350)
    expect(monthly.limit).toBe(500)
    expect(result.lines.find((line) => line.label === "Remaining").value).toBe("150 credits")
  })

  it("falls back to text when only used credits are available", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(
      LOG_PATH,
      "2026-05-01 | DEBUG | [get_usage_data] Raw API response: {'balance': {'monthlyUsed': 12}}"
    )

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.lines).toEqual([
      { type: "text", label: "Monthly credits", value: "12 used" },
    ])
  })

  it("throws when the log has no parseable usage response", async () => {
    const ctx = makeCtx()
    ctx.host.fs.writeText(LOG_PATH, "normal startup log\nno usage here")

    const plugin = await loadPlugin()

    expect(() => plugin.probe(ctx)).toThrow("Run `/usage` inside Rovo Dev CLI once")
  })
})
