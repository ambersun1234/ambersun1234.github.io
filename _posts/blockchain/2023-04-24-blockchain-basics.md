---
title: 從 0 認識 Blockchain - 區塊鏈基礎
date: 2023-04-24
description: 區塊鏈技術近年來備受矚目，本文將會介紹區塊鏈的基礎概念，Ethereum 的運作原理以及基本的智能合約觀念
categories: [blockchain]
tags: [blockchain, ethereum]
math: true
---

# Introduction to Blockchain
Blockchain 技術的概念，始於 2009 年 由 **Satoshi Nakamoto** 建立的 [Bitcoin](https://bitcoin.org/zh_TW/)\
根據 [Bitcoin 白皮書](https://bitcoin.org/bitcoin.pdf) 中所述
> A purely peer-to-peer version of electronic cash would allow online\
> payments to be sent directly from one party to another without going through a\
> financial institution

Bitcoin 擺脫了必須透過中心化交易中心進行交易的概念\
使用了 [P2P](https://en.wikipedia.org/wiki/Peer-to-peer) 的技術, 建構了 decentralized network 使得交易雙方可以直接交易\
透過建立不可改變的 transactions 可以取代傳統中心化第三方交易中心的功用 :arrow_right: 信任

> 白皮書: 某項重要政策或提議的正式發表書, 可參考 [White paper](https://en.wikipedia.org/wiki/White_paper)

# Introduction to Ethereum
但是 Bitcoin 終究只能做金錢相關的事情\
**Vitalik Buterin** 他想把 Blockchain 這個技術擴展到更高的層次，他想讓人們可以用 Blockchain 打造 decentralized application(不僅限於金錢)\
其中一個很重要的概念就是所謂的 [smart contract(decentralized agreement)](#smart-contract)\
於是他在 2015 年發表了 [Ethereum](https://ethereum.org/en/what-is-ethereum/) 這個 project\
其白皮書可以在這裡找到 [Ethereum Whitepaper](https://ethereum.org/en/whitepaper/)

說到底 Ethereum Blockchain 就是一個大的 Excel 表格，紀錄了盤古開天以來所有的 transaction 紀錄以及 data

# Smart Contract
根據 [Ethereum Whitepapaer](https://ethereum.org/en/whitepaper/#ethereum)

> The intent of Ethereum is to create an alternative protocol for building decentralized applications, \
> providing a different set of tradeoffs that we believe will be very useful for a large class of \
> decentralized applications, with particular emphasis on situations where rapid development time, \
> security for small and rarely used applications, \
> and the ability of different applications to very efficiently interact, are important. 

為了打造去中心化的服務，Ethereum 創造了一門語言([solidity](https://docs.soliditylang.org/en/v0.8.19/))用以實作 smart contracts\
而智能合約是由一系列指令組成的程式，運行在 Ethereum Blockchain 之上

智能合約總結來說只幹三件事
1. 定義規則
2. 驗證規則
3. 自我執行規則

smart contracts 本質上就是 code, 一旦合約成功部屬至鏈上，就 **幾乎沒辦法修改**\
基於這樣的特性，合約變得有保障，且因為所有鏈上的資料都是公開透明的，所有的狀態更新都受到 network 的監督

> 八卦是 smart contract 並不聰明

# Transaction
對 blockchain 造成 **任何狀態更新**, 都會建立一個新的 transaction\
狀態更新包括
+ 上傳新合約
+ 更改合約(smart contract 實作上可以用成 configurable, 亦即你可以後期調整某些參數)
+ 更新合約儲存的資料

而每一筆 transaction 你都必須要支付費用\
讓 network 願意幫你更新區塊鏈狀態(i.e. 給錢做事 使用者付費)

transaction 會紀錄
+ 誰要更改狀態
+ 更改了誰的狀態
+ 更改的數值

> 有關 transaction 的介紹，可以參考 [從 0 認識 Blockchain - Transaction 以及你該知道的一切 \| Shawn Hsu](../../blockchain/blockchain-transaction)

# Anonymous Identity
鏈上的資料完全透明！？ 那我的個資怎麼辦？

為了與 Blockchain 互動，你必須要創立一個錢包帳號\
不同的是，這裡用的 account 是完全匿名的\
也就是說 即使 blockchain 都是公開透明的，其他人也無從得知帳號主人的真實身份

> 可參考 [從 0 認識 Blockchain - 錢包基礎原理 \| Shawn Hsu](../../blockchain/blockchain-wallet)

其中用到的，是非對稱式加密系統\
利用公鑰 私鑰進行所有操作，既能完全匿名，也能夠驗證你的身份(透過 [數位簽章 Digital Signature](https://en.wikipedia.org/wiki/Digital_signature))

# Cons of Centralized Service
中心化的伺服器缺點也滿明顯的 不透明

所有資料的傳輸的過程中，僅有 server client 參與\
我們很難判斷說資料到底有沒有被更改過\
即使現今擁有加密、驗證等等手段，還是沒辦法 100% 保證真實性(萬一 server 惡意竄改資料呢？)

# Decentralized? How?
去中心化的作法是，擁有多台電腦執行 **相同的共識機制，相同的程式, 擁有相同的資料備份**\
當有一台電腦想要搞事的時候，會因為算出來的結果跟別人不一樣，而遭淘汰\
可以把他想像成 **多數決**\
因為 network 的思考方式(共識機制)都一定一模一樣，如果有某個人的結果不同，那必定表示他在搞事

> 有關共識機制，可參考 [資料庫 - 初探分散式資料庫 \| Shawn Hsu](../../database/database-distributed-database#consensus)

## Chain Selection Mechanism
前面提到 blockchain 目前是採多數決的方式決定的\
多數決顧名思義，必須要贊成或否決某項決議，但先決條件是，某個人要先提出某個決議才行\
blockchain 要怎麼做呢？

首先，在眾多 blockchain 當中，選出 `最多驗證者的鏈` 當成 main chain\
這時候！ 其他的 blockchain 會選擇 `跟隨 main chain 的結果`\
接下來就可以開始進行多數決了\
其餘的鏈，會一一驗算，計算 transaction 執行是否正確(e.g. from, to, function)選擇我要贊成或否決\
遭到否決的話，將會找尋 `第二多驗證者的鏈當成 main chain` 並且處罰該節點\
無限循環，無限驗證

> 經過 [The merge](https://ethereum.org/en/roadmap/merge/)(發生於 2022/09) 之後\
> Ethereum 迎來全新技術升級，chain selection 從原本的 最長的鏈 :arrow_right: **最多驗證者的鏈**

如此一來，這樣的互相監督機制使得區塊鏈不易被更改\
安全性也更加的高

> 要怎麼驗證 contract 內容合不合法？\
> 這件事情不應該從技術端解決，而是立法機構要介入的\
> 共識機制只確保我執行的結果是正確的

### Sybil Attack
藉由創造大量的假帳號試圖影響網路\
在 Blockchain 的世界裡，可以藉由一個惡意的節點，拒絕執行某些 transaction 拒絕寫入某些 block\
當數量足夠多的時候，就會造成 [51% Attack](#51-attack)

#### Direct Sybil Attack
惡意的節點直接與真正的節點互動

#### Indirect Sybil Attack
透過一個中間(proxy)節點，對真正的節點進行攻擊\
好處是 network 比較難發現惡意節點的存在\
有點類似 [中間人攻擊](https://en.wikipedia.org/wiki/Man-in-the-middle_attack)

![](https://www.thesslstore.com/blog/wp-content/uploads/2018/11/man-in-the-middle-attack.png)
> ref: [Executing a Man-in-the-Middle Attack in just 15 Minutes](https://www.thesslstore.com/blog/man-in-the-middle-attack-2/)

<hr>

### 51% Attack
當有過半數的人反對你的意見時，多數決的機制會排除你的意見\
在 blockchain 的世界裡面，如果你控制了超過半數的 Ethereum node 那麼你將控制整個 Ethereum Blockchain\
這時候你把黑的說成白的 也不會有人反對 畢竟現在你最有話語權

> 注意到，你不是能 100% 做你愛做的事情，比如說像是隨意移動他人 ETH 就是做不到的\
> 控制網路能做的是類似，拒絕 transaction, rollback transaction ... etc.

![](https://i.imgur.com/v3ayyNl.png)
> ref: [Ethereum Mainnet Statistics](https://ethernodes.org/history)

根據 [Ethereum Mainnet Statistics](https://ethernodes.org/history) 的大略統計結果\
目前有將近 7700 多台 Ethereum Node 正在運行\
意味著你要控制 3400 多台的機器，你才可能控制整個區塊鏈\
不敢說多數決的機制是完美的，但是想要完整控制還是需要花很多的錢 也大幅度的減小了 51% Attack 的可能性

> 透過下載 [go-ethereum](https://geth.ethereum.org/) 運行 Ethereum 節點你也可以為區塊鏈生態系貢獻心力

# Chain Types

![](https://d3fdygqk2e2j4k.cloudfront.net/blog_img/531c555150014f99ae36792c0e97be63)
> ref: [Polkadot/波卡鏈｜平行鏈競拍為何成為市場熱話？DOT幣有何用途？](https://cryptowesearch.com/blog/all/Polkadot-intro)

## Relay Chain
對於使用相同基礎設施的區塊鏈們，他們可以透過中繼鏈進行溝通

> Relay Chain 為 [Polkadot](https://polkadot.network/) 專有名詞

## Parachain
跑在相同底層區塊鏈之上的 chain 被稱之為 平行鏈

## Bridgechain
不同的區塊鏈不能互相傳遞資料，因此需要橋接鏈的幫助才可以溝通

# Blockchain Layers
與 OSI 七層模型一樣，區塊鏈也有類似的架構

> 有關七層模型的介紹，可參考 [重新認識網路 - OSI 七層模型 \| Shawn Hsu](../../network/network-osi)

![](https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fadiy29gdb3i09wdww8as.png)
> ref: [Blockchain layers — What are they?](https://dev.to/1solation/blockchain-layers-what-are-they-bkp)

總共有 5 層架構，分別為

1. `Physical Layer`
    + 就是基礎建設如硬體、網路以及虛擬機等等的
2. `Data Layer`
    + 儲存數據的地方，並且由所有節點共同維護
3. `Network Layer`
    + 所有節點構成分散式系統
4. `Consensus Layer`
    + 區塊鏈的基礎之一，共識機制，並且所有節點可以從維護區塊鏈網路中獲得獎勵(i.e. Token)
5. `Application Layer`
    + 最上層就是一些應用的部份了，包含像是 智能合約以及 Metamask 這種服務都算是應用層之上的服務

不過上述僅為架構，實際上我們在說的 layer 只有包含 3 層(3, 4, 5 層都有人講)

> 說目前 "只有" 3 層的原因很簡單，因為實際上區塊鏈仍在高度發展當中，搞不好以後會發展更多層也不一定

![](https://ospreyfunds.io/wp-content/uploads/Opsrey-Funds-Layers-of-the-Crypto-Universe-1536x864.jpg)
> ref: [Layers of the Crypto Universe](https://ospreyfunds.io/newsletter/layersofcryptoverse/)

## Layer 0
underlying infrastructure and network protocols(hardware, internet, protocol)
layer 0 的定義實際上有點迷，比較能說服我的說法是\
這層主要是包含一些 blockchain 的基礎設施，像是硬體，網路等等的

另一種說法是\
layer 0 包含了以下三個元素

### Mainnet
這裡說的 mainnet 可以用比較抽象的概念去理解\
blockchain 一定會提供一個機制，讓整個網路運行起來可以完善且更加有效的機制\
而這個機制是透過 primary chain 所提供的，可以確保網路的運作順利

同樣的，這裡的 primary chain 也是屬於比較抽象的概念\
實際上 blockchain 是由多個節點共同維護運行的，並不存在所謂的 master chain 或是 slave chain\
亦即，整個網路會致力於共同維護網路的資料正確性、安全性以及可信任性

### Sidechain
sidechain 可以用於橋接其他 chain 的資料，進行驗證或是單純的移動資料過來處理

可參考 [從 0 認識 Blockchain - Scaling Blockchain \| Shawn Hsu - Sidechain](../../blockchain/blockchain-scaling#sidechain)

### Cross-chain Operations
當多個 layer 1 chain 都使用相同 layer 0 基礎設施，之後就可以藉由 layer 0 進行跨鏈的功能(透過 [Relay Chain](#relay-chain))

<hr>

有一些鏈是直接運行於 layer 0 之上的，比如說 [Polkadot](https://polkadot.network/)\
為什麼它不屬於 layer 1?\
因為 Polkadot 提供了一些基礎設施，特殊的架構設計([Relay Chain](#relay-chain)) 使其擁有類似於基礎建設的架構\
因此我們稱它為 layer 0 blockchain

## Layer 1
layer 1 是區塊鏈的 base layer, 包含 共識機制，transaction 驗證以及 block creation\
我們熟知的 [Ethereum](https://ethereum.org/), [Bitcoin](https://bitcoin.org/zh_TW/) 都是屬於 layer 1\
不同的 L1 chain 不能交換資料，互相溝通

## Layer 2
![](https://i0.wp.com/newplayerjino.com/wp-content/uploads/LAYER2%E6%AF%94%E5%96%BB%E5%A3%93%E7%B8%AE.jpg?w=1200&ssl=1)
> ref: [【加密貨幣入門】3 分鐘了解 Layer 0 Layer 1 Layer 2 是什麼！](https://newplayerjino.com/layer0-1-2/)

blockchain 由於其去中心化的特性，亦即所有 transaction 都必須由所有節點執行並驗證過才可以上鏈\
這會導致單位時間內能處理的交易數量是有上限的\
因此整個交易速度會被拖得很慢\
而 layer 2 是 layer 1 blockchain 的解方，主要目的在於提昇速度，scalability\
常見的 solution 可以參考 [從 0 認識 Blockchain - Scaling Blockchain \| Shawn Hsu](../../blockchain/blockchain-scaling)

# References
+ [ETHEREUM DEVELOPMENT DOCUMENTATION](https://ethereum.org/zh-tw/developers/docs/)
+ [What is blockchain technology?](https://www.ibm.com/topics/what-is-blockchain)
+ [Introduction to smart contracts](https://ethereum.org/en/smart-contracts/)
+ [How Smart Contracts Will Change the World \| Olga Mack \| TEDxSanFrancisco](https://www.youtube.com/watch?v=pA6CGuXEKtQ)
+ [Web3, Blockchain, cryptocurrency: a threat or an opportunity? \| Shermin Voshmgir \| TEDxCERN](https://www.youtube.com/watch?v=JPGNvKy6DTA)
+ [Sybil Attacks Explained](https://academy.binance.com/en/articles/sybil-attacks-explained)
+ [51% Attack](https://academy.binance.com/en/glossary/51-percent-attack)
+ [Sybil Attack in Blockchain: Examples & Prevention](https://hacken.io/insights/sybil-attacks/)
+ [區塊鏈的 Layer 是什麼？L1-4 差異與應用範例介紹](https://www.rayskyinvest.com/57558/layer-intro)
+ [【加密貨幣入門】3 分鐘了解 Layer 0 Layer 1 Layer 2 是什麼！](https://newplayerjino.com/layer0-1-2/)
+ [What Are Blockchain Layers?](https://zebpay.com/blog/what-is-blockchain-layer-0-1-2-and-3)
+ [What Is a Layer 0 Blockchain?](https://www.banklesstimes.com/blockchain/what-is-layer-0-blockchain/)
+ [Understand Layer 0, 1 and 2 of Blockchain](https://blog.cryptostars.is/understand-layer-0-1-and-2-of-blockchain-12f4dc65e05a)
+ [What is a Layer 0 Blockchain?](https://www.horizen.io/academy/layer-0/#how-does-a-layer-0-work)
+ [What Is a Layer 0 Blockchain?](https://www.banklesstimes.com/blockchain/what-is-layer-0-blockchain/)
