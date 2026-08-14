const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

const CODIGOS_TEMPO = new Map([
    [0, ['Céu limpo', 'fa-sun']],
    [1, ['Principalmente limpo', 'fa-sun']],
    [2, ['Parcialmente nublado', 'fa-cloud-sun']],
    [3, ['Nublado', 'fa-cloud']],
    [45, ['Nevoeiro', 'fa-smog']],
    [48, ['Nevoeiro gelado', 'fa-smog']],
    [51, ['Chuvisco ligeiro', 'fa-cloud-rain']],
    [53, ['Chuvisco moderado', 'fa-cloud-rain']],
    [55, ['Chuvisco intenso', 'fa-cloud-showers-heavy']],
    [61, ['Chuva ligeira', 'fa-cloud-rain']],
    [63, ['Chuva moderada', 'fa-cloud-rain']],
    [65, ['Chuva intensa', 'fa-cloud-showers-heavy']],
    [71, ['Neve ligeira', 'fa-snowflake']],
    [73, ['Neve moderada', 'fa-snowflake']],
    [75, ['Neve intensa', 'fa-snowflake']],
    [80, ['Aguaceiros ligeiros', 'fa-cloud-showers-heavy']],
    [81, ['Aguaceiros moderados', 'fa-cloud-showers-heavy']],
    [82, ['Aguaceiros intensos', 'fa-cloud-showers-heavy']],
    [95, ['Trovoada', 'fa-cloud-bolt']],
    [96, ['Trovoada com granizo ligeiro', 'fa-cloud-bolt']],
    [99, ['Trovoada com granizo intenso', 'fa-cloud-bolt']]
]);

export function normalizarOpcoesTempo(valor = {}) {
    valor = valor || {};
    return {
        temperatura: valor.temperatura !== false,
        condicao: valor.condicao === true,
        maxima: valor.maxima === true,
        minima: valor.minima === true,
        vento: valor.vento === true,
        sensacao: valor.sensacao === true,
        humidade: valor.humidade === true,
        chuva: valor.chuva === true
    };
}

