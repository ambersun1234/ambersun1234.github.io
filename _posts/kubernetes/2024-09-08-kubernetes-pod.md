---
title: Kubernetes 從零開始 - 容器基本抽象 Pod
date: 2024-09-08
categories: [kubernetes]
tags: [pod, container, lifecycle, node, binding, ephemeral, scale, scheduling, workloads]
description: 為什麼 Pod 不適合直接操作？這跟它的生命週期有關嗎？ 本文將會探討 Kubernetes 中的基本組成 Pod 並且介紹 Pod 的基本特性以及提及 container 的基本抽象如何幫助我們管理容器
math: true
---

# Abstraction over Container
Pod 其實是為了更好的管理 Container 而生的一層抽象層\
所以他同時也是最小的部署單位(注意到不是 Container)

既然他是一層管理容器的環境\
他具有一定的特性如，所有同一個環境下的 Container 都擁有相同的網路環境，可以存取相同的 Volume 資料等等的\
並且也可以一起被執行排程\
事實上你可以把它看待成是 `logical host`

這也意味著他可以被一起管理，這也是為什麼我們會用 Pod 來管理 Container

# Introduction to Pod
Pod 簡單的理解，就只是一個提供一個或多個容器執行的環境(當然也提供了一些進階的功能)\
然後同一個環境下，他們可以一起 share Volume，網路等等的資源

> 多個 Container 的設計是比較少見的，一般來說 Pod 只會有一個 Container\
> 如果要做 Scale, 正確的做法是增加 Pod 數量，而不是增加 Container 數量

