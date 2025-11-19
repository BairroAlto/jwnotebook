from flask import Flask, request, jsonify
from flask_cors import CORS # Para permitir que o navegador fale com este servidor
import requests
from bs4 import BeautifulSoup
import urllib.parse
import logging

# Configuração básica para ver os logs no terminal
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app) # Habilita o CORS para todas as rotas

def scrape_wol_verse(scripture_reference: str) -> str:
    """
    Pesquisa por uma referência bíblica no wol.jw.org e extrai o texto do versículo.
    """
    app.logger.info(f"A iniciar pesquisa para: '{scripture_reference}'")
    try:
        # 1. Construir a URL de forma segura
        query = urllib.parse.quote_plus(scripture_reference)
        url = f"https://wol.jw.org/pt/wol/l/r5/lp-t?q={query}"
        
        # 2. Fazer o pedido HTTP, simulando um navegador
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # 3. Analisar o HTML da página
        soup = BeautifulSoup(response.text, 'html.parser')

        # 4. Encontrar o texto do versículo
        # A estrutura do site WOL usa <div class="pGroup"> para o resultado principal
        verse_container = soup.find('div', class_='pGroup')
        if verse_container:
            verse_paragraph = verse_container.find('p')
            if verse_paragraph:
                # 5. Extrair e limpar o texto
                verse_text = verse_paragraph.get_text(strip=True)
                
                # Lógica de limpeza melhorada para remover o número e o '+'
                # Ex: "8 Vieram... rei.+" -> "Vieram... rei."
                if verse_text and verse_text[0].isdigit():
                    cleaned_text = verse_text.split(' ', 1)[-1].replace('+', '').strip()
                else:
                    cleaned_text = verse_text.replace('+', '').strip()
                
                app.logger.info(f"Texto encontrado e limpo: '{cleaned_text}'")
                return cleaned_text
        
        app.logger.warning("Não foi possível encontrar o container do versículo na página.")
        return ""

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Erro de rede ao aceder à URL: {e}")
        return ""
    except Exception as e:
        app.logger.error(f"Ocorreu um erro inesperado durante o scraping: {e}")
        return ""

# Esta é a "porta de entrada" do nosso servidor.
# O navegador vai chamar este endereço: http://127.0.0.1:5000/get-verse?ref=Daniel+5:8
@app.route('/get-verse', methods=['GET'])
def get_verse():
    # Pega na referência que o navegador enviou (ex: "Daniel 5:8")
    scripture_ref = request.args.get('ref')
    
    if not scripture_ref:
        return jsonify({"error": "A referência do texto ('ref') é obrigatória."}), 400
        
    # Chama a nossa função especialista
    verse_text = scrape_wol_verse(scripture_ref)
    
    if verse_text:
        return jsonify({"text": verse_text})
    else:
        return jsonify({"error": f"Não foi possível encontrar o texto para '{scripture_ref}'."}), 404

# --- Instruções para correr o servidor ---
if __name__ == '__main__':
    # O servidor vai correr no seu computador, no endereço http://127.0.0.1:5000
    app.run(debug=True, port=5000)
