import { useCallback } from "react"
import { useProbeEvents } from "@/hooks/use-probe-events"
import {
  type AutoUpdateIntervalMinutes,
  type PluginSettings,
} from "@/lib/settings"
import { useProbeAutoUpdate } from "@/hooks/app/use-probe-auto-update"
import { useProbeRefreshActions } from "@/hooks/app/use-probe-refresh-actions"
import { useProbeState } from "@/hooks/app/use-probe-state"
import type { PluginState } from "@/hooks/app/types"

const BATCH_INCOMPLETE_ERROR = "Probe did not return a result. Try again?"

export function finalizeIncompleteBatch(
  pluginStates: Record<string, PluginState>,
  manualRefreshIds: Set<string>,
  setErrorForPlugins: (ids: string[], error: string) => void,
) {
  const pendingIds = Object.entries(pluginStates)
    .filter(([, state]) => state.loading)
    .map(([id]) => id)

  if (pendingIds.length === 0) return

  for (const id of pendingIds) {
    manualRefreshIds.delete(id)
  }

  setErrorForPlugins(pendingIds, BATCH_INCOMPLETE_ERROR)
}

type UseProbeArgs = {
  pluginSettings: PluginSettings | null
  autoUpdateInterval: AutoUpdateIntervalMinutes
  onProbeResult?: () => void
}

export function useProbe({
  pluginSettings,
  autoUpdateInterval,
  onProbeResult,
}: UseProbeArgs) {
  const {
    pluginStates,
    pluginStatesRef,
    manualRefreshIdsRef,
    setLoadingForPlugins,
    setErrorForPlugins,
    handleProbeResult,
  } = useProbeState({ onProbeResult })

  const handleBatchComplete = useCallback(() => {
    finalizeIncompleteBatch(
      pluginStatesRef.current,
      manualRefreshIdsRef.current,
      setErrorForPlugins,
    )
  }, [manualRefreshIdsRef, pluginStatesRef, setErrorForPlugins])

  const { startBatch } = useProbeEvents({
    onResult: handleProbeResult,
    onBatchComplete: handleBatchComplete,
  })

  const {
    autoUpdateNextAt,
    setAutoUpdateNextAt,
    resetAutoUpdateSchedule,
  } = useProbeAutoUpdate({
    pluginSettings,
    autoUpdateInterval,
    setLoadingForPlugins,
    setErrorForPlugins,
    startBatch,
  })

  const { handleRetryPlugin, handleRefreshAll } = useProbeRefreshActions({
    pluginSettings,
    pluginStatesRef,
    manualRefreshIdsRef,
    resetAutoUpdateSchedule,
    setLoadingForPlugins,
    setErrorForPlugins,
    startBatch,
  })

  return {
    pluginStates,
    setLoadingForPlugins,
    setErrorForPlugins,
    startBatch,
    autoUpdateNextAt,
    setAutoUpdateNextAt,
    handleRetryPlugin,
    handleRefreshAll,
  }
}
