import type { FertilizeLandResult, Land } from '@/stores/farm'

export function canRipenLand(land: Land | undefined) {
  return !!land?.unlocked && !land.occupiedByMaster && land.status === 'growing' && Number(land.matureInSec) > 0
}

export async function ripenLand(options: {
  getLand: () => Land | undefined
  cancelled: () => boolean
  fertilize: (type: 'normal' | 'organic') => Promise<FertilizeLandResult | false>
}) {
  let normalCount = 0
  let organicCount = 0
  let stopped = ''
  const active = () => !options.cancelled() && canRipenLand(options.getLand())

  if (active() && Number(options.getLand()?.leftInorcFertTimes) > 0) {
    const result = await options.fertilize('normal')
    if (result)
      normalCount++
    // A rejected normal application does not prevent trying organic fertilizer.
  }
  while (active()) {
    const before = Number(options.getLand()?.matureInSec)
    const result = await options.fertilize('organic')
    if (!result) {
      stopped = 'unavailable'
      break
    }
    organicCount++
    if (options.cancelled())
      break
    if (!canRipenLand(options.getLand()))
      break
    // Never keep consuming fertilizer when a successful reply shows no progress.
    if (Number(options.getLand()?.matureInSec) >= before) {
      stopped = 'no-progress'
      break
    }
    if (Number(result.fertilizerRemainingSec) <= 0) {
      stopped = 'empty'
      break
    }
  }
  return { normalCount, organicCount, stopped, cancelled: options.cancelled() }
}
