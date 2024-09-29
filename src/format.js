import * as lib from './dpnp-library';


export function decode(buffer) {
  let view = new DataView(buffer);

  let read = () => {
    let byte = view.getUint8(read.pointer);
    read.pointer += 1;
    return byte;
  };

  read.buffer = buffer;
  read.pointer = 0;
  read.view = view;

  return _decodeStoredData(read);
}


function _decodeStoredData(read) {
  return {
    fonts: lib.decodeArray(_decodeStoredFont, read),
    control: lib.decodeArray(_decodeGlyphControl, read),
  };
}


function _decodeStoredFont(read) {
  return {
    glyphs: lib.decodeArray(_decodeGlyph, read),
    name: lib.decodeFiniteString(read),
    ascent: lib.decodeFloat(read),
    descent: lib.decodeFloat(read),
    coefficient: lib.decodeFloat(read)
  };
}


function _decodeGlyphControl(read) {
  return {
    character: _decodeChar(read),
    name: lib.decodeFiniteString(read),
    unicode: lib.decodeFixedInt({ signed: false, size: 4 }, read),
    alternates: lib.decodeArray(lib.decodeArray.bind(void 0, lib.decodeFixedInt.bind(void 0, { signed: false, size: 4 })), read),
    control: lib.decodeArray(lib.decodeArray.bind(void 0, lib.decodeArray.bind(void 0, lib.decodeFloat)), read)
  };
}


function _decodeGlyph(read) {
  return {
    paths: lib.decodeArray(_decodePath, read),
    advance: lib.decodeFloat(read),
    xBearing: lib.decodeFloat(read)
  };
}


function _decodePath(read) {
  return {
    curves: lib.decodeArray(_decodeCurve, read),
    start: _decodePoint(read)
  };
}


function _decodePoint(read) {
  return {
    x: lib.decodeFloat(read),
    y: lib.decodeFloat(read)
  };
}


function _decodeChar(read) {
  let bytes = [];

  for (let index = 0; index < 4; index++) {
    let byte = read();

    if (index === 0 || byte !== 0x00) {
      bytes.push(byte);
    }
  }

  return String.fromCodePoint(...bytes);
}


function _decodeCurve(read) {
  let type = read();

  switch (type) {
    case 0x00: return {
      type,
      end: _decodePoint(read)
    };

    case 0x01: return {
      type,
      end: _decodePoint(read),
      control: _decodePoint(read)
    };
  }
}
