const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const CURRENT_RELEASE = "1.4.5";

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

if (nav && !nav.querySelector('a[href="#genetics"]')) {
  const geneticsLink = document.createElement("a");
  geneticsLink.href = "#genetics";
  geneticsLink.textContent = "Rabbit Genetics";
  const howToLink = nav.querySelector('a[href="/how-to/"]');
  if (howToLink) nav.insertBefore(geneticsLink, howToLink);
  else nav.appendChild(geneticsLink);
}

if (nav) {
  nav.querySelectorAll('a[href^="/releases/"]').forEach((link) => link.remove());
  const releaseLink = document.createElement("a");
  releaseLink.href = "/releases/v1.4.5/";
  releaseLink.textContent = "v1.4.5";
  const appButton = nav.querySelector(".button");
  if (appButton) nav.insertBefore(releaseLink, appButton);
  else nav.appendChild(releaseLink);
}

function updateSeoAndStructuredData() {
  const description = "HerdHarbor Alpha v1.4.5 is multi-species livestock management with animal records, pedigrees, breeding, production, finances, sales, and advanced rabbit Pair Analysis with A/B/C/D/E, Broken En, Vienna, pedigree, and offspring genetics evidence.";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = description;
  const og = document.querySelector('meta[property="og:description"]');
  if (og) og.content = "HerdHarbor Alpha v1.4.5 adds breeder-readable rabbit color probability ranges, phenotype-constrained unknown genetics, Broken En, Vienna VM/VC/BEW, pedigree and offspring inference, and genetic evidence warnings.";
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const data = JSON.parse(script.textContent);
      if (data?.["@type"] !== "SoftwareApplication") return;
      data.softwareVersion = "1.4.5";
      data.description = description;
      data.featureList = "Animal records, visual multi-generation pedigrees, Rabbit Genetics Pair Analysis, A/B/C/D/E inheritance, Broken En inheritance, Vienna VM/VC/BEW inheritance, phenotype-constrained unknown genetics, actual possible offspring color probability ranges, pedigree and offspring inference, genetic evidence levels, contradiction warnings, breeding and birth management, health, tasks, production, finances, customers, sales, QR cards, transfers, cloud sync, backups, and Excel tools";
      script.textContent = JSON.stringify(data);
    } catch {}
  });
}

