---
title: Kubernetes 從零開始 - 從自幹 Controller 到理解狀態管理
date: 2024-10-31
categories: [kubernetes]
tags: [kubernetes controller, state, wrangler, kubernetes operator, kubernetes resource, kubernetes object, reconcile, crd, control loop, controller pattern, operator pattern, self healing, operator sdk, fsm, finalizer, namespaced operator, livenessprobe, readinessprobe, health check, leader election, leader with lease, leader for life]
description: Kubernetes Controller 是實現 self-healing 的核心，透過 controller 來管理 cluster 的狀態。本文將介紹 Kubernetes Object 以及 Kubernetes Controller 的概念，並且透過 Operator SDK 來實作一個簡單的 operator
math: true
---

# Kubernetes Object
Kubernetes object 並不是指 `Pod` 或者是 `Deployment` 這種 **Resource**\
複習一下，Resource 是所有你可以透過 Kubernetes 使用的物件(操作 [kubectl](https://kubernetes.io/docs/reference/kubectl/) 或[Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/))\
而 object 是這些 Resource 的 instance

<!-- workloads -->

## Kubernetes Object State
所謂的狀態是儲存在 Object 裡面的\
object 的 `spec` 以及 `status` 分別代表了 desired state 以及 current state\
spec 的內容可以透過一個特殊的檔案指定(稱為 `manifest`， 格式為 json 或 yaml)\
並透過操作 [kubectl](https://kubernetes.io/docs/reference/kubectl/) 或 [Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/) 來建立 object

> 其中 status 是由 controller 更新的，不是由我們手動指定的

考慮建立一個 nginx pod\
並且查看他的 yaml 檔案\
你就會看到類似以下的東西，這就是 object 的 `status`

可以看到 pod status 從最初的 `PodScheduled` 一直到 `PodReadyToStartContainers`\
同時你也可以得知內部 container 的狀態\
controller 會根據這些狀態來管理 object

```shell
$ kubectl run mynginx --image=nginx
$ kubectl get pods mynginx -o yaml
status:
  conditions:
  - lastProbeTime: null
    lastTransitionTime: "2024-10-25T14:14:04Z"
    status: "True"
    type: PodReadyToStartContainers
  - lastProbeTime: null
    lastTransitionTime: "2024-10-25T14:13:44Z"
    status: "True"
    type: Initialized
  - lastProbeTime: null
    lastTransitionTime: "2024-10-25T14:14:04Z"
    status: "True"
    type: Ready
  - lastProbeTime: null
    lastTransitionTime: "2024-10-25T14:14:04Z"
    status: "True"
    type: ContainersReady
  - lastProbeTime: null
    lastTransitionTime: "2024-10-25T14:13:44Z"
    status: "True"
    type: PodScheduled
  containerStatuses:
  - containerID: containerd://0ab6c6781723446e4869f1fd96b1d62b78a95dea327e45d276d010a5236f9ac8
    image: docker.io/library/nginx:latest
    imageID: docker.io/library/nginx@sha256:28402db69fec7c17e179ea87882667f1e054391138f77ffaf0c3eb388efc3ffb
    lastState: {}
    name: mynginx
    ready: true
    restartCount: 0
    started: true
    state:
      running:
        startedAt: "2024-10-25T14:14:04Z"
```

## Imperative vs. Declarative
Imperative Management 手把手教學，告訴 K8s 怎麼做\
Declarative Management 告訴 K8s 我們想要什麼，K8s 會幫我們達成

Kubernetes 大多數的操作都是透過 declarative 的方式\
比如說你指定 deployment replica 的數量就是告訴 desired state\
然後 Kubernetes 就會幫你達成這個狀態\
注意到很可能 cluster 永遠沒辦法達到你想要的狀態，但它會盡力達到

當然你也可以透過 imperative 的方式來操作，但是這樣的話，你就要自己手動管理狀態了

> ref: [kubectl apply vs kubectl create?](https://stackoverflow.com/questions/47369351/kubectl-apply-vs-kubectl-create)

# Introduction to Kubernetes Controller and State Management
在 [Kubernetes 從零開始 - 無痛初探 K8s! \| Shawn Hsu](../../kubernetes/kubernetes-basic) 中有提到\
K8s 是透過 controller 管理 cluster 狀態的\
我們告訴 K8s 我們想要的狀態，然後 K8s 會幫我們達成這個狀態(i.e. Declaration Management)

controller 並不會直接操作 pod，而是透過 [Kubernetes API Server](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/) 來管理 cluster 狀態\
比如說，建立或刪除 pod，甚至是更新 object 的狀態(e.g. `Finished`)

> 不會直接操作 pod 但透過 API Server 建立/刪除？\
> 舉例來說如果 replica 5 的 deployment 少了一個，那麼的確是要建立一個新的對吧？\
> 間接的操作 pod ，是這個意思

## Controller Pattern
![](https://github.com/kubernetes/sample-controller/raw/master/docs/images/client-go-controller-interaction.jpeg)
> ref: [client-go under the hood](https://github.com/kubernetes/sample-controller/blob/master/docs/controller-client-go.md)

以上架構圖就是官方給的 controller 的架構\
可以看到還是相對單純的

具體來說，[Reflector](#reflector) 會監聽 object 的變化\
並透過 [Informer](#informer) 將 object 的 reference 放到 `Workqueue` 裡面\
然後你的 custom controller 從 `Workqueue` 裡面拿到 reference 並使用 `Lister` 來取得 object 的資訊

為了一次只處理固定數量的 work，所有 component 之間的溝通都是透過 `Workqueue` 來做的\
注意到 **並不是為了解耦**，而是為了 **控制流量**\
有了 queue 擋在中間，可以保證同一個 item 不會同時被多個 controller 處理

> 有關 queue 的討論，可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue)

### Reflector
Reflector 會聽 object 的變化並將變化的 object 放到 `workqueue` 裡面\
問題來了 他要怎麼聽這些所謂的變化呢？

Kubernetes API Server 提供了一個方式讓你監聽特定的 object，稱為 `Watch`\
每個 [Kubernetes Object](#kubernetes-object) 都會有一個 `resourceVersion` 的欄位，你可以把它想像成是一個 unique 的 ID\
這個 ID 是對應到底層的 storage 的識別符號，這個 ID 會隨著 object 的變化而變化 所以不是固定值

> Watch 會持續監聽，List 則不會

你可以用這個 ID 來監聽 object 的變化\
有點類似 linked list 的概念，你只要知道開頭，就可以知道後續的資料位置\
所以監聽的概念也是一樣的，只要知道某個 object 目前的 `resourceVersion`，你就可以知道後續的位置，進而監聽它\
操作起來會長這樣

啟動一個 proxy 到 Kubernetes API Server
```shell
$ kubectl proxy --port 8888
```

取得目前的 `resourceVersion`
```shell
$ curl http://localhost:8888/api/v1/namespaces/default/pods | grep resourceVersion
"resourceVersion": "135966"
```

然後你就可以持續監聽後續 object 的變化
```shell
$ curl http://localhost:8888/api/v1/namespaces/default/pods\?watch=1\&resourceVersion=135966
```

> curl 使用的時候記得跳脫特殊字元

為了可以觀察到變化，你可以嘗試建幾個 pod 玩一下好方便觀察
```shell
$ kubectl run mynginx --image=nginx
```

<hr>

所有的監聽歷史資料都是儲存在 [etcd](https://etcd.io/) 裡面\
想當然空間不會是無限的，預設只會保留 5 分鐘的資料

#### List and Watch
上面你用過了 `Watch` 以及 `List` 的方式來監聽 object\
在 [tools/cache/reflector.go](https://github.com/kubernetes/client-go/blob/master/tools/cache/reflector.go#L348) 裡面你可以看到\
Reflector 底層的實作有兩種方法，一種是 `Watch` 一種是 `List`

```go
func (r *Reflector) ListAndWatch(stopCh <-chan struct{}) error {
    klog.V(3).Infof("Listing and watching %v from %s", r.typeDescription, r.name)
    var err error
    var w watch.Interface
    useWatchList := ptr.Deref(r.UseWatchList, false)
    fallbackToList := !useWatchList

    if useWatchList {
      w, err = r.watchList(stopCh)
      if w == nil && err == nil {
        // stopCh was closed
        return nil
      }
      if err != nil {
        klog.Warningf("The watchlist request ended with an error, falling back to the standard LIST/WATCH semantics because making progress is better than deadlocking, err = %v", err)
        fallbackToList = true
        // ensure that we won't accidentally pass some garbage down the watch.
        w = nil
      }
    }

    if fallbackToList {
      err = r.list(stopCh)
      if err != nil {
        return err
      }
    }

    klog.V(2).Infof("Caches populated for %v from %s", r.typeDescription, r.name)
}
```

根據 [KEP 3157](https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/3157-watch-list#proposal)\
kube-apiserver 是非常脆弱的，它很容易受到記憶體壓力的影響導致服務中斷\
而這股記憶體壓力來自於所謂的 `LIST request`(也就是 [Reflector](#reflector) 之前的行為)\
你不需要很多的 `LIST request` 就可以讓 kube-apiserver 過載\
而它會間接導致整個 node 裡面的服務都中斷，包含 kubelet

監聽 object 變化的路徑如下所示\
`Reflector` :arrow_right: `List request` :arrow_right: `kube-apiserver` :arrow_right: `etcd`\
核心開發者的想法是引入所謂的 `Watch Cache` 在中間，讓 `etcd` 的壓力減小\
這跟 `etcd` 有什麼關係呢？

他們發現，`List request` 的作法需要從 `etcd` 裡面拿到資料\
並經過一系列的處理才能送回給 client(包含 unmarshal, convert, prepare response)\
這些處理會佔用記憶體，大約為 `O(5*the_response_from_etcd)`\
而這些記憶體連 Golang 本身的 GC 都無法處理

### Informer
Informer 本質上在做的事情是包含 [Reflector](#reflector) 的功能(應該說 [Reflector](#reflector) 是一個 tool 然後 Informer 才是真正使用的)\
但是它不只是做監聽的事情，還會將 object 的 reference 放到 store 裡面\
在撰寫 controller 的時候你會操作的也是 Informer 而非 Reflector

### Indexer
從 [Informer](#informer) 傳遞給 custom controller 的資料只是單純的 object reference\
你大概猜得到為什麼不丟整個 object，多半是因為效能問題\
寫入的部份是透過 Indexer 來做的

但只有 reference 是不足以做 Reconciliation 的(因為資訊不足嘛)\
Indexer 的作用就像是資料庫的 Index 一樣，可以快速的找到 object\
所有相關的資料都是儲存在 thread-safe 的 store 裡面

存取的部份是透過 Lister([cache/lister](https://github.com/kubernetes/client-go/blob/master/tools/cache/listers.go)) 實現的\
所以這邊算是一個隱藏的 component

<hr>

Indexer 也會遇到資料過期的問題，就像一般的 cache 一樣\
我目前開發的 controller 就會遇到這些狀況\
比如說我把狀態更新成 `Success` 之後，但是我之後在 Get 的時候發現他還是 `Running`\
所以在處理的時候需要特別注意

### Control Loop
![](https://miro.medium.com/v2/resize:fit:720/format:webp/1*kTG2i9HYxGplJaBWF03HnA.png)
> ref: [如何编写自定义的 Kubernetes Controller](https://able8.medium.com/how-to-write-a-kubernetes-custom-controller-622841d1d3f6#:~:text=Kubernetes%20%E6%8E%A7%E5%88%B6%E5%99%A8%E6%98%AF%E4%B8%80%E4%B8%AA,%E7%8A%B6%E6%80%81%E6%9B%B4%E6%8E%A5%E8%BF%91%E6%9C%9F%E6%9C%9B%E7%8A%B6%E6%80%81%E3%80%82&Kubernetes%20%E9%80%9A%E8%BF%87%E6%8E%A7%E5%88%B6%E5%99%A8%E6%A8%A1%E5%BC%8F,%E6%88%96%E8%80%85%E8%B5%84%E6%BA%90%E7%9A%84%E7%BC%96%E6%8E%92%E6%93%8D%E4%BD%9C%E3%80%82)

具體來說，controller 是怎麼做 **狀態管理** 的呢？\
前面提到 [Kubernetes Object](#kubernetes-object) 裡面有存 desired state 以及 current state\
所以 controller 就會不斷的監控 object 的狀態，並且根據 desired state 來更新 current state\
要做到不斷的監控，最簡單的方式就是一個迴圈，稱為 `control loop`

這種不斷監控並更新狀態的方式，就是所謂的 **Reconciliation**

> 理論上每個 controller 都是獨立的 process, 但是為了方便管理，K8s 會將他們打包在一起

## Controller Types
K8s 裡面，controller 其實不只有一種\
針對不同的 Resource，K8s 會有不同的內建的 controller\
deployment 有自己的 `Deployment Controller`，job 也有自己的 `Job Controller` 等等的

<!-- workloads -->

![](https://miro.medium.com/v2/resize:fit:720/format:webp/1*4sus97eHHeaeFy0ui81ULg.png)
> ref: [如何编写自定义的 Kubernetes Controller](https://able8.medium.com/how-to-write-a-kubernetes-custom-controller-622841d1d3f6#:~:text=Kubernetes%20%E6%8E%A7%E5%88%B6%E5%99%A8%E6%98%AF%E4%B8%80%E4%B8%AA,%E7%8A%B6%E6%80%81%E6%9B%B4%E6%8E%A5%E8%BF%91%E6%9C%9F%E6%9C%9B%E7%8A%B6%E6%80%81%E3%80%82&Kubernetes%20%E9%80%9A%E8%BF%87%E6%8E%A7%E5%88%B6%E5%99%A8%E6%A8%A1%E5%BC%8F,%E6%88%96%E8%80%85%E8%B5%84%E6%BA%90%E7%9A%84%E7%BC%96%E6%8E%92%E6%93%8D%E4%BD%9C%E3%80%82)

## Controller Conflict on Objects?
內建的 controller 會監控特定的 object\
但是有一些 controller 他們看的 object 是同一種的

比如說 deployment 跟 job 都會監控 pod\
會不會有一種可能他們的 controller 會互相衝突呢？\
事實上不會，controller 會根據 object 的 label 來區分

# Kubernetes Operator
既然 K8s 有內建的 controller，自己客製化 controller 的意義在哪？\
為了可以更好的管理自己的 Custom Resource，我們可以透過 CRD (Custom Resource Definition) 來定義自己的 Resource\
要管理這些自定義的 Resource 的狀態，我們就需要自己的 controller 來管理

> 有關 CRD 的介紹可以參考 [Kubernetes 從零開始 - client-go 實操 CRD \| Shawn Hsu](../../kubernetes/kubernetes-crd)

這種自定義的 controller 通常被稱為 Operator

> 每個 resource 一定要有 controller 嗎？\
> 其實不用，如果你的 resource object 不需要管理狀態，那就不需要 controller

在 [Kubernetes 從零開始 - Helm Controller \| Shawn Hsu](../../kubernetes/kubernetes-helm-controller) 我們有玩過 HelmController\
HelmController 是用來管理 `HelmChart` 以及 `HelmRelease` 這兩個 resource\
而這就是自己寫一個 controller 一個很好的例子

## Finite State Machine(FSM)
我在撰寫 Controller 的時候發現，既然要管理狀態，那是不是可以考慮使用 `有限狀態機`?\
每一個狀態的轉移都是有一定的規則的，即使每個 CRD 都不盡相同，但它一定可以被歸類出來\
比如說，`pending` -> `running` -> `finished` 這樣的狀態轉移

這些狀態事實上是一個 DAG(Directed Acyclic Graph)\
因為不太可能 finished 又回去 running 這樣的事情

善加利用 FSM 可以使你管理 CRD 狀態更容易\
我的作法會是每個 object 都有一個獨立的 FSM，這樣的會是 O(n) n 為 object 數量\
因為 controller 會負責管理 "所有符合的 CRD"\
想當然這樣會造成一定的 overhead 但就看你的需求了

> Reddit 有實作一套 controller SDK [reddit/achilles-sdk](https://github.com/reddit/achilles-sdk)\
> 最主要就是提供了 FSM 的功能

## Finalizer
object 被刪除的時候，你可能會需要執行一些清理工作\
透過 finalizer 可以很優雅的處理這些事情

```yaml
metadata:
  ...
  finalizers:
  - my-finalizer
```

> 你可以指定多個 finalizer 執行

finalizers 裡面本質上就只是一堆的 key\
這些 key 很類似於 annotation，他的目的在於告訴 K8s 這個 object 還有一些事情要處理

<hr>

當你有設定 finalizer 的時候，K8s 並不會直接將 object 從 etcd 中刪除\
它會處於一個 `Terminating` 的狀態，直到 finalizer 執行完畢(所以才叫做 hook)

具體來說 K8s 會更新 object 的 `metadata`\
它會寫上 `deletionTimestamp`\
由於 controller 會監控 object 的變化，所以這次更新會被 controller 感知到\
然後執行 reconcile

```yaml
metadata:
...
  deletionTimestamp: "2020-10-22T21:30:34Z"
  finalizers:
  - my-finalizer
```

這時候因為你會感知到 object 變化\
所以你可以去看 `.metadata.deletionTimestamp` 有沒有存在\
有的話就根據你指定的 finalizer 去執行清理工作

這段就跟你平常在寫 reconcile 一樣

> 如果你指定了一個 controller 不認識的 finalizer，那麼這個 object 就會永遠留在 `Terminating` 狀態

當你事情做完之後，要如何觸發 K8s 刪除 object 呢？\
只要把 `.metadata.finalizers` 刪除就可以了

整理的操作會像這樣
![](https://kubernetes.io/images/blog/2021-05-14-using-finalizers-to-control-deletion/state-diagram-finalize.png)
> ref: [Using Finalizers to Control Deletion](https://kubernetes.io/blog/2021/05/14/using-finalizers-to-control-deletion/)

## Operator SDK
雖然說 [kubernetes/sample-controller](https://github.com/kubernetes/sample-controller) 提供了一個很好的範例\
實務上撰寫 controller 有其他的選擇，不一定只能拿官方的範例下去改\
根據 [Writing your own operator](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/#writing-operator) 官方有列出幾個如 [Operator Framework](https://operatorframework.io/)，[nolar/kopf](https://github.com/nolar/kopf) 以及 [kubebuilder](https://book.kubebuilder.io/)

以本文，我選擇使用 [Operator SDK](https://sdk.operatorframework.io/docs/building-operators/golang/)\
Operator SDK 提供了非常完整的 framework 讓你可以開發，而且他是基於 [kubebuilder](https://book.kubebuilder.io/) 的

### Namespaced Scoped Operator
Kubernetes Controller 可以只監聽特定 namespace 底下的 object\
如果沒有指定它會是 cluster scoped 的\
這種情況會有可能造成混亂

具體來說，使用 [Operator SDK](#operator-sdk) 在初始化 manager 的時候就可以指定，像這樣

```go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    Scheme:             scheme,
    MetricsBindAddress: metricsAddr,
    Port:               9443,
    LeaderElection:     enableLeaderElection,
    LeaderElectionID:   "f1c5ece8.example.com",
    Cache: cache.Options{
      DefaultNamespaces: map[string]cache.Config{"operator-namespace": cache.Config{}},
    },
})
```

其中 `operator-namespace` 就是你要監聽的 namespace\
你可能發現它其實是一個 map 的結構，亦即你可以監聽多個 namespace

### Livenessprobe and Readinessprobe of Operator
```go
if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
    setupLog.Error(err, "unable to set up health check")
    os.Exit(1)
}
if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
    setupLog.Error(err, "unable to set up ready check")
    os.Exit(1)
}
```

Operator SDK 自動幫你生成的程式碼裡面有包含基本的 health check endpoint\
`healthz.Ping` 是 Operator SDK 自帶的一個 health check function\
透過 `AddHealthzCheck` 以及 `AddReadyzCheck` 你可以將這個 health check endpoint 加入到你的 operator 裡面\
但注意到它只是註冊而已，你還是需要手動呼叫它才有用

> 所以你不需要自己用 http 寫一個 healthz

所以你的 livenessprobe 寫起來大概會像這樣
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8081
  initialDelaySeconds: 3
  periodSeconds: 3
  timeoutSeconds: 1
  failureThreshold: 3
```

> 有關 probe 可以參考 [Kubernetes 從零開始 - Self Healing 是如何運作的 \| Shawn Hsu](../../kubernetes/kubernetes-self-healing)

我們註冊進去的 URL 就是 `/healthz`\
然後那個 port `8081` 就很有意思了\
generate 出來的程式碼裡面，他是手動 bind health probe 的 port\
你可以從這裡看到，它其實是透過參數的方式 `--health-probe-bind-address=:8081` 傳遞進去的(ref: [manager_auth_proxy_patch.yaml](https://github.com/ambersun1234/blog-labs/blob/master/k8s-controller/config/default/manager_auth_proxy_patch.yaml))\
所以這個 8081 是這裡來的

對應到 source code 會是這樣定義的
```go
flag.StringVar(
    &probeAddr, 
    "health-probe-bind-address", 
    ":8081", 
    "The address the probe endpoint binds to.",
)
```

> 如果你不是用 kustomize 你就在 container 那邊加個 arg 傳進去就好了

> operator 本身的 port 預設是 8080, 你也可以在 manager 初始化的時候指定(像這裡是 9443)\
> 可以參考 [Migrate main.go](https://sdk.operatorframework.io/docs/building-operators/golang/migration/#migrate-maingo)

然後測試的時候你可以用 `$ kubectl port-forward` 來測試\
預設會回 200 OK

### Example
遵照官方的 tutorial 其實很簡單\
兩個步驟就可以完成一個 operator

```shell
$ go mod init mycontroller
$ operator-sdk init \
  --domain example.com \
  --repo mycontroller
$ operator-sdk create api \
  --group foo \
  --version v1 \
  --kind Foo \
  --resource \
  --controller
```

基本上 operator-sdk 的指令就是幫你產一個 operator 的 template\
有幾個比較重要的 flag 是 `domain`, `group` 以及 `version`

因為我們要建立一個自定義的 resource, 而所有 cluster 的操作基本上是透過 Kubernetes API 完成的\
為了更方便的管理這些 API，我們會將它分類，`domain`，`group` 以及 `version` 就是用來區分的\
所以產完你可以發現自定義的 resource 會是 `foo.example.com/v1` 這樣的格式\
然後我們這裡建立的 resource 叫做 `Foo`

其實 operator-sdk 產了很多東西\
包含... 一大堆的 yaml\
這些 yaml 檔案有的是 CRD 有的是 RBAC 的設定檔案\
operator-sdk 也有產個 Makefile 直接安裝以上的檔案(透過 kustomize)

所以你該 care 的檔案只有兩個\
`./api/v1` 裡面的 CRD 定義以及 `./internal/controller` 裡面的 controller

CRD 的部份我們需要新增一個欄位儲存 value\
然後 status 那邊要加一個 conditions 的 array 用以儲存歷史狀態

```go
// FooSpec defines the desired state of Foo
type FooSpec struct {
    // INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
    // Important: Run "make" to regenerate code after modifying this file

    // Foo is an example field of Foo. Edit foo_types.go to remove/update
    Value string `json:"value,omitempty"`
}

// FooStatus defines the observed state of Foo
type FooStatus struct {
    // INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
    // Important: Run "make" to regenerate code after modifying this file

    Conditions []metav1.Condition `json:"conditions,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status

// Foo is the Schema for the foos API
type Foo struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`

    Spec   FooSpec   `json:"spec,omitempty"`
    Status FooStatus `json:"status,omitempty"`
}
```

Reconcile 的實作如下\
基本上為了 demo 用，所以只是簡單的檢查 spec 的 value 欄位是否為特定值\
注意到，從 [Indexer](#indexer) 取得的資料有可能為空(因為 resource 被手動刪除之類的)\
所以還需要做 `IsNotFound` 的檢查(第 5 行)

```go
logger := log.FromContext(ctx)

resource := &cachev1.Memcached{}
if err := r.Get(ctx, req.NamespacedName, resource); err != nil {
  if errors.IsNotFound(err) {
    logger.Info("Foo resource not found")
    return ctrl.Result{}, nil
  }

  logger.Error(err, "unable to fetch Foo")
  return ctrl.Result{}, err
}

if resource.Spec.Foo != "bar" {
  logger.Info("Foo field is not equal to bar")
  meta.SetStatusCondition(&resource.Status.Conditions, metav1.Condition{
    Type:               "Unknown",
    Status:             metav1.ConditionUnknown,
    Reason:             "FooNotBar",
    Message:            "Foo field is not equal to bar",
    LastTransitionTime: metav1.Now(),
  })
  if err := r.Status().Update(ctx, resource); err != nil {
    logger.Error(err, "unable to update Foo status")
    return ctrl.Result{}, err
  }

  return ctrl.Result{Requeue: true}, nil
}

meta.SetStatusCondition(&resource.Status.Conditions, metav1.Condition{
  Type:               "Ready",
  Status:             metav1.ConditionTrue,
  Reason:             "FooIsBar",
  Message:            "Foo field is equal to bar",
  LastTransitionTime: metav1.Now(),
})

if err := r.Status().Update(ctx, resource); err != nil {
  logger.Error(err, "unable to update Foo status")
  return ctrl.Result{}, err
}
```

### Run
先建立一個新的 cluster 用來測試我們的 operator

```shell
$ k3d cluster create mycluster --servers 1
$ kubectl config current-context
# 應該要是 k3d-mycluster
```

然後安裝 operator
```shell
$ make docker-build
$ k3d image import -c mycluster controller:latest
```

> docker-build 裡面的指令記得下 `--no-cache`\
> controller 的 yaml 裡面，image 記得改 `imagePullPolicy: Never`

<hr>

開始測試！\
可以使用 `./config/samples/` 底下的範例 yaml 來建立 resource\
底下的 spec 記得改成相對應的欄位

```yaml
apiVersion: foo.example.com/v1
kind: Foo
metadata:
  labels:
    app.kubernetes.io/name: k8s-controller
    app.kubernetes.io/managed-by: kustomize
  name: foo-sample
spec:
  value: hello
```

![](/assets/img/posts/operator2.png)

controller 的 log 裡面你可以看到有正確的進行做動\
它會一直檢查的原因是因為，我們有將它重新 enqueue(第 28 行)

![](/assets/img/posts/operator1.png)

而 describe Resource，你就可以看到我們已經將 status 更新了\
只是說實作裡面並沒有一直新增 condition(縱使我們定義他是一個 list)

到這裡，你就完成了一個非常簡單的 operator 了\
你可以針對這個 operator 做更多的事情，比如說加入更多的檢查，或者是加入更多的欄位

> 詳細的實作可以參考 [ambersun1234/blog-labs/k8s-controller](https://github.com/ambersun1234/blog-labs/tree/master/k8s-controller)

## How to Deploy your Controller
另一個問題是如何部署你的 controller\
你可以選擇跑一個 deployment 起來就可以

不過 controller 在重新啟動(rollout restart)的時候，有可能會沒有接到 event\
導致 CRD 會少監聽到一些 event\
這並不是我們想要的

當然你可以選擇跑多個 replica, 但這樣另一個問題油然而生\
多個執行的個體會不會互相干擾呢？ 答案是肯定的

Operator SDK 是採用 `Single Leader` 的方式解決\
同一時間只會有一個 "leader" 來執行 reconcile，而剩餘的 replica 則會待機

> 有關 Single Leader Replication 可以參考 [資料庫 - 初探分散式資料庫 \| Shawn Hsu](../../database/database-distributed-database/#single-leadermaster-slave)

Leader 的選舉機制有兩種 [Leader-with-Lease](#leader-with-lease) 以及 [Leader-for-Life](#leader-for-life)\
預設的機制是 `Leader-with-Lease`

### Leader with Lease
leader 的權利是具有 `時效性的`，當 lease 過期的時候，leader 就會被換掉\
然後其他人就會想辦法成為 leader

這種實作保證了快速的 failover, 不過，它也逃不掉 **腦分裂的問題**\
在 [client-go](https://github.com/kubernetes/client-go/blob/master/tools/leaderelection/leaderelection.go) 的實作當中有明確指出\
leaderelection 這套實作是依靠時間區間來做判斷的(`RenewDeadLine` 以及 `LeaseDuration`)\
也就是說他是依靠 "時間差" 而非絕對時間決定 leader 是否該被替換掉(因為在分散式系統下，時間是不可靠的)

但如果節點的時鐘跑得比較快/慢，leaderelection 也仍然沒有辦法處理這種狀況，進而導致 **腦分裂**

> 有關腦分裂可以參考 [資料庫 - 分散式系統中的那些 Read/Write 問題 \| Shawn Hsu](../../database/database-distributed-issue)

基本上你只要將 `LeaderElection` 設為 `true` 就可以了
```go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    LeaderElection:         enableLeaderElection,
    LeaderElectionID:       "3601af7f.example.com",
})
```

從下列的 log 你可以很明顯的看到，同一時間只會有一個 leader 正在執行\
而其他的 replica 則是在等待
```shell
$ kubectl get pods -A                                                                     
NAMESPACE               NAME                                                 READY   STATUS      RESTARTS   AGE
k8s-controller-system   k8s-controller-controller-manager-65689fb949-85ff2   2/2     Running     0          27s
k8s-controller-system   k8s-controller-controller-manager-65689fb949-98fqg   2/2     Running     0          27s
k8s-controller-system   k8s-controller-controller-manager-65689fb949-dtm74   2/2     Running     0          27s

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-65689fb949-85ff2 
2025-01-20T17:55:33Z    INFO    setup   starting manager
2025-01-20T17:55:33Z    INFO    controller-runtime.metrics      Starting metrics server
2025-01-20T17:55:33Z    INFO    starting server {"kind": "health probe", "addr": "[::]:8081"}
2025-01-20T17:55:33Z    INFO    controller-runtime.metrics      Serving metrics server  {"bindAddress": "127.0.0.1:8080", "secure": false}
I0120 17:55:33.965082       1 leaderelection.go:250] attempting to acquire leader lease k8s-controller-system/3601af7f.example.com...
I0120 17:55:33.973538       1 leaderelection.go:260] successfully acquired lease k8s-controller-system/3601af7f.example.com

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-65689fb949-98fqg 
2025-01-20T17:55:34Z    INFO    setup   starting manager
2025-01-20T17:55:34Z    INFO    controller-runtime.metrics      Starting metrics server
2025-01-20T17:55:34Z    INFO    starting server {"kind": "health probe", "addr": "[::]:8081"}
2025-01-20T17:55:34Z    INFO    controller-runtime.metrics      Serving metrics server  {"bindAddress": "127.0.0.1:8080", "secure": false}
I0120 17:55:34.148711       1 leaderelection.go:250] attempting to acquire leader lease k8s-controller-system/3601af7f.example.com...

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-65689fb949-dtm74 
2025-01-20T17:55:34Z    INFO    setup   starting manager
2025-01-20T17:55:34Z    INFO    controller-runtime.metrics      Starting metrics server
2025-01-20T17:55:34Z    INFO    starting server {"kind": "health probe", "addr": "[::]:8081"}
2025-01-20T17:55:34Z    INFO    controller-runtime.metrics      Serving metrics server  {"bindAddress": "127.0.0.1:8080", "secure": false}
I0120 17:55:34.149087       1 leaderelection.go:250] attempting to acquire leader lease k8s-controller-system/3601af7f.example.com...
```

### Leader for Life
相較只能坐擁王位一段時間的 leader, `Leader for Life` 講求的是主動退位\
只有當 leader 被刪除的時候，才會進行下一任的選舉

要使用 `Leader for Life` 要改的 code 會比較多
1. 新增 env `POD_NAME`
2. 新增 pods, nodes 的 role(get 權限即可)

當然最重要的就是主程式這裡
```go
import (
    "github.com/operator-framework/operator-lib/leader"
)

if err := leader.Become(context.TODO(), "mycontroller-lock"); err != nil {
    setupLog.Error(err, "unable to become leader")
    os.Exit(1)
  }
```

> 這部份的實作可以參考 commit [5b9ac77](https://github.com/ambersun1234/blog-labs/commit/5b9ac7764dfecae0d7f058a9bc48c266c83f7dd4)

然後一樣看輸出結果，也是只有一個 leader 會負責執行 reconcile
```shell
$ kubectl get pods -A
NAMESPACE               NAME                                                READY   STATUS      RESTARTS   AGE
k8s-controller-system   k8s-controller-controller-manager-7f444cb5c-6xmlt   1/2     Running     0          56s
k8s-controller-system   k8s-controller-controller-manager-7f444cb5c-9d9zm   1/2     Running     0          56s
k8s-controller-system   k8s-controller-controller-manager-7f444cb5c-cf6sj   2/2     Running     0          56s

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-7f444cb5c-6xmlt 
2025-01-20T18:36:27Z    INFO    leader  Trying to become the leader.
2025-01-20T18:36:27Z    DEBUG   leader  Found podname   {"Pod.Name": "k8s-controller-controller-manager-7f444cb5c-6xmlt"}
2025-01-20T18:36:27Z    DEBUG   leader  Found Pod       {"Pod.Namespace": "k8s-controller-system", "Pod.Name": "k8s-controller-controller-manager-7f444cb5c-6xmlt"}
2025-01-20T18:36:27Z    INFO    leader  Found existing lock     {"LockOwner": "k8s-controller-controller-manager-7f444cb5c-cf6sj"}
2025-01-20T18:36:27Z    INFO    leader  Not the leader. Waiting.

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-7f444cb5c-9d9zm 
2025-01-20T18:36:27Z    INFO    leader  Trying to become the leader.
2025-01-20T18:36:27Z    DEBUG   leader  Found podname   {"Pod.Name": "k8s-controller-controller-manager-7f444cb5c-9d9zm"}
2025-01-20T18:36:27Z    DEBUG   leader  Found Pod       {"Pod.Namespace": "k8s-controller-system", "Pod.Name": "k8s-controller-controller-manager-7f444cb5c-9d9zm"}
2025-01-20T18:36:27Z    INFO    leader  Found existing lock     {"LockOwner": "k8s-controller-controller-manager-7f444cb5c-cf6sj"}
2025-01-20T18:36:27Z    INFO    leader  Not the leader. Waiting.

$ kubectl logs -n k8s-controller-system k8s-controller-controller-manager-7f444cb5c-cf6sj 
2025-01-20T18:35:26Z    INFO    leader  Trying to become the leader.
2025-01-20T18:35:26Z    DEBUG   leader  Found podname   {"Pod.Name": "k8s-controller-controller-manager-7f444cb5c-cf6sj"}
2025-01-20T18:35:26Z    DEBUG   leader  Found Pod       {"Pod.Namespace": "k8s-controller-system", "Pod.Name": "k8s-controller-controller-manager-7f444cb5c-cf6sj"}
2025-01-20T18:35:26Z    INFO    leader  No pre-existing lock was found.
2025-01-20T18:35:26Z    INFO    leader  Became the leader.
2025-01-20T18:35:26Z    INFO    setup   starting manager
```

# unable to decode an event from the watch stream: context canceled
我在開發 operator 的時候有一個問題，就是會遇到這種錯誤 `unable to decode an event from the watch stream: context canceled`

根據 [Consistently Seeing Reflector Watch Errors on Controller Shutdown](https://github.com/kubernetes-sigs/controller-runtime/issues/2723)，這看起來是一個已知問題\
似乎是跟 cache 有關係，那留言內的解法是把 cache 停掉

你可以在 `client.Object` 裡面指定哪些 object 不要被 cache

```go
import (
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/client"
)

func main() {
    ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
        Client: client.Options{
            Cache: &client.CacheOptions{
                DisableFor: []client.Object{
                    &coreV1.Pod{},
                },
            },
        },
    })
}
```

# References
+ [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/)
+ [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/#control-plane-components)
+ [What is the difference between a Kubernetes Controller and a Kubernetes Operator?](https://stackoverflow.com/questions/47848258/what-is-the-difference-between-a-kubernetes-controller-and-a-kubernetes-operator)
+ [Difference between Kubernetes Objects and Resources](https://stackoverflow.com/questions/52309496/difference-between-kubernetes-objects-and-resources)
+ [Objects, Resources and Controllers in Kubernetes](https://stackoverflow.com/questions/59950463/objects-resources-and-controllers-in-kubernetes)
+ [Objects In Kubernetes](https://kubernetes.io/docs/concepts/overview/working-with-objects/)
+ [Kubernetes Object Management](https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/)
+ [如何编写自定义的 Kubernetes Controller](https://able8.medium.com/how-to-write-a-kubernetes-custom-controller-622841d1d3f6#:~:text=Kubernetes%20%E6%8E%A7%E5%88%B6%E5%99%A8%E6%98%AF%E4%B8%80%E4%B8%AA,%E7%8A%B6%E6%80%81%E6%9B%B4%E6%8E%A5%E8%BF%91%E6%9C%9F%E6%9C%9B%E7%8A%B6%E6%80%81%E3%80%82&Kubernetes%20%E9%80%9A%E8%BF%87%E6%8E%A7%E5%88%B6%E5%99%A8%E6%A8%A1%E5%BC%8F,%E6%88%96%E8%80%85%E8%B5%84%E6%BA%90%E7%9A%84%E7%BC%96%E6%8E%92%E6%93%8D%E4%BD%9C%E3%80%82)
+ [Kubernetes Controller 机制详解（一）](https://www.zhaohuabing.com/post/2023-03-09-how-to-create-a-k8s-controller/)
+ [How to deploy controller into the cluster](https://github.com/kubernetes/sample-controller/issues/19)
+ [rancher/wrangler](https://github.com/rancher/wrangler)
+ [Efficient detection of changes](https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes)
+ [Operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/#deploying-operators)
+ [Operator SDK](https://sdk.operatorframework.io/docs/building-operators/golang/)
+ [API Overview](https://kubernetes.io/docs/reference/using-api/)
+ [Kubernetes: Finalizers in Custom Resources](https://blog.anynines.com/posts/kubernetes-finalizers-in-custom-resources/)
+ [Finalizers](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/)
+ [Using Finalizers to Control Deletion](https://kubernetes.io/blog/2021/05/14/using-finalizers-to-control-deletion/)
+ [Watching resources in specific Namespaces](https://sdk.operatorframework.io/docs/building-operators/golang/operator-scope/#watching-resources-in-specific-namespaces)
+ [Leader election](https://sdk.operatorframework.io/docs/building-operators/golang/advanced-topics/#leader-election)
+ [Understand the cached clients](https://ahmet.im/blog/controller-pitfalls/#understand-the-cached-clients)
