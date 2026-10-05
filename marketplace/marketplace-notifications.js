(() => {
  "use strict";

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function rpc(client, name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function dateTime(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function destination(row) {
    const type = clean(row.entity_type).toLowerCase();
    const id = clean(row.entity_id);
    if (type === "conversation" && id) return "/marketplace/messages/?id=" + encodeURIComponent(id);
    if (type === "listing") return "/marketplace/#my-listings";
    if (type === "seller") return "/marketplace/#seller-profile";
    if (row.notification_type === "saved_search") return "/marketplace/";
    return "";
  }

  function notifyShell() {
    window.dispatchEvent(new CustomEvent("marketplace:notifications-changed"));
  }

  async function mount(root, context) {
    if (!root || !context?.client || !context.isAuthenticated || context.accountStatus !== "active" || context.marketplaceAccessReady !== true) return;
    const { client } = context;

    root.innerHTML = `
      <section class="marketplace-section-heading">
        <div>
          <p class="eyebrow">Marketplace Notifications</p>
          <h2>Notifications</h2>
          <p class="marketplace-help">Messages, listing expiration reminders, listing lifecycle changes, and Marketplace moderation notices appear here.</p>
        </div>
        <button class="button button-secondary button-small" type="button" id="marketplace-mark-all-notifications">Mark all read</button>
      </section>
      <section id="marketplace-notification-list" class="marketplace-admin-list" aria-live="polite"></section>
    `;

    const list = root.querySelector("#marketplace-notification-list");
    const markAll = root.querySelector("#marketplace-mark-all-notifications");

    async function load() {
      list.innerHTML = '<div class="marketplace-notice">Loading notifications…</div>';
      try {
        await rpc(client, "marketplace_member_refresh_notifications").catch(() => null);
        const rows = await rpc(client, "marketplace_member_notifications", {
          limit_value: 100,
          offset_value: 0
        });
        const notifications = Array.isArray(rows) ? rows : [];

        if (!notifications.length) {
          list.innerHTML = '<div class="marketplace-empty-state"><h3>No notifications</h3><p>Marketplace activity that needs your attention will appear here.</p></div>';
          notifyShell();
          return;
        }

        list.innerHTML = notifications.map((row) => {
          const href = destination(row);
          return `
            <article class="marketplace-admin-card ${row.read ? "" : "is-unread"}" data-notification-id="${esc(row.notification_id)}">
              <div class="marketplace-admin-card-heading">
                <div>
                  <span class="marketplace-admin-status">${esc((row.notification_type || "notification").replaceAll("_"," "))}</span>
                  <h3>${esc(row.title || "Marketplace notification")}</h3>
                  <p>${esc(dateTime(row.created_at))}</p>
                </div>
                ${row.read ? "" : '<span class="marketplace-unread-badge">New</span>'}
              </div>
              <p>${esc(row.body || "")}</p>
              <div class="marketplace-admin-actions">
                ${href ? `<a class="button button-secondary button-small" href="${esc(href)}">Open</a>` : ""}
                ${row.read ? "" : `<button class="button button-secondary button-small" type="button" data-read-notification="${esc(row.notification_id)}">Mark read</button>`}
              </div>
            </article>
          `;
        }).join("");

        list.querySelectorAll("[data-read-notification]").forEach((button) => {
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              await rpc(client, "marketplace_member_mark_notification_read", {
                notification_id_value: button.dataset.readNotification
              });
              await load();
              notifyShell();
            } catch {
              button.disabled = false;
            }
          });
        });

        notifyShell();
      } catch {
        list.innerHTML = '<div class="marketplace-notice error">Marketplace notifications could not be loaded.</div>';
      }
    }

    markAll?.addEventListener("click", async () => {
      markAll.disabled = true;
      try {
        await rpc(client, "marketplace_member_mark_all_notifications_read");
        await load();
        notifyShell();
      } catch {
        markAll.disabled = false;
      } finally {
        markAll.disabled = false;
      }
    });

    await load();
  }

  window.HerdHarborMarketplaceNotifications = Object.freeze({ mount });
})();
