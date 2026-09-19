const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
if (toggle) toggle.addEventListener("click", () => nav.classList.toggle("open"));

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

document.getElementById("year").textContent = new Date().getFullYear();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll(".service-card, .step, .about > div, .contact-card").forEach(el => {
  el.style.opacity = "0";
  el.style.transform = "translateY(18px)";
  el.style.transition = "opacity .65s ease, transform .65s ease";
  observer.observe(el);
});
