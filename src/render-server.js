
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
  }

  async initialize() {
    this.node.emit('initialize', {
      glyphs: this.app.glyphsMetadata.map((metadata) => metadata.character)
    });

    let { gridCanvasSize, displayCanvasSize } = await this.node.receive('initialize');

    this.gridCanvasSize = gridCanvasSize;
    this.displayCanvasSize = displayCanvasSize;
  }

  render(mode) {
    let { ascent, descent } = this.app.computeFontValues();

    let glyphCanvases = this.app.computedGlyphs.map((glyph, glyphIndex) => {
      let [canvasWidth, canvasHeight] = this.gridCanvasSize;
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

  renderDisplay(glyphIndex) {
    let glyph = this.app.computedGlyphs[glyphIndex];
    let { ascent, descent } = this.app.computeFontValues();

    let [canvasWidth, canvasHeight] = this.displayCanvasSize;
    let coefficient = canvasHeight / (ascent - descent);

    let glyphWidth = glyph.getMaxX() - glyph.getMinX();
    let glyphHeight = glyph.getMaxY() - glyph.getMinY();

    let instructions = {
      paths: glyph.paths.map((p) => [p, p.isClockwise()]),
      transform: [
        coefficient,
        0, 0,

        -coefficient,
        (canvasWidth - glyphWidth * coefficient - glyph.getMinX() * canvasWidth) / 2,
        glyph.getMaxY() * coefficient + (canvasHeight - glyphHeight * coefficient) / 2
      ]
    };

    this.node.emit('render-display', { instructions });
  }
}
