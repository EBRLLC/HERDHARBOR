const form = document.querySelector("#deletion-form");
const status = document.querySelector("#deletion-status");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.className = "legal-status";
  status.textContent = "Submitting your deletion request…";
  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("The request could not be submitted.");
    form.reset();
    status.className = "legal-status success";
    status.textContent = "Your deletion request was submitted. Watch the account email for confirmation or follow-up.";
  } catch (error) {
    status.className = "legal-status error";
    status.innerHTML = 'The request could not be submitted. Email <a href="mailto:hello@herdharbor.com?subject=Account%20deletion%20request">hello@herdharbor.com</a> from the account email.';
  } finally {
    button.disabled = false;
  }
});
