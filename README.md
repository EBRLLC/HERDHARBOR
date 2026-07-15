# HerdHarbor landing page

This folder contains a complete responsive static landing page for HerdHarbor.

## Files

- `index.html` — page structure and content
- `styles.css` — approved HerdHarbor colors and responsive design
- `script.js` — mobile navigation and early-access form behavior
- `assets/herdharbor-icon.png` — approved app icon

## Current signup behavior

The early-access form submits directly to Formspree using this endpoint:

`https://formspree.io/f/xgogovez`

Visitors remain on the HerdHarbor website and receive an on-page success or error message. Submissions are stored in the Formspree dashboard and sent according to the notification settings configured for the form.

## Updating the existing GitHub Pages site

1. Open the `HERDHARBOR` repository.
2. Choose **Add file → Upload files**.
3. Upload all files and the `assets` folder from this package.
4. Replace the existing `index.html`, `styles.css`, and `script.js` files when prompted.
5. Commit with a message such as `Connect early-access form to Formspree`.
6. Wait one to three minutes, then refresh `https://herdharbor.com`.
7. Submit one test entry and confirm it appears in the Formspree dashboard.

The included `CNAME` file preserves the custom domain `herdharbor.com`.

## Publish with GitHub Pages

1. Create a new GitHub repository, such as `herdharbor-site`.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save and wait for GitHub Pages to publish the site.
7. In GitHub Pages settings, add the custom domain `herdharbor.com`.
8. GitHub will show the DNS records that need to be entered in Porkbun.

## Recommended production URL structure

- `herdharbor.com` — public landing page
- `app.herdharbor.com` — future application
- `herdharbor.app` — redirect to the public page or app download page

## Brand palette

- Deep Navy: `#0D2540`
- Harbor Teal: `#2E7D7B`
- Pasture Green: `#3F5F44`
- Warm Cream: `#F7F3EA`
- Stone Gray: `#8E979D`
