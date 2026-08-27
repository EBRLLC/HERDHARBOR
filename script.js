const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const CURRENT_RELEASE = "1.5.0";

if (nav && !nav.querySelector('a[href="#shows"]')) {
  const showsLink = document.createElement("a");
  showsLink.href = "#shows";
  showsLink.textContent = "Shows";
  const geneticsLink = nav.querySelector('a[href="#genetics"]');
  const faqLink = nav.querySelector('a[href="#faq"]');
  if (geneticsLink) nav.insertBefore(showsLink, geneticsLink);
  else if (faqLink) nav.insertBefore(showsLink, faqLink);
  else nav.appendChild(showsLink);
}

if (nav && !nav.querySelector('a[href="#genetics"]')) {
  const geneticsLink = document.createElement("a");
  geneticsLink.href = "#genetics";
  geneticsLink.textContent = "Rabbit Genetics";
  const howToLink = nav.querySelector('a[href="/how-to/"]');
  if (howToLink) nav.insertBefore(geneticsLink, howToLink);
  else nav.appendChild(geneticsLink);
}

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

if (nav) {
  nav.querySelectorAll('a[href^="/releases/"]').forEach((link) => link.remove());
  const releaseLink = document.createElement("a");
  releaseLink.href = "/releases/v1.5.0/";
  releaseLink.textContent = "v1.5.0";
  const appButton = nav.querySelector(".button");
  if (appButton) nav.insertBefore(releaseLink, appButton);
  else nav.appendChild(releaseLink);
}

function updateSeoAndStructuredData() {
  const description = "HerdHarbor Alpha v1.5.0 is multi-species livestock management with animal records, pedigrees, breeding, health, finances, sales, advanced rabbit genetics, and integrated show, award, exhibitor, 4-H and FFA project tracking.";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = description;
  const og = document.querySelector('meta[property="og:description"]');
  if (og) og.content = "HerdHarbor Alpha v1.5.0 adds Shows: competition records, multiple classes and awards, judge feedback, animal and exhibitor histories, and optional 4-H/FFA projects linked to the same animals, Health, Finance, and cloud sync.";
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const data = JSON.parse(script.textContent);
      if (data?.["@type"] !== "SoftwareApplication") return;
      data.softwareVersion = "1.5.0";
      data.description = description;
      data.featureList = "Animal records, visual multi-generation pedigrees, Rabbit Genetics Pair Analysis, A/B/C/D/E inheritance, Broken En inheritance, Vienna VM/VC/BEW inheritance, phenotype-constrained color probability ranges, pedigree and offspring inference, breeding and birth management, show and competition records, multiple classes, placements and awards, judge feedback, animal show history, exhibitor achievement history, optional 4-H and FFA project records, project goals and growth tracking, health, tasks, production, finances, customers, sales, QR cards, transfers, cloud sync, backups, and Excel tools";
      script.textContent = JSON.stringify(data);
    } catch {}
  });
}

function normalizeReleaseCopy() {
  const replacements = new Map([
    ["HerdHarbor Alpha · Version 1.3.0", "HerdHarbor Alpha · Version 1.5.0"],
    ["HerdHarbor Alpha · Version 1.4.0", "HerdHarbor Alpha · Version 1.5.0"],
    ["HerdHarbor Alpha · Version 1.4.5", "HerdHarbor Alpha · Version 1.5.0"],
    ["Current release v1.3.0 Alpha", "Current release v1.5.0 Alpha"],
    ["Current release v1.4.0 Alpha", "Current release v1.5.0 Alpha"],
    ["Current release v1.4.5 Alpha", "Current release v1.5.0 Alpha"],
    ["Version 1.3.0 Alpha is available online", "Version 1.5.0 Alpha is available online"],
    ["Version 1.4.0 Alpha is available online", "Version 1.5.0 Alpha is available online"],
    ["Version 1.4.5 Alpha is available online", "Version 1.5.0 Alpha is available online"]
  ]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    let value = node.nodeValue;
    replacements.forEach((replacement, original) => { if (value.includes(original)) value = value.replaceAll(original, replacement); });
    node.nodeValue = value;
  });
  const heroVersion = document.querySelector(".hero-card .version, .hero-visual .version, [data-current-version]");
  if (heroVersion && /^v1\.(?:3\.0|4\.0|4\.5)$/.test(heroVersion.textContent.trim())) heroVersion.textContent = "v1.5.0";
}

