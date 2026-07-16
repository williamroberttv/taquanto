# TaQuanto

TaQuanto is a public price-consultation app for Alagoas that presents real NFC-e sale records from the official Economiza Alagoas/SEFAZ-AL data source in a simpler product-price discovery experience.

## Language

**TaQuanto**:
O produto TaQuanto para consulta publica de precos de produtos em Alagoas, composto por este frontend e por uma API separada que integra com o Economiza Alagoas/SEFAZ-AL.
_Avoid_: substituto da SEFAZ, scraper do Economiza Alagoas


**Frontend TaQuanto**:
Este repositorio: a aplicacao Angular que renderiza paginas publicas com SSR e paginas autenticadas como SPA quando o login estiver pronto. Nao chama a API da SEFAZ diretamente.
_Avoid_: backend, proxy SEFAZ, token SEFAZ no browser

**API TaQuanto**:
A API separada responsavel por integrar com o Economiza Alagoas/SEFAZ-AL, proteger credenciais e expor dados normalizados para o frontend.
_Avoid_: frontend, chamada direta do Angular para SEFAZ

**Economiza Alagoas**:
A plataforma oficial da SEFAZ-AL que disponibiliza consulta web e API publica para informacoes de vendas reais registradas em NFC-e no estado de Alagoas.
_Avoid_: base propria, fornecedor privado de precos

**Registro de Venda NFC-e**:
Um registro publico de venda real emitido em NFC-e, com informacoes como descricao do produto, codigo de barras quando informado, valor, estabelecimento e data da venda.
_Avoid_: oferta, promocao, preco garantido, compra do usuario

**Detalhe de Registro de Venda NFC-e**:
A visualizacao detalhada de um Registro de Venda NFC-e selecionado na Consulta Publica, usando os dados do registro exibido e mantendo o foco na venda real, nao em um produto agregado criado pelo TaQuanto.
_Avoid_: pagina de produto agregado, ficha de oferta, detalhe de promocao

**Promocao**:
Um rotulo comercial de oferta ou desconto que o TaQuanto nao infere a partir de registros de venda NFC-e.
_Avoid_: preco baixo, menor preco, venda recente


**Consulta Publica**:
A experiencia sem login para pesquisar precos de produtos e consultar registros recentes de venda NFC-e.
_Avoid_: area autenticada, historico pessoal

**Area Autenticada**:
O espaco futuro para recursos pessoais como pesquisas salvas, historico, preferencias, alertas ou paginas do consumidor. Nao e requisito para a consulta publica de produto.
_Avoid_: requisito para pesquisar preco

**Consulta de Produto**:
A busca por descricao ou codigo de barras que retorna registros recentes de venda NFC-e para comparacao de preco.
_Avoid_: pesquisa generica, busca de oferta

**Categoria de Produto**:
Um candidato de categoria retornado pela API TaQuanto para afunilar uma Consulta de Produto antes de exibir Registros de Venda NFC-e.
_Avoid_: segmento GPC, SKU, filtro generico

**SKU de Origem**:
O identificador do produto fornecido pela fonte SEFAZ-AL quando existir; nao e criado pelo TaQuanto a partir da descricao.
_Avoid_: codigo de barras, GTIN, codigo interno inventado

**Localizacao Aproximada**:
A informacao geografica opcional usada para contextualizar onde uma venda foi registrada; quando coordenadas nao existirem, o TaQuanto pode exibir um mapa de referencia sem marcador, mas nao deve inventar pontos no mapa.
_Avoid_: rastreamento, localizacao exata do comprador
