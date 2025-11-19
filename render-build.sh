#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright's browser binaries and their OS dependencies
playwright install --with-deps
