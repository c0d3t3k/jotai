import { useEffect, useRef, useMemo } from 'react'
import { useAtom, WritableAtom, Atom, atom } from 'jotai'

type Config = {
  instanceID?: number
  name?: string
  serialize?: boolean
  actionCreators?: any
  latency?: number
  predicate?: any
  autoPause?: boolean
}

type Message = {
  type: string
  payload?: any
  state?: any
}

type ConnectionResult = {
  subscribe: (dispatch: any) => () => void
  unsubscribe: () => void
  send: (action: string, state: any) => void
  init: (state: any) => void
  error: (payload: any) => void
}

type Extension = {
  connect: (options?: Config) => ConnectionResult
}


export function useDiscardAtom<Value>(readOnlyAtom: Atom<Value>): WritableAtom<Value, Value> {
    return useMemo(() => atom(
        get => get(readOnlyAtom),
        (_get, _set, _argIgnored: { count: number }) => {} // discard write function
    ), [readOnlyAtom])
}

export function useAtomDevtools<Value>(
  anAtom: WritableAtom<Value, Value> | Atom<Value>,
  name?: string
) {
  let extension: Extension | undefined
  try {
    extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__ as Extension
  } catch {}
  if (!extension) {
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      console.warn('Please install/enable Redux devtools extension')
    }
  }

  const [value, setValue] = useAtom(anAtom as WritableAtom<Value, Value>)
  const lastValue = useRef(value)
  const isTimeTraveling = useRef(false)
  const devtools = useRef<ConnectionResult & { shouldInit?: boolean }>()

  const atomName =
    name || `${anAtom.key}:${anAtom.debugLabel ?? '<no debugLabel>'}`

  useEffect(() => {
    if (extension) {
      devtools.current = extension.connect({ name: atomName })
      const unsubscribe = devtools.current.subscribe((message: Message) => {
        if (message.type === 'DISPATCH' && message.state) {
          if (
            message.payload?.type === 'JUMP_TO_ACTION' ||
            message.payload?.type === 'JUMP_TO_STATE'
          ) {
            isTimeTraveling.current = true
          }
          if((anAtom as any).write) {
            setValue(JSON.parse(message.state).value)
          }
        } else if (
          message.type === 'DISPATCH' &&
          message.payload?.type === 'COMMIT'
        ) {
          devtools.current?.init(lastValue.current)
        }
      })
      devtools.current.shouldInit = true
      return unsubscribe
    }
  }, [anAtom, extension, atomName, setValue])

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
          `${atomName} - ${new Date().toLocaleString()}`,
          { 
            value: value
          }
        )
      }
    }
  }, [anAtom, extension, atomName, value])
}
