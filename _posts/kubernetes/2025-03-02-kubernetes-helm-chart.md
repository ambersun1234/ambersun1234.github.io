---
title: Kubernetes 從零開始 - Deployment 管理救星 Helm Chart
date: 2025-03-02
categories: [kubernetes]
tags: [helm chart, kustomize, package manager, template, manifests, crd, crd upgrade, hooks, subchart, artifact hub, chart hook, pre-install hook, post-install hook, pre-upgrade hook, post-upgrade hook, pre-rollback hook, post-rollback hook, pre-uninstall hook, post-uninstall hook, test hook, hook lifecycle, hook weight, hook delete policy, publish chart, helm repository, oci, helm 3, helm release, helm install, helm list, helm upgrade, helm rollback, helm uninstall, helm test, helm dependency, helm dependency update, helm dependency build, oci-based registries]
description: 本文將介紹 Helm Chart 的結構以及如何使用 Helm 來管理 Kubernetes 的佈署，並且介紹 Helm Chart 的 Hooks 以及如何解決 CRD 升級的問題
math: true
---

# Preface
你應該有發現，Kubernetes 的佈署過程中你需要撰寫一定數量的 yaml 設定檔\
不外乎是 application 的 deployment, 設定檔的 configmap, secret 等等\
每次更新這些設定檔的時候，你都需要手動的去修改這些 yaml 檔案\
這樣的過程是非常繁瑣且容易出錯的

## Issue with Manifests in Kubernetes Deployment
更甚至，主流的佈署流程通常會有 dev, staging, production 三個環境\
每一個環境所需要的設定檔可能不盡相同，Manifests 的撰寫方式並沒有考慮到這一點\
導致你沒有辦法重複利用這些現有的設定檔

每一次的更新佈署都會耗費大量的精力與時間，顯然這是可以被改善的

# Introduction to Helm Chart
針對日益複雜的 application, 傳統的 Manifests 撰寫方式已經無法滿足需求\
Helm 提供了一個解決方案，讓你可以更有效率的管理你的 Kubernetes 佈署

具體來說他可以做到
1. 透過模板化的方式來管理你的 Kubernetes 設定檔
2. 重複利用你的，甚至不只你的設定檔
3. 一鍵佈署你的 application
4. 版本化控制你的 application

雖然它官方說明是一個 package manager\
但我覺的他的重點功能更著重在於模板化的設定檔

