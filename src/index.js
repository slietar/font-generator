import '../styles/main.scss';

import * as dat from 'dat.gui';
import { IO } from './io';
import { LocalCanvasRenderer } from './render-client';


window.addEventListener('load', () => {
  let worker = new Worker('worker.bundle.js');
  let io = new IO(worker);

  let mainNode = io.register('main');
  let initNode = io.register('initialization');


  let app = new Application(mainNode);
  window.app = app;


  let gui = new dat.GUI();
  gui.hide();

  let settings = {
    invert: false,
    pointDensity: 1.0,
    renderer: 0,

    clearCache() {
      window.caches.delete('data-cache');
    }
  };

  let folderData = gui.addFolder('Data');
  folderData.add(settings, 'clearCache');
  folderData.open();

  let folderUI = gui.addFolder('UI');
  let invertController = folderUI.add(settings, 'invert');
  folderUI.open();

  let folderRender = gui.addFolder('Render');
  folderRender.add(settings, 'renderer', { 'Local canvas': 0, 'Remote canvas': 1, 'Transferred canvas': 2, SVG: 3, WebGL: 4 });
  folderRender.add(settings, 'pointDensity', 0.5, 1.5);
  folderRender.open();

  invertController.onChange((value) => {
    setInvert(value);
  });



  let invertCheckbox = document.querySelector('#a');

  invertCheckbox.addEventListener('input', () => {
    setInvert(invertCheckbox.checked);
  });

  setInvert(false);


  function setInvert(value) {
    if (value) {
      document.body.classList.add('inverted');
    } else {
      document.body.classList.remove('inverted');
    }

    settings.invert = value;
    invertCheckbox.checked = value;

    invertController.updateDisplay();
  }



  let progress = new ProgressBar(document.querySelector('progress'));
  let progressTarget = 10;
  let progressAdd = 10;

  progress.onDone(() => {
    document.querySelector('#window-loader').style.display = 'none';
    document.querySelector('#window-display').classList.add('active');
  });


  mainNode.once('ready', () => {
    progress.update(20);
  });

  initNode.on('load.progress', ({ value }) => {
    progress.update(20 + value * 0.6);
  });

  initNode.once('load.done', () => {
    progress.update(80);
  });

  initNode.once('decode.done', ({ fontNames, glyphCharacters }) => {
    progress.update(100);
    initializeSliders(fontNames);

    app.initializeGlyphs(glyphCharacters);
    app.initializeSliders();
  });


  let renderer = new LocalCanvasRenderer(io);

  renderer.initialize()
    .then(() => {
      console.log('OK');
    })
    .catch((err) => {
      console.error(err);
    });

  mainNode.on('computation.start', () => {
    document.querySelector('#window').classList.add('blurred');
  });


  // tmp
  window.refreshSliders = () => {
    mainNode.emit('weights.updateall', {
      stretch: false,
      values: Array.from(document.querySelectorAll('[type=range]')).map((e) => e.value / 100)
    });
  }

  function initializeSliders(fontNames) {
    let slidersBox = document.querySelector('#sliders');
    let sliderItems = Array.from(slidersBox.querySelectorAll('li'));

    for (let index = 0; index < fontNames.length; index++) {
      let sliderItem = document.createElement('li');

      sliderItem.innerHTML = `<label for="font-slider-${index}">${fontNames[index]}</label><input type="range" id="font-slider-${index}" /><input type="text" value="50" />`;
      sliderItems.push(sliderItem);

      slidersBox.appendChild(sliderItem);
    }

    for (let index = 0; index < sliderItems.length; index++) {
      let item = sliderItems[index];

      let timeout = null;
      let setWeight = (value) => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
          timeout = null;

          mainNode.emit('weights.update', {
            index,
            stretch: false,
            value: range.value / 100
          });
        }, 50);
      };

      let setWeightImmediate = (value) => {
        if (timeout === null) {
          return;
        }

        clearTimeout(timeout);
        timeout = null;

        mainNode.emit('weights.update', {
          index,
          value: range.value / 100
        });
      };

      let range = item.querySelector('input[type=range]');
      let textbox = item.querySelector('input[type=text]');

      range.addEventListener('input', () => {
        textbox.value = range.value;
        setWeight();
      });

      textbox.addEventListener('focus', () => {
        textbox.select();
      });

      textbox.addEventListener('input', () => {
        if (textbox.value !== '') {
          range.value = textbox.value;
          textbox.value = Math.round(range.value);
          setWeight();
        }
      });

      textbox.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          textbox.blur();
          setWeightImmediate();
        }

        if (e.key === 'ArrowUp' && index !== 0) {
          e.preventDefault();
          sliderItems[index - 1].querySelector('input[type=text]').focus();
        }

        if (e.key === 'ArrowDown' && index !== sliderItems.length - 1) {
          e.preventDefault();
          sliderItems[index + 1].querySelector('input[type=text]').focus();
        }
      });

      textbox.addEventListener('blur', (e) => {
        textbox.value = Math.round(range.value);
      });
    }
  }
});


