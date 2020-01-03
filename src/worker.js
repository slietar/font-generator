import * as format from './format';

self.postMessage({ type: 'ready' });

loadData()
  .then((rawData) => {
    self.postMessage({ type: 'load.done' });

    let data = format.decode(rawData);
    self.postMessage({
      type: 'decode.done',
      fontNames: data.fonts.map((font) => font.name)
    });
  })
  .catch((err) => {
    console.error(err);
  });

async function loadData() {
  let cache = await self.caches.open('data-cache');
  let url = 'download.dat';

  let cachedRes = await cache.match(url);
  let res = cachedRes || await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(res.statusText);
  }

  let reader = res.body.getReader();

  let chunks = [];
  let receivedLength = 0;

  let target = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);

    receivedLength += value.length;
    target += value.length / 1226754 * 100;
    self.postMessage({ type: 'load.progress', value: target });
  }

  let data = new Uint8Array(receivedLength);
  let position = 0;

  for (let chunk of chunks) {
    data.set(chunk, position);
    position += chunk.length;
  }

  if (!cachedRes) {
    cache.put(url, new Response(data));
  }

  console.log(cachedRes ? 'Cached' : 'Fetched');

  return data;
}