export function obterDiaAtual() {
    const partes = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

export function normalizarLocalizacaoTempo(valor = {}) {
    valor = valor || {};
    const latitude = Number(valor.latitude);
    const longitude = Number(valor.longitude);
    return {
        cidade: String(valor.cidade || '').trim(),
        regiao: String(valor.regiao || '').trim(),
        pais: String(valor.pais || '').trim(),
        codigoPais: String(valor.codigoPais || '').trim().toUpperCase(),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        timezone: String(valor.timezone || '').trim()
    };
}

export function descreverCodigoTempo(codigo) {
    return CODIGOS_TEMPO.get(Number(codigo)) || ['Condição desconhecida', 'fa-cloud'];
}

export function obterIconeTempo(codigo) {
    return descreverCodigoTempo(codigo)[1];
}

function validarLocalizacao(localizacao) {
    return localizacao?.cidade
        && Number.isFinite(localizacao.latitude)
        && Number.isFinite(localizacao.longitude);
}

export async function pesquisarCidadesTempo(termo) {
    const pesquisa = String(termo || '').trim();
    if (pesquisa.length < 2) return [];

    const parametros = new URLSearchParams({
        name: pesquisa,
        count: '8',
        language: 'pt',
        format: 'json'
    });
    const resposta = await fetch(`${GEOCODING_API_URL}?${parametros}`);
    if (!resposta.ok) throw new Error('Não foi possível procurar essa cidade.');

    const dados = await resposta.json();
    return (Array.isArray(dados.results) ? dados.results : []).map(resultado => normalizarLocalizacaoTempo({
        cidade: resultado.name,
        regiao: resultado.admin1,
        pais: resultado.country,
        codigoPais: resultado.country_code,
        latitude: resultado.latitude,
        longitude: resultado.longitude,
        timezone: resultado.timezone
    }));
}

export async function carregarTempo(localizacao) {
    const cidade = normalizarLocalizacaoTempo(localizacao);
    if (!validarLocalizacao(cidade)) throw new Error('Escolhe primeiro uma cidade.');

    const parametros = new URLSearchParams({
        latitude: String(cidade.latitude),
        longitude: String(cidade.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        forecast_days: '1',
        timezone: 'auto',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh'
    });
    const resposta = await fetch(`${WEATHER_API_URL}?${parametros}`);
    if (!resposta.ok) throw new Error('Não foi possível atualizar o tempo.');

    const dados = await resposta.json();
    const atual = dados.current || {};
    const diario = dados.daily || {};
    const codigo = Number(atual.weather_code ?? diario.weather_code?.[0]);

    return {
        cidade: cidade.cidade,
        regiao: cidade.regiao,
        pais: cidade.pais,
        codigoPais: cidade.codigoPais,
        timezone: dados.timezone || cidade.timezone,
        temperatura: Number(atual.temperature_2m),
        sensacao: Number(atual.apparent_temperature),
        humidade: Number(atual.relative_humidity_2m),
        vento: Number(atual.wind_speed_10m),
        precipitacao: Number(atual.precipitation),
        codigo,
        descricao: descreverCodigoTempo(codigo)[0],
        data: diario.time?.[0] || obterDiaAtual(),
        maxima: Number(diario.temperature_2m_max?.[0]),
        minima: Number(diario.temperature_2m_min?.[0]),
        probabilidadeChuva: Number(diario.precipitation_probability_max?.[0]),
        atualizadoEm: new Date().toISOString()
    };
}

export function abrirConfiguradorTempo(caixa) {
    return new Promise(resolve => {
        const overlay = document.getElementById('popup-tempo-overlay');
        const cidade = document.getElementById('tempo-cidade');
        const pesquisar = document.getElementById('btn-pesquisar-tempo');
        const resultados = document.getElementById('tempo-resultados');
        const erro = document.getElementById('tempo-config-erro');
        const confirmar = document.getElementById('btn-confirmar-tempo');
        const cancelar = document.getElementById('btn-cancelar-tempo');
        const opcoes = {
            temperatura: document.getElementById('tempo-opcao-temperatura'),
            condicao: document.getElementById('tempo-opcao-condicao'),
            maxima: document.getElementById('tempo-opcao-maxima'),
            minima: document.getElementById('tempo-opcao-minima'),
            vento: document.getElementById('tempo-opcao-vento'),
            sensacao: document.getElementById('tempo-opcao-sensacao'),
            humidade: document.getElementById('tempo-opcao-humidade'),
            chuva: document.getElementById('tempo-opcao-chuva')
        };
        if (!overlay || !cidade || !pesquisar || !resultados || !erro || !confirmar || !cancelar) {
            resolve(null);
            return;
        }

        const atual = normalizarLocalizacaoTempo(caixa.tempoLocalizacao);
        const opcoesAtuais = normalizarOpcoesTempo(caixa.tempoOpcoes);
        let selecionada = atual.cidade ? atual : null;
        cidade.value = atual.cidade;
        Object.entries(opcoes).forEach(([chave, elemento]) => {
            if (elemento) elemento.checked = opcoesAtuais[chave];
        });
        resultados.replaceChildren();
        erro.hidden = true;
        overlay.classList.add('active');

        const fechar = valor => {
            overlay.classList.remove('active');
            pesquisar.onclick = null;
            cidade.onkeydown = null;
            cidade.oninput = null;
            confirmar.onclick = null;
            cancelar.onclick = null;
            resolve(valor);
        };

        cidade.oninput = () => {
            if (cidade.value.trim() !== atual.cidade) selecionada = null;
        };

        const mostrarResultados = cidades => {
            resultados.replaceChildren();
            if (!cidades.length) {
                erro.textContent = 'Não foram encontradas cidades com esse nome.';
                erro.hidden = false;
                return;
            }
            cidades.forEach(opcao => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'tempo-cidade-opcao';
                botao.textContent = [opcao.cidade, opcao.regiao, opcao.pais].filter(Boolean).join(' · ');
                botao.onclick = () => {
                    selecionada = opcao;
                    cidade.value = opcao.cidade;
                    resultados.replaceChildren();
                    erro.hidden = true;
                };
                resultados.appendChild(botao);
            });
        };

        const executarPesquisa = async () => {
            pesquisar.disabled = true;
            erro.hidden = true;
            try {
                mostrarResultados(await pesquisarCidadesTempo(cidade.value));
            } catch (erroPesquisa) {
                erro.textContent = erroPesquisa.message;
                erro.hidden = false;
            } finally {
                pesquisar.disabled = false;
            }
        };

        pesquisar.onclick = executarPesquisa;
        cidade.onkeydown = evento => {
            if (evento.key === 'Enter') executarPesquisa();
        };
        confirmar.onclick = () => {
            if (!selecionada) {
                erro.textContent = 'Procura e escolhe uma cidade da lista.';
                erro.hidden = false;
                return;
            }
            fechar({
                localizacao: selecionada,
                opcoes: normalizarOpcoesTempo(Object.fromEntries(
                    Object.entries(opcoes).map(([chave, elemento]) => [chave, Boolean(elemento?.checked)])
                ))
            });
        };
        cancelar.onclick = () => fechar(null);
    });
}
