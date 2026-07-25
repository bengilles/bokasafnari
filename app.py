import sys
import os
import webview
from src.extractor import extract_content
from src.generator import generate_epub

import json

def get_asset_path(relative_path):
    """
    Resolves resource paths dynamically.
    Works for standard local development runtimes and compiled PyInstaller binaries.
    """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def extract_url(self, url):
        """
        Scrapes content from URL and returns a clean reader-mode JSON dictionary.
        Called asynchronously from front-end Javascript.
        """
        if not url:
            return {'success': False, 'error': 'URL is empty'}
            
        try:
            data = extract_content(url)
            return {'success': True, 'data': data}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def compile_epub(self, metadata, chapters):
        """
        Prompts the native OS Save File Dialog to choose a path,
        then compiles the chapter and metadata lists into an EPUB file.
        """
        if not chapters:
            return {'success': False, 'error': 'Cannot compile book with 0 chapters'}
            
        if not self._window:
            return {'success': False, 'error': 'Native window context is missing'}

        dialog_save_type = getattr(webview.FileDialog, 'SAVE', webview.SAVE_DIALOG) if hasattr(webview, 'FileDialog') else webview.SAVE_DIALOG
        dialog_open_type = getattr(webview.FileDialog, 'OPEN', webview.OPEN_DIALOG) if hasattr(webview, 'FileDialog') else webview.OPEN_DIALOG

        try:
            # Open OS native Save File Dialog
            default_filename = f"{metadata.get('title', 'Compiled Book')}.epub"
            # Clean up filename to prevent OS file naming conflicts
            for char in ['\\', '/', ':', '*', '?', '"', '<', '>', '|']:
                default_filename = default_filename.replace(char, '')

            save_path = self._window.create_file_dialog(
                dialog_save_type,
                directory=os.path.expanduser('~'),
                save_filename=default_filename,
                file_types=('EPUB Book (*.epub)', 'All files (*.*)')
            )

            if not save_path:
                return {'success': False, 'error': 'Cancelled'}

            # If create_file_dialog returns a list/tuple, extract the first entry
            if isinstance(save_path, (list, tuple)):
                save_path = save_path[0]

            # Generate the EPUB file at the chosen path
            generate_epub(metadata, chapters, save_path)
            
            return {
                'success': True, 
                'path': save_path, 
                'filename': os.path.basename(save_path)
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_session(self, session_data):
        """
        Prompts native OS Save File Dialog to save editing session JSON to disk.
        """
        if not self._window:
            return {'success': False, 'error': 'Native window context is missing'}

        dialog_save_type = getattr(webview.FileDialog, 'SAVE', webview.SAVE_DIALOG) if hasattr(webview, 'FileDialog') else webview.SAVE_DIALOG

        try:
            metadata = session_data.get('metadata', {}) if isinstance(session_data, dict) else {}
            title = metadata.get('title', 'Session') or 'Session'
            default_filename = f"{title}.bokasafnari"
            for char in ['\\', '/', ':', '*', '?', '"', '<', '>', '|']:
                default_filename = default_filename.replace(char, '')

            save_path = self._window.create_file_dialog(
                dialog_save_type,
                directory=os.path.expanduser('~'),
                save_filename=default_filename,
                file_types=('bokasafnari Session (*.bokasafnari;*.json)', 'All files (*.*)')
            )

            if not save_path:
                return {'success': False, 'error': 'Cancelled'}

            if isinstance(save_path, (list, tuple)):
                save_path = save_path[0]

            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)

            return {
                'success': True,
                'path': save_path,
                'filename': os.path.basename(save_path)
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def open_session(self):
        """
        Prompts native OS Open File Dialog to load a session JSON file from disk.
        """
        if not self._window:
            return {'success': False, 'error': 'Native window context is missing'}

        dialog_open_type = getattr(webview.FileDialog, 'OPEN', webview.OPEN_DIALOG) if hasattr(webview, 'FileDialog') else webview.OPEN_DIALOG

        try:
            file_path = self._window.create_file_dialog(
                dialog_open_type,
                directory=os.path.expanduser('~'),
                file_types=('bokasafnari Session (*.bokasafnari;*.json)', 'All files (*.*)')
            )

            if not file_path:
                return {'success': False, 'error': 'Cancelled'}

            if isinstance(file_path, (list, tuple)):
                file_path = file_path[0]

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, dict) or 'metadata' not in data or 'chapters' not in data:
                return {'success': False, 'error': 'Invalid session file format'}

            return {
                'success': True,
                'data': data,
                'filename': os.path.basename(file_path)
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

def main():
    api = Api()
    
    # Resolve the absolute path of the index.html GUI page
    gui_path = get_asset_path(os.path.join('public', 'index.html'))
    
    # Initialize the native window
    window = webview.create_window(
        title='bokasafnari - Web Page to EPUB Converter',
        url=gui_path,
        js_api=api,
        width=1200,
        height=800,
        min_size=(800, 600),
        background_color='#0f0f15'
    )
    
    api.set_window(window)
    webview.start(debug=False)

if __name__ == '__main__':
    main()