> scaling 可以參考 [資料庫 - 初探分散式資料庫 \| Shawn Hsu](../../database/database-distributed-database#scale-outhorizontal-scale)

## How does Pod Scheduled
容器的執行，在 Kubernetes 來說是執行在 `Node` 之上的\
Pod 是容器的抽象層，同時也是用於執行容器環境的抽象層，但是真正執行的地方是在 Node 上

> Node 是一台真正的機器，可以是 VM，也可以是實體機器

要執行的時候，Kubernetes 會將 Pod schedule 到任一 "健康" 的 Node 上(這個過程稱為 `binding`)\
節點不健康的意思是，他可能網路是壞的，硬碟掛了之類的

Kubernetes v1.31 之後，你可以指定 Pod 要執行在哪一個 Node 上\
根據不同的實體機器，他的底層可以是 Linux 或是 Windows

## Pod Lifecycle
Pod 被設計成是相對短命並且可以被隨時丟棄的 entity\
他不是被用來執行長時間的服務的

用 Pod 然後期待有 Self Healing 是不現實的\
Pod 只會 **schedule 一次**，注意到不是執行一次\
並且，前面提到 Pod 是執行在 Node 之上的，所以當 Node 掛掉的時候，Pod 也會跟著掛掉，也不會被重新排程執行

> 一個 pod 一生只會在一個 node 上執行，不會跑到其他 node 上

> 當 pod 還沒有開始執行，node 就因為某些原因掛掉，pod 也 `不會` 被重新排程

當他失敗的時候，狀態上會被標註成 `Failed`\
並且 timeout 之後會由 Controller 進行 `GC(Garbage Collection)`

<hr>

事實上你可以重新 deploy 一個一模一樣的 pod 進 cluster\
但是他只是長的一樣，並不代表他是同一個 pod\
也就是說他的環境是不同的，也沒辦法存取到之前的資料\
他也不一定會在一樣的 node 上執行(因為 scheduler 會選擇健康的節點)

以下圖來說，Volume 也會被刪除(如果 pod 被刪除)

<img src="https://kubernetes.io/images/docs/pod.svg" width="200" height="200">

> ref: [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)

## Why you Shouldn't Directly Invoke Pod
在上面我們提到了許多關於 Pod 的基本特性\
你可以發現到，直接手動去操作他不是一個好的選擇

最大的問題在於，Pod 是一個相對短命的 entity\
並且失敗的時候也沒辦法自動重啟\
因此，通常我們會使用不同的高階抽象(稱為 workloads)如 `Deployment` 來管理 Pod

# Pod Template
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: my-echo-app
      image: busybox:1.28
      command:
        [
          "sh", "-c", "echo 'hello from busy box'; exit 0"
        ]
```

這是一個簡單的 Pod Template\
注意到他跟其他 workloads 的 template 寫法不太一樣\
這個例子就是一個簡單的 echo app

```shell
$ kubectl get pods
NAME     READY   STATUS      RESTARTS     AGE
my-pod   0/1     Completed   1 (1s ago)   1s
```

要小心一件事情是，執行你要的東西之後必須要有一個 `exit 0`\
不然他會一直重啟(`CrashLoopBackOff`)

```shell
$ kubectl get pods
NAME     READY   STATUS             RESTARTS      AGE
my-pod   0/1     CrashLoopBackOff   2 (16s ago)   41s
```

如果是以 `kind: Deployment` 來說會長這樣
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: views-deployment
  labels:
    app: views-app
spec:
  selector:
    matchLabels:
      app: views-app
  template:
    metadata:
      labels:
        app: views-app
    spec:
      volumes:
        - name: credential
          configMap:
            name: views-config
            items:
              - key: credential.json
                path: credential.json
      initContainers:
        - name: redis-stabilized
          image: busybox:1.28
          command:
            [
              "sh",
              "-c",
              'until nc -z redis-service 6379; do echo $(date "+%Y-%m-%d %H:%M:%S") waiting...; sleep 1; done;'
            ]
      containers:
        - name: views
          image: views-service:latest
          ports:
            - containerPort: 8888
          imagePullPolicy: "IfNotPresent"
          volumeMounts:
            - name: credential
              mountPath: "/credential.json"
              subPath: credential.json
          env:
            - name: GOOGLE_APPLICATION_CREDENTIALS
              value: "/credential.json"
```

> 完整範例可參考 [ambersun1234/count-page-views](https://github.com/ambersun1234/count-page-views)

pod 有關的設定，像是你要跑的 image, 需要的環境變數等等\
基本上是寫在 `spec.template` 底下\
以這個例子你可以看到有 `initContainers`, `containers` 還有 `volumes` 的設定

> 基礎語法可參考 [Kubernetes 從零開始 - 無痛初探 K8s! \| Shawn Hsu](../../kubernetes/kubernetes-basic)

基本上語法不用硬記，你有辦法理解每一個的意思，要寫的時候再查就好了

# Init Containers and Sidecar Containers
## Init Containers
pod 除了主要執行的 container 之外，你可以設定所謂的 `init containers` 用於執行初始化相關的功能\
比方說 web server 啟動之前要先確定你的 rabbitmq 已經啟動了\
你可以這樣寫

```yaml
initContainers:
  - name: redis-stabilized
    image: busybox:1.28
    command:
      [
        "sh",
        "-c",
        'until nc -z redis-service 6379; do echo $(date "+%Y-%m-%d %H:%M:%S") waiting...; sleep 1; done;'
      ]
    resources:
      limits:
        memory: "256Mi"
        cpu: "500m"
```

所以他的執行順序會是 initContainers :arrow_right: containers\
然後我們說過 pod 是提供一個環境，所以理論上他們都可以共享彼此的資源\
但以這個例子來說是有困難的，因為 initContainers 會在 containers 之前執行\
等於說他們兩個的執行時間是沒有重疊到的\
因此傳輸資料只能是 **單向的**(從 initContainers 到 containers)

## Sidecar Containers
sidecar container 這個名詞我有點陌生\
假設你的主要服務是 web server，然後你想要一個 container 來做 log 的收集\
這個時候你可以開另一個 container 來做 log 的收集\
所以你會有兩個 container 一起執行在同一個 pod 上, app 以及 log container

log container 就可以被稱之為 sidecar container\
他是主要服務的附屬 container\
因為是附屬的，所以理論上需要一起執行，也一樣，可以共享彼此的資源\
有別於 init containers 只能進行單向資料傳輸，因為 sidecar containers 是一起執行的，所以他們可以進行雙向資料傳輸

sidecar container 有兩種寫法
```yaml
containers:
- name: app
    image: busybox
    command: ['sh', '-c', 'echo Hello Kubernetes! && sleep 3600']
- name: logshipper
    image: alpine:latest
    restartPolicy: Always
    command: ['sh', '-c', 'tail -F /opt/logs.txt']
    volumeMounts:
    - name: data
        mountPath: /opt
```

很常見的做法是使用多個 container 放在一起\
雖然實務上推薦一個 pod 只有一個 container\
但這樣做也是可以的

另一種則是使用 [Init Containers](#init-containers) 來實作
```yaml
initContainers:
- name: logshipper
    image: alpine:latest
    restartPolicy: Always
    command: ['sh', '-c', 'tail -F /opt/logs.txt']
    volumeMounts:
    - name: data
        mountPath: /opt
```

## Sidecar Inside Init Containers?
多個 container 的寫法會有什麼問題？\
因為你無法保證他們的執行順序\
所以你可能會遇到這樣的問題，log collector 先執行，但是 app 還沒有啟動\
如果你使用其他 workloads 他可以自動幫你管理失敗的情況\
不過他仍然是一個 workaround

`initContainers` 的寫法注意看，差別只在 `restartPolicy: Always`\
對！ sidecar container 是 init container 的特例！\
sidecar container 在 init container 結束之後仍會繼續執行\
所以這時候 sidecar 就可以跟 app container 一起執行

要注意到的是，sidecar container 的狀態(initContainers 的寫法)是不會影響到 pod 的狀態的\
也就是說 app container 仍然可以順利的結束\
他們的生命週期是獨立的

# References
+ [Kubernetes 1.28 Sidecar Container 初體驗](https://www.hwchiu.com/docs/2023/k8s-1-28-sidecar)
+ [Sidecar Containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/#differences-from-application-containers)
+ [Pods](https://kubernetes.io/docs/concepts/workloads/pods/#pod-templates)
+ [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle)
+ [Kubernetes v1.28: Introducing native sidecar containers](https://kubernetes.io/blog/2023/08/25/native-sidecar-containers/)
