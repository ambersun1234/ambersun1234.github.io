---
title: Kubernetes 從零開始 - Pod 高級抽象 Workload Resources
date: 2025-11-23
categories: [kubernetes]
tags: [deployment, statefulset, daemonset, job, cronjob, replicaset, abstraction, workload, workload resources, resources, rolling update, indexed job, job completion mode, headless service]
description: 本文將會介紹 Kubernetes 中的高階抽象 Workload Resources，並且介紹他們的特性以及如何使用
math: true
---

# High Level Abstraction
之前提到 Pod 是 Kubernetes 當中部署的最小單位，因為其設計關係(比如說容易被 reschedule 以及被刪除等等)，是比較不適合直接操作的\
因此 Kubernetes 提供了更高層次的抽象，讓我們可以更方便的管理 Pod\
本文將會走過一遍這些更高階的抽象實作，並且介紹他們的特性

> 可參考 [Kubernetes 從零開始 - 容器基本抽象 Pod \| Shawn Hsu](../../kubernetes/kubernetes-pod)

# Workload, Workload Resources and Resources
## Workload
一個執行在 Kubernetes 上的應用程式，稱之為 Workload

## Workload Resources
比方說剛開始認識 Kubernetes 的時候，你會使用 Deployment 建構你的前後端服務\
[Deployment](#deployment) 就是其中的一種，也是最常見的 [Workload Resources](#workload-resources)

與直接操作 Pod 不同，[Workload Resources](#workload-resources) 提供了更高階的抽象，讓你可以更方便的管理 Pod\
假設該節點發生故障，那上面的 Pod 都會被消失嘛，透過 Controller 它會自動幫你恢復到預期狀態\
等於說讓 Kubernetes 幫我們管理全部的狀態\
我們就能夠專注在應用程式的開發上

> 有關 Controller 可以參考 [Kubernetes 從零開始 - 從自幹 Controller 到理解狀態管理 \| Shawn Hsu](../../kubernetes/kubernetes-controller)

除了基本的 Workload Resource 之外，為了讓開發者能有更彈性的資源管理\
`Custom Resource Definition(CRD)` 被引入了\
利用 CRD 你可以定義自己的 Resource 將它利用於你的應用程式中\
所以 CRD 也可以算是 Workload Resource 的一種

> 有關 CRD 可以參考 [Kubernetes 從零開始 - client-go 實操 CRD \| Shawn Hsu](../../kubernetes/kubernetes-crd)

## Resources
注意到 [Workload Resources](#workload-resources) 與 [Resources](#resources) 之間的差異\
[Resources](#resources) 泛指所有你可以在 Kubernetes 中使用的物件，而 [Workload Resources](#workload-resources) 是其中一個類別\
像是你可能有印象的 `ConfigMap`, `Secret`, `Service` 等等都是所謂的 Resource\
你可以用 `$ kubectl api-resources` 來查看所有的 Resources

```shell
$ kubectl api-resources
NAME                              SHORTNAMES   APIVERSION                        NAMESPACED   KIND
bindings                                       v1                                true         Binding
configmaps                        cm           v1                                true         ConfigMap
endpoints                         ep           v1                                true         Endpoints
events                            ev           v1                                true         Event
limitranges                       limits       v1                                true         LimitRange
namespaces                        ns           v1                                false        Namespace
nodes                             no           v1                                false        Node
persistentvolumeclaims            pvc          v1                                true         PersistentVolumeClaim
persistentvolumes                 pv           v1                                false        PersistentVolume
pods                              po           v1                                true         Pod
podtemplates                                   v1                                true         PodTemplate
replicationcontrollers            rc           v1                                true         ReplicationController
resourcequotas                    quota        v1                                true         ResourceQuota
secrets                                        v1                                true         Secret
serviceaccounts                   sa           v1                                true         ServiceAccount
services                          svc          v1                                true         Service
apiservices                                    apiregistration.k8s.io/v1         false        APIService
controllerrevisions                            apps/v1                           true         ControllerRevision
daemonsets                        ds           apps/v1                           true         DaemonSet
deployments                       deploy       apps/v1                           true         Deployment
replicasets                       rs           apps/v1                           true         ReplicaSet
statefulsets                      sts          apps/v1                           true         StatefulSet
selfsubjectreviews                             authentication.k8s.io/v1          false        SelfSubjectReview
tokenreviews                                   authentication.k8s.io/v1          false        TokenReview
```

> 也可以用 `$ kubectl api-versions` 查看所有支援的版本\
> api-resources 只會列出最低支援的版本，如果同時有多個版本，需要 api-versions 來確認

# Brief Introduction to Workload Resources
## ReplicaSet
在 [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 有寫一句話 `A Deployment provides declarative updates for Pods and ReplicaSets.`\
我們已知 Pod 是最小的部署單位，也可以說是整個 Kubernetes Cluster 的基礎，但現在看起來 ReplicaSet 好像也是 low level abstraction?

ReplicaSet 是用來維護一定數量的 Pod\
這些 Pod 是使用相同的 template 定義的，亦即所有內部執行的東西是一樣的\
這些 Pods 被稱之為 **replica**

### Why Manage ReplicaSet through Deployment?
ReplicaSet 貴為一種 [Workload Resources](#workload-resources)，他的目的是確保一定數量的 Pod 在運行\
但是為什麼文件希望我們使用 Deployment 而不是 ReplicaSet 呢？\
ReplicaSet 沒辦法做到 declarative update, 所以他彈性沒有到那麼高\
因此官方才會推薦使用 [Deployment](#deployment) 來管理 ReplicaSet

只有當
1. 你需要 customize 更新策略
2. 不需要任何更新

的時候，你才應該使用 ReplicaSet

> 所以 ReplicaSet 並不是 low level abstraction, 他只是一個比較基礎的 workload resource

## Deployment
針對不需要管理狀態的 service, 你可以使用 deployment\
狀態是啥意思？ 簡單的想法是，能夠被丟掉重開然後不會有任何影響的服務，就稱為不需要管理狀態的服務

資料庫，cache 這些基本上會認定為需要管理狀態的\
因為他底層是需要儲存資料在硬碟上的，如果 scheduler 把它排到另一台機器上，那資料就會不見了\
因此這種服務，就要避免使用 deployment

相反的，像是 backend server 這種，如果沒有使用 session 之類的來管理，那本質上他也是 stateless 的\
因此很適合放在 deployment 裡面\
scheduler 可以根據不同的需求將 backend server 安排到不同的機器上，同一時間也不會影響到服務的運作

### Stateless Matters
Deployment 可以管理一或多個 Pod 的狀態，而他們通常是 stateless 的服務

> 你也可以跑 Redis 在 Deployment 上面這樣也不是不行

k8s Controller 會幫你管理 Deployment 的狀態，將他逐步的往你想要的狀態靠近\
簡單來說，我預期要有 3 個 Pod 在運行，但是現在只有 2 個，那 Controller 會幫你自動的補上那一個 Pod\
Controller 會根據你定義好的 **理想的狀態**，逐步的實現，並且在達到之後保持在那個狀態\
當出錯的時候，Controller 也會自動的幫你修復

> k8s 是屬於 declarative programming 也就是告訴你想要的狀態，具體要怎麼做我不管

## StatefulSet
說 StatefulSet 就是 [Deployment](#deployment) 加上狀態其實不準確\
我原本以為單純的就是可能 volume 之類的狀態，事實上 StatefulSet 管理的狀態不只如此

考慮以下
+ Pod 在設計上就是可以被隨時丟棄的，換言之，如果它被丟棄了，它就不是原本的那個 Pod 對吧
+ 如果使用 [Ephemeral Volume](../../kubernetes/kubernetes-volume#ephemeral-volume)，當 Pod 被重新排程，它就不是原本那個 Ephemeral Volume 了對吧
+ 如果透過 Service 訪問一群 Pods，下一次能確定訪問到的是原本的那個 Pod 嗎？
+ 如果啟動順序不同，對於這整組 Pods 來說，是不是也可以視為是不同的？

以上這些問題，是 `StatefulSet` 要解決的\
它想要確保的是，我訪問的、存取的以及連線的，都要是原本的那個\
大致上可以歸類為，"穩定的" 以及 "有序的"\
符合以上就可以考慮使用 `StatefulSet`

針對上述提問，解決辦法如下
+ 給予每一個 Pod 一個 unique 的名字(i.e. `pod-0`, `pod-1`, ... `pod-N`)，我們就當作他是相同的
    + 可是 Pod 生命是短暫的這件事情還是成立阿？ 它還是會被刪除或重新排程\
      相同的 identity 才是重點，因為這個 identity 有可能需要跟其他穩定資源綁定之類的，如 [Persistent Volume](../../kubernetes/kubernetes-volume#persistent-volume)
+ `volumeClaimTemplates` 允許 StatefulSet 獨立生成一個 PVC，每個獨立的 Pod 都有一個獨立的 PVC，進而取得獨立的 PV
    + 其實你也可以單純的用單一 Volume，共享 PV(存取模式可能要稍微注意就是)
+ service 有一種東西叫做 [Headless Service](https://kubernetes.io/docs/concepts/services-networking/service/#headless-services)，你可以直接透過 domain name 的方式直接連到 Pod 本身
    + 比如說 `redis-master.default.svc.cluster.local` 這種，原本是 Service name 開頭嘛，但因為你需要直接指定 Pod 本身，所以就變成 Pod name 開頭。以這個例子來說就是有一個 Pod 叫做 `redis-master`
    + 即使你可以用 domain name 的方式存取，不代表有 load balancing 的功能、cluster IP 或者 kube-proxy 處理的功能。它只是單純的把 domain name 轉換成 ip address 而已
+ 啟動、刪除以及更新順序會嚴格遵照 0 到 N - 1 的順序，啟動的時候是升冪，刪除的時候是降冪
    + 如果前一個沒啟動成功，下一個就會卡住，如果設定不當，可能會導致整組服務無法正常運作(可參考 [正式環境上踩到 StatefulSet 的雷，拿到 P1 的教訓](https://pin-yi.me/blog/kubernetes/k8s-statefulset-podmanagementpolicy/))

> 有關 volume 相關可以參考 [Kubernetes 從零開始 - 你的 Volume 到底 Mount 到哪裡去了？ \| Shawn Hsu](../../kubernetes/kubernetes-volume)

## DaemonSet
daemon 在計算機當中通常指的是背景程式如 `sshd`\
Kubernetes 中，DaemonSet 就是跑在每個節點上的應用程式\
注意到，是 ***每個節點***

這些應用程式通常是 node-level 的設施，像是節點等級的 logging, monitoring 等等

那為什麼不直接在節點寫啟動 script?\
擁有統一的管理機制是比較方便的，相同的設定語言，相同的習慣

至於 Pod 呢？ 由於其短暫生命週期，執行 daemon 類的服務並不是一個好的選擇\
這樣說，是不是 [Deployment](#deployment) 也能做到？ 是的，但是 Deployment 並不是最佳選擇\
我們說 DaemonSet 會部署在 "每一個節點" 上，[Deployment](#deployment) 無法輕易做到

縱使 node affinity 以及 node selector 可以做到\
但是變成你要針對每一個節點寫 node selector，這樣你要維護的東西會變很多，而且幾乎長一樣\
當有一個節點新增進 cluster 的時候，[Deployment](#deployment) 需要手動更新 yaml 來部署新的節點\
所以才有 DaemonSet 的出現

## Jobs and CronJob
針對單次的任務，使用 `Job` 會是合理的選擇\
為什麼不用 Pod? 答案還是一樣，因為 Pod 的生命週期是短暫的，況且如果遇到那種要重試幾次的任務也不合適

Job 本身可以設定幾個有意思的參數\
比如說 `.spec.completions` 以及 `.spec.parallelism`\
你需要完成這個任務幾次就是 completions，同時執行幾個就是 parallelism\
另外還有 `.spec.suspend` 可以停止 Job 的執行

針對那種要平行處理的任務，parallelism 可以很方便的做到\
不過，每個 Pod 執行一樣的任務嗎？ 其實有時候你想要的是每個 Pod 執行一小部份的內容\
在 Kubernetes 1.21 中引入了 [Indexed Job](https://kubernetes.io/blog/2021/04/19/introducing-indexed-jobs/) 的概念

其實概念滿簡單的，就是給每一個 Pod 一個 index，在設計上你就可以根據 index 來分配任務(i.e. `0` ~ `N - 1`)\
有了它，你就不需要額外設置一個 work queue 來分配任務\
說是這樣說，等於你在 code 裡面需要自己根據 index 來分配任務，有點麻煩

這部份是透过指定 `.spec.completionMode` 來實現的\
預設情況下是 `NonIndexed` 但你不需要特別寫上去

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: 'sample-job'
spec:
  completions: 3
  parallelism: 3
  completionMode: Indexed
  template:
    spec:
      restartPolicy: Never
      containers:
      - command:
        - 'bash'
        - '-c'
        - 'echo "My partition: ${JOB_COMPLETION_INDEX}"'
        image: 'docker.io/library/bash'
        name: 'sample-load'
```

<hr>

至於說重複的任務，Kubernetes 也有 `CronJob`\
寫法與 Job 類似，最大的差別就是要設定排程(i.e. `.spec.schedule`)\
語法與 crontab 一致

## Comparison

|Workload Resource|Goal|State|
|:--|--:|--:|
|[ReplicaSet](#replicaset)|提供足夠數量的 Pod，需要客製化策略的時候適用|:x:|
|[Deployment](#deployment)|提供足夠數量的 Pod，底下是 [ReplicaSet](#replicaset)|:x:|
|[StatefulSet](#statefulset)|給予穩定的 Pod、儲存空間以及網路|:heavy_check_mark:|
|[DaemonSet](#daemonset)|部屬於每個節點上|:heavy_check_mark:|
|[Job/CronJob](#jobs-and-cronjob)|一次或多次重複的任務|:heavy_check_mark:|

# Rolling Update for Workload Resources
對於高階的 Workload Resources，最重要的是服務不中斷\
[Deployment](#deployment), [StatefulSet](#statefulset) 以及 [DaemonSet](#daemonset) 都支援 Rolling Update

Rolling Update 的意思是，逐步更新你的服務，至少有一個 Pod 是可以服務使用者的\
所以看起來就像是沒有中斷過一樣\
針對部屬策略，可以參考 [Kubernetes 從零開始 - 部署策略 101 \| Shawn Hsu](../../kubernetes/kubernetes-scale)\
這邊專注於 "怎麼做"

> 注意到只有更新 label 或者是 Pod template 才會觸發 Rolling Update\
> 更新 replica 數量並不會觸發 Rolling Update

## Rolling Update Example
先建立一個 Deployment 來測試
```shell
$ kubectl create deployment dd --image nginx:1.16.1 --replicas 3
```

更新 Deployment 所使用的 image 為 `nginx:1.14.2`\
可以 `$ kubectl set` 或是 `$ kubectl edit` 來更新\
如果你同步觀察 Pod 的狀態，應該可以觀察到一上一下的現象

然後你可以透過 `$ kubectl rollout status` 來查看 Rolling Update 的狀態\
以及 `$ kubectl rollout history` 來查看 Rolling Update 的歷史

```shell
$ kubectl rollout history deployment dd 
deployment.apps/dd 
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

很顯然，這種 revision 資訊滿簡陋的\
指定 revision 可以查看該 revision 的詳細資訊

```shell
$ kubectl rollout history deployment dd --revision 1
deployment.apps/dd with revision #1
Pod Template:
  Labels:       app=dd
        pod-template-hash=844587458f
  Containers:
   nginx:
    Image:      nginx:1.16.1
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>
  Node-Selectors:       <none>
  Tolerations:  <none>
```

```shell
kubectl rollout history deployment dd --revision 2
deployment.apps/dd with revision #2
Pod Template:
  Labels:       app=dd
        pod-template-hash=6b88c4858d
  Containers:
   nginx:
    Image:      nginx:1.14.2
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>
  Node-Selectors:       <none>
  Tolerations:  <none>
```

另外，在更新的時候其實也可以暫停的

```shell
$ kubectl rollout pause/resume deployment dd
deployment.apps/dd paused/resumed
```

## Revert the Update
你可以透過 `$ kubectl rollout undo` 來回退到上一個 revision\
或者如果你要跳到特定的 revision，可以加上 `--to-revision` 參數

```shell
$ kubectl rollout undo deployment dd --to-revision 1
deployment.apps/dd rolled back
```

# Scaling Workload Resources
Scaling 就是調整 replica 的數量\
在 Kubernetes 中，[Deployment](#deployment), [StatefulSet](#statefulset) 以及 [DaemonSet](#daemonset) 都支援 Scaling\
以 [Deployment](#deployment) 為例，可以手動設定 yaml 中的 `replicas` 數量

```shell
$ kubectl scale deployment dd --replicas 5
deployment.apps/dd scaled
```

抑或者是使用 Autoscaler，注意到是 Horizontal Pod Autoscaler(HPA)\
而不是 Vertical Pod Autoscaler(VPA)

```shell
$ kubectl autoscale deployment dd --min=1 --max=10 --cpu-percent=50
horizontalpodautoscaler.autoscaling/dd autoscaled
```

> 可以參考 [Kubernetes 從零開始 - 部署策略 101 \| Shawn Hsu](../../kubernetes/kubernetes-scale)

# References
+ [Workloads](https://kubernetes.io/docs/concepts/workloads/)
+ [Workload Management](https://kubernetes.io/docs/concepts/workloads/controllers/)
+ [Kubernetes: what's the difference between Deployment and Replica set?](https://stackoverflow.com/questions/69448131/kubernetes-whats-the-difference-between-deployment-and-replica-set)
+ [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
+ [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/)
+ [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)
+ [Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
+ [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
