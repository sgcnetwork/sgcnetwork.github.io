
const form = document.querySelector("form");
const enquiry = document.querySelector("#enquiry");
const service = document.querySelector("#service");
const result = document.querySelector("#result");
const menuData = document.querySelector("#menu-data");
const menu = menuData ? JSON.parse(menuData.textContent) : [];
const quantities = menu.map(() => 0);

function renderBasket() {
  const basket = document.querySelector("#basket");
  basket.replaceChildren();
  let total = 0;
  menu.forEach(({ name, price }, index) => {
    const quantity = quantities[index];
    if (!quantity) return;
    total += price * quantity;
    const row = document.createElement("div");
    row.className = "basket-row";
    const label = document.createElement("span");
    label.textContent = quantity + " × " + name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove one";
    remove.setAttribute("aria-label", "Remove one " + name);
    remove.addEventListener("click", () => {
      quantities[index] -= 1;
      renderBasket();
      (basket.querySelector("button") || form.querySelector('[type="submit"]')).focus();
    });
    row.append(label, remove);
    basket.append(row);
  });
  document.querySelector("#total").textContent = total ? "Sample total · R" + total : "Your demo order is empty.";
  result.hidden = true;
}

document.querySelectorAll("[data-choice]").forEach(button => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.choice);
    if (service) {
      service.value = String(index);
      result.hidden = true;
      service.focus({ preventScroll: true });
    } else {
      quantities[index] += 1;
      renderBasket();
      form.querySelector('[type="submit"]').focus({ preventScroll: true });
    }
    enquiry.scrollIntoView();
  });
});

if (menuData) renderBasket();

form.addEventListener("input", () => { result.hidden = true; });
form.addEventListener("submit", event => {
  event.preventDefault();
  if (service) {
    const date = document.querySelector("#date");
    const [year, month, day] = date.value.split("-");
    const formattedDate = date.value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(year, month - 1, day)) : "";
    result.textContent = "Demo request for " + service.selectedOptions[0].textContent + (formattedDate ? " on " + formattedDate : "") + ". No appointment was reserved.";
  } else {
    const items = menu.flatMap(({ name }, index) => quantities[index] ? [quantities[index] + " × " + name] : []);
    result.textContent = items.length ? "Demo collection request for " + items.join(", ") + ". No order was placed." : "Add an item from the menu to preview a collection request.";
  }
  result.hidden = false;
});
