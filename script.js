const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (nav && !nav.querySelector('a[href="/how-to/"]')) {
  const howToLink = document.createElement("a");
  howToLink.href = "/how-to/";
  howToLink.textContent = "How-To";

  const faqLink = nav.querySelector('a[href="#faq"]');
  const appButton = nav.querySelector(".button");
  if (faqLink) nav.insertBefore(howToLink, faqLink);
  else if (appButton) nav.insertBefore(howToLink, appButton);
  else nav.appendChild(howToLink);
}

if (nav && !nav.querySelector('a[href="/releases/v1.4.0/"]')) {
  const releaseLink = document.createElement("a");
  releaseLink.href = "/releases/v1.4.0/";
  releaseLink.textContent = "v1.4.0";
  const appButton = nav.querySelector(".button");
  if (appButton) nav.insertBefore(releaseLink, appButton);
  else nav.appendChild(releaseLink);
}

function normalizeReleaseCopy() {
  const replacements = new Map([
    ["HerdHarbor Alpha · Version 1.3.0", "HerdHarbor Alpha · Version 1.4.0"],
    ["Current release v1.3.0 Alpha", "Current release v1.4.0 Alpha"],
    ["Coming in Alpha v1.4.0", "Coming in Alpha v1.5.0"],
    ["Business controls are planned for Alpha v1.4.0 and remain subject to pilot testing.", "Business controls are planned for Alpha v1.5.0 and remain subject to pilot testing."],
    ["Business controls are planned for Alpha v1.4.0", "Business controls are planned for Alpha v1.5.0"]
  ]);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    let value = node.nodeValue;
    replacements.forEach((replacement, original) => {
      if (value.includes(original)) value = value.replaceAll(original, replacement);
    });
    node.nodeValue = value;
  });

  const heroVersion = document.querySelector(".hero-card .version, .hero-visual .version, [data-current-version]");
  if (heroVersion && heroVersion.textContent.trim() === "v1.3.0") heroVersion.textContent = "v1.4.0";
}

normalizeReleaseCopy();

function addReleaseBanner() {
  if (document.querySelector(".hh-release-banner")) return;
  const header = document.querySelector(".site-header");
  const main = document.querySelector("main");
  if (!header && !main) return;

  const style = document.createElement("style");
  style.textContent = `
    .hh-release-banner{background:#0D2A46;color:#fff;border-bottom:1px solid rgba(130,208,204,.24)}
    .hh-release-banner-inner{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px}
    .hh-release-banner-copy{display:flex;align-items:center;gap:12px;min-width:0}
    .hh-release-banner-badge{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#82D0CC;color:#0D2540;font-size:.74rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
    .hh-release-banner-copy span:last-child{line-height:1.45;color:#E8F0F3}
    .hh-release-banner a{flex:0 0 auto;color:#fff;font-weight:800;text-decoration:none;border-bottom:1px solid #82D0CC}
    @media(max-width:700px){.hh-release-banner-inner{padding:11px 18px;align-items:flex-start}.hh-release-banner-copy{align-items:flex-start;flex-direction:column;gap:6px}.hh-release-banner a{margin-top:4px}}
  `;
  document.head.appendChild(style);

  const banner = document.createElement("aside");
  banner.className = "hh-release-banner";
  banner.setAttribute("aria-label", "HerdHarbor Alpha v1.4.0 release");
  banner.innerHTML = `<div class="hh-release-banner-inner"><div class="hh-release-banner-copy"><span class="hh-release-banner-badge">Alpha v1.4.0</span><span><strong>Breeding Intelligence is here.</strong> Rabbit genetic profiles, pedigree evidence, Pair Analysis and possible offspring-color predictions are now part of HerdHarbor.</span></div><a href="/releases/v1.4.0/">See what’s new →</a></div>`;
  if (header?.parentNode) header.parentNode.insertBefore(banner, header.nextSibling);
  else main?.parentNode?.insertBefore(banner, main);
}

addReleaseBanner();

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

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const form = document.getElementById("waitlist-form");
const status = document.getElementById("form-status");

if (form && status) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    status.className = "form-status";
    status.textContent = "Sending your early-access request…";
    try {
      const response = await fetch(form.action, { method: form.method, body: new FormData(form), headers: { "Accept": "application/json" } });
      if (response.ok) {
        form.reset();
        status.className = "form-status success";
        status.textContent = "You’re on the tester update list! Watch your inbox for HerdHarbor news.";
      } else {
        const data = await response.json().catch(() => null);
        const message = data?.errors?.map((error) => error.message).join(", ") || "We could not submit the form. Please try again or email hello@herdharbor.com.";
        throw new Error(message);
      }
    } catch (error) {
      status.className = "form-status error";
      status.textContent = error.message || "We could not submit the form. Please try again or email hello@herdharbor.com.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}
