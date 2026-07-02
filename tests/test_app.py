import unittest
from unittest.mock import patch, MagicMock
import os
import shutil
from src.extractor import extract_content
from src.generator import generate_epub

class TestBokasafnari(unittest.TestCase):
    
    @patch('requests.get')
    def test_extractor_success(self, mock_get):
        """
        Verify that HTML content is cleanly scraped, layout clutter
        (scripts, style blocks) is stripped, and relative assets are absolute-resolved.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.encoding = 'utf-8'
        mock_response.url = 'https://example.com/article'
        mock_response.text = """
        <html>
            <head>
                <title>Test Page Title</title>
                <meta name="author" content="Jane Doe">
                <meta property="og:site_name" content="Example Site">
            </head>
            <body>
                <article>
                    <h1>Primary Heading</h1>
                    <p>This is the main readable text of the test article.</p>
                    <img src="/assets/img.jpg" alt="test image">
                    <a href="relative-page.html">Link text</a>
                    <script>console.log('strip me');</script>
                    <style>body { color: red; }</style>
                </article>
            </body>
        </html>
        """
        mock_get.return_value = mock_response
        
        # Scrape mock HTML
        result = extract_content('https://example.com/article')
        
        # Assert metadata
        self.assertEqual(result['title'], 'Test Page Title')
        self.assertEqual(result['author'], 'Jane Doe')
        self.assertEqual(result['site_name'], 'Example Site')
        
        # Verify script and style tags were decomposed
        self.assertNotIn('strip me', result['content'])
        self.assertNotIn('color: red', result['content'])
        
        # Verify relative URLs were converted to absolute paths
        self.assertIn('href="https://example.com/relative-page.html"', result['content'])
        self.assertIn('src="https://example.com/assets/img.jpg"', result['content'])

    @patch('requests.get')
    def test_generator_compilation(self, mock_get):
        """
        Test that chapters with images compile into a standard valid EPUB file.
        """
        # Mock image download binary data
        mock_image_response = MagicMock()
        mock_image_response.status_code = 200
        mock_image_response.headers = {'Content-Type': 'image/png'}
        mock_image_response.content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...'
        mock_get.return_value = mock_image_response
        
        metadata = {
            'title': 'Test Book Title',
            'author': 'Jane Test Author',
            'publisher': 'bokasafnari'
        }
        
        # Single chapter block containing a remote image
        chapters = [{
            'title': 'Chapter 1: The Scraper',
            'content': '<p>Here is an inline graphic:</p><img src="https://example.com/image.png" alt="Test Graph"/>'
        }]
        
        os.makedirs('tests', exist_ok=True)
        output_file = 'tests/test_output.epub'
        
        try:
            # Trigger EPUB packaging
            generate_epub(metadata, chapters, output_file)
            
            # Assert file exists and contains compiled bytes
            self.assertTrue(os.path.exists(output_file))
            self.assertGreater(os.path.getsize(output_file), 0)
        finally:
            # Clean up test output
            if os.path.exists(output_file):
                os.remove(output_file)
            if os.path.exists('tests') and not os.listdir('tests'):
                os.rmdir('tests')

if __name__ == '__main__':
    unittest.main()
