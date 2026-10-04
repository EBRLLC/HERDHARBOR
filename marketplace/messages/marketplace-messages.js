(() => {
  "use strict";

  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client) return;

  const { client } = context;
  const interactive = context.isAuthenticated && context.accountStatus === "active" && context.marketplaceAccessReady === true;
  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function validUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
  }

  async function rpc(name, args) {
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

  function accountUrl() {
    return "/marketplace/account/?next=" + encodeURIComponent(window.location.pathname + window.location.search);
  }

  if (!interactive) {
    window.location.assign(context.isAuthenticated ? "https://app.herdharbor.com/" : accountUrl());
    return;
  }

  root.innerHTML = `
    <section class="marketplace-messages">
      <div class="marketplace-section-heading">
        <div>
          <p class="eyebrow">Private Marketplace Messages</p>
          <h1>Messages</h1>
          <p class="marketplace-help">Only the accounts participating in a conversation can read or send messages in that thread.</p>
        </div>
      </div>

      <div class="marketplace-message-layout">
        <aside class="marketplace-inbox-panel">
          <div class="marketplace-admin-filter-row">
            <label>Inbox
              <select id="marketplace-inbox-folder">
                <option value="all">All</option>
                <option value="buying">Buying</option>
                <option value="selling">Selling</option>
                <option value="unread">Unread</option>
              </select>
            </label>
          </div>
          <div id="marketplace-inbox-list" class="marketplace-inbox-list" aria-live="polite"></div>
        </aside>

        <section class="marketplace-thread-panel">
          <div id="marketplace-thread" class="marketplace-thread" aria-live="polite">
            <div class="marketplace-empty-state">
              <h2>Select a conversation</h2>
              <p>Choose a Marketplace conversation from your inbox.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
  root.hidden = false;

  const folder = root.querySelector("#marketplace-inbox-folder");
  const inbox = root.querySelector("#marketplace-inbox-list");
  const thread = root.querySelector("#marketplace-thread");
  let selectedConversationId = "";
  let inboxRows = [];

  function conversationUrl(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("id", id);
    else url.searchParams.delete("id");
    return url.pathname + url.search;
  }

  function otherName(row) {
    return row.other_rabbitry_name || row.other_display_name || "Marketplace member";
  }

  function renderInbox() {
    if (!inboxRows.length) {
      inbox.innerHTML = '<div class="marketplace-empty-state"><h3>No conversations</h3><p>Your Marketplace messages will appear here.</p></div>';
      return;
    }

    inbox.innerHTML = inboxRows.map((row) => `
      <button type="button" class="marketplace-inbox-item ${String(row.conversation_id) === selectedConversationId ? "is-current" : ""}"
        data-conversation-id="${esc(row.conversation_id)}">
        <span class="marketplace-inbox-item-heading">
          <strong>${esc(otherName(row))}</strong>
          ${Number(row.unread_count || 0) > 0 ? '<span class="marketplace-unread-badge">' + esc(row.unread_count) + '</span>' : ""}
        </span>
        <span>${esc(row.listing_name || "Marketplace conversation")}</span>
        <small>${esc(row.last_message_preview || "No messages yet")}</small>
        <small>${esc(dateTime(row.last_message_at))}</small>
      </button>
    `).join("");

    inbox.querySelectorAll("[data-conversation-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.conversationId;
        history.pushState({ conversationId: id }, "", conversationUrl(id));
        openThread(id);
      });
    });
  }

  async function loadInbox() {
    inbox.innerHTML = '<div class="marketplace-notice">Loading messages…</div>';
    try {
      const rows = await rpc("marketplace_member_inbox", { folder_value: folder.value });
      inboxRows = Array.isArray(rows) ? rows : [];
      renderInbox();

      const requested = new URLSearchParams(window.location.search).get("id") || "";
      if (validUuid(requested) && requested !== selectedConversationId) {
        await openThread(requested);
      }
    } catch {
      inbox.innerHTML = '<div class="marketplace-notice error">Your Marketplace inbox could not be loaded.</div>';
    }
  }

  async function reportConversation(conversationId) {
    const reason = clean(globalThis.prompt("Why are you reporting this conversation?") || "");
    if (!reason) return;
    const details = clean(globalThis.prompt("Add details for the Marketplace admin (optional):") || "");
    await rpc("marketplace_member_submit_report", {
      target_type_value: "conversation",
      target_id_value: conversationId,
      reason_value: reason,
      details_value: details
    });
    globalThis.alert("Report submitted for review.");
  }

  async function openThread(conversationId) {
    if (!validUuid(conversationId)) return;
    selectedConversationId = conversationId;
    renderInbox();

    thread.innerHTML = '<div class="marketplace-notice">Loading conversation…</div>';

    try {
      const rows = await rpc("marketplace_member_messages", {
        conversation_id_value: conversationId,
        limit_value: 100,
        before_value: null
      });
      const messages = Array.isArray(rows) ? rows.slice().reverse() : [];
      const inboxRow = inboxRows.find((row) => String(row.conversation_id) === conversationId) || {};
      const name = otherName(inboxRow);

      thread.innerHTML = `
        <div class="marketplace-thread-heading">
          <div>
            <p class="eyebrow">${esc(inboxRow.member_role === "seller" ? "Selling" : "Buying")}</p>
            <h2>${esc(inboxRow.listing_name || "Marketplace conversation")}</h2>
            <p class="marketplace-help">Conversation with ${esc(name)}</p>
          </div>
          <button class="button button-secondary button-small" type="button" id="marketplace-report-conversation">Report conversation</button>
        </div>

        <div id="marketplace-message-list" class="marketplace-message-list">
          ${messages.length ? messages.map((message) => `
            <article class="marketplace-message ${message.sender_is_me ? "is-mine" : "is-theirs"}">
              <strong>${esc(message.sender_is_me ? "You" : (message.sender_display_name || name))}</strong>
              <p>${esc(message.body)}</p>
              <small>${esc(dateTime(message.created_at))}</small>
            </article>
          `).join("") : '<div class="marketplace-empty-state"><h3>No messages yet</h3><p>Send the first message about this listing.</p></div>'}
        </div>

        <form id="marketplace-message-form" class="marketplace-message-form">
          <label>
            Message
            <textarea name="body" rows="4" maxlength="5000" required placeholder="Write a message to this Marketplace member."></textarea>
          </label>
          <div class="seller-profile-actions">
            <button class="button" type="submit">Send message</button>
            <span id="marketplace-message-status" class="marketplace-form-status" role="status"></span>
          </div>
        </form>
      `;

      await rpc("marketplace_member_mark_conversation_read", {
        conversation_id_value: conversationId
      }).catch(() => {});

      root.querySelector("#marketplace-report-conversation")?.addEventListener("click", () => {
        reportConversation(conversationId).catch(() => {
          globalThis.alert("The report could not be submitted.");
        });
      });

      const form = root.querySelector("#marketplace-message-form");
      const status = root.querySelector("#marketplace-message-status");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = clean(form.elements.body.value);
        if (!body) return;

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        status.textContent = "Sending…";

        try {
          await rpc("marketplace_member_send_message", {
            conversation_id_value: conversationId,
            body_value: body
          });
          form.reset();
          status.textContent = "";
          await Promise.all([loadInbox(), openThread(conversationId)]);
        } catch {
          status.textContent = "Message could not be sent.";
          status.dataset.state = "error";
        } finally {
          submit.disabled = false;
        }
      });

      const messageList = root.querySelector("#marketplace-message-list");
      messageList?.scrollTo?.({ top: messageList.scrollHeight, behavior: "instant" });
    } catch {
      thread.innerHTML = '<div class="marketplace-notice error">This conversation is unavailable to this account.</div>';
    }
  }

  folder.addEventListener("change", loadInbox);
  window.addEventListener("popstate", () => {
    const requested = new URLSearchParams(window.location.search).get("id") || "";
    if (validUuid(requested)) openThread(requested);
  });

  loadInbox();
})();