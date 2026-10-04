(() => {
  "use strict";

  const SUPABASE_URL = "https://okynebbksifqppwicghj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jxsX6uS9nnh2FOFtlSF9TA_8v6C7C09";

  const statusNode = document.getElementById("marketplace-account-status");
  const signInTab = document.getElementById("marketplace-signin-tab");
  const signUpTab = document.getElementById("marketplace-signup-tab");
  const signInForm = document.getElementById("marketplace-signin-form");
  const signUpForm = document.getElementById("marketplace-signup-form");

  if (!window.supabase?.createClient || !statusNode || !signInForm || !signUpForm) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  function safeNext() {
    const value = new URLSearchParams(window.location.search).get("next") || "/marketplace/";
    if (!value.startsWith("/marketplace/")) return "/marketplace/";
    if (value.startsWith("//")) return "/marketplace/";
    return value;
  }

  function status(message, state = "") {
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  }

  function show(mode) {
    const signIn = mode === "signin";
    signInForm.hidden = !signIn;
    signUpForm.hidden = signIn;
    signInTab.setAttribute("aria-selected", String(signIn));
    signUpTab.setAttribute("aria-selected", String(!signIn));
    status("");
  }

  signInTab.addEventListener("click", () => show("signin"));
  signUpTab.addEventListener("click", () => show("signup"));

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = signInForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    status("Signing in…");

    const email = String(signInForm.elements.email.value || "").trim();
    const password = String(signInForm.elements.password.value || "");
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.user?.id) {
      status("Sign-in failed. Check your email and password.", "error");
      submit.disabled = false;
      return;
    }

    window.location.assign(safeNext());
  });

  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = signUpForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    status("Creating your HerdHarbor account…");

    const email = String(signUpForm.elements.email.value || "").trim();
    const password = String(signUpForm.elements.password.value || "");
    const confirmPassword = String(signUpForm.elements.confirm_password.value || "");

    if (password !== confirmPassword) {
      status("Passwords do not match.", "error");
      submit.disabled = false;
      return;
    }

    const redirect = new URL("/marketplace/account/", window.location.origin);
    redirect.searchParams.set("next", safeNext());

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirect.href
      }
    });

    if (error) {
      status(error.message || "Account could not be created.", "error");
      submit.disabled = false;
      return;
    }

    if (data?.session?.user?.id) {
      window.location.assign(safeNext());
      return;
    }

    status("Account created. Check your email to confirm the account, then return here to sign in.", "success");
    submit.disabled = false;
  });

  client.auth.getSession().then(({ data }) => {
    if (data?.session?.user?.id) window.location.assign(safeNext());
  });
})();