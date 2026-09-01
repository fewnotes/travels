# personal-sites

Interactive "places visited" maps (US/Canada states & provinces, and world
countries), built as static HTML/CSS/JS for GitHub Pages.

## Regenerating map boundary data

`assets/data/us-canada.geojson` and `assets/data/world-countries.geojson`
are static snapshots, generated once and committed to the repo. The map
only ever reads these committed files at runtime — it does not fetch or
check the original data sources (`us-atlas`, `world-atlas`,
`click_that_hood`) live, so upstream boundary corrections or updates will
not reach the site automatically.

To pick up upstream changes, regenerate the files:

```sh
cd scripts
npm install
npm run generate
```

This overwrites both files in `assets/data/`. Review the diff, then commit
it if it looks right:

```sh
git diff --stat assets/data/
git add assets/data/
git commit -m "Regenerate map boundary data"
```

See `scripts/generate-geodata.js` for exactly what each dataset includes
and excludes (e.g. dropped uninhabited territories, Kosovo/Somaliland/N.
Cyprus fallback codes).
