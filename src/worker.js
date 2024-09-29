import * as opentype from 'opentype.js';

import * as format from './format';
import { IO } from './io';
import { BezierQuadratic, Font, Glyph, Line, Path } from './glyphs';
import { Point } from './points';
import { LocalCanvasRenderer } from './render-server';


let io = new IO();

main()
  .catch((err) => {
    console.error(err);
  });



class Application {
  constructor(options, node) {
    this.fonts = options.fonts;
    this.glyphsMetadata = options.glyphsMetadata;

    this.node = node;

    this.settings = {
      angleThreshold: 0.005,
      pointDensity: 40,
      simplificationThreshold: 0.001
    };

    this.weights = new Array(this.fonts.length).fill(0.5);

    this.renderer = new LocalCanvasRenderer(this, io);


    this.computationTimeout = null;
    this.computedGlyphs = [];

    this.currentFontUrl = null;
    this.currentGlyphIndex = 0;
    this.currentStretch = { x: 1, y: 1 };
    this.mode = 0;


    // Register = {
    //   alternates: number[], | each glyph
    //   points: Point[][][],  | each glyph, each path, each point
    //   result: Font,         |
    //   weights: number[]     | each font
    // }
    //
    // Registers:
    //  (0) low-resolution incorrect-density for grid mode
    //  (1) high-resolution for grid + display modes
    //  (2) pre-generated high-resolution [0]
    //  (3) pre-generated high-resolution [1]
    // this.registers = [];
  }

  computeFontValues() {
    let ascent = 0;
    let descent = 0;
    let totalWeight = 0;

    for (let fontIndex = 0; fontIndex < this.fonts.length; fontIndex++) {
      let font = this.fonts[fontIndex];
      let weight = this.weights[fontIndex];

      ascent += font.ascent * weight;
      descent += font.descent * weight;
      totalWeight += weight;
    }

    return {
      ascent: ascent / totalWeight * this.currentStretch.y,
      descent: descent / totalWeight * this.currentStretch.y
    };
  }

  getAlternateIndex(glyphIndex) {
    let metadata = this.glyphsMetadata[glyphIndex];

    let maxWeight = -1 / 0;
    let maxWeightAlternateIndex = null;

    for (let alternateIndex = 0; alternateIndex < metadata.alternates.length; alternateIndex++) {
      let weight = metadata.alternates[alternateIndex].reduce((sum, fontIndex) => sum + this.weights[fontIndex], 0);

      if (weight > maxWeight) {
        maxWeight = weight;
        maxWeightAlternateIndex = alternateIndex;
      }
    }

    return [maxWeightAlternateIndex, maxWeight];
  }

  computeGlyphDensity(glyphIndex, alternateIndex, weightSum) {
    let metadata = this.glyphsMetadata[glyphIndex];
    let alternateFontIndices = metadata.alternates[alternateIndex];


    let anchorPoints = [];
    let numberPoints = [];

    for (let pathIndex = 0; pathIndex < this.fonts[alternateFontIndices[0]].glyphs[glyphIndex].paths.length; pathIndex++) {
      let pathAnchorPoints = [];
      let pathNumberPoints = [];

      for (let ctrlIndex = 0; ctrlIndex < metadata.control[alternateFontIndices[0]][pathIndex].length; ctrlIndex++) {
        let ctrlAnchorPoints = [];
        let ctrlNumberPoints = 0;

        for (let fontIndex of alternateFontIndices) {
          let path = this.fonts[fontIndex].glyphs[glyphIndex].paths[pathIndex];

          let controlPositions = metadata.control[fontIndex][pathIndex];
          let ctrlPosition = controlPositions[ctrlIndex];
          let nextCtrlPosition = controlPositions[(ctrlIndex + 1) % controlPositions.length];

          ctrlNumberPoints += path.distance(ctrlPosition, nextCtrlPosition) * this.settings.pointDensity * (this.weights[fontIndex] / weightSum);
        }

        ctrlNumberPoints = Math.round(ctrlNumberPoints);

        for (let anchorIndex = 0; anchorIndex < ctrlNumberPoints; anchorIndex++) {
          pathAnchorPoints.push(new Point(0, 0));
        }

        pathNumberPoints.push(ctrlNumberPoints);
      }

      anchorPoints.push(pathAnchorPoints);
      numberPoints.push(pathNumberPoints);
    }

    return [anchorPoints, numberPoints];
  }


