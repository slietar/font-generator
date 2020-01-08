
export class IO {
  constructor(target = self) {
    this.listeners = {};
    this.target = target;

    this.target.addEventListener('message', (event) => {
      if (!(event.data instanceof Array) || event.data.length !== 3) {
        return;
      }

      let [namespace, type, data] = event.data;
      let ns = this.listeners[namespace];

      if (ns && ns[type]) {
        for (let listener of ns[type]) {
          listener(data);
        }
      }
    });
  }

  register(namespace) {
    let target = this.target;

    let ns = {};
    this.listeners[namespace] = ns;

    return {
      emit(type, data = {}) {
        target.postMessage([namespace, type, data]);
      },
      on(type, listener) {
        if (!ns[type]) {
          ns[type] = [];
        }

        ns[type].push(listener);
      },
      once(type, listener) {
        let _listener = (data) => {
          ns[type].splice(ns[type].indexOf(_listener), 1);
          listener(data);
        };

        this.on(type, _listener);
      },
      receive(type) {
        return new Promise((resolve) => {
          this.once(type, (data) => {
            resolve(data);
          });
        });
      }
    };
  }
}

