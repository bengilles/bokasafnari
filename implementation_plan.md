# Web Page to EPUB Desktop Application (bokasafnari) - Implementation Plan

Create a Python-based desktop application that scrapes web pages, extracts their main reading text (removing ads, sidebars, and navigation), downloads/embeds images, and packages them into standard EPUB files. 

By combining a **Python backend** with **`pywebview`**, we can display a modern, responsive HTML/CSS/JS front-end inside a native window. This avoids browser CORS limits, port conflicts, and local server setups while providing native operating system services (like native "Save File" dialogs).

## Architecture Details

- **Architecture:** The application runs as a native desktop GUI window loading a local HTML/CSS/JS UI (`public/index.html`). 
- **Bridge API:** No local web server is needed. `pywebview` sets up a native JS-to-Python bridge (`window.pywebview.api`) that enables asynchronous Python function execution directly from JavaScript.
- **Native Integration:** We will use `pywebview`'s native file dialogs. When compiling the EPUB, the app opens a native OS file dialog so the user can choose where to save the `.epub` file.
- **Distribution:** We will use **PyInstaller** to compile the application into a single executable (`.exe` on Windows) so that it can be run on machines without a Python runtime installed.

## Image Handling Logic

- **Offline Image Embedding:**
  - The parser scans the article HTML for `<img>` tags.
  - The Python backend downloads those images and bundles them as binary assets inside the EPUB, rewriting HTML links to map locally (`images/image_x.jpg`).
  - **Error Handling:** If an image fails to download (due to 404s, hotlink protections, or timeouts), it will be silently skipped and its tag removed to maintain clean readable layout formatting.

## Proposed Changes

We will create a clean modular Python folder structure in the workspace.

---

### Core Dependencies

#### [requirements.txt](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/requirements.txt)
Define Python project dependencies:
- `requests`: Fetching webpage HTML and images.
- `readability-lxml`: Extracting core article text.
- `ebooklib`: Packaging chapters, TOC, spine, and media into an EPUB file.
- `beautifulsoup4`: Parsing and cleaning HTML, extracting img tags.
- `pywebview`: Native desktop wrapper and bridge.
- `lxml`: High-performance XML/HTML parser.
- `pyinstaller`: Packages the app and assets into a standalone executable.

---

### Scraper & Compiler Modules

#### [extractor.py](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/src/extractor.py)
Core scraping module:
- Fetches HTML using `requests` with a realistic `User-Agent`.
- Cleans and isolates readable content using `readability.Document`.
- Uses `BeautifulSoup` to strip script tags, inline styles, trackers, and widgets.
- Converts relative URLs to absolute links.

#### [generator.py](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/src/generator.py)
EPUB compilation engine:
- Instantiates `ebooklib.epub.EpubBook`.
- Downloads remote images embedded in the chapter text, adds them as `EpubImage` assets, and adjusts image links.
- If an image download fails (e.g. timeout or 404), the image tag is deleted from the chapter layout.
- Supports single-chapter and multi-chapter books with complete spine and Table of Contents (TOC).
- Saves compilation directly to a specified output file path.

---

### Desktop Native Entry Point

#### [app.py](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/app.py)
Desktop application manager:
- Configures `pywebview` window.
- Implements the Python bridge class `Api` exposing:
  - `extract_url(url)`: Runs extraction on a thread and returns article JSON.
  - `compile_epub(metadata, chapters)`: Triggers native "Save File Dialog" to fetch target path, runs EPUB compile, and returns success.
- Loads static UI entry `public/index.html`.

---

### Premium UI Portal

#### [index.html](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/public/index.html)
Main GUI interface layout:
- Left panel: Ebook Metadata (Title, Author, Publisher) and Chapter Manager (URL input, reorderable queue list).
- Right panel: "Live Reader Preview" showing how the scraped web article will look.
- Translucent control headers and floating status indicators.

#### [style.css](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/public/style.css)
Sleek dark-themed UI stylesheets:
- Deep indigo/charcoal color palette.
- Hover micro-animations and glowing loading states.
- Clean typography and grid cards.

#### [app.js](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/public/app.js)
Frontend event handler:
- Binds to the JS-to-Python bridge (`pywebview.api`).
- Coordinates state: list of compiled chapters, title metadata.
- Updates preview view and shows active loaders during scraping and compilation.

---

### CLI Interface

#### [cli.py](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/cli.py)
CLI runner:
- Allows headless compilations from terminal: `python cli.py -u <url> -o <output.epub>`.

---

### Documentation & Build Configuration

#### [build.py](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/build.py)
PyInstaller compilation script:
- Invokes PyInstaller programmatically to package `app.py` and the `public/` directory into a standalone `.exe`.
- Configures asset copying (`public/` folder inclusion) so all assets are bundled within the binary.

#### [README.md](file:///c:/Users/bengi/OneDrive/Coding/bokasafnari/README.md)
Update setup instructions for creating virtual environments, installing requirements, starting the desktop app (`python app.py`), utilizing CLI arguments, and compiling the executable (`python build.py`).

---

## Verification Plan

### Automated Verification
- Write a unit test script `tests/test_app.py` verifying readability scraper accuracy on dummy pages.

### Manual Verification
1. Create and activate a python virtual environment.
2. Run `pip install -r requirements.txt`.
3. Launch the desktop GUI: `python app.py`.
4. Input a URL and verify a native window loads and displays the preview pane.
5. Compile the book and confirm that a **native Windows Save File Dialog** opens.
6. Save the EPUB file and verify it compiles, includes metadata, runs offline, and displays in e-reader apps.
7. Run `python build.py` to compile the app via PyInstaller.
8. Verify that the generated executable in the `dist` directory launches correctly and functions standalone.
