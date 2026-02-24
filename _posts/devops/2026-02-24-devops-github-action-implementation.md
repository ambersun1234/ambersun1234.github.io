---
title: DevOps - 實作你自己的 GitHub Actions
date: 2026-02-24
description: 本文將會介紹如何利用 Docker 以及 JavaScript 實作你自己的 GitHub Actions
categories: [devops]
tags: [github action, docker, javascript, composite action, action.yml, action.yaml, action, runner, context, secret, token, environment variable, github token, nektos/act]
math: true
---

# Implement Your Own GitHub Actions
定義一個客製化的 action 非常簡單，你只要指名 `輸入`, `輸出` 以及 `程式進入點` 就可以了\
而上述的資料必須寫在一個名為 `action.yml`(或 `action.yaml`) 當中就可以了

而 action 共有 3 大類

|Type|Docker container|JavaScript|Composite|
|:--|--:|--:|--:|
|Operating System|Linux|Linux<br>macOS<br>Windows|Linux<br>macOS<br>Windows|
|Speed|slow|fast|x|
|Customizable|yes|no|x|

+ [Docker Container Actions](#docker-container-actions)
    + Docker container actions 因為是跑在 Docker 之上，所以其高度客製化,並且也由於容器的特性使得他的執行速度相較於 JavaScript actions 還要來的慢(因為你要啟動 container), 並且 runner machine 只支援 linux 以及上面必須安裝 Docker
+ [Javascript Actions](#javascript-actions)
    + JavaScript actions 可以以原生的方式跑在 3 大系統上面，在要求限制上面明顯沒有這麼多，你只能使用 pure JavaScript 以及不得依賴任何 binary([actions/toolkit](https://github.com/actions/toolkit) 除外)
    + 如果要用其他第三方的 package, 你可以用 webpack 之類的工具全部打包在一起，就不會受到限制了
+ `Composite Actions`
    + Composite actions 是將多個 actions 合併成一個 actions, 他的目的最主要是減少 duplication 而已, 詳細可以參考 [GitHub Actions: Reduce duplication with action composition](https://github.blog/changelog/2021-08-25-github-actions-reduce-duplication-with-action-composition/)

## Action.yaml
{% raw %}
```yaml
# action.yml

name: 'Issue assign all collaborators'
description: 'Assign all collaborators to issues in repository'
author: 'ambersun1234'
inputs:
  owner:
    description: 'The owner of this repository'
    required: true
    default: ${{ github.repository_owner }}
  repository:
    description: 'The repo name of this repository'
    required: true
    default: ${{ github.repository }}
  issue_num:
    description: 'The issue number'
    required: true
    default: ${{ github.event.issue.number }}
  api_url:
    description: 'The GitHub REST API url'
    required: true
    default: ${{ github.api_url }}
  token:
    description: 'This is GitHub token'
    required: true

runs:
  using: 'docker'
  image: 'Dockerfile'

branding:
  icon: box
  color: yellow
```
{% endraw %}

上述是最基本的 action.yaml\
其中有幾個東西是必要的 `name`, `description` 以及 `runs`\
如果有需要也可以視情況新增 `inputs`, `outputs`, `branding`

+ `name`
    + 簡單，就是這個 action 的名字
+ `description`
    + action 的描述
+ `runs`
    + 最重要的一部分，它定義了你的這個 action 該如何執行
+ `inputs`
    + 定義輸入，可以有多個數值(e.g. `inputs.my_name`)
        + 而每個數值它裡面 **必須** 要有 `description` 以及 `required`, `default` 預設數值是可加可不加
    + 要如何在 JS runtime 或者是 docker container 裡面取得你的輸入呢？
        + GitHub Action 會對所有的輸入值建立對應的 ***環境變數***, 而他的形式是 `INPUT_<VARIABLE>`(以 `inputs.my_name` 來說，環境變數會變成 `INPUT_MY_NAME`)
        + 它會是全大寫且會將 *空格* 替換成 *底線*
+ `outputs`
    + 注意到這裡的 output **不是拿來當作 console log 用的**, 這裡的 output 是指將 action 輸出儲存下來，讓其他 step 可以透過 context 取得
        + 如果說你只是想要看它 log 到 console 那你其實用一般的 echo 就可以了
        + 既然他的 output 是傳到其他 action 使用，所以你的 action.yml 裡面要定義輸出(如下所示)
        {% raw %}
        ```yaml
        # action.yml

        inputs:
        my_name:
            description: 'This is my name'
            required: true
            default: 'Shawn Hsu'

        outputs:
        my_name_uppercase:
            description: 'This is my upper case name'
        ```
        {% endraw %}
+ `branding`
    + 如果你要上架你的 action, branding 的部份可以參考，他是定義你的 action 的圖示與顏色

## Docker Container Actions
一直以來我都是使用 GitHub issue 作為我部落格開發項目的紀錄\
而當我新增一個新 issue 的時候 我都希望它可以自己將 assignee 自動填入我的帳號\
所以 心動不如行動

`actions.yaml` 當中，如果是 docker container actions 的話，事情會有點不同，來看看吧
+ `runs`
    + `runs.using` :arrow_right: 只能是 `docker`
    + `runs.image` :arrow_right: 它可以是 `Dockerfile` 或是 public registry image(e.g. `docker://debian:stretch-slim`)
+ `inputs`
    + 注意到如果是使用 docker container, 事情會有一點不同，我們必須手動將環境變數傳入 container
        + 也就是你在寫 `runs` 的時候要多加 args, 整體的寫法就會是這樣
        {% raw %}
        ```yaml
        # action.yml

        inputs:
          my_name:
            description: 'This is my name'
            required: true
            default: 'Shawn Hsu'
        runs:
          using: 'docker'
          image: 'docker://debian:stretch-slim'
          args:
            - ${{ inputs.my_name }}
        ```
        {% endraw %}
        + 那麼他在環境變數的使用上跟上面一樣, 可參考 [Environments Variable](#environment-variables)
+ `outputs`
    + 為了使下一個 step 的 action 能夠取得上一層 action 的輸出，你在 Docker container 裡面的執行檔裡面要這樣寫
    {% raw %}
    ```shell
    my_name_uppercase='SHAWN HSU'
    echo "::set-output name=my_name_uppercase::${my_name_uppercase}"
    ```
    {% endraw %}
    + 最後在 workflow 裡面你就可以拿到從其他 step 裡面傳出來的輸出了
    {% raw %}
    ```yaml
    # workflow

    on: [push]

    jobs:
      issue-assign-all-collaborators:
        runs-on: ubuntu-latest
        name: Test on act
        steps:
          - name: Assign all collaborators
            uses: ./action.yml
            id: collaborators
          - name: Get collaborators
            run: echo "${{ steps.collaborators.outputs.owner}}"
    ```
    {% endraw %}
    + 因為你要拿到上一個步驟的 action 值，所以你需要透過特定 id 存取特定步驟(像上面就是標了一個 id collaborators)

> `docker://debian:stretch-slim` 對應到 [Docker hub](https://hub.docker.com/) 上面的 [debian:stretch-slim](https://hub.docker.com/layers/debian/library/debian/stretch-slim/images/sha256-6577292c6814280679f57727cf7fa0ff49328d95369c7e508a078dbbb5fc7d0f?context=explore)

詳細實作程式碼你可以在 [ambersun1234/issue-assign-all-collaborators](https://github.com/ambersun1234/issue-assign-all-collaborators) 中找到

## Javascript Actions
相比於 [Docker Container Actions](#docker-container-actions), javascript actions 在實作上面會稍微方便一點

+ `runs`
    + `runs.using` :arrow_right: 定義了你要用哪一個 runtime(可以是 `node12`, `node16`)
    + `runs.main` :arrow_right: 定義了程式進入點，要用哪一個檔案跑 action(e.g. `main.js`, 其內容為客製化)
+ `inputs` & `outputs`
    + 相較於使用 [Docker Container Actions](#docker-container-actions) 需要額外的動作傳遞參數，js 版本的完全不需要這樣做

接下來就看看 js 要怎麼寫吧
```js
import * as core from "@actions/core";
import * as cli from "@actions/exec";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

const packageManagerFileMap = new Map<string, string>([
    ["yarn", "yarn.lock"],
    ["npm", "package-lock.json"]
]);

const packageManagerCommandMap = new Map<string, string>([
    ["yarn", "yarn install"],
    ["npm", "npm install"]
]);

const packageManagerRunCommandMap = new Map<string, string>([
    ["yarn", "yarn"],
    ["npm", "npx"]
]);

const localNetwork = "hardhat";

const fileExists = (lockFileName: string): boolean => {
    return fs.existsSync(path.join(process.cwd(), lockFileName));
};

const main = async () => {
    const network = core.getInput("network");
    const privateKey =
        core.getInput("private_key") ||
        ethers.Wallet.createRandom().privateKey.slice(2);
    const rpcUrl = core.getInput("rpc_url");
    const networkArgs = ["--network", network];

    if (network !== localNetwork) {
        if (privateKey === "") {
            core.setFailed("Private key not found");
            return;
        }
        if (rpcUrl === "") {
            core.setFailed("RPC url not found");
            return;
        }
    }

    const content = `
        PRIVATE_KEY=${privateKey}
        ${network.toUpperCase()}_RPC_URL=${rpcUrl}
    `;
    fs.writeFileSync(path.join(process.cwd(), ".env"), content, { flag: "w" });

    for (let [packageManager, file] of packageManagerFileMap) {
        if (fileExists(file)) {
            await cli.exec(packageManagerCommandMap.get(packageManager)!);
            await cli.exec(
                `${packageManagerRunCommandMap.get(
                    packageManager
                )} hardhat test`,
                networkArgs
            );
            break;
        }
    }
};

main().catch((e) => {
    core.setFailed(e);
});
```
不要看細部實作的話，是滿好懂的\
定義一個 main function, 裡面透過 `@actions/core` 取得輸入，`@actions/exec` 執行指令\
重點就只是 `core.getInput()` 以及 `cli.exec()` 僅此而已\
當然你要設定輸出可以使用 `core.setOutput()`

詳細實作程式碼你可以在 [ambersun1234/hardhat-test-action](https://github.com/ambersun1234/hardhat-test-action) 中找到

# Test GitHub Action locally
測試 GitHub Action 是一個有點尷尬的問題\
開一個 repo 上去實測也..我覺的有點牛刀的感覺

[nektos/act](https://github.com/nektos/act) 是一款可以在本機測試 Action 的工具\
因此我們就不用大費周章的建立測試環境了

## Installation
```shell
$ wget https://raw.githubusercontent.com/nektos/act/master/install.sh
$ sudo bash install.sh
$ sudo mv bin/act /usr/bin
```

## Test
安裝好之後你可以直接進行測試
```shell
$ cd issue-assign-all-collaborators
$ act
[issue.yml/test] 🚀  Start image=ghcr.io/catthehacker/ubuntu:full-20.04
[issue.yml/test]   🐳  docker pull image=ghcr.io/catthehacker/ubuntu:full-20.04 platform= username= forcePull=false
[issue.yml/test]   🐳  docker create image=ghcr.io/catthehacker/ubuntu:full-20.04 platform= entrypoint=["/usr/bin/tail" "-f" "/dev/null"] cmd=[]
[issue.yml/test]   🐳  docker run image=ghcr.io/catthehacker/ubuntu:full-20.04 platform= entrypoint=["/usr/bin/tail" "-f" "/dev/null"] cmd=[]
[issue.yml/test]   🐳  docker exec cmd=[mkdir -m 0777 -p /var/run/act] user=root workdir=
[issue.yml/test] ⭐  Run Run issue assign all collaborators
[issue.yml/test]   ❌  Failure - Run issue assign all collaborators
[issue.yml/test] file does not exist
Error: Job 'test' failed
```

那尼？ 為什麼會這樣子呢？\
後來我改了一下 action run step 發現到，container 裡面完全沒有 action 資料
```shell
[issue.yml/test]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/0] user= workdir=
| total 8
| drwxr-xr-x 2 root root 4096 Apr  8 07:41 .
| drwxr-xr-x 3 root root 4096 Apr  8 07:41 ..
```

所以看起來是要 mount 或 copy 之類的，查找 README 果然有 `-b binding` 的參數(只不過它沒有特別標出來就是)\
在跑之前你也可以先確定 act 有沒有正確讀到 action
```shell
$ cd issue-assign-all-collaborators
$ act -l
Stage  Job ID                          Job name  Workflow name  Workflow file  Events
0      issue-assign-all-collaborators  test      issue.yml      issue.yml      push
$ act -b
```

跑下去之後發現 怎麼我改了 code 輸出沒改變呢？\
因為你要重新 build image, 可以使用 `--rebuild` 讓每一次都使用最新 image
```shell
$ cd issue-assign-all-collaborators
$ act -b --rebuild
```

如此一來，你就可以在本機測試了\
不過我後來發現阿，因為我是跑 shell script, 所以不用 act 好像也沒什麼差別笑死

詳細實作程式碼你可以在 [ambersun1234/issue-assign-all-collaborators](https://github.com/ambersun1234/issue-assign-all-collaborators) 中找到

# Continue on Error
基本上 workflow 的內容你都會希望他執行正確\
但有時候又不是這麼一回事

舉例來說，有一個 job 的內容是讓他背景執行一些東西\
由於 API limit 限制，他可能會失敗\
需要等到 request 的內容減量他才會成功\
所以這個是可以接受的

GitHub Action 提供了一個 `continue-on-error` 的參數\
基本上可以 bypass 掉上面的問題

```yaml
steps:
    ...
    - name: Create Search Index
    continue-on-error: true
```

在有可能會失敗的 step 的地方可以加上這個參數\
即使執行失敗，在 Action 裡面仍然視為成功並且會繼續執行下去

# Skip workflow
有時候你可能需要跳過 workflow，不管是出於不想跑測試或者是需要快速上版\
可以使用以下特殊指令

|First line commit message|Non-first line commit message|
|:--|:--|
|`[skip ci]`|`skip-checks:true`|
|`[ci skip]`|`skip-checks: true`|
|`[no ci]`||
|`[skip actions]`||
|`[actions skip]`||

舉個例子，commit message 可以這樣寫
```
[skip ci] Add integration test setup

Due to chainlink vrf callback gas set limit to low
Currently I couldn't test the code on chain
Disable integration test action at GitHub, re-enable it when fix the above issue
```
ref: [https://github.com/ambersun1234/nft/commit/95047600c90eb5d86e4cb8227f163c595ca45777](https://github.com/ambersun1234/nft/commit/95047600c90eb5d86e4cb8227f163c595ca45777)

<hr>

`skip-checks: true` 這種寫法必須在 commit message 保留兩行空白，接著 `skip-checks: true` 的指令\
我試了一下發現是不行的，不太確定哪裡有做錯

# How to speed up Docker Container Action
從上面的討論你應該可以很清楚的發現到\
因為 action.yml 裡面我們是定義 Dockerfile, 亦即每次都要跑 Docker build\
那有沒有加速的方法？ ㄟ它除了每次 build 的選項以外，你還可以指定 public registry image 阿

所以我有特地分別觀察了一下實際執行時間
+ 使用 Docker Build 耗時: `12 seconds`
+ 使用 pre build Docker image 耗時: `4 seconds`

***整整快了 3 倍阿***\
另外整體 duration time **提昇了約 66%**\
詳細的數據我沒有特別測試，但你可以在 [issue-assign-all-collaborators#9](https://github.com/ambersun1234/issue-assign-all-collaborators/actions/runs/2141104539) 與 [issue-assign-all-collaborators#10](https://github.com/ambersun1234/issue-assign-all-collaborators/actions/runs/2141236729) 找到相關數據