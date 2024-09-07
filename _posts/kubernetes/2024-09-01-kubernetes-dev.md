---
title: Kubernetes 從零開始 - Local 開發測試好朋友 Skaffold
date: 2024-09-01
categories: [kubernetes]
description: 本文介紹如何使用 Skaffold 來簡化本地開發的流程
tags: [local development, yaml, skaffold, registry, container, local cluster, k3d]
math: true
---

# Development Obstacles in Kubernetes
不知道你有沒有這種感覺，Kubernetes 對本地開發來說真的挺不友善的(至少以我來說)\
除了你要架設一個本地的 Kubernetes Cluster 之外，還要不斷地手動更新 image

像我自己在寫後端的 API 的時候，往往需要不斷地測試程式碼，重新啟動 server\
配合前端，資料庫等等服務，驗證自己的程式碼的正確性\
雖然不像前端可以無腦的 `$ npm run dev` 自動更新，但這仍是屬於可以接受的範圍

換到 Kubernetes 之後，整件事情變得相對麻煩許多\
因為本質上是執行 container, 而 container 是 immutable 的，你不能隨意的更改\
變成你需要重新 build 一個 image，然後 push 到 registry，最後更新 deployment\
雖然如今不用推到 registry 也可以直接在本地使用，但這仍是一個很麻煩的事情

> registry 是一個儲存 container image 的地方，你可以把它想像成一個 docker hub

原因在 build image 以及將 image 同步到 local cluster 上面\
以 Golang 來說，`$ go mod download` 很花時間，我網路慢到不行，每一次的更新都要重複的花費這些時間\
同步進 cluster 也是相對耗費時間的一項事情\
更別說手動

> 為什麼不要直接跑 binary 在 local 就可以了？\
> 事情往往沒有那麼簡單老實說，當你的相依服務過多，env, config 一堆啦\
> 與其跑個什麼 docker-compose 自己設定\
> 你真的倒不如直接跑在 Kubernetes 上面，最少設定檔都幫你寫好了

# Skaffold
根據現有的狀況，我期待至少可以解決以下幾個問題
1. Kubernetes 能夠自動監控本地的程式碼，並且自動 build image
2. 簡化手動推送 image 到 registry 的流程

[Skaffold](https://skaffold.dev/) 就是一個能夠解決這些問題的工具

![](https://skaffold.dev/images/workflow_local.png)
> ref: [Architecture and Design](https://skaffold.dev/docs/design/)

## Skaffold Builder
在你初始化 Skaffold 專案的時候(`$ skaffold init`)，他會需要你選擇 builder\
這個 builder 會告訴 Skaffold 如何 build 你的 image\
有一些是需要 local build 的，那可以選擇 `Dockerfile`\
有一些則是現有的像是 `postgres`, `redis` 之類的

![](/assets/img/posts/skaffold.png)

## Disable Registry Push
Skaffold 預設是會將 image 推送到 registry 的\
大多數情況下，我們是不需要的\
可以在 `skaffold.yaml` 中加入以下設定
```yaml
build:
  local:
    push: false
```

就可以關閉

## Kube Context
像我自己平常在本地開發的時候是使用 k3d 來建立 local cluster\
平常會區分工作用的以及私人開發用的 cluster\
所以你的電腦上面就會有不同的 kube context

以我的電腦來說可以看到有三個，然後目前是使用 `k3d-views-k3d`

```shell
$ kubectl config get-contexts
CURRENT   NAME              CLUSTER           AUTHINFO                NAMESPACE
          k3d-k3s-default   k3d-k3s-default   admin@k3d-k3s-default   
*         k3d-views-k3d     k3d-views-k3d     admin@k3d-views-k3d     
          orbstack          orbstack          orbstack
```

> 切換 kube context `$ kubectl config use-context <context-name>`

Skaffold 可以設定使用的 kube context，這樣就不用每次都要切換

```yaml
deploy:
  kubeContext: k3d-views-k3d
```

# Example
```yaml
apiVersion: skaffold/v4beta11
kind: Config
metadata:
  name: count-page-views
build:
  local:
    push: false
  artifacts:
    - image: views-service
      docker:
        dockerfile: Dockerfile
manifests:
  rawYaml:
    - manifests/redis.yaml
    - manifests/views.yaml
deploy:
  kubeContext: k3d-views-k3d
```

以上就是一個簡單的 skaffold 的例子\
可以看到有兩個 yaml 檔，其中 `views.yaml` 使用的 views-service 的 image 是需要 build image 的所以寫在 build 區塊裡面\
manifests 裡面就是單純的 deployment, service 之類的 yaml 檔

完整的範例可以參考 [ambersun1234/count-page-views](https://github.com/ambersun1234/count-page-views)

# References
+ [管理多個 Kubernetes Cluster：建立、切換、合併 context](https://www.akiicat.com/2019/04/24/Kubernetes/setup-kubernetes-configuration/)
