<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useBagStore } from '@/stores/bag'
import { useStatusStore } from '@/stores/status'

const props = withDefaults(defineProps<{ refreshData?: boolean }>(), { refreshData: true })
const accountStore = useAccountStore()
const bagStore = useBagStore()
const statusStore = useStatusStore()
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { status, diamondBalance } = storeToRefs(statusStore)
const { dashboardItems } = storeToRefs(bagStore)
const localUptime = ref(0)

const displayName = computed(() => {
  const account = currentAccount.value
  const name = status.value?.status?.name || account?.nick
  if (name)
    return account?.name ? `${name} (${account.name})` : name
  return account?.name || (status.value?.connection?.connected ? '未命名' : '未登录')
})
const expRate = computed(() => {
  const uptime = Number(status.value?.uptime) || 0
  return `${uptime > 0 ? Math.floor((status.value?.sessionExpGained || 0) * 3600 / uptime) : 0}/时`
})
const timeToLevel = computed(() => {
  const gain = Number(status.value?.sessionExpGained) || 0
  const uptime = Number(status.value?.uptime) || 0
  const progress = status.value?.levelProgress
  if (!gain || !uptime || !progress?.needed)
    return ''
  const minutes = Math.max(0, progress.needed - progress.current) * uptime / gain / 60
  return minutes < 60 ? `约 ${Math.ceil(minutes)} 分钟后升级` : `约 ${(minutes / 60).toFixed(1)} 小时后升级`
})
const fertilizerNormal = computed(() => dashboardItems.value.find(item => Number(item.id) === 1011))
const fertilizerOrganic = computed(() => dashboardItems.value.find(item => Number(item.id) === 1012))
const collectionNormal = computed(() => dashboardItems.value.find(item => Number(item.id) === 3001))
const collectionRare = computed(() => dashboardItems.value.find(item => Number(item.id) === 3002))

function formatBucketTime(item: any) {
  return item?.hoursText?.replace('小时', 'h') || `${(Number(item?.count || 0) / 3600).toFixed(1)}h`
}
function getExpPercent(progress: any) {
  return progress?.needed ? Math.min(100, Math.max(0, progress.current / progress.needed * 100)) : 0
}
function formatAssetAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)).toLocaleString('zh-CN') : '0'
}
function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const clock = [Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)]
    .map(value => String(value).padStart(2, '0')).join(':')
  return days > 0 ? `${days}天 ${clock}` : clock
}
async function refresh() {
  const id = currentAccountId.value
  if (!props.refreshData || !id)
    return
  if (!statusStore.realtimeConnected)
    await statusStore.fetchStatus(id)
  if (currentAccountId.value !== id || !status.value?.connection?.connected)
    return
  await Promise.all([bagStore.fetchBag(id), statusStore.fetchDiamond(id)])
}
watch(() => status.value?.uptime, value => localUptime.value = Number(value) || 0, { immediate: true })
watch([currentAccountId, () => status.value?.connection?.connected], () => void refresh(), { immediate: true })
useIntervalFn(() => {
  if (status.value?.connection?.connected)
    localUptime.value++
}, 1000)
useIntervalFn(refresh, 10000)
</script>

