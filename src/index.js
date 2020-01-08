import '../styles/main.scss';

import * as dat from 'dat.gui';
import { IO } from './io';
import { LocalCanvasRenderer } from './render-client';


window.addEventListener('load', () => {
  let worker = new Worker('worker.bundle.js');
  let io = new IO(worker);

  let mainNode = io.register('main');
  let initNode = io.register('initialization');


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
      document.querySelector('#window-grid').classList.add('active');
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

  initNode.once('decode.done', ({ fontNames }) => {
    progress.update(100);
    initializeSliders(fontNames);
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
    document.querySelector('#window-grid').classList.add('blurred');
  });


  // tmp
  window.refreshSliders = () => {
    mainNode.emit('weights.updateall', {
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
            value: range.value / 100
          });
        }, 300);
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