function normalizeReleaseCopy() {
  const replacements = new Map([
    ["HerdHarbor Alpha · Version 1.3.0", "HerdHarbor Alpha · Version 1.4.5"],
    ["HerdHarbor Alpha · Version 1.4.0", "HerdHarbor Alpha · Version 1.4.5"],
    ["Current release v1.3.0 Alpha", "Current release v1.4.5 Alpha"],
    ["Current release v1.4.0 Alpha", "Current release v1.4.5 Alpha"],
    ["Version 1.3.0 Alpha is available online", "Version 1.4.5 Alpha is available online"],
    ["Version 1.4.0 Alpha is available online", "Version 1.4.5 Alpha is available online"]
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
  if (heroVersion && /^v1\.(?:3\.0|4\.0)$/.test(heroVersion.textContent.trim())) heroVersion.textContent = "v1.4.5";
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
    <div class="section-heading"><p class="eyebrow">Alpha v1.4.5 · Rabbit Genetics</p><h2>Pair rabbits using inheritance evidence—not a generic color list.</h2><p>HerdHarbor Pair Analysis combines recorded phenotype, genotype, pedigree, offspring history, and deterministic inheritance rules to calculate actual possible offspring coat colors. When carrier status is unresolved, v1.4.5 shows a genetic minimum-to-maximum range instead of pretending the missing allele is known.</p></div>
    <div class="feature-grid">
      <article class="feature-card"><div class="feature-number">01</div><h3>Actual color ranges</h3><p>Possible offspring colors are shown by breeder-readable name with exact percentages when genetics are resolved and min–max ranges when a carrier allele is still unknown.</p></article>
      <article class="feature-card"><div class="feature-number">02</div><h3>A/B/C/D/E inheritance</h3><p>The core color loci are crossed allele-by-allele. Phenotype constrains unresolved positions so an underscore means unknown—not unrestricted and not “stop calculating.”</p></article>
      <article class="feature-card"><div class="feature-number">03</div><h3>Broken En inheritance</h3><p>En/en spotting is calculated separately from the base coat color, allowing Broken and solid outcomes to be evaluated without confusing pattern genetics with base color.</p></article>
      <article class="feature-card"><div class="feature-number">04</div><h3>Vienna VM / VC / BEW</h3><p>VV, Vv, and vv are tracked as a true inheritance locus. VM and VC are both Vv; HerdHarbor does not claim how much visible Vienna marking a Vv kit will show.</p></article>
      <article class="feature-card"><div class="feature-number">05</div><h3>Pedigree & offspring evidence</h3><p>Recessives can travel through visually unaffected rabbits. Pedigree depth, informative offspring, and family evidence can narrow the range without falsely declaring an unproven allele as known.</p></article>
      <article class="feature-card"><div class="feature-number">06</div><h3>Evidence & conflict warnings</h3><p>Known, phenotype-proven, offspring-proven, inferred, possible, and unknown evidence stay distinct. Conflicting phenotype/genotype or impossible parent/offspring records are flagged for breeder review.</p></article>
    </div>
    <div class="problem-card" style="margin-top:28px"><p class="eyebrow">Breeding-planning tool</p><h3>Genetically possible is not the same as DNA tested—or show accepted.</h3><p>HerdHarbor predictions use the records you provide and deterministic inheritance rules. They are not DNA test results, and breed-recognized varieties remain separate from what is genetically possible. Variable-expression modifiers such as visible Vienna marking and rufus intensity are not given fake precision.</p><div class="hero-actions"><a class="button" href="https://app.herdharbor.com/">Open Pair Analysis</a><a class="button button-secondary" href="/how-to/#rabbit-genetics">Read the Genetics guide</a></div></div>
  </div>`;
  if (features?.parentNode) features.parentNode.insertBefore(section, features); else main.appendChild(section);
}

function addGeneticsFaq() {
  const faq = document.querySelector("#faq");
  if (!faq || faq.querySelector("[data-v145-genetics-faq]")) return;
  const target = faq.querySelector(".faq-list, .faq-grid, .container") || faq;
  const wrap = document.createElement("div");
  wrap.dataset.v145GeneticsFaq = "1";
  wrap.innerHTML = `<details><summary>How does HerdHarbor predict rabbit colors?</summary><p>Alpha v1.4.5 crosses the selected buck and doe using recorded A, B, C, D, E, En, and Vienna genetics. Phenotype, pedigree, and offspring evidence constrain unknown alleles. Exact percentages are shown only when supported; otherwise the tool shows a min–max genetic range.</p></details><details><summary>Are HerdHarbor genetics predictions DNA results?</summary><p>No. Pair Analysis is a breeding-planning estimate based on recorded information and deterministic inheritance rules. Evidence labels show whether a genotype is known, phenotype-proven, offspring-proven, inferred, possible, or unknown.</p></details><details><summary>Does HerdHarbor support VM, VC, and BEW?</summary><p>Yes. VV is Vienna clean at the genotype level, Vv is the Vienna carrier genotype used for both VM and VC records, and vv is the BEW genotype. A Vv prediction does not claim how much visible Vienna marking will appear.</p></details>`;
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
  banner.setAttribute("aria-label", "HerdHarbor Alpha v1.4.5 release");
  banner.innerHTML = `<div class="hh-release-banner-inner"><div class="hh-release-banner-copy"><span class="hh-release-banner-badge">Alpha v1.4.5</span><span><strong>Rabbit Genetics predictions are more useful.</strong> Pair Analysis now returns actual coat-color probability ranges, phenotype-constrained unknowns, pedigree/offspring evidence, Vienna, Broken, and genetic conflict warnings.</span></div><a href="/releases/v1.4.5/">See what’s new →</a></div>`;
  if (header?.parentNode) header.parentNode.insertBefore(banner, header.nextSibling); else main?.parentNode?.insertBefore(banner, main);
}

updateSeoAndStructuredData();
normalizeReleaseCopy();
addGeneticsSection();
addGeneticsFaq();
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
