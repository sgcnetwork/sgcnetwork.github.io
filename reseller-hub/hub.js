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
  view.innerHTML = `<div class="page-head"><div><h1>Import from Screenshot</h1><p>Upload a supplier screenshot and let AI prepare your product listing.</p></div></div>
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
        const { data, error } = await db.functions.invoke('reseller-import', { body: { image: screenshot } });
        if (error) {
          const response = await error.context?.json?.().catch(() => null);
          throw Error(response?.error || 'Could not connect to screenshot extraction.');
        }
        if (run !== generation) return;
        lastSteps = [0];
        if (data.review.length) errors.push(...data.review);
        const extracted = data.products.map(product => {
          const photos = product.photos.map(box => crop(bitmap, box)).filter(Boolean);
          const offers = [...new Map(product.offers
            .filter(offer => Number.isInteger(offer.quantity) && offer.quantity >= 1 && offer.quantity <= 1000)
            .map(offer => [offer.quantity, { ...offer, selling_cents: null }])).values()].slice(0, 20);
          return {
            ...product, id: crypto.randomUUID(), name: publicText(product.name), description: publicText(product.description),
            photos, image: photos[0] || '', stock: 0, delivery: 'Delivery and collection',
            offers: offers.length ? offers : [{ quantity: 1, supplier_cents: null, selling_cents: null }],
          };
        });
        if (extracted.length) {
          const foundPhoto = extracted.some(product => product.photos.length);
          lastSteps = foundPhoto ? [0,1,2,3,4,5] : [0,3,4];
          if (!drafts.length) selected = 0;
          drafts.push(...extracted);
          if (route() === 'import') renderDrafts();
        } else if (!data.review.length) {
          errors.push('No product could be identified. Try the original supplier photo or a clearer screenshot.');
        }
      } catch (error) {
        errors.push(`${file.name} — ${error.message}`);
        if (/awaiting activation|allowance reached|pilot limit/i.test(error.message)) break;
      } finally { bitmap?.close(); }
    }
  } finally {
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
    ${product.image || !importingProduct ? '' : '<p class="message">A reliable product photo could not be extracted. Upload a clearer screenshot to publish this product.</p>'}
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
    if (button.hasAttribute('data-add') && product.offers.length < 20) {
      product.offers.push({ quantity: null, selling_cents: null, supplier_cents: null });
      renderOffers();
      offers.lastElementChild.querySelector('input').focus();
    } else if (button.hasAttribute('data-remove')) {
      product.offers.splice(Number(button.dataset.remove), 1);
      renderOffers();
    } else if (button.hasAttribute('data-photo')) {
      product.image = photos[Number(button.dataset.photo)];
      target.querySelector('[data-cover]').innerHTML = image(product.image, product.name);
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
