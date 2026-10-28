# Al Bahar Journey Desk V2 — client-specific prototype

A working, custom-designed **manual itinerary creator** for Al Bahar Tours & Travels. The product is designed around a travel agent's **reuse → personalise → revise → export** workflow, not a long series of mandatory form fields.

## Quickest path to demonstrate to the client

1. Open the application. It starts with a **Kashmir five-day example**, deliberately different from the client's existing Dubai PDF.
2. Under **Start from a proven structure**, choose a master route. The master route fills the day plan automatically. Change the **traveller**, **destination** and **dates** in the small Journey Brief form.
3. Expand any day and edit only its unique services. Use **Paste a full plan** to convert `Day 1 - Arrival` and bullet lines into editable days, without AI or any API.
4. Optionally add one or more hotel stays. Hotel images and descriptions are not mandatory, and empty hotel panels do not appear in the PDF.
5. Open **Agency & staff**, enter the consultant name and contact information once. These details are reused in the PDF.
6. Click **Export PDF**, choose **Save as PDF** in Chrome's print dialog, with **Background graphics enabled**, on A4.
7. Choose **Save as reusable master** after you approve a route. From then on, staff can create customer itineraries by copying it rather than re-entering services.

The entire customer-facing itinerary is rendered from **one editorial PDF layout**, not different handmade templates for each city.

## Github Pages deployment

1. Create a public GitHub repository (for the demo only).
2. Extract the ZIP and upload **its contents** to the repository root: `index.html`, `app.js`, `styles.css`, `assets/`, `.nojekyll` and `README.md`.
3. On GitHub, open **Settings → Pages → Build and deployment → Deploy from a branch**. Select the `main` branch and the `/ (root)` folder.
4. Open `https://YOUR-USERNAME.github.io/REPOSITORY/`.
5. Use a modern browser. Google Fonts are optional: system/Georgia fallbacks work if offline.

Assets use **relative URLs**, so the app works when hosted under a GitHub Pages repository path.

## Main capabilities

- Agency-branded workspace, with Al Bahar's actual logo.
- Small traveller-and-dates brief, with calculated trip length and unique reference.
- Reusable master journeys for Dubai, Kashmir, Kerala and a flexible route, plus staff-created masters.
- One-click day reuse, add/remove services, confirmed breakfast/lunch/dinner tags.
- Paste a day-wise outline; the local parser supports `Day 1 - Arrival`, bullet lines, optional times. It is **not AI extraction** and will not correctly parse arbitrary PDFs or screenshots.
- Hotel/stay is optional; multiple hotel stays supported; no hotel photo requirement.
- Four destination image sets. Cover selection follows the destination; a custom uploaded image is available.
- One consistent customer-facing, print-friendly proposal design with cover, summary, detailed days, optional stay and proposal details.
- Local browser drafts, duplication, saved masters, backups and a V1.3-data migration path.
- Optional Google Places hotel search. Configured in **Agency & staff** with your own restricted browser API key. Only hotel name and address; no prices, photos or live inventory.
- Responsive editing on desktop and mobile.

## What is optional and what is not yet a production application

- **No paid API is required** for the manual builder. Google hotel autocomplete is optional and needs an **enabled billing account**, Maps JavaScript API, Places API (New) and a website-restricted browser key. The Maps JS key can be viewed in the browser; never paste an unrestricted secret or backend API key. Enable API quotas and billing alerts.
- GitHub Pages is public, and this prototype has **no staff authentication, central database, audit trail or cross-device sync**. Browser storage is local to each device and origin; use the Backup JSON function before clearing data or moving GitHub URLs. Do not enter sensitive identification documents or payment details.
- Older V1.3 browser drafts at the **same site URL** are copied on first launch; the earlier stored data is left unchanged. JSON import is also supported. Always export backups before replacing live files.
- Demo destination pictures are AI-created illustrative scenery. They are **not authenticated photographs** of specific hotels or attractions. Replace them with location-accurate, licensed photography before issuing customer itineraries. Photo cropping/composition is not documentary verification.
- Staff details in the PDF are manually set once in the demo. Automatic prepared-by attribution requires production employee accounts.
- Activity details and included meals must be checked by an employee before sharing. No supplier reservation, flight confirmation, ticket issuance or price is inferred by the app.
- Print to PDF is controlled by the employee's browser; a server-side PDF service is a later production improvement. Very long descriptions and complex itineraries may need more print-layout testing.

## Custom Google Places setup

1. In Google Cloud, enable billing, **Maps JavaScript API** and **Places API (New)**.
2. Restrict the key by **HTTP referrer** to your deployed website; use API restrictions on the two named APIs.
3. In **Agency & staff** paste the restricted browser key and save.
4. Add a stay, then choose **Find hotel via Google** and confirm a result. It only supplies the displayed name and address. Photos and prices are not used.
5. Observe Google's content-retention, attribution and terms requirements. The app does not download or embed Google hotel photos in customer PDFs.

The Google interaction has an interface implementation but requires your actual authorised key to verify in live operation.

## Project layout

```
index.html                         Application shell
styles.css                         Custom editorial UI and A4 print design
app.js                             Editor, master reuse, import/export and optional hotel search
assets/al-bahar-logo.png           Client's logo
assets/destinations/*/*.webp       Demo destination images
.nojekyll                           GitHub Pages static-file support
README.md                          Setup and limitations
```

**Before quoting:** Demo approval should cover the editor workflow, one PDF layout, saved master journeys, and optional hotel entries. Quote production authentication, shared storage, access control, PDF generation and Google APIs separately after client confirmation.
