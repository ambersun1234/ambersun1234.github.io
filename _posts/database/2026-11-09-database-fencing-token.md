---
title: 資料庫 - 怎麼避免任務重做，甚至是任務競爭？
date: 2026-11-09
categories: [database]
description: 本文會複習我們一路以來處理任務競爭的各種手法，並做個總結每個方法的優缺點，到最後你會發現，真正好的系統是每種手法都要套用上去的
tags: [message queue, at least once, idempotency, retry, manual ack, consumer, upsert, dlq, dead letter queue, long running task, split brain, leader election, fencing token, monotonic token, zookeeper, zxid, etcd, ModRevision, k8s lease, leases]
math: true
---

# Message From Message Queue
我們講過很多次任務處理需要特別小心\
你需要考慮的比如說，一個任務如果因為不明原因重送了很多次\
或是 consumer 程式意外重啟，東西做到一半，你的程式能不能保證它不會把東西搞壞

> 有關 message queue 可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue)

實務上滿多 message queue 是所謂的 `at least once` delivery\
正確的處理資訊是挺重要的\
本文會再次複習並且引入一些新的觀點

# How to Prevent Re-consume Jobs Multiple time
我們先來複習我們已經熟知的方法\
如 [Idempotency](#idempotency), [Retry Mechanism](#retry-mechanism), [Manual ACK](#manual-ack)

## Idempotency
這是最基本的處理方式，就是把 consumer 的 function 設計成它能夠重複處理相同的資訊\
但依然不會出錯的形式

具體怎麼做？\
你資料庫就可能不是單純的寫入，而是 `upsert`\
但單靠 [Idempotency](#idempotency) 在某些情況下是不足夠的\
如果接的是第三方，你沒有辦法請它撤銷(或把它當成沒辦法撤銷是比較正確的思維)

## Retry Mechanism
Retry 這個，如果該 consumer 可能因為網路問題，只有他自己連不上(比如說資料庫)\
把 message 丟回去重新 consume 可以讓其他好的 consumer 接手他的工作，把東西重作一次，搭配 [Idempotency](#idempotency) 就行

## Manual ACK
手動 ACK 這個之前也講過，不做自動 ACK 是因為這樣做比較有彈性\
不論是
1. 你 function 處理不來，要丟到 DLQ
2. consumer 意外斷線，如果自動 ACK 訊息會重送一次

既然重送，那也是要搭配 [Idempotency](#idempotency)

# The Split Brain
有以上三者的保障就夠了嗎？ 其實不然

我們還忘記了一個重要的事情\
這些機制建立在 *"短期任務"* 的基礎上\
什麼意思，當你發送一個長任務給 mq 的時候事情就完全不同了

多數 mq 都有 timeout 的機制\
如果你下了一個 long running task，它跑超過時間，訊息會被重送對吧\
這在 *"短期任務"* 上沒啥大問題，上面三個就能解(i.e. [Idempotency](#idempotency), [Retry Mechanism](#retry-mechanism), [Manual ACK](#manual-ack))

對長期任務來說，你可能會在資料庫那邊紀錄狀態\
問題就出在這\
因為任務重新派發，然後東西沒做完，所以狀態會是 `in progress`\
1. 先前的 worker A, 因為任務還在跑，它不會知道自己手上的任務被搶走所以就繼續做
2. 收到新任務的 worker B，因為任務被標記成 `in progress` 所以它也繼續做

欸 你有沒有覺的這很熟悉？\
這不就是 **split brain** 嗎？

> 有關 split brain 可參考 [資料庫 - 從 Netflix 的 Tudum 系統看分散式系統中那些 Read/Write 問題 \| Shawn Hsu](../../database/database-distributed-issue#split-brain)

說到腦分裂，我們比較常在說的是舊的 leader 因為落後太多，或網路斷線\
等到它恢復上線還自以為是 leader 的情況\
你仔細品品，worker 的狀況也是相同的\
所以也可以用同樣的解法去解，就是 [Fencing Token](#fencing-token)

## Fencing Token
這個其實我們之前也講過，只是沒有太著墨\
因為它真的挺簡單的，每個 worker 在他要操作的時候帶入 token(單調遞增的數字)
如果它發現資料表內的數字比它帶入的還要高，那就代表你已經是 old worker，應該要主動退讓了

> 有關 fencing token 可以參考 [資料庫 - 從 Netflix 的 Tudum 系統看分散式系統中那些 Read/Write 問題 \| Shawn Hsu](../../database/database-distributed-issue#split-brain)

到這邊你的處理基本上就已經沒問題了

> [ZooKeeper](https://zookeeper.apache.org/) 的 zxid, [etcd](https://etcd.io/) 的 ModRevision 是使用 Fencing Token 的例子

> Redlock 並不能解決 [The Split Brain](#the-split-brain) 裡面提到的問題\
> 有關 Redlock 可參考 [資料庫 - Cache Strategies 與常見的 Solutions \| Shawn Hsu](../../database/database-cache#distributed-lock)

### Another Weak Spot
發號碼排服務也會變成你服務中的效能瓶頸\
如果每個都要拿號碼牌，那不就打爆了

常見的作法有幾個
* 去拿有租約的 token, 比如說 token A 有效期 `10 分鐘` 你就能無條件相信它，過期之前都不再過問
* 只在關鍵部份去拿號碼牌，寫入資料庫之類的，其他操作能用 [Idempotency](#idempotency) 擋住就擋
* 把號碼牌分組(i.e. sharding)

> 有關 sharding 可參考 [資料庫 - 最佳化 Read/Write 設計 \| Shawn Hsu](../../database/database-optimization)

# K8s Lease
你可能會好奇，我能不能用 [K8s Lease](https://kubernetes.io/zh-cn/docs/concepts/architecture/leases/) 去處理\
Lease 的本質上是租約，他是用來確保鎖定共享資源並執行協調的一個工具

```yaml
apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  creationTimestamp: "2023-07-02T13:16:48Z"
  labels:
    apiserver.kubernetes.io/identity: kube-apiserver
    kubernetes.io/hostname: master-1
  name: apiserver-07a5ea9b9b072c4a5f3d1c3702
  namespace: kube-system
  resourceVersion: "334899"
  uid: 90870ab5-1ba9-4523-b215-e4d4e662acb1
spec:
  holderIdentity: apiserver-07a5ea9b9b072c4a5f3d1c3702_0c8914f7-0f35-440e-8676-7844977d3a05
  leaseDurationSeconds: 3600
  renewTime: "2023-07-04T21:58:48.065888Z"
```

我們剛剛在 [Fencing Token](#fencing-token) 裡面提到的都有涵蓋到
* `resourceVersion` 是 token
* `holderIdentity` 誰拿著的
* `renewTime` 上次租約延長時間

不過還是不建議你拿 lease 當作 application level 的 distributed lock\
原因是你會把底下的 etcd 給打掛，你搞垮的會是整個 control plane，到時候你要處理的可不只任務重複的問題而已\
而且你要考慮到寫入量完全是不同量級的\
lease 本身的設計也不是拿來這樣讓你玩的

## Fun Fact of Lease
在 Kubernetes `1.26` 之後，每個 api-server 都會註冊一個 lease\
它為客戶端提供了一種方法去發現有多少 api-server 正在處理 k8s

稍微玩一下就是
```shell
$ k3d cluster create k3s-default --image rancher/k3s:v1.34.1-k3s1 --servers 5
$ kubectl -n kube-system get lease -l apiserver.kubernetes.io/identity=kube-apiserver
NAME                                   HOLDER                                                                      AGE
apiserver-2ogbny5jjxgka5v2aqra2ozrs4   apiserver-2ogbny5jjxgka5v2aqra2ozrs4_98ffb8ff-9a03-4f64-bd48-4d2c11e288a0   30s
apiserver-cmauzea7fnn2sdydf34aefafwy   apiserver-cmauzea7fnn2sdydf34aefafwy_f925bca4-9e28-43bf-be93-0546a246983e   71s
apiserver-dpxrhozws62woyryyuthx4sexm   apiserver-dpxrhozws62woyryyuthx4sexm_ac053dab-a9a4-4c41-95d3-08aa20943755   45s
apiserver-jjqkqo3fwkwyfodor4lbo5bgvi   apiserver-jjqkqo3fwkwyfodor4lbo5bgvi_01cfb006-402c-4d11-98a7-701da872b0ba   60s
apiserver-ob264u6lllgc43jfhw672pgtvm   apiserver-ob264u6lllgc43jfhw672pgtvm_8be5e459-45bd-4bdc-afb6-7fc9519deca9   15s
```

# References
+ [Leases](https://kubernetes.io/docs/concepts/architecture/leases/)
