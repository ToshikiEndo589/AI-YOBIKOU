import type { Profile, StudyLog } from '@/types/database'
import { calculatePassProbability } from './probability'

/**
 * 合格確率の計算ロジックの説明とシミュレーション
 */

/**
 * 合格率を維持するために必要な1日の学習時間を計算
 */
export function calculateRequiredDailyStudy(
  profile: Profile,
  currentStudyLogs: StudyLog[]
): {
  toMaintain: number // 合格率を維持するために必要な1日の学習時間（分）
  toIncrease: number // 合格率を上げるために推奨される1日の学習時間（分）
} {
  // 放置時間ペナルティを避けるには、今日学習していればOK（理論上は0分でも可）
  // ただし、学習時間スコアを維持するには一定の学習時間が必要
  
  // 直近7日間の学習時間を確認
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const recent7DaysMinutes = currentStudyLogs
    .filter((log) => new Date(log.started_at).getTime() >= sevenDaysAgo)
    .reduce((sum, log) => sum + log.study_minutes, 0)

  // 合格率を維持するには、放置時間ペナルティを避けることが重要
  // 今日学習していれば、放置時間ペナルティは0点
  // 理論上は1分でも学習すればOKだが、実用的には30分程度が推奨
  const toMaintain = 30 // 最低30分/日（放置ペナルティ回避 + 学習時間スコア維持）

  // 合格率を上げるには、より多くの学習時間が必要
  // 直近7日間で平均120分（2時間）学習すれば、学習時間スコアが最大になる
  const toIncrease = 120 // 2時間/日

  return {
    toMaintain,
    toIncrease,
  }
}

/**
 * 学習を全くしなかった場合の合格率の減少をシミュレーション
 */
export function calculateProbabilityDropWithoutStudy(
  profile: Profile,
  currentStudyLogs: StudyLog[],
  latestStudyLog: StudyLog | null
): {
  currentProbability: number
  after1Day: number
  after3Days: number
  after7Days: number
  after14Days: number
  dropAfter1Day: number
  dropAfter3Days: number
  dropAfter7Days: number
  dropAfter14Days: number
} {
  const currentProbability = calculatePassProbability(profile, currentStudyLogs, latestStudyLog)

  // シミュレーション: 最新の学習記録の日付を過去にずらす
  const simulateDaysAgo = (days: number): StudyLog | null => {
    if (!latestStudyLog) return null
    return {
      ...latestStudyLog,
      started_at: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  // 1日後（最新の学習記録が1日前）
  const after1DayLatest = simulateDaysAgo(1)
  const after1Day = calculatePassProbability(profile, currentStudyLogs, after1DayLatest)

  // 3日後（最新の学習記録が3日前）
  const after3DaysLatest = simulateDaysAgo(3)
  const after3Days = calculatePassProbability(profile, currentStudyLogs, after3DaysLatest)

  // 7日後（最新の学習記録が7日前）
  const after7DaysLatest = simulateDaysAgo(7)
  const after7Days = calculatePassProbability(profile, currentStudyLogs, after7DaysLatest)

  // 14日後（最新の学習記録が14日前）
  const after14DaysLatest = simulateDaysAgo(14)
  const after14Days = calculatePassProbability(profile, currentStudyLogs, after14DaysLatest)

  return {
    currentProbability,
    after1Day,
    after3Days,
    after7Days,
    after14Days,
    dropAfter1Day: Math.max(0, currentProbability - after1Day),
    dropAfter3Days: Math.max(0, currentProbability - after3Days),
    dropAfter7Days: Math.max(0, currentProbability - after7Days),
    dropAfter14Days: Math.max(0, currentProbability - after14Days),
  }
}
