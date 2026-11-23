const menu = JSON.parse(document.querySelector("#menu-data").textContent);
const counts = menu.map(() => 0);
const bag = document.querySelector("#bag");
const total = document.querySelector("#total");
const badge = document.querySelector("#nav-count");
const preview = document.querySelector("#preview-order");
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const summaryText = document.querySelector("#summary-text");
const orderLink = document.querySelector("#order-link");
const checkoutButton = document.querySelector("#open-checkout");
const checkout = document.querySelector("#checkout");
const checkoutResult = document.querySelector("#checkout-result");
const checkoutItems = document.querySelector("#checkout-items");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutConfirmation = document.querySelector("#checkout-confirmation");

function quantityButton(index, change) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = change > 0 ? "+" : "−";
  button.setAttribute("aria-label", (change > 0 ? "Add one " : "Remove one ") + menu[index].name);
  button.dataset.control = index + ":" + change;
  button.addEventListener("click", () => update(index, change, true));
  return button;
}

function update(index, change, fromBag = false) {
  counts[index] = Math.max(0, counts[index] + change);
  render();
  status.textContent = menu[index].name + " quantity " + counts[index] + ". Menu total " + total.textContent + ".";
  if (fromBag) {
    const next = bag.querySelector('[data-control="' + index + ':' + change + '"]') ||
      document.querySelector('[data-add="' + index + '"]');
    next.focus({ preventScroll: true });
  }
}

function render() {
  let quantity = 0;
  let subtotal = 0;
  bag.replaceChildren();
  menu.forEach(({ name, price, offer }, index) => {
    const count = counts[index];
    if (!count) return;
    quantity += count;
    subtotal += price * count;
    const row = document.createElement("div");
    row.className = "bag-row";
    const label = document.createElement("strong");
    label.textContent = name;
    const group = document.createElement("small");
    group.textContent = offer;
    label.append(group);
    const controls = document.createElement("div");
    controls.className = "quantity";
    controls.append(quantityButton(index, -1), document.createTextNode(count), quantityButton(index, 1));
    row.append(label, controls);
    bag.append(row);
  });
  if (!quantity) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Your bag is empty. Add something from the menu.";
    bag.append(empty);
  }
  badge.hidden = !quantity;
  badge.textContent = quantity;
  total.textContent = "R" + subtotal;
  preview.disabled = !quantity;
  checkoutButton.disabled = !quantity;
  summary.hidden = true;
}

document.querySelectorAll("[data-add]").forEach(button => {
  button.addEventListener("click", () => update(Number(button.dataset.add), 1));
});

preview.addEventListener("click", () => {
  const items = menu.flatMap(({ name, offer }, index) => counts[index] ? [counts[index] + " × " + name + " (" + offer + ")"] : []);
  if (!items.length) return;
  summaryText.textContent = items.join(", ") + ". Ask Rashid’s to confirm current prices and pickup.";
  const message = "Hi Rashid’s, could you confirm availability and current prices for collection? I’m interested in " + items.join(", ") + ". Thank you.";
  orderLink.href = "https://wa.me/27723688296?text=" + encodeURIComponent(message);
  summary.hidden = false;
  status.textContent = "Collection enquiry ready to preview.";
  orderLink.focus();
});

checkoutButton.addEventListener("click", () => {
  if (!counts.some(Boolean)) return;
  checkout.returnValue = "";
  checkoutItems.replaceChildren();
  menu.forEach(({ name, price, offer }, index) => {
    const count = counts[index];
    if (!count) return;
    const line = document.createElement("li");
    const label = document.createElement("span");
    const amount = document.createElement("strong");
    label.textContent = count + " × " + name;
    const group = document.createElement("small");
    group.textContent = offer;
    label.append(group);
    amount.textContent = "R" + count * price;
    line.append(label, amount);
    checkoutItems.append(line);
  });
  checkoutTotal.textContent = total.textContent;
  checkout.showModal();
});

checkout.addEventListener("close", () => {
  if (checkout.returnValue !== "simulate") return;
  checkoutConfirmation.textContent = "You completed the sample card checkout for " + checkoutTotal.textContent + ".";
  checkoutResult.showModal();
});
