
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
    console.log(gridColumns, 'x', gridRows);

    let canvasWidth = windowWidth / gridColumns - 1;
    let canvasHeight = Math.max(windowHeight / gridRows, 80) - 1;

    gridTag.style.setProperty('--num-columns', gridColumns);

    for (let index = 0; index < glyphs.length; index++) {
      let li = document.createElement('li');
      let canvas = document.createElement('canvas');

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      this.canvases.push(canvas);

      li.appendChild(canvas);
      canvasContainerTag.appendChild(li);
    }

    for (let index = 0; index < gridColumns * gridRows - glyphs.length; index++) {
      let li = document.createElement('li');
      li.classList.add('empty');
      canvasContainerTag.appendChild(li);
    }


    displayCanvasTag.width = windowWidth / 2 - 1;
    displayCanvasTag.height = windowHeight - 65;


    this.node.emit('initialize', {
      gridCanvasSize: [canvasWidth, canvasHeight],
      displayCanvasSize: [displayCanvasTag.width, displayCanvasTag.height]
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

