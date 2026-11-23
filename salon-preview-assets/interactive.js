const form = document.querySelector('#booking-form');
const {service, day, time, addon, payment} = form.elements;
const summary = document.querySelector('#booking-summary');
const result = form.querySelector('.result');
const appointmentStatus = document.querySelector('#appointment-status');
const list = document.querySelector('#appointment-list');
const stopEdit = document.querySelector('#stop-edit');
const mode = document.querySelector('#form-mode');
const cards = [...document.querySelectorAll('.card[data-service]')];
const salonSlug = location.pathname.split('/')[1];
const key = 'sgc-salon-demo-v1:' + salonSlug;
const previousMenus = {
  'serahs-beauty-spot': ['Beauty treatments', 'Special-occasion prep', 'Beauty consultations'],
  'nellys-nails-and-lash-bar': ['Nail sets', 'Lash appointments', 'Nail maintenance']
};
const formatMoney = new Intl.NumberFormat('en-ZA', {style:'currency',currency:'ZAR',maximumFractionDigits:2});
const formatDate = new Intl.DateTimeFormat('en-ZA', {dateStyle:'long'});
const formatLocalDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'});
const dateParts = Object.fromEntries(formatLocalDate.formatToParts(new Date()).map(part => [part.type, part.value]));
const today = dateParts.year + '-' + dateParts.month + '-' + dateParts.day;
let fallback = null;
let editing = null;

