---
title: 從 0 認識 Blockchain - Scaling Blockchain
date: 2023-04-25
categories: [blockchain]
tags: [blockchain, ethereum]
math: true
---

# Why do we need to Scale Blockchain
Ethereum blockchain 仰賴著共識機制，同時也深受共識機制帶來的效能影響\
由於要求所有 node 都執行計算 transaction 正確性，導致同一筆交易會被驗算數次\
進而消耗整體網路資源

本篇文章將會探討一些 layer 2 的加速手法\
一起看看吧

# Proofs
## Fraud Proof
將多筆 transaction 整合成一筆打包上鏈\
一般來說是視為合法的，如果有人不服，可以提出 challenge\
那麼 transaction 將會重新執行以驗證其正確合法性

> 可參考 [fraud proof](https://ethereum.org/en/glossary/#fraud-proof)

## Merkle Proof
驗證特定 transaction 是否屬於 block 或是 merkle tree 裡面

> 有關 Merkle Tree 的介紹可以參考 [從 0 認識 Blockchain - Transaction 以及你該知道的一切 \| Shawn Hsu](../../blockchain/blockchain-transaction)\
> 以及 [merkle proof](https://ethereum.org/en/developers/tutorials/merkle-proofs-for-offline-data-integrity/)

## Validity Proof
一樣會將多筆 transaction 打包成一筆上鏈\
不同於 [Fraud Proof](#fraud-proof) 的是，會 **事先** 額外提供一個 "證明" 證明 transaction 的合法性

> [Fraud Proof](#fraud-proof) 則是事後證明合法性，樂觀的認為提交上來的所有交易紀錄都是合法的

> 可參考 [validity proof](https://ethereum.org/en/glossary/#validity-proof)

## Zero-knowledge Proof - ZK proof
zk proof 不只可以驗證交易正確以及合法性，還可以驗證整個 state 的轉換是否正確\
也就是說它不用像 validity proof 一樣要有 challenge period\
常用的 zk proof 有兩種，[ZK-SNARK](https://arxiv.org/abs/2202.06877) 以及 [ZK-STARK](https://eprint.iacr.org/2018/046)\
值得注意的是，zk proof 不需要重新執行交易就可以驗證正確性

> 可參考 [ZK proof](https://ethereum.org/en/contributing/style-guide/content-standardization/#ZK-proof)

## Recursive Proof
[ZK proof](#zero-knowledge-proof---zk-proof) 的其中一個特性是，它可以驗證其他的 proof\
也就是說我可以將多個 proof 組合在一起變成 recursive proof

根據 [ZK-SNARK §4.3.2](https://arxiv.org/pdf/2202.06877.pdf#page=20)\
recursive proof 可以使用 parallel 的方式大幅度的提高吞吐量\
並且一旦驗證完成，所有相關的 block 都可以通過驗證

> 不過依照論文所述，[PLONK](https://github.com/matter-labs/solidity_plonk_verifier) 實作目前還是沒辦法達成並行計算

# Optimistic Rollups
既然 layer 1 的運算成本太高，我可以把一連串的交易 off-chain 算完(透過 off-chain virtual machine)，紀錄打包好再一次上傳(交給 on-chain contract)\
這樣就好了

optimistic 的原因在於，我相信 layer 2 的執行是完全合法的，而我不需要發布證明證明他是合法的\
想當然這樣有點太樂觀，因此在主網正式接受這些紀錄的時候，會有一個緩衝期(i.e. `challenge period`, 通常為一個禮拜)\
亦即任何人都可以提出他的質疑，透過計算 [fraud proof](#fraud-proof) 可以驗證紀錄真假\
一旦被發現造假或著是紀錄有問題\
該節點會受到處罰

> 有關 blockchain layer 的介紹，可參考 [從 0 認識 Blockchain - 區塊鏈基礎 \| Shawn Hsu](../../blockchain/blockchain-basics)

optimistic rollup 會將 **所有交易紀錄** 提交到主網\
所以在費用上面相比是沒有比較划算的\
它主要的目的在於，增加主網執行速度

> 注意到如果後來的 block(block1) 是跟著這個有問題的區塊(block0)，那麼 block1 也將會是非法的並且被 revert

|Pros|Cons|
|:--|:--|
|效能提升|會有延遲(challenge period)|
|可以輕易的驗證 transaction 正確性|交易紀錄順序可能改變|
|因為 vm 是 Ethereum compatible 所以可以輕易的移植現有 contract |可以發布假的 block 資訊(在沒有誠實的 node 存在的情況下)|
||必須提交所有交易紀錄，可能會增加成本|

# Zero-knowledge Rollups
相比於 [Optimistic Rollups](#optimistic-rollups) 將全部的紀錄寫回去，zk rollup 僅會將 **部份更改寫回主網**(通常只有 *一筆*，並且以 `calldata` 的形式)\
亦即它會把交易紀錄們做一個總結，只將有更改的地方寫回去，並且同時附上 [zk proof](#zero-knowledge-proof---zk-proof) 以證明其正確性

> calldata: 存在於 history log 而非 Ethereum state

執行的過程也與 [Optimistic Rollups](#optimistic-rollups) 相似，透過 off-chain virtual machine 執行計算，每隔一段時間題交給主網，並且由 on-chain contract 進行 [zk proof](#zero-knowledge-proof---zk-proof) 的驗證\
不同的是，由於 zk-rollups 有提供相關證明，因此它不會有所謂的 challenge period, 當紀錄被寫回去主網的同時，驗證過後，就會被接受

zk-rollups 由於產生驗證用的 zk proof 需要使用特定的硬體協助\
因此實務上會比較難使用

|Pros|Cons|
|:--|:--|
|可提供 [zk proof](#zero-knowledge-proof---zk-proof) 證明 transaction|費用較高(除了計算 transaction 之外還要證明的費用)|
|transaction 能較快被接受(免除 challenge period)|實作較困難|
|提供較強安全機制|需要特殊硬體協助|
|較少的資料需要被寫回主網|交易紀錄順序可能會改變|

# State Channel
每個 transaction 都要在每個 node 上面驗證過是一件費時的事情\
有沒有一種方法能夠讓 transaction 的執行是 off-chain 的呢？

## Channel
channel 提供了一個機制，允許交易能夠 off-chain 的執行，只須將最終結果寫回 blockchain\
大幅度的提高執行速度\
需要進行交易的所有參與者都必須 deploy [multisig smart contract](https://ethereum.org/en/developers/docs/smart-contracts/#multisig)，並且存入一些 eth 用於交易(交易期間不用付費，僅須開始以及結束的時候需要)\
然後就可以開始執行 off-chain 的快速交易了\
最後執行完畢要關閉 channel 的時候，所有參與者提交最終交易結果，然後寫回去 blockchain

multisig 最少一個人參與交易, 假設為 m 個人\
交易期間，muitlsig 需要至少有 n 把合法的 signature 才可以簽署交易\
且同樣的，受限於共識機制，至少要有一半的人同意才可以執行交易(常見的配置為 `n=3,m=5`, `n=4,m=7`)

而 channel 又分為兩種
+ payment channel
+ state channel

## Virtual State Channel
channel 的使用仰賴一開始雙方 deploy multisig contract, 這也違反了想要減少交易次數的初衷\
virtual state channel 提供了完整的 off-chain 機制，從 建立、交易到最後的提交都是 off-chain 的\
透過 on-chain 的 **ledger channel** 提供的 channel 實體，交易雙方可以使用它進行交易\
而 ledger channel 可以當成是中立的第三方，當出現糾紛的時候可以出來調停

<hr>

state channel 加強了 payment channel 只能用於金錢方面的限制，提供了更一般的解方\
state channel **全部參與者們都必須對 transaction 簽名** 方可執行，只要有一個人沒簽名，transaction 就不會執行

你說這樣安全嗎？\
答案很明顯的，相較於整個網路維持共識機制，單靠交易雙方是沒辦法維持的\
也就是說 state channel 其實是不怎麼安全的，當發生問題的時候，只能依靠爭議仲裁系統處理


# Sidechain
sidechain 是另一個獨立於主網的 blockchain, 並且可以透過 **two-way bridge** 與主網連接\
sidechain 可以擁有不同的 block 參數與共識機制，換言之不一定要跟原本的 chain 設定相同\
不同的共識機制，目的是為了可以更有效率的處理交易\
但這是有代價的，使用不同的機制代表他的安全性可能不如 layer 1 chain

注意到 sidechain 並不會將 transaction data 以及 state 寫回去主網

> 有關 blockchain layer 可以參考 [從 0 認識 Blockchain - 區塊鏈基礎 \| Shawn Hsu](../../blockchain/blockchain-basics)

常見的 sidechain 有 [Polygon POS](https://polygon.technology/polygon-pos), [Gnosis](https://www.gnosis.io/) 等等的

# Plasma
與 [Sidechain](#sidechain) 類似, 不同的是 plasma chain 是透過 **smart contract** 與主網連接的\
並且它可以使用主網的安全機制(相對的 sidechain 依靠自己的安全機制)

> [Plasma 白皮書](https://plasma.io/plasma.pdf)

主網，被稱之為 `root chain`, plasma 透過建立一個 `child chain` 與主網上面的 smart contract 進行溝通\
要使用的時候，必須存入一些 ETH 或者是 ERC-20 token\
這時候 plasma contract 會從主網複製一份資料下來到 child chain，之後所有的交易都是在 child chain 上面完成的\
每隔一段時間提交一個 **整合過的 commitment** 寫回主網\
這時候問題來了，我要怎麼確保你在 child chain 上面執行的交易紀錄是正確的？\
[merkle proof](#merkle-proof) 可以當作一個證明\
透過驗算 merkle proof 是否正確，能確保資料的正確性\
注意到，root chain 僅有 **整合過的狀態資料**, 它對於每一筆 transaction 是毫無了解的，亦即 plasma 是將所有資料儲存於 plasma 本身的而已

當你要離開 plasma 並將資料寫回主網並提領 ETH 或 token 的時候\
會有所謂的 challenge period(通常為一個禮拜), 如同先前提到的一樣，在這段期間內，所有人都可以質疑你的交易是否合法(透過 fraud proof)\
稱之為 **exit game**

> 既然 merkle proof 可以作為證明，為什麼不能當作 withdraw 的有效證明？\
> 因為 merkle proof 僅證明了某筆交易的正確性，但它不能保證整個 `狀態轉換` 是合法的

此外，plasma 並不能執行 smart contract\
它只能做有關 金錢、token 等等的事情


> plasma 通常只有一個 operator 在計算，惡意節點的可能性會更高

# Validium
跟 [Zero-Knowledge Rollups](#zero-knowledge-rollups) 類似，validium 可以使用 [validity proof](#validity-proof) 或是 [zk proof](#zero-knowledge-proof---zk-proof) 驗證交易合法正確性，不同的是 validium 的資料不會儲存在主網上面

validium 是 off-chain 執行的，有可能是使用 [Sidechain](#sidechain) 或者是其他的設施\
主要由兩個 contract 所執行的

+ `Main Contract`
    + 負責儲存 state commitment
+ `Verifier Contract`
    + 既然 validium 儲存的資料不是儲存在鏈上的，那麼當你在上傳 commitment 的時候是必須要驗證他的正確性

## Data Availability Committee - DAC
off-chain 的其中一個隱憂就是，當 node operator 不在線上的時候\
當你需要進行 withdraw 等等需要驗證的事情的時候(生成 merkle proof)，是沒辦法運作的\
因為所有的資料都在節點上面，而目節點不可用

一種作法是將資料上傳到可信任的第三方，稱之為 `Data Availability Committee - DAC`
![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*UoW7C9_TguIJTe0MlXV8Aw.png)
> ref: [Rollup 與資料可用性](https://medium.com/taipei-ethereum-meetup/rollup-and-data-availability-227340f1dbd6)

## Volition
Volition 提供了一個可以 **選擇的方案**，你可以選擇上傳資料到第三方，稱為 [Data Availability Committee - DAC](#data-availability-committee---dac) 或者是使用 on-chain data availability 的解決方案如 [ZK Rollups](#zero-knowledge-rollups)

![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*-x-7BeqBRMzBPZWePsJN9Q.png)
> ref: [Rollup 與資料可用性](https://medium.com/taipei-ethereum-meetup/rollup-and-data-availability-227340f1dbd6)

<hr>

|Pros|Cons|
|:--|:--|
|proofs 可以保證資料正確以及合法性|可能需要特殊硬體協助([zk proof](#zero-knowledge-proof---zk-proof))|
|減少 gas fee(資料在本地)|針對一般 use case 有較差的支援性|
||節點不一定可用，無法 generate merkle root|

# Conclusion
最後做一個大點的總結好了，不然有點霧颯颯

||[Optimistic Rollup](#optimistic-rollups)|[Zero-knowledge Rollup](#zero-knowledge-rollups)|[State Channel](#state-channel)|[Sidechain](#sidechain)|&nbsp;&nbsp;[Plasma](#plasma)&nbsp;&nbsp;|[Validium](#validium)|
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
|Security|main chain|main chain|[Fraud Proof](#fraud-proof)|Itself|main chain|main chain|
|Proof|[Fraud Proof](#fraud-proof)|[ZK proof](#zero-knowledge-proof---zk-proof)|[Fraud Proof](#fraud-proof)|custom|[Fraud Proof](#fraud-proof)<br>[Merkle Proof](#merkle-proof) or<br>[Validity Proof](#validity-proof)|[Validity Proof](#validity-proof) or<br>[ZK proof](#zero-knowledge-proof---zk-proof)|
|Challenge period|:heavy_check_mark:|:x:|:x:|:x:|:heavy_check_mark:|:heavy_check_mark:|
|Commit to mainnet|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:x:|:heavy_check_mark:|:heavy_check_mark:|
|Data location|on-chain|on-chain<br>off-chain|on-chain<br>off-chain|off-chain|on-chain<br>off-chain|on-chain<br>off-chain|
|Data on mainnet|full history|state|state|:x:|state|state|
|Data on local|full history|tx data|tx data|:x:|tx data|tx data|

# References
+ [What is a Sidechain?](https://www.horizen.io/academy/sidechains/)
+ [OPTIMISTIC ROLLUPS](https://ethereum.org/en/developers/docs/scaling/optimistic-rollups/)
+ [SIDECHAINS](https://ethereum.org/en/developers/docs/scaling/sidechains/)
+ [ZERO-KNOWLEDGE ROLLUPS](https://ethereum.org/en/developers/docs/scaling/zk-rollups/)
+ [STATE CHANNELS](https://ethereum.org/en/developers/docs/scaling/state-channels/)
+ [PLASMA](https://ethereum.org/en/developers/docs/scaling/plasma)
+ [VALIDIUM](https://ethereum.org/en/developers/docs/scaling/validium/)
+ [Rollup 與資料可用性](https://medium.com/taipei-ethereum-meetup/rollup-and-data-availability-227340f1dbd6)
