(() => {
  "use strict";

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function money(cents, currency = "USD") {
    if (cents === null || cents === undefined) return "Price not listed";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(Number(cents) / 100);
  }

  function dateTime(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  async function rpc(client, name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function normalizeRow(data) {
    return Array.isArray(data) ? (data[0] || {}) : (data || {});
  }

  async function mount(root, context) {
    if (!root || !context?.client || context.role !== "owner") return;
    const { client } = context;

    root.innerHTML = `
      <section class="marketplace-admin">
        <div class="marketplace-section-heading">
          <div>
            <span class="marketplace-admin-badge">Owner Administration</span>
            <p class="eyebrow">Marketplace Safety</p>
            <h2>Admin & Moderation</h2>
            <p class="marketplace-help">Review reports, remove abusive listings, suspend Marketplace sellers, and audit every moderation action. These controls affect Marketplace access only; they do not disable a HerdHarbor account.</p>
          </div>
        </div>

        <section id="marketplace-admin-summary" class="marketplace-admin-summary" aria-live="polite"></section>

        <nav class="marketplace-admin-tabs" aria-label="Marketplace administration">
          <button type="button" class="marketplace-admin-tab" data-admin-view="reports" aria-current="page">Reports</button>
          <button type="button" class="marketplace-admin-tab" data-admin-view="sellers">Sellers</button>
          <button type="button" class="marketplace-admin-tab" data-admin-view="listings">Listings</button>
          <button type="button" class="marketplace-admin-tab" data-admin-view="suspensions">Suspensions</button>
          <button type="button" class="marketplace-admin-tab" data-admin-view="history">Audit Log</button>
        </nav>

        <section id="marketplace-admin-view" class="marketplace-admin-view" aria-live="polite"></section>

        <dialog id="marketplace-admin-action-dialog" class="marketplace-admin-dialog" aria-labelledby="marketplace-admin-action-title">
          <form method="dialog" class="marketplace-admin-dialog-shell" id="marketplace-admin-action-form">
            <div>
              <p class="eyebrow">Owner moderation action</p>
              <h2 id="marketplace-admin-action-title">Confirm action</h2>
              <p id="marketplace-admin-action-description" class="marketplace-help"></p>
            </div>
            <label>
              Moderation reason
              <textarea id="marketplace-admin-action-reason" rows="5" maxlength="1000" required placeholder="Document why this action is being taken."></textarea>
            </label>
            <p id="marketplace-admin-action-error" class="marketplace-form-status" data-state="error" role="alert"></p>
            <div class="seller-profile-actions">
              <button type="submit" class="button" id="marketplace-admin-action-confirm">Confirm</button>
              <button type="button" class="button button-secondary" id="marketplace-admin-action-cancel">Cancel</button>
            </div>
          </form>
        </dialog>
      </section>
    `;

    const summaryNode = root.querySelector("#marketplace-admin-summary");
    const viewNode = root.querySelector("#marketplace-admin-view");
    const adminTabs = [...root.querySelectorAll("[data-admin-view]")];
    const dialog = root.querySelector("#marketplace-admin-action-dialog");
    const dialogForm = root.querySelector("#marketplace-admin-action-form");
    const dialogTitle = root.querySelector("#marketplace-admin-action-title");
    const dialogDescription = root.querySelector("#marketplace-admin-action-description");
    const dialogReason = root.querySelector("#marketplace-admin-action-reason");
    const dialogError = root.querySelector("#marketplace-admin-action-error");
    const dialogConfirm = root.querySelector("#marketplace-admin-action-confirm");
    const dialogCancel = root.querySelector("#marketplace-admin-action-cancel");

    let currentView = "reports";
    let pendingAction = null;
    let lastActionTrigger = null;

    function setAdminTab(view) {
      currentView = view;
      for (const button of adminTabs) {
        if (button.dataset.adminView === view) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    }

    function showNotice(message, state = "") {
      viewNode.innerHTML = `<div class="marketplace-notice ${state === "error" ? "error" : ""}">${esc(message)}</div>`;
    }

    function closeDialog() {
      pendingAction = null;
      dialogError.textContent = "";
      dialogReason.value = "";
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      lastActionTrigger?.focus?.();
      lastActionTrigger = null;
    }

    function requestAction({ title, description, confirmLabel, trigger, run }) {
      pendingAction = run;
      lastActionTrigger = trigger || document.activeElement;
      dialogTitle.textContent = title;
      dialogDescription.textContent = description;
      dialogConfirm.textContent = confirmLabel;
      dialogReason.value = "";
      dialogError.textContent = "";
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      dialogReason.focus();
    }

    dialogCancel.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });

    dialogForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = clean(dialogReason.value);
      if (!reason) {
        dialogError.textContent = "A moderation reason is required.";
        dialogReason.focus();
        return;
      }
      if (!pendingAction) return;

      dialogConfirm.disabled = true;
      dialogError.textContent = "";
      try {
        await pendingAction(reason);
        closeDialog();
        await refreshSummary();
        await renderView(currentView);
      } catch {
        dialogError.textContent = "The moderation action could not be completed.";
      } finally {
        dialogConfirm.disabled = false;
      }
    });

    async function refreshSummary() {
      try {
        const summary = normalizeRow(await rpc(client, "marketplace_owner_admin_summary_v2"));
        const cards = [
          ["Open reports", summary.open_reports || 0, "Reports awaiting review"],
          ["Suspended sellers", summary.suspended_sellers || 0, "Seller profiles hidden"],
          ["Suspended accounts", summary.suspended_accounts || 0, "Marketplace interaction blocked"],
          ["Removed listings", summary.removed_listings || 0, "Listings removed by moderation"],
          ["Available listings", summary.available_listings || 0, "Currently discoverable listings"]
        ];
        summaryNode.innerHTML = cards.map(([label, value, description]) => `
          <article class="marketplace-admin-stat">
            <span>${esc(label)}</span>
            <strong>${esc(value)}</strong>
            <small>${esc(description)}</small>
          </article>
        `).join("");
      } catch {
        summaryNode.innerHTML = '<div class="marketplace-notice error">Admin summary could not be loaded.</div>';
      }
    }

    async function renderReports() {
      viewNode.innerHTML = `
        <div class="marketplace-admin-toolbar">
          <div>
            <p class="eyebrow">Report queue</p>
            <h3>Abuse & safety reports</h3>
          </div>
          <label>Status
            <select id="marketplace-admin-report-status">
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="">All</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
        </div>
        <div id="marketplace-admin-report-list" class="marketplace-admin-list" aria-busy="true"></div>
      `;

      const status = viewNode.querySelector("#marketplace-admin-report-status");
      const list = viewNode.querySelector("#marketplace-admin-report-list");

      async function load() {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="marketplace-notice">Loading reports…</div>';
        try {
          const rows = await rpc(client, "marketplace_owner_admin_reports_v2", { status_value: status.value });
          const reports = Array.isArray(rows) ? rows : [];
          list.removeAttribute("aria-busy");
          if (!reports.length) {
            list.innerHTML = '<div class="marketplace-empty-state"><h3>No reports in this queue</h3><p>There is nothing requiring moderation here right now.</p></div>';
            return;
          }

          list.innerHTML = reports.map((report) => {
            const open = ["open", "reviewing"].includes(clean(report.status).toLowerCase());
            const targetType = clean(report.target_type);
            const targetState = clean(report.target_state).toLowerCase();
            return `
              <article class="marketplace-admin-card">
                <div class="marketplace-admin-card-heading">
                  <div>
                    <span class="marketplace-admin-status" data-state="${esc(report.status)}">${esc(report.status)}</span>
                    <h3>${esc(report.target_label || "Reported item")}</h3>
                    <p>${esc(targetType)} · ${esc(targetState || "status unavailable")} · ${esc(dateTime(report.created_at))}</p>
                  </div>
                </div>
                <div class="marketplace-admin-report-copy">
                  <strong>${esc(report.reason || "No reason supplied")}</strong>
                  ${clean(report.details) ? `<p>${esc(report.details)}</p>` : ""}
                  ${clean(report.target_excerpt) ? `<p><strong>Reported content:</strong> ${esc(report.target_excerpt)}</p>` : ""}
                  ${clean(report.reported_label) ? `<p><strong>Reported account:</strong> ${esc(report.reported_label)}</p>` : ""}
                </div>
                ${open ? `
                  <div class="marketplace-admin-actions">
                    ${targetType === "listing" && targetState !== "removed" ? `<button type="button" class="button button-danger button-small" data-report-action="remove_listing" data-report-id="${esc(report.report_id)}">Remove listing</button>` : ""}
                    ${targetType === "user" && targetState !== "suspended" ? `<button type="button" class="button button-danger button-small" data-report-action="suspend_seller" data-report-id="${esc(report.report_id)}">Suspend seller</button>` : ""}
                    ${report.can_suspend_account && !report.account_suspended ? `<button type="button" class="button button-danger button-small" data-report-action="suspend_account" data-report-id="${esc(report.report_id)}">Suspend Marketplace account</button>` : ""}
                    <button type="button" class="button button-secondary button-small" data-report-action="resolve" data-report-id="${esc(report.report_id)}">Resolve</button>
                    <button type="button" class="button button-secondary button-small" data-report-action="dismiss" data-report-id="${esc(report.report_id)}">Dismiss</button>
                  </div>
                ` : ""}
              </article>
            `;
          }).join("");

          list.querySelectorAll("[data-report-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const action = button.dataset.reportAction;
              const labels = {
                remove_listing: ["Remove reported listing", "The listing will immediately leave Marketplace discovery.", "Remove listing"],
                suspend_seller: ["Suspend reported seller", "The seller and their available listings will be hidden from Marketplace. Their HerdHarbor account remains active.", "Suspend seller"],
                suspend_account: ["Suspend Marketplace account", "Block this account from Marketplace messaging, favorites, seller tools, and other interaction. Their main HerdHarbor account stays active.", "Suspend Marketplace account"],
                resolve: ["Resolve report", "Close this report as resolved without changing the target.", "Resolve report"],
                dismiss: ["Dismiss report", "Close this report as dismissed without changing the target.", "Dismiss report"]
              };
              const [title, description, confirmLabel] = labels[action];
              requestAction({
                title,
                description,
                confirmLabel,
                trigger: button,
                run: (reason) => rpc(client, "marketplace_owner_admin_resolve_report_v2", {
                  report_id_value: button.dataset.reportId,
                  resolution_value: action,
                  reason_value: reason
                })
              });
            });
          });
        } catch {
          list.removeAttribute("aria-busy");
          list.innerHTML = '<div class="marketplace-notice error">Reports could not be loaded.</div>';
        }
      }

      status.addEventListener("change", load);
      await load();
    }

    async function renderSellers() {
      viewNode.innerHTML = `
        <div class="marketplace-admin-toolbar">
          <div>
            <p class="eyebrow">Seller administration</p>
            <h3>Marketplace sellers</h3>
          </div>
          <div class="marketplace-admin-filter-row">
            <label>Search
              <input id="marketplace-admin-seller-query" type="search" placeholder="Name, rabbitry, city or state">
            </label>
            <label>Status
              <select id="marketplace-admin-seller-status">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <button type="button" class="button button-secondary button-small" id="marketplace-admin-seller-search">Search</button>
          </div>
        </div>
        <div id="marketplace-admin-seller-list" class="marketplace-admin-list" aria-busy="true"></div>
      `;

      const query = viewNode.querySelector("#marketplace-admin-seller-query");
      const status = viewNode.querySelector("#marketplace-admin-seller-status");
      const search = viewNode.querySelector("#marketplace-admin-seller-search");
      const list = viewNode.querySelector("#marketplace-admin-seller-list");

      async function load() {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="marketplace-notice">Loading sellers…</div>';
        try {
          const rows = await rpc(client, "marketplace_owner_admin_sellers", {
            status_value: status.value,
            query_value: clean(query.value),
            limit_value: 100,
            offset_value: 0
          });
          const sellers = Array.isArray(rows) ? rows : [];
          list.removeAttribute("aria-busy");
          if (!sellers.length) {
            list.innerHTML = '<div class="marketplace-empty-state"><h3>No matching sellers</h3><p>Try a different search or status.</p></div>';
            return;
          }

          list.innerHTML = sellers.map((seller) => {
            const sellerStatus = clean(seller.marketplace_status).toLowerCase();
            const name = seller.rabbitry_name || seller.display_name || "HerdHarbor seller";
            const location = [seller.city, seller.region].filter(Boolean).join(", ");
            return `
              <article class="marketplace-admin-card">
                <div class="marketplace-admin-card-heading">
                  <div>
                    <span class="marketplace-admin-status" data-state="${esc(sellerStatus)}">${esc(sellerStatus)}</span>
                    <h3>${esc(name)}</h3>
                    <p>${esc(location || "Location not listed")} · Verification: ${esc(seller.verification_status || "none")}</p>
                  </div>
                  <a class="button button-secondary button-small" href="/marketplace/seller/?id=${encodeURIComponent(seller.public_id)}">View profile</a>
                </div>
                <div class="marketplace-admin-metrics">
                  <span><strong>${esc(seller.active_listing_count || 0)}</strong> available listings</span>
                  <span><strong>${esc(seller.removed_listing_count || 0)}</strong> removed listings</span>
                </div>
                <div class="marketplace-admin-actions">
                  ${sellerStatus === "active" ? `<button type="button" class="button button-danger button-small" data-seller-action="suspend" data-seller-id="${esc(seller.public_id)}">Suspend Marketplace</button>` : ""}
                  ${sellerStatus !== "active" ? `<button type="button" class="button button-secondary button-small" data-seller-action="reactivate" data-seller-id="${esc(seller.public_id)}">Reactivate Marketplace</button>` : ""}
                  ${sellerStatus !== "closed" ? `<button type="button" class="button button-secondary button-small" data-seller-action="close" data-seller-id="${esc(seller.public_id)}">Close Marketplace profile</button>` : ""}
                </div>
              </article>
            `;
          }).join("");

          list.querySelectorAll("[data-seller-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const action = button.dataset.sellerAction;
              const labels = {
                suspend: ["Suspend Marketplace seller", "The seller and their available listings will immediately disappear from Marketplace. Their HerdHarbor account will remain active.", "Suspend seller"],
                reactivate: ["Reactivate Marketplace seller", "Restore this seller's Marketplace status to active. Listings still retain their own existing state.", "Reactivate seller"],
                close: ["Close Marketplace seller profile", "Close this seller's Marketplace profile. This does not delete their HerdHarbor account.", "Close Marketplace profile"]
              };
              const [title, description, confirmLabel] = labels[action];
              requestAction({
                title,
                description,
                confirmLabel,
                trigger: button,
                run: (reason) => rpc(client, "marketplace_owner_admin_moderate_seller", {
                  seller_public_id_value: button.dataset.sellerId,
                  action_value: action,
                  reason_value: reason
                })
              });
            });
          });
        } catch {
          list.removeAttribute("aria-busy");
          list.innerHTML = '<div class="marketplace-notice error">Seller administration could not be loaded.</div>';
        }
      }

      search.addEventListener("click", load);
      query.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          load();
        }
      });
      status.addEventListener("change", load);
      await load();
    }

    async function renderListings() {
      viewNode.innerHTML = `
        <div class="marketplace-admin-toolbar">
          <div>
            <p class="eyebrow">Listing administration</p>
            <h3>Marketplace listings</h3>
          </div>
          <div class="marketplace-admin-filter-row">
            <label>Search
              <input id="marketplace-admin-listing-query" type="search" placeholder="Animal, breed, seller or location">
            </label>
            <label>Status
              <select id="marketplace-admin-listing-status">
                <option value="">All</option>
                <option value="available">Available</option>
                <option value="removed">Removed</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="sold">Sold</option>
                <option value="archived">Archived</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <button type="button" class="button button-secondary button-small" id="marketplace-admin-listing-search">Search</button>
          </div>
        </div>
        <div id="marketplace-admin-listing-list" class="marketplace-admin-list" aria-busy="true"></div>
      `;

      const query = viewNode.querySelector("#marketplace-admin-listing-query");
      const status = viewNode.querySelector("#marketplace-admin-listing-status");
      const search = viewNode.querySelector("#marketplace-admin-listing-search");
      const list = viewNode.querySelector("#marketplace-admin-listing-list");

      async function load() {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="marketplace-notice">Loading listings…</div>';
        try {
          const rows = await rpc(client, "marketplace_owner_admin_listings", {
            state_value: status.value,
            query_value: clean(query.value),
            limit_value: 100,
            offset_value: 0
          });
          const listings = Array.isArray(rows) ? rows : [];
          list.removeAttribute("aria-busy");
          if (!listings.length) {
            list.innerHTML = '<div class="marketplace-empty-state"><h3>No matching listings</h3><p>Try a different search or status.</p></div>';
            return;
          }

          list.innerHTML = listings.map((listing) => {
            const listingState = clean(listing.listing_state).toLowerCase();
            const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");
            return `
              <article class="marketplace-admin-card">
                <div class="marketplace-admin-card-heading">
                  <div>
                    <span class="marketplace-admin-status" data-state="${esc(listingState)}">${esc(listingState)}</span>
                    <h3>${esc(listing.animal_name || "Unnamed listing")}</h3>
                    <p>${esc([listing.breed, listing.sex].filter(Boolean).join(" · ") || listing.species || "Animal")} · ${esc(location || "Location not listed")}</p>
                    <p>Seller: ${esc(listing.seller_name || "HerdHarbor seller")} · Seller status: ${esc(listing.seller_status || "unknown")}</p>
                  </div>
                  <div class="marketplace-admin-price">${esc(money(listing.price_cents, listing.currency))}</div>
                </div>
                <div class="marketplace-admin-actions">
                  ${listingState === "available" ? `<a class="button button-secondary button-small" href="/marketplace/listing/?id=${encodeURIComponent(listing.listing_id)}">View listing</a>` : ""}
                  ${listingState !== "removed" ? `<button type="button" class="button button-danger button-small" data-listing-action="remove" data-listing-id="${esc(listing.listing_id)}">Remove listing</button>` : `<button type="button" class="button button-secondary button-small" data-listing-action="restore_to_draft" data-listing-id="${esc(listing.listing_id)}">Restore to draft</button>`}
                </div>
              </article>
            `;
          }).join("");

          list.querySelectorAll("[data-listing-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const action = button.dataset.listingAction;
              const remove = action === "remove";
              requestAction({
                title: remove ? "Remove Marketplace listing" : "Restore listing to draft",
                description: remove
                  ? "The listing will immediately leave Marketplace discovery."
                  : "The listing will return to draft. It will not be automatically republished.",
                confirmLabel: remove ? "Remove listing" : "Restore to draft",
                trigger: button,
                run: (reason) => rpc(client, "marketplace_owner_admin_moderate_listing", {
                  listing_id_value: button.dataset.listingId,
                  action_value: action,
                  reason_value: reason
                })
              });
            });
          });
        } catch {
          list.removeAttribute("aria-busy");
          list.innerHTML = '<div class="marketplace-notice error">Listing administration could not be loaded.</div>';
        }
      }

      search.addEventListener("click", load);
      query.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          load();
        }
      });
      status.addEventListener("change", load);
      await load();
    }

    async function renderHistory() {
      viewNode.innerHTML = `
        <div class="marketplace-admin-toolbar">
          <div>
            <p class="eyebrow">Audit trail</p>
            <h3>Moderation history</h3>
            <p class="marketplace-help">Every moderation action performed through the Owner controls is recorded here.</p>
          </div>
        </div>
        <div id="marketplace-admin-history-list" class="marketplace-admin-list" aria-busy="true"></div>
      `;

      const list = viewNode.querySelector("#marketplace-admin-history-list");
      try {
        const rows = await rpc(client, "marketplace_owner_admin_history", { limit_value: 100, offset_value: 0 });
        const history = Array.isArray(rows) ? rows : [];
        list.removeAttribute("aria-busy");
        if (!history.length) {
          list.innerHTML = '<div class="marketplace-empty-state"><h3>No moderation actions yet</h3><p>The audit trail will populate as moderation actions are taken.</p></div>';
          return;
        }

        list.innerHTML = history.map((action) => `
          <article class="marketplace-admin-card">
            <div class="marketplace-admin-card-heading">
              <div>
                <span class="marketplace-admin-status">${esc(action.action_type || "moderation")}</span>
                <h3>${esc((action.target_type || "target") + " moderation")}</h3>
                <p>${esc(dateTime(action.created_at))}</p>
              </div>
            </div>
            <p>${esc(action.reason || "No reason recorded")}</p>
          </article>
        `).join("");
      } catch {
        list.removeAttribute("aria-busy");
        list.innerHTML = '<div class="marketplace-notice error">Moderation history could not be loaded.</div>';
      }
    }

    async function renderView(view) {
      setAdminTab(view);
      if (view === "reports") await renderReports();
      else if (view === "sellers") await renderSellers();
      else if (view === "listings") await renderListings();
      else await renderHistory();
    }

    for (const button of adminTabs) {
      button.addEventListener("click", () => renderView(button.dataset.adminView));
    }

    await refreshSummary();
    await renderView("reports");
  }

  window.HerdHarborMarketplaceAdmin = Object.freeze({ mount });
})();