class Application {
  constructor(node) {
    this.node = node;

    this.currentFontface = null;
    this.currentFontUrl = null;

    this.mode = 0;
    this.displayGlyphIndex = -1;

    this.elements = {
      downloadButton: document.querySelector('.input-download'),
      randomizeButton: document.querySelector('.input-randomize'),
      sliders: null,
      toggleModeButtons: Array.from(document.querySelectorAll('.input-toggle-mode')),
      textboxSizeSlider: document.querySelector('.input-textbox-size'),
      textboxInput: document.querySelector('.input-textbox'),

      displayCanvas: document.querySelector('.display-canvas'),
      glyphList: document.querySelector('.glyph-list'),

      window: document.querySelector('#window'),
      windowDisplay: document.querySelector('#window-display'),
      windowGrid: document.querySelector('#window-grid')
    };


    for (let element of this.elements.toggleModeButtons) {
      element.addEventListener('click', (event) => {
        event.preventDefault();

        this.toggleMode();
      }, false);
    }

    this.elements.textboxSizeSlider.addEventListener('input', (event) => {
      event.preventDefault();
      this.updateTextboxFontSize();
    }, false);

    this.updateTextboxFontSize();

    this.node.on('export', ({ url }) => {
      let oldFontFace = this.currentFontface;
      let fontface = new FontFace('Computed', `url(${url})`);

      this.currentFontface = fontface;
      this.currentFontUrl = url;

      fontface.load()
        .then(() => {
          document.fonts.add(fontface);

          if (oldFontFace !== null) {
            document.fonts.delete(oldFontFace);
          }
        });
    });

    this.elements.downloadButton.addEventListener('click', (event) => {
      event.preventDefault();

      let link = document.createElement("a");

      link.download = 'Relentless.otf';
      link.href = this.currentFontUrl;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  initializeGlyphs(glyphs) {
    let sortedGlyphs = glyphs || [
      ...glyphs.slice(0, 26),
      ...glyphs.slice(52, 57),
      ...glyphs.slice(62, 67),

      ...glyphs.slice(26, 52),
      ...glyphs.slice(57, 62),
      ...glyphs.slice(67, 72)
    ];

    for (let glyph of sortedGlyphs) {
      this.elements.glyphList.innerHTML += `<li><a href="#">${glyph === ' ' ? '&nbsp;' : glyph}</a></li>`;
    }

    this.elements.glyphListLinks = Array.from(this.elements.glyphList.querySelectorAll('a'));
    
    this.elements.glyphListLinks.forEach((element, index) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();

        this.setDisplayGlyph(index);
      }, false);
    });

    this.setDisplayGlyph(0);
  }

  initializeSliders() {
    this.elements.fontItems = Array.from(document.querySelectorAll('#sliders input[type=range]'));

    let randomCdf = (x) => {
      let a = 4;
      let k = 0.7; // minimum probability

      return a * (x ** 3) / 3 - a * k * (x ** 2) + (1 + (k - 1 / 3) * a) * x;
    };

    let inverseRandomCdf = inverseFunc(randomCdf, 0, 1);


    this.elements.randomizeButton.addEventListener('click', (event) => {
      event.preventDefault();

      let values = [];

      for (let element of Array.from(document.querySelectorAll('#sliders li'))) {
        let value = Math.max(0, inverseRandomCdf(Math.random()) - Math.random() * 0.5);

        element.querySelector('input[type=range]').value = Math.round(value * 100);
        element.querySelector('input[type=text]').value = Math.round(value * 100);
        values.push(value);
      }

      this.elements.window.classList.add('blurred');
      this.node.emit('weights.updateall', { stretch: true, values });
    }, false);
  }

  setDisplayGlyph(index) {
    for (let element of this.elements.glyphListLinks) {
      element.classList.remove('active');
    }

    /* if (index > 0) {
      this.elements.glyphListLinks[this.displayGlyphIndex].classList.remove('active');
    } */

    this.elements.glyphListLinks[index].classList.add('active');

    this.displayGlyphIndex = index;
    this.node.emit('set-display-glyph', { index });
  }

  toggleMode() {
    this.mode = 1 - this.mode;

    this.elements.windowDisplay.classList.toggle('active');
    this.elements.windowGrid.classList.toggle('active');

    for (let element of this.elements.toggleModeButtons) {
      element.classList.toggle('active');
    }

    this.node.emit('set-mode', { mode: this.mode });
  }

  updateTextboxFontSize() {
    let value = parseInt(this.elements.textboxSizeSlider.value);

    this.elements.textboxInput.style['font-size'] = (1 + value / 100 * 6) + 'rem';
  }
}


class ProgressBar {
  constructor(element) {
    this.element = element;

    this.addition = 0;
    this.target = 0;

    this.doneListeners = [];


    let interval = setInterval(() => {
      if (this.element.value >= 100) {
        clearInterval(interval);

        for (let listener of this.doneListeners) {
          listener();
        }
      }

      this.element.value += this.addition / 5;

      if (this.element.value >= this.target) {
        this.addition = 0;
      }
    }, 20);
  }

  onDone(listener) {
    this.doneListeners.push(listener);
  }

  update(value) {
    this.addition = value - this.element.value;
    this.target = value;
  }
}


function inverseFunc(func, min, max, steps = 10) {
  let inverse = (target, min, max, steps) => {
    let middle = (min + max) / 2;

    return steps === 0
      ? middle
      : func(middle) > target
        ? inverse(target, min, middle, steps - 1)
        : inverse(target, middle, max, steps - 1);
  };

  return (target) => inverse(target, min, max, steps);
}

