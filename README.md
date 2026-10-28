# Al Bahar Itinerary Studio — V1.3 (Quick Create + Google Hotel Search)

**Ready to deploy on GitHub Pages. All hotel search functionality is OPTIONAL.**

## Quick installation / update from V1.2

1. Download and extract the ZIP; upload its **contents** to the GitHub repository root.
2. Files should be directly accessible as `index.html`, `app.js`, `styles.css`, `assets/...`, `.nojekyll`.
3. In GitHub → Settings → Pages → Deploy from a branch: choose `main`, `/(root)`.
4. Existing browser-stored itineraries remain on the **same site/origin and browser** because the localStorage key remains the same. Export JSON first as a backup. Changing the repository URL or browser does not transfer local data.

## Optional Google hotel search setup (no API key included)

1. Create a Google Cloud project in your **own** account at https://console.cloud.google.com/ and enable billing.
2. Enable **Maps JavaScript API** and **Places API (New)** in APIs & Services.
3. Create a browser API key. **Application restriction: Websites (HTTP referrers)**. Add your GitHub Pages site, e.g. `https://YOUR-USERNAME.github.io/*` (and custom domain if applicable).
4. **API restrictions**: Allow only **Maps JavaScript API** and **Places API (New)**. Set daily quotas and billing alerts as appropriate.
5. On the hosted website, open **Hotel & stay** → paste the **restricted browser API key** → **Enable hotel search** → **Search hotels with Google**. Search for a hotel by name, select a suggestion, confirm it against the booking, and the name and address will be inserted into the hotel form.
6. Enter actual room configuration, meals and check-in/check-out details manually. These are not obtained from Google.

**Keep in mind:** GitHub Pages is a public static website. Maps JavaScript API keys in browser applications are publicly observable; website and API restrictions are essential. The key is saved in the current browser's localStorage, not baked into the downloaded source code, and not exported in itinerary backups. Each staff browser must configure the key independently in this prototype. If changing the key after initial connection, reload the page. Never publish an unrestricted key or a server-side secret.

**Billing:** Google Maps Platform requires a billing-enabled project, even when eligible free monthly usage allowances cover the cost. Google may charge beyond quotas; refer to the current https://developers.google.com/maps/billing-and-pricing/pricing-india and your own billing account for exact rates.

**Licensing:** Only the hotel's name and address are requested from Google. Google hotel photos are **not** fetched, stored or embedded in PDFs. Confirm the selected hotel's details before sending. Follow Google's Maps Platform Terms for the intended use of Places data, including retention and attribution requirements; this demo is not a substitute for a contractual review.

**What is NOT done:** No live hotel prices, room availability, supplier confirmation, hotel photo API, activity API, multi-hotel itinerary search or employee sync. The existing manual hotel input and day-by-day plan builder continue to work without Google configured.

---

# Earlier V1.2 features and workflow

**Fast, no-API itinerary generation for client approval.**

## New quick workflow

1. Click **Quick create** (opens by default). Enter customer, destination, start and end dates. Reference, document title, trip days and destination cover are automatically prepared.
2. Paste supplier-provided day-wise lines (`Day 1 - Arrival`, followed by `- Airport pickup`, etc.) and click **Build days from text**, or choose an unconfirmed destination starter outline. Check all activity details before sending.
3. Click **Edit** on a day for optional times, transfers, meals and confirmed inclusions. Hotel is optional.
4. Open **Branding & contact** once and enter the correct consultant details. New itineraries inherit branding and consultant fields from the active document.
5. Export PDF from the browser print dialog.

**No AI or API is used for converting pasted day-wise text.** The parser recognizes numbered Day headings and bullet lines. Complex prose or PDFs from external suppliers require manual preparation. Rebuilding from pasted text replaces the existing day plan, after confirmation.

**Caution:** Starter outlines are illustrative planning suggestions, not booked activities, available tickets or confirmed service inclusions. Staff must review them before sharing.

## Publish on GitHub Pages

1. Create a new GitHub repository (e.g. `al-bahar-itinerary-studio`).
2. Upload the *extracted contents*, **not just the ZIP**: `index.html`, `styles.css`, `app.js`, `assets/`, `.nojekyll`, and the README.
3. In GitHub go to **Settings → Pages → Build and deployment**.
4. Set **Deploy from a branch**, choose branch `main`, folder `/ (root)` and Save.
5. Visit `https://YOUR-USERNAME.github.io/al-bahar-itinerary-studio/`.

The image paths are relative, so the application works on GitHub Pages repository subpaths.

## Adding more destinations (no API)

Create `assets/destinations/goa/` and put one or more properly licensed WebP files in it. Then add an object to the `DESTINATIONS` array near the top of `app.js`, for example:

```js
{
  id:'goa',
  name:'Goa',
  aliases:['goa','panaji','calangute'],
  images:[
    ['cover-1.webp','Beachfront'],
    ['cover-2.webp','Coastline']
  ]
}
```

The application constructs relative image paths automatically. Choose your photo file names freely; update the file names in the catalog to match. There is no centralized upload or photo-management interface in this static demo. New shared destinations are added by updating the repository; per-trip upload works in the browser.

### About the supplied destination pictures

The twelve bundled WebP images are **three crops/compositions of one original AI-generated scene per destination**, created for the approval demo. They are illustrative and should **not be treated as verified documentary photos** of an actual property, precise attraction or real activity. For the final client-facing product, replace the demo scenes with location-accurate images the agency owns or is licensed to reuse. Do not copy random online hotel photographs into customer PDFs.

## Important Phase 1 limitations

- Data and customer documents are stored in **this browser's localStorage** only, not centrally or across staff devices. Back up itineraries using **Branding & contact → Export data** and use Import JSON to restore them.
- The demo has **no authentication, role control or private database**. A public GitHub Pages link provides access to the app itself, so do not insert sensitive passport, identity or financial information.
- Company name, logo, employee name and contact information can be edited, but employee details are **not automatically fetched from user login**.
- The PDF is generated through the browser's **Print → Save as PDF** workflow, not a server-side PDF service.
- No hotel images, activity databases, real-time pricing, or automatic itinerary creation APIs.
- Automated print page-break handling for extremely long hotel/activity content is outside this demonstration scope.
- The destination images are bundled in the repository, so ordinary selection requires **no remote image calls**.

## Project files

```text
index.html                            Static application HTML
styles.css                            Responsive UI and premium print CSS
app.js                                Editor, image catalog, storage and print
assets/al-bahar-logo.png              Logo supplied by client
assets/destinations/kashmir/*.webp    3 scenic cover compositions
assets/destinations/kerala/*.webp     3 scenic cover compositions
assets/destinations/dubai/*.webp      3 scenic cover compositions
assets/destinations/bali/*.webp       3 scenic cover compositions
.nojekyll                             GitHub Pages compatibility
```

For production, staff authentication, centrally managed destinations and company-approved image storage can be added without rebuilding the core itinerary data structure.