  computeGlyph(glyphIndex) {
    let metadata = this.glyphsMetadata[glyphIndex];

    let [alternateIndex, weightSum] = this.getAlternateIndex(glyphIndex);
    let alternateFontIndices = metadata.alternates[alternateIndex];

    let [anchorPoints, numberPoints] = this.computeGlyphDensity(glyphIndex, alternateIndex, weightSum);


    for (let fontIndex of alternateFontIndices) {
      let font = this.fonts[fontIndex];
      let glyph = font.glyphs[glyphIndex];

      for (let pathIndex = 0; pathIndex < glyph.paths.length; pathIndex++) {
        let path = glyph.paths[pathIndex];
        let controlPositions = metadata.control[fontIndex][pathIndex];
        let pathAnchorPoints = anchorPoints[pathIndex];
        let pathAnchorIndex = 0;

        for (let ctrlIndex = 0; ctrlIndex < controlPositions.length; ctrlIndex++) {
          let ctrlPosition = controlPositions[ctrlIndex];
          let nextCtrlPosition = controlPositions[(ctrlIndex + 1) % controlPositions.length];

          let ctrlLength = nextCtrlPosition - ctrlPosition;

          if (ctrlLength < 0) ctrlLength += 1;
          if (ctrlLength > 1) ctrlLength -= 1;

          let ctrlNumberPoints = numberPoints[pathIndex][ctrlIndex];

          for (let anchorIndex = 0; anchorIndex < ctrlNumberPoints; anchorIndex++) {
            let anchorPosition = ctrlPosition + ctrlLength * (anchorIndex / ctrlNumberPoints);
            if (anchorPosition >= 1) anchorPosition -= 1;

            let [curve, relPos] = path.curveAtPos(anchorPosition);
            pathAnchorPoints[pathAnchorIndex] = pathAnchorPoints[pathAnchorIndex].add(curve.func(relPos).mul(this.weights[fontIndex] / weightSum));

            pathAnchorIndex++;
          }
        }
      }
    }

    let paths = anchorPoints.map((pathAnchorPoints) => {
      for (let point of pathAnchorPoints) {
        point.x *= this.currentStretch.x;
        point.y *= this.currentStretch.y;
      }

      // Ramer-Douglas-Peucker

      let halfIndex = Math.floor(pathAnchorPoints.length / 2);

      let points = [
        ...rdp(pathAnchorPoints.slice(0, halfIndex), pathAnchorPoints[halfIndex], this.settings.simplificationThreshold),
        ...rdp(pathAnchorPoints.slice(halfIndex), pathAnchorPoints[0], this.settings.simplificationThreshold)
      ];


      // bezier curve fitting

      let markers = [];

      for (let index = 0; index < points.length; index++) {
        let point0 = points[index];
        let point1 = points[(index + 1) % points.length];
        let point2 = points[(index + 2) % points.length];

        if (point1.distanceToLine(point0, point2) > this.settings.angleThreshold) { // || point0.sub(point1).length() > 0.03 || point1.sub(point2).length() > 0.03) {
          markers.push((index + 1) % points.length);
        }
      }

      let curves = [];

      if (markers.length === 0) {
        for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
          let previousPoint = points[(pointIndex + points.length - 1) % points.length];
          let currentPoint = points[pointIndex];
          let nextPoint = points[(pointIndex + 1) % points.length];

          curves.push(new BezierQuadratic(
            previousPoint.add(currentPoint).mul(0.5),
            currentPoint.add(nextPoint).mul(0.5),
            currentPoint
          ));
        }
      }

      for (let markerIndex = 0; markerIndex < markers.length; markerIndex++) {
        let startPointIndex = markers[markerIndex];
        let endPointIndex = markers[(markerIndex + 1) % markers.length];

        let first = true; // tmp

        for (let pointIndex = startPointIndex;; pointIndex = (pointIndex + 1) % points.length) {
          let previousPoint = points[(pointIndex + points.length - 1) % points.length];
          let currentPoint = points[pointIndex];
          let nextPoint = points[(pointIndex + 1) % points.length];

          if (first) { // pointIndex === startPointIndex) {
            curves.push(new Line(
              currentPoint,
              currentPoint.add(nextPoint).mul(0.5)
            ));

            first = false;
          } else if (pointIndex === endPointIndex) {
            curves.push(new Line(
              previousPoint.add(currentPoint).mul(0.5),
              currentPoint
            ));

            break;
          } else {
            curves.push(new BezierQuadratic(
              previousPoint.add(currentPoint).mul(0.5),
              currentPoint.add(nextPoint).mul(0.5),
              currentPoint
            ));
          }
        }
      }

      return new Path(curves);
    });


