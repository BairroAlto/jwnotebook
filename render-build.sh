#!/usr/bin/env bash
# exit on error
set -o errexit

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies from requirements.txt
pip install -r requirements.txt

# Install Playwright's browser binaries AND the necessary
# operating system dependencies for them to run.
playwright install --with-deps
