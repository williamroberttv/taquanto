# Linguagem de domínio do TáQuanto

Este documento mantém o vocabulário usado no produto, no código e na documentação. Os termos estão em português porque descrevem o domínio atendido pela interface. A linha _Evitar_ registra palavras que alteram o significado ou criam promessas que o produto não pode cumprir.

## Limites fundamentais

- O TáQuanto apresenta registros públicos de vendas emitidas em NFC-e em Alagoas.
- Este frontend conversa apenas com a API TáQuanto; credenciais e integração com a fonte oficial pertencem ao backend.
- Um registro histórico não é uma oferta, promoção ou garantia de preço atual.
- Coordenadas são opcionais e nunca devem ser inferidas quando a fonte não as fornece.
- A consulta pública e os recursos locais não exigem autenticação.

## Termos

**TáQuanto**

Produto de consulta pública de preços em Alagoas, composto por este frontend e por uma API separada que integra com o Economiza Alagoas/SEFAZ-AL.

_Evitar_: substituto da SEFAZ, scraper do Economiza Alagoas, loja

**Frontend TáQuanto**

Este repositório: a aplicação Angular responsável pela interface pública, pelo estado do navegador e por futuras experiências autenticadas. Não chama a SEFAZ-AL diretamente.

_Evitar_: backend, proxy SEFAZ, token SEFAZ no navegador

**API TáQuanto**

Serviço separado que protege credenciais, integra com o Economiza Alagoas/SEFAZ-AL e expõe dados normalizados e paginados ao frontend.

_Evitar_: frontend, chamada direta do Angular para a SEFAZ

**Economiza Alagoas**

Plataforma oficial da SEFAZ-AL que disponibiliza consulta de informações de vendas reais registradas em NFC-e no estado.

_Evitar_: base própria do TáQuanto, fornecedor privado de preços

**Registro de Venda NFC-e**

Registro público de uma venda real emitida em NFC-e, com dados como descrição, GTIN quando informado, valor, unidade, estabelecimento, horário e localização. É a unidade principal exibida pelo produto.

_Evitar_: oferta, promoção, preço garantido, compra do visitante

**Detalhe de Registro de Venda NFC-e**

Visualização ampliada do registro selecionado na Consulta Pública. Mostra o mesmo retrato da venda, sem agregar produtos diferentes ou prometer disponibilidade atual.

_Evitar_: página de produto, ficha de oferta, detalhe de promoção

**Consulta Pública**

Experiência sem login para pesquisar e comparar Registros de Venda NFC-e recentes.

_Evitar_: área autenticada, histórico pessoal

**Consulta de Produto**

Busca por uma descrição de 3 a 50 caracteres ou por um GTIN válido, combinada com município e período.

_Evitar_: busca de oferta, pesquisa genérica sem filtros

**GTIN**

Código numérico de identificação comercial informado pela fonte. A interface aceita os comprimentos válidos usados pelo produto: 8, 12, 13 ou 14 dígitos.

_Evitar_: SKU interno, código inventado, código sempre disponível

**SKU de Origem**

Identificador do produto fornecido pela fonte quando existir. O TáQuanto não o cria a partir da descrição.

_Evitar_: GTIN, código interno inventado

**Município da Consulta**

Município de Alagoas selecionado pelo visitante por meio do mapa ou do campo de seleção. A API recebe seu código IBGE. Maceió é a seleção inicial e o fallback para códigos inválidos.

_Evitar_: localização do visitante, geolocalização automática

**Período da Consulta**

Janela recente enviada à fonte: 1, 3, 7 ou 10 dias. Não representa uma garantia de que o registro ainda tenha o mesmo preço.

_Evitar_: validade da oferta, período promocional

**Pesquisa Recente**

Combinação de consulta, município e período salva no navegador depois de uma busca. As dez combinações mais recentes podem ser repetidas no mesmo dispositivo.

_Evitar_: histórico da conta, pesquisa sincronizada, consulta salva no servidor

**Registro de Venda Favorito**

Cópia de um Registro de Venda NFC-e escolhida pelo visitante para consulta posterior no mesmo navegador. Preserva os dados exibidos quando foi favoritada e não exige conta.

_Evitar_: produto favorito, oferta salva, favorito da conta

**Lista de Favoritos**

Coleção local de Registros de Venda Favoritos, ordenada do mais recentemente salvo para o mais antigo.

_Evitar_: lista de produtos, ofertas favoritas, sincronização entre dispositivos

**Localização Aproximada**

Contexto geográfico opcional da venda. Quando coordenadas válidas existem, a interface pode mostrar um marcador; sem elas, mostra apenas o texto disponível e um mapa de referência sem ponto inventado.

_Evitar_: localização exata do comprador, rastreamento, coordenada inferida

**Dados em Cache**

Resultado reutilizável fornecido pela API TáQuanto. Pode estar fresco (`HIT`) ou disponível enquanto a API prepara uma atualização (`STALE`). A interface informa quando exibe dados antigos.

_Evitar_: dado necessariamente atual, resultado fabricado pelo frontend

**Revalidação de Cache**

Novas tentativas feitas pela interface para obter dados frescos após `STALE` ou `MISS`, em intervalos de cinco segundos e por no máximo dois minutos. O backend continua responsável pela política e pelo conteúdo do cache.

_Evitar_: atualização contínua infinita, cache mantido pelo navegador

**Promoção**

Rótulo comercial de oferta ou desconto que o TáQuanto não infere a partir de Registros de Venda NFC-e.

_Evitar_: sinônimo de menor preço, venda recente ou diferença de valor

**Área Autenticada**

Espaço futuro para recursos pessoais que realmente exijam identidade, como sincronização, alertas ou preferências entre dispositivos. Não é requisito para consultar preços, repetir pesquisas recentes ou usar favoritos locais.

_Evitar_: requisito para a Consulta Pública

## Escopo atual

Estão implementados: landing page pública, Consulta de Produto, seleção dos municípios de Alagoas, períodos recentes, paginação, detalhe do registro, mapas condicionais, pesquisas recentes, favoritos locais e temas claro/escuro.

Permanecem fora do escopo atual: autenticação, sincronização entre dispositivos, alertas, páginas de consumidor e histórico pessoal no servidor.
