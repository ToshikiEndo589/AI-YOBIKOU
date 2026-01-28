/**
 * 日付判定のユーティリティ
 * 一日の区切りを03:00-03:00で管理
 */
import { format } from 'date-fns'

/**
 * 指定された日時がどの「日」に属するかを判定
 * 03:00-03:00で区切る（深夜3時で日付が切り替わる）
 * @param date 判定する日時
 * @returns その日時が属する「日」の日付（yyyy-MM-dd形式）
 */
export function getStudyDay(date: Date): string {
  const hour = date.getHours()
  const studyDate = new Date(date)

  // 03:00より前（深夜0時〜2時59分）なら前日として扱う
  // 例: 1月26日 02:00 → 1月25日の学習記録として扱う
  if (hour < 3) {
    studyDate.setDate(studyDate.getDate() - 1)
  }

  return format(studyDate, 'yyyy-MM-dd')
}

/**
 * カレンダー表示用の日付から学習記録の日付を取得
 * カレンダーの日付はその日の00:00:00として扱う
 * 学習記録は03:00-03:00で区切られているため：
 * - カレンダーの1月25日 → 1月25日 03:00 〜 1月26日 02:59 の記録を見たい
 * - この記録は「1月25日」の学習記録として保存されている
 * - カレンダーの日付をそのまま使う（03:00の判定は不要）
 * @param calendarDate カレンダー上の日付（00:00:00として扱う）
 * @returns その日付に対応する学習記録の日付（yyyy-MM-dd形式）
 */
export function getStudyDayFromCalendarDate(calendarDate: Date): string {
  // カレンダーの日付をそのまま学習記録の日付として使う
  // 例：カレンダーの1月25日 → 1月25日の学習記録（1月25日 03:00 〜 1月26日 02:59）
  return format(calendarDate, 'yyyy-MM-dd')
}

/**
 * 現在の日付を取得（03:00-03:00の区切りで）
 * @returns 現在の「日」の日付（Dateオブジェクト、時刻は00:00:00）
 */
export function getTodayDate(): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // 現在が03:00より前なら、前日を今日として扱う
  if (now.getHours() < 3) {
    today.setDate(today.getDate() - 1)
  }
  
  return today
}

/**
 * 今日の開始時刻（03:00）を取得
 */
export function getTodayStart(): Date {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(3, 0, 0, 0)

  // 現在が03:00より前なら、昨日の03:00を返す
  if (now.getHours() < 3) {
    todayStart.setDate(todayStart.getDate() - 1)
  }

  return todayStart
}

/**
 * 今週の開始時刻（月曜日の03:00）を取得
 */
export function getThisWeekStart(): Date {
  const todayStart = getTodayStart()
  const dayOfWeek = todayStart.getDay() // 0=日曜, 1=月曜, ...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - daysToMonday)
  weekStart.setHours(3, 0, 0, 0)

  return weekStart
}

/**
 * 今月の開始時刻（1日の03:00）を取得
 */
export function getThisMonthStart(): Date {
  const todayStart = getTodayStart()
  const monthStart = new Date(todayStart)
  monthStart.setDate(1)
  monthStart.setHours(3, 0, 0, 0)

  return monthStart
}

/**
 * 指定された週の開始日（月曜日）を取得
 * @param offset 週のオフセット（0=今週、-1=先週、-2=2週間前など）
 * @returns その週の月曜日のDateオブジェクト（時刻は00:00:00）
 */
export function getWeekStart(offset: number = 0): Date {
  const todayStart = getTodayStart()
  const dayOfWeek = todayStart.getDay() // 0=日曜, 1=月曜, ...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - daysToMonday - (offset * 7))
  weekStart.setHours(0, 0, 0, 0)

  return weekStart
}

/**
 * 指定された月の開始日を取得
 * @param offset 月のオフセット（0=今月、-1=先月、-2=2ヶ月前など）
 * @returns その月の1日のDateオブジェクト（時刻は00:00:00）
 */
export function getMonthStart(offset: number = 0): Date {
  const todayStart = getTodayStart()
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() + offset, 1)
  monthStart.setHours(0, 0, 0, 0)

  return monthStart
}

/**
 * 指定された日時が指定された期間内かどうかを判定
 */
export function isInPeriod(date: Date, periodStart: Date): boolean {
  return date >= periodStart
}
