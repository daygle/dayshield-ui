import { useRef, useEffect } from 'react'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  width?: number
}

export default function Sparkline({
  data,
  color = '#3b82f6',
  height = 40,
  width = 120,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    if (data.length < 2) return

    const max = Math.max(...data, 1)
    const step = width / (data.length - 1)

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    data.forEach((val, i) => {
      const x = i * step
      const y = height - (val / max) * (height - 4) - 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })

    ctx.stroke()

    // fill area under line
    ctx.lineTo((data.length - 1) * step, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.globalAlpha = 0.13
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
  }, [data, color, height, width])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
    />
  )
}
