#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Set this environment variable to prevent the automatic browser download
export PLAYWRIGHT_BROWSERS_PATH=0

# 2. Install Python dependencies from requirements.txt
pip install -r requirements.txt

# 3. Manually run the correct installation command for browsers and OS dependencies
playwright install --with-deps
