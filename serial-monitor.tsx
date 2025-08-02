"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Trash2, Wifi, WifiOff, Volume2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ReceivedData {
  id: number
  data: string
  timestamp: Date
}

export default function SerialMonitor() {
  const [port, setPort] = useState<SerialPort | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [baudRate, setBaudRate] = useState("9600")
  const [receivedData, setReceivedData] = useState<ReceivedData[]>([])
  const [isSupported, setIsSupported] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoInterval, setDemoInterval] = useState<NodeJS.Timeout | null>(null)

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

  // 受信音を鳴らす関数
  const playReceiveSound = async () => {
    if (!soundEnabled || !audioContextRef.current) return

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
    } catch (error) {
      console.log("Sound playback failed:", error)
    }
  }

  const startDemoMode = () => {
    setDemoMode(true)
    setIsConnected(true)

    const interval = setInterval(
      () => {
        const sampleData = [
          "Temperature: 23.5°C",
          "Humidity: 65%",
          "Pressure: 1013.25 hPa",
          "Light: 450 lux",
          "Motion detected",
          "Battery: 85%",
          "Signal strength: -45 dBm",
          "GPS Data:\nLat: 35.6762\nLon: 139.6503\nAlt: 40m",
          "Sensor Status:\n- Temperature: OK\n- Humidity: OK\n- Pressure: FAIL",
          "Multi-line log:\nINFO: System started\nWARN: Low battery\nERROR: Sensor disconnected",
          'JSON Data:\n{\n  "temp": 25.3,\n  "humidity": 60,\n  "status": "ok"\n}',
          "Command Response:\n> status\nSystem: Running\nUptime: 1d 5h 23m\n> ",
        ]

        const randomData = sampleData[Math.floor(Math.random() * sampleData.length)]
        const newData: ReceivedData = {
          id: Date.now() + Math.random(),
          data: randomData,
          timestamp: new Date(),
        }

        // 新しいデータを配列の先頭に追加
        setReceivedData((prev) => [newData, ...prev])
        playReceiveSound()
      },
      2000 + Math.random() * 3000,
    ) // Random interval between 2-5 seconds

    setDemoInterval(interval)
  }

  const stopDemoMode = () => {
    setDemoMode(false)
    setIsConnected(false)
    if (demoInterval) {
      clearInterval(demoInterval)
      setDemoInterval(null)
    }
  }

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

  // データ読み取りの開始
  const startReading = async (serialPort: SerialPort) => {
    const reader = serialPort.readable?.getReader()
    if (!reader) return

    readerRef.current = reader
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })

        // 受信したデータをそのまま表示（改行文字での分割なし）
        if (text) {
          const newData: ReceivedData = {
            id: Date.now() + Math.random(),
            data: text,
            timestamp: new Date(),
          }

          // 新しいデータを配列の先頭に追加
          setReceivedData((prev) => [newData, ...prev])
          playReceiveSound()
        }
      }
    } catch (error) {
      console.error("データ読み取りエラー:", error)
      if (isConnected) {
        setPermissionError("データ読み取り中にエラーが発生しました。")
      }
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

  // 受信データをクリア
  const clearData = () => {
    setReceivedData([])
  }

  // 時刻フォーマット
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ja-JP", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    })
  }

  // 日付フォーマット
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  // 日付と時刻を組み合わせたフォーマット
  const formatDateTime = (date: Date) => {
    return `${formatDate(date)} ${formatTime(date)}`
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

            <Button onClick={() => setSoundEnabled(!soundEnabled)} variant="outline" size="sm">
              <Volume2 className={`h-4 w-4 ${soundEnabled ? "text-blue-500" : "text-gray-400"}`} />
            </Button>

            <Badge variant={isConnected ? (demoMode ? "secondary" : "default") : "secondary"}>
              {isConnected ? (demoMode ? "デモ中" : "接続中") : "未接続"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>受信データ（{receivedData.length}件）</CardTitle>
            </div>
            <Button onClick={clearData} variant="outline" size="sm" disabled={receivedData.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              クリア
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full border rounded-md p-4">
            {receivedData.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isConnected ? "データを待機中..." : "シリアルポートに接続してください"}
              </div>
            ) : (
              <div className="space-y-4">
                {receivedData.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm break-all whitespace-pre-wrap">{item.data}</div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">受信日時:</span>
                            <span>{formatDateTime(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < receivedData.length - 1 && <Separator className="my-1" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
