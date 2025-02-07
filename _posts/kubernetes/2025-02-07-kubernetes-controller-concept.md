---
title: Kubernetes 從零開始 - Controller Pattern 以及其原理
date: 2025-02-07
categories: [kubernetes]
tags: [kubernetes controller, state, wrangler, kubernetes operator, kubernetes resource, kubernetes object, reconcile, crd, control loop, controller pattern, operator pattern]
description: Kubernetes controller 是一個管理 cluster 狀態的重要元件，透過 controller 你可以管理自己的 custom resource。本文將介紹 controller 的基本概念以及其原理。
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

# Control Loop
![](https://miro.medium.com/v2/resize:fit:720/format:webp/1*kTG2i9HYxGplJaBWF03HnA.png)
> ref: [如何编写自定义的 Kubernetes Controller](https://able8.medium.com/how-to-write-a-kubernetes-custom-controller-622841d1d3f6#:~:text=Kubernetes%20%E6%8E%A7%E5%88%B6%E5%99%A8%E6%98%AF%E4%B8%80%E4%B8%AA,%E7%8A%B6%E6%80%81%E6%9B%B4%E6%8E%A5%E8%BF%91%E6%9C%9F%E6%9C%9B%E7%8A%B6%E6%80%81%E3%80%82&Kubernetes%20%E9%80%9A%E8%BF%87%E6%8E%A7%E5%88%B6%E5%99%A8%E6%A8%A1%E5%BC%8F,%E6%88%96%E8%80%85%E8%B5%84%E6%BA%90%E7%9A%84%E7%BC%96%E6%8E%92%E6%93%8D%E4%BD%9C%E3%80%82)

具體來說，controller 是怎麼做 **狀態管理** 的呢？\
前面提到 [Kubernetes Object](#kubernetes-object) 裡面有存 desired state 以及 current state\
所以 controller 就會不斷的監控 object 的狀態，並且根據 desired state 來更新 current state\
要做到不斷的監控，最簡單的方式就是一個迴圈，稱為 `control loop`

這種不斷監控並更新狀態的方式，就是所謂的 **Reconciliation**

> 理論上每個 controller 都是獨立的 process, 但是為了方便管理，K8s 會將他們打包在一起

# Controller Types
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

# References
+ [Difference between Kubernetes Objects and Resources](https://stackoverflow.com/questions/52309496/difference-between-kubernetes-objects-and-resources)
+ [Objects, Resources and Controllers in Kubernetes](https://stackoverflow.com/questions/59950463/objects-resources-and-controllers-in-kubernetes)
+ [Objects In Kubernetes](https://kubernetes.io/docs/concepts/overview/working-with-objects/)
+ [Kubernetes Object Management](https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/)
+ [Kubernetes Controller 机制详解（一）](https://www.zhaohuabing.com/post/2023-03-09-how-to-create-a-k8s-controller/)
