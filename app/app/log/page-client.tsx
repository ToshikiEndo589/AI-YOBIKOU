'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CategoryStackedChart } from '@/components/category-stacked-chart'
import { ReferenceBookChart } from '@/components/reference-book-chart'
import { getTodayStart, getThisMonthStart, getWeekStart, getMonthStart, isInPeriod, getThisWeekStart } from '@/lib/date-utils'
import { getMaterialColor } from '@/lib/color-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudyLog, ReferenceBook, Profile } from '@/types/database'

export function LogPageClient() {
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([])
  const [referenceBooks, setReferenceBooks] = useState<ReferenceBook[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPastGoals, setShowPastGoals] = useState(false)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [thisMonthMinutes, setThisMonthMinutes] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [showManualInput, setShowManualInput] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualDate, setManualDate] = useState(getLocalDateString())
  const [isSaving, setIsSaving] = useState(false)
  const [dailyIndex, setDailyIndex] = useState(0)
  const [weeklyIndex, setWeeklyIndex] = useState(0)
  const [monthlyIndex, setMonthlyIndex] = useState(0)
  const [weekOffset, setWeekOffset] = useState(1)
  const [monthOffset, setMonthOffset] = useState(1)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editDate, setEditDate] = useState(getLocalDateString())
  const [showEditLogs, setShowEditLogs] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // 学習記録、参考書、プロフィールを同時に取得
        const [logsResult, booksResult, profileResult] = await Promise.all([
          supabase
            .from('study_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('started_at', { ascending: false }),
          supabase
            .from('reference_books')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single(),
        ])

        if (logsResult.error) throw logsResult.error
        if (booksResult.error) throw booksResult.error

        const logs = logsResult.data || []
        const books = booksResult.data || []
        setReferenceBooks(books)
        if (profileResult.data) {
          setProfile(profileResult.data)
        }
        applyLogs(logs)
      } catch (error) {
        console.error('Failed to load study logs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // 定期的にデータを更新（3秒ごと）
    const interval = setInterval(loadData, 3000)
    
    // カスタムイベントでデータ更新を通知
    const handleStudyLogSaved = () => {
      loadData()
    }
    window.addEventListener('studyLogSaved', handleStudyLogSaved)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('studyLogSaved', handleStudyLogSaved)
    }
  }, [])

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) {
      return `${hours}時間${mins}分`
    } else if (hours > 0) {
      return `${hours}時間`
    } else {
      return `${mins}分`
    }
  }

  const applyLogs = (logs: StudyLog[]) => {
    setStudyLogs(logs)
    const todayStart = getTodayStart()
    const monthStart = getThisMonthStart()

    const today = logs
      .filter((log) => {
        const logDate = new Date(log.started_at)
        return isInPeriod(logDate, todayStart)
      })
      .reduce((sum, log) => sum + log.study_minutes, 0)

    const thisMonth = logs
      .filter((log) => {
        const logDate = new Date(log.started_at)
        return isInPeriod(logDate, monthStart)
      })
      .reduce((sum, log) => sum + log.study_minutes, 0)

    const total = logs.reduce((sum, log) => sum + log.study_minutes, 0)

    setTodayMinutes(today)
    setThisMonthMinutes(thisMonth)
    setTotalMinutes(total)
  }

  const getMinutesInRange = (start: Date, end: Date): number => {
    return studyLogs
      .filter((log) => {
        const logDate = new Date(log.started_at)
        return logDate >= start && logDate < end
      })
      .reduce((sum, log) => sum + log.study_minutes, 0)
  }

  const getWeekLabel = (offset: number) => {
    if (offset === 1) return '先週'
    return `${offset}週間前`
  }

  const getMonthLabel = (offset: number) => {
    if (offset === 1) return '先月'
    return `${offset}ヶ月前`
  }

  const getDayLabel = (offset: number) => {
    if (offset === 0) return '今日'
    if (offset === 1) return '昨日'
    return `${offset}日前`
  }

  const getDayRange = (offset: number) => {
    const todayStart = getTodayStart()
    const start = new Date(todayStart)
    start.setDate(start.getDate() - offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  const getWeekRangeFromIndex = (index: number) => {
    const start = getWeekStart(index)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  const getMonthRangeFromIndex = (index: number) => {
    const start = getMonthStart(-index)
    const end = getMonthStart(-index + 1)
    return { start, end }
  }

  const getWeekRange = (offset: number) => {
    const start = getWeekStart(offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  const weekRange = getWeekRange(weekOffset)
  const weekMinutes = getMinutesInRange(weekRange.start, weekRange.end)

  const currentWeekRange = getWeekRange(0)
  const currentWeekMinutes = getMinutesInRange(currentWeekRange.start, currentWeekRange.end)

  const monthRange = getMonthRangeFromIndex(monthOffset)
  const monthMinutes = getMinutesInRange(monthRange.start, monthRange.end)

  const handleToggleManualInput = () => {
    if (!showManualInput) {
      setManualDate(getLocalDateString())
    }
    setShowManualInput(!showManualInput)
  }

  const handleToggleEditLogs = () => {
    if (editingLogId) {
      cancelEditLog()
    }
    setShowEditLogs(!showEditLogs)
  }

  const toLocalDateInput = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const startEditLog = (log: StudyLog) => {
    setEditingLogId(log.id)
    setEditBookId(log.reference_book_id || null)
    setEditSubject(log.subject)
    setEditMinutes(String(log.study_minutes))
    setEditDate(toLocalDateInput(log.started_at))
  }

  const cancelEditLog = () => {
    setEditingLogId(null)
    setEditBookId(null)
    setEditSubject('')
    setEditMinutes('')
    setEditDate(getLocalDateString())
  }

  const saveEditLog = async () => {
    if (!editingLogId) return
    const minutes = parseInt(editMinutes)
    if (isNaN(minutes) || minutes < 1) {
      alert('1分以上の学習時間を入力してください')
      return
    }
    const inputDate = new Date(editDate)
    inputDate.setHours(12, 0, 0, 0)
    const startedAt = inputDate.toISOString()
    const selectedBook = referenceBooks.find((b) => b.id === editBookId)
    const subject = selectedBook?.name?.trim() || editSubject.trim() || 'その他'

    try {
      const supabase = createClient()
      const { data: updated, error } = await supabase
        .from('study_logs')
        .update({
          subject,
          reference_book_id: editBookId || null,
          study_minutes: minutes,
          started_at: startedAt,
        })
        .eq('id', editingLogId)
        .select()

      if (error) throw error

      // 最新のデータを再取得
      const { data: logsData } = await supabase
        .from('study_logs')
        .select('*')
        .order('started_at', { ascending: false })

      if (logsData) {
        applyLogs(logsData)
      }

      cancelEditLog()
    } catch (err: any) {
      console.error('Update study log error:', err)
      alert(err.message || '更新に失敗しました。もう一度お試しください。')
    }
  }

  const deleteLog = async (logId: string) => {
    if (!confirm('この学習記録を削除しますか？')) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('study_logs')
        .delete()
        .eq('id', logId)

      if (error) throw error

      const { data: logsData } = await supabase
        .from('study_logs')
        .select('*')
        .order('started_at', { ascending: false })

      if (logsData) {
        applyLogs(logsData)
      }
    } catch (err: any) {
      console.error('Delete study log error:', err)
      alert(err.message || '削除に失敗しました。もう一度お試しください。')
    }
  }

  const buildShareText = () => {
    return `今日の学習: ${formatTime(todayMinutes)} / 今月: ${formatTime(thisMonthMinutes)} / 累計: ${formatTime(totalMinutes)}`
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const shareLinks = {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}&url=${encodeURIComponent(shareUrl)}`,
  }

  const getLocalDateStringFromDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDailyTargetForDate = (date: Date, profile: Profile | null): number => {
    if (!profile) return 60
    const day = date.getDay()
    const isWeekend = day === 0 || day === 6
    const defaultTarget = isWeekend
      ? profile.weekend_target_minutes ?? 120
      : profile.weekday_target_minutes ?? 60

    const dateString = getLocalDateStringFromDate(date)
    if (profile.today_target_date === dateString && profile.today_target_minutes) {
      return profile.today_target_minutes
    }

    return defaultTarget
  }

  const getWeekTarget = (weekStart: Date, profile: Profile | null): number => {
    if (!profile) return 420 // デフォルト60分×7日
    const weekStartDateString = getLocalDateStringFromDate(weekStart)
    if (profile.week_target_date === weekStartDateString && profile.week_target_minutes) {
      return profile.week_target_minutes
    }
    // 週の目標がない場合は、日ごとの目標を合計
    let total = 0
    const cursor = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      total += getDailyTargetForDate(cursor, profile)
      cursor.setDate(cursor.getDate() + 1)
    }
    return total
  }

  const getMonthTarget = (monthStart: Date, profile: Profile | null): number => {
    if (!profile) return 1800 // デフォルト60分×30日
    const monthStartDateString = getLocalDateStringFromDate(monthStart)
    if (profile.month_target_date === monthStartDateString && profile.month_target_minutes) {
      return profile.month_target_minutes
    }
    // 月の目標がない場合は、日ごとの目標を合計
    let total = 0
    const cursor = new Date(monthStart)
    const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    while (cursor < end) {
      total += getDailyTargetForDate(cursor, profile)
      cursor.setDate(cursor.getDate() + 1)
    }
    return total
  }

  const getPastGoalsData = () => {
    if (!profile) return { days: [], weeks: [], months: [] }

    const days = []
    for (let i = 1; i <= 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date)
      dayStart.setHours(3, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const target = getDailyTargetForDate(date, profile)
      const actual = getMinutesInRange(dayStart, dayEnd)
      const progress = Math.min(100, Math.round((actual / Math.max(1, target)) * 100))

      days.push({
        date: date,
        target,
        actual,
        progress,
      })
    }

    const weeks = []
    for (let i = 1; i <= 12; i++) {
      const weekStart = getWeekStart(i)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const target = getWeekTarget(weekStart, profile)
      const actual = getMinutesInRange(weekStart, weekEnd)
      const progress = Math.min(100, Math.round((actual / Math.max(1, target)) * 100))

      weeks.push({
        weekStart,
        target,
        actual,
        progress,
      })
    }

    const months = []
    for (let i = 1; i <= 12; i++) {
      const monthStart = getMonthStart(-i)
      const monthEnd = getMonthStart(-i + 1)

      const target = getMonthTarget(monthStart, profile)
      const actual = getMinutesInRange(monthStart, monthEnd)
      const progress = Math.min(100, Math.round((actual / Math.max(1, target)) * 100))

      months.push({
        monthStart,
        target,
        actual,
        progress,
      })
    }

    return { days, weeks, months }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBookId || !manualMinutes || !manualDate) {
      alert('すべての項目を入力してください')
      return
    }

    const minutes = parseInt(manualMinutes)
    if (isNaN(minutes) || minutes < 1) {
      alert('1分以上の学習時間を入力してください')
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('ログインが必要です')
        return
      }

      const selectedBook = referenceBooks.find((b) => b.id === selectedBookId)
      const subject = selectedBook?.name?.trim() || 'その他'

      if (!subject || subject.length === 0) {
        throw new Error('科目名が設定されていません')
      }

      // 手動入力の日付を12:00:00として保存（03:00-03:00の区切りで正しい日付として判定されるように）
      const inputDate = new Date(manualDate)
      inputDate.setHours(12, 0, 0, 0)
      const startedAt = inputDate.toISOString()

      const { data, error } = await supabase
        .from('study_logs')
        .insert({
          user_id: user.id,
          subject: subject,
          reference_book_id: selectedBookId || null,
          study_minutes: minutes,
          started_at: startedAt,
        })
        .select()
        .single()

      if (error) {
        console.error('Study log save error:', error)
        throw new Error(`保存に失敗しました: ${error.message}`)
      }

      if (!data) {
        throw new Error('保存に失敗しました: データが返されませんでした')
      }

      // データを再取得
      const { data: logsData } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      if (logsData) {
        applyLogs(logsData)
      }

      // フォームをリセット
      setManualMinutes('')
      setManualDate(getLocalDateString())
      setShowManualInput(false)
      alert('学習記録を保存しました！')
    } catch (err: any) {
      console.error('Save study log error:', err)
      alert(err.message || '保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full px-3 py-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">読み込み中...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-6">
      <div className="space-y-6">
        {/* 学習時間 セクション */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">学習時間</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* サマリーカード */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-foreground mb-1">
                  {formatTime(todayMinutes)}
                </div>
                <div className="text-xs text-muted-foreground">今日</div>
              </div>
              <div className="bg-gray-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-foreground mb-1">
                  {formatTime(currentWeekMinutes)}
                </div>
                <div className="text-xs text-muted-foreground">今週</div>
              </div>
              <div className="bg-gray-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-foreground mb-1">
                  {formatTime(thisMonthMinutes)}
                </div>
                <div className="text-xs text-muted-foreground">今月</div>
              </div>
              <div className="bg-gray-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-foreground mb-1">
                  {formatTime(totalMinutes)}
                </div>
                <div className="text-xs text-muted-foreground">総計</div>
              </div>
            </div>

            {/* 過去の週・月の合計 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{getWeekLabel(weekOffset)}（月ー日）</span>
                  <select
                    value={weekOffset}
                    onChange={(e) => setWeekOffset(Number(e.target.value))}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value={1}>先週</option>
                    <option value={2}>2週間前</option>
                    <option value={3}>3週間前</option>
                    <option value={4}>4週間前</option>
                    <option value={5}>5週間前</option>
                  </select>
                </div>
                <div className="text-base font-bold text-foreground">
                  {formatTime(weekMinutes)}
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{getMonthLabel(monthOffset)}</span>
                  <select
                    value={monthOffset}
                    onChange={(e) => setMonthOffset(Number(e.target.value))}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
                      <option key={value} value={value}>
                        {value === 1 ? '先月' : `${value}ヶ月前`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-base font-bold text-foreground">
                  {formatTime(monthMinutes)}
                </div>
              </div>
            </div>

            {/* 共有 */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="h-4 w-4 text-blue-500" />
                学習記録を共有
              </div>
              <div className="flex gap-2">
                <a href={shareLinks.x} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">X</Button>
                </a>
              </div>
            </div>

            {/* 日別積み上げ棒グラフ */}
            <div className="pt-2">
              <CategoryStackedChart studyLogs={studyLogs} referenceBooks={referenceBooks} />
            </div>

            {/* 教材別の学習時間 */}
            <div className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">教材別の学習時間</div>
              </div>
              {/* 凡例 */}
              {(() => {
                const allMaterials = new Set<string>()
                studyLogs.forEach((log) => {
                  if (log.reference_book_id) {
                    const book = referenceBooks.find((b) => b.id === log.reference_book_id)
                    if (book) {
                      allMaterials.add(book.name)
                    } else if (log.subject) {
                      allMaterials.add(log.subject)
                    }
                  } else if (log.subject) {
                    allMaterials.add(log.subject)
                  }
                })
                const materialList = Array.from(allMaterials).sort()
                if (materialList.length === 0) return null
                return (
                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    {materialList.map((material) => (
                      <div key={material} className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getMaterialColor(material) }}
                        />
                        <span className="text-muted-foreground">{material}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="w-full rounded-lg border border-muted bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">一日</span>
                    <select
                      value={dailyIndex}
                      onChange={(e) => setDailyIndex(Number(e.target.value))}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {Array.from({ length: 8 }, (_, i) => i).map((value) => (
                        <option key={value} value={value}>
                          {getDayLabel(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ReferenceBookChart
                    studyLogs={studyLogs}
                    referenceBooks={referenceBooks}
                    range={getDayRange(dailyIndex)}
                  />
                </div>

                <div className="w-full rounded-lg border border-muted bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">1週間</span>
                    <select
                      value={weeklyIndex}
                      onChange={(e) => setWeeklyIndex(Number(e.target.value))}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {Array.from({ length: 6 }, (_, i) => i).map((value) => (
                        <option key={value} value={value}>
                          {value === 0 ? '今週' : `${value}週間前`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ReferenceBookChart
                    studyLogs={studyLogs}
                    referenceBooks={referenceBooks}
                    range={getWeekRangeFromIndex(weeklyIndex)}
                  />
                </div>

                <div className="w-full rounded-lg border border-muted bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">1ヶ月</span>
                    <select
                      value={monthlyIndex}
                      onChange={(e) => setMonthlyIndex(Number(e.target.value))}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {Array.from({ length: 13 }, (_, i) => i).map((value) => (
                        <option key={value} value={value}>
                          {value === 0 ? '今月' : `${value}ヶ月前`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ReferenceBookChart
                    studyLogs={studyLogs}
                    referenceBooks={referenceBooks}
                    range={getMonthRangeFromIndex(monthlyIndex)}
                  />
                </div>

                <div className="w-full rounded-lg border border-muted bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">総累計</span>
                    <span className="text-xs text-muted-foreground">全期間</span>
                  </div>
                  <ReferenceBookChart
                    studyLogs={studyLogs}
                    referenceBooks={referenceBooks}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 過去の学習記録入力 */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">過去の学習記録</CardTitle>
                <CardDescription>過去の学習時間を手動で入力</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleManualInput}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          {showManualInput && (
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual_book">教材</Label>
                  <select
                    id="manual_book"
                    value={selectedBookId || ''}
                    onChange={(e) => setSelectedBookId(e.target.value || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">選択してください</option>
                    {referenceBooks.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual_minutes">学習時間（分）</Label>
                  <Input
                    id="manual_minutes"
                    type="number"
                    min="1"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                    placeholder="60"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual_date">学習日</Label>
                  <Input
                    id="manual_date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* 学習記録一覧（編集） */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">学習記録の修正</CardTitle>
                <CardDescription>直近の記録を編集・削除できます</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleEditLogs}
              >
                <Plus className={cn('w-5 h-5 transition-transform', showEditLogs && 'rotate-45')} />
              </Button>
            </div>
          </CardHeader>
          {showEditLogs && (
            <CardContent className="space-y-3">
              {studyLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">学習記録がありません</p>
              )}
              {studyLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="rounded-lg border border-muted p-3">
                  {editingLogId === log.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>教材</Label>
                          <select
                            value={editBookId || ''}
                            onChange={(e) => setEditBookId(e.target.value || null)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="">その他</option>
                            {referenceBooks.map((book) => (
                              <option key={book.id} value={book.id}>
                                {book.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>科目名（自由入力）</Label>
                          <Input
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            placeholder="その他"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>学習時間（分）</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>学習日</Label>
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button onClick={saveEditLog} disabled={isSaving}>
                            保存
                          </Button>
                          <Button variant="outline" onClick={cancelEditLog}>
                            キャンセル
                          </Button>
                          <Button variant="destructive" onClick={() => deleteLog(log.id)}>
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">
                          {new Date(log.started_at).toLocaleDateString('ja-JP')}
                        </div>
                        <div className="font-medium">
                          {log.subject} / {formatTime(log.study_minutes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEditLog(log)}>
                          編集
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteLog(log.id)}>
                          削除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* 過去の目標達成状況 */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">過去の目標達成状況</CardTitle>
                <CardDescription>過去の日・週・月の目標達成状況を確認</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowPastGoals(!showPastGoals)}
              >
                <Plus className={cn('w-5 h-5 transition-transform', showPastGoals && 'rotate-45')} />
              </Button>
            </div>
          </CardHeader>
          {showPastGoals && profile && (
            <CardContent className="space-y-6">
              {(() => {
                const pastGoals = getPastGoalsData()
                return (
                  <>
                    {/* 過去30日間の目標達成状況 */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">過去30日間（1日ごと）</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pastGoals.days.map((day, idx) => (
                          <div key={idx} className="rounded-lg border border-muted p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">
                                {day.date.toLocaleDateString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-sm font-medium">
                                {formatTime(day.actual)} / {formatTime(day.target)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  day.progress >= 100
                                    ? 'bg-green-500'
                                    : day.progress >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-orange-500'
                                )}
                                style={{ width: `${Math.min(100, day.progress)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              達成率 {day.progress}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 過去12週間の目標達成状況 */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">過去12週間（1週間ごと）</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pastGoals.weeks.map((week, idx) => (
                          <div key={idx} className="rounded-lg border border-muted p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">
                                {week.weekStart.toLocaleDateString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                {' 〜 '}
                                {new Date(week.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-sm font-medium">
                                {formatTime(week.actual)} / {formatTime(week.target)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  week.progress >= 100
                                    ? 'bg-green-500'
                                    : week.progress >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-orange-500'
                                )}
                                style={{ width: `${Math.min(100, week.progress)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              達成率 {week.progress}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 過去12ヶ月の目標達成状況 */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">過去12ヶ月（1ヶ月ごと）</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pastGoals.months.map((month, idx) => (
                          <div key={idx} className="rounded-lg border border-muted p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">
                                {month.monthStart.toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'long',
                                })}
                              </span>
                              <span className="text-sm font-medium">
                                {formatTime(month.actual)} / {formatTime(month.target)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  month.progress >= 100
                                    ? 'bg-green-500'
                                    : month.progress >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-orange-500'
                                )}
                                style={{ width: `${Math.min(100, month.progress)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              達成率 {month.progress}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
