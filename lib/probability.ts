import type { Profile } from '@/types/database'

/**
 * 合格確率を計算する関数
 * 偏差値100%で計算し、試験日までの残り日数に応じて精度が向上する
 * 目標偏差値 = 現在偏差値の場合、合格率80%を基準とする
 */
export function calculatePassProbability(profile: Profile): {
  probability: number
  minProbability: number
  maxProbability: number
  daysUntilExam: number
} {
  const currentDeviation = profile.current_deviation || 50
  const targetDeviation = profile.target_deviation || currentDeviation
  
  // 試験日の取得（デフォルトは来年2月1日）
  let examDate: Date
  if (profile.exam_date) {
    // exam_dateが文字列の場合、タイムゾーンを考慮して日付のみを取得
    const dateStr = profile.exam_date.split('T')[0] // YYYY-MM-DD形式に変換
    examDate = new Date(dateStr + 'T00:00:00') // 時刻を00:00:00に設定してタイムゾーン問題を回避
  } else {
    // デフォルトは来年2月1日
    const nextYear = new Date().getFullYear() + 1
    examDate = new Date(`${nextYear}-02-01T00:00:00`)
  }
  
  // 現在日時を取得（時刻を00:00:00に設定して日付のみで比較）
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const examDateOnly = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate())
  
  // 残り日数を計算（ミリ秒を日数に変換）
  const daysUntilExam = Math.max(0, Math.ceil((examDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
  
  // 偏差値ベースの合格率計算
  // 目標偏差値 = 現在偏差値の場合、合格率80%を基準とする
  let baseProbability = 0
  
  if (currentDeviation === targetDeviation) {
    // 目標偏差値 = 現在偏差値の場合、合格率80%
    baseProbability = 80
  } else if (currentDeviation > targetDeviation) {
    // 目標を超過している場合
    // 超過分に応じて合格率を上げる（最大99%）
    const excess = currentDeviation - targetDeviation
    baseProbability = Math.min(99, 80 + excess * 1.5)
  } else {
    // 目標未達成の場合
    // 不足分に応じて合格率を下げる
    const gap = targetDeviation - currentDeviation
    // 1偏差値あたり2%減点（最大-60点）
    const penalty = Math.min(60, gap * 2)
    baseProbability = Math.max(0, 80 - penalty)
  }
  
  // 残り日数に応じて、偏差値の変動幅を計算
  let deviationRange = 0
  if (daysUntilExam >= 365) {
    deviationRange = 20 // 1年以上前: ±20
  } else if (daysUntilExam >= 180) {
    deviationRange = 15 // 半年以上前: ±15
  } else if (daysUntilExam >= 90) {
    deviationRange = 10 // 3ヶ月以上前: ±10
  } else if (daysUntilExam >= 30) {
    deviationRange = 5 // 1ヶ月以上前: ±5
  } else {
    deviationRange = 0 // 1ヶ月以内: 変動なし
  }
  
  // 最小・最大合格率を計算
  const minProbability = Math.max(0, Math.min(99, baseProbability - deviationRange))
  const maxProbability = Math.max(0, Math.min(99, baseProbability + deviationRange))
  
  // 中央値（最も可能性の高い合格率）
  const probability = Math.round(baseProbability)
  
  return {
    probability,
    minProbability: Math.round(minProbability),
    maxProbability: Math.round(maxProbability),
    daysUntilExam,
  }
}

/**
 * 合格率の表示形式を取得
 * 残り日数が多い時は幅で表示、少ない時は単一値で表示
 */
export function getProbabilityDisplay(
  probability: number,
  minProbability: number,
  maxProbability: number,
  daysUntilExam: number
): {
  display: string
  isRange: boolean
} {
  // 残り30日以内の場合は単一値で表示
  if (daysUntilExam <= 30) {
    return {
      display: `${probability}%`,
      isRange: false,
    }
  }
  
  // それ以外は幅で表示
  return {
    display: `${minProbability}-${maxProbability}%`,
    isRange: true,
  }
}
