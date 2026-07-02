import argparse
import sys
import os
from src.extractor import extract_content
from src.generator import generate_epub

def main():
    parser = argparse.ArgumentParser(description="bokasafnari - Web Page to EPUB Converter (CLI)")
    
    # Mutual exclusivity for input sources
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-u', '--url', type=str, help="Single webpage URL to scrape and convert")
    group.add_argument('-m', '--multi', type=str, help="Path to text file containing a list of URLs (one per line)")
    
    parser.add_argument('-o', '--output', type=str, required=True, help="Destination filepath for the compiled EPUB (e.g. output.epub)")
    parser.add_argument('-t', '--title', type=str, default="Compiled Web Book", help="Title metadata for the compiled Ebook")
    parser.add_argument('-a', '--author', type=str, default="Scraped Reader", help="Author metadata for the compiled Ebook")
    parser.add_argument('-p', '--publisher', type=str, default="bokasafnari", help="Publisher metadata for the compiled Ebook")
    
    args = parser.parse_args()
    
    # Resolve input URL list
    urls = []
    if args.url:
        urls.append(args.url)
    elif args.multi:
        if not os.path.exists(args.multi):
            print(f"Error: Multi-url source file '{args.multi}' does not exist.")
            sys.exit(1)
        with open(args.multi, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip comments or empty lines
                if line and not line.startswith('#'):
                    urls.append(line)
        if not urls:
            print("Error: Resolved URL list is empty.")
            sys.exit(1)
            
    print(f"Initiated scrape for {len(urls)} url(s)...")
    
    chapters = []
    for idx, url in enumerate(urls):
        print(f"[{idx+1}/{len(urls)}] Fetching & extracting: {url}")
        try:
            ch_data = extract_content(url)
            chapters.append(ch_data)
            print(f"  -> Extracted chapter title: '{ch_data['title']}'")
        except Exception as e:
            print(f"  -> Scrape failed for '{url}': {str(e)}")
            # If converting a single URL, compile fail is a hard crash. For multi-chapter compiling, allow continuation
            if len(urls) == 1:
                sys.exit(1)
                
    if not chapters:
        print("Error: No chapters were successfully extracted. Compilation cancelled.")
        sys.exit(1)
        
    print(f"Compiling EPUB to target: {args.output}")
    metadata = {
        'title': args.title,
        'author': args.author,
        'publisher': args.publisher
    }
    
    try:
        generate_epub(metadata, chapters, args.output)
        print(f"Success! EPUB book compiled successfully: '{args.output}'")
    except Exception as e:
        print(f"Error compiling EPUB: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
