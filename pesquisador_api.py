# Ficheiro: pesquisador_api.py - VERSÃO FINAL (ESTRUTURA COMPROVADA + SCRAPING)

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import urllib.parse
import logging

# Configuração dos logs
logging.basicConfig(level=logging.INFO)

# 1. Cria a aplicação (sabemos que esta parte funciona)
app = Flask(__name__)

# 2. Aplica o CORS (sabemos que esta parte funciona)
CORS(app)

# --- Função de Scraping ---
def scrape_wol_verse(scripture_reference: str):
    app.logger.info(f"A iniciar pesquisa para: '{scripture_reference}'")
    try:
        query = urllib.parse.quote_plus(scripture_reference)
        url = f"https://wol.jw.org/pt/wol/l/r5/lp-t?q={query}"
        headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        verse_container = soup.find('div', class_='pGroup')
        if verse_container and verse_container.find('p'):
            verse_text = verse_container.find('p').get_text(strip=True)
            if verse_text and verse_text[0].isdigit():
                 cleaned_text = verse_text.split(' ', 1)[-1].replace('+', '').strip()
            else:
                 cleaned_text = verse_text.replace('+', '').strip()
            app.logger.info(f"Texto encontrado e limpo: '{cleaned_text}'")
            return cleaned_text
        app.logger.warning("Não foi possível encontrar o container do versículo na página.")
        return ""
    except Exception as e:
        app.logger.error(f"Ocorreu um erro durante o scraping: {e}")
        return ""

# --- Rotas (sabemos que esta estrutura funciona) ---

# Rota principal para verificar se o servidor está vivo
@app.route('/')
def hello_world():
    return "<h1>Servidor JW Notebook no ar!</h1><p>A API de pesquisa de versículos está operacional.</p>"

# Rota que a nossa aplicação vai chamar
@app.route('/get-verse', methods=['GET'])
def get_verse_route():
    scripture_ref = request.args.get('ref')
    if not scripture_ref:
        return jsonify({"error": "A referência do texto ('ref') é obrigatória."}), 400
    
    # Chama a função de scraping
    verse_text = scrape_wol_verse(scripture_ref)
    
    if verse_text:
        return jsonify({"text": verse_text})
    else:
        return jsonify({"error": f"Não foi possível encontrar o texto para '{scripture_ref}'."}), 404

# --- Bloco de Execução Local (não afeta a Render) ---
if __name__ == '__main__':
    app.run(port=5000, debug=True)
