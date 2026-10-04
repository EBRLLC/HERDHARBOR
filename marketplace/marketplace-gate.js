(() => {
  "use strict";

  const SUPABASE_URL = "https://okynebbksifqppwicghj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jxsX6uS9nnh2FOFtlSF9TA_8v6C7C09";
  const gateScript = document.currentScript;
  const MARKETPLACE_BASE = new URL("./", gateScript?.src || new URL("./", window.location.href));
  const runtimeFile = document.documentElement.dataset.marketplaceRuntime || "marketplace-owner-shell.js?v=5";
  const OWNER_RUNTIME = new URL(runtimeFile, MARKETPLACE_BASE).href;

  const statusNode = document.getElementById("marketplace-gate-status");
  const formNode = document.getElementById("marketplace-auth-form");
  const actionsNode = document.getElementById("marketplace-gate-actions");
  const emailNode = document.getElementById("marketplace-email");
  const passwordNode = document.getElementById("marketplace-password");
  const signOutNode = document.getElementById("marketplace-sign-out");
  const ownerRoot = document.getElementById("marketplace-owner-root");

  let client = null;

  function setStatus(message) {
    if (statusNode) statusNode.textContent = message;
  }

  function showSignedOut(message) {
    setStatus(message);
    if (formNode) formNode.hidden = false;
    if (actionsNode) actionsNode.hidden = false;
    if (signOutNode) signOutNode.hidden = true;
    if (ownerRoot) ownerRoot.hidden = true;
    document.documentElement.dataset.marketplaceAccess = "signed-out";
  }

  function deny(message) {
    setStatus(message);
    if (formNode) formNode.hidden = true;
    if (actionsNode) actionsNode.hidden = false;
    if (signOutNode) signOutNode.hidden = false;
    if (ownerRoot) ownerRoot.hidden = true;
    document.documentElement.dataset.marketplaceAccess = "denied";
  }

  function loadOwnerShell() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-marketplace-owner-runtime]')) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = OWNER_RUNTIME;
      script.async = true;
      script.dataset.marketplaceOwnerRuntime = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Marketplace Owner shell failed to load.")), { once: true });
      document.body.appendChild(script);
    });
  }

  async function verifyOwnerSession() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const session = sessionData?.session || null;
    if (sessionError || !session?.user?.id) {
      showSignedOut("Sign in with the protected HerdHarbor Owner account to open this private preview.");
      return false;
    }

    const { data: role, error: roleError } = await client.rpc("herdharbor_account_role");
    if (roleError || String(role || "").toLowerCase() !== "owner") {
      deny("Marketplace is currently a private Owner-only preview.");
      return false;
    }

    window.HerdHarborMarketplaceContext = Object.freeze({
      client,
      userId: session.user.id,
      role: "owner"
    });

    if (formNode) formNode.hidden = true;
    if (actionsNode) actionsNode.hidden = true;
    document.documentElement.dataset.marketplaceAccess = "owner";
    await loadOwnerShell();
    return true;
  }

  async function signIn(event) {
    event.preventDefault();
    const email = String(emailNode?.value || "").trim();
    const password = String(passwordNode?.value || "");
    if (!email || !password) {
      setStatus("Enter the Owner account email and password.");
      return;
    }

    setStatus("Verifying secure Owner access…");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      showSignedOut("Sign-in failed. Use the protected HerdHarbor Owner account.");
      return;
    }
    await verifyOwnerSession();
  }

  async function signOut() {
    await client?.auth?.signOut?.();
    window.HerdHarborMarketplaceContext = undefined;
    window.location.reload();
  }

  async function start() {
    if (!window.supabase?.createClient) {
      showSignedOut("Marketplace preview is unavailable because secure account services did not load.");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    formNode?.addEventListener("submit", signIn);
    signOutNode?.addEventListener("click", signOut);

    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && document.documentElement.dataset.marketplaceAccess === "owner") {
        window.HerdHarborMarketplaceContext = undefined;
        window.location.reload();
      }
    });

    await verifyOwnerSession();
  }

  start().catch((error) => {
    console.error("Marketplace access verification failed:", error);
    showSignedOut("Marketplace preview could not verify secure access.");
  });
})();
