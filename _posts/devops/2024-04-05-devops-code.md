---
title: DevOps - 成就完美的自動化 IaC 與 CaC
date: 2024-04-05
description: 現今軟體開發的過程都是由設定檔來管理的, 我們已經無意中接觸過 IaC 與 CaC 的概念很多次了。本篇文章將會從頭理解一次他們的概念
categories: [devops]
tags: [infrastructure as code, configuration as code, iac, cac, pm2]
math: true
---

# Infrastructure
當軟體開發完成之後，Infra 對於整體運作來說是很重要的\
沒有基礎設施，如網路，電腦以及儲存空間，我們將沒辦法提供服務

如今已經有非常成熟的 cloud provider 如 [AWS](https://aws.amazon.com/tw/)\
某種程度上解決了基礎建設的難處\
透過簡易的 UI 設定機器大小，網路等等 我們可以將大多數精力放在軟體開發上面了

不過這些操作都是手動處理居多，也是很麻煩的\
更不用說你可能手殘設定錯誤，導致系統中斷服務(這並不是沒有發生過的)\
因此我們可以將這些操作自動化以及一些設定來幫助我們\
也就是 `IaC - Infrastructure as Code`

# Programming Approach
## Declarative Approach
透過撰寫所需要的系統組態設定的檔案，這樣的檔案就稱為宣告式

## Imperative Approach
詳細描述具體實作步驟細節，即為命令式

# Introduction to IaC - Infrastructure as Code
IaC 是個概念，而這個概念可能你我都已經接觸過不少次了\
舉個簡單的 [docker-compose](https://docs.docker.com/compose/) 的例子

```yaml
version: "3.9"

services:
  web:
    build: .
    deploy:
      replicas: 5
      restart_policy:
        condition: on-failure

  nginx:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - web
```

docker compose 這個 yaml 裡面定義了你的服務的基本組態設定\
我們定義了兩個 service(web 以及 nginx)\
包含了他的 replica, port, volume 以及連接方式等等的設定

這其實就是 Infrastructure as Code 的概念\
想想看哦，是不是擁有了這個組態設定檔，給我一台電腦，我都能完美複製 **一模一樣** 的環境出來？\
那 as Code 是什麼意思呢？\
我們是不是可以將 docker-compose.yaml 的組態設定用上版本控制，那某種程度上它也是一種程式碼了吧

## IaC Definition
根據 [什麼是基礎設施即程式碼？](https://aws.amazon.com/tw/what-is/iac/) 所述

> 就像軟體程式碼描述應用程式及其運作方式，基礎設施即程式碼 (IaC) 描述系統架構及其運作方式

通常具有以下性質的特性，就可以被稱為是 IaC
1. 可以自動化(code-driven configuration)
2. 可以被版本控制
3. [宣告式](#declarative-approach) 描述系統組態設定
4. 專注在硬體層面

## Why IaC
透過自動化的方式建立環境可以帶來一些好處

既然他是自動化的，也就意味著它出錯的機率會大幅度的降低\
每次部屬到新的環境的時候，如果漏掉了一個設定，就可能會釀成大錯\
人為疏失一直是軟體開發的常態問題，透過自動化能夠解決是在好不過得了

並且，因為我們是透過設定檔的方式建立環境\
這樣可以很輕鬆的在不同的地區建立相同的環境

# Introduction to CaC - Configuration as Code
同樣的概念套到 Configuration as Code 就很好理解了\
像我自己平常寫專案會是使用 `.env` 的方式來設定環境\
而通常我會給一個 `.env.example` 的檔案來作為範例\
只要複製這個檔案就可以成功套用預設的設定檔了\
這其實某種程度上來說就是 Configuration as Code

當然，我的作法跟 CaC 的定義有些許落差，不過我相信你有 get 到這個概念

## CaC Definition
相比 [IaC Definition](#iac-definition) 主要描述硬體層面的細節\
CaC 則是專注在描述軟體層面的細節

而定義方面也大同小異

1. 可以自動化(code-driven configuration)
2. 可以被版本控制
3. [宣告式](#declarative-approach) 描述軟體層面的組態設定
4. 專注在軟體層面的細節

## Node.js [PM2](https://pm2.keymetrics.io/)
我公司的服務，是用 [PM2](https://pm2.keymetrics.io/) 這個服務帶起來的\
而 PM2 的設定檔 ecosystem.config.js 裡面可以包含預設的設定

我們將一些常用的設定放在這個檔案中\
像是 timeout, worker node ... etc.\
並且在這個檔案中可以設定不同的環境所需要的設定

所以它本質上是符合 CaC 的概念的

## How about Secrets?
CaC 是將 configuration 以程式碼的形式儲存在版控之中\
但是我們知道密碼這類隱私的東西是萬萬不可上傳的\
那麼要如何 "as code" 呢？

一個方式是是用 environment variable, 像是 [etcd](https://etcd.io/)\
在應用程式中讀取這個 environment variable 就可以了

# References
+ [什麼是基礎設施即程式碼？](https://aws.amazon.com/tw/what-is/iac/)
