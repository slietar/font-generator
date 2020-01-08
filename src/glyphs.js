// import * as opentype from 'opentype.js';


export class Font {
  constructor(glyphs, options) {
    this.glyphs = glyphs;

    this.ascent = options.ascent;
    this.descent = options.descent;

    this.coefficient = options.coefficient;
    this.name = options.name;
  }

  exportToOpentype() {
    let notdefGlyph = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 650,
      path: new opentype.Path()
    });

    let glyphs = this.glyphs.map((glyph) => glyph.exportToOpentype());

    /* let c = document.createElement('canvas');
    c.width = 500;
    c.height = 500;
    document.body.appendChild(c);

    glyphs[0].draw(c.getContext('2d'), 0, 500, 20);
    console.log(glyphs[0].path)

    return; */

    return new opentype.Font({
      familyName: this.name,
      styleName: 'Medium',
      unitsPerEm: 2048,
      ascender: Math.round(this.ascent * 2048),
      descender: Math.round(this.descent * 2048),
      glyphs: [notdefGlyph, ...glyphs]
    });
  }
}

export class Glyph {
  constructor(paths, options) {
    this.paths = paths;

    this.character = options.character;
    this.name = options.name,
    this.unicode = options.unicode;

    this.advance = options.advance;
    this.xBearing = options.xBearing;
  }

  exportToOpentype() {
    let opentypePath = new opentype.Path();

    for (let path of this.paths) {
      path.exportToPath(opentypePath, 2048);
    }

    return new opentype.Glyph({
      name: this.name,
      unicode: this.unicode,
      advanceWidth: Math.round(this.advance * 2048),
      path: opentypePath
    });
  }

  exportToSVG() {
    let data = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="2048" height="2048">\n';

    for (let path of this.paths) {
      data += `<path d="${path.exportToSVG(2048)}" />\n`;
    }

    data += '</svg>';

    return data;
  }


  getMinX() {
    return Math.min(...this.paths.map((path) => path.getMinX()));
  }

  getMaxX() {
    return Math.max(...this.paths.map((path) => path.getMaxX()));
  }

  getMinY() {
    return Math.min(...this.paths.map((path) => path.getMinY()));
  }

  getMaxY() {
    return Math.max(...this.paths.map((path) => path.getMaxY()));
  }
}


export class Path {
  constructor(curves) {
    this.curves = curves;
    this.start = curves[0].start;
  }

  area() {
    let doubleArea = 0;

    for (let curve of this.curves) {
      doubleArea += (curve.end.x - curve.start.x) * (curve.end.y + curve.start.y);
    }

    return doubleArea / 2;
  }

  isClockwise() {
    return this.area() > 0;
  }

  curveAtPos(t) {
    let targetLength = t * this.length();
    let addedLength = 0;

    for (let curve of this.curves) {
      let curveLength = curve.length();
      let relT = (targetLength - addedLength) / curveLength;

      if (relT < 1) {
        return [curve, relT];
      }

      addedLength += curveLength;
    }

    return null;
  }

  posAtCurve(targetCurve, relT) {
    return (relT * targetCurve.length() + this.curves
      .slice(0, this.curves.indexOf(targetCurve))
      .reduce((sum, curve) => sum + curve.length(), 0)) / this.length();
  }

  distance(a, b) {
    return a <= b
      ? this.lengthTo(b) - this.lengthTo(a)
      : this.length() - this.distance(b, a);
  }

  length() {
    if (this._length === void 0) {
      this._length = this.curves.reduce((sum, curve) => sum + curve.length(), 0);
    }

    return this._length;
  }

  lengthTo(t) {
    if (t === 1) {
      return this.length();
    }

    let [curve, relT] = this.curveAtPos(t);

    return curve.length() * relT + this.curves
      .slice(0, this.curves.indexOf(curve))
      .reduce((sum, curve) => sum + curve.length(), 0);
  }

  exportToPath(path, coefficient) {
    path.moveTo(
      Math.round(this.start.x * coefficient), Math.round(this.start.y * coefficient)
    );

    for (let curve of this.curves) {
      curve.exportToPath(path, coefficient);
    }
  }

  exportToSVG(coefficient) {
    let Math = { round: (x) => x };

    let data = `M${Math.round(this.start.x * coefficient)}, ${Math.round(this.start.y * coefficient)}`;

    for (let curve of this.curves) {
      data += curve.exportToSVG(coefficient) + ' ';
    }

    return data;
  }


  getMinX() {
    return Math.min(...this.curves.map((curve) => curve.getMinX()));
  }

  getMaxX() {
    return Math.max(...this.curves.map((curve) => curve.getMaxX()));
  }

  getMinY() {
    return Math.min(...this.curves.map((curve) => curve.getMinY()));
  }

