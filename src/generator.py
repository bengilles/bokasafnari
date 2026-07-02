import os
import uuid
import requests
import mimetypes
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from ebooklib import epub

def generate_epub(metadata, chapters_data, output_path):
    """
    Creates an EPUB file at output_path from the given metadata and chapter HTML data.
    Downloads and embeds images inline, replacing absolute urls with relative EPUB paths.
    """
    book = epub.EpubBook()

    # Set unique identifier
    book_id = str(uuid.uuid4())
    book.set_identifier(book_id)

    # Apply metadata
    title = metadata.get('title', 'Compiled Book')
    author = metadata.get('author', 'Anonymous')
    publisher = metadata.get('publisher', 'bokasafnari')
    language = metadata.get('language', 'en')

    book.set_title(title)
    book.set_language(language)
    book.add_author(author)
    book.add_metadata('DC', 'publisher', publisher)

    # Define minimal stylesheet for e-reader layout compatibility
    style = epub.EpubItem(
        uid="style_nav",
        file_name="style/nav.css",
        media_type="text/css",
        content="""
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            margin: 5% 8%;
        }
        h1 {
            text-align: center;
            margin-top: 1.5em;
            margin-bottom: 1em;
            font-size: 1.8em;
        }
        h2, h3, h4 {
            margin-top: 1.3em;
            margin-bottom: 0.5em;
        }
        p {
            margin-bottom: 1.1em;
            text-indent: 0;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1.5em auto;
        }
        blockquote {
            margin: 1.2em 1.5em;
            font-style: italic;
            border-left: 3px solid #ccc;
            padding-left: 1em;
            color: #555;
        }
        pre, code {
            font-family: monospace, Courier;
            background-color: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        pre {
            display: block;
            padding: 1em;
            overflow-x: auto;
            border: 1px solid #ddd;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5em 0;
            font-size: 0.9em;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f8f8f8;
        }
        """
    )
    book.add_item(style)

    chapters = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    # Ensure output parent directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    for ch_idx, ch_data in enumerate(chapters_data):
        ch_title = ch_data.get('title', f"Chapter {ch_idx + 1}")
        ch_content = ch_data.get('content', '')

        # Parse text content with BeautifulSoup
        soup = BeautifulSoup(ch_content, 'lxml')

        # Download and embed images inline
        img_tags = soup.find_all('img')
        for img_idx, img in enumerate(img_tags):
            img_url = img.get('src')
            if not img_url:
                img.decompose()
                continue

            try:
                # Fetch image binary data
                img_res = requests.get(img_url, headers=headers, timeout=12)
                img_res.raise_for_status()

                # Determine MIME type and file extension
                content_type = img_res.headers.get('Content-Type', '')
                ext = mimetypes.guess_extension(content_type.split(';')[0])
                if not ext:
                    # Guess from URL path
                    parsed_url = urlparse(img_url)
                    _, url_ext = os.path.splitext(parsed_url.path)
                    ext = url_ext if url_ext else '.jpg'

                ext = ext.lower()
                if ext in ['.jpe', '.jpeg']:
                    ext = '.jpg'
                elif not ext.startswith('.'):
                    ext = '.' + ext

                img_name = f"images/img_{ch_idx}_{img_idx}{ext}"
                mime_type = content_type.split(';')[0] if content_type else mimetypes.types_map.get(ext, 'image/jpeg')

                # Instantiate and add image to the EPUB container
                epub_img = epub.EpubImage()
                epub_img.file_name = img_name
                epub_img.media_type = mime_type
                epub_img.content = img_res.content
                book.add_item(epub_img)

                # Re-route the image source in the XHTML to the local EPUB folder path
                img['src'] = img_name

            except Exception:
                # Per instructions, if image download fails, remove it to keep text clean
                img.decompose()

        # Wrap clean XHTML content
        file_name = f"chap_{ch_idx + 1}.xhtml"
        chapter = epub.EpubHtml(title=ch_title, file_name=file_name, lang=language)
        
        # Compile final body html snippet
        body_content = "".join(str(child) for child in soup.body.contents) if soup.body else str(soup)
        chapter.content = f"<h1>{ch_title}</h1>\n{body_content}"
        chapter.add_item(style)

        book.add_item(chapter)
        chapters.append(chapter)

    # Establish navigation and TOC hierarchies
    book.toc = tuple(chapters)
    book.add_item(epub.EpubNav())
    book.add_item(epub.EpubNcx())

    # Build Spine reading list
    book.spine = ['nav'] + chapters

    # Compile the physical EPUB file
    epub.write_epub(output_path, book, {})
