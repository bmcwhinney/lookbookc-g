# Lookbook PDFs

Run from this folder (needs Node and Google Chrome):

    npm install
    PW_CHANNEL=chrome npm run pdf:all
    PW_CHANNEL=chrome npm run pdf:workspace

PDFs are written to `../pdf/` at full print resolution (about 25MB).
Before committing, compress them for the web (about 4MB): images are
resampled to 150dpi, JPEG quality 80. Full-resolution print masters are kept
outside the repo, in `Copa + Glas/Brand Kit/08 Lookbook/Print masters`.

This folder holds the only `package.json` in the repo, so Netlify publishes
the site as plain static files and never runs an install or build.
