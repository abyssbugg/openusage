import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const PREF_PATH = "~/Library/Preferences/dev.warp.Warp-Stable.plist"
const DB_PATH =
  "~/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Stable/warp.sqlite"

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__usage_plugin
}

function setPrefs(ctx, prefs, path = PREF_PATH) {
  ctx.host.fs.writeText(path, JSON.stringify(prefs))
}

function setPlan(ctx, planName, path = DB_PATH) {
  setBilling(ctx, { tier: { name: planName } }, path)
}

function setBilling(ctx, billingMetadata, path = DB_PATH) {
  ctx.host.fs.writeText(path, "sqlite")
  ctx.host.sqlite.query.mockImplementation((dbPath, sql) => {
    expect(dbPath).toBe(path)
    expect(String(sql)).toContain("SELECT billing_metadata_json FROM teams")
    return JSON.stringify([
      {
        billing_metadata_json: JSON.stringify(billingMetadata),
      },
    ])
  })
}

describe("warp plugin", () => {
  beforeEach(() => {
    delete globalThis.__usage_plugin
    vi.resetModules()
  })

  it("ships plugin metadata with the expected line layout", () => {
    const manifest = JSON.parse(readFileSync("plugins/warp/plugin.json", "utf8"))

    expect(manifest.id).toBe("warp")
    expect(manifest.name).toBe("Warp")
    expect(manifest.brandColor).toBe("#353534")
    expect(manifest.lines).toEqual([
      {
        type: "progress",
        label: "Requests",
        scope: "overview",
        primaryOrder: 1,
      },
      {
        type: "text",
        label: "Cycle",
        scope: "detail",
      },
      {
        type: "text",
        label: "Add-on Credit",
        scope: "detail",
      },
      {
        type: "text",
        label: "Purchased This Month",
        scope: "detail",
      },
    ])
  })

  it("throws when Warp is not detected", async () => {
    const ctx = makeCtx()
    const plugin = await loadPlugin()

    expect(() => plugin.probe(ctx)).toThrow(
      "Warp not detected. Open Warp and try again."
    )
  })

  it("reads request limits from plist and plan from sqlite", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIRequestLimitInfo: {
        limit: 18000,
        num_requests_used_since_refresh: 1004,
        next_refresh_time: "2026-05-04T20:27:42Z",
        request_limit_refresh_duration: "Monthly",
      },
      AIRequestQuotaInfoSetting: {
        cycle_history: [
          { end_date: "2026-03-04T20:27:42Z" },
          { end_date: "2026-04-04T20:27:42Z" },
        ],
      },
    })
    setPlan(ctx, "Max")

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("Max")

    const requestsLine = result.lines.find((line) => line.label === "Requests")
    expect(requestsLine).toBeTruthy()
    expect(requestsLine.used).toBe(1004)
    expect(requestsLine.limit).toBe(18000)
    expect(requestsLine.format).toEqual({ kind: "count", suffix: "requests" })
    expect(requestsLine.resetsAt).toBe("2026-05-04T20:27:42.000Z")
    expect(requestsLine.periodDurationMs).toBe(30 * 24 * 60 * 60 * 1000)

    const cycleLine = result.lines.find((line) => line.label === "Cycle")
    expect(cycleLine).toEqual({
      type: "text",
      label: "Cycle",
      value: "Monthly",
    })
  })

  it("parses live plist values when request info is stored as JSON strings", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIRequestLimitInfo: JSON.stringify({
        limit: 18000,
        num_requests_used_since_refresh: 1505,
        next_refresh_time: "2026-05-04T20:27:42Z",
        request_limit_refresh_duration: "Monthly",
      }),
      AIRequestQuotaInfoSetting: JSON.stringify({
        cycle_history: [
          { end_date: "2026-03-04T20:27:42Z" },
          { end_date: "2026-04-04T20:27:42Z" },
        ],
      }),
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    const requestsLine = result.lines.find((line) => line.label === "Requests")
    expect(requestsLine.used).toBe(1505)
    expect(requestsLine.limit).toBe(18000)
    expect(requestsLine.resetsAt).toBe("2026-05-04T20:27:42.000Z")
    expect(requestsLine.periodDurationMs).toBe(30 * 24 * 60 * 60 * 1000)

    const cycleLine = result.lines.find((line) => line.label === "Cycle")
    expect(cycleLine.value).toBe("Monthly")
  })

  it("falls back to assistant request info when the main key is missing", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIAssistantRequestLimitInfo: {
        limit: 250,
        num_requests_used_since_refresh: 12,
        next_refresh_time: "2026-05-01T00:00:00Z",
        request_limit_refresh_duration: "Weekly",
      },
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    const requestsLine = result.lines.find((line) => line.label === "Requests")
    expect(requestsLine.used).toBe(12)
    expect(requestsLine.limit).toBe(250)
    expect(requestsLine.periodDurationMs).toBe(7 * 24 * 60 * 60 * 1000)

    const cycleLine = result.lines.find((line) => line.label === "Cycle")
    expect(cycleLine.value).toBe("Weekly")
  })

  it("keeps usage working when plan lookup fails", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIRequestLimitInfo: {
        limit: 100,
        num_requests_used_since_refresh: 40,
        next_refresh_time: "2026-05-01T00:00:00Z",
      },
    })
    ctx.host.fs.writeText(DB_PATH, "sqlite")
    ctx.host.sqlite.query.mockImplementation(() => {
      throw new Error("boom")
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBeNull()
    expect(result.lines.find((line) => line.label === "Requests")).toBeTruthy()
    expect(ctx.host.log.warn).toHaveBeenCalled()
  })

  it("reads add-on credit metrics from billing metadata", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIRequestLimitInfo: {
        limit: 100,
        num_requests_used_since_refresh: 40,
        next_refresh_time: "2026-05-01T00:00:00Z",
        request_limit_refresh_duration: "Monthly",
      },
    })
    setBilling(ctx, {
      tier: { name: "Max" },
      add_on_credits: {
        balance: 18.25,
        purchased_this_month: 42,
      },
    })

    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(result.plan).toBe("Max")
    expect(result.lines.find((line) => line.label === "Add-on Credit")).toEqual({
      type: "text",
      label: "Add-on Credit",
      value: "$18.25",
    })
    expect(
      result.lines.find((line) => line.label === "Purchased This Month")
    ).toEqual({
      type: "text",
      label: "Purchased This Month",
      value: "$42.00",
    })
  })

  it("throws when the plist exists but request data is missing", async () => {
    const ctx = makeCtx()
    setPrefs(ctx, {
      AIRequestQuotaInfoSetting: {
        cycle_history: [{ end_date: "2026-04-04T20:27:42Z" }],
      },
    })

    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow(
      "Warp usage data unavailable. Open Warp and try again."
    )
  })
})
