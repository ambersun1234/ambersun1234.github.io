---
title: 從 0 認識 Blockchain - Hardhat 全攻略
date: 2023-04-20
categories: [blockchain]
tags: [blockchain, ethereum, hardhat]
math: true
---

# Introduction to Hardhat
![](https://user-images.githubusercontent.com/176499/96893278-ebc67580-1460-11eb-9530-d5df3a3d65d0.png)
> ref: [NomicFoundation/hardhat](https://github.com/NomicFoundation/hardhat)

Hardhat 作為開發 smart contract 最受歡迎的整合開發環境，認識 hardhat 如何使用是有必要的\
這篇文章當中，我會紀錄一路上我踩過的坑以及基本的 hardhat 使用

# How Hardhat Works
基本上要測試 smart contract, 無非就是將它 deploy 到所謂的測試網路上面(e.g. [Goerli](https://goerli.etherscan.io/), [Sepolia](https://sepolia.etherscan.io/))\
但是每一次的測試都要這樣做，除了浪費時間之外，也浪費資源\
hardhat 讓你可以在自己的電腦上跑一個 local blockchain, 測試以及部署都可以在本機完成，速度也比較快

> testnet 節點的執行仰賴著一群熱心腸的開發者們的電腦，我們不希望你將 *半成品* 上傳並測試\
> 使用 testnet 算是正式 release 到 mainnet 之前的手段

<hr>

hardhat 主要是透過 runner 來執行各項 task, 包含像是 compile, test, deploy 等等的\
除了內建的 functionality, 你可以透過安裝 plugin 擴充功能(e.g. [hardhat-contract-sizer](https://www.npmjs.com/package/hardhat-contract-sizer/v/2.5.1))

# Install Hardhat
```shell
$ yarn add --dev hardhat
```
再來使用
```shell
$ yarn hardhat
```
開啟一個新的 Hardhat 專案

## Command-line Completion
Hardhat 的指令基本上都圍繞著 `yarn hardhat xxx`(其中 xxx 為 task 的名字)\
每次都要打這麼多，可以安裝一個全域套件縮短名字
```shell
$ yarn global add hardhat-shorthand
```
之後你就可以使用 `hh` 代替 `yarn hardhat` 了

<hr>

另外一個套件，可以做到自動補全(列出所有可以執行的 task)
```shell
$ hardhat-completion install
```

![](https://hardhat.org/_next/image?url=%2Fhh.gif&w=1920&q=100)
> ref: [Command-line completion](https://hardhat.org/hardhat-runner/docs/guides/command-line-completion#command-line-completion)

# Hardhat Config
基本上，所有 Hardhat 相關的設定，都是寫在 `hardhat.config.ts`，檔案會寫在 project root\
而這裡除了定義 compiler version, private key 等等的，還有一個很重要的東西

所有需要用到的 plugin, 都要在這裡 import，否則它不會出現在 available task 裡面\
比如說你要用到 [solidity coverage](https://www.npmjs.com/package/solidity-coverage)\
在 `hardhat.config.ts` 當中必須要 `import "solidity-coverage";`

## Solidity
```typescript
const config: HardhatUserConfig = {
    solidity: "0.8.18"
}
export default config
```
solidity 的區塊，指定了需要使用的 compiler version, 以上述例子，是 `0.8.18`

如果需要使用到多種 compiler, 可以這樣指定
```typescript
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {version: "0.8.18"},
            {version: "0.6.6"}
        ]
    }
}
export default config
```
會需要用到多種 compiler 的情形是，你可能引用的 package 他的 compiler 定義可能比較舊\
多個 solidity 的檔案 source code 需要編譯的時候會用到這種寫法

## Network
前面提到，Hardhat 預設是使用你電腦上面的 local blockchain 執行測試以及部署的\
但是同時，它也支持與 testnet 互動，因此需要定義相關的設定資料

> Hardhat 預設是連接 local blockchain\
> 透過更改 `defaultNetwork: "sepolia"` 可以改變預設值

Hardhat 對於 testnet 的支援，僅有 **JSON-RPC based network**

```typescript
const config: HardhatUserConfig = {
    networks: {
        sepolia: {
            url: SEPOLIA_URL,
            accounts: [PRIVATE_KEY],
            chainId: 11155111,
            gasPrice: 5 * 1000000000
        }
    }
}
export default config
```

上述是 sepolia 測試網路的連接設定\
針對非 Hardhat 以外的設定，其中僅有 `url` 為必要的
+ `url`(required)
    + 透過第三方提供的 RPC node 用以連接整個 blockchain network，可以使用像是 [Alchemy](https://www.alchemy.com/) 或是 [Infura](https://infura.io/)
+ `accounts`
    + 因為是跟真實世界的 blockchain network 互動，所以你至少需要測試用的開發幣付交易費用(i.e. `sepoliaETH`), 因此你需要提供擁有 testnet ETH 的帳號供使用
    + 上述程式碼當中的 `PRIVATE_KEY` 即為你的帳號私鑰，注意到提供的時候，前綴 `0x` 需要移除，僅保留後面的私鑰部份

    > 私鑰的洩漏會極大的影響你的財產，擁有私鑰的人可以不經過你的同意將全部的 ETH 轉移出去\
    > 請務必不要將 private key 上傳到任何地方\
    > 開發使用可以考慮用 environment variable 的方式
+ `chainId`
    + 用以驗證 Hardhat 是否連接到對的網路
+ `gasPrice`
    + 手動指定 transaction 需要使用多少 gas price

這裡就列出幾個供參考，完整的 option 可以參考 [JSON-RPC based networks](https://hardhat.org/hardhat-runner/docs/config#json-rpc-based-networks)

## NamedAccounts
`namedAccounts` 是 [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) 的一個欄位\
我們可以透過設定 `namedAccounts` 將 wallet 帳號跟一個名字綁定在一起

前面 [Network](#network) 提到我們可以設定 accounts 欄位，用以提供擁有 testnet ETH 的帳號\
而如果使用預設 Hardhat network, Hardhat 會自己生成一個大小為 `20` 個假帳號們，每個假帳號用有 `1000 ETH` 可以使用

```typescript
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: {
            default: 0
        }
    }
}
export const config
```

上述我定義了一個名為 `deployer` 的名字，它對應到 accounts array 的第 0 個帳號

> accounts 就是上面講的陣列，它可以是預設 20 個假帳號陣列，也可以是你定義的陣列(如果 [Network](#network) 範例裡提到的)

更進階，你也可以針對不同網路，指定不同帳號
```typescript
const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: {
            default: 0,
            1: 0,
            // chainId 為 1(mainnet) 的時候，使用第 0 個帳號

            4: '0xA296a3d5F026953e17F472B497eC29a5631FB51B',
            // chainId 為 4(rinkeby) 的時候，使用這個帳號

            "goerli": '0x84b9514E013710b9dD0811c9Fe46b837a4A0d8E0',
            // network 名字為 goerli 的時候，使用這個帳號
            // 其中 network name 必須跟 config 裡面 networks.<name> 的 name 一樣
        }
    }
}
export const config
```

完整詳細 config 設定可以參考 [hardhat-deploy](https://www.npmjs.com/package/hardhat-deploy)

## Path
Hardhat 各項預設路徑分別為以下
+ `contracts`: 存放所有 smart contract 的實作
+ `deploy`: 預設 deploy script 位置
+ `test`: 預測測試 source code 位置

# Deploy
與 smart contract 互動的前提是，合約必須部署到區塊鏈上\
我們可以撰寫 deploy script 將部署的部份全部自動化

```typescript
const deployMarketPlace: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("Marketplace", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
};

deployMarketPlace.tags = ["marketplace"];

export default deployMarketPlace;
```

部署合約，你會需要
+ `deployer`: 簽署 transaction 的帳號
+ 合約本體

上述 deploy function 先從 `HardhatRuntimeEnvironment` 裡面拿到兩個東西，分別為部署用的 function 以及帳號\
利用 `getNamedAccounts` 可以拿到事先在 `hardhat.config.ts` 裡面定義的 `namedAccounts`\
透過語法糖，直接取出 deployer\
再來就是用 `deploy()` 直接上傳合約，from 定義為 deployer, 比較特別的是 waitConfirmations, 要等到區塊鏈上傳完畢，所以要等一個 block

> 透過設定 tag 你可以只 deploy 特定的 contract, 以這個例子就是 `hh deploy --tags marketplace`

<hr>

注意到，如果你有多個 contract 需要 deploy, 且 contract 具有相依性\
這時候 deploy 的順序就相當的重要了

考慮我的 NFT 練習專案，[ambersun1234/nft](https://github.com/ambersun1234/nft)\
其中 IpfsNFT 依賴於 VRFCoordinatorV2Mock, 也因此 mock 必須要比 IpfsNFT 還要早 deploy\
解法為 **調整 deploy script 的檔案順序**，只要將要先執行的 deploy script 擺在前面即可(可以透過調整 filename 改變檔案順序)

<hr>

deploy 到 testnet 也是用同一組 script, 什麼都不用改\
不過為了能將合約給紀錄下來，最終你會在 project root 這裡找到 `deployments` 的資料夾\
不同的 testnet 會歸類在不同的資料夾下(e.g. `deployments/sepolia`, `deployments/goerli`)\
這樣下一次再次使用 `hh deploy --network xxx` 的時候，它就會 reuse 已經 deploy 過得合約

> 其中 xxx 為你在 hardhat.config.ts 裡面定義的 network name(networks.\<name\>)

如果你希望上傳新的，必須帶上 `--reset` 的 flag, 這樣舊的合約紀錄就會從硬碟上刪除

# Test
測試的部份，可以透過 `--network` 參數指定要在哪個網路上測試，要注意的是，預設的情況下，`hh test` 會將所有測試檔案都執行一次\
你可以透過 `--grep` 的方式指定要跑哪些符合規則的測試\
比如說
```typescript
describe("marketplace", () => {
    beforeEach(() => {
        ...
    })

    it("Should initialize successfully", async () => {
        ...
    })
})
```
跑測試的時候可以這樣做
```shell
$ hh test --grep marketplace
```
符合規則的 function 會被執行，以這個例子 `describe("marketplace", () => {})` 會被執行

> 或者可以使用第三方 [mocha-tags](https://www.npmjs.com/package/mocha-tags)

為了要能夠在 hardhat network 下測試 smart contract, 必須要 deploy 到 local hardhat network\
又因為我們不希望測試互相干擾，就會希望每一次的測試都必須是乾淨的環境\
deploy 在 local hardhat network 耗費不高，速度也不會說很慢，但有沒有更好的作法？\
hardhat-deploy 提供了一個 feature, 我們可以將 deployment 進行快照(i.e. snapshot), 如此一來，便不用每次都重新 deploy, 僅需要重新使用 snapshot 即可

> 針對 testnet 上的測試，由於是跟真實世界的網路互動，就不用 snapshot 了

```typescript
beforeEach(async () => {
    deployer = (await getNamedAccounts())["deployer"];
    await deployments.fixture(["marketplace", "nft"]);

    marketplace = await ethers.getContract("Marketplace", deployer);
})
```
上述就是一個 fixture 的例子，使用 `beforeEach` function 在每一次執行測試的時候運行\
其中，`deployments.fixture` 裡面擺 `tag`, 在這個例子就是等待 `marketplace` 與 `nft` contract deploy 到 local hardhat network\
最後在使用 `getContract` 取得合約

testnet 的部份，由於我們已經儲存合約相關資料在 `deployments` 裡面了\
所以，這個合約已經在 blockchain 上面運作了，就不需要 fixture, 直接拿 contract 就可以了(如下所示)
```typescript
beforeEach(async () => {
    deployer = (await getNamedAccounts())["deployer"];

    marketplace = await ethers.getContract("Marketplace", deployer);
})
```

> 有關測試的細部討論，可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test)

# Task
我們執行的 `hh deploy`, `hh test`, 每一個都是 `task`, 而 Hardhat 也支援讓你自己寫 task

```typescript
// task/balance.ts

import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("balance", "Get balance from address")
    .addParam("address", "wallet address")
    .setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
        const ethers = hre.ethers;
        const balance = await ethers.provider.getBalance(args.address);

        console.log(args.address);
        console.log(balance.toString());
    });
```

透過宣告一個 task 建立一個新的 task\
task 可以吃 3 個參數
1. task 的名稱，用於呼叫(e.g. `hh balance`)
2. task 的 description
3. function 定義(也可以用 `setAction` 下去定義，看你高興)

另外你也可以額外定義 cli 參數，以這個例子來看，balance task 要求一個 `address` 的參數\
你可以用 `hh help balance` 查看該 task 的描述，其中會包含 parameter 的定義
```shell
$ hh help balance
Hardhat version 2.14.0

Usage: hardhat [GLOBAL OPTIONS] balance --address <STRING>

OPTIONS:

  --address     wallet address 

balance: Get balance from address

For global options help run: hardhat help
```

<hr>

```typescript
async (args: any, hre: HardhatRuntimeEnvironment) => {
    const ethers = hre.ethers;
    const balance = await ethers.provider.getBalance(args.address);

    console.log(args.address);
    console.log(balance.toString());
}
```

如果你要使用 ethers，一般都會 `import { ethers } from "hardhat"`, 但是 task 沒辦法這樣做因為 hardhat 需要初始化，還沒初始化完成就使用 instance 是辦不到的\
[@nomiclabs/hardhat-ethers](https://www.npmjs.com/package/@nomiclabs/hardhat-ethers) 套件會將 ethers object 注入 HardhatRuntimeEnvironment 讓我們可以取得並使用\
task function 的參數實作定義是有一定規則的，如以下所示
```typescript
(taskArgs: TaskArgumentsT, env: HardhatRuntimeEnvironment, runSuper: RunSuperFunction<TaskArgumentsT>)
```
不要亂調整參數順序，不然你 hre 印出來會是 undefined

> [@nomiclabs/hardhat-ethers](https://www.npmjs.com/package/@nomiclabs/hardhat-ethers) 擴充 [ethers](https://www.npmjs.com/package/ethers)\
> [hardhat-deploy-ethers](https://www.npmjs.com/package/hardhat-deploy-ethers) 擴充 [@nomiclabs/hardhat-ethers](https://www.npmjs.com/package/@nomiclabs/hardhat-ethers)

<hr>

最後要使用套件之前，必須將它在 `hardhat.config.ts` 中引入
```typescript
// hardhat.config.ts

import "./tasks/balance.ts"
```

使用起來會長這樣
```shell
$ hh balance --address xxx --network sepolia
xxx
yyyyy
```

# Hardhat Network
看到這裡想必你已經了解到 Hardhat 是運作在 local Hardhat network 之上的了\
每一次執行 test 都是使用 local Hardhat network\
但是每一次的執行，都是建立一個新的 network，用完即刪\
有時候我們希望可以重複利用它，或者說跟前後端一起開發的時候，總不希望 contract address 一直變動

透過手動建立一個持久 Hardhat network 可以幫助我們完成這件事情
```shell
$ hh node
```
上述指令會在你的電腦上面建立一個 node，而它不會被刪除，直到你手動中止\
同樣的 [hardhat-deploy](https://www.npmjs.com/package/hardhat-deploy) 也稍微的擴充了 `hh node`\
當你執行一個新的節點的時候，會執行所有的 deploy script, 自動的部署所有 contract\
你也可以用 `--tags` 只部署特定合約
```shell
$ hh node --tags marketplace
or
$ hh node --tags marketplace,nft
```

要讓你的 test script 能夠使用節點而不是額外建立新的，需要新增一個 network
```typescript
const config: HardhatUserConfig = {
    networks: {
        localhost: {
            url: "http:localhost:8545",
            chainId: 31337
        }
    }
}
export default config
```

並且於測試的時候，指定 network
```shell
$ hh test --network localhost
```

如果你需要與節點互動，可以使用 hardhat console 的功能，一樣別忘了要指定 network
```shell
$ hh console --network localhost
```

> console 也可以跟 testnet, mainnet 互動

## Network Forking
Hardhat 也可以複製 mainnet 或是 testnet 到你的電腦上，讓你的 local network 擁有 mainnet/testnet 的狀態\
當然，它並不是全部複製下來，只有部份的資料

```typescript
const config: HardhatUserConfig = {
    networks: {
        localhost: {
            url: "http:localhost:8545",
            chainId: 31337,
            forking: {
                url: ALCHEMY_RPC_URL
            }
        }
    }
}
export default config
```

或者是手動指定
```shell
$ hh node --fork ALCHEMY_RPC_URL
```

# Error: No Contract deployed with name
代表說 Hardhat 並沒有抓到 contract, 其原因是 deploy 順序的關係導致\
修改 deploy script 的順序即可抓到正確的 contract

詳細可參考 [Deploy](#deploy)

# TypeError: ethers.getContract is not a function
Hardhat plugin [hardhat-deploy-ethers](https://www.npmjs.com/package/hardhat-deploy-ethers) 在 `@nomiclabs/hardhat-ethers` 之上擴充了 ethers 的相關 functionality\
所以，單純的 `ethers.js` 並沒有一些功能如 `getContract`

為了能夠順利的在 Hardhat 當中使用 plugin 的擴充功能，需要將 `hardhat-deploy-ethers` 跟 `@nomiclabs/hardhat-ethers` 安裝在一起，這樣它才可以吃到全部的功能\
我們則需要借助 package alias 的功能全部安裝在一起\
簡言之
```shell
$ yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers
```

最終的 `package.json` 會長成這樣
```json
{
    "devDependencies": {
        ...

        "@nomiclabs/hardhat-ethers": "npm:hardhat-deploy-ethers"

        ...
    }
}
```
如此一來就解決問題了

# References
+ [Learn Blockchain, Solidity, and Full Stack Web3 Development with JavaScript – 32-Hour Course](https://www.youtube.com/watch?v=gyMwXuJrbJQ)
+ [Command-line completion](https://hardhat.org/hardhat-runner/docs/guides/command-line-completion#command-line-completion)
+ [What is the difference between getSigners and getNamedAccounts?](https://ethereum.stackexchange.com/questions/133583/what-is-the-difference-between-getsigners-and-getnamedaccounts)
+ [Install A NPM Package Under An Alias](https://www.dev-diaries.com/social-posts/install-npm-package-under-alias/)
+ [Hardhat deploy TypeError: ethers.getContract is not a function](https://ethereum.stackexchange.com/questions/139409/hardhat-deploy-typeerror-ethers-getcontract-is-not-a-function)
+ [How can I use hardhat.ethers inside a typescript task?](https://stackoverflow.com/questions/73223712/how-can-i-use-hardhat-ethers-inside-a-typescript-task)
+ [hardhat-ethers](https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ethers)
+ [Hardhat Runtime Environment (HRE)](https://hardhat.org/hardhat-runner/docs/advanced/hardhat-runtime-environment)
+ [Creating a task](https://hardhat.org/hardhat-runner/docs/advanced/create-task)
+ [Hardhat Network](https://hardhat.org/hardhat-network/docs/overview)
