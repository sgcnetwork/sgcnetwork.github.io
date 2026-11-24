'use strict';
const db = window.sgcSupabase;
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const rand = cents => money.format(cents / 100);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const field = (label, name, value, attrs = '') => `<label class="field">${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const list = value => [...new Set(value.split(',').map(x => x.trim()).filter(Boolean))];
const publicText = value => String(value ?? '').replace(/(?:https?:\/\/|www\.)\S+|\b(?:ZAR|R)\s*\d[\d.,]*|(?:\+27|0)(?:[\s().-]*\d){9,10}|[\w.+-]+@[\w.-]+\.\w+/gi, '').replace(/ {2,}/g, ' ').trim();
const safePhoto = value => /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value) ? value : '';
const image = (photo, alt) => safePhoto(photo) ? `<img class="product-image" src="${photo}" alt="${esc(alt)}">` : '';
let session;
let store;
let drafts = [];
let selected = 0;
let screenshot = '';
let importing = false;
let generation = 0;
let importStatus = '';
let lastSteps = [];
const sections = ['dashboard','import','products','orders','customers','storefront','catalogue','analytics','settings'];
const slug = new URLSearchParams(location.search).get('store');
const route = () => sections.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'import';
const storefrontUrl = () => new URL('?store=' + encodeURIComponent(store.slug), location.href).href;

function tell(message = '') {
  notice.textContent = message;
  notice.hidden = !message;
}
function fail(error) { tell(error?.message || 'Something went wrong. Please try again.'); }

async function getStore() {
  const { data, error } = await db.from('reseller_stores').select('*').eq('owner_id', session.user.id).maybeSingle();
  if (error) throw error;
  store = data;
}

function signIn() {
  view.innerHTML = `<div class="page-head"><div><h1>Import from Screenshot</h1><p>Upload a supplier screenshot and prepare a product listing in your browser.</p></div></div>
    <section class="panel narrow"><h2>Sign in to Reseller Hub</h2>
    <form>${field('Email address','email','','type="email" required autocomplete="email"')}
    ${field('Password','password','','type="password" required minlength="6" autocomplete="current-password"')}
    <div class="actions"><button value="signin">Sign in</button><button class="secondary" value="signup">Create account</button></div></form></section>`;
  submit(view.querySelector('form'), async (values, button) => {
    const credentials = { email: values.get('email'), password: values.get('password') };
    const result = button.value === 'signup'
      ? await db.auth.signUp({ ...credentials, options: { emailRedirectTo: location.origin + location.pathname } })
      : await db.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    if (!result.data.session) tell('Check your email to confirm your account, then sign in.');
  });
}

function submit(form, action) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (form.dataset.busy) return;
    form.dataset.busy = 'true';
    if (button) button.disabled = true;
    tell();
    try { await action(new FormData(form), button); } catch (error) { fail(error); }
    finally {
      delete form.dataset.busy;
      if (button) button.disabled = false;
    }
  });
}

function settings() {
  view.innerHTML = `<section class="panel narrow"><h1>${store ? 'Storefront settings' : 'Create your store'}</h1>
  <p>Choose the name and address your customers will see.</p><form>
  ${field('Business name','name',store?.name,'required maxlength="100"')}
  ${field('Store address','slug',store?.slug,'required pattern="[a-z0-9][a-z0-9\\-]{1,38}[a-z0-9]" maxlength="40" placeholder="my-boutique"')}
  ${field('WhatsApp number (optional)','whatsapp',store?.whatsapp,'type="tel" placeholder="082 123 4567"')}
  <button>Save store</button></form>${store ? `<p class="actions"><a href="${esc(storefrontUrl())}" target="_blank" rel="noopener">Open my public storefront ↗</a></p>` : ''}</section>`;
  submit(view.querySelector('form'), async values => {
    let whatsapp = values.get('whatsapp').replace(/\D/g, '');
    if (whatsapp.startsWith('0')) whatsapp = '27' + whatsapp.slice(1);
    if (whatsapp && !/^27[1-9]\d{8}$/.test(whatsapp)) throw Error('Enter a valid South African WhatsApp number.');
    const { error } = await db.from('reseller_stores').upsert({
      owner_id: session.user.id, name: values.get('name').trim(), slug: values.get('slug').trim(), whatsapp: whatsapp || null,
    });
    if (error?.code === '23505') throw Error('That store address is already taken.');
    if (error) throw error;
    await getStore();
    if (route() !== 'import') location.hash = 'import';
    else render();
  });
}

function canvasImage(bitmap, region, limit, maxLength) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, limit / Math.max(region.width, region.height));
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
  for (const quality of [.93, .82, .69, .53, .38]) {
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    if (jpeg.length <= maxLength) return jpeg;
  }
  throw Error('Image is too detailed to save. Try a smaller source.');
}

function crop(bitmap, box) {
  const { left, top, right, bottom } = box;
  if (![left, top, right, bottom].every(Number.isInteger) || left < 0 || top < 0 || right > 1000 ||
      bottom > 1000 || right <= left || bottom <= top) return '';
  const width = (right - left) * bitmap.width / 1000;
  const height = (bottom - top) * bitmap.height / 1000;
  if (width < 100 || height < 100) return '';
  return canvasImage(bitmap, { x: left * bitmap.width / 1000, y: top * bitmap.height / 1000, width, height }, 1400, 940000);
}

function syncProgress() {
  const source = view.querySelector('#source');
  if (!source) return;
  if (screenshot) source.src = screenshot;
  source.hidden = !screenshot;
  view.querySelector('#drop-placeholder').hidden = Boolean(screenshot);
  view.querySelector('#upload-status').textContent = importStatus;
  view.querySelector('.processing').classList.toggle('busy', importing);
  view.querySelectorAll('#processing li').forEach((li, index) => li.classList.toggle('done', lastSteps.includes(index)));
  view.querySelectorAll('.steps li').forEach((li, index) => li.classList.toggle('active', index <= (drafts.length ? 2 : importing ? 1 : 0)));
}

async function importFiles(files) {
  if (importing || !files.length) return;
  importing = true;
  const run = generation;
  const batch = [...files].slice(0, 10);
  const errors = [];
  let worker;
  let readerUnavailable = false;
  if (files.length > batch.length) errors.push('A batch accepts up to 10 screenshots.');
  try {
    for (const [index, file] of batch.entries()) {
      if (run !== generation) return;
      let bitmap;
      lastSteps = [];
      importStatus = `Processing ${index + 1} of ${batch.length}…`;
      syncProgress();
      try {
        if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15_000_000) {
          throw Error('Use a PNG, JPG or WEBP image under 15 MB.');
        }
        bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 32_000_000) throw Error('Screenshot dimensions are too large.');
        if (run !== generation) return;
        screenshot = canvasImage(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, 2000, 3_900_000);
        syncProgress();
        lastSteps = [0];
        let text = '';
        if (!readerUnavailable) {
          try {
            worker ||= await screenshotReader.createWorker(message => {
              if (run !== generation) return;
              importStatus = `${batch.length === 1 ? '' : `${index + 1}/${batch.length} · `}${message}`;
              syncProgress();
            });
            if (run !== generation) return;
            const result = await worker.recognize(screenshot);
            text = result.data.text.trim();
          } catch {
            readerUnavailable = true;
            errors.push('Text reading was unavailable. You can still review the photo and enter details.');
          }
        }
        if (run !== generation) return;
        const product = screenshotReader.details(text);
        if (!text) product.review.push('No readable text was found. Enter the product details and check the photo.');
        const photos = screenshotReader.photoRegions(bitmap).map(box => crop(bitmap, box)).filter(Boolean);
        if (photos.length) lastSteps.push(1,2);
        if (text) lastSteps.push(3);
        if (product.sizes.length || product.colours.length || product.offers.some(offer => offer.supplier_cents != null)) lastSteps.push(4);
        lastSteps.push(5);
        if (photos.length > 1) product.review.push('Several photo areas were found. Choose the photo for this listing and confirm that the details match.');
        if (!drafts.length) selected = 0;
        drafts.push({
          ...product, photos, sourceFile: file, id: crypto.randomUUID(), image: photos[0] || '',
          stock: 0, delivery: 'Delivery and collection',
        });
        if (route() === 'import' && view.querySelector('#review')) renderDrafts();
      } catch (error) {
        errors.push(`${file.name} — ${error.message}`);
      } finally { bitmap?.close(); }
    }
  } finally {
    await worker?.terminate().catch(() => {});
    if (run === generation) {
      importing = false;
      importStatus = errors.join(' ') || (drafts.length ? 'Review your extracted listings.' : '');
      syncProgress();
    }
  }
}

function showImporter() {
  view.replaceChildren(document.querySelector('#import-template').content.cloneNode(true));
  const input = view.querySelector('#screenshots');
  input.addEventListener('change', () => { importFiles(input.files); input.value = ''; });
  const drop = view.querySelector('#drop');
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', event => {
    event.preventDefault();
    drop.classList.remove('drag');
    importFiles(event.dataTransfer.files);
  });
  syncProgress();
  renderDrafts();
}

function renderDrafts() {
  const tabs = view.querySelector('#draft-list');
  const review = view.querySelector('#review');
  tabs.replaceChildren();
  drafts.forEach((draft, index) => {
    const button = document.createElement('button');
    button.textContent = draft.name || 'Product ' + (index + 1);
    button.className = index === selected ? '' : 'secondary';
    button.onclick = () => { selected = index; renderDrafts(); };
    tabs.append(button);
  });
  const product = drafts[selected];
  if (!product) {
    review.className = 'empty';
    review.innerHTML = '<span aria-hidden="true">✦</span><strong>Your product preview</strong><p>Your extracted photo, product details and selling price fields will appear here.</p>';
    return;
  }
  review.className = '';
  editProduct(review, product, async () => {
    drafts = drafts.filter(draft => draft !== product);
    selected = Math.max(0, Math.min(selected, drafts.length - 1));
    renderDrafts();
    syncProgress();
    const link = document.createElement('a');
    link.href = storefrontUrl();
    link.textContent = ' Open my store ↗';
    link.target = '_blank';
    link.rel = 'noopener';
    tell('Product published.');
    notice.append(link);
  }, true);
}

const cents = value => value === '' ? null : Math.round(Number(value) * 100);

function editProduct(target, product, onSave, importingProduct = false) {
  const photos = product.photos?.length ? product.photos : [product.image].filter(Boolean);
  target.innerHTML = `<form>
    <div class="review-grid"><div><div data-cover>${image(product.image, product.name)}</div>
    ${photos.length > 1 ? `<div class="thumbnails">${photos.map((photo, i) => `<button type="button" data-photo="${i}" aria-label="Use photo ${i + 1}">${image(photo,'')}</button>`).join('')}</div>` : ''}
    ${importingProduct ? '' : '<label class="field">Replace photo<input type="file" name="replacement" accept="image/png,image/jpeg,image/webp"></label>'}
    ${product.sourceFile ? '<button type="button" class="secondary" data-adjust>Adjust photo crop</button><div data-crop-editor hidden></div>' : ''}
    ${product.image || !importingProduct ? '' : '<p class="message" data-photo-warning>Choose the product area with Adjust photo crop before publishing.</p>'}
    ${(product.review || []).map(message => `<p class="message">${esc(message)}</p>`).join('')}</div><div>
    ${field('Product name','name',product.name,'maxlength="120" required')}
    <label class="field">Description<textarea name="description" maxlength="1500" required>${esc(product.description)}</textarea></label>
    ${field('Category','category',product.category,'maxlength="80"')}
    ${field('Colours (comma separated)','colours',product.colours.join(', '))}
    ${field('Sizes (comma separated)','sizes',product.sizes.join(', '))}
    ${field('Stock quantity','stock',product.stock,'type="number" min="0" max="2147483647" required')}
    <label class="field">Fulfilment<select name="delivery">${['Delivery and collection','Delivery','Collection'].map(option =>
      `<option ${option === product.delivery ? 'selected' : ''}>${option}</option>`).join('')}</select></label>
    </div></div>
    <div data-offers></div><div class="actions"><button type="button" class="secondary" data-add>Add quantity option</button></div>
    <button class="publish" ${!product.image && importingProduct ? 'disabled' : ''}>${importingProduct ? '✓ Publish to My Store' : 'Save listing'}</button>
    </form>`;
  const form = target.querySelector('form');
  const offers = form.querySelector('[data-offers]');
  function renderOffers() {
    offers.innerHTML = product.offers.map((offer, index) => `<fieldset class="price" data-option="${index}">
      <legend>Buy ${esc(offer.quantity ?? '')}</legend>
      ${field('Quantity','quantity',offer.quantity,'type="number" min="1" max="1000" step="1" required')}
      ${field('My selling price (R)','selling',offer.selling_cents == null ? '' : offer.selling_cents / 100,'type="number" min="0.01" max="1000000" step="0.01" required')}
      ${field('Supplier cost (R, private)','cost',offer.supplier_cents == null ? '' : offer.supplier_cents / 100,'type="number" min="0" max="1000000" step="0.01"')}
      <button class="secondary" type="button" data-remove="${index}" ${product.offers.length === 1 ? 'disabled' : ''}>Remove</button><small data-profit></small>
      </fieldset>`).join('');
    for (const row of offers.children) updateProfit(row);
  }
  function updateProfit(row) {
    const value = product.offers[Number(row.dataset.option)];
    row.querySelector('[data-profit]').textContent = value.selling_cents == null || value.supplier_cents == null
      ? 'Estimated gross profit —' : 'Estimated gross profit ' + rand(value.selling_cents - value.supplier_cents);
  }
  form.addEventListener('input', event => {
    const input = event.target;
    const row = input.closest('[data-option]');
    if (row) {
      product.offers[Number(row.dataset.option)] = {
        quantity: Number(row.querySelector('[name=quantity]').value) || null,
        selling_cents: cents(row.querySelector('[name=selling]').value),
        supplier_cents: cents(row.querySelector('[name=cost]').value),
      };
      row.querySelector('legend').textContent = 'Buy ' + (row.querySelector('[name=quantity]').value || '');
      updateProfit(row);
    } else if (input.name === 'colours' || input.name === 'sizes') product[input.name] = list(input.value);
    else if (['name','description','category','stock','delivery'].includes(input.name)) product[input.name] = input.value;
  });
  form.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-adjust')) {
      adjustPhoto(target, product).catch(fail);
    } else if (button.hasAttribute('data-add') && product.offers.length < 20) {
      product.offers.push({ quantity: null, selling_cents: null, supplier_cents: null });
      renderOffers();
      offers.lastElementChild.querySelector('input').focus();
    } else if (button.hasAttribute('data-remove')) {
      product.offers.splice(Number(button.dataset.remove), 1);
      renderOffers();
    } else if (button.hasAttribute('data-photo')) {
      product.image = photos[Number(button.dataset.photo)];
      updateCover(target, product);
    }
  });
  renderOffers();
  submit(form, async values => {
    const replacement = values.get('replacement');
    if (replacement?.size) {
      if (replacement.size > 15_000_000) throw Error('Use a replacement photo under 15 MB.');
      const bitmap = await createImageBitmap(replacement);
      try { product.image = canvasImage(bitmap, {x:0,y:0,width:bitmap.width,height:bitmap.height},1400,940000); }
      finally { bitmap.close(); }
    }
    const record = {
      id: product.id, name: publicText(values.get('name')), description: publicText(values.get('description')),
      category: publicText(values.get('category')), colours: list(values.get('colours')).map(publicText).filter(Boolean),
      sizes: list(values.get('sizes')).map(publicText).filter(Boolean), stock: Number(values.get('stock')),
      delivery: values.get('delivery'), image: product.image, published: importingProduct || product.published,
    };
    if (!record.name || !record.description || !record.image) throw Error('Provide a product photo, name and description.');
    if (new Set(product.offers.map(offer => offer.quantity)).size !== product.offers.length) throw Error('Each quantity must be unique.');
    const { error } = await db.rpc('reseller_save_product', { product: record, prices: product.offers });
    if (error) throw error;
    await onSave();
  });
}

function updateCover(target, product) {
  target.querySelector('[data-cover]').innerHTML = image(product.image, product.name);
  target.querySelector('[data-photo-warning]')?.remove();
  target.querySelector('.publish').disabled = false;
}

async function adjustPhoto(target, product) {
  const editor = target.querySelector('[data-crop-editor]');
  if (!editor.hidden) {
    editor.hidden = true;
    return;
  }
  const original = await createImageBitmap(product.sourceFile);
  let preview;
  try {
    preview = canvasImage(original, { x: 0, y: 0, width: original.width, height: original.height }, 1200, 940000);
  } finally {
    original.close();
  }
  editor.hidden = false;
  editor.innerHTML = `<p>Drag a box around the product photo, or enter crop edges as percentages.</p>
    <div class="crop-preview"><img src="${preview}" alt="Supplier screenshot for cropping" draggable="false"><span aria-hidden="true"></span></div>
    <div class="crop-fields">${[['left',0],['top',0],['right',100],['bottom',100]].map(([edge,value]) =>
      `<label class="field">${edge}<input type="number" value="${value}" data-edge="${edge}"></label>`).join('')}</div>
    <button type="button" class="secondary" data-apply-crop>Apply crop</button>`;
  const frame = editor.querySelector('.crop-preview');
  const selection = frame.querySelector('span');
  const fields = [...editor.querySelectorAll('[data-edge]')];
  const readBox = () => Object.fromEntries(fields.map(input => [input.dataset.edge, Number(input.value)]));
  function showBox() {
    const {left, top, right, bottom} = readBox();
    selection.style.inset = `${top}% ${100 - right}% ${100 - bottom}% ${left}%`;
  }
  function point(event) {
    const bounds = frame.getBoundingClientRect();
    const percent = x => Math.round(Math.max(0, Math.min(1, x)) * 100);
    return [percent((event.clientX - bounds.left) / bounds.width), percent((event.clientY - bounds.top) / bounds.height)];
  }
  let start;
  frame.onpointerdown = event => {
    if (!event.isPrimary || event.button !== 0) return;
    start = point(event);
    frame.setPointerCapture(event.pointerId);
  };
  frame.onpointermove = event => {
    if (!start || !event.isPrimary) return;
    const [x,y] = point(event);
    const [sx,sy] = start;
    const edges = [Math.min(x,sx), Math.min(y,sy), Math.max(x,sx), Math.max(y,sy)];
    fields.forEach((input,index) => { input.value = edges[index]; });
    showBox();
  };
  frame.onpointerup = frame.onpointercancel = () => { start = null; };
  fields.forEach(input => { input.oninput = showBox; });
  editor.querySelector('[data-apply-crop]').onclick = async event => {
    const button = event.currentTarget;
    try {
      tell();
      button.disabled = true;
      const bitmap = await createImageBitmap(product.sourceFile);
      try {
        const box = Object.fromEntries(Object.entries(readBox()).map(([edge,value]) => [edge, Math.round(value * 10)]));
        const photo = crop(bitmap, box);
        if (!photo) throw Error('Select a larger product photo area.');
        product.image = photo;
      } finally {
        bitmap.close();
      }
      updateCover(target, product);
      editor.hidden = true;
    } catch (error) { fail(error); }
    finally { button.disabled = false; }
  };
  showBox();
}

async function getProducts(owner, privateView) {
  const publicFields = 'id,name,description,category,colours,sizes,delivery,stock,image,published,reseller_prices(quantity,selling_cents)';
  let query = db.from('reseller_products').select(publicFields + (privateView ? ',reseller_costs(quantity,supplier_cents)' : '')).eq('owner_id', owner);
  if (!privateView) query = query.eq('published', true);
  const { data, error } = await query.order('created_at', { ascending:false });
  if (error) throw error;
  return data.map(product => ({
    ...product, offers: product.reseller_prices.sort((a,b) => a.quantity - b.quantity).map(price => ({
      ...price, supplier_cents: product.reseller_costs?.find(cost => cost.quantity === price.quantity)?.supplier_cents ?? null,
    })),
  }));
}

async function catalogue(expectedRoute) {
  const products = await getProducts(session.user.id, true);
  if (route() !== expectedRoute) return;
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort();
  view.innerHTML = `<h1>${expectedRoute === 'catalogue' ? 'Catalogue' : 'My Products'}</h1>
    <div class="actions">${field('Search products','search','','type="search"')}
    <label class="field">Category<select id="category"><option value="">All categories</option>${categories.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
    <a class="button" href="#import">Import products</a><button class="secondary" id="new-listing">Add listing</button></div><div class="cards"></div>`;
  const search = view.querySelector('input');
  const category = view.querySelector('select');
  const cards = view.querySelector('.cards');
  const show = () => {
    const matches = products.filter(product => product.name.toLowerCase().includes(search.value.toLowerCase())
      && (!category.value || category.value === product.category));
    cards.innerHTML = matches.map(product => `<article class="panel">${image(product.image, product.name)}<h3>${esc(product.name)}</h3>
      <p>${product.published ? 'Published' : 'Unpublished'} · ${product.stock} in stock</p>
      <div class="actions"><button data-edit="${product.id}">Edit</button><button class="secondary" data-toggle="${product.id}">${product.published ? 'Unpublish' : 'Publish'}</button>
      <button class="secondary" data-copy="${product.id}">Duplicate</button></div></article>`).join('') || '<p>No matching listings.</p>';
  };
  search.oninput = show;
  category.onchange = show;
  function openEditor(listing) {
    view.innerHTML = `<a href="#${expectedRoute}" id="back-to-catalogue">← Back to products</a><h1>Edit listing</h1><div class="panel" id="editor"></div>`;
    view.querySelector('#back-to-catalogue').onclick = event => {
      event.preventDefault();
      catalogue(expectedRoute).catch(fail);
    };
    editProduct(view.querySelector('#editor'), listing, async () => { await catalogue(expectedRoute); tell('Listing saved.'); });
  }
  view.querySelector('#new-listing').onclick = () => openEditor({
    id: crypto.randomUUID(), name: '', description: '', category: '', image: '', stock: 0,
    colours: [], sizes: [], published: false, delivery: 'Delivery and collection',
    offers: [{ quantity: 1, selling_cents: null, supplier_cents: null }],
  });
  cards.onclick = async event => {
    const button = event.target.closest('button');
    if (!button) return;
    const product = products.find(item => item.id === (button.dataset.edit || button.dataset.toggle || button.dataset.copy));
    if (!product) return;
    tell();
    try {
      if (button.dataset.toggle) {
        const { error } = await db.from('reseller_products').update({ published: !product.published }).eq('id', product.id);
        if (error) throw error;
        await catalogue(expectedRoute);
      } else {
        const listing = button.dataset.copy ? { ...product, id:crypto.randomUUID(), name:product.name + ' (copy)', published:false } : product;
        openEditor(listing);
      }
    } catch (error) { fail(error); }
  };
  show();
}

async function publicStore() {
  document.body.classList.add('public');
  const { data: shop, error } = await db.from('reseller_stores').select('owner_id,name,whatsapp').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!shop) { view.innerHTML = '<h1>Store unavailable</h1>'; return; }
  document.title = shop.name + ' | SGC Network';
  const products = await getProducts(shop.owner_id, false);
  view.innerHTML = `<h1>${esc(shop.name)}</h1><p>Shop the collection</p><div class="cards">${products.map(product =>
    `<article class="panel">${image(product.image, product.name)}<h3>${esc(product.name)}</h3><p>${esc(product.description)}</p>
    <p>${esc([...product.colours,...product.sizes].join(' · '))}</p><p>${esc(product.delivery)}</p>
    ${product.offers.map(offer => `<p>Buy ${offer.quantity} · <strong>${rand(offer.selling_cents)}</strong></p>`).join('')}
    ${product.stock && shop.whatsapp ? `<a class="button" href="https://wa.me/${esc(shop.whatsapp)}?text=${encodeURIComponent('Hi! I am interested in ' + product.name)}" target="_blank" rel="noopener">Order on WhatsApp</a>` : ''}
    ${product.stock ? '' : '<p>Out of stock</p>'}</article>`).join('') || '<p>No listings yet.</p>'}</div><p class="actions">Powered by SGC Network</p>`;
}

async function render() {
  if (slug) { await publicStore(); return; }
  const page = route();
  document.querySelectorAll('#navigation a').forEach(link => {
    if (link.hash === '#' + page) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('#logout').hidden = !session;
  if (!session) { signIn(); return; }
  if (!store || ['settings','storefront'].includes(page)) { settings(); return; }
  if (page === 'import') { showImporter(); return; }
  view.innerHTML = '<p>Loading…</p>';
  if (page === 'products' || page === 'catalogue') { await catalogue(page); return; }
  if (page === 'dashboard') {
    view.innerHTML = `<h1>${esc(store.name)}</h1><div class="actions"><a class="button" href="#import">Import a product</a>
      <a class="button secondary" href="${esc(storefrontUrl())}" target="_blank" rel="noopener">Open storefront ↗</a></div>`;
    return;
  }
  const title = page[0].toUpperCase() + page.slice(1);
  view.innerHTML = `<h1>${title}</h1><div class="panel"><p>${title} will be available after checkout is connected.</p></div>`;
}

if (!db) tell('Could not load the account service. Reload this page to try again.');
else if (slug) publicStore().catch(fail);
else {
  db.auth.onAuthStateChange((_event, next) => {
    if (session && next && session.user.id === next.user.id) { session = next; return; }
    session = next;
    store = null;
    drafts = [];
    selected = 0;
    screenshot = '';
    importing = false;
    importStatus = '';
    lastSteps = [];
    const accountGeneration = ++generation;
    setTimeout(async () => {
      try {
        if (accountGeneration !== generation) return;
        if (session) await getStore();
        if (accountGeneration === generation) await render();
      } catch (error) { fail(error); }
    });
  });
  window.addEventListener('hashchange', () => render().catch(fail));
  document.querySelector('#logout').onclick = async () => {
    const { error } = await db.auth.signOut();
    if (error) fail(error);
  };
}
