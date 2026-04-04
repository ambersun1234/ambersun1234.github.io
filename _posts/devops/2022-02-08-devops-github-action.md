---
title: DevOps - 從 GitHub Actions 初探 CI/CD
date: 2022-02-08
description: GitHub Actions 是一個可以讓你自動化 CI/CD 的服務，它可以讓你在特定事件發生時，自動執行一些任務，比如說測試、部屬等等。本文將會介紹 GitHub Actions 的基本觀念，並且會以實際的例子來說明如何使用
categories: [devops]
tags: [github action, ci, cd, docker, continuous delivery, continuous integration, workflow, event, job, action, runner, context, secret, token, environment variable, github token]
math: true
---

# CI/CD
`Continuous Integration - CI` 是現今軟體開發流程當中的一種 best practice\
開發的過程當中，我們有可能在實作中不小心改壞了一個東西，又剛好 QA 沒有測出來直上 production\
這時候出問題就比較麻煩了對吧？

於是乎持續整合的概念就被提出來\
我們可以透過某種方式在上版或是部屬到 production 上面之前先把我們的程式都完整的測試過一遍\
這樣 出錯的機率是不是就會小的很多了

通常 CI 裡面會搭配各種測試\
這些測試方法就讓我們拉出來獨立探討
> 可參考 \
> [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test)\
> [DevOps - 整合測試 Integration Test \| Shawn Hsu](../../devops/devops-integration-test)

而實務上來說 CI 就是負責執行以上的事物(包括但不限於 security check, code coverage, functional test and custom check)

`Continuous Deployment - CD` 持續部屬\
傳統的部屬方式是手動部屬到遠端伺服器上，而現在你也可以透過自動部屬的方式上 code

<hr>

透過自動化的 build code, test code 可以讓開發者更專注於專案開發

