---
title: Kubernetes 深入淺出 (1) - Overview
date: 2021-10-24
categories: [kubernetes]
tags: [container]
math: true
---

# Introduction to Kubernetes
現今網頁服務由於 container 的興起，大幅度的改變了整個 web 的生態系，一切都圍繞著 container\
雖然說 container 改變了開發者的工作流程，使得大部分得以簡化，但是仍有一些問題依然存在

比如說： 當服務有 bug 導致系統停機、當系統要更新而必須停機、當服務撐不住需要手動開機器用以應付大流量的時候\
以上這些情況若以單純的 docker 可是無法順利解決的

你可能會說 我可以使用 [docker-compose](https://docs.docker.com/compose/) 進行系統搬遷與管理等等的\
但是遇到多主機運行的情況下(cluster)， docker-compose 也顯得力不從心

[docker swarm](https://docs.docker.com/engine/swarm/) 雖然可以解決以上問題，不過呢由於一些些微的差異(本文不加以贅述)，使得 [kubernetes](https://kubernetes.io) 更為適合

# Deployment Evolution
![](https://d33wubrfki0l68.cloudfront.net/26a177ede4d7b032362289c6fccd448fc4a91174/eb693/images/docs/container_evolution.svg)
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
    + 相比 virtual machine, container 解決了效能問題，主要是透過了 `share operating system` 的方式，詳細可以參考 [Container 技術 - 深入理解 Docker Container \| Shawn Hsu](../../container/container-docker)

# Kubernetes Cluster
![](https://d33wubrfki0l68.cloudfront.net/2475489eaf20163ec0f54ddc1d92aa8d4c87c96b/e7c81/images/docs/components-of-kubernetes.svg)
kubernetes 的架構是 cluster, 即透過很多個節點(node, 可以把他想像成若干個實體電腦)組成的運算單元\
以下將一一介紹各個組成單元

## Control plane
因為 k8s 本體其實是 cluster 架構, 因此我們需要一個類似控制中樞的角色(大腦) 即 `control plane`\
control plane 必須管理底下所有的 node 用以進行諸如 scheduling 等的決策事項\
在 control plane 裡面還有若干服務
+ `kube-apiserver`
    + 提供 kubernetes API 用以管理整個 k8s cluster
+ `etcd`
    + 用以儲存所有 cluster information data
+ `kube-scheduler`
    + 排程器，用以安排新的 pod 要跑在哪一個 node 上
    + 排程器會自動挑選合適的 node 並且將 pod 安排在該 node 上面
+ `kube-controller-manager`
    + 對於 k8s cluster 來說，我們需要一個 [controller](https://kubernetes.io/docs/concepts/architecture/controller/) 用以監控 cluster 的 `state(狀態)`
    + 透過 controller 這個 process 一點一點的將 cluster state 導向 desired state

# Node
node(節點) 是組成 cluster 的重要單位，節點可以是 `virtual machine` 或者是 `physical machine`\
每一個 node 都是由 control plane 直接控制的, 而 node 裡面包含有 [pod](#pod) 用以運行 container

node 包含了以下的組成元件
+ `kubelet`
    + 為一 node agent，負責管理底下 pod 的狀態(包含: pod 有沒有正常運行，pod 的生理狀態 健不健康之類的) 以及 將 node 註冊到整個 cluster 裡面
+ `kube-proxy`
    + 前面提到 pod 是根據 kube-scheduler 進行排程安排到特定的 node 上，值得注意的是 `pod 是會變動的`(主要是根據 hardware/software/policy contrains, affinity, anti-affinity specifications, data locality, inter-workload 等等的影響)
    + 所以說 pod 的 ip 是會變動的，而若是主機 ip 變動，對於客戶端的使用來說會是極度麻煩的事情, 也因此 `kube-proxy` 就是為了解決這件事情的
    + kube-proxy 是跑在每一個 node 上面的 network proxy, 為了解決動態 ip 的問題，k8s 將 `set of pods` 構築成 ***虛擬的 network service***, 賦予外界一個固定訪問 pod 的通道
    + 如此一來，即使後端的 pod 由於 scheduler 排程的關係移動到其他 node 上，對於前端來說仍然沒有影響！
+ `container runtime`
    + 注意到一件事情，k8s 不單單只支援 docker, 事實上，它支援許多種的 container runtime 如 [docker](https://kubernetes.io/docs/concepts/workloads/pods/), [containerd](https://containerd.io/docs/), [kata-runtime](https://github.com/kata-containers/runtime) ... etc.
    + 為了支援各項平台，k8s 有自己的一套 [Kubernetes CRI (Container Runtime Interface)](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-node/container-runtime-interface.md) 界面，用以支援各種不同的 runtime

    > 有關 container runtime 的介紹可以參考 [Container 技術 - runC, containerd 傻傻分不清 \| Shawn Hsu](../../container/container)

# Pod
pod 是 k8s 中最小可部屬單元，注意到不是 container 哦\
pod 是由一系列的 spec 定義出來的(裡面包含像是 image 資訊、metadata, ports ... etc.)\
pod 裡面可以包含 一個或多個 container, 所有的 container 共享 儲存空間、網路等等的
> 通常的作法會是一個 pod 裡面僅僅會包含一個 container

有點類似 docker-compose 啦我個人覺的

# Reference
+ [nodes](https://kubernetes.io/docs/concepts/architecture/nodes/)
+ [pods](https://kubernetes.io/docs/concepts/workloads/pods/)
+ [controllers](https://kubernetes.io/docs/concepts/architecture/controller/)
+ [kubelet](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/)
+ [kube-scheduler](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-scheduler/)
+ [service](https://kubernetes.io/docs/concepts/services-networking/service/)
+ [kubernetes 简介：service 和 kube-proxy 原理](https://cizixs.com/2017/03/30/kubernetes-introduction-service-and-kube-proxy/)
