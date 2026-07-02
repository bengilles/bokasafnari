# bokasafnari 

**bokasafnari** is a Python desktop application and command-line utility designed to fetch articles from the web, extract their core reading content (stripping away ads, trackers, sidebars, and styling), download and embed all inline images for offline availability, and package them into standard, highly compatible EPUB books for e-readers (Kindle, Kobo, Apple Books, etc.).

---

## Setup & Installation

### Prerequisites
- Python 3.8 or higher.
- A C-compiler/development environment might be requested by `lxml` on some systems, though pre-compiled wheels are standard.

### 1. Initialize Virtual Environment
Create and activate a local Python virtual environment to manage dependencies:

```bash
# Create environment
python -m venv venv

# Activate on Windows (PowerShell/CMD)
.\venv\Scripts\activate

# Activate on macOS/Linux
source venv/bin/activate
```

### 2. Install Dependencies
Install requirements via pip:

```bash
pip install -r requirements.txt
```

---

## Usage

### Option A: Desktop Application (GUI)
Start the native GUI wrapper:

```bash
python app.py
```
This opens a custom window where you can edit book metadata, paste URL addresses to scrape, preview reader-view pages, reorder chapters, and compile the final book.

### Option B: Command Line Interface (CLI)
You can run headless compiles directly from the terminal.

#### Convert a Single URL:
```bash
python cli.py -u "https://en.wikipedia.org/wiki/EPUB" -o "epub_spec.epub" -t "EPUB Wikipedia" -a "Wikipedia Contributors"
```

#### Convert a Batch List of URLs:
Create a text file (e.g., `articles.txt`) containing one URL per line:
```text
https://example.com/part-1
https://example.com/part-2
https://example.com/part-3
```

Run the compiler pointing to the file:
```bash
python cli.py -m articles.txt -o "complete_series.epub" -t "My Web Series"
```

---

## Packaging a Standalone Executable

You can compile the application into a standalone folder and executable (`.exe` on Windows, native bundle on macOS/Linux) that runs on systems without a Python runtime.

To compile:
```bash
python build.py
```
Once compilation completes, find the executable binary in `./dist/bokasafnari/`.

---

## Testing

Run the unit testing suite to verify scraping engines and compiler routines:

```bash
python -m unittest tests/test_app.py
```
