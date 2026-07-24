import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const CAMPO_LIGACAO_BAIRRO = 'ligaçãoBairro';

function listaSegura(valor) {
    return Array.isArray(valor) ? valor : [];
}

function mesmaLigacao(a, b) {
    return Boolean(a && b) && String(a.bairroId || '') === String(b.bairroId || '') &&
        String(a.casaId || '') === String(b.casaId || '') &&
        String(a.bairroNotaId || '') === String(b.bairroNotaId || '');
}

function semDuplicados(lista) {
    const vistos = new Set();
    return listaSegura(lista).filter(item => {
        const chave = `${item?.bairroNotaId || ''}|${item?.bairroId || ''}|${item?.casaId || ''}|${item?.lado || ''}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
    });
}

function colecaoLocal(nome = 'Local') {
    return String(nome).toLowerCase() === 'share' ? 'Share' : 'Local';
}

async function obterDocumento(db, colecao, id) {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, colecaoLocal(colecao), id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function atualizarNotaComCaixa(db, notaId, caixaId, alterar, colecao = 'Local') {
    const nota = await obterDocumento(db, colecao, notaId);
    if (!nota) return false;
    const caixas = listaSegura(nota.caixas).map(caixa => ({ ...caixa }));
    const index = caixas.findIndex(caixa => caixa.id === caixaId);
    if (index < 0) return false;
    alterar(caixas[index], caixas);
    await updateDoc(doc(db, colecaoLocal(colecao), notaId), { caixas });
    return true;
}

async function acrescentarLigacaoNoAlvo(db, alvo, ligacao) {
    if (!alvo?.id) return false;
    if (alvo.tipo === 'caixa') {
        return atualizarNotaComCaixa(db, alvo.notaId, alvo.id, caixa => {
            caixa[CAMPO_LIGACAO_BAIRRO] = semDuplicados([
                ...listaSegura(caixa[CAMPO_LIGACAO_BAIRRO]), ligacao
            ]);
        });
    }

    const documento = await obterDocumento(db, 'Local', alvo.id);
    if (!documento) return false;
    const ligacoes = semDuplicados([...listaSegura(documento[CAMPO_LIGACAO_BAIRRO]), ligacao]);
    await updateDoc(doc(db, 'Local', alvo.id), { [CAMPO_LIGACAO_BAIRRO]: ligacoes });
    return true;
}

async function removerLigacaoDoAlvo(db, ligacao) {
    if (!ligacao?.targetId) return false;
    const alvo = {
        id: ligacao.targetId,
        tipo: ligacao.targetTipo,
        notaId: ligacao.targetNotaId
    };

    if (alvo.tipo === 'caixa') {
        return atualizarNotaComCaixa(db, alvo.notaId, alvo.id, caixa => {
            caixa[CAMPO_LIGACAO_BAIRRO] = listaSegura(caixa[CAMPO_LIGACAO_BAIRRO])
                .filter(item => !mesmaLigacao(item, ligacao));
        });
    }

    const documento = await obterDocumento(db, 'Local', alvo.id);
    if (!documento) return false;
    const ligacoes = listaSegura(documento[CAMPO_LIGACAO_BAIRRO]).filter(item => !mesmaLigacao(item, ligacao));
    await updateDoc(doc(db, 'Local', alvo.id), { [CAMPO_LIGACAO_BAIRRO]: ligacoes });
    return true;
}

function criarLigacaoCasa({ bairro, pai, filho, notaId, alvo, titulo }) {
    return {
        id: alvo.id,
        tipo: alvo.tipo,
        nome: titulo || 'Sem título',
        notaId: alvo.notaId || null,
        bairroId: bairro.id,
        casaId: filho.id,
        bairroNotaId: notaId,
        targetId: alvo.id,
        targetTipo: alvo.tipo,
        targetNotaId: alvo.notaId || null,
        paiId: pai?.id || null,
        paiNome: pai?.nome || '',
        lado: 'bairro'
    };
}

function criarLigacaoAlvo({ bairro, pai, filho, notaId, alvo, titulo }) {
    return {
        id: bairro.id,
        tipo: 'bairro',
        nome: `${pai?.nome || 'Pai'} / ${titulo || filho.nome || 'Casa'}`,
        bairroId: bairro.id,
        casaId: filho.id,
        bairroNotaId: notaId,
        targetId: alvo.id,
        targetTipo: alvo.tipo,
        targetNotaId: alvo.notaId || null,
        paiId: pai?.id || null,
        paiNome: pai?.nome || '',
        lado: 'alvo'
    };
}

export async function anexarLigacaoBairro({ db, notaId, bairro, pai, filho, alvo, titulo, onAtualizar }) {
    if (!db || !notaId || !bairro?.id || !pai?.id || !filho?.id || !alvo?.id) return false;

    const anterior = listaSegura(filho[CAMPO_LIGACAO_BAIRRO])[0];
    if (anterior) await removerLigacaoDoAlvo(db, anterior);

    const ligacaoCasa = criarLigacaoCasa({ bairro, pai, filho, notaId, alvo, titulo });
    const ligacaoAlvo = criarLigacaoAlvo({ bairro, pai, filho, notaId, alvo, titulo });

    filho[CAMPO_LIGACAO_BAIRRO] = [ligacaoCasa];
    await atualizarNotaComCaixa(db, notaId, bairro.id, caixa => {
        const paiAtual = listaSegura(caixa.pastapai).find(item => item.id === pai.id);
        const filhoAtual = paiAtual && listaSegura(paiAtual.pastafilho).find(item => item.id === filho.id);
        if (filhoAtual) filhoAtual[CAMPO_LIGACAO_BAIRRO] = [ligacaoCasa];
    });
    await acrescentarLigacaoNoAlvo(db, alvo, ligacaoAlvo);
    onAtualizar?.();
    return ligacaoCasa;
}

export async function removerLigacaoBairroDaCasa({ db, notaId, bairro, pai, filho, ligacao, onAtualizar }) {
    const alvo = ligacao || listaSegura(filho?.[CAMPO_LIGACAO_BAIRRO])[0];
    if (!db || !notaId || !bairro?.id || !pai?.id || !filho?.id || !alvo) return false;

    await removerLigacaoDoAlvo(db, alvo);
    filho[CAMPO_LIGACAO_BAIRRO] = [];
    await atualizarNotaComCaixa(db, notaId, bairro.id, caixa => {
        const paiAtual = listaSegura(caixa.pastapai).find(item => item.id === pai.id);
        const filhoAtual = paiAtual && listaSegura(paiAtual.pastafilho).find(item => item.id === filho.id);
        if (filhoAtual) filhoAtual[CAMPO_LIGACAO_BAIRRO] = [];
    });
    onAtualizar?.();
    return true;
}

export async function removerLigacaoBairroDoAlvo({ db, notaIdAlvo, caixaAlvo, ligacao, onAtualizar }) {
    if (!db || !ligacao) return false;

    if (caixaAlvo?.id && notaIdAlvo) {
        caixaAlvo[CAMPO_LIGACAO_BAIRRO] = listaSegura(caixaAlvo[CAMPO_LIGACAO_BAIRRO])
            .filter(item => !mesmaLigacao(item, ligacao));
        await atualizarNotaComCaixa(db, notaIdAlvo, caixaAlvo.id, caixa => {
            caixa[CAMPO_LIGACAO_BAIRRO] = listaSegura(caixa[CAMPO_LIGACAO_BAIRRO])
                .filter(item => !mesmaLigacao(item, ligacao));
        });
    }

    if (ligacao.bairroNotaId && ligacao.bairroId) {
        await atualizarNotaComCaixa(db, ligacao.bairroNotaId, ligacao.bairroId, caixa => {
            listaSegura(caixa.pastapai).forEach(pai => {
                listaSegura(pai.pastafilho).forEach(filho => {
                    filho[CAMPO_LIGACAO_BAIRRO] = listaSegura(filho[CAMPO_LIGACAO_BAIRRO])
                        .filter(item => !mesmaLigacao(item, ligacao));
                });
            });
        });
    }
    onAtualizar?.();
    return true;
}

export async function irParaLigacaoBairro(ligacao) {
    if (!ligacao?.targetId) return;
    const contexto = window.notaAtualContext;
    if (!contexto?.db || !contexto?.auth) return;

    if (ligacao.targetTipo === 'caixa') {
        if (!ligacao.targetNotaId) return;
        if (contexto?.notaId === ligacao.targetNotaId) {
            document.getElementById(`bloco-${ligacao.targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const snap = await getDoc(doc(contexto.db, 'Local', ligacao.targetNotaId));
        if (snap.exists()) {
            const editor = await import('../editor.js');
            await editor.abrirNotaNoEditor(ligacao.targetNotaId, snap.data(), contexto.db, contexto.auth, ligacao.targetId);
            window.sincronizarBarraLateralComNota?.(ligacao.targetNotaId, { ...snap.data(), onde: 'local' }, contexto.auth);
        }
        return;
    }

    if (ligacao.targetTipo === 'nota') {
        const snap = await getDoc(doc(contexto.db, 'Local', ligacao.targetId));
        if (snap.exists()) {
            const editor = await import('../editor.js');
            await editor.abrirNotaNoEditor(ligacao.targetId, snap.data(), contexto.db, contexto.auth);
            window.sincronizarBarraLateralComNota?.(ligacao.targetId, { ...snap.data(), onde: 'local' }, contexto.auth);
        }
        return;
    }

    if (ligacao.targetTipo === 'pasta') {
        window.pastaAtual = ligacao.targetId;
        window.historicoPastas = [
            { id: "root", nome: "Local" },
            { id: ligacao.targetId, nome: ligacao.nome || 'Pasta' }
        ];
        const navPastaNome = document.getElementById('nav-pasta-nome');
        const navIconVoltar = document.getElementById('nav-icon-voltar');
        if (navPastaNome) navPastaNome.innerText = "Voltar a Local";
        if (navIconVoltar) navIconVoltar.style.display = "inline-block";
        window.carregarPastaLocalManual?.(ligacao.targetId);
    }
}

export function obterLigacoesBairro(valor) {
    return listaSegura(valor?.[CAMPO_LIGACAO_BAIRRO]);
}