# Demand Group storefront

The public site has a curated homepage, `/watch-faces/` catalog, and an individual static page for every product. The existing GitHub Pages hosting remains `main:/docs`; matching assets and framework routes are also generated.

## Update a product

- Edit `website/products.json`. Titles, packages and release status must come from the owner or a verified Google Play listing. An unannounced product uses `coming-soon`, with no invented package or purchase link.
- The three previews added on 2 November 2026 are Flat Earth, Long Distance Call and Megastructure. Solar Flare and Grunge Rock were verified against Demand Group’s public Google Play listings.
- `legacy-products/` retains the original product galleries, videos, installation details and footer/support content from the former homepage. The generator moves these intact to their own product pages.
- Store optimized images in both `public/products/` and `docs/products/`. New release images use the existing approved artwork, with proportional resizing/WebP encoding only; source filenames and hashes are in `media-provenance.json`. AI campaign mockups and illustrated personalization examples are labelled separately from original dial captures.
- Run `npm run build:storefront` and `npm test`. Commit generated `docs`, `public` and `app` copies together. Adding another known product is a data/content update, not another homepage section.
- On 4 November 2026, Long Distance Call (`com.watchfacestudio.longdistancecall`) and Megastructure (`com.watchfacestudio.blamelike`) were verified on Google Play and marked available, with their purchase links enabled. Flat Earth remains a studio preview.
- The companion discovery feed remains `/catalog/watchfaces.json`, with its existing schema and sync job. Pre-launch website previews are intentionally excluded from it. Mark a preview available and provide its real package only after release is verified.

## Browsing behavior

The catalog initially shows 12 cards and reveals another 12 on request. Collection, availability, search, order and expanded count are kept in the URL; returning from a detail page restores that selection. Every product link is present in static HTML for accessibility and discovery without JavaScript. No analytics, email capture, new backend, or paid hosting was added.

On phones, homepage previews can be moved manually with visible Previous/Next controls. Nothing auto-advances. Product catalogs use a compact grid rather than a mandatory carousel. The Exclusive promotion remains private and separate.

## Research checked on 2 November 2026

- AMOLED Watch Faces: search, collection filters, sorting and Load More — https://amoledwatchfaces.com/
- BALLOZI: limited product groups and total result count — https://balloziwatchfaces.com/
- Matteo Dini: search and recent product cards — https://www.matteodinimd.com/
- Baymard’s product-list research supports user-controlled incremental loading — https://baymard.com/blog/product-listing-page-plp-ux
- Nielsen Norman Group discusses visibility and control limitations of automatic carousels — https://www.nngroup.com/articles/designing-effective-carousels/
