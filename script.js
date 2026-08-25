const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (nav && !nav.querySelector('a[href="/how-to/"]')) {
  const howToLink = document.createElement("a");
  howToLink.href = "/how-to/";
  howToLink.textContent = "How-To";

  const faqLink = nav.querySelector('a[href="#faq"]');
  const appButton = nav.querySelector(".button");

  if (faqLink) {
    nav.insertBefore(howToLink, faqLink);
  } else if (appButton) {
    nav.insertBefore(howToLink, appButton);
  } else {
    nav.appendChild(howToLink);
  }
}

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const form = document.getElementById("waitlist-form");
const status = document.getElementById("form-status");

if (form && status) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    status.className = "form-status";
    status.textContent = "Sending your early-access request…";

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: {
          "Accept": "application/json"
        }
      });

      if (response.ok) {
        form.reset();
        status.className = "form-status success";
        status.textContent = "You’re on the tester update list! Watch your inbox for HerdHarbor news.";
      } else {
        const data = await response.json().catch(() => null);
        const message =
          data?.errors?.map((error) => error.message).join(", ") ||
          "We could not submit the form. Please try again or email hello@herdharbor.com.";
        throw new Error(message);
      }
    } catch (error) {
      status.className = "form-status error";
      status.textContent =
        error.message ||
        "We could not submit the form. Please try again or email hello@herdharbor.com.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}
