# Linguagem de domínio do TaQuanto

Este documento mantém o vocabulário usado no produto, no código e na documentação. Os termos estão em português porque descrevem o domínio atendido pela interface. A linha _Evitar_ registra palavras que alteram o significado ou criam promessas que o produto não pode cumprir.

## Limites fundamentais

- O TaQuanto apresenta registros públicos de vendas emitidas em NFC-e em Alagoas.
- Este frontend consulta preços apenas pela API TaQuanto; credenciais e integração com a fonte oficial pertencem ao backend. Eventos anônimos de uso são enviados separadamente ao PostHog.
- Um registro histórico não é uma oferta, promoção ou garantia de preço atual.
- Coordenadas são opcionais e nunca devem ser inferidas quando a fonte não as fornece.
- A localização atual do visitante só é solicitada após consentimento, é enviada à API para a consulta, não é salva no navegador e nunca é enviada ao PostHog.
- A consulta pública e os recursos locais não exigem autenticação.

## Termos

**TaQuanto**

Produto de consulta pública de preços em Alagoas, composto por este frontend e por uma API separada que integra com o Economiza Alagoas/SEFAZ-AL.

_Evitar_: substituto da SEFAZ, scraper do Economiza Alagoas, loja

**Frontend TaQuanto**

Este repositório: a aplicação Angular responsável pela interface pública, pelo estado do navegador, por eventos anônimos de uso e por futuras experiências autenticadas. Não chama a SEFAZ-AL diretamente.

_Evitar_: backend, proxy SEFAZ, token SEFAZ no navegador

**API TaQuanto**

Serviço separado que protege credenciais, integra com o Economiza Alagoas/SEFAZ-AL e expõe dados normalizados e paginados ao frontend.

_Evitar_: frontend, chamada direta do Angular para a SEFAZ

**Economiza Alagoas**

Plataforma oficial da SEFAZ-AL que disponibiliza consulta de informações de vendas reais registradas em NFC-e no estado.

_Evitar_: base própria do TaQuanto, fornecedor privado de preços

**Registro de Venda NFC-e**

Registro público de uma venda real emitida em NFC-e, com dados como descrição, GTIN quando informado, valor, unidade, estabelecimento, horário e localização. É a unidade principal exibida pelo produto.

_Evitar_: oferta, promoção, preço garantido, compra do visitante

**Detalhe de Registro de Venda NFC-e**

Visualização ampliada do registro selecionado na Consulta Pública. Mostra o mesmo retrato da venda, sem agregar produtos diferentes ou prometer disponibilidade atual.

_Evitar_: página de produto, ficha de oferta, detalhe de promoção

**Consulta Pública**

Experiência sem login para pesquisar e comparar Registros de Venda NFC-e recentes de produtos ou combustíveis.

_Evitar_: área autenticada, histórico pessoal

**Consulta de Produto**

Busca por uma descrição de 3 a 50 caracteres ou por um GTIN válido, combinada com período e município ou Busca por Proximidade.

_Evitar_: busca de oferta, pesquisa genérica sem filtros

**Consulta de Combustível**

Busca por uma das seis categorias fornecidas pela fonte, combinada com período e município ou Busca por Proximidade. Usa um endpoint próprio e não transforma a categoria em descrição de produto.

_Evitar_: busca textual de combustível, cotação da ANP, preço garantido no posto

**Categoria de Combustível**

Classificação aceita pela fonte: gasolina comum, gasolina aditivada, álcool, diesel comum, diesel aditivado/S10 ou GNV.

_Evitar_: categoria criada pelo frontend, nome comercial inventado

**GTIN**

Código numérico de identificação comercial informado pela fonte. A interface aceita os comprimentos válidos usados pelo produto: 8, 12, 13 ou 14 dígitos.

_Evitar_: SKU interno, código inventado, código sempre disponível

**SKU de Origem**

Identificador do produto fornecido pela fonte quando existir. O TaQuanto não o cria a partir da descrição.

_Evitar_: GTIN, código interno inventado

**Município da Consulta**