> 其實有點類似於 [Kustomize](https://kustomize.io/)\
> 但 Helm 提供了更多的功能，例如版本控制，依賴管理等等

Helm 是使用 Golang 撰寫而成的，其包含兩大組成元件
1. Helm Client :arrow_right: 我們使用的 CLI 工具
2. Helm Library :arrow_right: 抽象化了 Kubernetes API 的函式庫，負責底層的操作

## Installation
```shell
$ curl -fsSL -o get_helm.sh \
    https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
$ chmod 700 get_helm.sh
$ ./get_helm.sh
```

## What is a Chart?
Helm 本身還是會需要寫 yaml 設定檔，它並沒有丟棄 Manifests 的概念\
你的 application 通常會需要不只一個 Manifests, 如 deployment, service, configmap 等等\
這些設定檔會被打包成一個 Chart

前面說到的一鍵佈署，就可以透過 Chart 來實現
```shell
$ helm install my-release ./my-chart
```

安裝成功之後，它就稱之為 `Helm Release`

> 可以透過 `helm list` 來查看所有的 Release

### Subcharts
既然一個 application 可以以一個 Chart 來表示與管理\
它裡面可能也會包含其他的 application, 最簡單的例子就是 database\
這時候你就需要使用 Subcharts

Helm Chart 裡面你可以定義其他的 Chart 作為你應用程式的依賴(e.g. database, redis)\
而這些 Subcharts 同樣可以被管理與佈署(因為你可以指定特定版本)

Chart 本身是可以公開的\
它並沒有使用到任何的 source code, 只是一個打包好的設定檔\
你可以在 [Artifact Hub](https://artifacthub.io/) 上找到許多的 Chart

你也可以公開自己的 Chart, 讓他人可以使用(可參考 [Publish your Charts for Reusability](#publish-your-charts-for-reusability))

> 類似 GitHub Action 大家都會寫自己的 Action\
> 並且公開給他人使用

注意到 Artifact Hub 本身並不是 `Helm Repository`\
Repository 是 Chart 存放的地方，它可以包含很多的 Chart\
而 Artifact Hub 只是一個方便你找到 Chart 的地方

# Helm Chart Structure
一個 Chart 擁有特定的資料結構，具體來說長這樣
```
wordpress/
  Chart.yaml          # A YAML file containing information about the chart
  LICENSE             # OPTIONAL: A plain text file containing the license for the chart
  README.md           # OPTIONAL: A human-readable README file
  values.yaml         # The default configuration values for this chart
  values.schema.json  # OPTIONAL: A JSON Schema for imposing a structure on the values.yaml file
  charts/             # A directory containing any charts upon which this chart depends.
  crds/               # Custom Resource Definitions
  templates/          # A directory of templates that, when combined with values,
                      # will generate valid Kubernetes manifest files.
  templates/NOTES.txt # OPTIONAL: A plain text file containing short usage notes
```

需要定義的資料夾有
+ `templates`: 所有設定檔的模板(透過 `values.yaml` 來動態的設定數值)
+ `charts`: 依賴的 Chart 的檔案
    + 你可能會好奇，所有的依賴不都是定義於 `Chart.yaml` 裡面嗎？ 有點類似 node_modules 的概念，它需要把依賴下載下來 所以就放在這
+ `crds`: 所有 Custom Resource Definitions 的定義需要放在這

檔案的部份
+ `Chart.yaml`: 關於 Chart 的資訊(需不需要有 dependencies 以及其資訊)
+ `values.yaml`: 所有的設定檔的數值

## Subchart Declaration
```yaml
apiVersion: v2
name: count-page-views
version: 1.0.0
dependencies:
  - name: redis
    version: "20.6.2"
    repository: oci://registry-1.docker.io/bitnamicharts
```
subchart 的版本號你可以看他的定義 以這個例子來說會是 `20.6.2`\
可以在 Chart 的定義裡面找到 [bitnami/redis](https://github.com/bitnami/charts/blob/main/bitnami/redis/Chart.yaml)

> Helm 3 支援使用 OCI 的寫法，換言之你可以把 chart 放在類似 docker hub 這種地方\
> ref: [Use OCI-based registries](https://helm.sh/docs/topics/registries/)

### Overriding Values from a Parent Chart
當你使用 Subchart 的時候，你可以透過 `values.yaml` 來覆蓋 Subchart 的設定檔\
比方說以我的例子來說，我想要設定 redis replica 的數量\
根據 [bitnami/redis](https://github.com/bitnami/charts/tree/main/bitnami/redis) 可以找到是 `replica.replicaCount`\
然後你就可以

```yaml
redis:
  replica:
    replicaCount: 3
```

注意到這裡的 `redis` 是 subchart 的名字，也就是在 `dependencies` 裡面的名字\
所以在撰寫設定檔的時候你可以適當的將一些設定抽出來方便更換

<!-- ## Templates for Customization
TODO -->

# Helm Chart Upgrade CRD
Kubernetes 本身是支援 CRD Versioning 的，也就是說你可以升級 CRD(可參考 [Kubernetes 從零開始 - client-go 實操 CRD \| Shawn Hsu](../../kubernetes/kubernetes-crd))\
但是對於 Helm 來說就不是這麼一回事了

Helm 對於 CRD 的處理比較謹慎\
Helm 不允許升級或是刪除已經存在的 CRD\
即使你的 yaml 裡面包含了若干不同版本的資料，Helm 也不會去處理他們

主要是為了避免升級造成資料遺失的問題\
目前社群並沒有一個很好的解決方案，所以 Helm 把它擱置了

## Workarounds
CRD 主要會放在 `crds/` 資料夾裡面\
只要 Helm 主觀認定所有東西都已經被安裝之後，他就不會再去處理他們\
你也可以學 [kubernetes/kueue](https://github.com/kubernetes-sigs/kueue/blob/main/charts/kueue/templates/crd/kueue.x-k8s.io_admissionchecks.yaml) 他是擺在 templates 裡面\
如此一來每次安裝 Helm 都會處理到

> 注意到 Helm 並沒有禁止把 CRD 擺在 templates 裡面的寫法

但如果你是用 templates 的方法，會需要額外處理安裝順序的問題\
CRD 永遠會是最優先安裝的東西，因為要確保在裝 templates 的時候 CRD 已經存在\
寫在 templates 裡面等於說你自己要去處理他的生命週期(可參考 [Helm Chart Hooks](#helm-chart-hooks))

# Helm Chart Hooks
Helm Chart 提供了一個叫做 `Hooks` 的功能\
Hooks 可以在特定的事件發生時執行特定的操作\
比如說 `post-install`, `post-upgrade` 等等的

前面提到的 CRD 升級問題，如果是寫在 templates 裡面\
也可以考慮使用 `pre-install` hook 處理\
它可以保證，該 yaml 會在所有 templates 之前被安裝

## Hooks
Chart Hook 總共有 9 種 Hook ，其實可以大略分成 4 + 1 種\
分別對應到不同的 Helm 指令(`install`, `upgrade`, `rollback`, `uninstall`, `test`)

> `test` 只在 `$ helm test` 時執行\
> helm test 可以幫助你驗證你的 yaml 東西有沒有正確(渲染過後的 yaml)

每種 Hook 都有 `pre` 跟 `post` 兩種
+ `pre`: 在 **事件之前** 執行，比如說，安裝之前、升級之前
    + Helm 對於事件之前的定義是，當 templates 已經完全渲染完成但還沒安裝進去之前
+ `post`: 在 **事件之後** 執行，比如說，刪除之後、復原之後

## Hook Weight
範例可以參考 [Example](#example)

> hook-weight 是個字串

`hook-weight` 用來定義執行的順序，**數字越小越早執行**(可為負值)\
如果數字相同，會按照 `Resource Kind` 的順序(ASC)\
如果 `Resource Kind` 相同，會按照 `Resource Name` 的順序(ASC)

權重設計，依照慣例，通常會留有一定的空間\
比如說間隔 100 來設定，這樣可以確保你可以在中間插入其他的工作\
傳統的 Linux 的 init scripts 也是使用類似的方法(現已被 systemd 取代)

![](http://ithelp.ithome.com.tw/upload/images/20131008/2013100821432552540bfd1178c_resize.png)
> ref: [Linux Pi的奇幻旅程(16)-大改造(續)](https://ithelp.ithome.com.tw/articles/10135276)

透過檔案名稱排序，依序執行相對應的 script\
為了保有一定的彈性，每個權重之間不一定是緊密相連的\
允許你在之後安插不同的依賴，這樣就不需要調整權重

而這當然也會有問題，像是如果預留的空間仍然不足，手動調整空間還是必要的\
這也是傳統 [runlevel](https://en.wikipedia.org/wiki/Runlevel) 實作上的一個問題

## Lifecycle
Hook Lifecycle 其實相對簡單，以 `install` 為例

1. `$ helm install`
2. 呼叫內部 install API
3. 安裝 `crds/` 裡面的 CRD
4. 驗證以及渲染 `templates/` 裡面的 yaml
5. `pre-install` hook(並等待完成)
6. 正式安裝
7. `post-install` hook(並等待完成)
8. 完成

你可能會好奇要怎麼定義 Hook 已經被執行完成與否？\
針對 Job 或是 Pod 這類 resource 主要是判斷成功與否，其他資源則是寫進去就算完成

## Example
基本上 Hook 就是個 annotation 而已

```yaml
annotations:
  "helm.sh/hook": post-install,post-upgrade
  "helm.sh/hook-weight": "5"
  "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```

你可以在一個 yaml 裡面定義多個 Hook(用逗號分隔)\
`hook-weight` 用來定義執行的順序，可參考 [Hook Weight](#hook-weight)\
`hook-delete-policy` 用來定義 Hook 的刪除策略，有三種

+ `before-hook-creation`: 在新的 Hook 創建之前刪除先前的 Hook(預設)
+ `hook-succeeded`: 在 Hook 執行成功之後刪除
+ `hook-failed`: 在 Hook 執行失敗之後刪除

# Publish your Charts for Reusability
<!-- TODO -->
> to be continued

# References
+ [Kustomize K8S 原生的配置管理工具](https://weii.dev/kustomize/)
+ [Helm does not resolve local dependencies repository file path](https://stackoverflow.com/questions/74003216/helm-does-not-resolve-local-dependencies-repository-file-path)
+ [Charts](https://helm.sh/docs/topics/charts/)
+ [Overriding Values from a Parent Chart](https://helm.sh/docs/chart_template_guide/subcharts_and_globals/#overriding-values-from-a-parent-chart)
+ [What is the difference between fullnameOverride and nameOverride in Helm?](https://stackoverflow.com/questions/63838705/what-is-the-difference-between-fullnameoverride-and-nameoverride-in-helm)
+ [Insert multiline json string into helm template for base64 encoding](https://stackoverflow.com/questions/54152619/insert-multiline-json-string-into-helm-template-for-base64-encoding)
+ [Custom Resource Definitions](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/)
+ [Limitations on CRDs](https://helm.sh/docs/topics/charts/#limitations-on-crds)
+ [Chart Hooks](https://helm.sh/docs/topics/charts_hooks/)
+ [linux系统脚本启动顺序 /etc/rc.d/ 与/etc/rc.d/init.d](https://blog.csdn.net/u013921164/article/details/118176417)
