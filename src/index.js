import '../styles/main.scss';

import * as dat from 'dat.gui';


window.addEventListener('load', () => {
  let worker = new Worker('worker.bundle.js');

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
  folderRender.add(settings, 'renderer', { Canvas: 0, Pixi: 1, SVG: 2 });
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



  let slidersBox = document.querySelector('#sliders');
  let sliderItems = Array.from(slidersBox.querySelectorAll('li'));

  for (let index = 0; index < sliderItems.length; index++) {
    let item = sliderItems[index];

    let range = item.querySelector('input[type=range]');
    let textbox = item.querySelector('input[type=text]');

    range.addEventListener('input', () => {
      textbox.value = range.value;
    });

    textbox.addEventListener('focus', () => {
      textbox.select();
    });

    textbox.addEventListener('input', () => {
      if (textbox.value !== '') {
        range.value = textbox.value;
        textbox.value = Math.round(range.value);
      }
    });

    textbox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        textbox.blur();
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


  let progress = document.querySelector('progress');
  let progressTarget = 0;

  let progressInterval = setInterval(() => {
    if (progressTarget !== 100) {
      progress.value += (progressTarget - progress.value) / 10;
    } else {
      clearInterval(progressInterval);
    }
  }, 20);

  worker.addEventListener('message', (event) => {
    let msg = event.data;

    switch (msg.type) {
      case 'load.done':
        document.querySelector('#window-loader').style.display = 'none';
        document.querySelector('#window-grid').style.display = 'block';
        break;

      case 'load.progress':
        progressTarget = msg.value;
    }
  });
});