    return new Glyph(paths, {
      character: metadata.character,
      name: metadata.name,
      unicode: metadata.unicode,

      advance: alternateFontIndices.reduce((sum, fontIndex) =>
        sum + this.fonts[fontIndex].glyphs[glyphIndex].advance * this.weights[fontIndex] / weightSum
        , 0) * this.currentStretch.x
    });
  }

    /* updateWeight(index, value) {
    if (this.computationTimeout !== null) {
      clearTimeout(this.computationTimeout);
    }

    this.weights[index] = value;

    return new Promise((resolve) => {
      let a = Date.now();

      let glyphIndex = 0;

      let computeNextGlyph = () => {
        let [alternateIndex, alternateWeightSum] = this.getAlternateIndex(glyphIndex);

        if (alternateIndex != this.computed[0].alternates[glyphIndex]) {
          this.computed[0].points = this.computeGlyphDensity(glyphIndex);
          this.computeGlyph(glyphIndex);
        } else {
          this.computeUpdatedWeight(glyphIndex, index, value);
        }


        glyphIndex++;

        if (glyphIndex < this.glyphsMetadata.length) {
          this.computationTimeout = setTimeout(computeNextGlyph, 0);
        } else {
          this.computationTimeout = null;

          let b = Date.now();
          console.info(`Execution took ${b - a}ms`);

          resolve();
          this.renderer.render(0);
        }
      };

      this.computationTimeout = setTimeout(computeNextGlyph, 1);
    });

  } */

  async exportFont() {
    let { ascent, descent } = this.computeFontValues();

    let font = new Font(this.computedGlyphs, {
      ascent, descent,
      name: 'Relentless ' + Math.round(Math.random() * 1e9).toString(16)
    });


    let buffer = font.exportToOpentype(opentype).toArrayBuffer();

    if (this.currentFontUrl !== null) {
      URL.revokeObjectURL(this.currentFontUrl);
    }

    let blob = new Blob([buffer], { type: 'application/x-font-opentype' });
    let url = URL.createObjectURL(blob);

    this.currentFontUrl = url;

    this.node.emit('export', { url });

    /* let fontface = new FontFace('Computed', `url(${url})`);
    await fontface.load();

    document.fonts.add(fontface); */
  }

  updateWeights(index, value, stretch) {
    if (this.computationTimeout !== null) {
      clearTimeout(this.computationTimeout);
    }

    if (index !== null) {
      this.weights[index] = value;
    } else {
      this.weights = value;
    }

    if (stretch) {
      this.currentStretch = {
        x: 1 + Math.random() * 0.1,
        y: 1 + Math.random() * 0.1
      };
    }

    return new Promise((resolve) => {
      let a = Date.now();

      let glyphIndex = 0;

      let computeNextGlyph = () => {
        this.computedGlyphs[glyphIndex] = this.computeGlyph(glyphIndex);

        glyphIndex++;

        if (glyphIndex < this.glyphsMetadata.length) {
          this.computationTimeout = setTimeout(computeNextGlyph, 0);
        } else {
          this.computationTimeout = null;

          let b = Date.now();
          console.info(`Execution took ${b - a}ms`);

          resolve();

          this.renderer.render();
          this.renderer.renderDisplay(this.currentGlyphIndex);

          this.exportFont()
            .catch((err) => {
              console.error(err);
            });
        }
      };

      this.computationTimeout = setTimeout(computeNextGlyph, 1);
    });

  }
}


