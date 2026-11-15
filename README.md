# Shipping Label Tool

Client-side A4 shipping label customizer and visual layout editor.

## Editors

- [Visual A4 editor](editor.html): drag, resize, duplicate, position labels in millimetres and export an A4 PDF.
- [Original automatic label tool](index.html): legacy branded grid layout.

## Usage

Open `editor.html` in a modern browser with internet access for PDF.js and pdf-lib CDN dependencies. Upload PDF or image shipping labels, drag or resize them on the A4 preview, and download the finished PDF. Print at **Actual size (100%)**, not fit-to-page.

PDF and image processing occurs in the browser; files are not uploaded to a server. Imported PDF pages are embedded as vector content in exported PDFs where supported.

## Current limitations

- One A4 output page per export.
- No crop or rotate tool yet.
- CDN libraries require connectivity.
- No automated browser or printer verification has been performed; check barcode readability and print dimensions before production use.
