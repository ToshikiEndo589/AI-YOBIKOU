'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculatePassProbability, getProbabilityDisplay } from '@/lib/probability'
import type { Profile } from '@/types/database'

export default function ProbabilityInfoPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // プロフィール取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        setProfile(profileData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading || !profile) {
  return (
    <div className="w-full px-3 py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const probabilityData = calculatePassProbability(profile)
  const probabilityDisplay = getProbabilityDisplay(
    probabilityData.probability,
    probabilityData.minProbability,
    probabilityData.maxProbability,
    probabilityData.daysUntilExam
  )

  // 試験日を取得
  const examDate = profile.exam_date
    ? new Date(profile.exam_date)
    : new Date('2025-02-01')
  const examDateStr = examDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="w-full px-3 py-6">
      <div className="space-y-6">
        {/* 現在の合格率 */}
        <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">📊 現在の合格率</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-2 text-center">
                {probabilityDisplay.display}
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  試験日: {examDateStr}（あと{probabilityData.daysUntilExam}日）
                </p>
                {probabilityDisplay.isRange && (
                  <p className="text-xs text-muted-foreground mt-2">
                    試験日が近づくにつれて、より正確な合格率が表示されます
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 変動幅の説明 */}
        <Card className="shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg">🎯 合格率の変動幅について</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              試験日までの残り日数に応じて、合格率の変動幅が変わります。
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg border border-green-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">1年以上前</span>
                  <span className="text-sm font-bold text-green-600">±20</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  偏差値の変動幅: ±20程度
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-green-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">半年以上前</span>
                  <span className="text-sm font-bold text-green-600">±15</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  偏差値の変動幅: ±15程度
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-green-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">3ヶ月以上前</span>
                  <span className="text-sm font-bold text-green-600">±10</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  偏差値の変動幅: ±10程度
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">1ヶ月以上前</span>
                  <span className="text-sm font-bold text-blue-600">±5</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  偏差値の変動幅: ±5程度
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">1ヶ月以内</span>
                  <span className="text-sm font-bold text-purple-600">変動なし</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  現在の偏差値をそのまま使用（単一値で表示）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 計算ロジックの説明 */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">📖 合格率の計算方法</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-2">合格率の基準:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>目標偏差値 = 現在偏差値の場合: 合格率80%</li>
                <li>これを基準に、他の偏差値の時の合格率を計算</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">偏差値による計算:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>目標偏差値を超過: 超過分に応じて合格率を上げる（最大99%）</li>
                <li>目標偏差値未達成: 不足分に応じて合格率を下げる（1偏差値あたり2%減点）</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">変動幅の働き:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>試験日が遠い: 偏差値の変動幅を大きく見積もる（幅で表示）</li>
                <li>試験日が近い: 現在の偏差値をより正確に反映（単一値で表示）</li>
                <li>変動幅が大きい時: 「50-70%」のような幅で表示</li>
                <li>変動幅が小さい時: 「65%」のように具体的な値で表示</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