async function main() {
  let mainNode = io.register('main');
  let initNode = io.register('initialization');

  mainNode.emit('ready');

  let rawData = await loadData((value) => {
    initNode.emit('load.progress', { value });
  });

  initNode.emit('load.done');


  let data = format.decode(rawData);
  let obj = extractData(data);

  let app = new Application(obj, mainNode);

  initNode.emit('decode.done', {
    fontNames: data.fonts.map((font) => font.name),
    glyphCharacters: obj.glyphsMetadata.map((glyph) => glyph.character)
  });

  mainNode.on('weights.update', (data) => {
    mainNode.emit('computation.start');
    app.updateWeights(data.index, data.value, data.stretch);
  });

  mainNode.on('weights.updateall', (data) => {
    app.updateWeights(null, data.values, data.stretch);
  });

  await app.renderer.initialize();

  // tmp
  app.updateWeights(null, new Array(app.fonts.length).fill(0.5), false);

  mainNode.on('set-display-glyph', ({ index: glyphIndex }) => {
    app.currentGlyphIndex = glyphIndex;
    app.renderer.renderDisplay(glyphIndex);
  });
}


async function loadData(progressCallback) {
  let cache = await self.caches.open('data-cache');
  let url = new URL('../download.dat', import.meta.url);

  let cachedRes = await cache.match(url);
  let res = cachedRes ?? await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(res.statusText);
  }

  let reader = res.body.getReader();

  let dataSize = 1_232_261;
  let data = new ArrayBuffer(dataSize);
  let dataBytes = new Uint8Array(data);

  let receivedSize = 0;

  while (true) {
    let { done, value } = await reader.read();

    if (done) {
      break;
    }

    dataBytes.set(value, receivedSize);
    receivedSize += value.length;

    progressCallback(receivedSize / dataSize * 100);
  }


  if (!cachedRes) {
    cache.put(url, new Response(data));
  }

  console.log(cachedRes ? 'Cached' : 'Fetched');

  return data;
}

function extractData(data) {
  let fonts = [];

  for (let fontData of data.fonts) {
    let glyphs = [];

    for (let glyphIndex = 0; glyphIndex < fontData.glyphs.length; glyphIndex++) {
      let glyphData = fontData.glyphs[glyphIndex];
      let paths = [];

      for (let pathData of glyphData.paths) {
        let curves = [];
        let start = pathData.start;

        for (let curveData of pathData.curves) {
          switch (curveData.type) {
            case 0x00:
              curves.push(new Line(
                new Point(start),
                new Point(curveData.end)
              ));

              break;

            case 0x01:
              curves.push(new BezierQuadratic(
                new Point(start),
                new Point(curveData.end),
                new Point(curveData.control)
              ));

              break;
          }

          start = curveData.end;
        }

        paths.push(new Path(curves));
      }


      let glyphMetadata = data.control[glyphIndex];

      glyphs.push(new Glyph(paths, {
        character: glyphMetadata.character,
        unicode: glyphMetadata.unicode,

        advance: glyphData.advance,
        xBearing: glyphData.xBearing
      }));
    }

    fonts.push(new Font(glyphs, {
      ascent: fontData.ascent,
      descent: fontData.descent,

      coefficient: 1,
      name: fontData.name
    }));
  }

  return {
    fonts,
    glyphsMetadata: data.control
  };
}


function rdp(points, last, threshold) {
  if (points.length === 1) {
    return points;
  }

  let greatestDistance = -1 / 0;
  let greatestDistancePointIndex = -1;

  for (let index = 1; index < points.length; index++) {
    let dist = points[index].distanceToLine(points[0], last);

    if (dist > greatestDistance) {
      greatestDistance = dist;
      greatestDistancePointIndex = index;
    }
  }

  if (greatestDistance < threshold) {
    return points.slice(0, 1);
  }

  return [
    ...rdp(points.slice(0, greatestDistancePointIndex), points[greatestDistancePointIndex], threshold),
    ...rdp(points.slice(greatestDistancePointIndex), last, threshold)
  ];
}
