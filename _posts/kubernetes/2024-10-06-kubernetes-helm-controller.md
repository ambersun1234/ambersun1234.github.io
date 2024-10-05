---
title: Kubernetes 從零開始 - Helm Controller
date: 2024-10-06
categories: [kubernetes]
description: 本文介紹如何使用 Helm Controller 來管理 Helm chart，建立簡單的 Redis Helm Release 並且使用 kubectl patch 來更新並觀察 Helm Chart 的變化
tags: [helm chart, helm controller, crd, terratest, json patch patch, strategic merge patch, json patch, kubectl patch]
math: true
---

# Introduction to Helm Controller
如果你是使用 Helm chart 來管理你的 Kubernetes 資源\
一個常見的需求會是，你可能會需要更新你的 chart\
不管是 image version 還是一些設定檔的更新

當然你可以手動 `$ helm upgrade` 來更新你的 chart\
不過官方有提供一個更好的方式，就是使用 Helm Controller

Helm Controller 允許你用 declarative 的方式來管理 Helm chart\
並且主動監控任何 CRD(Custom Resource Definition) 的變化\
因此你只需要透過更新 CRD 告訴他你想要的狀態，Helm Controller 會自己去更新相對應的 chart

# Use Helm Controller
[k3d](https://k3d.io/v5.7.4/)(i.e. k3s) 預設就已經安裝了 Helm Controller 以及相對應的 CRD\
所以不需要特別安裝就可以直接使用

> `HelmChart` 以及 `HelmChartConfig` 這兩個 CRD 可以用 `$ kubectl get crd` 來查看

如果是其他的 Kubernetes cluster，可以參考 [k3s-io/helm-controller](https://github.com/k3s-io/helm-controller/blob/master/manifests/deploy-cluster-scoped.yaml) 給的設定檔進行操作

> 本文會使用 [k3s-io/helm-controller](https://github.com/k3s-io/helm-controller)\
> 網路上也有其他的 Helm Controller 實作，例如 [fluxcd/helm-controller](https://github.com/fluxcd/helm-controller)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: helm-controller
  labels:
    app: helm-controller
spec:
  replicas: 1
  selector:
    matchLabels:
      app: helm-controller
  template:
    metadata:
      labels:
        app: helm-controller
    spec:
      containers:
        - name: helm-controller
          image: rancher/helm-controller:v0.12.1
          command: ["helm-controller"]
```

# Patching Helm Chart
## Install Redis Helm Chart
以 bitnami/redis 為例，透過 HelmChart CRD 建立 Custom Resource(CR)

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: myredis
  namespace: default
spec:
  repo: https://charts.bitnami.com/bitnami
  chart: redis
  set:
    replica.replicaCount: 5
```

以上就是一個基本的 Custom Resource 定義\
我在 `default` namespace 底下要建立一個名為 `myredis` 的 HelmChart Release\
並且使用 `https://charts.bitnami.com/bitnami` 的 `redis` chart

因為第三方的 Helm Chart 通常允許你更改一些參數\
這裡我們想要覆蓋 `replica.replicaCount`, 設定成 5 個 replica

> 參數的部份，是對應到 [bitnami/redis/values.yaml](https://github.com/bitnami/charts/blob/main/bitnami/redis/README.md) 的設定值

安裝完成你應該會看到類似以下的結果

```
NAME            NAMESPACE       REVISION        UPDATED                                 STATUS          CHART                           APP VERSION
myredis         default         1               2024-10-05 20:40:39.93388077 +0800 CST  deployed        redis-20.1.7                    7.4.1      
```

## Kubectl Patch
所以到現在我們成功的建立了一個 HelmChart Release\
假設我想要再次更新 replica 的數量，我們可以就透過 `$ kubectl patch` 來達成

前面說過，Helm Controller 會監控 CRD 的變化，所以我們可以透過更改 CR 觸發 Helm Controller 來更新 Helm Chart

patch 有三種方式，`strategic merge patch`, [JSON merge patch](#json-merge-patch) 以及 [JSON patch](#json-patch)

> strategic merge patch 沒辦法用於 HelmChart CRD

### JSON Merge Patch
JSON Merge Patch 定義於 [RFC 7386](https://datatracker.ietf.org/doc/html/rfc7386)\
稱之為 merge patch 是因為它是將 patch 的內容合併到原本的資料上\
也就是說原本不存在的會被新增，已經存在的會被更新，給 null 則會被刪除

```yaml
spec:
  set:
    replica.replicaCount: 10
```

以上就是一個簡單的 JSON Merge Patch\
然後透過 kubectl patch 執行

```shell
$ kubectl patch HelmChart myredis --type merge --patch-file ./patch.yaml
```

你可以檢查看他有沒有正確的更新成功
```shell
$ kubectl get HelmChart myredis -o yaml
...
spec:
  chart: redis
  repo: https://charts.bitnami.com/bitnami
  set:
    replica.replicaCount: 10
status:
  jobName: helm-install-myredis
```

### JSON Patch
JSON patch 定義於 [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902)\
跟 [JSON Merge Patch](#json-merge-patch) 類似，只是說你要指定 patch 的操作

JSON patch 是一個 array, 每個 object 包含 `op`, `path`, `value`\
操作識別符號透過 `op` 來指定，比方說你要新增還是刪除\
`path` 這個欄位的資料要特別注意的是，每個路徑是使用 `/` 進行分割的\
以 myredis 為例，`spec.set.replica.replicaCount` 這個路徑就是 `/spec/set/replica.replicaCount`

為什麼 `relica.replicaCount` 這個路徑是使用 `.` 分割，而不是 `/` 呢？\
因為他是一個 key 而不是一個路徑

所以寫起來會長這樣
```yaml
[
  {
    "op": "replace",
    "path": "/spec/set/replica.replicaCount",
    "value": 10
  }
]
```

然後

```shell
$ kubectl patch HelmChart myredis --type json --patch-file ./patch.json
```

如果你仔細去看它的 log, 你會發現它其實就真的只是做了 `$ helm upgrade`
```
+ helm_v3 upgrade --set replica.replicaCount=10 myredis myredis/redis
```

# References
+ [k3s helm](https://docs.k3s.io/helm)
+ [Create a Simple Kubernetes Custom Resource and CRD with kubectl](https://able8.medium.com/create-a-simple-kubernetes-custom-resource-and-crd-with-kubectl-f2a73e166f5d)
+ [WIll "helm upgrade" restart PODS even if they are not affected by upgrade?](https://stackoverflow.com/questions/58602311/will-helm-upgrade-restart-pods-even-if-they-are-not-affected-by-upgrade)
