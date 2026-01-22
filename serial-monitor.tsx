"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Wifi, WifiOff, Volume2, VolumeX, AlertTriangle, ArrowDown, Pause, Moon, Sun } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTheme } from "next-themes"

export default function SerialMonitor() {
  const [port, setPort] = useState<SerialPort | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [baudRate, setBaudRate] = useState("115200")
  const [customBaudRate, setCustomBaudRate] = useState("")
  const [isCustomBaudRate, setIsCustomBaudRate] = useState(false)
  const [receivedData, setReceivedData] = useState<string>("")
  const [isSupported, setIsSupported] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoInterval, setDemoInterval] = useState<NodeJS.Timeout | null>(null)
  const { theme, setTheme } = useTheme()

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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleBaudRateChange = (value: string) => {
    if (value === "custom") {
      setIsCustomBaudRate(true)
      setBaudRate(customBaudRate || "9600")
    } else {
      setIsCustomBaudRate(false)
      setBaudRate(value)
    }
  }

  const handleCustomBaudRateChange = (value: string) => {
    // 数字のみを許可
    const numericValue = value.replace(/[^0-9]/g, "")
    setCustomBaudRate(numericValue)
    if (isCustomBaudRate) {
      setBaudRate(numericValue)
    }
  }

  const getEffectiveBaudRate = () => {
    return isCustomBaudRate ? customBaudRate : baudRate
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
          "Temperature: 23.5°C",
          "Humidity: 65%",
          "Pressure: 1013.25 hPa",
          "Light: 450 lux",
          "Motion detected",
          "Battery: 85%",
          "Signal strength: -45 dBm",
          "GPS Data:\nLatitude: 35.6762\nLongitude: 139.6503\nAltitude: 40m",
          "Sensor Status:\n- Temperature: OK\n- Humidity: OK\n- Pressure: ERROR",
          "Multi-line Log:\nINFO: System started\nWARN: Low battery\nERROR: Sensor disconnected",
          'JSON Data:\n{\n  "temperature": 25.3,\n  "humidity": 60,\n  "status": "normal"\n}',
          "Command Response:\n> status\nSystem: Running\nUptime: 1d 5h 23m\n> ",
          "Japanese Test: こんにちは世界！\nKanji, Hiragana, Katakana, ABC123",
          "Multi-byte Test:\n🌡️ Temperature Sensor\n💧 Humidity Sensor\n🔋 Battery Status",
          "Error Message:\nError Code: E001\nDetails: Communication timeout occurred\nSolution: Please reconnect the device",
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
        throw new Error("This browser does not support Web Serial API")
      }

      const effectiveBaudRate = getEffectiveBaudRate()
      const baudRateNumber = Number.parseInt(effectiveBaudRate)

      if (isNaN(baudRateNumber) || baudRateNumber <= 0) {
        throw new Error("Invalid baud rate. Please enter a valid positive number.")
      }

      const selectedPort = await navigator.serial.requestPort()
      await selectedPort.open({
        baudRate: baudRateNumber,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      })

      setPort(selectedPort)
      setIsConnected(true)

      // データ読み取りの開始
      startReading(selectedPort)
    } catch (error: any) {
      console.error("Failed to connect to serial port:", error)

      if (error.message.includes("permissions policy") || error.message.includes("disallowed by permissions policy")) {
        setPermissionError(
          "Web Serial API is restricted in preview environment. To use this feature, please download the code and deploy to local environment or Cloudflare Pages.",
        )
      } else if (error.message.includes("No port selected")) {
        setPermissionError("No port was selected.")
      } else if (error.name === "NotAllowedError") {
        setPermissionError("Access to serial port was denied. Please check your browser settings.")
      } else {
        setPermissionError(`Connection error: ${error.message}`)
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
          console.log("Serial stream ended")
          // 接続状態を更新
          setIsConnected(false)
          setPermissionError("Serial port connection was disconnected.")
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
      console.error("Data reading error:", error)

      // エラーの種類に応じた処理
      if (error.name === "NetworkError") {
        setPermissionError("Network error: Device may have been disconnected.")
      } else if (error.name === "InvalidStateError") {
        setPermissionError("Invalid state: Port is already closed.")
      } else if (error.name === "TypeError" && error.message.includes("decode")) {
        setPermissionError("Character encoding error: Please check the character encoding of received data.")
      } else {
        setPermissionError(`Error occurred while reading data: ${error.message}`)
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
        console.log("Final decode error:", finalError)
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
      console.error("Disconnect error:", error)
    }
  }

  // サウンドの切り替え
  const toggleSound = () => {
    const newSoundState = !soundEnabled
    console.log("Sound toggle:", soundEnabled, "→", newSoundState)
    setSoundEnabled(newSoundState)
  }

  if (!isSupported) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Browser Support Error</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>This browser does not support Web Serial API.</p>
            <p>
              <strong>Supported browsers:</strong> Chrome 89+, Edge 89+, Opera 75+
            </p>
            <p>
              <strong>Requirements:</strong> HTTPS connection or localhost
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
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="mt-2">{permissionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-gray-500" />}
            Serial Port Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="baudrate" className="text-sm font-medium">
                Baud Rate:
              </Label>
              {!isCustomBaudRate ? (
                <Select value={baudRate} onValueChange={handleBaudRateChange} disabled={isConnected}>
                  <SelectTrigger className="w-32" aria-label="Select Baud Rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">300</SelectItem>
                    <SelectItem value="600">600</SelectItem>
                    <SelectItem value="1200">1200</SelectItem>
                    <SelectItem value="2400">2400</SelectItem>
                    <SelectItem value="4800">4800</SelectItem>
                    <SelectItem value="9600">9600</SelectItem>
                    <SelectItem value="14400">14400</SelectItem>
                    <SelectItem value="19200">19200</SelectItem>
                    <SelectItem value="28800">28800</SelectItem>
                    <SelectItem value="38400">38400</SelectItem>
                    <SelectItem value="57600">57600</SelectItem>
                    <SelectItem value="115200">115200</SelectItem>
                    <SelectItem value="230400">230400</SelectItem>
                    <SelectItem value="460800">460800</SelectItem>
                    <SelectItem value="921600">921600</SelectItem>
                    <SelectItem value="1000000">1000000</SelectItem>
                    <SelectItem value="2000000">2000000</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={customBaudRate}
                    onChange={(e) => handleCustomBaudRateChange(e.target.value)}
                    placeholder="Enter baud rate"
                    className="w-32"
                    disabled={isConnected}
                  />
                  <Button
                    onClick={() => {
                      setIsCustomBaudRate(false)
                      setBaudRate("115200")
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isConnected}
                  >
                    Preset
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={isConnected ? disconnectFromSerial : connectToSerial}
              variant={isConnected && !demoMode ? "destructive" : "default"}
              disabled={isConnecting || (isCustomBaudRate && !customBaudRate)}
            >
              {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect Serial Port"}
            </Button>

            <Button
              onClick={demoMode ? stopDemoMode : startDemoMode}
              variant={demoMode ? "destructive" : "outline"}
              disabled={isConnected && !demoMode}
            >
              {demoMode ? "Stop Demo" : "Demo Mode"}
            </Button>

            <Button
              onClick={toggleSound}
              variant="outline"
              size="sm"
              title={soundEnabled ? "Mute sound" : "Enable sound"}
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
              title={autoScroll ? "Stop auto scroll" : "Start auto scroll"}
            >
              {autoScroll ? (
                <ArrowDown className="h-4 w-4 text-blue-500" />
              ) : (
                <Pause className="h-4 w-4 text-gray-400" />
              )}
            </Button>

            <Button onClick={toggleTheme} variant="outline" size="sm" title="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Badge
              variant={isConnected ? (demoMode ? "secondary" : "default") : "secondary"}
              className={isConnected && !demoMode ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              {isConnected ? (demoMode ? "Demo Mode" : "Connected") : "Disconnected"}
            </Badge>

            {isCustomBaudRate && customBaudRate && <Badge variant="outline">Custom: {customBaudRate} bps</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Received Data</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant={autoScroll ? "default" : "secondary"}>
                {autoScroll ? "Auto Scroll: ON" : "Auto Scroll: OFF"}
              </Badge>
              <Button onClick={clearData} variant="outline" size="sm" disabled={receivedData.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
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
                {isConnected ? "Waiting for data..." : "Please connect to a serial port"}
              </div>
            ) : (
              <div className="font-mono text-sm break-all whitespace-pre-wrap leading-relaxed text-black-500 dark:text-green-400">
                {receivedData}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
