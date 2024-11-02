---
title: 設計模式 101 - 分散式交易的另一種作法 Saga Pattern
date: 2024-11-02
categories: [design pattern]
tags: [saga, transaction, microservices, 2pc, compensating transaction]
description: 除了 2PC 以外，有沒有一種方法可以做到分散式交易呢？這篇文章介紹 Saga Pattern，一種分散式交易的解決方案
math: true
---

# Distributed Transaction with 2PC
在 microservices 的架構下，分散式交易是必須面對的問題\
我們學過，`2PC(Two-Phase Commit)` 是其中一種解決方式\
透過一個中心化的協調者(coordinator)與所有其他參與交易的服務進行溝通與決策

為了避免參與者無限等待 coordinator 的回應，`3PC` 被提出

> 可參考 [資料庫 - 分散式系統中的那些 Read/Write 問題 \| Shawn Hsu](../../database/database-distributed-issue/#two-phase-commit2pc)

根據 [Documentation: 17: 66.4. Two-Phase Transactions - PostgreSQL](https://www.postgresql.org/docs/current/two-phase.html) PostgreSQL 是有提供 `2PC` 的支援\
但這些算法並不是每個資料庫都有支援\
要如何不依賴資料庫的支援，實現分散式交易呢？

## Starting from 2PC
我們可以借鑒 2PC 的想法，分散式交易本質上就是多個服務之間的交互\
那是不是可以看作 `多筆小交易`?

但要是 `整體交易` 失敗該怎麼辦？\
部份小交易已經 Commit 了，這些交易要怎麼 Rollback 呢？\
Rollback 是不可能的，已經 Commit 的交易 Revert 也是不可能的(資料庫不支援)

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

> 有關 message queue 可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue/)

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

# References
+ [Pattern: Saga](https://microservices.io/patterns/data/saga.html)
