interface ReadFunction {
  (): number
  buffer: ArrayBuffer
  pointer: number
  view: DataView
}


/* Array */

export function decodeArray(decodeItem, read) {
  let size = decodeFixedInt({ signed: false, size: 4 }, read);
  let output = new Array(size);

  for (let index = 0; index < size; index++) {
    output[index] = decodeItem(read);
  }

  return output;
}


/* FixedInt */

interface FixedIntOptions {
  signed: boolean
  size: number
}

export function decodeFixedInt({ signed, size }: FixedIntOptions, read: ReadFunction): number {
  let value = read.view.getUint32(read.pointer, true);
  read.pointer += 4;

  return value;
}


/* Float */

export function decodeFloat(read: ReadFunction): number {
  let value = read.view.getFloat32(read.pointer, true);
  read.pointer += 4;

  return value;
}


/* Finite string */

let decoder = new TextDecoder();

export function decodeFiniteString(read: ReadFunction): string {
  let length = new Uint8Array(read.buffer, read.pointer).findIndex((byte) => byte === 0x00);
  let value = decoder.decode(new Uint8Array(read.buffer, read.pointer, length));

  read.pointer += length + 1;

  return value;
}
