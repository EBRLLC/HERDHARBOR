(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"]
  ]);

  function safeText(value) {
    return String(value ?? "").trim();
  }

  function listValue(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }

  function profileRow(data) {
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  async function signedAvatar(client, path) {
    if (!path) return "";
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) return "";
    return data?.signedUrl || "";
  }

  async function removePath(client, path) {
    if (!path) return;
    await client.storage.from(BUCKET).remove([path]);
  }

  function renderPreview(node, preview, avatarUrl) {
    if (!node) return;
    const breeds = listValue(preview?.species_breeds);
    node.innerHTML = "";

    const card = document.createElement("article");
    card.className = "seller-preview-card";

    const media = document.createElement("div");
    media.className = "seller-preview-avatar";
    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = "";
      media.appendChild(img);
    } else {
      media.textContent = safeText(preview?.rabbitry_name || preview?.display_name || "HH").slice(0, 2).toUpperCase();
    }

    const body = document.createElement("div");
    body.className = "seller-preview-body";

    const badge = document.createElement("span");
    badge.className = "marketplace-preview-badge";
    badge.textContent = "Public preview";

    const title = document.createElement("h3");
    title.textContent = safeText(preview?.rabbitry_name || preview?.display_name || "Seller profile");

    const name = document.createElement("p");
    name.className = "seller-preview-name";
    name.textContent = safeText(preview?.display_name);

    const location = document.createElement("p");
    location.className = "seller-preview-meta";
    location.textContent = [safeText(preview?.city), safeText(preview?.region)].filter(Boolean).join(", ");

    const about = document.createElement("p");
    about.textContent = safeText(preview?.about) || "Add an About section to introduce your rabbitry or farm.";

    const breedsNode = document.createElement("p");
    breedsNode.className = "seller-preview-meta";
    breedsNode.textContent = breeds.length ? breeds.join(" • ") : "Add species or breeds raised.";

    body.append(badge, title);
    if (name.textContent && name.textContent !== title.textContent) body.appendChild(name);
    if (location.textContent) body.appendChild(location);
    body.append(about, breedsNode);
    card.append(media, body);
    node.appendChild(card);
  }

  async function mount(root, context) {
    if (!root || !context?.client || !context?.userId || !context.isAuthenticated || context.accountStatus !== "active" || context.marketplaceAccessReady !== true) return;
    const { client } = context;

    root.innerHTML = `
      <section class="seller-profile-layout">
        <article class="seller-profile-editor">
          <div>
            <p class="eyebrow">Seller Profile</p>
            <h2>Public-facing seller details</h2>
            <p class="marketplace-help">Only the broad profile fields below are intended for Marketplace display. Email, phone, billing details, exact address, and private herd records are not part of this profile.</p>
          </div>
          <form id="seller-profile-form" class="seller-profile-form">
            <div class="field-row">
              <label>Display name
                <input name="display_name" maxlength="100" autocomplete="name">
              </label>
              <label>Rabbitry / farm name
                <input name="rabbitry_name" maxlength="120">
              </label>
            </div>
            <div class="field-row">
              <label>City
                <input name="city" maxlength="100" autocomplete="address-level2">
              </label>
              <label>State / region
                <input name="region" maxlength="100" autocomplete="address-level1">
              </label>
            </div>
            <label>Species / breeds raised
              <input name="species_breeds" maxlength="1200" placeholder="Holland Lop, French Lop, Rex">
            </label>
            <label>About
              <textarea name="about" maxlength="1200" rows="6"></textarea>
            </label>
            <label>Avatar or rabbitry logo
              <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp">
              <span class="marketplace-help">JPG, PNG, or WebP. Maximum 5 MB. Media is stored privately and only public profile media is exposed through signed Marketplace URLs.</span>
            </label>
            <div class="seller-profile-actions">
              <button class="button" type="submit">Save Seller Profile</button>
              <span id="seller-profile-status" class="marketplace-form-status" role="status"></span>
            </div>
          </form>
        </article>

        <aside>
          <p class="eyebrow">Preview</p>
          <div id="seller-profile-preview" class="seller-profile-preview" aria-live="polite"></div>
        </aside>
      </section>
    `;

    const form = root.querySelector("#seller-profile-form");
    const status = root.querySelector("#seller-profile-status");
    const previewNode = root.querySelector("#seller-profile-preview");
    let currentAvatarPath = "";

    function setStatus(message, state = "") {
      status.textContent = message;
      status.dataset.state = state;
    }

    async function refresh() {
      const [{ data: editorData, error: editorError }, { data: previewData, error: previewError }] = await Promise.all([
        client.rpc("marketplace_member_profile_editor"),
        client.rpc("marketplace_member_profile_preview")
      ]);

      if (editorError || previewError) {
        setStatus("Seller profile data is unavailable until the verified profile API is deployed.", "error");
        return;
      }

      const editor = profileRow(editorData) || {};
      const preview = profileRow(previewData) || {};
      currentAvatarPath = safeText(editor.avatar_path);

      form.elements.display_name.value = safeText(editor.display_name);
      form.elements.rabbitry_name.value = safeText(editor.rabbitry_name);
      form.elements.city.value = safeText(editor.city);
      form.elements.region.value = safeText(editor.region);
      form.elements.about.value = safeText(editor.about);
      form.elements.species_breeds.value = listValue(editor.species_breeds).join(", ");

      const avatarUrl = await signedAvatar(client, currentAvatarPath);
      renderPreview(previewNode, preview, avatarUrl);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus("Saving…");

      let uploadedPath = "";
      const previousPath = currentAvatarPath;

      try {
        const file = form.elements.avatar.files?.[0] || null;
        if (file) {
          const ext = ALLOWED_TYPES.get(file.type);
          if (!ext || file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
            throw new Error("Choose a JPG, PNG, or WebP image no larger than 5 MB.");
          }

          const suffix = globalThis.crypto?.randomUUID?.() || String(Date.now());
          uploadedPath = `profiles/avatar-${suffix}.${ext}`;
          const { error: uploadError } = await client.storage.from(BUCKET).upload(uploadedPath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false
          });
          if (uploadError) throw new Error("Avatar upload failed.");
        }

        const speciesBreeds = safeText(form.elements.species_breeds.value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 40);

        if (speciesBreeds.some((item) => item.length > 80)) {
          throw new Error("Each species or breed entry must be 80 characters or fewer.");
        }

        const { error: saveError } = await client.rpc("marketplace_member_save_profile", {
          display_name_value: safeText(form.elements.display_name.value),
          rabbitry_name_value: safeText(form.elements.rabbitry_name.value),
          avatar_path_value: uploadedPath || previousPath,
          city_value: safeText(form.elements.city.value),
          region_value: safeText(form.elements.region.value),
          about_value: safeText(form.elements.about.value),
          species_breeds_value: speciesBreeds
        });
        if (saveError) throw new Error("Seller profile could not be saved.");

        if (uploadedPath && previousPath && previousPath !== uploadedPath) {
          await removePath(client, previousPath).catch(() => {});
        }

        currentAvatarPath = uploadedPath || previousPath;
        form.elements.avatar.value = "";
        setStatus("Seller profile saved.", "success");
        await refresh();
      } catch (error) {
        if (uploadedPath) await removePath(client, uploadedPath);
        setStatus(error?.message || "Seller profile could not be saved.", "error");
      } finally {
        submit.disabled = false;
      }
    });

    await refresh();
  }

  window.HerdHarborMarketplaceProfile = Object.freeze({ mount });
})();