<template>
<div class="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:grid-cols-2">
      <!-- Account & Exp -->
      <div class="flex flex-col farm-card rounded-2xl bg-white p-5 shadow-md dark:bg-gray-800">
        <div class="mb-2 flex items-start justify-between">
          <div class="flex items-center gap-1.5 text-sm text-gray-500">
            <div class="i-fas-user-circle" />
            账号
          </div>
          <div class="farm-badge rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Lv.{{ status?.status?.level || 0 }}
          </div>
        </div>
        <div class="mb-1 truncate text-xl font-bold" :title="displayName">
          {{ displayName }}
        </div>

        <!-- Level Progress -->
        <div class="mt-auto">
          <div class="mb-1 flex justify-between text-xs text-gray-500">
            <div class="flex items-center gap-1">
              <div class="i-fas-bolt text-blue-400" />
              <span>EXP</span>
            </div>
            <span>{{ status?.levelProgress?.current || 0 }} / {{ status?.levelProgress?.needed || '?' }}</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              class="h-full rounded-full bg-blue-500 transition-all duration-500"
              :style="{ width: `${getExpPercent(status?.levelProgress)}%` }"
            />
          </div>
          <div class="mt-2 flex justify-between text-xs text-gray-400">
            <span>效率: {{ expRate }}</span>
            <span>{{ timeToLevel }}</span>
          </div>
        </div>
      </div>

      <!-- Assets & Status -->
      <div class="flex flex-col justify-between farm-card rounded-2xl bg-white p-5 shadow-md dark:bg-gray-800">
        <div class="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
          <div class="bg-white pb-3 pr-3 dark:bg-gray-800">
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
              <div class="i-fas-coins text-yellow-500" />
              金币
            </div>
            <div class="text-2xl text-yellow-600 font-bold tabular-nums dark:text-yellow-500">
              {{ formatAssetAmount(status?.status?.gold) }}
            </div>
            <div
              v-if="(status?.sessionGoldGained || 0) !== 0"
              class="text-[10px]"
              :class="(status?.sessionGoldGained || 0) > 0 ? 'text-green-500' : 'text-red-500'"
            >
              {{ (status?.sessionGoldGained || 0) > 0 ? '+' : '' }}{{ status?.sessionGoldGained || 0 }}
            </div>
          </div>
          <div class="bg-white pb-3 pl-3 text-right dark:bg-gray-800">
            <div class="flex items-center justify-end gap-1.5 text-xs text-gray-500">
              <div class="i-fas-ticket-alt text-emerald-400" />
              点券
            </div>
            <div class="text-2xl text-emerald-500 font-bold tabular-nums dark:text-emerald-400">
              {{ formatAssetAmount(status?.status?.coupon) }}
            </div>
            <div
              v-if="(status?.sessionCouponGained || 0) !== 0"
              class="text-[10px]"
              :class="(status?.sessionCouponGained || 0) > 0 ? 'text-green-500' : 'text-red-500'"
            >
              {{ (status?.sessionCouponGained || 0) > 0 ? '+' : '' }}{{ status?.sessionCouponGained || 0 }}
            </div>
          </div>
          <div class="bg-white pr-3 pt-3 dark:bg-gray-800">
            <div class="flex items-center gap-1.5 text-xs text-gray-500">
              <div class="i-fas-seedling text-amber-500" />
              金豆豆
            </div>
            <div class="text-2xl text-amber-500 font-bold tabular-nums dark:text-amber-400">
              {{ formatAssetAmount(status?.status?.goldBean) }}
            </div>
          </div>
          <div class="bg-white pl-3 pt-3 text-right dark:bg-gray-800">
            <div class="flex items-center justify-end gap-1.5 text-xs text-gray-500">
              <div class="i-fas-gem text-cyan-500" />
              钻石
            </div>
            <div class="text-2xl text-cyan-600 font-bold tabular-nums dark:text-cyan-400">
              {{ formatAssetAmount(diamondBalance) }}
            </div>
          </div>
        </div>
        <div class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="h-2.5 w-2.5 rounded-full" :class="status?.connection?.connected ? 'bg-green-500' : 'bg-red-500'" />
              <span class="text-xs font-bold">{{ status?.connection?.connected ? '在线' : '离线' }}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
              <span class="text-purple-400">🕐</span>
              {{ formatDuration(localUptime) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Items (Fertilizer & Collection) -->
      <div class="flex flex-col justify-between farm-card rounded-2xl bg-white p-5 shadow-md dark:bg-gray-800">
        <div class="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
          <div class="i-fas-flask text-emerald-400" />
          化肥容器
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <div class="i-fas-flask text-emerald-400" />
              普通
            </div>
            <div class="font-bold">
              {{ formatBucketTime(fertilizerNormal) }}
            </div>
          </div>
          <div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <div class="i-fas-vial text-emerald-400" />
              有机
            </div>
            <div class="font-bold">
              {{ formatBucketTime(fertilizerOrganic) }}
            </div>
          </div>
        </div>
        <div class="my-2 border-t border-gray-100 dark:border-gray-700" />
        <div class="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
          <div class="i-fas-star text-emerald-400" />
          收藏点
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <div class="i-fas-bookmark text-emerald-400" />
              普通
            </div>
            <div class="font-bold">
              {{ collectionNormal?.count || 0 }}
            </div>
          </div>
          <div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <div class="i-fas-gem text-emerald-400" />
              典藏
            </div>
            <div class="font-bold">
              {{ collectionRare?.count || 0 }}
            </div>
          </div>
        </div>
      </div>
    </div>
</template>
