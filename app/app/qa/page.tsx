'use client'

import { useState, useRef, useEffect, memo } from 'react'
import Image from 'next/image'
import { Send, ImageIcon, Camera, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
}

const STORAGE_KEY = 'qa_chat_history'
const STORAGE_MAX_MESSAGES = 50

const MessageBubble = memo(function MessageBubble({
  message,
  userAvatarUrl,
}: {
  message: Message
  userAvatarUrl: string | null
}) {
  return (
    <div
      className={`flex gap-3 ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {message.role === 'assistant' && (
        <div className="relative w-8 h-8 flex-shrink-0">
          <Image
            src="/images/mascot.png"
            alt="AI"
            fill
            className="object-contain rounded-full"
          />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl p-3 shadow-sm ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-primary-foreground'
            : 'bg-white border border-slate-200'
        }`}
      >
        {message.imageUrl && (
          <div className="mb-2">
            <img
              src={message.imageUrl}
              alt="アップロード画像"
              className="max-w-full rounded"
            />
          </div>
        )}
        {message.role === 'assistant' ? (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h2: ({ node, ...props }) => (
                  <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0 text-foreground" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside space-y-1 my-2 text-foreground" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2 text-foreground" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="my-2 text-foreground leading-relaxed" {...props} />
                ),
                code: ({ node, inline, ...props }: any) => {
                  if (inline) {
                    return <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props} />
                  }
                  return <code className="block bg-muted p-2 rounded my-2 overflow-x-auto text-sm font-mono" {...props} />
                },
                div: ({ node, ...props }: any) => {
                  if (props.className?.includes('math-display')) {
                    return <div className="my-4 overflow-x-auto" {...props} />
                  }
                  return <div {...props} />
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      {message.role === 'user' && (
        <div className="relative w-8 h-8 flex-shrink-0">
          {userAvatarUrl ? (
            <Image
              src={userAvatarUrl}
              alt="あなた"
              fill
              className="object-cover rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500" />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const MessageList = memo(function MessageList({
  messages,
  isLoading,
  messagesEndRef,
  userAvatarUrl,
}: {
  messages: Message[]
  isLoading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  userAvatarUrl: string | null
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2" style={{ scrollbarWidth: 'thin' }}>
      {messages.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <Image
              src="/images/mascot.png"
              alt="マスコット"
              fill
              className="object-contain"
            />
          </div>
          <p>質問を入力してください</p>
          <p className="text-sm mt-2">テキストと画像の両方に対応しています</p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} userAvatarUrl={userAvatarUrl} />
      ))}

      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image
              src="/images/mascot.png"
              alt="AI"
              fill
              className="object-contain rounded-full animate-pulse"
            />
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
})

export default function QAPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resizeTextarea = () => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
  }

  useEffect(() => {
    resizeTextarea()
  }, [input])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const handleChange = () => setIsCoarsePointer(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // ローカルストレージから履歴を読み込む
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setMessages(parsed)
          }
        } catch (e) {
          console.error('Failed to load chat history:', e)
        }
      }
    }
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .single()
        if (profile?.avatar_url) {
          setUserAvatarUrl(profile.avatar_url)
        }
      } catch (error) {
        console.warn('Failed to load profile avatar:', error)
      }
    }
    loadProfile()
  }, [])

  // メッセージが変更されたら保存
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return

    // 画像データは容量が大きいので保存対象から除外
    const lightweight = messages
      .slice(-STORAGE_MAX_MESSAGES)
      .map(({ id, role, content }) => ({ id, role, content }))

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight))
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight))
    } catch (e) {
      // それでも超える場合はさらに件数を減らす
      try {
        const smaller = lightweight.slice(-20)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller))
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(smaller))
      } catch {
        // 最終手段：保存を諦める
        console.warn('Failed to save chat history due to quota.')
      }
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSend = async () => {
    if (isLoading) return
    if (!input.trim() && !selectedImage) return
    const effectiveImage = selectedImage

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      imageUrl: selectedImage || undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    setIsLoading(true)

    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          image: effectiveImage,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
            imageUrl: m.imageUrl,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('AIからの応答を取得できませんでした')
      }

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full px-3 pt-4 pb-3 min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <Card className="shadow-xl flex-1 flex flex-col min-h-0 border-0 bg-white/90 backdrop-blur">
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">AI</span>
            Q&A
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* メッセージ表示エリア */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
            userAvatarUrl={userAvatarUrl}
          />

          {/* 入力エリア */}
          <div className="flex gap-2 flex-shrink-0 pt-3 border-t">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
              id="camera-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            </label>
            <label htmlFor="camera-upload" className="cursor-pointer">
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                title="カメラで撮影"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </label>
            {selectedImage && (
              <div className="relative w-12 h-12 flex-shrink-0">
                <img
                  src={selectedImage}
                  alt="プレビュー"
                  className="w-12 h-12 rounded object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0"
                  onClick={() => {
                    setSelectedImage(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                    if (cameraInputRef.current) {
                      cameraInputRef.current.value = ''
                    }
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isCoarsePointer && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="質問を入力..."
              className="flex-1 min-h-[96px] max-h-[220px] resize-none overflow-y-auto rounded-xl border border-input bg-background px-3 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              rows={4}
            />
            <Button onClick={handleSend} disabled={!input.trim() && !selectedImage} className="h-11 w-11 p-0 rounded-xl">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
