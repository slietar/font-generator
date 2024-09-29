
/* export class RemoteCanvasRenderer {
  constructor(canvas) {
    let offscreen = canvas.transferControlToOffscreen();
  }
} */


export class LocalCanvasRenderer {
  constructor(io) {
    this.node = io.register('renderer');

    this.canvases = [];
  }

  async initialize() {
    let { glyphs } = await this.node.receive('initialize');

    let windowTag = document.querySelector('#window');

    let gridTag = document.querySelector('#window-grid');
    let canvasContainerTag = gridTag.querySelector('ul');

    let displayTag = document.querySelector('#window-display');
    let displayCanvasTag = displayTag.querySelector('.display-canvas');


    let { width: windowWidth, height: windowHeight } = windowTag.getBoundingClientRect();
    let gridColumns = Math.round(windowWidth / 144);
    let gridRows = Math.ceil(glyphs.length / gridColumns);

    let gridCanvasScreenWidth = windowWidth / gridColumns - 1;
    let gridCanvasScreenHeight = Math.max(windowHeight / gridRows, 80) - 1;

    let gridCanvasRenderWidth = gridCanvasScreenWidth * window.devicePixelRatio;
    let gridCanvasRenderHeight = gridCanvasScreenHeight * window.devicePixelRatio;

    gridTag.style.setProperty('--num-columns', gridColumns);

    for (let index = 0; index < glyphs.length; index++) {
      let li = document.createElement('li');
      let canvas = document.createElement('canvas');

      canvas.width = gridCanvasRenderWidth;
      canvas.height = gridCanvasRenderHeight;

      canvas.style.width = `${gridCanvasScreenWidth}px`;
      canvas.style.height = `${gridCanvasScreenHeight}px`;

      this.canvases.push(canvas);

      li.appendChild(canvas);
      canvasContainerTag.appendChild(li);
    }

    for (let index = 0; index < gridColumns * gridRows - glyphs.length; index++) {
      let li = document.createElement('li');
      li.classList.add('empty');
      canvasContainerTag.appendChild(li);
    }


    let displayCanvasScreenWidth = windowWidth / 2 - 1;
    let displayCanvasScreenHeight = windowHeight - 65;

    let displayCanvasRenderWidth = displayCanvasScreenWidth * window.devicePixelRatio;
    let displayCanvasRenderHeight = displayCanvasScreenHeight * window.devicePixelRatio;

    displayCanvasTag.width = displayCanvasRenderWidth;
    displayCanvasTag.height = displayCanvasRenderHeight;

    displayCanvasTag.style.width = `${displayCanvasScreenWidth}px`;
    displayCanvasTag.style.height = `${displayCanvasScreenHeight}px`;


    this.node.emit('initialize', {
      gridCanvasSize: [gridCanvasRenderWidth, gridCanvasRenderHeight],
      displayCanvasSize: [displayCanvasRenderWidth, displayCanvasRenderHeight]
    });

    this.node.on('render', (data) => {
      this.render(data);
      windowTag.classList.remove('blurred');
    });

    this.node.on('render-display', (data) => {
      this.renderDisplay(data);
      windowTag.classList.remove('blurred');
    });
  }

  render(data) {
    for (let glyphIndex = 0; glyphIndex < data.instructions.length; glyphIndex++) {
      let canvas = this.canvases[glyphIndex];
      let ctx = canvas.getContext('2d');
      let instructions = data.instructions[glyphIndex];

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      ctx.transform(...instructions.transform);

      for (let [path, isClockwise] of instructions.paths) {
        ctx.beginPath();
        ctx.moveTo(path.start.x, path.start.y);

        for (let curve of path.curves) {
          if (curve.control) {
            ctx.quadraticCurveTo(curve.control.x, curve.control.y, curve.end.x, curve.end.y);
          } else {
            ctx.lineTo(curve.end.x, curve.end.y);
          }
        }

        ctx.fillStyle = isClockwise ? '#000' : '#fff';
        ctx.fill();

        /* if (path.fill) {
          ctx.fillStyle = path.fill;
          ctx.fill();
        }

        if (path.stroke) {
          ctx.strokeStyle = path.stroke; // access var(--front-color) here
          ctx.stroke();
        } */
      }

      ctx.restore();

      /* ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 20);
      ctx.lineTo(canvas.width / 2, canvas.height - 20);
      ctx.strokeStyle = 'red';
      ctx.stroke(); */
    }
  }

  renderDisplay({ instructions }) {
    let canvas = document.querySelector('#window-display canvas');
    let ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    ctx.transform(...instructions.transform);

    for (let [path, isClockwise] of instructions.paths) {
      ctx.beginPath();
      ctx.moveTo(path.start.x, path.start.y);

      for (let curve of path.curves) {
        if (curve.control) {
          ctx.quadraticCurveTo(curve.control.x, curve.control.y, curve.end.x, curve.end.y);
        } else {
          ctx.lineTo(curve.end.x, curve.end.y);
        }
      }

      ctx.fillStyle = isClockwise ? '#000' : '#fff';
      ctx.fill();
    }

    ctx.restore();
  }

  /* render() {
    let mode = data.mode;

    if (mode == 0) {
      for (let canvas of canvases.slice(1)) {

      }
    } else {
      let canvas = canvases[0];
      let ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

    }
  } */
}
