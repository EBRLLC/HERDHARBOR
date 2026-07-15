const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("waitlist-form");
const status = document.getElementById("form-status");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const data = new FormData(form);
  const subject = "HerdHarbor early-access request";
  const betaInterest = data.get("beta_interest") === "Yes" ? "Yes" : "No";

  const body = [
    "HerdHarbor Early-Access Request",
    "",
    `Name: ${data.get("name")}`,
    `Email: ${data.get("email")}`,
    `Animals raised: ${data.get("animals")}`,
    `Approximate animal count: ${data.get("animal_count")}`,
    `Current recordkeeping system: ${data.get("current_system")}`,
    `Interested in beta testing: ${betaInterest}`,
    "",
    "Biggest recordkeeping frustration:",
    data.get("frustration"),
  ].join("\n");

  const mailto = `mailto:hello@herdharbor.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  status.textContent = "Opening your email app with your answers prepared…";
  window.location.href = mailto;
});
