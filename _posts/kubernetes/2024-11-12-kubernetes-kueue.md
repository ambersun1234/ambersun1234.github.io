---
title: Kubernetes 從零開始 - 資源排隊調度神器 Kueue
date: 2024-11-12
categories: [kubernetes]
tags: [job, queue, kueue, resource, scheduling, kubectl wait, cluster queue, local queue, resource flavor, cohort, starvation]
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
  --version=0.9.1 \
  --create-namespace \
  --namespace=kueue-system
```

> 注意到如果是用 OCI，你在指定版本的時候記得不能加 prefix `v` 不然會報錯\
> [Error pulling latest chart from OCI registry if semver version has a v prefix #11107](https://github.com/helm/helm/issues/11107)

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
比方說你的任務需要有 GPU，你可以定義一個 `gpu-flavor`\
為了能夠順利的使用 Kueue, 預設情況下還是要有一個 `default-flavor`(如下所示)

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ResourceFlavor
metadata:
  name: default-flavor
```

## Cluster Queue
```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: cluster-q
spec:
  cohortName: "research-team"
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

> 這個 Cluster Queue 屬於 `research-team` cohort 底下

上述定義了一個簡單的 Cluster Queue\
我可以允許有 1 個 job 可以在 `maintain-flavor` 的資源上執行\
但大多數還是希望可以在 `default-flavor` 上執行，而它可以有 5 個 Job 同時執行

而前面也提到，Cluster Queue 可以不只有一個\
所以你可以根據業務邏輯，拆分多種資源群組\
但有時候 Cluster Queue 上的資源真的不夠，你可以有條件的向其他 Cluster Queue 請求資源
+ `borrowingLimit`: 最多拿別人多少資源
+ `lendingLimit`: 最多借給別人多少資源

> 只有相同 [Cohort](#cohort) 的 Cluster Queue 才能夠互相借用資源

## Cohort
Cohort 是用來組織你的 Quota 的\
好處是擁有相同 cohort 的 [Cluster Queue](#cluster-queue) 可以共享 quota

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: Cohort
metadata:
  name: "research-team"
```

