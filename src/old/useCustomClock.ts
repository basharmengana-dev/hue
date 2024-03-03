import { useRef, useEffect, useState } from 'react'

/**
 * Custom useClock hook to control tick rate.
 * @param ticksPerSecond - How many times the clock should tick per second.
 * @returns Current time in milliseconds.
 */
const useCustomClock = (ticksPerSecond: number): { value: number } => {
  const requestRef = useRef<number>()
  const previousTimeRef = useRef<number>()
  const [time, setTime] = useState<number>(Date.now())

  const animate = (timeNow: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = timeNow - previousTimeRef.current
      const interval = 1000 / ticksPerSecond

      if (deltaTime > interval) {
        setTime(timeNow)
        previousTimeRef.current = timeNow - (deltaTime % interval)
      }
    } else {
      previousTimeRef.current = timeNow
    }

    requestRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [ticksPerSecond])

  return { value: time }
}

export default useCustomClock