function addShowsSection() {
  if (document.querySelector("#shows")) return;
  const genetics = document.querySelector("#genetics");
  const features = document.querySelector("#features");
  const main = document.querySelector("main");
  if (!genetics && !features && !main) return;
  const section = document.createElement("section");
  section.className = "section";
  section.id = "shows";
  section.innerHTML = `<div class="container">
    <div class="section-heading"><p class="eyebrow">Alpha v1.5.0 · Shows</p><h2>Track the animal beyond the barn.</h2><p>HerdHarbor Shows adds competition, award, exhibitor, and youth-project records without creating a second animal database. Show entries point back to the animal already in HerdHarbor, and project money and health records continue to use the same Finance and Health systems.</p></div>
    <div class="feature-grid">
      <article class="feature-card"><div class="feature-number">01</div><h3>Shows & competitions</h3><p>Record county and state fairs, 4-H, FFA, ARBA, breed-club, rabbit, poultry, livestock, open, youth, and custom show types with dates, organizations, locations, notes, and attachments.</p></article>
      <article class="feature-card"><div class="feature-number">02</div><h3>Classes, results & awards</h3><p>Enter multiple classes for the same animal, placements beyond 10th, judge names, scores, comments, strengths, improvement notes, and multiple awards tied to the correct result.</p></article>
      <article class="feature-card"><div class="feature-number">03</div><h3>Animal Show History</h3><p>See each animal’s competition history across years, including shows entered, classes, first places, awards, and championship-level results.</p></article>
      <article class="feature-card"><div class="feature-number">04</div><h3>Private exhibitor history</h3><p>Track multiple exhibitors under one HerdHarbor account and review private achievement history by year, species, animal, organization, and show type.</p></article>
      <article class="feature-card"><div class="feature-number">05</div><h3>4-H & FFA projects</h3><p>Create optional project records inside Shows with goals, notes, progress photos, growth and average daily gain, project timelines, and linked competitions.</p></article>
      <article class="feature-card"><div class="feature-number">06</div><h3>One Finance & Health system</h3><p>Show and project expenses/income use the same HerdHarbor Finance records. Project weights, treatments, medications, and observations use the same Health history—no duplicate budget or medical system.</p></article>
    </div>
    <div class="problem-card" style="margin-top:28px"><p class="eyebrow">Built for real recordkeeping</p><h3>Competition records stay connected to the farm record.</h3><p>Archive a show, animal, exhibitor, or project without deleting history. Filter larger histories by year, animal, species, breed, organization, placement, award, exhibitor, or project, and print a Project Record or Show & Awards Report when you need a clean summary.</p><div class="hero-actions"><a class="button" href="https://app.herdharbor.com/#shows">Open Shows</a><a class="button button-secondary" href="/how-to/shows/">Read the Shows guide</a></div></div>
  </div>`;
  if (genetics?.parentNode) genetics.parentNode.insertBefore(section, genetics);
  else if (features?.parentNode) features.parentNode.insertBefore(section, features);
  else main.appendChild(section);
}

function addGeneticsSection() {
  if (document.querySelector("#genetics")) return;
  const features = document.querySelector("#features");
  const main = document.querySelector("main");
  if (!features && !main) return;
  const section = document.createElement("section");
  section.className = "section";
  section.id = "genetics";
  section.innerHTML = `<div class="container">
    <div class="section-heading"><p class="eyebrow">Rabbit Genetics</p><h2>Pair rabbits using inheritance evidence—not a generic color list.</h2><p>HerdHarbor Pair Analysis combines recorded phenotype, genotype, pedigree, offspring history, and deterministic inheritance rules to calculate actual possible offspring coat colors. When carrier status is unresolved, HerdHarbor shows a genetic minimum-to-maximum range instead of pretending the missing allele is known.</p></div>
    <div class="feature-grid">
      <article class="feature-card"><div class="feature-number">01</div><h3>Actual color ranges</h3><p>Possible offspring colors are shown by breeder-readable name with exact percentages when genetics are resolved and min–max ranges when a carrier allele is still unknown.</p></article>
      <article class="feature-card"><div class="feature-number">02</div><h3>A/B/C/D/E inheritance</h3><p>The core color loci are crossed allele-by-allele. Phenotype constrains unresolved positions so an underscore means unknown—not unrestricted and not “stop calculating.”</p></article>
      <article class="feature-card"><div class="feature-number">03</div><h3>Broken En inheritance</h3><p>En/en spotting is calculated separately from the base coat color, allowing Broken and solid outcomes to be evaluated without confusing pattern genetics with base color.</p></article>
      <article class="feature-card"><div class="feature-number">04</div><h3>Vienna VM / VC / BEW</h3><p>VV, Vv, and vv are tracked as a true inheritance locus. VM and VC are both Vv; HerdHarbor does not claim how much visible Vienna marking a Vv kit will show.</p></article>
      <article class="feature-card"><div class="feature-number">05</div><h3>Pedigree & offspring evidence</h3><p>Recessives can travel through visually unaffected rabbits. Pedigree depth, informative offspring, and family evidence can narrow the range without falsely declaring an unproven allele as known.</p></article>
      <article class="feature-card"><div class="feature-number">06</div><h3>Genetics on pedigrees</h3><p>Rabbit pedigrees can show A/B/C/D/E/En/V lettering directly on screen and in print, including partial inferred genotypes and evidence details without overwriting breeder-entered genetics.</p></article>
    </div>
    <div class="problem-card" style="margin-top:28px"><p class="eyebrow">Breeding-planning tool</p><h3>Genetically possible is not the same as DNA tested—or show accepted.</h3><p>HerdHarbor predictions use the records you provide and deterministic inheritance rules. They are not DNA test results, and breed-recognized varieties remain separate from what is genetically possible.</p><div class="hero-actions"><a class="button" href="https://app.herdharbor.com/">Open Pair Analysis</a><a class="button button-secondary" href="/how-to/#rabbit-genetics">Read the Genetics guide</a></div></div>
  </div>`;
  if (features?.parentNode) features.parentNode.insertBefore(section, features); else main.appendChild(section);
}

