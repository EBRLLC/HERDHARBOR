"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("D1 Messages uses participant-scoped Realtime events only on the Messages runtime", () => {
  const source = read("marketplace/messages/marketplace-messages.js");
  assert.match(source, /\.channel\("marketplace-message-events:" \+ conversationId\)/);
  assert.match(source, /table: "marketplace_message_events"/);
  assert.match(source, /filter: "conversation_id=eq\." \+ conversationId/);
  assert.match(source, /beforeunload/);
  assert.match(source, /client\.removeChannel/);
});

test("D1 Messages sends idempotently and supports archive mute folders", () => {
  const source = read("marketplace/messages/marketplace-messages.js");
  assert.match(source, /marketplace_member_send_message_v2/);
  assert.match(source, /client_request_id_value: requestId\(\)/);
  assert.match(source, /marketplace_member_inbox_v2/);
  assert.match(source, /marketplace_member_set_conversation_preferences/);
  for (const token of ['value="muted"','value="archived"',"Unarchive","Unmute"]) {
    assert.ok(source.includes(token), token);
  }
});

test("D1 Realtime is not loaded by the core HerdHarbor website shell", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.doesNotMatch(shell, /marketplace_message_events|marketplace-message-events:/);
  assert.doesNotMatch(shell, /postgres_changes/);
});

test("D1 Messages runtime has a fresh cache identity", () => {
  const html = read("marketplace/messages/index.html");
  assert.match(html, /data-marketplace-runtime="\/marketplace\/messages\/marketplace-messages\.js\?v=10"/);
});
