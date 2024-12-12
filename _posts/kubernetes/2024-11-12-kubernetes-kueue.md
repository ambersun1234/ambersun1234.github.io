---
title: Kubernetes 從零開始 - 資源排隊神器 Kueue
date: 2024-11-12
categories: [kubernetes]
tags: [job, queue, kueue, resource, scheduling, taints, toleration, affinity, taskset]
description: 針對有限的硬體資源，為了避免過度使用造成分配不均以及效能低落，Kueue 這個工具提供了一個排隊機制，所有資源被集中管理並統一分配，使得所有 Job 都能免於 starving 的狀況。本文將會介紹 Kueue 的基本概念以及如何使用它
math: true
---

# Introduction to Kueue
你可以在 Kubernetes 裡面塞入任一數量的 job，但這只是理論上\
實務上會因為硬體資源的限制，你只可以執行有限數量的 job\
`Kueue` 這個工具可以根據這些 `限制`，允許有限數量的 job 同時執行\
它可以做到一些基礎的排程機制，如
1. Job 要不要等待，可不可以開始執行(i.e. 排隊)
2. Job 該不該被搶佔(i.e. preemption)

Kueue 保證了所有 Job 對於資源的使用是公平的\
並且可以根據偏好的資源進行分配，如 CPU, Memory, GPU 等等

而既然音同 `Queue`，那麼它的核心概念就是 `Queue`\
Kueue 本身有兩種策略
+ `StrictFiFo`: 先進先出，並且是 `阻塞的`(如果當前 Job 沒辦法被排程，它會卡在那擋到後面的人)
+ `BestEffort`: 先進先出，但 `不是阻塞的`(如果當前 Job 沒辦法被排程，它會讓位)

> 其實 Kueue 本身是 priority queue\
> 它會根據 1. `priority` 2. `creation time` 來決定順序

## Installation
```bash
$ kubectl apply --server-side -f https://github.com/kubernetes-sigs/kueue/releases/download/v0.9.0/manifests.yaml
```

或者是用 Helm
```bash
$ helm install kueue oci://us-central1-docker.pkg.dev/k8s-staging-images/charts/kueue \
  --version="v0.9.1" \
  --create-namespace \
  --namespace=kueue-system
```

# Affinity
`Affinity` 指的是親和力，在計算機裡面通常指 CPU 的親和力\
由於 CPU 會 context switch, 同一個 process 可能會被排程到不同的 CPU 核心上執行\
而這對於效能而言是不好的，因為 CPU cache 會被清空，所以 CPU 會重新從記憶體中讀取資料\
導致效能低落

