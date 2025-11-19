# Ficheiro: pesquisador_api.py - VERSÃO DE TESTE "OLÁ, MUNDO!"

from flask import Flask, jsonify
from flask_cors import CORS

# 1. Cria a aplicação da forma mais simples possível
app = Flask(__name__)

# 2. Aplica as permissões de CORS
CORS(app)

# 3. Cria uma rota principal ("/") para testar se o servidor está vivo
@app.route('/')
def hello_world():
    return "<h1>Servidor no ar!</h1><p>A aplicação Flask está a funcionar na Render.</p>"

# 4. Cria a nossa rota problemática, mas em vez de pesquisar,
#    ela apenas devolve uma mensagem fixa.
@app.route('/get-verse', methods=['GET'])
def get_verse_route():
    # Não fazemos scraping, apenas devolvemos um JSON de sucesso.
    return jsonify({"text": "O endpoint /get-verse foi alcançado com sucesso!"})

# Este bloco só é usado para testes locais no seu PC
if __name__ == '__main__':
    app.run(port=5000, debug=True)
