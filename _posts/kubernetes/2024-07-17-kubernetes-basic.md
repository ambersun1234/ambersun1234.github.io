---
title: Kubernetes 從零開始 - 無痛初探 K8s!
date: 2024-07-17
description: 本文將會介紹 kubernetes 的基本概念以及架構，並且會介紹 kubernetes 的基本組成元件
categories: [kubernetes]
tags: [container, k3d, rabbitmq, producer consumer, service, deployment, configmap, secret]
math: true
---

# Preface
現今網頁服務由於 container 的興起，大幅度的改變了整個 web 的生態系，一切都圍繞著 container\
雖然說 container 改變了開發者的工作流程，使得大部分得以簡化，但是仍有一些問題依然存在

比如說： 當服務有 bug 導致系統停機、當系統要更新而必須停機、當服務撐不住需要手動開機器用以應付大流量的時候\
以上這些情況若以單純的 docker 可是無法順利解決的

# Deployment Evolution
![](https://d33wubrfki0l68.cloudfront.net/26a177ede4d7b032362289c6fccd448fc4a91174/eb693/images/docs/container_evolution.svg)
> ref: [Overview](https://kubernetes.io/docs/concepts/overview/)

+ Traditional Deployment
    + 傳統部屬服務的方式就是在實體機器上面安裝服務對吧？比如說 `$ sudo apt install xxx` 之類的
    + 這樣做的壞處是 當你的服務需要因為某些原因而進行搬遷的話，你沒有一個很方便的手段重新安裝服務，必須要從
        + 作業系統安裝 :arrow_right: 一些系統服務的安裝(e.g. `ssh`, `mysql`, `防火牆設定` ... etc.) :arrow_right: 最後才是安裝你的服務
        + 這樣用起來 使用者肯定都等的不耐煩了對吧
    + 而且還有一個很重要的問題，如果你在機器上跑 n 個 instance 服務，有可能會因為資源分配不均的情況所以導致 某幾個 instance 的 performance 會不如預期
    + 你可能會想說 我多開幾台機器就可以了，實務上維護多台實體機器並不是一個很好的選擇，而且這樣對資源的利用度並不高

+ Virtualized Deployment
    + 所以為了克服上述問題，虛擬化技術被提出
    + 虛擬化技術的出現使得 `資源利用度更好`, `容易進行維護`(容易增加、更新以及刪除)
    + 較為人詬病的問題點是，由於 virtual machine 先天上的設計，他是從底層虛擬化上去的(亦即每個 vm 都擁有自己獨立的作業系統)，所以在效能上會是一大問題

+ Container Deployment
    + 相比 virtual machine, container 解決了效能問題，主要是透過了 `share operating system` 的方式，詳細可以參考 [Container 技術 - 理解 Docker Container \| Shawn Hsu](../../container/container-docker)

# Introduction to Kubernetes
container 的興起，加上逐漸從 monolithic 轉到 microservices 的趨勢\
管理龐大的 container 們是一件不容易的事情，也因此 Kubernetes 得以快速發展

Kubernetes 的優勢
1. 能夠自動進行負載平衡
2. 根據不同負載量自動 scale out, scale in
3. 擁有 self-healing 的機制，亦即 zero downtime

## Powerful than Docker Compose
其實我一開始在寫設定檔的時候，我真的覺得他長得很像 docker-compose\
最有感的就是資料庫連線的方式，都是透過名字來連線

話雖如此，K8s 也有比 docker-compose 更強大的地方\
比如說 K8s 支援更好的 scaling, 可以動態調整，可以不限定於單一機器\
docker-compose 通常是用在開發階段，不太適合正式環境，不如考慮 [docker swarm](https://docs.docker.com/engine/swarm/)

# Producer-Consumer Example
K8s 很多東西可以玩，也很複雜，但是基本的概念是相對簡單的\
讓我們來看一個例子

> 完整程式碼實作可參考 [ambersun1234/blog-labs/k3d](https://github.com/ambersun1234/blog-labs/tree/master/k3d)

我想要寫一個簡單的 producer-consumer 的服務\
producer 會將訊息送到 rabbitmq 裡面，而 consumer 則會從 rabbitmq 裡面取出訊息\
這個服務需要有三個, producer, consumer 以及 rabbitmq

因為 K8s 是一個 container management tool, 所以我們需要將這三個服務打包成 container\
注意到 local 的 docker image 並不會被 K8s 所知道，我們有兩個選項
1. 打包上傳到 docker hub 或者是私有的 docker registry
2. 手動傳入 K8s 裡面([k3d](#k3d))

## Deployment
萬事俱備之後，我們就可以開始部屬服務了\
K8s 是使用 yaml 檔描述你該怎麼部屬服務的(有點類似 IaC 但不全然一樣)\
我們需要三個服務，他們被稱作 `Deployment`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: producer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: producer
  template:
    metadata:
      labels:
        app: producer
    spec:
      initContainers:
        - name: wait-for-rabbitmq
          image: busybox:1.28
          command:
            [
              "sh",
              "-c",
              "until nslookup rabbitmq-service; do echo waiting for rabbitmq-service; sleep 2; done",
            ]
      containers:
        - name: producer
          image: test-producer
          imagePullPolicy: Never
          envFrom:
            - configMapRef:
                name: myconfig
            - secretRef:
                name: application-credentials
          resources:
            requests:
              memory: 2048Mi
              cpu: 500m
            limits:
              memory: 4096Mi
              cpu: 1000m
```

> 小試身手！ 第 4, 9, 13 行的 producer 各是什麼意思？ 可參考 [Different Labels in Deployment](#different-labels-in-deployment)

這是 producer 的設定檔，consumer 以及 rabbitmq 也是類似的\
首先我們先從看得懂先開始\
`initContainer` 是執行在 pod 啟動之前的 container\
你可以拿來做一些初始化的工作，比如說等待服務啟動完成\
這裡的 initContainer 是用來等待 rabbitmq-service 啟動完成

> initContainer 通常是使用 until do done loop 搭配 nc 使用\
> 使用 nc 記得搭配 `-z` 參數，這樣就不會真的連線進去\
> 我們的目的僅僅是確認服務有沒有啟動而已

`container` 就是定義主要服務的地方\
這裡定義了我們的 producer container，然後 image 是我們 local build 出來的所以 `ImagePullPolicy` 是 Never\
比較有趣的是 resources 這塊，可以看到有 requests 以及 limits\
根據 [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) 所述

> When you specify the resource request for containers in a Pod, \
> the kube-scheduler uses this information to decide which node to place the Pod on. \
> When you specify a resource limit for a container, the kubelet enforces those limits so that the running container is not allowed to use more of that resource than the limit you set. \
> The kubelet also reserves at least the request amount of that system resource specifically for that container to use.

簡單來說
+ `requests`: 這是你的 container 需要的最小資源
+ `limits`: 這是你的 container 最多可以使用的資源

## Service
我們知道了一個 deployment 要怎麼樣定義出來\
container image 要用哪一個，他要怎麼跑，他資源上有哪些限制\
但顯然還不夠，舉例來說，他要怎麼跟 RabbitMQ 連線？

RabbitMQ 以這個例子也是一個 deployment\
兩個不相干的 container 要連線溝通，以 Docker-Compose 來說是不是讓他在同一個 network 下面就好了?\
然後透過 container name 來連線(因為我們不知道實體 ip)\
K8s 也是一樣的概念，只是他的實作方式不同\
在這裡你會需要的是一個 `Service`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq-service
spec:
  type: ClusterIP
  selector:
    app: rabbitmq
  ports:
    - name: amqp
      protocol: TCP
      port: 5672
      targetPort: 5672
    - name: gui
      protocol: TCP
      port: 15672
      targetPort: 15672
```

理由也一樣，因為我們不知道 rabbitmq container 的實體 ip\
K8s 採用的做法是透過 `Service` 來提供一個固定連線方式給 producer 來連線\
要怎麼連線？ 一樣是 **名字**

## ConfigMap and Secret
連線的方式我是透過 env variable 來設定的\
然後 env variable 的值是透過 `ConfigMap` 以及 `Secret` 來設定的\
一般來說 K8s 的設定檔都會獨立出來，兩個差別在於 `Secret` 是放機密資料的(但他不會加密)

```yaml
# configmap
apiVersion: v1
kind: ConfigMap
metadata:
  name: myconfig
data:
  MQ_CH: test
```

```yaml
# secret
apiVersion: v1
kind: Secret
metadata:
  name: application-credentials
type: Opaque
data:
  MQ_URL: YW1xcDovL3Rlc3Q6dGVzdEByYWJiaXRtcS1zZXJ2aWNlOjU2NzIv
```

剛剛的 `rabbitmq-service` 就是用在這裡\
然後 producer 的 `configMapRef`, `secretRef` 就是會使用上述的資料\
他們也是透過設定檔的 **"名字"**(myconfig, application-credentials) 來指定的

`MQ_URL` 是 rabbitmq 的連線資訊\
注意到 secret 的資料是 base64 encode 過的(也僅僅只有 encode 過而已，他是可以 decode 的)

# Example Recap
> 我覺的 [Kubernetes Crash Course for Absolute Beginners [NEW]](https://www.youtube.com/watch?v=s_o8dwzRlu4) 分享的概念淺顯易懂\
> 因此這部份我也會參考原作的講解的方法，重新解釋一遍，另外也滿推薦可以看看原本的內容

上面的例子我們大約的看過 K8s 的基本組成元件\
但容許我再用正式的定義複習一次

## Deployment and Service
我們知道，Kubernetes 是負責管理龐大的容器們的工具\
容器本身需要一個地方執行，不論是虛擬機或是實體機器，稱之為 `Node`\
而 Kubernetes 不只是為了 docker 而生，為了要兼容其他的 container runtime\
它做了一層抽象層，稱之為 `Pod`

> 這部份可參考 [Container 技術 - runC, containerd 傻傻分不清 \| Shawn Hsu](../../container/container-runc)

Pod 本身是一層抽象層，亦即你沒辦法真正的去操作它\
而 Pod 是由 `Deployment` 的設定檔撰寫而成\
它會定義說你要用哪一個 container image 啦，然後你的 replica 數量等等的

就如同你在使用 docker 的時候會 export port，從外部 access 進去\
Kubernetes 的每個 pod 也有自己的 ip address, 提供你存取\
不過要注意的是，當 pod 掛掉重啟的時候，該 ip address 也會跟著改變\
這會造成不好的開發者使用體驗(i.e. 每次都要連到不同的機器)

> 為什麼 pod 會掛掉？\
> 可能是 application 本身有問題、網路問題意外掉線啦或是重開等等的

為了克服此等問題，`Service` 應運而生\
它負責執行 Pod 之間 routing 與 discovery 的工作\
其中一個重點是，Service 可以定義固定的 "存取介面"\
意思就是我可以透過 存取介面(i.e. **name**) 存取到我們的 Pod

## ConfigMap and Secret
在 backend development 裡\
資料庫的存取算是滿普遍的需求\
以往我們在做這方面的東西的時候，通常會將 `連線資訊` 等等的寫在 config.yaml 或是 environment variable 裡面\
Kubernetes 中也是同樣的概念稱為 `ConfigMap`

但是對於一些像是密碼之類的資訊\
你可以把它放在另外一個地方 `Secret`\
但是要注意的是，Kubernetes 的 Secret 是 ***不會做加密的***\
需要透過第三方的套件來加密

> Secret 的資料要是 base64 encode 過的資料哦~

<hr>

最後，資料庫的部份\
在 docker 裡面我們會這樣寫 `docker run -itd -p 3306:3306 -v mysql:/var/lib/mysql`\
不過 Kubernetes 通常不建議這麼做，因為它只是個容器管理工具\
針對 persistent data 的部份建議是往外放

## Label(name) is the Key to Connect
在 K8s 的設定檔裡面，你會注意到我一直強調利用 **名字** 來連線或者是做 value reference\
yaml 檔之間的設定基本上都是透過這種方式操作的

當你要在 deployment 裡面拿到 configMap 的資料的時候，你會透過 `configMapRef` 以及 `secretRef` 取得特定 label 下的特定的資料\
如果找不到相對應的，比如說 environment variable, 記得檢查 key, value 是不是有打錯字之類的

### Different Labels in Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: producer # deployment name
spec:
  replicas: 1
  selector:
    matchLabels:
      app: producer # which pod to manage
  template:
    metadata:
      labels:
        app: producer # pod name
    spec:
      initContainers:
        ...
```

所以這些 `producer` label 分別代表什麼意思\
最外層的 `metadata.name` 是這個 deployment 的名字

我們知道 deployment 實際上是由 pod 組成的\
所以 `spec` 底下的資料都是 pod 的設定檔\
`template` 定義了 pod 的規格，包含他要跑的 container, 他的環境變數等等\
所以 `spec.template.metadata.labels.app` 代表的是 pod 的名字

最後 `spec.selector.matchLabels.app`\
deployment 需要管理 pod，所以他需要知道是哪個(哪些) pod\
所以名字符合 `app: producer` 的 pod 就會被這個 deployment 管理

> 其實都把他設定成同一個名字不太好

# k3d
我們可以使用 [k3d](https://k3d.io/v5.7.2/) 在本機跑 K8s

> [minikube](https://minikube.sigs.k8s.io/docs/) 一般來說比較慢，因為他是起 VM, k3d 則是用 container 跑

不過無論你用哪一種我都覺得挺好上手的，這裡會稍微記錄一下一些小小的坑\
k3d 需要在一開始建立 cluster 的時候就指定好 server node 的數量\
建立的時候可以指定數量，以這個例子來說一個就夠了

```shell
$ k3d cluster create mycluster --servers 1
```

另外我們稍早也提過，image 需要手動傳入 K8s 裡面\
在 k3d 裡面是這樣做的

```shell
$ k3d image import -c mycluster test-producer:latest
```

最後當你不用測試的時候可以選擇停止 cluster(不需要刪除)

```shell
$ k3d cluster stop mycluster
```

# Kubernetes Cluster Architecture
![](https://kubernetes.io/images/docs/kubernetes-cluster-architecture.svg)
> ref: [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/)

## Control plane
因為 k8s 本體其實是 cluster 架構, 因此我們需要一個類似控制中樞的角色(大腦) 即 `control plane`\
control plane 必須管理底下所有的 node 用以進行諸如 scheduling 等的決策事項\
在 control plane 裡面還有若干服務
+ `kube-apiserver`
    + 提供 Kubernetes API 用以管理整個 k8s cluster
+ `etcd`
    + 用以儲存所有 cluster information state data
+ `kube-scheduler`
    + 排程器，用以安排新的 pod 要跑在哪一個 node 上
    + 排程器會自動挑選合適的 node 並且將 pod 安排在該 node 上面
+ `kube-controller-manager`
    + 對於 k8s cluster 來說，我們需要一個 [controller](https://kubernetes.io/docs/concepts/architecture/controller/) 用以監控 cluster 的 `state(狀態)`
    + 透過 controller 這個 process 一點一點的將 cluster state 導向 desired state

> 有關 controller 的介紹可以參考 [Kubernetes 從零開始 - 從自幹 Controller 到理解狀態管理](../../kubernetes/kubernetes-controller)

## Node
node(節點) 是組成 cluster 的重要單位，節點可以是 `virtual machine` 或者是 `physical machine`\
每一個 node 都是由 control plane 直接控制的, 而 node 裡面包含有 pod 用以運行 container

node 包含了以下的組成元件
+ `kubelet`
    + 為一 node agent，負責管理底下 pod 的狀態(包含: pod 有沒有正常運行，pod 的生理狀態 健不健康之類的) 以及 將 node 註冊到整個 cluster 裡面
+ `kube-proxy`
    + 前面提到 pod 是根據 kube-scheduler 進行排程安排到特定的 node 上，值得注意的是 `pod 是會變動的`(主要是根據 hardware/software/policy constrains, affinity, anti-affinity specifications, data locality, inter-workload 等等的影響)
    + 所以說 pod 的 ip 是會變動的，而若是主機 ip 變動，對於客戶端的使用來說會是極度麻煩的事情, 也因此 `kube-proxy` 就是為了解決這件事情的
    + kube-proxy 是跑在每一個 node 上面的 network proxy, 為了解決動態 ip 的問題，k8s 將 `set of pods` 構築成 ***虛擬的 network service***, 賦予外界一個固定訪問 pod 的通道
    + 如此一來，即使後端的 pod 由於 scheduler 排程的關係移動到其他 node 上，對於前端來說仍然沒有影響！
+ `container runtime`
    + 注意到一件事情，k8s 不單單只支援 docker, 事實上，它支援許多種的 container runtime 
    + 為了支援各項平台，k8s 有自己的一套 [Kubernetes CRI (Container Runtime Interface)](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-node/container-runtime-interface.md) 界面，用以支援各種不同的 runtime(有關 container runtime 的介紹可以參考 [Container 技術 - runC, containerd 傻傻分不清 \| Shawn Hsu](../../container/container-runc))


### Pod
pod 是 k8s 中最小可部屬單元，注意到不是 container 哦\
pod 是由一系列的 spec 定義出來的(裡面包含像是 image 資訊、metadata, ports ... etc.)\
pod 裡面可以包含 一個或多個 container, 所有的 container 共享 儲存空間、網路等等的

> 如果要 log pod 裡面的 container, 你可以透過 `kubectl logs <pod-name> -c <container-name>` 來取得\
> 因為一個 pod 可能會有多個 container, 所以你需要指定 container 的名字

> 通常的作法會是一個 pod 裡面僅僅會包含一個 container

看到這裡其實我覺得有點疑惑，為什麼 Kubernetes 要多拉一層 pod 出來呢？\
很明顯我可以直接用 container 來運行我的服務

如果你想要執行多個 container 並共享資源之類的事情，單 container 並沒有辦法做到\
你會需要透過類似 docker-compose 的方式來達成共享網路，資料儲存\
在 K8s 裡面，這個 **環境** 就是 pod

但 pod 不僅僅是環境而已，他也包含了一些資源管理，生命週期管理的功能\
這樣他才是 k8s 中最小的可部屬單元

<hr>

不過，我們其實不太會直接操作 pod\
原因是 pod 的生命週期是很短暫的，亦即 pod 會隨著 node 的重啟而消失\
比較常見的是他不會自動重啟，rolling update 等功能\
所以他對於管理方面其實是不太方便的

通常來說會是使用更進階的 workload resources 來管理 pod\
deployment, statefulset, daemonset 等等的\
這個部份我們會在之後的文章中進行介紹

# Conclusion
在撰寫 yaml 檔案的時候，請務必注意以下幾點
1. label, selector 之間的名字是不是一樣的
2. configMap 的資料 **不用 base64 encode**, 但是 secret 的資料要
3. 連線資訊的部分，可以依賴 [Service](#service) 定義一個固定的連線方式

掌握這些極基本的概念，你就有辦法開始使用 K8s 了\
但路途還很遙遠，一起學習吧

# References
+ [nodes](https://kubernetes.io/docs/concepts/architecture/nodes/)
+ [pods](https://kubernetes.io/docs/concepts/workloads/pods/)
+ [controllers](https://kubernetes.io/docs/concepts/architecture/controller/)
+ [kubelet](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/)
+ [kube-scheduler](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-scheduler/)
+ [service](https://kubernetes.io/docs/concepts/services-networking/service/)
+ [kubernetes 简介：service 和 kube-proxy 原理](https://cizixs.com/2017/03/30/kubernetes-introduction-service-and-kube-proxy/)
+ [Kubernetes Crash Course for Absolute Beginners [NEW]](https://www.youtube.com/watch?v=s_o8dwzRlu4)
+ [Docker Swarm vs Kubernetes: A Practical Comparison](https://betterstack.com/community/guides/scaling-docker/docker-swarm-kubernetes/#comparing-docker-swarm-and-kubernetes)
+ [Bash: Loop until command exit status equals 0](https://stackoverflow.com/questions/21982187/bash-loop-until-command-exit-status-equals-0)
+ [Defaulted container "container-1" out of: container-1, container-2](https://stackoverflow.com/questions/74552547/defaulted-container-container-1-out-of-container-1-container-2)
