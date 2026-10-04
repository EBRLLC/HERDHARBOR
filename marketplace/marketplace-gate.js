(() => {
  "use strict";

  const SUPABASE_URL = "https://okynebbksifqppwicghj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jxsX6uS9nnh2FOFtlSF9TA_8v6C7C09";
  const APP_ORIGIN = "https://app.herdharbor.com";
  const SSO_TIMEOUT_MS = 5000;

  const gateScript = document.currentScript;
  const MARKETPLACE_BASE = new URL("./", gateScript?.src || new URL("./", window.location.href));
  const runtimeFile = document.documentElement.dataset.marketplaceRuntime || "marketplace-shell.js?v=7";
  const RUNTIME_URL = new URL(runtimeFile, MARKETPLACE_BASE).href;

  const sessionShell = document.getElementById("marketplace-access-shell");
  const statusNode = document.getElementById("marketplace-gate-status");
  const actionsNode = document.getElementById("marketplace-gate-actions");
  const accountLink = document.getElementById("marketplace-account-link");
  const signOutNode = document.getElementById("marketplace-sign-out");
  const root = document.getElementById("marketplace-root");

  let client = null;
  let booting = false;

  function setStatus(message) {
    if (statusNode) statusNode.textContent = message;
  }

  function safeNext() {
    const value = window.location.pathname + window.location.search + window.location.hash;
    return value.startsWith("/marketplace/") ? value : "/marketplace/";
  }

  function accountUrl() {
    return "/marketplace/account/?next=" + encodeURIComponent(safeNext());
  }

  function ssoNonceFromHash() {
    if (!window.location.hash.startsWith("#app-sso=")) return "";
    return decodeURIComponent(window.location.hash.slice("#app-sso=".length));
  }

  function ssoTicketFromHash() {
    if (!window.location.hash.startsWith("#sso-ticket=")) return "";
    return decodeURIComponent(window.location.hash.slice("#sso-ticket=".length));
  }

  function clearSsoHash() {
    if (
      !window.location.hash.startsWith("#app-sso=")
      && !window.location.hash.startsWith("#sso-ticket=")
    ) return;
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }

  async function redeemFragmentTicket() {
    const tokenHash = ssoTicketFromHash();
    if (!tokenHash) return false;

    clearSsoHash();

    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink"
    });

    return !error && Boolean(data?.session?.user?.id);
  }

  async function acceptAppSessionHandoff() {
    const nonce = ssoNonceFromHash();
    if (!nonce || !window.opener) {
      clearSsoHash();
      return false;
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        clearSsoHash();
        resolve(value);
      };

      const onMessage = async (event) => {
        if (event.origin !== APP_ORIGIN) return;
        if (event.source !== window.opener) return;
        if (event.data?.type !== "herdharbor:marketplace-sso-ticket") return;
        if (String(event.data?.nonce || "") !== nonce) return;

        const tokenHash = String(event.data?.tokenHash || "");
        const verificationType = String(event.data?.verificationType || "");
        if (!tokenHash || verificationType !== "magiclink") {
          finish(false);
          return;
        }

        const { data, error } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink"
        });

        if (error || !data?.session?.user?.id) {
          finish(false);
          return;
        }

        try {
          window.opener.postMessage({
            type: "herdharbor:marketplace-sso-complete",
            nonce
          }, APP_ORIGIN);
        } catch {}

        try {
          window.opener = null;
        } catch {}

        finish(true);
      };

      const timer = setTimeout(() => finish(false), SSO_TIMEOUT_MS);
      window.addEventListener("message", onMessage);

      try {
        window.opener.postMessage({
          type: "herdharbor:marketplace-sso-request",
          nonce
        }, APP_ORIGIN);
      } catch {
        finish(false);
      }
    });
  }

  async function contextForSession(session) {
    if (!session?.user?.id) {
      return Object.freeze({
        client,
        userId: "",
        role: "guest",
        isAuthenticated: false,
        accountStatus: "guest",
        membershipTier: "",
        sellerPublicId: "",
        marketplaceStatus: "guest",
        marketplaceAccessReady: false
      });
    }

    const { data, error } = await client.rpc("marketplace_member_session");
    const account = !error && data && typeof data === "object" ? data : {};

    const accountRole = String(account.account_role || "user").toLowerCase();
    const accountStatus = String(account.account_status || "unavailable").toLowerCase();

    return Object.freeze({
      client,
      userId: String(session.user.id),
      role: accountRole === "owner" ? "owner" : "member",
      isAuthenticated: true,
      accountStatus,
      membershipTier: String(account.membership_tier || ""),
      sellerPublicId: String(account.seller_public_id || ""),
      marketplaceStatus: String(account.marketplace_status || "not_created"),
      marketplaceAccessReady: account.marketplace_access_ready === true
    });
  }

  function renderSession(context) {
    if (context.isAuthenticated) {
      setStatus(
        context.marketplaceAccessReady
          ? "Signed in to HerdHarbor Marketplace."
          : context.accountStatus !== "active"
            ? "Signed in. Marketplace interaction is unavailable while this HerdHarbor account is not active."
            : "Signed in. Finish HerdHarbor account setup in the app before using Marketplace messaging or seller tools."
      );
      if (accountLink) {
        accountLink.textContent = "Account";
        accountLink.href = "/marketplace/account/";
      }
      if (signOutNode) signOutNode.hidden = false;
      document.documentElement.dataset.marketplaceAccess = context.role;
    } else {
      setStatus("Browsing as a guest. Listings are public; sign in or create an account to message sellers or manage Marketplace activity.");
      if (accountLink) {
        accountLink.textContent = "Sign in / Create account";
        accountLink.href = accountUrl();
      }
      if (signOutNode) signOutNode.hidden = true;
      document.documentElement.dataset.marketplaceAccess = "guest";
    }

    if (sessionShell) sessionShell.hidden = false;
    if (actionsNode) actionsNode.hidden = false;
  }

  function loadRuntime() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-marketplace-runtime-loaded]");
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = RUNTIME_URL;
      script.async = true;
      script.dataset.marketplaceRuntimeLoaded = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Marketplace runtime failed to load.")), { once: true });
      document.body.appendChild(script);
    });
  }

  async function signOut() {
    await client?.auth?.signOut?.();
    window.location.assign("/marketplace/");
  }

  async function start() {
    if (booting) return;
    booting = true;

    if (!window.supabase?.createClient) {
      setStatus("Marketplace account services are unavailable. Public browsing cannot start.");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    signOutNode?.addEventListener("click", signOut);

    // Register before waiting on the opener handshake. The app's fallback can
    // switch #app-sso to #sso-ticket while that handshake is still pending.
    window.addEventListener("hashchange", async () => {
      if (!ssoTicketFromHash()) return;
      const redeemed = await redeemFragmentTicket().catch(() => false);
      if (!redeemed) return;

      const { data: refreshedSession } = await client.auth.getSession();
      const refreshedContext = await contextForSession(refreshedSession?.session || null);
      window.HerdHarborMarketplaceContext = refreshedContext;
      window.location.reload();
    });

    const fragmentRedeemed = await redeemFragmentTicket();
    if (!fragmentRedeemed) {
      await acceptAppSessionHandoff();
    }

    const { data: sessionData } = await client.auth.getSession();
    const context = await contextForSession(sessionData?.session || null);
    window.HerdHarborMarketplaceContext = context;

    renderSession(context);
    if (root) root.hidden = false;
    await loadRuntime();

    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.HerdHarborMarketplaceContext = undefined;
        window.location.assign("/marketplace/");
      }
    });
  }

  start().catch((error) => {
    console.error("Marketplace bootstrap failed:", error);
    setStatus("Marketplace could not finish loading. Try again.");
  });
})();
