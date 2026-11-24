'use strict';

const screenshotReader = (() => {
  const assets = 'https://cdn.jsdelivr.net/npm/';
  const engine = assets + 'tesseract.js@5.1.1/dist/';
  let library;

  function loadLibrary() {
    if (!library) {
      library = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = engine + 'tesseract.min.js';
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => {
          script.remove();
          reject(Error('The text reader could not download. Check your connection or enter the details manually.'));
        };
        document.head.append(script);
      }).catch(error => {
        library = null;
        throw error;
      });
    }
    return library;
  }

  async function createWorker(progress) {
    const api = await loadLibrary();
    return api.createWorker('eng', 1, {
      workerPath: engine + 'worker.min.js',
      corePath: assets + 'tesseract.js-core@5.1.1',
      langPath: assets + '@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
      logger: message => progress(message.status === 'recognizing text'
        ? `Reading screenshot text · ${Math.round(message.progress * 100)}%`
        : 'Loading the browser text reader…'),
    });
  }

  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };
  const quantityPattern = '(\\d{1,3}|one|two|three|four|five|six|ten)';
  const amountPattern = '(\\d+(?:[ ,.](?=\\d{3}\\b)\\d{3})*(?:[.,]\\d{1,2})?)';
  const priceToken = new RegExp('\\b(?:R|ZAR)\\s*' + amountPattern, 'gi');
  const bundle = new RegExp('\\b' + quantityPattern + '\\s*(?:items?\\s+)?(?:for|@|x)\\s*(?:R|ZAR)?\\s*' + amountPattern + '(?![\\d/])|\\b(?:R|ZAR)\\s*' + amountPattern + '\\s*(?:for|per)\\s*' + quantityPattern + '\\b', 'gi');

  function amountToCents(amount) {
    const normalized = amount.replace(/[ ,.](?=\d{3}\b)/g, '').replace(',', '.');
    const cents = Math.round(Number(normalized) * 100);
    return Number.isInteger(cents) && cents >= 0 && cents <= 100000000 ? cents : null;
  }

  const sizes = ['XXS','XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'];
  const sizePattern = /\b(?:[2-6]XL|X{1,5}[LS]|[SML])\b/gi;
  const colourPattern = /\b(?:light |dark |royal |sky |navy |forest |baby )?(?:white|black|cream|beige|brown|tan|pink|purple|lavender|lilac|yellow|gold|silver|grey|gray|red|green|blue|orange|burgundy|maroon|teal|turquoise|olive|khaki|navy|mint|peach|coral)\b/gi;
  const titleCase = value => value.charAt(0).toUpperCase() + value.slice(1);
  const unique = values => [...new Set(values)];

  function details(text) {
    const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const supplierOffers = new Map();
    const standalone = new Set();
    const review = [];
    function remember(quantity, cost) {
      if (!(quantity >= 1 && quantity <= 1000) || cost == null) return;
      if (supplierOffers.has(quantity) && supplierOffers.get(quantity) !== cost) {
        supplierOffers.set(quantity, null);
        review.push(`Check the supplier cost for Buy ${quantity}. More than one price was read.`);
      } else supplierOffers.set(quantity, cost);
    }
    const publicLines = [];
    const colours = [];
    const foundSizes = [];
    for (const line of lines) {
      const withoutBundles = line.replace(bundle, (_match, firstQuantity, firstAmount, secondAmount, secondQuantity) => {
        const quantity = (firstQuantity ?? secondQuantity).toLowerCase();
        remember(numberWords[quantity] ?? Number(quantity), amountToCents(firstAmount ?? secondAmount));
        return ' ';
      });
      const clean = withoutBundles.replace(priceToken, (_match, amount) => {
        const cost = amountToCents(amount);
        if (cost != null) standalone.add(cost);
        return ' ';
      }).replace(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.\w+|(?:\+27|0)(?:[\s().-]*\d){9,10}|\b\d{1,2}:\d{2}\b/gi, '')
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '').replace(/\s{2,}/g, ' ').trim();
      const variantLine = /\b(?:sizes?|colou?rs?|available in)\b/i.test(clean);
      if (/\b(?:sizes?|fits?)\b/i.test(clean)) {
        const normalized = [...clean.matchAll(sizePattern)].map(match => match[0].toUpperCase().replace(/^XX+L$/, x => (x.length - 1) + 'XL'));
        const start = sizes.indexOf(normalized[0]);
        const end = sizes.indexOf(normalized[1]);
        foundSizes.push(...(normalized.length === 2 && /\bto\b|[-–]/i.test(clean) && start >= 0 && end >= start
          ? sizes.slice(start, end + 1) : normalized));
        if (!normalized.length) foundSizes.push(...(clean.match(/\b\d{1,3}\b/g) || []));
      }
      if (variantLine || /\b(?:dress|top|shirt|abaya|bag|shoes?)\b/i.test(clean)) {
        colours.push(...Array.from(clean.matchAll(colourPattern), m => titleCase(m[0].toLowerCase())));
      }
      if (clean.length >= 4 && /\p{L}{2}/u.test(clean) && !variantLine &&
          !/\b(?:whatsapp|payment|orders?|refunds?|delivery|collection|supplier|contact|available|price|special|offers?|sale|each|per item|buy|take\s*\d|chat|today|yesterday|online|typing)\b/i.test(clean)) {
        publicLines.push(clean);
      }
    }
    if (!supplierOffers.has(1)) {
      supplierOffers.set(1, standalone.size === 1 ? [...standalone][0] : null);
      if (standalone.size > 1) review.push('Review the single-item cost. Several standalone prices were detected.');
    }
    const productWords = /\b(?:dress|abaya|hijab|perfume|scarf|shirt|trousers?|jeans|sneakers?|shoes?|sandals?|bags?|handbags?|watch|bracelet|necklace|set|blouse|skirt|hoodie|jacket|tracksuit|gift|cream|soap|lotion)\b/i;
    const title = publicLines.find(line => productWords.test(line) && line.length <= 90)
      || publicLines.find(line => line.length <= 65) || '';
    const features = unique(publicLines.filter(line => line !== title && /[a-z]{3}/i.test(line))).slice(0, 4);
    const variants = [colours.length ? `Colours include ${unique(colours).join(', ')}` : '',
      foundSizes.length ? `Sizes include ${unique(foundSizes).join(', ')}` : ''].filter(Boolean);
    const description = (features.length ? features : [...(title ? [title] : []), ...variants])
      .map(line => titleCase(line) + '.').join(' ').slice(0, 1500);
    if (!title) review.push('The screenshot text did not provide a clear product title. Add one before publishing.');
    const offers = [...supplierOffers].sort(([a], [b]) => a - b).slice(0, 20)
      .map(([quantity, supplier_cents]) => ({ quantity, supplier_cents, selling_cents: null }));
    return { name: titleCase(title).slice(0, 120), description, category: '', colours: unique(colours).slice(0, 30),
      sizes: unique(foundSizes).slice(0, 30), offers, review: unique(review) };
  }

  function photoRegions(bitmap) {
    const canvas = document.createElement('canvas');
    const scale = 192 / Math.max(bitmap.width, bitmap.height);
    const width = canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    const height = canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    if (width < 16 || height < 16) return [];
    const context = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    function textured(x, y) {
      const i = (y * width + x) * 4;
      const d = i - 4;
      const channels = [pixels[i], pixels[i+1], pixels[i+2]];
      const chroma = Math.max(...channels) - Math.min(...channels);
      const edge = Math.abs(pixels[i]-pixels[d]) + Math.abs(pixels[i+1]-pixels[d+1]) + Math.abs(pixels[i+2]-pixels[d+2]);
      return (chroma > 30 && Math.max(...channels) > 55) || edge > 49;
    }
    function spans(scores, threshold, minLength) {
      const runs = [];
      let start = -1;
      let end = -1;
      for (const [index, score] of scores.entries()) {
        if (score < threshold) continue;
        if (index - end > 3 && start >= 0) {
          if (end - start + 1 >= minLength) runs.push([start, end + 1]);
          start = -1;
        }
        if (start < 0) start = index;
        end = index;
      }
      if (start >= 0 && end - start + 1 >= minLength) runs.push([start, end + 1]);
      return runs;
    }
    const rows = Array.from({length:height}, (_, y) => {
      let score = 0;
      for (let x = 1; x < width; x++) score += Number(textured(x, y));
      return score / width;
    });
    return spans(rows, .19, Math.max(16, Math.floor(height * .12))).flatMap(([top,bottom]) => {
      const columns = Array.from({length:width}, (_, x) => {
        let score = 0;
        for (let y = top; y < bottom; y++) score += Number(x > 0 && textured(x, y));
        return score / (bottom - top);
      });
      return spans(columns, .17, Math.max(12, Math.floor(width * .20))).map(([left,right]) => ({
        left: Math.round(left / width * 1000), top: Math.round(top / height * 1000),
        right: Math.round(right / width * 1000), bottom: Math.round(bottom / height * 1000),
      }));
    }).slice(0, 6);
  }

  return { createWorker, details, photoRegions };
})();
