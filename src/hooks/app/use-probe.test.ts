import { describe, expect, it, vi } from "vitest"
import { finalizeIncompleteBatch } from "@/hooks/app/use-probe"
import type { PluginState } from "@/hooks/app/types"

function state(overrides: Partial<PluginState>): PluginState {
  return {
    data: null,
    loading: false,
    error: null,
    lastManualRefreshAt: null,
    ...overrides,
  }
}

describe("finalizeIncompleteBatch", () => {
  it("marks pending plugins as batch-incomplete errors", () => {
    const pluginStates: Record<string, PluginState> = {
      claude: state({ loading: true }),
      codex: state({ loading: false }),
      cursor: state({ loading: true }),
    }
    const manualRefreshIds = new Set(["claude", "cursor", "codex"])
    const setErrorForPlugins = vi.fn()

    finalizeIncompleteBatch(pluginStates, manualRefreshIds, setErrorForPlugins)

    expect(setErrorForPlugins).toHaveBeenCalledWith(
      ["claude", "cursor"],
      "Probe did not return a result. Try again?",
    )
    expect(manualRefreshIds.has("claude")).toBe(false)
    expect(manualRefreshIds.has("cursor")).toBe(false)
    expect(manualRefreshIds.has("codex")).toBe(true)
  })

  it("is a no-op when no plugins are pending", () => {
    const pluginStates: Record<string, PluginState> = {
      claude: state({ loading: false }),
      codex: state({ loading: false }),
    }
    const manualRefreshIds = new Set(["claude"])
    const setErrorForPlugins = vi.fn()

    finalizeIncompleteBatch(pluginStates, manualRefreshIds, setErrorForPlugins)

    expect(setErrorForPlugins).not.toHaveBeenCalled()
    expect(manualRefreshIds.has("claude")).toBe(true)
  })
})
