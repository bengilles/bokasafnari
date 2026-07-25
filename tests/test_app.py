import unittest
from unittest.mock import patch, MagicMock
import os
import shutil
from src.extractor import extract_content
from src.generator import generate_epub

class TestBokasafnari(unittest.TestCase):
    
    @patch('cloudscraper.create_scraper')
    def test_extractor_success(self, mock_create_scraper):
        """
        Verify that HTML content is cleanly scraped, layout clutter
        (scripts, style blocks) is stripped, and relative assets are absolute-resolved.
        """
        mock_scraper = MagicMock()
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
        mock_scraper.get.return_value = mock_response
        mock_create_scraper.return_value = mock_scraper
        
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

    def test_api_session_save_and_open(self):
        """
        Verify that Api.save_session writes session JSON data to file
        and Api.open_session correctly parses and returns valid session state.
        """
        from app import Api
        api = Api()
        mock_window = MagicMock()
        api.set_window(mock_window)

        os.makedirs('tests', exist_ok=True)
        session_file = 'tests/test_session.bokasafnari'

        # Set up mock file dialog returns
        mock_window.create_file_dialog.side_effect = [
            [session_file],  # save dialog return
            [session_file]   # open dialog return
        ]

        session_data = {
            'version': 1,
            'metadata': {
                'title': 'Test Saved Session',
                'author': 'Test Author',
                'publisher': 'Test Pub'
            },
            'chapters': [
                {'title': 'Ch 1', 'content': '<p>Scraped content 1</p>'},
                {'title': 'Ch 2', 'content': '<p>Scraped content 2</p>'}
            ],
            'selectedChapterIndex': 1,
            'fontSize': 'lg'
        }

        try:
            # 1. Test save_session
            save_result = api.save_session(session_data)
            self.assertTrue(save_result['success'])
            self.assertEqual(save_result['filename'], 'test_session.bokasafnari')
            self.assertTrue(os.path.exists(session_file))

            # 2. Test open_session
            open_result = api.open_session()
            self.assertTrue(open_result['success'])
            self.assertEqual(open_result['data']['metadata']['title'], 'Test Saved Session')
            self.assertEqual(len(open_result['data']['chapters']), 2)
            self.assertEqual(open_result['data']['selectedChapterIndex'], 1)
        finally:
            if os.path.exists(session_file):
                os.remove(session_file)

if __name__ == '__main__':
    unittest.main()