# GitHub Actions
跑 CI/CD 有兩種方式，一個是在 local 自己起一個 CI server，另一個 solution 就是使用線上平台諸如 [GitHub Actions](https://github.com/features/actions), [Travis CI](https://travis-ci.org/), [CircleCI](https://circleci.com/) 等等的

那我要怎麼樣 trigger CI 呢？\
GitHub Actions 有多種 event 可以選擇(e.g. `push code`, `new issue`, `schedule` ... etc.)
現在就讓我們來看看如何設定你的 GitHub Actions 吧

# GitHub Actions Component
當某個 event 被觸發的時候, CI 就會執行某項動作，但我要怎麼指定他要跑哪些東西呢？\
步驟、指令是由 [YAML](https://en.wikipedia.org/wiki/YAML) 檔撰寫而成，而裡面包含了若干 component

接下來就讓我們仔細的觀察每個 component 以及其關係圖\
![](https://miro.medium.com/max/2617/1*8mUtip6z_oydfLi4P86KUw.png)
> ref: [https://morioh.com/p/aadcfe6cac57](https://morioh.com/p/aadcfe6cac57)

## Workflow
觸發執行單元，裡面包含了若干執行步驟\
通常一個 repo 裡面可以有多個 workflow 分別對應到不同的場景(e.g. `build and test` 是一個, `deploy` 又是另外一個)\
每個 workflow 都由一個 yaml 檔定義詳細的步驟

## Events
觸發 workflow 的事件(e.g. `push code`)
```yaml
on:
  push:
    branches:
      - 'master'
```

完整 event 列表可以到 [Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) 查詢

## Jobs
裡面具體描述了該如何執行, 比如說 scripts 或是 actions\
一個 job 可以對應一個 runner(意思是多個 job 可以平行化處理在多個 runner 上)

假設你要跑一個 unit test\
但是，它可能會有一些前置步驟必須要做，jobs 裡面就是詳細定義這些 "步驟"\
比如說
1. git pull source code
2. 設定環境
3. 下載第三方套件(e.g. `$ go mod download`)
4. 跑測試

你可以看到，單單一個 unit test 的 job 需要做至少 4 個步驟\
必須要完成一個，下一個才會執行

## Actions
對於重複性 task(e.g. environment setup)\
你可以把它寫成 task 然後在 job 裡面調用

如同你在 [Jobs](#jobs) 裡面看到的範例一樣，我可以把其中一個 "步驟" 單獨的拉出來定義成 action\
這樣就可以重複利用，在別的 jobs 可以直接 reuse

如果你願意，甚至可以將 action 上架到 [GitHub Marketplace](https://github.com/marketplace?category=&query=&type=actions&verification=)\
比如說我的其中一個 action([Hardhat Test](https://github.com/marketplace/actions/hardhat-test))
![](/assets/img/posts/action.jpg)

> 上架到 marketplace 需要設定 branding 相關參數，你可以參考 [action.yaml](../../devops/devops-github-action-implementation#actionyaml)\
> 網路上也有人貼心的準備了一個 cheat sheet, 可參考 [GitHub Actions Branding Cheat Sheet](https://github.com/haya14busa/github-action-brandings)

## Runner
CI 伺服器，可以是 local 或是 remote 的\
GitHub Actions 提供了多種平台可以選擇(e.g. Linux, Windows 以及 macOS)

> 有關 local runner 的部分可以參考 [DevOps - 透過 Helm Chart 建立你自己的 GitHub Action Local Runner \| Shawn Hsu](../../devops/devops-ga-arc)

# Variables
## Environment Variables
{% raw %}
在 yaml 檔中你可以看到 `${{ xxx }}`\
他是代表你可以透過 context 使用所謂的環境變數\
一種方式是在 yaml 當中直接定義(如下所示)

```yaml
env:
  DAY_OF_WEEK: Monday

inputs:
  DAY:
    description: 'Specify the day of week'
    required: false
    default: ${{ env.DAY_OF_WEEK }}
```

另一種是使用 GitHub 提供的環境變數

|env|description|
|:--|:--|
|GITHUB_REPOSITORY_OWNER|repo owner's name, e.g. `ambersun1234`|
|GITHUB_REPOSITORY|owner 以及 repo name, e.g. `ambersun1234/AART`|
|GITHUB_REF|trigger action 的各種資訊，它可以是<br>`brach` :arrow_right: `refs/heads/<brach-name>`<br>`tags` :arrow_right: `ref/tags/<tag-name>`<br>`PR` :arrow_right: `refs/pull/<pr-number>/merge`<br>|

上面的環境變數在 context 裡面多半都有對應可以使用\
比方說 `GITHUB_REF` 與 `github.ref` 是等價的\
關於 github context 的 document 可以參考 [github context](https://docs.github.com/en/actions/learn-github-actions/contexts#github-context)

其他內建提供的環境變數內容可以參考官方文件 [Environment variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables)
{% endraw %}

## GitHub Secrets
Secrets 顧名思義就是機密的資訊\
什麼時候你會需要用到比較機密的資訊呢？

比方說你需要將 CI 完成的 docker image 推上 [docker hub](https://hub.docker.com/)\
聰明的你肯定發現，要上傳 image 需要做 authentication\
最爛的作法當然是把你的密碼明文貼在程式碼裡面 ( :x:\
所以這時候你就可以把密碼貼在所謂的 GitHub Secrets 裡面了\
詳細的設定方法可以參考 [Set up Secrets in GitHub Action workflows](https://github.com/Azure/actions-workflow-samples/blob/master/assets/create-secrets-for-GitHub-workflows.md)
> 每個 repo 擁有獨立的 secrets，目前沒有所謂的全局的 secrets

使用方式呢 一樣很簡單，語法跟 context 一樣
{% raw %}
```yaml
${{ secrets.<name> }}
```
{% endraw %}

<hr>

![](https://ithelp.ithome.com.tw/upload/images/20210914/20091494SJl4DjNiT4.png)
![](https://ithelp.ithome.com.tw/upload/images/20210914/20091494UDTGg8kAKn.png)
> ref: [GitHub Action YAML 撰寫技巧 - 環境變數(Environment Variables) 與 秘密 (Secrets)](https://ithelp.ithome.com.tw/articles/10263300)

{% raw %}
注意到 secrets 的名字的使用，從上圖你可以看到 GitHub web UI 呈現的會是 `全部大寫的`\
但是在你使用的時候，請記得一律是遵照 `建立的時候的大小寫`\
也就是使用 `${{ secrets.APISecret }}`
{% endraw %}

<hr>

如果你在跑 action 發現了 `Unrecognized named-value: 'secrets'`\
這邊要注意一件事\
secrets 這個 context 只能在 workflow 存取\
啥意思呢？

你在客製化 action 的時候會需要寫一份 `action.yml` 對吧\
你要用客製化的 action 需要在寫一份 workflow\
這兩個檔案是不同的，需要將它分清楚

***secrets context 只能寫在 workflow 裡面***(其他 context 可以在 action.yml 取得)\
寫在 action.yml 它會抓不到

### GitHub Token
{% raw %}
要特別注意的是一個特殊的 secrets - `GITHUB_TOKEN`\
這個是會**自動建立**的 secrets, 使用方法如上所示(`${{ secrets.GITHUB_TOKEN }}`)\
它可以 ***有限度的*** 存取 ***特定*** GitHub 資源\
比方說你想要有可以讀取或新增 Pull Request comment, 你可以透過 token 訪問 [GitHub REST API](https://docs.github.com/en/rest) 進行操作
> secrets.GITHUB_TOKEN 你可以把它當作 [Personal Access Token - PAT](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token), 他們的作用大致上相同
{% endraw %}

#### Token Lifecycle
基於 token 安全性著想，GitHub 自動生成的 token 並不會永久的存在\
token 是會 timeout 的，主要有兩個時間點
+ 當 action job 完成的時候就會刪除
+ 基於其他原因，token 最多也只能存活 **24 小時**

#### Token Permissions
你可以針對 repo 的 action 進行微調，基本上有三種模式(permissive, restricted 以及 fork)\
前兩者你可以在 repo settings 裡面調整(可以參考 [Setting the permissions of the GITHUB_TOKEN for your repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#setting-the-permissions-of-the-github_token-for-your-repository))，fork 是針對 fork 出去的 repo 做限制\
這邊列出幾個比較重要的權限(完整權限可以參考 [Permissions for the GITHUB_TOKEN](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads))

|scope|Default access(permissive)|Default access(restricted)|
|:--|:--|:--|
|actions|read/write|none|
|contents|read/write|read|
|issues|read/write|none|
|pull-requests|read/write|none|
|pages|read/write|none|

# Implementation
接下來就看看要怎麼實作，由於篇幅關係所以拉到 [DevOps - 實作你自己的 GitHub Actions \| Shawn Hsu](../../devops/devops-github-action-implementation) 裡面

# References
+ [Understanding GitHub Actions](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions)
+ [4 Steps to Creating a Custom GitHub Action](https://betterprogramming.pub/4-steps-to-creating-a-custom-github-action-d67c4cf0445a)
+ [nektos/act](https://github.com/nektos/act)
+ [Get pull request number from action](https://github.com/actions/checkout/issues/58)
+ [Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues)
+ [Environment variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables)
+ [About custom actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions)
+ [Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
+ [Setting an output parameter](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-output-parameter)
+ [jobs id](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsid)
+ [Automatic token authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
+ [Webhook events and payloads](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)
+ [Skipping workflow runs](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs)
