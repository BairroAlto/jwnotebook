# Ficheiro: pesquisador_api.py - VERSÃO PLAYWRIGHT

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from playwright.sync_api import sync_playwright
import logging
import urllib.parse

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

# --- Função de Scraping com Playwright ---
def scrape_wol_verse_playwright(scripture_reference: str):
    app.logger.info(f"A iniciar pesquisa com Playwright para: '{scripture_reference}'")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            query = urllib.parse.quote_plus(scripture_reference)
            url = f"https://wol.jw.org/pt/wol/l/r5/lp-t?q={query}"
            app.logger.info(f"A navegar para: {url}")
            
            page.goto(url, wait_until='domcontentloaded')
            
            # Procura pelo container do versículo
            verse_container = page.locator('div.pGroup p').first
            
            if verse_container.is_visible():
                verse_text = verse_container.inner_text()
                if verse_text and verse_text[0].isdigit():
                    cleaned_text = verse_text.split(' ', 1)[-1].replace('+', '').strip()
                else:
                    cleaned_text = verse_text.replace('+', '').strip()
                
                app.logger.info(f"Texto encontrado e limpo: '{cleaned_text}'")
                browser.close()
                return cleaned_text
            else:
                app.logger.warning("Container do versículo não encontrado ou não visível.")
                browser.close()
                return ""
    except Exception as e:
        app.logger.error(f"Ocorreu um erro durante o scraping com Playwright: {e}")
        return ""

# --- Rotas (sem alterações) ---
@app.route('/')
def hello_world():
    return "<h1>Servidor JW Notebook (Playwright) no ar!</h1>"

@app.route('/get-verse', methods=['GET'])
def get_verse_route():
    scripture_ref = request.args.get('ref')
    if not scripture_ref:
        return jsonify({"error": "A referência do texto ('ref') é obrigatória."}), 400
    verse_text = scrape_wol_verse_playwright(scripture_ref)
    if verse_text:
        return jsonify({"text": verse_text})
    else:
        return jsonify({"error": f"Não foi possível encontrar o texto para '{scripture_ref}'."}), 404
        
if __name__ == '__main__':
    app.run(port=5000, debug=True)
