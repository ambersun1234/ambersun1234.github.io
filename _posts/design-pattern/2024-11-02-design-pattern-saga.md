---
title: 設計模式 101 - 分散式交易的另一種作法 Saga 與 Transactional Outbox Pattern
date: 2024-11-02
categories: [design pattern]
tags: [saga, transaction, microservices, 2pc, compensating transaction, saga pattern, transactional outbox pattern]
description: 除了 2PC 以外，有沒有一種方法可以做到分散式交易呢？這篇文章介紹 Saga Pattern，一種分散式交易的解決方案。除此之外，還會介紹 Transactional Outbox Pattern，一種解決分散式交易中，資料一致性問題的解決方案
math: true
---

# Distributed Transaction with 2PC
在 microservices 的架構下，分散式交易是必須面對的問題\
我們學過，`2PC(Two-Phase Commit)` 是其中一種解決方式\
透過一個中心化的協調者(coordinator)與所有其他參與交易的服務進行溝通與決策

為了避免參與者無限等待 coordinator 的回應，`3PC` 被提出

> 可參考 [資料庫 - 從 Netflix 的 Tudum 系統看分散式系統中那些 Read/Write 問題 \| Shawn Hsu](../../database/database-distributed-issue/#two-phase-commit2pc)

根據 [Documentation: 17: 66.4. Two-Phase Transactions - PostgreSQL](https://www.postgresql.org/docs/current/two-phase.html) PostgreSQL 是有提供 `2PC` 的支援\
但這些算法並不是每個資料庫都有支援\
要如何不依賴資料庫的支援，實現分散式交易呢？

## Starting from 2PC
我們可以借鑒 2PC 的想法，分散式交易本質上就是多個服務之間的交互\
那是不是可以看作 `多筆小交易`?

但要是 `整體交易` 失敗該怎麼辦？\
部份小交易已經 Commit 了，這些交易要怎麼 Rollback 呢？\
Rollback 是不可能的，已經 Commit 的交易 Revert 也是不可能的(資料庫不支援)

> 就算有些支援 Rollback，但他帶來的 overhead 也會比較高

<hr>

換個角度說，既然資料庫不支援 Rollback 已經 Commit 的資料，我能不能透過其他方式來補償這筆交易的失敗呢？\
什麼意思？

我可以透過另一筆交易，**補償** 之前交易造成的 **結果**\
比方說，我要從線上商成買東西\
商品數量已經漸少，但是付款失敗\
以這個例子來說，你做了兩筆 `小交易`

```
1. 減少商品數量(成功)
2. 扣款(失敗)
```

所以以這個例子，你要怎麼補償？\
很明顯的，把商品數量加回去就好了\
而這個補償的交易，這就是 `Compensating Transaction`

# Introduction to Saga Pattern
![](https://microservices.io/i/sagas/From_2PC_To_Saga.png)
> ref: [Pattern: Saga](https://microservices.io/patterns/data/saga.html)

從上圖你可以很清楚的看到，Saga Pattern 是由多個小交易組成的\
這一系列的小交易，我們稱之為 `Saga`\
Saga 的想法很簡單，而它也不一定只能套用到資料庫交易上

Saga Pattern 有兩種實現方式\
其中 `Orchestration-based Saga` 跟 2PC 滿類似的

`Choreography-based Saga` 主要是讓每個小交易知道自己的下一步是什麼\
比如說商品數量足夠並且扣除之後，就要進行扣款\
變成是 `Inventory` 會知道接下來需要進行扣款(`Billing`)的動作\
因為不同服務之間他們不會直接溝通，所以你需要借助像是 message queue 這樣的工具

> 有關 message queue 可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue/), [資料庫 - 解耦助手 RabbitMQ \| Shawn Hsu](../../database/database-rabbitmq/)

||`Choreography-based Saga`|`Orchestration-based Saga`|
|:--:|:--|:--|
|Description|每個小交易知道自己的下一步是什麼|有一個中心化的協調者(coordinator)|
|Image|![](https://microservices.io/i/sagas/Create_Order_Saga.png)|![](https://microservices.io/i/sagas/Create_Order_Saga_Orchestration.png)|

## Drawbacks
概念上 Saga Pattern 看起來很美好，但是實際上有一些缺點\
最明顯的莫過於你需要手動處理很多事情

假設 Local Transaction 因為莫名原因停止\
那麼後續的交易怎麼辦？ 該繼續等待嗎？\
針對這個問題，`2PC` 的解法是 `3PC`

如何處理 Rollback 的問題？ 如果 Rollback 失敗該怎麼處理？\
這種狀況，你的 application 必須要有夠高的可靠性\
比如說你可能需要加入 `Retry` 的機制確保 Rollback 的成功

另外，Saga Pattern 本身並沒有提供 `ACID` 的保證\
整個交易沒有保證(但 `小交易` 本身有)\
所以可能會造成多筆 concurrent Saga 交易會有衝突的問題\
這些也都必須要你自己來處理

> 可參考 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction/)

綜合來看，Saga Pattern 提供了一個分散式交易的解決思路\
但是仍然有許多的細節需要仔細思考與研究

# Introduction to Transactional Outbox Pattern
如果不想要 `2PC` 帶來的高昂 overhead 或者 [Saga Pattern](#introduction-to-saga-pattern) 手動處理的麻煩\
你還有一種選擇是 **Transactional Outbox Pattern**

基本的思想也還是一樣的\
每個服務依然是做 local transaction\
問題在於，要怎麼確保 atomicity 這件事情

`2PC` 可以用分散式鎖確保，[Saga Pattern](#introduction-to-saga-pattern) 可以使用 compensating transaction 來確保 atomicity\
前者的問題在於他有極大的效能隱患，後者的問題會是手動的部分很容易出錯

如果應用程式 crash 掉，即使你在 application layer 做了很多重試，東西也還是會遺失\
所以重點是在這裡\
那有沒有一種辦法，你無論如何都能夠 preserve 系統狀態

如果 local transaction 做完了(這邊指的不管是成功或失敗)\
他是不是一定會寫 **WAL(Write-Ahead Log)**?\
這個機制就是用於確保資料庫系統不會因為意外重啟而遺失資料的機制

+ 如果斷電，WAL 裡面沒東西，那代表東西根本還沒進去資料庫，不需要重試
+ 如果斷電，WAL 裡面有東西，那代表東西已經進去資料庫，需要重試

所以回到 local transaction 的部分\
只要它做完，你就一定會有記錄，不論斷電與否\
那 atomicity 就解決了\
而既然系統本身是分散式的，你需要將目前的進度傳給下一個 local transaction 對吧？\
這段就相對單純，你只需要將紀錄放到 `outbox` 表裡面，讓下一個 local transaction 的服務取得狀態並進行下一步的動作\
其實甚至不需要那麼麻煩，你可以利用 message queue 來傳遞訊息或者是直接透過 CDC 的機制傳遞(這邊也就同時保證了 eventually consistency，資料會 at least once 的被處理)

> 有關 message queue 可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue/), [資料庫 - 解耦助手 RabbitMQ \| Shawn Hsu](../../database/database-rabbitmq/)\
> 有關 CDC 可以參考 [資料庫 - 新手做 Data Migration 資料遷移 \| Shawn Hsu](../../database/database-migration/#change-data-capturecdc)

# References
+ [Pattern: Saga](https://microservices.io/patterns/data/saga.html)
