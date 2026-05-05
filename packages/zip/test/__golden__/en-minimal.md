# Deploying HISTORIPOL Student Association to Cloudflare Pages

This document is your deployment handoff, generated from the editor. It covers two paths: a no-Git path (Direct upload via the Cloudflare dashboard) and a Git-connected path (for users with a GitHub account).

## What you need

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account (at the time of writing, the Free plan is sufficient for a student-organization site).
- The `dist/` folder from your exported zip — this is the complete static site, ready to publish.
- (Optional) A custom domain (e.g. `historipol.ro`) if you want your own address.

## Path 1: Direct upload (recommended if you do not have GitHub)

This path uses the Cloudflare dashboard to upload the built site. You do not need Git, GitHub, or the command line.

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and open **Workers & Pages** in the sidebar.
2. Click **Create application** → the **Pages** tab → **Upload assets**.
3. Give the project a name (e.g. `historipol-site`). This becomes the default subdomain, e.g. `historipol-site.pages.dev`.
4. Drag and drop the `dist/` folder (or click **Select from computer** and pick it). Wait for all files to upload.
5. Click **Deploy site**. Within a few seconds, the site is live at `https://<your-name>.pages.dev`.
6. To update, repeat steps 4–5 in the same project: upload a new `dist/` folder and Cloudflare publishes the new version.

![Cloudflare dashboard with the Create application button highlighted](docs/deploy/screenshots/01-direct-upload-create-application.png)

![The drag-and-drop area for the dist folder](docs/deploy/screenshots/02-direct-upload-drop-dist.png)

![The deploy confirmation showing the *.pages.dev URL](docs/deploy/screenshots/03-direct-upload-deployed.png)

## Path 2: Git-connected (recommended if you already have a GitHub repository)

This path connects a GitHub repository to Cloudflare Pages. On every commit to the main branch, Cloudflare publishes the updated version automatically. There is no separate build step — your site is already static; Cloudflare serves it from `dist/`.

1. Create a GitHub repository and push the contents of the `dist/` folder to the repository root. (Alternatively: push the whole exported zip and set `dist/` as the build-output folder below.)
2. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Workers & Pages** → **Create application** → the **Pages** tab → **Connect to Git**.
3. Authorize Cloudflare to read your GitHub repositories (once per account), then select the site repository.
4. On the **Set up builds and deployments** screen, leave **Build command** empty (the site is already built) and set **Build output directory** to `/` if you pushed only `dist/`, or to `dist` if you pushed the whole zip.
5. Click **Save and Deploy**. Cloudflare clones the repository and publishes the site to `https://<your-name>.pages.dev`.
6. On every push to the main branch, Cloudflare auto-deploys. Non-main branches get preview deploys at unique URLs — useful for reviewing changes before merging.

![GitHub authorization screen for Cloudflare Pages](docs/deploy/screenshots/04-git-connect-authorize.png)

![Build settings with Build output directory filled in](docs/deploy/screenshots/05-git-connect-build-settings.png)

![Deploy list showing commits and unique URLs](docs/deploy/screenshots/06-git-connect-deployed.png)

## Custom domain (optional)

The `*.pages.dev` subdomain works out of the box, but most organizations prefer a branded address such as `historipol.ro`. Setup is two steps: DNS configuration and HTTPS activation.

### Step 1: DNS configuration (CNAME)

In the Pages project, open the **Custom domains** tab → **Set up a custom domain** and enter your domain (e.g. historipol.ro). Cloudflare shows a CNAME record to add at your DNS provider — typically `<your-domain>` with the value `<project-name>.pages.dev`. Add it in your registrar's panel (GoDaddy, Namecheap, RoTLD, etc.). DNS propagation can take from a few minutes to a few hours.

If your domain is already managed by Cloudflare (nameservers transferred), the steps are automated: tick the domain in the dashboard list and the CNAME is added for you.

### Step 2: HTTPS activation (TLS)

Once the CNAME propagates, Cloudflare automatically issues a free TLS certificate (Let's Encrypt or Cloudflare Origin CA depending on your setup). HTTPS becomes active within a few minutes of the domain showing as **Active** in the dashboard. There is no manual certificate to copy or upload.

Verify that `https://<your-domain>` opens without security warnings before announcing the address publicly.

## After publishing

- Share the public URL with your members and double-check the site renders well on mobile and desktop.
- Save the exported zip somewhere safe (Drive, email) — it is the single source of truth for your site.
- When handing the site to next year's leadership, give them the zip plus this file — they have everything they need to continue.

---

Generated by the editor. If the Cloudflare dashboard steps look different in practice, consult the [official Cloudflare Pages documentation](https://developers.cloudflare.com/pages/) — it is more current than this file.
