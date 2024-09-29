import * as lib from './dpnp-library';


export function encode(input) {
  let bytes = [];
  let write = (byte) => {
    bytes.push(byte);
  };

  _encodeStoredData(input, write);

  return bytes;

  // return lib.encodeRootFromBytes(_encodeStoredData, input);
}

export function decode(view) {
  // let view = new Uint8Array(buffer);

  let index = 0;
  let read = () => {
    if (index < view.length) return view[index++];
    else throw new Error('Unexpected EOF');
  };

  return _decodeStoredData(read);

  // return lib.decodeRootFromBytes(_decodeStoredData, new Uint8Array(buffer));
}


function _encodeStoredData(input, write) {
  lib.encodeArray(_encodeStoredFont, input.fonts, write);
  lib.encodeArray(_encodeGlyphControl, input.control, write);
}

function _decodeStoredData(read) {
  return {
    fonts: lib.decodeArray(_decodeStoredFont, read),
    control: lib.decodeArray(_decodeGlyphControl, read),
  };
}


function _encodeStoredFont(input, write) {
  lib.encodeArray(_encodeGlyph, input.glyphs, write);
  lib.encodeFiniteString(input.name, write);
  lib.encodeFloat(input.ascent, write);
  lib.encodeFloat(input.descent, write);
  lib.encodeFloat(input.coefficient, write);
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


function _encodeGlyphControl(input, write) {
  _encodeChar(input.character, write);
  lib.encodeFiniteString(input.name, write);
  lib.encodeFixedInt({ signed: false, size: 4 }, input.unicode, write);
  lib.encodeArray(lib.encodeArray.bind(void 0, lib.encodeFixedInt.bind(void 0, { signed: false, size: 4 })), input.alternates, write);
  lib.encodeArray(lib.encodeArray.bind(void 0, lib.encodeArray.bind(void 0, lib.encodeFloat)), input.control, write);
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


function _encodeGlyph(input, write) {
  lib.encodeArray(_encodePath, input.paths, write);
  lib.encodeFloat(input.advance, write);
  lib.encodeFloat(input.xBearing, write);
}

function _decodeGlyph(read) {
  return {
    paths: lib.decodeArray(_decodePath, read),
    advance: lib.decodeFloat(read),
    xBearing: lib.decodeFloat(read)
  };
}


function _encodePath(input, write) {
  lib.encodeArray(_encodeCurve, input.curves, write);
  _encodePoint(input.start, write);
}

function _decodePath(read) {
  return {
    curves: lib.decodeArray(_decodeCurve, read),
    start: _decodePoint(read)
  };
}


function _encodePoint(input, write) {
  lib.encodeFloat(input.x, write);
  lib.encodeFloat(input.y, write);
}

function _decodePoint(read) {
  return {
    x: lib.decodeFloat(read),
    y: lib.decodeFloat(read)
  };
}


function _encodeChar(input, write) {
  let encoder = new TextEncoder('utf-8').encode(input);

  for (let index = 0; index < 4; index++) {
    let byte = encoder[index] || 0x00;

    write(byte);
  }
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


function _encodeCurve(input, write) {
  if (input.control === void 0) {
    write(0x00);
    _encodePoint(input.end, write);
  } else {
    write(0x01);
    _encodePoint(input.end, write);
    _encodePoint(input.control, write);
  }
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