  getMaxY() {
    return Math.max(...this.curves.map((curve) => curve.getMaxY()));
  }
}


class Curve {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  nearestPositionToPoint(point) {
    return [
      this.end.sub(this.start).normalizeSquare().dot(point.sub(this.start)),
      point.distanceToLine(this.end, this.start)
    ];
  }
}

export class BezierQuadratic extends Curve {
  constructor(start, end, control) {
    super(start, end);
    this.type = 'BezierQuadratic';

    this.control = control;
  }

  func(t) {
    return this.start.mul((1 - t) ** 2)
      .add(this.control.mul(2 * t * (1 - t)))
      .add(this.end.mul(t ** 2));
  }

  derivative(t) {
    return this.control.sub(this.start).mul(2 * (1 - t)).add(this.end.sub(this.control).mul(2 * t));
  }

  length() {
    if (this._length === void 0) {
      this._length = bezierQuadraticLength(
        this.start.x, this.start.y,
        this.end.x, this.end.y,
        this.control.x, this.control.y
      );
    }

    return this._length;
  }

  exportToPath(path, coefficient) {
    path.quadraticCurveTo(
      Math.round(this.control.x * coefficient), Math.round(this.control.y * coefficient),
      Math.round(this.end.x * coefficient), Math.round(this.end.y * coefficient)
    );
  }

  exportToSVG(coefficient) {
    let Math = { round: (x) => x };
    return `Q${Math.round(this.control.x * coefficient)}, ${Math.round(this.control.y * coefficient)}, ${Math.round(this.end.x * coefficient)}, ${Math.round(this.end.y * coefficient)}`;
  }


  getMinX() {
    // simplified
    return Math.min(this.start.x, this.end.x, this.control.x);
  }

  getMaxX() {
    return Math.max(this.start.x, this.end.x, this.control.x);
  }

  getMinY() {
    return Math.min(this.start.y, this.end.y, this.control.y);
  }

  getMaxY() {
    return Math.max(this.start.y, this.end.y, this.control.y);
  }
}

export class Line extends Curve {
  constructor(start, end) {
    super(start, end);
    this.type = 'Line';
  }

  func(t) {
    return this.start.mul(1 - t).add(this.end.mul(t));
  }

  derivative(t) {
    return this.end.sub(this.start);
  }

  length() {
    return this.end.sub(this.start).length();
  }

  exportToPath(path, coefficient) {
    path.lineTo(
      Math.round(this.end.x * coefficient), Math.round(this.end.y * coefficient)
    );
  }

  exportToSVG(coefficient) {
    let Math = { round: (x) => x };
    return `L${Math.round(this.end.x * coefficient)}, ${Math.round(this.end.y * coefficient)}`;
  }


  getMinX() {
    return Math.min(this.start.x, this.end.x);
  }

  getMaxX() {
    return Math.max(this.start.x, this.end.x);
  }

  getMinY() {
    return Math.min(this.start.y, this.end.y);
  }

  getMaxY() {
    return Math.max(this.start.y, this.end.y);
  }
}


function bezierQuadraticLength(
  startX, startY,
  endX, endY,
  controlX, controlY,
  iterationsLeft = 3
) {
  if (iterationsLeft >= 1) {
    let middleLeftX = (startX + controlX) / 2;
    let middleLeftY = (startY + controlY) / 2;

    let middleRightX = (controlX + endX) / 2;
    let middleRightY = (controlY + endY) / 2;

    let middleX = (middleLeftX + middleRightX) / 2;
    let middleY = (middleLeftY + middleRightY) / 2;

    return bezierQuadraticLength(
      startX, startY,
      middleX, middleY,
      middleLeftX, middleLeftY,
      iterationsLeft - 1)
      + bezierQuadraticLength(
        middleX, middleY,
        endX, endY,
        middleRightX, middleRightY,
        iterationsLeft - 1);
  }

  let distance = (ax, ay, bx, by) => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

  let chord = distance(startX, startY, endX, endY);
  let contour = distance(controlX, controlY, startX, startY) + distance(endX, endY, controlX, controlY);

  return (chord + contour) / 2;
}

  /* function bezierQuadraticLength(start, end, control, iterationsLeft = 2) {
  if (iterationsLeft >= 1) {
    let middleLeft = start.add(control).div(2);
    let middleRight = control.add(end).div(2);
    let middle = middleLeft.add(middleRight).div(2);

    return bezierQuadraticLength(start, middle, middleLeft, iterationsLeft - 1)
      + bezierQuadraticLength(middle, end, middleRight, iterationsLeft - 1);
  }

  let chord = end.sub(start).length();
  let contour = control.sub(start).length() + end.sub(control).length();

  return (chord + contour) / 2;
} */

