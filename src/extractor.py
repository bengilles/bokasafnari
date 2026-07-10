from bottle import response
import cloudscraper
from readability import Document
from bs4 import BeautifulSoup
from bs4 import UnicodeDammit
from urllib.parse import urljoin

# Browser-like headers to minimize scraper block rates
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
}

def extract_content(url):
    """
    Fetches HTML from url, extracts clean content using readability-lxml,
    sanitizes tags, and resolves relative URLs (images and links) to absolute.
    """
    try:
        scraper = cloudscraper.create_scraper()
        response = scraper.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Failed to fetch webpage: {str(e)}")

    # CP1252 is a superset of Latin-1 and correctly maps 0x80-0x9F (em-dashes, curly quotes, etc.).
    # Many pages declare ISO-8859-1 but are actually CP1252, causing those bytes to appear as raw
    # control characters when decoded as Latin-1. Decode the raw bytes as CP1252 upfront so that
    # readability and BeautifulSoup both receive proper Unicode from the start.
    if response.encoding and response.encoding.upper() in ('ISO-8859-1', 'LATIN-1', 'LATIN1'):
        html_text = response.content.decode('cp1252', errors='replace')
    else:
        html_text = response.text

    # Use readability-lxml to clean noise (ads, nav, sidebars) and extract primary article body
    try:
        doc = Document(html_text)
        title = doc.title()
        summary_html = doc.summary()
        
        # Fallback if readability extracts essentially nothing (e.g. older non-semantic HTML)
        if len(summary_html) < 100 or "<body></body>" in summary_html.replace(" ", ""):
            orig_soup = BeautifulSoup(html_text, 'lxml')
            if orig_soup.body:
                summary_html = str(orig_soup.body)
            else:
                summary_html = html_text
    except Exception as e:
        raise RuntimeError(f"Failed to parse content with readability engine: {str(e)}")
    
    # Parse readability output with BeautifulSoup to sanitize tags and absolute-link assets
    soup = BeautifulSoup(summary_html, 'lxml')

    # Remove potentially unsafe or structural-breaking tags inside an EPUB context
    for el in soup.find_all(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form', 'button', 'input']):
        el.decompose()

    base_url = response.url  # Use final redirected URL to resolve relative paths

    # Convert relative <a> tags to absolute URLs
    for a in soup.find_all('a', href=True):
        a['href'] = urljoin(base_url, a['href'])
        a['target'] = '_blank'  # Open links in new tab in preview windows

    # Convert relative <img> tags to absolute URLs and strip layout-breaking attributes
    for img in soup.find_all('img', src=True):
        img['src'] = urljoin(base_url, img['src'])
        # Keep only basic, semantic image attributes for e-reader layout compatibility
        for attr in list(img.attrs):
            if attr not in ['src', 'alt', 'title', 'id', 'class', 'width', 'height']:
                del img[attr]


    # Attempt to extract author metadata from the original document
    author = ""
    orig_soup = BeautifulSoup(html_text, 'lxml')
    author_meta = (
        orig_soup.find('meta', attrs={'name': 'author'}) or 
        orig_soup.find('meta', attrs={'property': 'article:author'}) or
        orig_soup.find('meta', attrs={'name': 'twitter:creator'})
    )
    if author_meta:
        author = author_meta.get('content', '').strip()

    # Extract site name
    site_name = ""
    site_meta = orig_soup.find('meta', attrs={'property': 'og:site_name'})
    if site_meta:
        site_name = site_meta.get('content', '').strip()

    # Extract the clean body inner HTML
    if soup.body:
        body_content = "".join(str(child) for child in soup.body.contents)
    else:
        body_content = str(soup)

    return {
        'url': url,
        'title': title or "Untitled Chapter",
        'author': author,
        'site_name': site_name,
        'content': body_content
    }
