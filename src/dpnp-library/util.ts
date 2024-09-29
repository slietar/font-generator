export type Byte = number


export function encodeRawString(str: string): Byte[] {
  let utf8 = unescape(encodeURIComponent(str))
  let bytes: Byte[] = []

  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i))
  }

  return bytes
}

export function decodeRawString(bytes: Byte[]): string {
  return decodeURIComponent(escape(String.fromCharCode(...bytes)))
}


export function encodeRawZigZag(value: number): number {
  return value >= 0
    ? value * 2
    : (-value) * 2 - 1
}

export function decodeRawZigZag(input: number): number {
  return input % 2 === 0
    ? input / 2
    : -(input + 1) / 2
}
