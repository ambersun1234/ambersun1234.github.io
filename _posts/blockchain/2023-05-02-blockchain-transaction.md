---
title: 從 0 認識 Blockchain - Transaction 以及你該知道的一切
date: 2023-05-02
description: 了解 Transaction 是如何運作對於理解區塊鏈有著很大的幫助，本文將會介紹 Transaction 的基本概念以及更深入的探討網路運作機制
categories: [blockchain]
tags: [blockchain, ethereum, transaction, block]
math: true
---

# How does Blockchain Works
複習一下 blockchain 是如何運作的\
blockchain 是由多個節點所組成的分散式計算網路\
每個節點都嚴格遵循共識機制，共同維護區塊鏈上的資料

詳細的簡介，可以回去複習 [從 0 認識 Blockchain - 區塊鏈基礎 \| Shawn Hsu](../../blockchain/blockchain-basics)

# Introduction to Transactions
![](https://ethereum.org/_next/image?url=%2Fcontent%2Fdevelopers%2Fdocs%2Ftransactions%2Ftx.png&w=828&q=75)
> ref: [TRANSACTIONS](https://ethereum.org/en/developers/docs/transactions/)

就如同基礎篇所提到的，每一次與區塊鏈的互動，都是一次的交易\
這個交易可以是 金錢上的出入、合約的讀寫操作以及 Token 的往來

同時 Transaction 所代表的意思是 `改變區塊鏈的狀態`, 而這個狀態必須同步到整個網路上\
交易內容一旦確認完畢後，便會 **永久的儲存在鏈上** 且沒有人能更改

而每一筆的交易都需要付費，並且 Transaction 將會打包，並且存於 [Block](#block) 之中

# Why do we need to Pay for Transactions
區塊鏈的資料是儲存在各個節點的硬碟上面，想當然這不會是免費的\
為了能夠讓 node 願意幫你執行運算並儲存你的資料，付一點錢是必要的

## Miners
在 Proof-of-Work(POW) 的時代，節點的工作者被稱之為 `miners 礦工`\
也就是我們熟知的挖礦

要計算 Transaction 就像是解一題超爆難的數學題目\
為了能得到所謂的 **獎勵**, 並且因為這個獎勵只會給第一個解出來的人\
每個節點拼了命的瘋狂在解題\
造成大量算力的浪費

POW 的獎勵為 block fee + transaction fee(base fee + priority fee)

## Validators
為了解決 POW 所帶來大量的算力浪費，Proof-of-Stake(POS) 的機制可以大幅度的解決這件事情\
其中 `miner` 變為了 `validators 驗證者`

驗證者的機制是說，我以我的金錢擔保這個交易內容沒問題(which is 質押)\
而這個金錢是使用 ETH 的方式\
驗證者需要存入一些 ETH 才能夠變成所謂的驗證者

一樣為了得到獎勵，不同的是 validator 透過投票的方式，贊成或是反對要不要將 Transaction 加入新的 Block\
而你的金額的大小決定投票權重的大小

POS 的獎勵為 priority fee

<hr>

有關獎勵機制，可參考 [Gas](#gas)

> 有關共識機制，之後會有一篇獨立出來
<!-- > 有關共識機制的介紹，可以參考 [從 0 認識 Blockchain - 從 go-ethereum 理解共識機制 \| Shawn Hsu] -->

# Ethereum Virtual Machine - EVM
用以執行智能合約的底層，被稱之為 Ethereum Virtual Machine\
就跟我們在計算機組織裡學到的一樣，EVM 也有自己的一套 opcode([Ethereum Virtual Machine Opcodes](https://ethervm.io/))\
所以執行合約的時候，EVM 能夠清楚的了解並解析 bytecode 然後執行

因為 EVM 是負責處理運算 Transaction，還記得我們說過交易有可能會改變區塊鏈的狀態嗎？\
由於 EVM 是主要做這些狀態改變的人，因此 EVM 也被視為是 **state machine**, 負責將區塊鏈的狀態更新到新版

![](https://ethereum.org/_next/image?url=%2Fcontent%2Fdevelopers%2Fdocs%2Fevm%2Fevm.png&w=828&q=75)
> ref: [ETHEREUM VIRTUAL MACHINE (EVM)](https://ethereum.org/en/developers/docs/evm/)

值得一提的是，EVM 是採用 **stack-based approach** 實作的，並且為 big endian\
亦即他的資料都是存在 stack 當中的，當有需要的時候使用 push, pop 就可以拿取以及儲存資料了\
而這個 stack 大小為 `1024`, 每個 element 大小為 `256 bit`

> 有關 endian 的介紹可以參考 [重新認識網路 - OSI 七層模型 - Endian \| Shawn Hsu](../../network/network-osi#endian)

常見的 EVM 實作有
+ [go-ethereum](https://geth.ethereum.org/)
+ [Py-EVM](https://github.com/ethereum/py-evm)
+ [evmone](https://github.com/ethereum/evmone)

> 詳細可參考 [Ethereum Yellowpaper](https://ethereum.github.io/yellowpaper/paper.pdf)

# Interact with Smart Contract
與區塊鏈互動的其中一個方式就是透過智能合約\
smart contract 本質上就是一連串自動執行的程式碼\
那麼我們要怎麼跟它互動呢？

本質上就是 call function 嘛\
所以你至少要知道是哪個 function, 以及 function 存在於哪個合約上面(因為別的合約可能有一模一樣的函式定義)，亦即
+ Contract Address
+ [Application Binary Interface - ABI](#application-binary-interface---abi)

## Application Binary Interface - ABI
```json
[
    ...

    {
      "inputs": [
        {
          "internalType": "address",
          "name": "nftContractAddress",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenID",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        }
      ],
      "name": "listNFT",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }

    ...
]
```
顧名思義，它就是 interface，定義了 contract 裡面的架構\
如上圖，定義了一個 function, 它擁有 3 個 input，依序為 address, uint256 以及 uint256\
透過 ABI 我不用了解你是如何實作的，只要我根據 interface 提供參數，我就會拿到想要的結果

看著是不是跟 API 很像\
不同的是，ABI 不能直接呼叫，它只是個定義，只能透過 binary 的方式存取\
而 API 是可以在 source code level 拿到的

## Function Signature
為了能夠辨識所謂的 function, 我們需要給它一個名字(或者說識別符號)\
而這個識別符號由以下組成
+ Function name
+ Type of function parameters

舉例來說，listNFT 定義如下
```solidity
function listNFT(
        address nftContractAddress,
        uint256 tokenID,
        uint256 price
    ) {
    // list nft implementation
}
```

那麼他的 signature 就會是以下
```
listNFT(address,uint256,uint256)
```

> 組成的時候，需要去掉所有的空白

## Function Selector
我們知道了可以透過 [Application Binary Interface - ABI](#application-binary-interface---abi) 取得 function 的定義\
但是實務上我還是不知道這個 function 在哪裡對吧\
我可以使用 [Function Signature](#function-signature)，這樣我就知道 function 的進入點位置了對吧\
但是要稍微加工一下

將 signature 算 hash 之後，會得到一串字串\
取 **前 4 個 byte** 當作 selector\
當 [Ethereum Virtual Machine - EVM](#ethereum-virtual-machine---evm) 要執行某個 function 的時候\
它會根據 function selector 找到相對應的 function 進入點進入執行

以 `listNFT` 來說，透過以下函式可以計算他的 hash
```solidity
bytes4(keccak256(bytes(signature)))
```

> 它會不會發生碰撞？ 他的 signature 就是一串英文字母\
> 相同的字串算出來的 hash 一定是一樣的\
> 又因為你不能定義相同的 function，所以 signature 一定會是不同的

在你的 contract 裡面加一個 pure function
```solidity
function signatureListNFT() public pure returns(bytes4) {
    return bytes4(keccak256(bytes("listNFT(address,uint256,uint256)")));
}
```
並且執行你就會得到一串神秘 signature `0xad05f1b4`

> pure :arrow_right: 不會讀取區塊鏈狀態\
> view :arrow_right: 讀取但不更改區塊鏈狀態

也可以使用線上的 hash tool 進行驗證
<iframe src="https://emn178.github.io/online-tools/keccak_256.html" onLoad="self.scrollTo(0,0)" style="width:100%; height:32em"></iframe>

# Block
blockchain 顧名思義是由一堆 block 所構成的 chain\
儲存在鏈上的，會是一堆一堆的 block\
每個 block，以 Ethereum 來說會是 `12 秒` 生成一個新的區塊\
而 block 裡面包含了

+ 若干個 Transaction
+ 前一個 block 的 hash

![](https://ethereum.org/_next/image?url=%2Fcontent%2Fdevelopers%2Fdocs%2Fblocks%2Ftx-block.png&w=828&q=75)
> ref: [BLOCKS](https://ethereum.org/en/developers/docs/blocks/)

![](https://www.code-brew.com/wp-content/uploads/2017/12/blockchain_4.png)
> ref: [Blockchain](https://www.code-brew.com/blockchain/)

[Validator](#validators) 準確的來說，是要驗證 block, 也因為 Transaction 包含在其中，所以交易也會被驗證, by default\
被選為要生成下一個 block 的 validator 會打包近期的 Transaction 並加上一些 header 如 [Merkle Root](#merkle-root) 透過 gossip protocol 傳遞到其他的節點進行驗證\
驗證通過之後，便會將該 block 寫到自己節點的鏈上

你可以到 [andersbrownworth.com/blockchain/blockchain](https://andersbrownworth.com/blockchain/blockchain) 實際的玩一下
![](http://corkblockchain.com/assets/blockchain_demo.png)
> ref: [Blockchain Demo - Making Blockchain Accessible](https://corkblockchain.com/demo/accessible/2018/04/05/blockchain-demo.html)

## Why do we need to Include Previous Block Information
為什麼要包含前一個 block 的資訊？\
試想如果我貢獻了其中一個 block，但是我竄改了其中的交易資料，使得有些紀錄被我抹除了\
又假如我擁有超過半數的網路節點，而每個節點我都這樣做，會發生什麼事情？

沒錯，[51% Attack](../../blockchain/blockchain-basics#51-attack)!\
所以將前一個節點的資訊加入，會大幅度的增加 51% 攻擊的難度\
由於 block 的資訊依賴於前者 block 的資訊\
因此，之後的 block 必須要 **全部重新計算**, 導致攻擊者需要花費大幅度的心力去影響整個網路\
進而增加難度

## Block Size
在 [London](https://ethereum.org/en/history/#london) 升級之前\
block size 是固定大小的，亦即每一個區塊能夠包含的交易數量是有上限的

固定大小的 block size 有幾個問題
1. 因為大小固定，只有固定數量的交易能提交進網路，導致多出來的交易需要進行等待
2. 為了能夠盡快的寫入 block, 你會提高手續費(可參考 [Transaction Stuck](#transaction-stuck))，進而導致整體網路交易費用大幅提高

在倫敦升級之後，引入動態大小的 Block size 能夠解決以上問題\
平均的區塊大小會在 15 million gas, 最大可以到 2 倍(也就是 30 million gas)\
詳細可以參考 [EIP 1559](#eip-1559)

## Genesis Block
盤古開天的第一個 block 稱之為 **Genesis Block**\
第一個 block 是沒有辦法被挖礦的，因為它沒有前一個 block 可以參照\
genesis block 是透過設定而生出來的

在 POW 的時代，可以透過 `genesis file` 啟動客戶端\
代表他是從運作區塊鏈的一開始就存在的

# Merkle Tree
[Block](#block) 裡面包含了區間內所有交易資料，要如何快速的交易的正確性是一項挑戰

Merkle Tree 是一個樹狀的資料結構\
其節點由資料雜湊而成(hash)\
而 leaf node 則是由原始資料 hash 而成\
就像下面圖片一樣

> 其中前綴有 h 的，代表 hash 過的數值

![](https://image.binance.vision/editor-uploads/3dea212055754dd2b0741845c95d3d49.png)
![](https://image.binance.vision/editor-uploads/761c2fdb12a544aa873a9e9a3ada274f.png)
> ref: [Merkle Tree 和 Merkle Root 介紹](https://academy.binance.com/zt/articles/merkle-trees-and-merkle-roots-explained)

藉由一層一層的往上 hash, 最終你得到的 `hABCDEFGH` 即為所謂的 **Merkle Root**

> 注意到 Merkle Tree 不能反推 sub-Merkle Tree 哦(因為 hash 是單向的)

<hr>

驗證某個 Transaction 是否是在這個 [Block](#block) 裡面可以透過驗算 Merkle Root 得到\
假設要驗算 `D` 有沒有被更改過(存在於該 block)\
只要驗算 `hAB`, `hC`, `hD` 以及 `hEFGH` hash 過後的數值是否等於 `hABCDEFGH` 就可以了

![](https://image.binance.vision/editor-uploads/9e31057c05a84b49a35b477c4c2b9734.png)
> ref: [Merkle Tree 和 Merkle Root 介紹](https://academy.binance.com/zt/articles/merkle-trees-and-merkle-roots-explained)

# Transactions
## Type of Transaction

|Transaction Type|Description|
|:--|:--|
|一般的交易|轉移金錢或 Token|
|合約的建立|沒有 `recipient`(i.e. `to`)<br>並且 data 欄位包含了 contract bytecode|
|合約的操作|`to` 指的就是 contract address<br>data 則包含了必要的資料，可參考 [Transaction Attributes](#transaction-attributes)|

## Mempool
![](/assets/img/posts/blockchain-tx1.jpg)

待處理的 Transaction 會被放在 node 的 local memory, 稱之為 `memory pool`\
一旦新的 Transaction 被提交到網路的時候， [Miner](#miners) 或者是 [Validator](#validators) 就會開始進行處理交易\
完成計算整個 block 之後，會進行廣播，將算好的 block 傳遞到各個 node 進行同步\
而其他的節點需要負責驗算結果是否合法(驗算 [Merkle Root](#merkle-root))\
並且將新的 block 資料儲存於各自的節點硬碟當中

## Transaction Response Attributes
最基礎的 Transaction Response 包含了至少以下欄位

|||
|:--|:--|
|from|Transaction 的發起者的錢包地址，只能是外部錢包地址，智能合約無法發送交易請求|
|recipient|1. 外部錢包地址 :arrow_right: 轉移數值(可能是 ETH 或是 Token)<br>2. 合約地址 :arrow_right: 執行合約程式碼|
|signature|sender 的簽章，用以證明 Transaction 的發起者(通常以私鑰簽名)|
|nonce|簡單的計數器，用以紀錄 Transaction 數字(number used only once)<br><img src="https://csct-assets.infura-ipfs.io/ipfs/QmPJ28Vsa1v4WXDcvdBFGKYNMb9STeP96QvHSK2o85nt6R" style="width:300px; height:auto"><br>> ref: [How to customize a transaction nonce](https://support.metamask.io/configure/transactions/how-to-customize-a-transaction-nonce)|
|value|轉移的數值，單位為 Wei<br>詳細可參考 [Wei GWei ETH](#wei-gwei-eth)|
|data|任意資料|
|gasLimit|可參考 [Gas](#gas)|
|maxPriorityFeePerGas|可參考 [Gas](#gas)|
|maxFeePerGas|可參考 [Gas](#gas)|

### Data
data 的欄位通常是放一些跟 [Application Binary Interface - ABI](#application-binary-interface---abi) 有關的資料\
比方說當我執行合約的函式的時候，data 欄位就會是放 [Function Selector](#function-selector) 以及參數資料\
舉例來說，當執行 `listNFT` 的時候
```solidity
function listNFT(
        address nftContractAddress,
        uint256 tokenID,
        uint256 price
    ) {

}
```
它執行完成的 response 的 data 欄位如以下所示
```json
{
  "data":"0xad05f1b40000000000000000000000009fe46736679d2d9a65f0992f2272de9f3c7fa6e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
}
```

根據先前學到的知識，我們可以知道 [Function Selector](#function-selector) 佔前面 4 個 byte\
也就是這個 Transaction 所執行的 function 為 `0xad05f1b4`(也就是 `listNFT`)

> 4 個 byte 總共為 32 的 bit\
> data 是使用 hex 表示法，亦即一個位置表示 4 個 bit(0x1 = 0b0001)\
> 所以 function selector 要數 8 個字母(32 bit / 4 bit)

那麼後面的呢？ 讓我們先把輸出用的好看點
```json
{
  "data":"0xad05f1b4
        0000000000000000000000009fe46736679d2d9a65f0992f2272de9f3c7fa6e0
        0000000000000000000000000000000000000000000000000000000000000000
        0000000000000000000000000000000000000000000000000000000000000001",
}
```
剩下可以看出，有三組資料，而他們分別對應到 `address nftContractAddress, uint256 tokenID, uint256 price`\
我們知道 EVM 的資料儲存的格式，是每一個資料為 `256 bit` 大小(i.e. `32 byte`)\
所以即使 address 是以 20 個 byte 表示，在 EVM 當中還是以 32 byte 呈現，差的部份則是使用 0 補齊

> 回顧 [Ethereum Virtual Machine - EVM](#ethereum-virtual-machine---evm)

第一個 `0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0` 為 nftContractAddress\
第二個 `0x0` 為 tokenID\
最後則是 `0x1` 為 price

你可以利用 [Etherscan](https://etherscan.io/) 等等的 block explore 去觀察 Transaction detail
![](https://blog.ambire.com/content/images/2022/11/Screenshot-2022-11-17-at-15.59.02.png)
> ref: [How to use Etherscan](https://blog.ambire.com/how-to-use-etherscan/)

## Transaction Receipt Attributes
這裡列出幾項，常使用的欄位

### Events
```json
{
  "events":[
    {
      "transactionIndex":0,
      "blockNumber":10,
      "transactionHash":"0xa3e2d89e7a383f58a276118f99703d8e0eb166174c397920a45cf08e2fdef44d",
      "address":"0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "topics":[
          "0xd547e933094f12a9159076970143ebe73234e64480317844b0dcb36117116de4",
          "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
          "0x0000000000000000000000009fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
          "0x0000000000000000000000000000000000000000000000000000000000000000"
      ],
      "data":"0x0000000000000000000000000000000000000000000000000000000000000001",
      "logIndex":0,
      "blockHash":"0x8dc1ea78fc4bafaffed224b8b986e117e9d17666e7c9ac6ee275c94eb5db525e",
      "args":[
          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
          {
            "type":"BigNumber",
            "hex":"0x00"
          },
          {
            "type":"BigNumber",
            "hex":"0x01"
          }
      ],
      "event":"ItemListed",
      "eventSignature":"ItemListed(address,address,uint256,uint256)"
    }
  ]
}
```

智能合約能夠透過發送 event 來與外部的世界互動\
上述就是一個簡單 event 的例子

可以看到，這個 event 的 signature 為 `ItemListed(address,address,uint256,uint256)`\
那麼他的 selector 就是 `d547e933094f12a9159076970143ebe73234e64480317844b0dcb36117116de4`

> 回顧 [Function Selector](#function-selector)

event 原型定義為
```solidity
event ItemListed(
    address indexed seller,
    address indexed nftContractAddress,
    uint256 indexed tokenID,
    uint256 price
);
```
如上所示，event 可以傳送資料\
其中，資料分為兩種
+ `indexed parameter`
    + indexed parameter 可以更快速的查詢特定的資訊
    + indexed parameter 的大小為 128 byte(4 * 32 byte), 亦即最多有 4 個參數可以放在 indexed parameter 裡面
    + indexed parameter 會儲存在 `topics` 的欄位中
    + topics[0] 為 [Function Selector](#function-selector)
        + anonymous function 除外
+ `non-indexed parameter`
    + non-indexed parameter 會儲存在 `data` 欄位中
    + 不限定數量
    + 資料為 [ABI](#application-binary-interface---abi) encoded, 亦即沒有 ABI 你是沒辦法 decode 的

<hr>

根據我們的定義，有 3 個 indexed parameter 以及 1 個 non-indexed parameter
```json
"topics":[
    "0xd547e933094f12a9159076970143ebe73234e64480317844b0dcb36117116de4",
    "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0x0000000000000000000000009fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
    "0x0000000000000000000000000000000000000000000000000000000000000000"
],
"data":"0x0000000000000000000000000000000000000000000000000000000000000001",
```
其中 topics[0] 為 [Function Selector](#function-selector)\
跟我們上面得出的結果一致\
再來就是 `address`, `address`, `tokenID` 分別對應到 `topics[1]`, `topics[2]` 以及 `topics[3]`

剩下的 1 個 `non-indexed parameter` 則儲存在 data, 為 price

args 的欄位則是包含了 topics 以及 data 的資料

### GasUsed
```json
{
   "gasUsed":{
      "type":"BigNumber",
      "hex":"0x01c7db"
   },
}
```
[Gas](#gas) 中提到，每一筆 Transaction 可能會執行多個運算步驟\
gasUsed 就是代表 `你使用了多少個 unit`\
要計算總 gas fee 就是 [GasUsed](#gasused) * [EffectiveGasPrice](#effectivegasprice)

### EffectiveGasPrice
```json
{
  "effectiveGasPrice":{
      "type":"BigNumber",
      "hex":"0x4a1d07d2"
   },
}
```
[Gas](#gas) 中，我們提到，手續費是由 base fee 以及 priority fee 所決定的\
其中 base fee 由網路自行運算所得出來的\
而實際上網路所消耗的實際手續費仍有所不同

effectiveGasPrice 即為 `base fee + priority fee 所構成`\
在實際計算所消耗的手續費的時候，需要將其與 gas used 相乘\
也就是 [GasUsed](#gasused) * [EffectiveGasPrice](#effectivegasprice)

## Genesis Address
雖說 [Genesis Block](#genesis-block) 是一開始運行客戶端就建立起來的 block\
但是如果你到 [Etherscan](https://etherscan.io/txs?block=0) 去看第一個 block 的交易資訊\
你會發現到，`from` 是有數值的，為 `0x0`

這個地址被稱之為 `Genesis Address`\
而我們說，沒有人建立第一個 block, 亦即該 block 不會紀錄誰建立了這個 block(digital signature)\
但是 `from` 的確是寫 genesis address 阿

沒有簽章，但有地址？\
亦即，該地址沒有私鑰(因為沒有簽章資訊)\
也就是說，它像是一個 **黑洞** 一樣(i.e. `/dev/null`)\
沒有私鑰代表沒有人可以真的掌控該錢包地址\
所有送進去的 ETH, Token 都沒有辦法拿出來\
這也就是為什麼，genesis address 截至文章撰寫時間，擁有接近 `1889.34 顆 ETH` 以及 `201 種不同 Token`

> 可參考 [https://etherscan.io/address/0x0000000000000000000000000000000000000000](https://etherscan.io/address/0x0000000000000000000000000000000000000000)

如果只是一開始建立 [Genesis Block](#genesis-block) 應該不用那麼多 ETH 跟 Token 對吧？\
除了初始化區塊鏈之外，還有一些情況會需要用到 Genesis Address\
根據 Etherscan 上面的 quote
```
This address is not owned by any user, 
is often associated with token burn & mint/genesis events 
and used as a generic null address
```

當你需要銷毀 Token 的時候會需要用到 Genesis Address\
那 ETH 呢？

> 有關 Token 的部份會獨立一篇出來
<!-- > 有關 Token 可以參考 [Shawn Hsu]() -->

事實上 一些智能合約(通常是沒有寫好)\
如果沒有指定 recipient(`to`), 預設會是 Genesis Address\
可想而知，這樣會出大問題\
就比如說這個交易 [0x1c96608bda6ce4be0d0f30b3a5b3a9d9c94930291a168a0dbddfe9be24ac70d1](https://etherscan.io/tx/0x1c96608bda6ce4be0d0f30b3a5b3a9d9c94930291a168a0dbddfe9be24ac70d1) 轉了 `1493 顆 ETH` 到一個沒有人拿的出來的地方\
以一人之力貢獻了目前 Genesis Address 80% 的 ETH 存量

# Transaction Stuck?
有時候你可能會遇到，你的 Transaction 卡在 [Mempool](#mempool) 很久並且都還在 pending\
原因其實很簡單，就是你錢付的不夠多

[Miner](#miners) 或是 [Validator](#validators) 傾向從手續費高的交易開始處理(因為我可以拿到比較多錢嘛)\
常見的方法就是，你可以覆蓋之前的交易\
用更多的手續費覆蓋先前的交易，可能可以讓 node operator 優先處理你的交易

> 為什麼說可能而不是一定，因為有可能其他人出價比你更高，那麼你還是得排在它後面

首先，你必須知道你要覆蓋哪一筆資料\
nonce 作為 Transaction 的唯一識別數字，可以使用它\
再來你需要手動指定交易手續費\
做完以上就可以了

如果你是使用 [Metamask](https://metamask.io/) 現在可以只按下 speed up 的按鈕就完成

> 早期 Metamask 還是必須用手動提高 gas fee 的作法，不過現在就是一鍵搞定

![](https://csct-assets.infura-ipfs.io/ipfs/QmeaGQUkwivzCg5Bp127hybGWJzh2bQvSCcLzyaoegpfrE)
> ref: [How to speed up or cancel a pending transaction](https://support.metamask.io/manage-crypto/transactions/how-to-speed-up-or-cancel-a-pending-transaction)

# Wei GWei ETH
1 ETH = $10^9$ GWei\
1 GWei = $10^{10}$ Wei

<iframe src="https://eth-converter.com/" style="width:100%; height:45em"></iframe>

# Gas
每一筆 Transaction 所需要執行的運算資源，是需要付費的\
而這個費用就是所謂的 Gas\
不同量級的運算資源所需要耗費的 Gas 都不盡相同

手續費在 [London](https://ethereum.org/en/history/#london) 升級以前\
由兩個數值所組成

|Gas Price(per unit)|Gas Limit(gas unit limit)|
|:--:|:--:|
|針對每個 unit, 你願意付多少錢|一筆 Transaction 最多能使用多少 unit|

Transaction 可能包含很複雜的邏輯，每一步的計算都需要手續費，unit 可以把它想像成每個步驟這樣\
而 gas limit 就是每個步驟能夠使用的上限\
因此，總共 `最大可能耗費的金錢` 為 `gas price * gas limit`

> 當然，有可能你花的錢少於最大金額，那麼剩下的會還給你

## EIP 1559
我們上面有稍微提到，在執行 Transaction 的時候有可能會卡住\
那是因為你付的手續費沒有高到 node operator 想要處理你的交易\
[Transaction Stuck](#transaction-stuck) 這裡提到的方法為手動設定手續費\
但它顯然有點，怎麼說，如果你付了太多的錢，又會太過
有沒有一個好一點的方法，能夠改進它呢

[London](https://ethereum.org/en/history/#london) 升級的一大重點，就是 [EIP 1559](https://eips.ethereum.org/EIPS/eip-1559)\
旨在改善以下幾點
+ 讓手續費能夠更容易預測
+ 減少交易確認時間
+ 改善使用者體驗

EIP 1559 引入了一個新的手續費機制，它主要包含了兩個新的概念

### Base Fee
由於 gas price 是需要手動指定的，常常造成太多的錢被浪費\
base fee 的引入，可以根據網路目前的使用狀態進行上下調整\
當網路使用量大的時候，亦即 [Block Size](#block-size) > 50%, 則提升 base fee, 反之則降\
而當 base fee 提高的時候，因為手續費變高，所以我們可以期待交易量會下降，進而達到網路穩定

與 [Priority Fee](#priority-fee) 不同的是，Base fee 它不會到 node operator 的手上\
它會把它銷毀\
原因在於
1. 避免通膨
2. 提高 ETH 價值而非 ETH 數量

### Priority Fee
priority fee 則是為了提高 Transaction 的處理速度，就像 [Transaction Stuck](#transaction-stuck) 裡面提到的方法一樣\
priority fee 是直接付給 [Miner](#miners) 或是 [Validator](#validators)\
當作獎勵

<hr>

gas price 被拆成兩個部份，base fee 與 priority fee\
所以每一筆的 Transaction 計算方式就是\
([Base Fee](#base-fee) + [Priority Fee](#priority-fee)) * 多少個 unit\
在 Transaction Receipt 裡面你可以發現所需要的欄位\
所以上述公式會變成
[EffectiveGasPrice](#effectivegasprice)(每個 unit 要花多少錢) * [GasUsed](#gasused)(使用了多少個 unit)

> 注意到 gas limit 依然存在，它並沒有被取代\
> 你依舊可以手動設定一筆 Transaction 最多可以使用多少 unit

## High Gas Price
高昂的 Gas Price 往往會造成使用者不願意付錢進行交易\
Cryptokitties 在某一版本的實作當中\
為了要列出使用者的第 n 隻貓咪，他們選擇用一個 for-loop 逐一檢查貓咪陣列，拉出符合條件的資料

```solidity
function tokensOfOwnerByIndex(address _owner, uint256 _index)
        external
        view
        returns (uint256 tokenId)
    {
        uint256 count = 0;
        for (uint256 i = 1; i <= totalSupply(); i++) {
            if (kittyIndexToOwner[i] == _owner) {
                if (count == _index) {
                    return i;
                } else {
                    count++;
                }
            }
        }
        revert();
    }
```
> ref: [contracts/KittyOwnership.sol](https://github.com/dapperlabs/cryptokitties-bounty/blob/master/contracts/KittyOwnership.sol#L163)

我們上面有提到，Gas Fee 是基於你耗費了多少的算力而決定的\
而 Cryptokitties 的實作，其執行時間會隨者 totalSupply 的大小而增加\
換言之，運算的次數會隨之增加，最終導致高昂的 Gas Fee

那麼有人提出來一個改進的方法，我們可以紀錄一個 map\
這樣就可以避免要逐一檢索全部的陣列資料

因此設計合約的時候，實作中你應該要考慮到耗費的資源\
並且善用 [hardhat gas reporter](https://github.com/cgewecke/hardhat-gas-reporter) 等工具試圖優化

詳細可以參考原本的 bounty issue [Listing all kitties owned by a user is O(n^2)](https://github.com/dapperlabs/cryptokitties-bounty/issues/4)

# References
+ [TRANSACTIONS](https://ethereum.org/en/developers/docs/transactions/)
+ [What is a function signature and function selector in solidity (and EVM languages)?](https://ethereum.stackexchange.com/questions/135205/what-is-a-function-signature-and-function-selector-in-solidity-and-evm-language)
+ [What is an application binary interface (ABI)?](https://stackoverflow.com/questions/2171177/what-is-an-application-binary-interface-abi)
+ [ETHEREUM VIRTUAL MACHINE (EVM)](https://ethereum.org/en/developers/docs/evm/)
+ [Ethereum Genesis Address: The “Black Hole” That Has Over $520 Million Worth Of Tokens](https://crypto.news/ethereum-genesis-address-black-hole-520-million-worth-tokens/)
+ [必讀指南 \| 以太坊 PoS 時代：如何成為個人 ETH 驗證者？](https://blockcast.it/2022/09/21/heres-how-anyone-can-become-an-eth-validator/)
+ [PROOF-OF-STAKE (POS)](https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)
+ [BLOCKS](https://ethereum.org/en/developers/docs/blocks/)
+ [CONNECTING THE EXECUTION AND CONSENSUS CLIENTS](https://ethereum.org/en/developers/docs/networking-layer/#connecting-clients)
+ [Merkle Tree 和 Merkle Root 介紹](https://academy.binance.com/zt/articles/merkle-trees-and-merkle-roots-explained)
+ [雜湊樹](https://zh.wikipedia.org/zh-tw/%E5%93%88%E5%B8%8C%E6%A0%91)
+ [GAS AND FEES](https://ethereum.org/en/developers/docs/gas/)
+ [Beginners guide to Ethereum (3) — explain the genesis file and use it to customize your blockchain](https://medium.com/taipei-ethereum-meetup/beginners-guide-to-ethereum-3-explain-the-genesis-file-and-use-it-to-customize-your-blockchain-552eb6265145)
+ [What is Ethereum’s Genesis Address](https://guidescroll.com/2021/03/what-is-ethereums-genesis-address/)
+ [Why the Ethereum genesis address holds over $500m worth of tokens](https://www.finder.com.au/why-the-ethereum-genesis-address-holds-over-500m-worth-of-tokens)
+ [Understanding event logs on the Ethereum blockchain](https://medium.com/mycrypto/understanding-event-logs-on-the-ethereum-blockchain-f4ae7ba50378)
+ [【新手教學】到底什麼是Gas、Gas Price、Gas Limit？](https://zombit.info/%E5%88%B0%E5%BA%95%E4%BB%80%E9%BA%BC%E6%98%AFgas%E3%80%81gas-limit%E3%80%81gas-price%EF%BC%9F/)