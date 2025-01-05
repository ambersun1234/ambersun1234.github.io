---
title: 從 0 認識 Blockchain - 一手掌握 Web3 資料，以 Uniswap 為例
date: 2025-01-06
categories: [blockchain]
description: 本篇文章將會介紹如何透過 The Graph 來存取區塊鏈資料，並以 Uniswap V3 Subgraph 為例
tags: [uniswap, the-graph, web3, alchemy, infura, indexer, curator, delegator, subgraph, assemblyscript, ethereum, typescript, graphql, aggregate]
math: true
---

# How to Retrieve Blockchain Data
區塊鏈上的所有資料都是公開透明的，你可以透過第三方服務如 [Alchemy](https://www.alchemy.com/)、[Infura](https://infura.io/) 來存取區塊鏈資料\
或者是，像我聽過有些公司是自行架設節點，然後修改裡面的程式碼做 cache 之類的\
以我自己來說，之前碰過類似的需求，我是使用 Alchemy 監聽特定某個 contract 的事件，然後再做後處理

對於更進階的資料需求，像是查詢區段資料等等的需求\
Alchemy 雖然有提供一些 API 但是它並沒有辦法滿足所有需求\
而且自行架設節點也不是一個太好的方案，問題在於，你需要
1. 自行維護硬體設備
2. 違反區塊鏈的去中心化精神
3. 查詢資料需要花時間同步

[The Graph](#the-graph) 提出了一個解決方案，讓開發者可以更方便的存取區塊鏈資料

# The Graph
具體來說它跟我做的事情很像，它直接把 `監聽特定 contract 的事件，然後做後處理` 這件事情做掉\
這樣你的應用程式就不需要自己去 handle 這些事情，你的 application 邏輯可以被簡化

The Graph 是一個分散式的協議，它提供了一個簡單且快速的方式來存取區塊鏈資料\
這些資料，並不是原始的區塊鏈資料(raw data)，而是經過處理過的資料(aggregated data)

> 注意到 The Graph 並不是 Blockchain，雖然它使用了很多區塊鏈技術，但它並不是一個區塊鏈

The Graph 旨在提供快速的資料查詢，比如說你需要 **日交易量**, **日交易互數** 這種聚合資料\
它會直接儲存這些 "已經計算過得資料"，也因此這樣的查詢速度會比較快

## Subgraph
監聽特定的事件，聚合相關的資料這件事情\
你需要清楚的定義在所謂的 `Subgraph` 中，這樣 The Graph 才能幫你處理這些事情\
因為你需要讓它知道，你要監聽哪些事件，然後要如何處理這些事件

當你把 Subgraph 定義完成並成功的部署到 The Graph 上之後，你就可以透過 GraphQL 查詢你所需要的資料了

> 你可以在 [Graph Explorer](https://thegraph.com/explorer?chain=arbitrum-one) 上找到各式各樣的 Subgraph

## Network Participants
![](https://thegraph.com/docs/_next/static/media/updated-tokenomics-image.269dfabf.png)
> ref: [Tokenomics of The Graph Network](https://thegraph.com/docs/en/resources/tokenomics/#the-roles-of-network-participants)

為了建構如此龐大的資料庫，The Graph 有幾個不同的角色，他們各司其職，共同維護整個網路\
[Indexer](#indexer) 負責產生資料供快速查詢\
為了能夠讓 Indexer 知道有哪些 Subgraph 急需被處理，[Curator](#curator) 會質押特定的 Subgraph 來告知 Indexer\
[Delegator](#delegator) 則是可以幫助 Indexer 進行質押，類似於一個投資者的角色，贊助該 Indexer 使其可以用這些金錢擴充算力並最終括容整個網路

### Indexer
你的資料會需要某個人幫你處理，這個人就是 `Indexer`\
Indexer 需要質押 100k 的 **GRT**(The Graph 的代幣)

Indexer 會根據 [Subgraph](#subgraph) 的定義，去監聽區塊鏈上特定的事件，然後把這些資料處理好\
儲存在 PostgreSQL 資料庫裡面，然後當 request 進來的時候，就可以直接從資料庫裡面查詢

那... 他要如何決定要處理哪些 Subgraph 呢？\
一個常見的參考點是，看這個 Subgraph 有多少人在使用，有多少人在查詢(看歷史查詢數量)\
當這個 [Subgraph](#subgraph) 被使用的越多，你越可以在上面分到一杯羹是吧\
或者是你可以看看這個 Subgraph 的質押量，質押量越高，代表需求越大，你就可以分到更多的獎勵

> 可參考 [Uniswap-V3/0xddaaed8b88ac0ccfdbfabdceba1c619391760f7f](https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV?view=Indexers&chain=arbitrum-one)

#### Proof of Indexing(POI)
跟傳統的區塊鏈很像，The Graph 也有一個類似的機制，叫做 Proof of Indexing(POI)\
基本上就是一個證明，證明該 block 是由該 Indexer 處理的

### Curator
基本上，因為每個人都可以自己定義 [Subgraph](#subgraph)\
你可以作為一個 Curator，質押一些 GRT 來告知 [Indexer](#indexer)，你想要這個 Subgraph 被處理\
通常，部署 Subgraph 的開發者就是第一個 Curator, 因為你會希望你的 Subgraph 被處理嘛

> 可參考 [Uniswap-V3/0xddaaed8b88ac0ccfdbfabdceba1c619391760f7f](https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV?view=Curators&chain=arbitrum-one)

### Delegator
當 [Indexer](#indexer) 或 [Curator](#curator) 基本上你必須要擁有一定的知識，甚至是硬體設備\
Delegator 這個角色你不需要這麼多的知識，你只需要質押一些 GRT 給 Indexer\
當然，投資給 Indexer 它也會回報給你

Indexer 會將賺到的收益，以一定的比例分給 Delegator(通常是 9-12%)\
這裡的收益指的是，Indexer 透過 query fee 賺到的錢

這裡的概念就跟股票很像了，如果股息發的越多越高，投資者就會比較願意投資這個 Indexer\
那 Indexer 賺到錢，也會回饋給 Delegator

# Uniswap V3 Subgraph
在 Graph Explorer 上面你可以找到很多各式各樣的 subgraph\
舉例來說，[Uniswap/v3-subgraph](https://github.com/Uniswap/v3-subgraph) 就是其中一個例子\
The Graph 上面所有的 [Subgraph](#subgraph) 都是公開且透明的，你可以找到你需要的 Subgraph 並查詢你所需要的資料

## Subgraph Components
[Subgraph](#subgraph) 需要包含至少以下部份
1. `schema.graphql` 定義了你的資料模型
2. `subgraph.yaml` 定義了你的 Subgraph 的基本資訊
3. `mappings` 資料處理的邏輯

### Data Store
aggregate 過的資料可以透過 GraphQL 查詢\
能夠查詢的資料，他的資料模型的定義是透過 `schema.graphql` 來定義的

在 [Assemblyscript Mapping](#assemblyscript-mapping-and-handlers) 裡面你會使用到這些資料模型\
把它儲存到資料庫等等的操作\
這個定義沒辦法直接被 Assemblyscript 使用，所以這部份是透過 codegen 來產生的

> 在 [package.json](https://github.com/Uniswap/v3-subgraph/blob/main/package.json#L12) 裡面可以看到 codegen 的指令

以下就是 GraphQL 的資料模型定義，可參考 [schema.graphql](https://github.com/Uniswap/v3-subgraph/blob/main/schema.graphql)
```ts
type Factory @entity {
  # factory address
  id: ID!

  # amount of pools created
  poolCount: BigInt!

  # amoutn of transactions all time
  txCount: BigInt!

  # total volume all time in derived USD
  totalVolumeUSD: BigDecimal!

  # total volume all time in derived ETH
  totalVolumeETH: BigDecimal!

  # total swap fees all time in USD
  totalFeesUSD: BigDecimal!

  # total swap fees all time in USD
  totalFeesETH: BigDecimal!

  # all volume even through less reliable USD values
  untrackedVolumeUSD: BigDecimal!

  # TVL derived in USD
  totalValueLockedUSD: BigDecimal!

  # TVL derived in ETH
  totalValueLockedETH: BigDecimal!

  # TVL derived in USD untracked
  totalValueLockedUSDUntracked: BigDecimal!

  # TVL derived in ETH untracked
  totalValueLockedETHUntracked: BigDecimal!

  # current owner of the factory
  owner: ID!
}
```

### Subgraph Definition
所有的 Subgraph 都需要一個 [subgraph.yaml](https://github.com/Uniswap/v3-subgraph/blob/main/subgraph.yaml) 來定義，像下面這樣

```yaml
specVersion: 0.0.4
description: Uniswap is a decentralized protocol for automated token exchange on Ethereum.
repository: https://github.com/Uniswap/uniswap-v3-subgraph
schema:
  file: ./schema.graphql
features:
  - nonFatalErrors
  - grafting
dataSources:
  - kind: ethereum/contract
    name: Factory
    network: sepolia
    source:
      address: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"
      abi: Factory
      startBlock: 3518270
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      file: ./src/mappings/factory.ts
      entities:
        - Pool
        - Token
      abis:
        - name: Factory
          file: ./abis/factory.json
        - name: ERC20
          file: ./abis/ERC20.json
        - name: ERC20SymbolBytes
          file: ./abis/ERC20SymbolBytes.json
        - name: ERC20NameBytes
          file: ./abis/ERC20NameBytes.json
        - name: Pool
          file: ./abis/pool.json
      eventHandlers:
        - event: PoolCreated(indexed address,indexed address,indexed uint24,int24,address)
          handler: handlePoolCreated
```

Subgraph 本身是從鏈上 aggregate 資料，所以你需要定義所謂的 `dataSources`\
像上述的例子，就是監聽 [sepolia/0x022](https://sepolia.etherscan.io/address/0x0227628f3f023bb0b980b67d528571c95c6dac1c#code) 的 contract\
然後這裡你可以設定說你要從哪時候開始處理資料(i.e. `startBlock` 以及 `endBlock`)

針對不同的事件，你可以定義不同的 [Handlers](#handlers)\
這邊只有監聽了 `PoolCreated(indexed address,indexed address,indexed uint24,int24,address)` 這個事件\
然後它會使用 [./src/mapping/factory.ts](https://github.com/Uniswap/v3-subgraph/blob/main/src/mappings/factory.ts#L14) 的 `handlePoolCreated` 來處理這個事件

注意到這邊你會需要定義若干個 ABI(Application Binary Interface)\
這是因為要讓 Subgraph 知道如何解析從鏈上取得的資料

### AssemblyScript Mapping and Handlers
在 [Subgraph Definition](#subgraph-definition) 你可以設定多種不同的 handler\
總共會有三種不同的 handler，他們被 trigger 的順序會是
1. `Event Handlers`
2. `Call Handlers`
3. `Block Handlers`

因為一個 block 裡面包含不同的 transaction, 所以 Block Handlers 會是最後才被執行的\
而 Event Handlers 則是在 Call Handlers 之前被執行\
至於相同種類但不同 handler 則會依照在 `subgraph.yaml` 裡面的定義順序來執行

<hr>

Handler 的實作就是看到底要如何聚合這些資料\
你也可以直接把收到的數值直接塞進去資料庫裡面，也不是不行

對於 Handler 的實作，有兩點需要符合
1. function 名字必須與定義一致，並且要是 `export` 的
2. 所有 Handler 的參數必須接受一個 `event` 參數，它可以是任何形式的 event(比如說 `ethereum.Event`, `ethereum.Call`)

```ts
export function loadTransaction(event: ethereum.Event): Transaction {
  let transaction = Transaction.load(event.transaction.hash.toHexString())
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString())
  }
  transaction.blockNumber = event.block.number
  transaction.timestamp = event.block.timestamp
  transaction.gasUsed = BigInt.zero() //needs to be moved to transaction receipt
  transaction.gasPrice = event.transaction.gasPrice
  transaction.save()
  return transaction as Transaction
}
```

以上是 Uniswap 裡面的一個 transaction helper function(定義於 [src/utils/index.ts](https://github.com/Uniswap/v3-subgraph/blob/main/src/utils/index.ts#L101C1-L112C2))\
你可以看到它其實就是把 event 裡面的資料塞進去資料庫裡面\
注意到這裡的參數是 `ethereum.Event`，這是因為 caller 傳進來的有可能是 child class\
這裡為了能夠兼容不同的 event，所以直接使用 parent class

而以上實作，就是一個簡單的 Assemblyscript Mapping\
啥？ 它不是 TypeScript 嗎？\
Assemblyscript 是 TypeScript 的子集，但是它是被編譯成 WebAssembly 的\
編成 WASM 的好處是執行速度可以快到飛起，同時它也繼承了相同 TypeScript 的語法\
所以在 subgraph.yaml 裡面你會發現他是定義成 `wasm/assemblyscript` 這個東西

# References
+ [他們說這是Web3的Google？](https://medium.com/@gregshen0925/the-graph-%E7%B0%A1%E4%BB%8B-c80dcb3143d9)
+ [uniswap/v3-subgraph](https://github.com/Uniswap/v3-subgraph)
+ [The Graph](https://thegraph.com/)
+ [Tokenomics of The Graph Network](https://thegraph.com/docs/en/resources/tokenomics)
+ [Writing AssemblyScript Mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/assemblyscript-mappings/)
