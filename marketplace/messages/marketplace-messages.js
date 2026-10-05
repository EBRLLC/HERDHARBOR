(() => {
  "use strict";

  const root = document.getElementById("marketplace-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client) return;

  const { client } = context;
  const interactive = context.isAuthenticated && context.accountStatus === "active" && context.marketplaceAccessReady === true;
  const clean = (value) => String(value ?? "").trim();
  const REPORT_CATEGORIES = ["spam","fraud_scam","harassment","unsafe_sale","animal_welfare","prohibited_content","privacy","impersonation","other"];

  function reportCategory(subject) {
    const raw = clean(globalThis.prompt(
      "Report category for " + subject + ":\n" + REPORT_CATEGORIES.join(", "),
      "other"
    ) || "").toLowerCase().replaceAll(" ", "_").replaceAll("/", "_");
    return REPORT_CATEGORIES.includes(raw) ? raw : "";
  }
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
    if (context.marketplaceSuspended) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Marketplace access suspended</h1><p>You can continue browsing Marketplace, but private messages and other Marketplace interaction are disabled while this suspension is active.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }
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
                <option value="muted">Muted</option>
                <option value="archived">Archived</option>
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
  let threadRequestToken = 0;
  let realtimeChannel = null;
  let realtimeConversationId = "";

  function requestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = Math.floor(Math.random() * 16);
      const nibble = char === "x" ? value : (value & 0x3) | 0x8;
      return nibble.toString(16);
    });
  }

  async function stopRealtime() {
    const channel = realtimeChannel;
    realtimeChannel = null;
    realtimeConversationId = "";
    if (!channel) return;
    try {
      await client.removeChannel(channel);
    } catch {}
  }

  function startRealtime(conversationId) {
    if (!validUuid(conversationId) || realtimeConversationId === conversationId) return;
    stopRealtime();
    realtimeConversationId = conversationId;

    const channel = client
      .channel("marketplace-message-events:" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "marketplace_message_events",
          filter: "conversation_id=eq." + conversationId
        },
        () => {
          if (selectedConversationId !== conversationId) return;
          loadInbox({ openRequested: false }).catch(() => {});
          openThread(conversationId, { refreshRealtime: false }).catch(() => {});
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || selectedConversationId !== conversationId) return;
        loadInbox({ openRequested: false }).catch(() => {});
        openThread(conversationId, { refreshRealtime: false }).catch(() => {});
      });

    realtimeChannel = channel;
  }

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
        ${row.muted ? '<small class="marketplace-help">Muted</small>' : ""}
        ${row.archived ? '<small class="marketplace-help">Archived</small>' : ""}
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

  async function loadInbox({ openRequested = true } = {}) {
    inbox.innerHTML = '<div class="marketplace-notice">Loading messages…</div>';
    try {
      const rows = await rpc("marketplace_member_inbox_v2", { folder_value: folder.value });
      inboxRows = Array.isArray(rows) ? rows : [];
      renderInbox();

      const requested = new URLSearchParams(window.location.search).get("id") || "";
      if (openRequested && validUuid(requested) && requested !== selectedConversationId) {
        await openThread(requested);
      }
    } catch {
      inbox.innerHTML = '<div class="marketplace-notice error">Your Marketplace inbox could not be loaded.</div>';
    }
  }

  async function reportConversation(conversationId) {
    const category = reportCategory("this conversation");
    if (!category) return;
    const details = clean(globalThis.prompt("Add details for the Marketplace admin (optional):") || "");
    await rpc("marketplace_member_submit_report_v2", {
      target_type_value: "conversation",
      target_id_value: conversationId,
      category_value: category,
      details_value: details,
      evidence_refs_value: []
    });
    globalThis.alert("Report submitted for review.");
  }

  async function openThread(conversationId, { refreshRealtime = true } = {}) {
    if (!validUuid(conversationId)) return;
    const requestToken = ++threadRequestToken;
    selectedConversationId = conversationId;
    renderInbox();

    thread.innerHTML = '<div class="marketplace-notice">Loading conversation…</div>';

    try {
      const [rows, blockState] = await Promise.all([
        rpc("marketplace_member_messages", {
          conversation_id_value: conversationId,
          limit_value: 100,
          before_value: null
        }),
        rpc("marketplace_member_conversation_block_state", {
          conversation_id_value: conversationId
        })
      ]);
      if (requestToken !== threadRequestToken || selectedConversationId !== conversationId) return;
      const messages = Array.isArray(rows) ? rows.slice().reverse() : [];
      let blockedByMe = blockState?.blocked_by_me === true;
      const blockedByPeer = blockState?.blocked_by_peer === true;
      const peerSuspended = blockState?.peer_suspended === true;
      let messagingBlocked = blockState?.messaging_blocked === true;
      const inboxRow = inboxRows.find((row) => String(row.conversation_id) === conversationId) || {};
      const name = otherName(inboxRow);
      let archived = inboxRow.archived === true;
      let muted = inboxRow.muted === true;

      thread.innerHTML = `
        <div class="marketplace-thread-heading">
          <div>
            <p class="eyebrow">${esc(inboxRow.member_role === "seller" ? "Selling" : "Buying")}</p>
            <h2>${esc(inboxRow.listing_name || "Marketplace conversation")}</h2>
            <p class="marketplace-help">Conversation with ${esc(name)}</p>
          </div>
          <div class="marketplace-admin-actions">
            <button class="button button-secondary button-small" type="button" id="marketplace-archive-conversation">${archived ? "Unarchive" : "Archive"}</button>
            <button class="button button-secondary button-small" type="button" id="marketplace-mute-conversation">${muted ? "Unmute" : "Mute"}</button>
            <button class="button button-secondary button-small" type="button" id="marketplace-block-conversation">${blockedByMe ? "Unblock account" : "Block account"}</button>
            <button class="button button-secondary button-small" type="button" id="marketplace-report-conversation">Report conversation</button>
          </div>
        </div>

        <div id="marketplace-message-list" class="marketplace-message-list">
          ${messages.length ? messages.map((message) => `
            <article class="marketplace-message ${message.sender_is_me ? "is-mine" : "is-theirs"}">
              <strong>${esc(message.sender_is_me ? "You" : (message.sender_display_name || name))}</strong>
              <p>${esc(message.body)}</p>
              <small>${esc(dateTime(message.created_at))}</small>
              ${message.sender_is_me ? "" : `<button class="button button-secondary button-small" type="button" data-report-message="${esc(message.message_id)}">Report message</button>`}
            </article>
          `).join("") : '<div class="marketplace-empty-state"><h3>No messages yet</h3><p>Send the first message about this listing.</p></div>'}
        </div>

        <div id="marketplace-block-status" class="marketplace-notice" ${messagingBlocked ? "" : "hidden"}>${peerSuspended
          ? "This Marketplace account is currently unavailable. Messaging is disabled."
          : blockedByMe && blockedByPeer
            ? "Both accounts have blocked this conversation. Messaging remains unavailable until both blocks are cleared."
            : blockedByMe
              ? "You blocked this Marketplace account. Unblock them to send another message."
              : blockedByPeer
                ? "This Marketplace account has blocked this conversation. Messaging is unavailable."
                : ""}</div>
        <form id="marketplace-message-form" class="marketplace-message-form" ${messagingBlocked ? "hidden" : ""}>
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
      const currentInboxRow = inboxRows.find((row) => String(row.conversation_id) === conversationId);
      if (currentInboxRow) currentInboxRow.unread_count = 0;
      renderInbox();
      if (refreshRealtime) startRealtime(conversationId);

      const archiveButton = root.querySelector("#marketplace-archive-conversation");
      const muteButton = root.querySelector("#marketplace-mute-conversation");
      const blockButton = root.querySelector("#marketplace-block-conversation");
      const blockNotice = root.querySelector("#marketplace-block-status");
      const messageForm = root.querySelector("#marketplace-message-form");

      archiveButton?.addEventListener("click", async () => {
        archiveButton.disabled = true;
        try {
          const result = await rpc("marketplace_member_set_conversation_preferences", {
            conversation_id_value: conversationId,
            archived_value: !archived,
            muted_value: null
          });
          archived = result?.archived === true;
          archiveButton.textContent = archived ? "Unarchive" : "Archive";
          if (archived) folder.value = "archived";
          await loadInbox({ openRequested: false });
        } catch {
          globalThis.alert("The archive setting could not be changed.");
        } finally {
          archiveButton.disabled = false;
        }
      });

      muteButton?.addEventListener("click", async () => {
        muteButton.disabled = true;
        try {
          const result = await rpc("marketplace_member_set_conversation_preferences", {
            conversation_id_value: conversationId,
            archived_value: null,
            muted_value: !muted
          });
          muted = result?.muted === true;
          muteButton.textContent = muted ? "Unmute" : "Mute";
          await loadInbox({ openRequested: false });
        } catch {
          globalThis.alert("The mute setting could not be changed.");
        } finally {
          muteButton.disabled = false;
        }
      });

      blockButton?.addEventListener("click", async () => {
        const nextBlocked = !blockedByMe;
        if (nextBlocked && !globalThis.confirm("Block this Marketplace account? They will no longer be able to start or continue a conversation with you until you unblock them.")) {
          return;
        }

        blockButton.disabled = true;
        try {
          blockedByMe = await rpc("marketplace_member_set_conversation_block", {
            conversation_id_value: conversationId,
            blocked_value: nextBlocked
          }) === true;
          messagingBlocked = blockedByMe || blockedByPeer || peerSuspended;

          blockButton.textContent = blockedByMe ? "Unblock account" : "Block account";
          if (blockNotice) {
            blockNotice.hidden = !messagingBlocked;
            blockNotice.textContent = peerSuspended
              ? "This Marketplace account is currently unavailable. Messaging is disabled."
              : blockedByMe && blockedByPeer
                ? "Both accounts have blocked this conversation. Messaging remains unavailable until both blocks are cleared."
                : blockedByMe
                  ? "You blocked this Marketplace account. Unblock them to send another message."
                  : blockedByPeer
                    ? "This Marketplace account has blocked this conversation. Messaging is unavailable."
                    : "";
          }
          if (messageForm) messageForm.hidden = messagingBlocked;
        } catch {
          globalThis.alert("The block setting could not be changed.");
        } finally {
          blockButton.disabled = false;
        }
      });

      root.querySelector("#marketplace-report-conversation")?.addEventListener("click", () => {
        reportConversation(conversationId).catch(() => {
          globalThis.alert("The report could not be submitted.");
        });
      });

      root.querySelectorAll("[data-report-message]").forEach((button) => {
        button.addEventListener("click", async () => {
          const messageId = button.dataset.reportMessage || "";
          const category = reportCategory("this message");
          if (!validUuid(messageId) || !category) return;
          const details = clean(globalThis.prompt("Add details for the Marketplace admin (optional):") || "");
          button.disabled = true;
          try {
            await rpc("marketplace_member_submit_report_v2", {
              target_type_value: "message",
              target_id_value: messageId,
              category_value: category,
              details_value: details,
              evidence_refs_value: [messageId]
            });
            globalThis.alert("Report submitted for review.");
          } catch {
            globalThis.alert("The report could not be submitted.");
          } finally {
            button.disabled = false;
          }
        });
      });

      const form = messageForm;
      const status = root.querySelector("#marketplace-message-status");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = clean(form.elements.body.value);
        if (!body) return;

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        status.textContent = "Sending…";

        try {
          await rpc("marketplace_member_send_message_v2", {
            conversation_id_value: conversationId,
            body_value: body,
            client_request_id_value: requestId()
          });
        } catch {
          status.textContent = "Message could not be sent.";
          status.dataset.state = "error";
          submit.disabled = false;
          return;
        }

        form.reset();
        status.textContent = "Message sent.";
        status.dataset.state = "success";
        submit.disabled = false;

        try {
          await loadInbox({ openRequested: false });
          await openThread(conversationId);
        } catch {
          status.textContent = "Message sent, but the conversation could not refresh. Reload Messages to continue.";
          status.dataset.state = "error";
        }
      });

      const messageList = root.querySelector("#marketplace-message-list");
      messageList?.scrollTo?.({ top: messageList.scrollHeight, behavior: "auto" });
    } catch {
      thread.innerHTML = '<div class="marketplace-notice error">This conversation is unavailable to this account.</div>';
    }
  }

  folder.addEventListener("change", () => {
    selectedConversationId = "";
    stopRealtime();
    loadInbox();
  });
  window.addEventListener("beforeunload", () => {
    stopRealtime();
  });

  window.addEventListener("popstate", () => {
    const requested = new URLSearchParams(window.location.search).get("id") || "";
    if (validUuid(requested)) openThread(requested);
  });

  loadInbox();
})();