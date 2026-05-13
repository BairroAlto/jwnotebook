#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Install Python dependencies while forcing the environment variable
#    directly onto the pip command. This is more reliable than using 'export'.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pip install -r requirements.txt

# 2. Now that the packages are installed, manually run the correct
#    command to install browsers and OS dependencies.
playwright install --with-deps