function make(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function sampleOffer(name, index) {
  if (/consultation|removal|tidy/i.test(name)) return {minutes:30,price:150};
  if (/braid|protective|brazilian|occasion makeup/i.test(name)) return {minutes:120,price:650};
  if (/fade|clipper|trim|haircut/i.test(name)) return {minutes:30,price:180};
  return [{minutes:45,price:260},{minutes:60,price:350},{minutes:75,price:430}][index];
}

const menu = new Map(cards.map((card, index) => {
  const name = card.dataset.service;
  const { minutes, price } = card.dataset;
  const offer = minutes && price ? { minutes: Number(minutes), price: Number(price) } : sampleOffer(name, index);
  card.querySelector('h3').after(make('p', formatMoney.format(offer.price) + ' · ' + offer.minutes + ' min · Sample', 'sample-price'));
  return [name, offer];
}));
service.replaceChildren(new Option('Choose a service', ''), ...[...menu.keys()].map(name => new Option(name)));
if (Object.hasOwn(previousMenus, salonSlug)) {
  const existingServices = new Set(loadBookings().map(record => record?.service));
  previousMenus[salonSlug].forEach((name, index) => {
    if (!existingServices.has(name)) return;
    menu.set(name, sampleOffer(name, index));
    service.add(new Option(name + ' (previous demo menu)', name));
  });
}
day.min = today;

function loadBookings() {
  if (fallback) return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveBookings(records) {
  try {
    localStorage.setItem(key, JSON.stringify(records));
    fallback = null;
    return true;
  } catch {
    fallback = records;
    return false;
  }
}

function readBookings() {
  return loadBookings().filter(record => record && menu.has(record.service) && /^\d{4}-\d{2}-\d{2}$/.test(record.day)
    && Number.isInteger(record.start) && Number.isInteger(record.minutes));
}

function readOffer() {
  const offer = menu.get(service.value);
  if (!offer) return null;
  return {
    minutes: offer.minutes + (addon.checked ? 15 : 0),
    total: offer.price + (addon.checked ? 50 : 0)
  };
}

function timeLabel(start) {
  return String(Math.floor(start / 60)).padStart(2, '0') + ':' + String(start % 60).padStart(2, '0');
}

function dateLabel(value) {
  return formatDate.format(new Date(value + 'T12:00:00+02:00'));
}

function availableTimes(offer, records) {
  if (!offer || !day.value || day.value < today) return [];
  const now = new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  return Array.from({length:18}, (_, index) => 540 + index * 30).filter(start =>
    start + offer.minutes <= 1080 && (day.value !== today || timeLabel(start) > now)
    && records.every(record => record.id === editing || record.day !== day.value
      || start >= record.start + record.minutes || start + offer.minutes <= record.start));
}

function refreshForm(preferredTime = time.value) {
  const offer = readOffer();
  const slots = availableTimes(offer, readBookings());
  const prompt = offer && day.value ? (slots.length ? 'Choose a time' : 'No times available. Try another date.') : 'Choose a service and date first';
  time.replaceChildren(new Option(prompt, ''), ...slots.map(start => new Option(timeLabel(start), start)));
  time.value = slots.some(start => String(start) === preferredTime) ? preferredTime : '';
  time.disabled = slots.length === 0;
  if (!offer) {
    summary.textContent = 'Choose a service to see its sample price and duration.';
    return;
  }
  const deposit = payment.value === 'deposit' ? offer.total / 4 : 0;
  summary.textContent = offer.minutes + ' min · Sample total ' + formatMoney.format(offer.total)
    + '\nSimulated deposit: ' + formatMoney.format(deposit) + ' · Balance: ' + formatMoney.format(offer.total - deposit);
}

function resetForm() {
  editing = null;
  form.reset();
  result.textContent = '';
  mode.textContent = 'New appointment';
  stopEdit.hidden = true;
  refreshForm('');
}

function renderBookings() {
  const records = readBookings().sort((a,b) => a.day.localeCompare(b.day) || a.start - b.start);
  list.replaceChildren();
  if (!records.length) list.append(make('p','Your demo appointments will appear here.'));
  for (const record of records) {
    const article = make('article','','appointment-card');
    const details = make('div','');
    details.append(make('h3',record.service), make('p',dateLabel(record.day) + ' · ' + timeLabel(record.start) + ' SAST · ' + record.minutes + ' min'),
      make('p',record.id + ' · Sample total ' + formatMoney.format(record.total) + ' · Simulated deposit ' + formatMoney.format(record.deposit)));
    const actions = make('div','','appointment-actions');
    for (const [label, action] of [['Reschedule','edit'],['Cancel booking','cancel']]) {
      const button = make('button',label,'pill');
      button.type = 'button';
      button.dataset.action = action;
      button.dataset.id = record.id;
      actions.append(button);
    }
    article.append(details,actions);
    list.append(article);
  }
}

for (const card of cards) card.addEventListener('click', () => {
  if (editing) resetForm();
  service.value = card.dataset.service;
  result.textContent = '';
  refreshForm('');
});
form.addEventListener('change', () => {
  result.textContent = '';
  refreshForm();
});
stopEdit.addEventListener('click', resetForm);

form.addEventListener('submit', event => {
  event.preventDefault();
  const offer = readOffer();
  const records = readBookings();
  const start = Number(time.value);
  if (!payment.value || !availableTimes(offer, records).includes(start)) {
    refreshForm();
    result.textContent = 'Choose an available appointment time and a deposit option.';
    return;
  }
  const id = editing || 'DEMO-' + crypto.randomUUID().slice(0,8).toUpperCase();
  const deposit = payment.value === 'deposit' ? offer.total / 4 : 0;
  const saved = saveBookings([...records.filter(record => record.id !== id), {
    id, service:service.value, day:day.value, start, ...offer, deposit, addon:addon.checked, payment:payment.value
  }]);
  const message = editing ? 'Demo appointment updated. ' : 'Demo appointment confirmed. ';
  resetForm();
  result.textContent = message + id + '. No real payment or booking was made.' + (saved ? '' : ' Browser storage is unavailable, so this booking lasts until you close or reload the page.');
  appointmentStatus.textContent = message + id + '.';
  renderBookings();
});

list.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const records = readBookings();
  const record = records.find(item => item.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === 'cancel') {
    if (!window.confirm('Cancel this demo appointment?')) return;
    saveBookings(records.filter(item => item.id !== record.id));
    if (editing === record.id) resetForm();
    refreshForm();
    renderBookings();
    appointmentStatus.textContent = 'Demo appointment ' + record.id + ' cancelled.';
    appointmentStatus.tabIndex = -1;
    appointmentStatus.focus();
    return;
  }
  editing = record.id;
  service.value = record.service;
  day.value = record.day >= today ? record.day : '';
  addon.checked = record.addon;
  payment.value = record.payment;
  mode.textContent = 'Rescheduling ' + record.id;
  result.textContent = '';
  stopEdit.hidden = false;
  refreshForm(String(record.start));
  day.focus();
});

window.addEventListener('storage', event => {
  if (event.key !== key) return;
  if (editing && !readBookings().some(record => record.id === editing)) resetForm();
  renderBookings();
  refreshForm();
});
refreshForm();
renderBookings();