然後你的 [Cluster Queue](#cluster-queue) 定義是這樣子的

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: "john-cluster-queue"
spec:
  cohortName: "research-team"
  preemption:
    reclaimWithinCohort: Any

---

apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: "alice-cluster-queue"
spec:
  cohortName: "research-team"
  preemption:
    reclaimWithinCohort: Any
```

那麼 `john-cluster-queue` 以及 `alice-cluster-queue` 的 quota 就可以進行共享\
比方說空閒的時候可以把 quota 借給相同 [Cohort](#cohort) 的人\
當你需要的時候，也可以透過 preemption 的機制把 quota 要回來

好處就是，你的任務受到 starvation 的狀況會減輕很多，並且對於重要任務的 turnaround time 也會縮減(因為 preemption)

## Local Queue
```yaml
apiVersion: kueue.x-k8s.io/v1beta2
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

# Netflix Batch Compute Migrate to Kueue
Netflix 內部本身就有需要執行 Batch Compute 的需求\
早期他們有自己的一套 solution，`Compute Managed Batch(CMB)` 以及 `Titus` 搭配組成

CMB 系統主要是一個調度平台\
使用者將任務提交到 CMB，系統會根據任務的 priority, capacity 等等的進行指派\
主要運行任務的是 Titus，他是一個容器化的平台

為了更細微的控制運算平台的高效執行，必須引入一個抽象層的機制\
任務的指派通常可以被歸類，比如說他是來自哪個團隊、平台亦或者是組織，被稱為 **租戶(tenant)**\
所以我可以這樣做

+ 工程部: 擁有 `1500` 個單位
    + 雲端大數據部: 使用 quota 是 `100` 個單位
    + 金流系統部: 使用 quota 是 `1500` 個單位

租戶其實還有分，組織架構一定是多層級，如同上述，工程部底下細分不同部門
+ `internal tenant`: 大型部門，負責發佈指令(e.g. *工程部*)，對應到 [Cohort](#cohort)
+ `leaf tenant`: 實際工作的部門，可以接收指令(e.g. *雲端大數據部*, *金流系統部*)，對應到 [Cluster Queue](#cluster-queue) 以及 [Local Queue](#local-queue)

![](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*MfDuB407Rq81AHZEbhARWA.png)
> ref: [How Netflix Simplified Batch Compute with Kueue](https://netflixtechblog.com/how-netflix-simplified-batch-compute-with-kueue-87860682629c)

那你說每個團隊會每分每秒都把資源利用到最滿嗎？ 其實並不一定\
假如我 10:00 ~ 12:00 這個時段比較空閒，我是不是能把算力讓出去給其他團隊使用？\
同時也可以設定我最少要保留多少給自己

就是對應到 `borrowingLimit` 以及 `lendingLimit`

## Why Migrate to Kueue
你說他們原本的架構都做得還不錯啊？ 那為什麼要改

1. Kubernetes 社群高度發展，許多早期 CMB 要自幹的事情都被一一實現
2. CMB 目前有的功能，都能夠在 Kueue 裡頭找到相對應的實作
3. CMB 未來想要實作的功能如 preemption 已經越加繁瑣
4. Kueue 支援異質硬體的排程(透過 [Resource Flavor](#resource-flavor))
5. Kueue 後續的功能開發符合團隊的改進方向

他們也看過其他類似功能的套件，不過最終選擇 Kueue 的原因是他仍然使用原生 kube-scheduler\
比起 [Apache YuniKorn](https://github.com/apache/yunikorn-core/) 或是 [volcano-sh/volcano](https://github.com/volcano-sh/volcano)\
這兩個都是擁有自己的 scheduler\
使得 Netflix 原本的 Titus scheduler profile 不兼容，或者說他會造成排程的不穩定，進而降低效率

執行這種大型遷移的時候首先要考慮的反而是兼容性\
Kueue 介入的點其實就只是 `queueing` 跟 `scheduling` 的部分而已，而原本的架構下是 CMB 負責的\
所以只是單純拆開其他都不需要動

# Run
要執行 kueue, 你需要將 [Cluster Queue](#cluster-queue), [Local Queue](#local-queue) 與 [Resource Flavor](#resource-flavor) 部署到你的 cluster 上(缺一不可)\
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
又因為我們設定了 `parallelism: 2`，所以整個完成預計只要 (10 / 2) * 30s = `150s`

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

# Issues with Kueue
## Internal error occurred: failed calling webhook "myresourceflavor.kb.io": failed to call webhook
如果你在 apply Kueue 的設定檔的時候碰到類似以下的錯誤

```
Error from server (InternalError): error when creating "mykueue.yaml": 
Internal error occurred: failed calling webhook "myresourceflavor.kb.io": 
failed to call webhook: 
Post "https://kueue-webhook-service.mynamespace.svc:443/mutate-kueue-x-k8s-io-v1beta1-resourceflavor?timeout=10s":
no endpoints available for service "kueue-webhook-service"
```

這是因為 Kueue 的 webhook service 還沒有起來\
稍微的等它一下就可以了

你可以使用 `$ kubectl wait` 的指令等待\
service 本身其實是 expose `kueue-controller-manager` 這個 deployment\
另外，你也可以等待 `ClusterQueue`, `LocalQueue` 等的資源\
注意到他們聽的狀態是不同的

```shell
$ kubectl wait \
  -n my-ns \
  --timeout=1h \
  --for='jsonpath={.status.conditions[?(@.type=="Available")].status}=True' \
  deployments.apps/kueue-controller-manager

$ kubectl wait \
  -n my-ns \
  --timeout=1h \
  --for='jsonpath={.status.conditions[?(@.type=="Active")].status}=True' \
  ClusterQueue/my-cluster-queue

$ kubectl wait \
  -n my-ns \
  --timeout=1h \
  --for='jsonpath={.status.conditions[?(@.type=="Active")].status}=True' \
  LocalQueue/my-local-queue
```

# References
+ [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
+ [Processor affinity](https://en.wikipedia.org/wiki/Processor_affinity)
+ [Run Plain Pods](https://kueue.sigs.k8s.io/docs/tasks/run/plain_pods/)
+ [How Netflix Simplified Batch Compute with Kueue](https://netflixtechblog.com/how-netflix-simplified-batch-compute-with-kueue-87860682629c)
+ [Preemption](https://kueue.sigs.k8s.io/docs/concepts/cluster_queue/#preemption)
