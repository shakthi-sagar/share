# Previewing files

Share is an artifact viewer, not only a download page. Decryption happens in your browser. A preview never changes the uploaded file, and **Download** always returns the original bytes.

## Images and visual review

PNG, JPEG, WebP, GIF, AVIF, SVG, HEIC and TIFF can be previewed when the browser and decoder support them. Multi-image shares open as a gallery. Choose **Compare** to put two renders next to each other, or open the review lightbox to zoom, pan, play a slideshow and pin notes. Notes are kept in the current tab, not published or sent to the server.

## Documents and structured data

| Files                         | What you can do                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| PDF                           | Navigate pages, jump to a page, zoom, and search text.                                 |
| DOCX                          | Read a best-effort formatted layout.                                                   |
| PPTX                          | Navigate extracted slides with basic placement and styling.                            |
| XLSX                          | Choose sheets, browse rows and filter text.                                            |
| Markdown                      | Render formatted text and Mermaid diagrams, or inspect source.                         |
| JSON, YAML, HTML, source code | Inspect highlighted text, optionally format it, and switch back to the exact original. |
| CSV and TSV                   | Browse data as a table.                                                                |
| ZIP                           | Browse an archive's contents without extracting it to disk.                            |
| OBJ, STL, glTF and GLB        | Orbit an interactive model. glTF/GLB assets must have embedded textures and buffers.   |

Office rendering is **not a substitute for Word, Excel or PowerPoint**. Unsupported charts, embedded objects, formulas and complex layout can look different. Download the original for full fidelity.

## HTML bundles

Put the HTML and its local dependencies in the **same share**, preserving their relative paths. For example:

```text
review/
  index.html
  images/
    chamber.png
  styles/
    gallery.css
```

In `index.html`, `<img src="images/chamber.png">` resolves to the encrypted image from that folder. Links between local HTML pages, `srcset` images, CSS backgrounds and bundled fonts also work.

Shared HTML is **not a live web app**. Scripts, forms, external network requests and embedded frames are blocked in the preview. External links and scripts should not be expected to function. To preview an actual interactive app, host it separately.

## Large files and memory

Small decrypted files are cached only in this tab's memory (up to **16 MiB per file** and **64 MiB total per unlocked share**). A refresh discards them. PDF and supported media previews use range reads and chunk streaming where possible. A decoder may still allocate a large buffer, so loading a very large document or unsupported video can consume memory.

Large downloads use the browser's save picker or a streaming download route where supported. On older browsers, the fallback may require enough memory for the file.

## When a preview does not work

Try **Download** first. A missing preview can mean an unsupported codec, a corrupt file, a browser limitation or a file larger than its preview limit. See [Troubleshooting](/docs/troubleshooting) for specific checks.