function addReleaseFaqs() {
  const faq = document.querySelector("#faq");
  if (!faq || faq.querySelector("[data-v150-faq]")) return;
  const target = faq.querySelector(".faq-list, .faq-grid, .container") || faq;
  const wrap = document.createElement("div");
  wrap.dataset.v150Faq = "1";
  wrap.innerHTML = `<details><summary>What is the Shows section?</summary><p>Shows is HerdHarbor’s competition record system. It tracks shows, classes, placements, awards, judge feedback, animal history, exhibitors, and optional 4-H/FFA projects while using the same animals, Finance, Health, and cloud-sync records already in HerdHarbor.</p></details><details><summary>Does Shows create a second budget or health system?</summary><p>No. Show and project income or expenses are normal HerdHarbor Finance transactions with show/project links. Project weights and health records use the existing HerdHarbor Health history, so edits remain consistent everywhere.</p></details><details><summary>Can I use Shows for 4-H or FFA?</summary><p>Yes. Projects can be created inside Shows and linked to an exhibitor, year, and existing animal. Goals, notes, photos, growth, average daily gain, expenses, health history, competitions, and a printable Project Record are supported.</p></details><details><summary>How does HerdHarbor predict rabbit colors?</summary><p>Pair Analysis crosses recorded A, B, C, D, E, En, and Vienna genetics. Phenotype, pedigree, and offspring evidence constrain unknown alleles. Exact percentages are shown only when supported; otherwise HerdHarbor shows a min–max genetic range.</p></details><details><summary>Are HerdHarbor genetics predictions DNA results?</summary><p>No. Pair Analysis is a breeding-planning estimate based on recorded information and deterministic inheritance rules. Evidence labels distinguish known, phenotype-proven, offspring-proven, inferred, possible, and unknown genetics.</p></details>`;
  while (wrap.firstChild) target.appendChild(wrap.firstChild);
}

function addReleaseBanner() {
  document.querySelector(".hh-release-banner")?.remove();
  const header = document.querySelector(".site-header");
  const main = document.querySelector("main");
  if (!header && !main) return;
  if (!document.querySelector("#hh-release-banner-style")) {
    const style = document.createElement("style");
    style.id = "hh-release-banner-style";
    style.textContent = `.hh-release-banner{background:#0D2A46;color:#fff;border-bottom:1px solid rgba(130,208,204,.24)}.hh-release-banner-inner{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px}.hh-release-banner-copy{display:flex;align-items:center;gap:12px;min-width:0}.hh-release-banner-badge{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#82D0CC;color:#0D2540;font-size:.74rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.hh-release-banner-copy span:last-child{line-height:1.45;color:#E8F0F3}.hh-release-banner a{flex:0 0 auto;color:#fff;font-weight:800;text-decoration:none;border-bottom:1px solid #82D0CC}@media(max-width:700px){.hh-release-banner-inner{padding:11px 18px;align-items:flex-start}.hh-release-banner-copy{align-items:flex-start;flex-direction:column;gap:6px}.hh-release-banner a{margin-top:4px}}`;
    document.head.appendChild(style);
  }
  const banner = document.createElement("aside");
  banner.className = "hh-release-banner";
  banner.setAttribute("aria-label", "HerdHarbor Alpha v1.5.0 release");
  banner.innerHTML = `<div class="hh-release-banner-inner"><div class="hh-release-banner-copy"><span class="hh-release-banner-badge">Alpha v1.5.0</span><span><strong>Shows is now live.</strong> Track competitions, classes, placements, awards, judge feedback, animal history, exhibitors, and optional 4-H/FFA projects without duplicating your animals, Finance, or Health records.</span></div><a href="/releases/v1.5.0/">See what’s new →</a></div>`;
  if (header?.parentNode) header.parentNode.insertBefore(banner, header.nextSibling); else main?.parentNode?.insertBefore(banner, main);
}

updateSeoAndStructuredData();
normalizeReleaseCopy();
addGeneticsSection();
addShowsSection();
addReleaseFaqs();
addReleaseBanner();

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }));
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
