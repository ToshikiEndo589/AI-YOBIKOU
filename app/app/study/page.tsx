'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Pause, Square } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MascotMessage } from '@/components/mascot-message'
import { ReferenceBookManager } from '@/components/reference-book-manager'
import { saveTimerState, loadTimerState, clearTimerState, type TimerState } from '@/lib/storage/study-timer'
import type { ReferenceBook } from '@/types/database'

export default function StudyPage() {
  const router = useRouter()
  const [referenceBooks, setReferenceBooks] = useState<ReferenceBook[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // 教材一覧を読み込む
  useEffect(() => {
    const loadReferenceBooks = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const { data, error } = await supabase
          .from('reference_books')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (error) throw error
        setReferenceBooks(data || [])
      } catch (error: any) {
        console.error('Failed to load reference books:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadReferenceBooks()
  }, [router])

  // タイマー状態を復元
  useEffect(() => {
    const saved = loadTimerState()
    if (saved) {
      setSelectedBookId(saved.referenceBookId)
      if (saved.isRunning && saved.startTime) {
        // 経過時間を再計算
        const elapsed = Math.floor((Date.now() - saved.startTime) / 1000)
        setSeconds(saved.seconds + elapsed)
        setIsRunning(true)
        startTimeRef.current = saved.startTime
      } else {
        setSeconds(saved.seconds)
        setIsRunning(false)
      }
    }
  }, [])

  // タイマーの実行
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const newSeconds = prev + 1
          // 状態を保存
          saveTimerState({
            isRunning: true,
            seconds: newSeconds,
            referenceBookId: selectedBookId,
            startTime: startTimeRef.current || Date.now(),
          })
          return newSeconds
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // 停止時も状態を保存
      if (selectedBookId !== null) {
        saveTimerState({
          isRunning: false,
          seconds,
          referenceBookId: selectedBookId,
          startTime: null,
        })
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, selectedBookId, seconds])

  // ページが非表示になった時も計測を続ける（バックグラウンド計測）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunning && startTimeRef.current) {
        // ページが非表示になった時、現在の経過時間を保存
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        saveTimerState({
          isRunning: true,
          seconds: seconds + elapsed,
          referenceBookId: selectedBookId,
          startTime: startTimeRef.current,
        })
      } else if (!document.hidden && isRunning && startTimeRef.current) {
        // ページが表示された時、経過時間を再計算
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setSeconds((prev) => prev + elapsed)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRunning, selectedBookId, seconds])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    if (!selectedBookId) {
      alert('教材を選択してください')
      return
    }
    setIsRunning(true)
    startTimeRef.current = Date.now()
    saveTimerState({
      isRunning: true,
      seconds: 0,
      referenceBookId: selectedBookId,
      startTime: Date.now(),
    })
  }

  const handlePause = () => {
    setIsRunning(false)
    startTimeRef.current = null
  }

  const handleStop = async () => {
    setIsRunning(false)
    
    if (seconds === 0) {
      setSeconds(0)
      startTimeRef.current = null
      clearTimerState()
      return
    }

    const minutes = Math.floor(seconds / 60)
    // 1分未満の場合は保存しない（59秒以下は記録されない）
    if (minutes < 1) {
      setSeconds(0)
      startTimeRef.current = null
      clearTimerState()
      alert('1分以上の学習時間を記録してください（現在: ' + Math.floor(seconds) + '秒）')
      return
    }
    
    // デバッグ: 保存する分数を確認
    console.log('Saving study log:', { seconds, minutes, selectedBookId })

    // 教材が選択されていない場合は保存できない
    if (!selectedBookId) {
      alert('教材を選択してください')
      setIsRunning(false)
      setSeconds(0)
      startTimeRef.current = null
      clearTimerState()
      return
    }

    await saveStudyLog(selectedBookId, minutes, new Date().toISOString())

    setSeconds(0)
    startTimeRef.current = null
    clearTimerState()
  }

  const saveStudyLog = async (referenceBookId: string, minutes: number, startedAt: string) => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('ログインが必要です')
        router.push('/login')
        return
      }

      // 教材が有効か確認（削除されていないか）
      const { data: bookData } = await supabase
        .from('reference_books')
        .select('id, name')
        .eq('id', referenceBookId)
        .is('deleted_at', null)
        .single()

      if (!bookData) {
        throw new Error('選択された教材が見つかりません。教材を再選択してください。')
      }

      const subject = bookData.name?.trim() || 'その他'

      if (!subject || subject.length === 0) {
        throw new Error('科目名が設定されていません')
      }

      console.log('Saving study log:', { minutes, subject, startedAt, referenceBookId })
      
      const { data, error } = await supabase
        .from('study_logs')
        .insert({
          user_id: user.id,
          subject: subject,
          reference_book_id: referenceBookId || null,
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
      
      console.log('Study log saved successfully:', data)

      const messages = [
        `🎉 ${subject}を${minutes}分学習したね！素晴らしい！`,
        `✨ ${minutes}分の学習、お疲れ様！合格に一歩近づいたよ！`,
        `💪 ${subject}を${minutes}分頑張ったね！この調子で続けよう！`,
        `🔥 ${minutes}分の学習を記録したよ！連続記録を更新しよう！`,
      ]
      setSuccessMessage(messages[Math.floor(Math.random() * messages.length)])

      // カスタムイベントで記録画面に通知
      window.dispatchEvent(new Event('studyLogSaved'))

      // 保存成功後、すぐにリフレッシュ
      router.refresh()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Save study log error:', err)
      alert(err.message || '保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }


  const getEncouragementMessage = (): string => {
    const minutes = Math.floor(seconds / 60)
    if (minutes === 0) {
      return '🚀 学習を始めよう！一緒に頑張るよ！'
    } else if (minutes < 30) {
      return `💪 ${minutes}分経過！この調子で続けよう！`
    } else if (minutes < 60) {
      return `✨ ${minutes}分頑張ってるね！素晴らしい集中力だよ！`
    } else {
      return `🔥 ${Math.floor(minutes / 60)}時間以上！本当に頑張ってるね！`
    }
  }

  const selectedBook = referenceBooks.find((b) => b.id === selectedBookId)

  if (isLoading) {
    return (
      <div className="w-full px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-6">
      <div className="space-y-6">
        {/* 成功メッセージ */}
        {successMessage && (
          <Card className="shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <MascotMessage message={successMessage} emotion="excited" />
            </CardContent>
          </Card>
        )}

        {/* 学習中の励ましメッセージ */}
        {isRunning && seconds > 0 && (
          <Card className="shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="pt-6">
              <MascotMessage message={getEncouragementMessage()} emotion="encouraging" />
            </CardContent>
          </Card>
        )}

        {/* 教材選択 */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>教材選択</CardTitle>
            <CardDescription>学習する教材を選択してください</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferenceBookManager
              referenceBooks={referenceBooks}
              selectedBookId={selectedBookId}
              onSelect={(bookId) => {
                if (isRunning) {
                  alert('計測中は参考書を変更できません')
                  return
                }
                setSelectedBookId(bookId)
              }}
              onRefresh={async () => {
                const supabase = createClient()
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                if (user) {
                  const { data } = await supabase
                    .from('reference_books')
                    .select('*')
                    .eq('user_id', user.id)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                  setReferenceBooks(data || [])
                }
              }}
            />
          </CardContent>
        </Card>

        {/* ストップウォッチ */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>リアルタイム計測</CardTitle>
            <CardDescription>学習時間を計測します（アプリを閉じても計測は続きます）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-6xl font-mono font-bold text-primary mb-4">
                {formatTime(seconds)}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedBook ? selectedBook.name : '教材を選択してください'}
              </div>
            </div>

            <div className="flex justify-center gap-2">
              {!isRunning ? (
                <Button
                  onClick={handleStart}
                  disabled={!selectedBookId || isSaving}
                  size="lg"
                  className="flex-1"
                  title={!selectedBookId ? '教材を選択してください' : ''}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {!selectedBookId ? '教材を選択してください' : '開始'}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handlePause}
                    variant="outline"
                    size="lg"
                    className="flex-1"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    一時停止
                  </Button>
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="lg"
                    className="flex-1"
                    disabled={isSaving}
                  >
                    <Square className="w-5 h-5 mr-2" />
                    停止・保存
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
