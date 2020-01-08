
/* export class RemoteCanvasRenderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
  }

  render() {

  }
} */


export class LocalCanvasRenderer {
  constructor(app, io) {
    this.app = app;
    this.node = io.register('renderer');

    this.canvasSizes = null;
  }

  async initialize() {
    this.node.emit('initialize', {
      glyphs: this.app.glyphsMetadata.map((metadata) => metadata.character)
    });

    let { canvases } = await this.node.receive('initialize');
    this.canvasSizes = canvases;
  }

  render(mode) {
    let { ascent, descent } = this.app.computeFontValues();

    let glyphCanvases = this.app.computedGlyphs.map((glyph, glyphIndex) => {
      let [canvasWidth, canvasHeight] = this.canvasSizes[glyphIndex];
      let coefficient = canvasHeight / (ascent - descent);

      let glyphWidth = glyph.getMaxX() - glyph.getMinX();
      let glyphHeight = glyph.getMaxY() - glyph.getMinY();

      return {
        paths: glyph.paths.map((p) => [p, p.isClockwise()]),
        transform: [
          coefficient,
          0, 0,

          -coefficient,
          (canvasWidth - glyphWidth * coefficient - glyph.getMinX() * canvasWidth) / 2,
          glyph.getMaxY() * coefficient + (canvasHeight - glyphHeight * coefficient) / 2
        ]
      };
    });

    this.node.emit('render', { instructions: glyphCanvases });
  }
}

