'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { StudyLog } from '@/types/database'
import type { Profile } from '@/types/database'
import { calculatePassProbability } from '@/lib/probability'
import { Button } from '@/components/ui/button'

interface ProbabilityChartProps {
  profile: Profile
  studyLogs: StudyLog[]
  latestStudyLog: StudyLog | null
}

const PERIOD_OPTIONS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: '6ヶ月', days: 180 },
  { label: '1年', days: 365 },
] as const

export function ProbabilityChart({ profile, studyLogs, latestStudyLog }: ProbabilityChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30)

  const data = useMemo(() => {
    // 学習記録がない場合は空配列を返す
    if (studyLogs.length === 0) {
      return []
    }

    // 最初の学習記録の日付を取得
    const firstStudyDate = new Date(
      studyLogs.reduce((earliest, log) => {
        const logDate = new Date(log.started_at)
        return logDate < earliest ? logDate : earliest
      }, new Date(studyLogs[0].started_at))
    )
    const firstStudyDateStr = format(firstStudyDate, 'yyyy-MM-dd')

    // 選択された期間分のデータを生成
    const days = selectedPeriod
    const result = []

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')

      // 最初の学習記録より前の日付はスキップ
      if (dateStr < firstStudyDateStr) {
        continue
      }

      // その日までの学習記録をフィルタ
      const logsUpToDate = studyLogs.filter(
        (log) => format(new Date(log.started_at), 'yyyy-MM-dd') <= dateStr
      )

      // その日時点での最新の学習記録
      const latestUpToDate =
        logsUpToDate.length > 0
          ? logsUpToDate.sort(
              (a, b) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            )[0]
          : null

      // その日時点での合格確率を計算
      const tempProfile = {
        ...profile,
        exam_date: profile.exam_date || new Date('2026-02-01').toISOString().split('T')[0],
      }
      const probabilityData = calculatePassProbability(tempProfile)
      const probability = probabilityData.probability

      result.push({
        date: format(date, 'M/d'),
        probability,
        fullDate: dateStr,
      })
    }

    return result
  }, [profile, studyLogs, latestStudyLog, selectedPeriod])

  if (data.length === 0 || studyLogs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option.days}
              variant={selectedPeriod === option.days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(option.days)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="text-center py-8 text-muted-foreground">
          {studyLogs.length === 0
            ? '学習記録がありません。学習を開始すると、ここに合格率の推移が表示されます。'
            : 'データがありません'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 期間選択ボタン */}
      <div className="flex flex-wrap gap-2 justify-center">
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.days}
            variant={selectedPeriod === option.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod(option.days)}
            className="text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: '確率(%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, '合格確率']}
            labelFormatter={(label) => `日付: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
