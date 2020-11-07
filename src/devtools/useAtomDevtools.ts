import { useEffect, useRef } from 'react'
import { useAtom, WritableAtom } from 'jotai'

import type { SetStateAction } from '../core/types'

export function useAtomDevtools<Value>(
  anAtom: WritableAtom<Value, SetStateAction<Value>>,
  name = anAtom.debugLabel
) {
  let extension: any
  try {
    extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__
  } catch {}
  if (!extension) {
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      console.warn('Please install/enable Redux devtools extension')
    }
  }

  const [value, setValue] = useAtom(anAtom)
  const lastValue = useRef(value)
  const isTimeTraveling = useRef(false)
  const devtools = useRef<any>()

  useEffect(() => {
    if (extension) {
      const name = `${name}:${anAtom.key}`
      devtools.current = extension.connect({ name })
      const unsubscribe = devtools.current.subscribe((message: any) => {
        if (message.type === 'DISPATCH' && message.state) {
          if (
            message.payload.type === 'JUMP_TO_ACTION' ||
            message.payload.type === 'JUMP_TO_STATE'
          ) {
            isTimeTraveling.current = true
          }
          setValue(JSON.parse(message.state))
        } else if (
          message.type === 'DISPATCH' &&
          message.payload?.type === 'COMMIT'
        ) {
          devtools.current.init(lastValue.current)
        }
      })
      devtools.current.shouldInit = true
      return unsubscribe
    }
  }, [anAtom, extension, setValue])

  useEffect(() => {
    if (devtools.current) {
      lastValue.current = value
      if (devtools.current.shouldInit) {
        devtools.current.init(value)
        devtools.current.shouldInit = false
      } else if (isTimeTraveling.current) {
        isTimeTraveling.current = false
      } else {
        devtools.current.send(
            `${anAtom.debugLabel} - ${new Date().toLocaleString()}`,
            value,
        )
      }
    }
  }, [anAtom, extension, value])
}
