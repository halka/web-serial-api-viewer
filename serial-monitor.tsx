"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, Wifi, WifiOff, Volume2, VolumeX, AlertTriangle, ArrowDown, Pause } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SerialMonitor() {
  const [port, setPort] = useState<SerialPort | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [baudRate, setBaudRate] = useState("115200")
  const [receivedData, setReceivedData] = useState<string>("")
  const [isSupported, setIsSupported] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoInterval, setDemoInterval] = useState<NodeJS.Timeout | null>(null)

  // soundEnabledの最新の値を参照するためのref
  const soundEnabledRef = useRef(soundEnabled)

  // soundEnabledが変更されるたびにrefを更新
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // 自動スクロール機能
  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [autoScroll])

  // データが更新されたときに自動スクロール
  useEffect(() => {
    if (receivedData) {
      // 少し遅延させてDOMの更新を待つ
      setTimeout(scrollToBottom, 10)
    }
  }, [receivedData, scrollToBottom])

  const clearData = () => {
    setReceivedData("")
  }

  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll)
  }

  useEffect(() => {
    // Web Serial APIのサポートチェック
    const checkSupport = async () => {
      if (!("serial" in navigator)) {
        setIsSupported(false)
        return
      }

      try {
        setIsSupported(true)
      } catch (error) {
        console.log("Permission check failed:", error)
        setIsSupported(true) // Still try to support it
      }
    }

    checkSupport()

    // AudioContextの初期化
    if (typeof window !== "undefined") {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.log("AudioContext initialization failed:", error)
      }
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // 受信音を鳴らす関数 - useCallbackで最新の状態を参照
  const playReceiveSound = useCallback(async () => {
    // refから最新のsoundEnabled値を取得
    if (!soundEnabledRef.current) {
      console.log("Sound is disabled, skipping playback")
      return
    }

    if (!audioContextRef.current) {
      console.log("AudioContext not available")
      return
    }

    try {
      // AudioContextが suspended状態の場合は resume する
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }

      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.type = "sine"

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.1)

      console.log("Sound played successfully")
    } catch (error) {
      console.log("Sound playback failed:", error)
    }
  }, [])

  const startDemoMode = useCallback(() => {
    setDemoMode(true)
    setIsConnected(true)

    const interval = setInterval(
      () => {
        const sampleData = [
          "温度: 23.5°C",
          "湿度: 65%",
          "気圧: 1013.25 hPa",
          "照度: 450 lux",
          "動作検知",
          "バッテリー: 85%",
          "信号強度: -45 dBm",
          "GPS データ:\n緯度: 35.6762\n経度: 139.6503\n高度: 40m",
          "センサー状態:\n- 温度: 正常\n- 湿度: 正常\n- 気圧: エラー",
          "マルチライン ログ:\n情報: システム開始\n警告: バッテリー低下\nエラー: センサー切断",
          'JSON データ:\n{\n  "温度": 25.3,\n  "湿度": 60,\n  "状態": "正常"\n}',
          "コマンド応答:\n> ステータス\nシステム: 動作中\n稼働時間: 1日 5時間 23分\n> ",
          "日本語テスト: こんにちは世界！\n漢字、ひらがな、カタカナ、英数字123",
          "マルチバイト文字テスト:\n🌡️ 温度センサー\n💧 湿度センサー\n🔋 バッテリー状態",
          "エラーメッセージ:\nエラーコード: E001\n詳細: 通信タイムアウトが発生しました\n対処法: デバイスを再接続してください",
        ]

        const randomData = sampleData[Math.floor(Math.random() * sampleData.length)]
        const newLine = `${randomData}\n\n`

        // 新しいデータを文字列の末尾に追加
        setReceivedData((prev) => prev + newLine)
        playReceiveSound()
      },
      2000 + Math.random() * 3000,
    ) // Random interval between 2-5 seconds

    setDemoInterval(interval)
  }, [playReceiveSound])

  const stopDemoMode = useCallback(() => {
    setDemoMode(false)
    setIsConnected(false)
    if (demoInterval) {
      clearInterval(demoInterval)
      setDemoInterval(null)
    }
  }, [demoInterval])

  // シリアルポートに接続
  const connectToSerial = async () => {
    setIsConnecting(true)
    setPermissionError(null)

    try {
      // Web Serial APIの利用可能性を再チェック
      if (!("serial" in navigator)) {
        throw new Error("このブラウザはWeb Serial APIをサポートしていません")
      }

      const selectedPort = await navigator.serial.requestPort()
      await selectedPort.open({
        baudRate: Number.parseInt(baudRate),
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      })

      setPort(selectedPort)
      setIsConnected(true)

      // データ読み取りの開始
      startReading(selectedPort)
    } catch (error: any) {
      console.error("シリアルポートの接続に失敗しました:", error)

      if (error.message.includes("permissions policy") || error.message.includes("disallowed by permissions policy")) {
        setPermissionError(
          "プレビュー環境ではWeb Serial APIが制限されています。この機能を使用するには、コードをダウンロードしてローカル環境またはVercelにデプロイしてください。",
        )
      } else if (error.message.includes("No port selected")) {
        setPermissionError("ポートが選択されませんでした。")
      } else if (error.name === "NotAllowedError") {
        setPermissionError("シリアルポートへのアクセスが拒否されました。ブラウザの設定を確認してください。")
      } else {
        setPermissionError(`接続エラー: ${error.message}`)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  // データ読み取りの開始（日本語マルチバイト文字対応）
  const startReading = async (serialPort: SerialPort) => {
    const reader = serialPort.readable?.getReader()
    if (!reader) return

    readerRef.current = reader
    // UTF-8デコーダーを明示的に指定（日本語対応）
    const decoder = new TextDecoder("utf-8", {
      fatal: false, // エラー時に例外を投げない
      ignoreBOM: true, // BOMを無視
    })

    try {
      while (true) {
        const { value, done } = await reader.read()

        // ストリームが終了した場合の処理
        if (done) {
          console.log("シリアルストリームが終了しました")
          // 接続状態を更新
          setIsConnected(false)
          setPermissionError("シリアルポートとの接続が切断されました。")
          break
        }

        // データが存在する場合のみ処理
        if (value && value.length > 0) {
          // stream: true で部分的なマルチバイト文字も適切に処理
          const text = decoder.decode(value, { stream: true })

          // 受信したデータをそのまま表示（日本語文字も含む）
          if (text) {
            // 新しいデータを文字列の末尾に追加
            setReceivedData((prev) => prev + text)
            playReceiveSound()
          }
        }
      }
    } catch (error: any) {
      console.error("データ読み取りエラー:", error)

      // エラーの種類に応じた処理
      if (error.name === "NetworkError") {
        setPermissionError("ネットワークエラー: デバイスが切断された可能性があります。")
      } else if (error.name === "InvalidStateError") {
        setPermissionError("無効な状態: ポートが既に閉じられています。")
      } else if (error.name === "TypeError" && error.message.includes("decode")) {
        setPermissionError("文字エンコーディングエラー: 受信データの文字コードを確認してください。")
      } else {
        setPermissionError(`データ読み取り中にエラーが発生しました: ${error.message}`)
      }

      // 接続状態を更新
      setIsConnected(false)
    } finally {
      // 最後に残ったデータがあれば処理（マルチバイト文字の最終処理）
      try {
        const finalText = decoder.decode()
        if (finalText) {
          setReceivedData((prev) => prev + finalText)
        }
      } catch (finalError) {
        console.log("最終デコードエラー:", finalError)
      }

      // リーダーをクリア
      readerRef.current = null
    }
  }

  // シリアルポートから切断
  const disconnectFromSerial = async () => {
    try {
      if (demoMode) {
        stopDemoMode()
        return
      }

      if (readerRef.current) {
        await readerRef.current.cancel()
        readerRef.current = null
      }

      if (port) {
        await port.close()
        setPort(null)
      }

      setIsConnected(false)
      setPermissionError(null)
    } catch (error) {
      console.error("切断エラー:", error)
    }
  }

  // サウンドの切り替え
  const toggleSound = () => {
    const newSoundState = !soundEnabled
    console.log("サウンド切り替え:", soundEnabled, "→", newSoundState)
    setSoundEnabled(newSoundState)
  }

  if (!isSupported) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>ブラウザサポートエラー</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>このブラウザはWeb Serial APIをサポートしていません。</p>
            <p>
              <strong>対応ブラウザ:</strong> Chrome 89+, Edge 89+, Opera 75+
            </p>
            <p>
              <strong>必要な条件:</strong> HTTPS接続またはlocalhost
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {permissionError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>接続エラー</AlertTitle>
          <AlertDescription className="mt-2">{permissionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-gray-500" />}
            シリアルモニター
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="baudrate" className="text-sm font-medium">
                ボーレート:
              </label>
              <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={isConnected ? disconnectFromSerial : connectToSerial}
              variant={isConnected && !demoMode ? "destructive" : "default"}
              disabled={isConnecting}
            >
              {isConnecting ? "接続中..." : isConnected ? "切断" : "シリアルポート接続"}
            </Button>

            <Button
              onClick={demoMode ? stopDemoMode : startDemoMode}
              variant={demoMode ? "destructive" : "outline"}
              disabled={isConnected && !demoMode}
            >
              {demoMode ? "デモ停止" : "デモモード"}
            </Button>

            <Button
              onClick={toggleSound}
              variant="outline"
              size="sm"
              title={soundEnabled ? "音をミュート" : "音を有効化"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-blue-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-gray-400" />
              )}
            </Button>

            <Button
              onClick={toggleAutoScroll}
              variant="outline"
              size="sm"
              title={autoScroll ? "自動スクロールを停止" : "自動スクロールを開始"}
            >
              {autoScroll ? (
                <ArrowDown className="h-4 w-4 text-blue-500" />
              ) : (
                <Pause className="h-4 w-4 text-gray-400" />
              )}
            </Button>

            <Badge
              variant={isConnected ? (demoMode ? "secondary" : "default") : "secondary"}
              className={isConnected && !demoMode ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              {isConnected ? (demoMode ? "デモ中" : "接続中") : "未接続"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>受信データ</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant={autoScroll ? "default" : "secondary"}>
                {autoScroll ? "自動スクロール: ON" : "自動スクロール: OFF"}
              </Badge>
              <Button onClick={clearData} variant="outline" size="sm" disabled={receivedData.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                クリア
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea
            ref={scrollAreaRef}
            className="w-full border rounded-md p-4"
            style={{ height: "calc(100vh - 320px)" }}
          >
            {receivedData.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isConnected ? "データを待機中..." : "シリアルポートに接続してください"}
              </div>
            ) : (
              <div className="font-mono text-sm break-all whitespace-pre-wrap leading-relaxed">{receivedData}</div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
