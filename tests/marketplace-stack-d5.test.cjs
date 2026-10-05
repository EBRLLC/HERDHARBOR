"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("D5 Marketplace shell lazy loads notifications only for interactive members", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /data-marketplace-view="notifications"/);
  assert.match(shell, /HerdHarborMarketplaceNotifications/);
  assert.match(shell, /marketplace-notifications\.js\?v=1/);
  assert.match(shell, /#notifications/);
  assert.doesNotMatch(read("marketplace/marketplace-gate.js"), /marketplace_member_notifications/);
});

test("D5 shell exposes unread notification and message indicators", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /marketplace_member_refresh_notifications/);
  assert.match(shell, /marketplace_member_notification_summary/);
  assert.match(shell, /Notifications \(\$\{unreadNotifications\}\)/);
  assert.match(shell, /Messages \(\$\{unreadMessages\}\)/);
  assert.match(shell, /marketplace:notifications-changed/);
});

test("D5 notification inbox supports read and all-read actions", () => {
  const source = read("marketplace/marketplace-notifications.js");
  assert.match(source, /marketplace_member_notifications/);
  assert.match(source, /marketplace_member_mark_notification_read/);
  assert.match(source, /marketplace_member_mark_all_notifications_read/);
  assert.match(source, /Mark all read/);
  assert.match(source, /data-read-notification/);
});

test("D5 opening a private thread marks its conversation notifications read", () => {
  const messages = read("marketplace/messages/marketplace-messages.js");
  assert.match(messages, /marketplace_member_mark_entity_notifications_read/);
  assert.match(messages, /entity_type_value: "conversation"/);
  assert.match(messages, /entity_id_value: conversationId/);
});

test("D5 notification runtime and shared shell have fresh cache identities", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const gate = read("marketplace/marketplace-gate.js");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html"),
    read("marketplace/messages/index.html")
  ].join("\n");
  const workflow = read(".github/workflows/website-ci.yml");

  assert.match(shell, /marketplace-notifications\.js\?v=1/);
  assert.match(gate, /marketplace-shell\.js\?v=12/);
  assert.match(pages, /marketplace-gate\.js\?v=13/);
  assert.match(read("marketplace/messages/index.html"), /marketplace-messages\.js\?v=11/);
  assert.match(workflow, /node --check marketplace\/marketplace-notifications\.js/);
});
