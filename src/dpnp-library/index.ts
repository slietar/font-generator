/*
 * @dpnp/library
 * src/library.ts
 */


import {
  Byte,
  encodeRawString, decodeRawString,
  encodeRawZigZag, decodeRawZigZag
} from './util'


type ReadFunction = () => Byte
type WriteFunction = (byte: Byte) => void

type EncodeFunction<T> = (value: T, write: WriteFunction) => void
type DecodeFunction<T> = (read: ReadFunction) => T


/* Array */

/* export function encodeArray<T>(encodeItem: EncodeFunction<T>, arr: T[], write: WriteFunction) {
  if (arr === null) arr = []

  encodeVarint({ signed: false }, arr.length, write)

  for (let item of arr) {
    encodeItem(item, write)
  }
}

export function decodeArray<T>(decodeItem: DecodeFunction<T>, read: ReadFunction): T[] {
  let size = decodeVarint({ signed: false }, read)
  let output = new Array(size)

  for (let index = 0; index < size; index++) {
    output[index] = decodeItem(read)
  }

  return output
} */


export function encodeArray(encodeItem, input, write) {
  encodeFixedInt({ signed: false, size: 4 }, input.length, write);

  for (let item of input) {
    encodeItem(item, write);
  }
}

export function decodeArray(decodeItem, read) {
  let size = decodeFixedInt({ signed: false, size: 4 }, read);
  let output = new Array(size);

  for (let index = 0; index < size; index++) {
    output[index] = decodeItem(read);
  }

  return output;
}


/* Bool */

export function encodeBool(value: boolean, write: WriteFunction) {
  write(value ? 0x01 : 0x00)
}

export function decodeBool(read: ReadFunction): boolean {
  return (read() & 1) > 0
}


/* Composite */

interface CompositeOptions {
  minSize: number
  signed: boolean
}

export function encodeComposite({ minSize, signed }: CompositeOptions, input: number, write: WriteFunction): void {
  if (signed) {
    return encodeComposite({ minSize, signed: false }, encodeRawZigZag(input), write)
  }

  encodeFixedInt({ signed: false, size: minSize - 1 }, input, write)
  encodeVarint({ signed: false }, Math.floor(input / (2 ** (8 * (minSize - 1)))), write)
}

export function decodeComposite({ minSize, signed }: CompositeOptions, read: ReadFunction): number {
  if (signed) {
    return decodeRawZigZag(decodeComposite({ minSize, signed: false }, read))
  }

  let fixedPart = decodeFixedInt({ signed: false, size: minSize - 1 }, read)
  let varPart = decodeVarint({ signed: false }, read)

  return fixedPart + varPart * (2 ** (8 * (minSize - 1)))
}


/* Double */

export function encodeDouble(value: number, write: WriteFunction) {
  let buffer = new ArrayBuffer(8)
  let view = new DataView(buffer)

  view.setFloat64(0, value)

  for (let i = 0; i < 8; i++) {
    write(view.getUint8(7 - i))
  }
}

export function decodeDouble(read: ReadFunction): number {
  let buffer = new ArrayBuffer(8)
  let view = new DataView(buffer)

  for (let i = 0; i < 8; i++) {
    view.setUint8(i, read())
  }

  return view.getFloat64(0, true)
}


/* FixedInt */

interface FixedIntOptions {
  signed: boolean
  size: number
}

export function encodeFixedInt({ signed, size }: FixedIntOptions, input: number, write: WriteFunction) {
  if (signed) {
    input += Math.pow(2, size * 8 - 1)
  }

  for (let i = 0; i < size; i++) {
    let byte = input & 0xff
    input = (input - byte) / 256

    write(byte)
  }
}

export function decodeFixedInt({ signed, size }: FixedIntOptions, read: ReadFunction): number {
  let output = 0

  for (let i = 0; i < size; i++) {
    output += (read() & 0xff) * Math.pow(2, i * 8)
  }

  if (signed) {
    output -= Math.pow(2, size * 8 - 1)
  }

  return output
}


/* Float */

export function encodeFloat(value: number, write: WriteFunction) {
  let buffer = new ArrayBuffer(4)
  let view = new DataView(buffer)

  view.setFloat32(0, value)

  for (let i = 0; i < 4; i++) {
    write(view.getUint8(3 - i))
  }
}

export function decodeFloat(read: ReadFunction): number {
  let buffer = new ArrayBuffer(4)
  let view = new DataView(buffer)

  for (let i = 0; i < 4; i++) {
    view.setUint8(i, read())
  }

  return view.getFloat32(0, true)
}


/* Finite string */

export function encodeFiniteString(str: string, write: WriteFunction) {
  if (str !== null) {
    for (let byte of encodeRawString(str)) {
      write(byte)
    }
  }

  write(0x00)
}

export function decodeFiniteString(read: ReadFunction): string {
  let bytes: Byte[] = []
  let byte: Byte

  while ((byte = read()) !== 0x00) {
    bytes.push(byte)
  }

  return decodeRawString(bytes)
}


/* String */

export function encodeString(str: string, write: WriteFunction) {
  if (str === null) str = ''

  encodeVarint({ signed: false }, str.length, write)

  for (let byte of encodeRawString(str)) {
    write(byte)
  }
}

export function decodeString(read: ReadFunction): string {
  let size = decodeVarint({ signed: false }, read)
  let bytes: Byte[] = []

  while (size > 0) {
    bytes.push(read())
    size--
  }

  return decodeRawString(bytes)
}


/* Varint */

interface VarintOptions {
  signed: boolean
}

export function encodeVarint({ signed }: VarintOptions, input: number, write: WriteFunction): void {
  if (signed) {
    return encodeVarint({ signed: false }, encodeRawZigZag(input), write)
  }

  let last = -1

  while (input > 0) {
    if (last >= 0) write(last + 0b10000000)
    last = input & 0b01111111
    input = Math.floor(input / 2 ** 7)
  }

  write(Math.max(last, 0))
}

export function decodeVarint({ signed }: VarintOptions, read: ReadFunction): number {
  if (signed) {
    return decodeRawZigZag(decodeVarint({ signed: false }, read))
  }

  let byte: Byte
  let output = 0
  let index = 0

  do {
    byte = read()
    output += (byte & 0b01111111) * (2 ** (7 * index))
    index++
  } while ((byte & 0b10000000) !== 0)

  return output
}


/* from bytes */

export function encodeRootFromBytes<T>(encodeRoot: EncodeFunction<T>, input: T): Byte[] {
  let bytes: Byte[] = []
  let write: WriteFunction = (byte: Byte) => {
    bytes.push(byte)
  }

  encodeRoot(input, write)

  return bytes
}

export function decodeRootFromBytes<T>(decodeRoot: DecodeFunction<T>, input: Byte[]): T {
  let index = 0
  let read: ReadFunction = () => input[index++]

  return decodeRoot(read)
}