你可以透過 [taskset](https://man7.org/linux/man-pages/man1/taskset.1.html) 指令將 process 綁定到特定的 CPU 核心上\
操作起來長這樣
```bash
$ taskset 0x1 ./hello_world
```

> 在做 benchmark 的時候，taskset 很好用\
> 因為你可以減少變因，使得你的 benchmark 更加準確

在 Kubernetes 裡面，`Affinity` 通常指的是 Pod 與 Node 之間的親和力(i.e. [Node Affinity](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#node-affinity))\
application 會希望擁有某些特定的資源\
如節點本身的 cache 抑或是節點的位置等等的\
你當然可以依據自己的偏好要將你的服務執行在某些節點上\
比如說，考量到地理位置，你會希望服務運行在美國的節點上(因為它可以有較低的 latency)

<hr>

`Taints` 則是 Node 與 Pod 之間的 ***排斥性***\
舉例來說，以下的指令會將 `node1` 標記為 `maintain`，並且不允許有任何的 Pod 在上面執行

```bash
$ kubectl taint nodes node1 maintain=true:NoSchedule
```

> effect 欄位共有 `NoSchedule`, `PreferNoSchedule`, `NoExecute` 三種

Taints 是由一個類似 map 的結構表示\
你可以在一個節點上標記上多個 taints，表示這個節點上有多個限制\
唯有可以 **容忍這些限制** 的 Pod 才能夠在這個節點上執行

> 換言之，只要節點上有任何限制，預設情況下 Pod 都會盡量避開這些節點

<hr>

`Toleration` 則是 Pod 與 Node 之間的 ***容忍性***\
我可以容忍某些節點上有某些限制的時候，就可以使用 `Toleration`\
比方說我可以容忍節點正在維護，因此我的 Pod 還是可以被排程到這個節點上，然後執行

下方的 nginx 仍然可以被排程到有 `maintain` taint 的節點上執行

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    env: test
spec:
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
  tolerations:
  - key: "maintain"
    operator: "Exists"
    effect: "NoSchedule"
```

# Kueue Architecture
![](https://kueue.sigs.k8s.io/images/cluster-queue.svg)
> ref: [Cluster Queue](https://kueue.sigs.k8s.io/docs/concepts/cluster_queue/)

所謂的資源管理到底是怎麼個管理法\
Kueue 具現化你所擁有的資源，比如說你總共有多少 CPU 多少 Memory\
定義清楚之後，每一個 Job 都會從中取得資源，並且執行

你所擁有的資源都將儲存在 [Cluster Queue](#cluster-queue) 裡面\
同一個類型的 Cluster Queue 會組成一個抽象的資源群組([Cohort](#cohort))

當一個新的 Job 等待資源的時候，[Local Queue](#local-queue) 會向 [Cluster Queue](#cluster-queue) 請求資源\
並根據 [Resource Flavor](#resource-flavor) 的設定，將資源分配給 Job\
就可以執行，結束之後釋放資源

![](https://kueue.sigs.k8s.io/images/queueing-components.svg)
> ref: [Run A Kubernetes Job](https://kueue.sigs.k8s.io/docs/tasks/run/jobs/)

## Kueue Workload
雖然我們一直提 Job, 但實際上 Kueue 是管理所謂的 `Workload`\
Workload 可以把它想像成是 "一件事情"，所以最直接的例子就是 Kubernetes Job\
它可以是 Kubernetes 的 Job, CronJob, StatefulSet, Deployment 等等的資源

本文還是就 Kubernetes Job 進行說明與操作

> Deployment 以及 StatefulSet，Kueue 是透過 `pod integration` 來達成的\
> 可參考 [Run Plain Pods](https://kueue.sigs.k8s.io/docs/tasks/run/plain_pods/)

## Resource Flavor
這裡的 Flavor 就是上面提到的 `偏好`\
但對於 CPU, Memory 等等的設定並不是在這裡做的\
所以本質上 Flavor 管理的跟原生 Kubernetes 是一致的(`Taints` 以及 `Toleration`, 可參考 [Affinity](#affinity))

為了能夠順利的使用 Kueue, 預設情況下還是要有一個 `default-flavor`(如下所示)

```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: ResourceFlavor
metadata:
  name: default-flavor
```

## Cohort
你可以透過 label 定義 cohort 的隸屬關係\
比如說 `john` 以及 `alice` 都是 `research-team` 的一部分

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: john
  labels:
    research-cohort: research-team

---

apiVersion: v1
kind: Namespace
metadata:
  name: alice
  labels:
    research-cohort: research-team
```

那麼，`john` 以及 `alice` 就會共享同一個 Cohort\
也就可以存取特定 research-team 底下的 [Cluster Queue](#cluster-queue)

## Cluster Queue
```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: cluster-q
spec:
  namespaceSelector:
    matchLabels:
        kubernetes.io/metadata.name: research-team
  resourceGroups:
  - coveredResources: ["jobs"]
    flavors:
    - name: "default-flavor"
      resources:
      - name: "jobs"
        nominalQuota: 5
    - name: "maintain-flavor"
        resources:
        - name: "jobs"
        nominalQuota: 1
        # borrowingLimit: 1
        # lendingLimit: 1
```

> 這個 Cluster Queue 只允許 `research-team` 存取\
> `namespaceSelector: {}` 代表所有的 namespace 都可以存取

上述定義了一個簡單的 Cluster Queue\
我可以允許有 1 個 job 可以在 `maintain-flavor` 的資源上執行\
但大多數還是希望可以在 `default-flavor` 上執行，而它可以有 5 個 Job 同時執行

而前面也提到，Cluster Queue 可以不只有一個\
所以你可以根據業務邏輯，拆分多種資源群組\
但有時候 Cluster Queue 上的資源真的不夠，你可以有條件的向其他 Cluster Queue 請求資源
+ `borrowingLimit`: 最多拿別人多少資源
+ `lendingLimit`: 最多借給別人多少資源

> 只有相同 [Cohort](#cohort) 的 Cluster Queue 才能夠互相借用資源

## Local Queue
```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  namespace: default
  name: local-q
spec:
  clusterQueue: cluster-q
```

Local Queue 會指向一個 [Cluster Queue](#cluster-queue)\
並且像它請求資源

Local Queue 本身是 per namespace 的設計\
屬於該 namespace 下的 Job 會提交到 Local Queue

# Run
要執行 kueue, 你需要將 [Cluster Queue](#Cluster-Queue), [Local Queue](#Local-Queue) 與 [Resource Flavor](#resource-flavor) 部署到你的 cluster 上(缺一不可)\
然後透過以下的範例 Job 觀察排隊的行為

你會需要加兩個設定
1. Job metadata 裡面需要新增 `kueue.x-k8s.io/queue-name` 的 label, 它需要指定到你的 [Local Queue](#local-queue) 的名稱
2. 將 Job 預設的狀態設定成 `suspend`

為什麼要 suspend Job 呢？\
原因也是很簡單，因為我們要讓 Kueue 控制 Job 的執行\
如果你直接讓它執行不就沒用了\
因此，所有要使用 Kueue 的 Job 預設都要讓它暫停\
把控制權交給 Kueue 進行處理

這裡使用 `completions` 紀錄我們要有 10 個 Job 成功的次數\
而 `parallelism` 則是同時執行的 Job 數量\
根據上述 [Cluster Queue](#cluster-queue) 的設定，同一時間只能有 1 個 Job 在執行\
又因為同時可以有 2 個 Job 在執行，所以整個完成預計要 (10 / 2) * 30s = `150s`

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: kjob
  labels:
    kueue.x-k8s.io/queue-name: local-q
spec:
  parallelism: 2
  completions: 10
  suspend: true
  template:
    spec:
      containers:
        - name: dummy-job
          image: gcr.io/k8s-staging-perf-tests/sleep:v0.1.0
          args: ["30s"]
      restartPolicy: Never
```

## Internal error occurred: failed calling webhook "mresourceflavor.kb.io": failed to call webhook
如果你在 apply Kueue 的設定檔的時候碰到類似以下的錯誤

```
Error from server (InternalError): error when creating "mykueue.yaml": 
Internal error occurred: failed calling webhook "mresourceflavor.kb.io": 
failed to call webhook: 
Post "https://kueue-webhook-service.mynamespace.svc:443/mutate-kueue-x-k8s-io-v1beta1-resourceflavor?timeout=10s":
no endpoints available for service "kueue-webhook-service"
```

這是因為 Kueue 的 webhook service 還沒有起來\
稍微的等它一下就可以了

# References
+ [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
+ [Processor affinity](https://en.wikipedia.org/wiki/Processor_affinity)
+ [Run Plain Pods](https://kueue.sigs.k8s.io/docs/tasks/run/plain_pods/)
