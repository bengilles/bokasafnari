import os
import sys
import PyInstaller.__main__

def build():
    # PyInstaller data path separator varies by platform: ';' on Windows, ':' on macOS/Linux
    sep = ';' if sys.platform.startswith('win') else ':'
    
    # Define package arguments
    args = [
        'app.py',
        '--name=bokasafnari',
        '--noconfirm',
        '--windowed',  # Hide the terminal window on launch (GUI only)
        f'--add-data=public{sep}public',  # Include static frontend directory in build
        '--clean'
    ]
    
    print("Initiating standalone packaging via PyInstaller...")
    print(f"Executing with options: pyinstaller {' '.join(args)}\n")
    
    try:
        PyInstaller.__main__.run(args)
        print("\n=======================================================")
        print("Success! Standalone executable packaged.")
        print("You can find the output application directory in: ./dist/bokasafnari/")
        print("=======================================================")
    except Exception as e:
        print(f"\nPackaging failed with error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    build()