Município de Alagoas escolhido em um seletor pesquisável. A API recebe seu código IBGE. Maceió é a seleção inicial e o fallback para códigos ausentes ou não reconhecidos.

_Evitar_: localização do visitante, geolocalização automática

**Busca por Proximidade**

Alternativa opcional ao Município da Consulta. Após consentimento, usa as coordenadas fornecidas pelo navegador e um Raio da Consulta para pedir à API registros próximos. As coordenadas não entram na URL nem no armazenamento local.

_Evitar_: rastreamento, localização automática, endereço exato do visitante

**Raio da Consulta**

Distância de 5, 10 ou 15 km ao redor da localização atual, usada apenas na Busca por Proximidade e desenhada no mapa de resultados.

_Evitar_: limite municipal, distância garantida entre visitante e estabelecimento

**Período da Consulta**

Janela recente enviada à fonte: 1, 3, 7 ou 10 dias. Não representa uma garantia de que o registro ainda tenha o mesmo preço.

_Evitar_: validade da oferta, período promocional

**Pesquisa Recente**

Combinação de Consulta de Produto, período e município ou raio salva no navegador depois de uma busca. As dez combinações mais recentes podem ser repetidas no mesmo dispositivo; em buscas próximas, a localização é solicitada novamente.

_Evitar_: histórico da conta, pesquisa sincronizada, consulta salva no servidor

**Registro de Venda Favorito**

Cópia de um Registro de Venda NFC-e escolhida pelo visitante para consulta posterior no mesmo navegador. Preserva os dados exibidos quando foi favoritada e não exige conta.

_Evitar_: produto favorito, oferta salva, favorito da conta

**Lista de Favoritos**

Coleção local de Registros de Venda Favoritos, ordenada do mais recentemente salvo para o mais antigo.

_Evitar_: lista de produtos, ofertas favoritas, sincronização entre dispositivos

**Localização do Registro de Venda**

Contexto geográfico opcional da venda. Quando coordenadas válidas existem, a interface pode mostrar um marcador; sem elas, mostra apenas o texto disponível e um mapa de referência sem ponto inventado.

_Evitar_: localização exata do comprador, rastreamento, coordenada inferida

**Mapa de Resultados**

Mapa que reúne os Registros de Venda NFC-e da página atual que possuem coordenadas válidas. Na Busca por Proximidade, também mostra o Raio da Consulta. Informa quantos registros puderam ser posicionados e não inventa pontos ausentes.

_Evitar_: cobertura completa, mapa de ofertas, localização inferida

**Dados em Cache**

Resultado reutilizável fornecido pela API TaQuanto. Pode estar fresco (`HIT`) ou disponível enquanto a API prepara uma atualização (`STALE`). A interface informa quando exibe dados antigos.

_Evitar_: dado necessariamente atual, resultado fabricado pelo frontend

**Revalidação de Cache**

Novas tentativas feitas pela interface para obter dados frescos após `STALE` ou `MISS`, em intervalos de cinco segundos e por no máximo dois minutos. O backend continua responsável pela política e pelo conteúdo do cache.

_Evitar_: atualização contínua infinita, cache mantido pelo navegador

**Promoção**

Rótulo comercial de oferta ou desconto que o TaQuanto não infere a partir de Registros de Venda NFC-e.

_Evitar_: sinônimo de menor preço, venda recente ou diferença de valor

**Área Autenticada**

Espaço futuro para recursos pessoais que realmente exijam identidade, como sincronização, alertas ou preferências entre dispositivos. Não é requisito para consultar preços, repetir pesquisas recentes ou usar favoritos locais.

_Evitar_: requisito para a Consulta Pública

## Escopo atual

Estão implementados: landing page pública, Consulta de Produto, Consulta de Combustível, seleção pesquisável dos municípios de Alagoas, Busca por Proximidade, períodos recentes, paginação, Mapa de Resultados, detalhe do registro, pesquisas recentes de produtos, favoritos locais e temas claro/escuro.

Permanecem fora do escopo atual: autenticação, sincronização entre dispositivos, alertas, páginas de consumidor e histórico pessoal no servidor.
