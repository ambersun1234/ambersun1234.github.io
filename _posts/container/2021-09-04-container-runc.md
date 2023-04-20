---
title: Container 技術 - runC, containerd 傻傻分不清
date: 2021-09-04
categories: [container]
tags: [docker, kubernetes, linux]
math: true
---

# 容器化技術
隨著 microservice 的發展，容器化技術在近幾年受到了廣大的歡迎\
相較於傳統的虛擬機器(virtual machine)， container 擁有著輕量，快速等特性 隨即受到了開發者們的喜愛\
而其中最廣為人知的便是 [Docker](https://www.docker.com/)\
本文並不會贅述 Docker 工具的使用，我們將以其探討 container 背後的故事

# OCI(Open Container Initiative)
在 2013 年 Docker 剛開始流行的時候，container 並沒有太多相關規範，而這造成了一些問題\
比如說像是 [kubernetes](https://kubernetes.io/) 以及其他第三方工具為了要能夠使用 Docker 的 "部分" 功能而必須 bypass 一些沒必要的功能(注意到這時候 Docker 的實作並沒有拆開成為獨立專案)，這使得一切都變得相當的複雜

所以在 2015 年的時候，Docker, CoreOS 與其他容器化工業的人一起啟動了 [OCI - Open Container Initiative](https://opencontainers.org/) 專案(collaborative project at [Linux foundation](https://www.linuxfoundation.org/))\
其目的在於說制定一系列 `標準化` 的 container spec，而 Docker 作為 container 的領航者也在制定標準時提供了 container format 以及 container runtime([runC](https://github.com/opencontainers/runc)) 作為 OCI 制定規範時的基石

OCI 最主要制定了兩個規範

- [Runtime spec](https://github.com/opencontainers/runtime-spec/blob/master/spec.md): 關於作業系統如何 run container(包含執行環境、configuration 以及 lifecycle)
- [Image spec](https://github.com/opencontainers/image-spec/blob/main/spec.md): 關於如何建立、準備 container image(包含像是 參數、指令以及環境變數等等)

而後 Docker 將其實作拆分出 containerd(high level runtime) 以及 runC(low level runtime)\
![](https://i.stack.imgur.com/hFsHT.png)\
至此，Docker 的 image 以及 runtime 都符合了 OCI 規範\
除了 Docker 本身的 runc, 還有以下 runtime

- [crun](https://github.com/containers/crun)
- [kata-runtime](https://github.com/kata-containers/runtime)

既然 Docker image 符合了 OCI 規範，那麼我是不是可以使用其他 runtime 跑起來呢?

# CRI(Container Runtimer Interface)
前面不是已經將 container 的規格都定義好了嗎? 為甚麼這裡又跑出來一個 CRI 呢?\
[CRI](https://kubernetes.io/blog/2016/12/container-runtime-interface-cri-in-kubernetes/) 是 [kubernetes](https://kubernetes.io) 為了要支援各種不同的 runtime 所開發的 plugin(在 [kubernetes 1.5 Alpha](https://kubernetes.io/blog/2016/12/kubernetes-1-5-supporting-production-workloads/) 中釋出)

注意到 k8s 不與 Docker 完全綁定使用，使用者可以依據不同情況套用不同 runtime\
![](https://cl.ly/3I2p0D1V0T26/Image%202016-12-19%20at%2017.13.16.png)

只要符合 CRI 介面的 runtime 都可以跑在 kubernetes 上\
例如

- [rtk](https://github.com/rkt/rkt)
- [containerd](https://www.ptt.cc/bbs/Gossiping/M.1630739586.A.572.html?fbclid=IwAR16D1DJYMXbc8NQTODNQTMKT7Ec7tFUUd0ynLwIxx3_jIuxLX7TKQ-scf0)
  > cri is a containerd plugin implementation of the Kubernetes container runtime interface (CRI). With it, you are able to use containerd as the container runtime for a Kubernetes cluster.
- [kata-runtime](https://github.com/kata-containers/runtime#introduction)
  > The runtime is OCI-compatible, CRI-O-compatible, and Containerd-compatible, allowing it to work seamlessly with both Docker and Kubernetes respectively.
- [CRI-O](https://github.com/cri-o/cri-o#what-is-the-scope-of-this-project)
  > CRI-O is meant to provide an integration path between OCI conformant runtimes and the kubelet. Specifically, it implements the Kubelet Container Runtime Interface (CRI) using OCI conformant runtimes. The scope of CRI-O is tied to the scope of the CRI.

所以 k8s 可以達成動態更換 runtime 而不用重新編譯\
![](https://www.tutorialworks.com/assets/images/container-ecosystem-cri.drawio.png)

# Reference
- [What Is containerd, And How Does It Relate to Docker and Kubernetes?](https://www.cloudsavvyit.com/10075/what-is-containerd-and-how-does-it-relate-to-docker-and-kubernetes/)
- [How containerd compares to runC](https://stackoverflow.com/questions/41645665/how-containerd-compares-to-runc)
- [The differences between Docker, containerd, CRI-O and runc](https://www.tutorialworks.com/difference-docker-containerd-runc-crio-oci/#open-container-initiative-oci)
- [Introducing Container Runtime Interface (CRI) in Kubernetes](https://kubernetes.io/blog/2016/12/container-runtime-interface-cri-in-kubernetes/)
- [Kubernetes 1.5: Supporting Production Workloads](https://kubernetes.io/blog/2016/12/kubernetes-1-5-supporting-production-workloads/)
