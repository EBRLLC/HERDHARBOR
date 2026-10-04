(() => {
  "use strict";

  const SCHEMA = "herdharbor-marketplace-pedigree-v1";
  const MAX_NODES = 31;
  const ALLOWED_STATUS = new Set([
    "known", "repeat", "unknown", "missing-reference", "malformed-reference", "cycle"
  ]);

  const clean = (value, max = 180) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const esc = (value) => clean(value, 400)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function generationLabel(index) {
    if (index === 0) return "Animal";
    if (index === 1) return "Parents";
    if (index === 2) return "Grandparents";
    if (index === 3) return "Great-grandparents";
    return "Generation " + (index + 1);
  }

  function animalRows(animal) {
    if (!animal || typeof animal !== "object") return "";
    const rows = [
      ["Rabbitry / prefix", animal.prefix],
      ["Sex", animal.sex],
      ["DOB", animal.dob],
      ["Breed", animal.breed],
      ["Color / variety", animal.color],
      ["Registration", animal.registrationNumber]
    ].filter(([, value]) => clean(value));

    return rows.length
      ? '<dl class="marketplace-pedigree-fields">' + rows.map(([label, value]) =>
          '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>'
        ).join("") + '</dl>'
      : "";
  }

  function card(node) {
    const status = ALLOWED_STATUS.has(node?.status) ? node.status : "unknown";
    const known = status === "known" || status === "repeat";
    const animal = known && node?.animal && typeof node.animal === "object" ? node.animal : null;
    const name = clean(animal?.name) || (known ? "Recorded ancestor" : "Unknown");
    const statusText = status === "repeat"
      ? "Repeated ancestor"
      : status === "cycle"
        ? "Circular reference"
        : status === "missing-reference"
          ? "Missing linked record"
          : status === "malformed-reference"
            ? "Invalid linked record"
            : status === "unknown"
              ? "Unknown ancestor"
              : "";

    return `
      <article class="marketplace-pedigree-card" data-pedigree-status="${esc(status)}">
        <div class="marketplace-pedigree-card-heading">
          <small>${esc(node?.relation || "Ancestor")}</small>
          <strong>${esc(name)}</strong>
          ${statusText ? '<span>' + esc(statusText) + '</span>' : ""}
        </div>
        ${animalRows(animal)}
      </article>
    `;
  }

  function validate(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
    if (snapshot.schema !== SCHEMA) return false;
    if (!Number.isInteger(Number(snapshot.generations))) return false;
    const generations = Number(snapshot.generations);
    if (generations < 2 || generations > 5) return false;
    if (!Array.isArray(snapshot.nodes) || snapshot.nodes.length < 3 || snapshot.nodes.length > MAX_NODES) return false;

    return snapshot.nodes.every((node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return false;
      const generation = Number(node.generation);
      if (!Number.isInteger(generation) || generation < 0 || generation >= generations) return false;
      if (!clean(node.key, 80) || !ALLOWED_STATUS.has(node.status)) return false;
      if (node.animal != null && typeof node.animal !== "object") return false;
      return true;
    });
  }

  function render(container, snapshot) {
    if (!container) return false;
    if (!validate(snapshot)) {
      container.innerHTML = '<div class="marketplace-notice error">Pedigree preview is unavailable because the sanitized snapshot is invalid.</div>';
      return false;
    }

    const generations = Number(snapshot.generations);
    const columns = [];
    for (let generation = 0; generation < generations; generation += 1) {
      const nodes = snapshot.nodes.filter((node) => Number(node.generation) === generation);
      columns.push(`
        <section class="marketplace-pedigree-generation" aria-label="${esc(generationLabel(generation))}">
          <h3>${esc(generationLabel(generation))}</h3>
          <div class="marketplace-pedigree-generation-cards">
            ${nodes.map(card).join("")}
          </div>
        </section>
      `);
    }

    container.innerHTML = `
      <section class="marketplace-pedigree-preview" aria-labelledby="marketplace-pedigree-title">
        <div class="marketplace-pedigree-heading">
          <div>
            <p class="eyebrow">HerdHarbor Pedigree</p>
            <h2 id="marketplace-pedigree-title" tabindex="-1">Recorded lineage</h2>
            <p class="marketplace-help">Read-only Marketplace snapshot from HerdHarbor's canonical pedigree system.</p>
          </div>
          <span class="marketplace-preview-badge">${esc(snapshot.visibility === "parents" ? "Parents" : snapshot.generations + " generations")}</span>
        </div>
        <div class="marketplace-pedigree-columns">
          ${columns.join("")}
        </div>
      </section>
    `;

    container.querySelector("#marketplace-pedigree-title")?.focus({ preventScroll: true });
    return true;
  }

  window.HerdHarborMarketplacePedigree = Object.freeze({ render, validate });
})();
