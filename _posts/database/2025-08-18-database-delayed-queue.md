---
title: 資料庫 - Delayed Queue 的設計與考量
date: 2025-08-18
categories: [database]
description: 當你需要解耦你會想到 message queue，而當你需要在解耦的基礎下提供延遲的機制，你會怎麼做？ Delayed Queue 的設計就是為了滿足這樣的需求。本文將會帶你瞭解市面上的解決方案，點出其優缺點，並且學習早期 Netflix Dyno Queues 的設計。
tags: [delayed queue, message queue, rabbitmq, redis, linux at, cronjob, linux atd, dynomite, cassandra, zookeeper, mnesia, erlang, ttl, dlq, dlx, quorum queue, classic queue, priority queue, polling, transaction, cluster replication, ack, nack, dead letter, dyno queue, sorted set, fifo, sharding, activemq, activemq classic, activemq artemis, java, scheduledthreadpoolexecutor, mainloop]
math: true
---

# What is Delayed Queue?
Delayed Queue 是一種特殊的 message queue\
與一般的 message queue 不同，Delayed Queue 裡面的資料並不會被立即取出\
你可以對每個 message 設定一個延遲時間\
只有當時間到了之後，資料才可以被 consumer 消費

## CronJob and At Command
既然主要的目的是執行 "一次性的任務"，linux 的 [at](https://linux.die.net/man/1/at) 指令很適合在這個場景下使用\
[at](https://linux.die.net/man/1/at) 本身就允許所謂的 later execution\
使用者可以排定一個一次性任務並等待執行

但是對於分散式系統來說，[at](https://linux.die.net/man/1/at) 並不能很好地滿足需求\
原因在於它本身並沒有試錯重試的機制，失敗的會直接消失

到這裡，另一個想法是透過 [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) 來實現\
問題是我們需要的是 **一次性的任務**，而不是 **定時的任務**\
你可能會說一樣設定 CronJob 但等他完成之後就刪除，這其實也是一種 anti-pattern\
並且與 [at](https://linux.die.net/man/1/at) 的缺點類似，你無法追蹤失敗的任務

# Delayed Queue Implementation
Delayed Queue 的實作是非常看不同需求而定的\
不過本質上，他們都需要一個不間斷的機制來監控資料本身(不論是主動推播還是使用 polling 的機制)

> 有關 polling 可以參考 [淺談 Polling, Long Polling 以及其他即時通訊方法論 \| Shawn Hsu](../../random/real-time-communication)

|Name|Concerns|
|:--|:--|
|[RabbitMQ Delayed Message Exchange Plugin](#rabbitmq-delayed-message-exchange-plugin)|實作本身有單點失效的問題|
|[RabbitMQ TTL with DLX](#rabbitmq-ttl-with-dlx)|per-message TTL 的彈性不夠, queue TTL 也同樣受限於 FIFO 的特性|
|[Netflix Dyno Queues](#netflix-dyno-queues)|Dynomite 會使得整個系統變得相對厚重|

## RabbitMQ Delayed Message Exchange Plugin
RabbitMQ 官方有提供 [rabbitmq-delayed-message-exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange) plugin 用於實現 Delayed Queue 的功能

這個 delay 功能是做在 exchange 上面的\
時間到了之後才會被往後丟到 queue 中(如果他沒辦法 route 到 queue 則會被丟棄, i.e. `unroutable message`)\
而 delay 並非無限制的，最多大概可以到一兩天這樣，更久的就不建議\
而你可以設定從 秒，分鐘，小時 等等的區間

### Erlang Mnesia
套件 [rabbitmq-delayed-message-exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange) 是基於 Erlang Mnesia Database 實現的

Mnesia 速度快、效率高並且支援 transaction 以及 cluster replication\
但是其缺點是故障恢復的機制較差

delay 的資料是儲存在 `Mnesia table` 之上的(Mnesia 本來是用於儲存 metadata 而非資料本身)\
plugin 本身的實作是 single disk replica 的機制(注意到並非 Mnesia 本身的限制)\
意味著，如果節點失效，所有 delay 的資料都會遺失\
雖然 `Mnesia table` 對於節點重啟有良好的恢復機制\
scheduled delivery 的 timer 會被重新安裝，所以在這個情況下還是會動的\
只不過，**單一節點失效** 仍然是一個很大的問題

## RabbitMQ TTL with DLX
根據 [Scheduling Messages with RabbitMQ](https://www.rabbitmq.com/blog/2015/04/16/scheduling-messages-with-rabbitmq) 的說法

> For a while people have looked for ways of implementing delayed messaging with RabbitMQ. So far the accepted solution was to use a mix of message TTL and Dead Letter Exchanges as implemented by NServiceBus here. 

在還沒有 [rabbitmq-delayed-message-exchange](#rabbitmq-delayed-message-exchange-plugin) 之前\
delayed message 的實作是透過 [TTL](#ttl-time-to-live) 以及 [DLX](#dlx-dead-letter-exchange) 實現的

將 message 設定 TTL 放到 queue 中\
不要取出，等待其到期之後由 DLX 將資料轉送到 DLQ 中\
就可以達到 delayed message 的效果

### TTL (Time-to-Live)
在 RabbitMQ 中，你可以設定所謂的 Time-to-Live(TTL)，顧名思義，就是 messages 可以在 queue 中存活多久\
當超過 TTL 的時間，message 會被丟棄\
所謂的丟棄就是訊息不會被路由到 consumer 身上

> TTL 可以設定在 single queue, multiple queue 或是 per-message

至於說，哪時候會被丟棄呢？
+ [Quorum Queue](https://www.rabbitmq.com/quorum-queues.html)
    1. 訊息變成 Queue 的第一個元素的時候(Head of Queue)
+ [Classic Queue](https://www.rabbitmq.com/classic-queues.html)
    1. 訊息變成 Queue 的第一個元素的時候(Head of Queue)
    2. policy 設定的改變間接影響

> 無論是 [Quorum Queue](#quorum-queue) 還是 [Classic Queue](#classic-queue)\
> 他們都是 FIFO 的 queue

如果 TTL 是設定在 queue 上，那麼訊息就會依照順序被 TTL 掉\
如果是在 message 上，事情就會比較複雜，因為每個 message 的 TTL 都不盡相同\
比方說 `E1 是 30 秒`，`E2 是 10 秒`\
即使 E2 的 TTL 比較短，他仍然需要等到 E1 被移除之後才會被丟棄

在這樣的情況下，E2 會多等 30 秒才會被丟棄\
在使用 per-message TTL 的情況下需要額外注意

### DLX (Dead Letter Exchange)
在 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue#dlqdead-letter-queue) 中我們提到，DLQ 是將那些執行執行失敗的 message 最終要去的地方\
而 RabbitMQ 內是透過 DLX 這個 exchange 將資料路由到 DLQ 的

> 沒有指定 exchange 會使用 default exchange\
> 資料流會是 exchange 到 queue

一個 message 可以被 dead letter 的情況有
1. 被 nack 掉(成功收到但是沒有辦法處理)
2. 超過 TTL 的時間
3. 因為超過 Queue 的長度導致 message 被丟棄
4. 在 [Quorum Queue](#quorum-queue) 的情況下，message 被回傳的次數超過 delivery limit

> 如果是 Queue 本身 expired, 則 messages ***並不會*** 被 dead letter

被 dead letter 的 message 會被轉送到指定的 routing key 上\
如果沒有指定，就是原本的 routing key

## Apache ActiveMQ
針對兩種實作 [ActiveMQ Classic](#activemq-classic) 以及 [ActiveMQ Artemis](#activemq-artemis) 都支援 delayed message，只是實作方式不同

### ActiveMQ Classic
[ActiveMQ Classic](https://activemq.apache.org/components/classic/documentation/delay-and-schedule-message-delivery) 本身是採用 polling 的機制實現

[mainloop](https://github.com/apache/activemq/blob/main/activemq-kahadb-store/src/main/java/org/apache/activemq/store/kahadb/scheduler/JobSchedulerImpl.java#L720) 是一個無窮迴圈的 while loop\
他並非有固定的 interval 去檢查，而是會根據資料狀態動態的調整\
[預設是 500ms](https://github.com/apache/activemq/blob/main/activemq-kahadb-store/src/main/java/org/apache/activemq/store/kahadb/scheduler/JobSchedulerImpl.java#L905), 但是他也會改成比如說，剩餘等待時間\
既然是 polling 的機制，他有可能會 miss 掉 real time 的特性，透過動態調整 interval 可以很好的避免這個問題

```java
long waitTime = nextExecutionTime - currentTime;
this.scheduleTime.setWaitTime(waitTime);
```

### ActiveMQ Artemis
[ActiveMQ Artemis](https://activemq.apache.org/components/artemis/documentation/latest/scheduled-messages.html#scheduled-messages) 則是使用 Java 內建的 [ScheduledThreadPoolExecutor](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ScheduledThreadPoolExecutor.html) 實現\
簡單來說呢，他可以排程一個 command，在
1. 指定的時間執行一次
2. 進行排程重複執行

當收到一個 delay message 的時候，就會計算出 delay 然後 schedule 下去\
在 [ScheduledDeliveryHandlerImpl.java#L190](https://github.com/apache/activemq-artemis/blob/main/artemis-server/src/main/java/org/apache/activemq/artemis/core/server/impl/ScheduledDeliveryHandlerImpl.java#L190)
```java
private void scheduleDelivery(final long deliveryTime) {
      final long now = System.currentTimeMillis();

      final long delay = deliveryTime - now;

      if (delay < 0) {
         if (logger.isTraceEnabled()) {
            logger.trace("calling another scheduler now as deliverTime {} < now={}", deliveryTime, now);
         }
         // if delay == 0 we will avoid races between adding the scheduler and finishing it
         ScheduledDeliveryRunnable runnable = new ScheduledDeliveryRunnable(deliveryTime);
         scheduledExecutor.schedule(runnable, 0, TimeUnit.MILLISECONDS);
      } else if (!runnables.containsKey(deliveryTime)) {
         ScheduledDeliveryRunnable runnable = new ScheduledDeliveryRunnable(deliveryTime);

         if (logger.isTraceEnabled()) {
            logger.trace("Setting up scheduler for {} with a delay of {} as now={}", deliveryTime, delay, now);
         }

         runnables.put(deliveryTime, runnable);
         scheduledExecutor.schedule(runnable, delay, TimeUnit.MILLISECONDS);
      } else {
         if (logger.isTraceEnabled()) {
            logger.trace("Couldn't make another scheduler as {} is already set, now is {}", deliveryTime, now);
         }
      }
   }
```

這個 `scheduledExecutor` 往上追
+ [QueueImpl.java#L376](https://github.com/apache/activemq-artemis/blob/main/artemis-server/src/main/java/org/apache/activemq/artemis/core/server/impl/QueueImpl.java#L376)
+ [QueueFactoryImpl.java#L54](https://github.com/apache/activemq-artemis/blob/main/artemis-server/src/main/java/org/apache/activemq/artemis/core/server/impl/QueueFactoryImpl.java#L54)
+ [ActiveMQServerImpl.java#L3234](https://github.com/apache/activemq-artemis/blob/main/artemis-server/src/main/java/org/apache/activemq/artemis/core/server/impl/ActiveMQServerImpl.java#L3234)

就是一個 `ScheduledThreadPoolExecutor`\
相比於 [ActiveMQ Classic](#activemq-classic) 的 polling 機制，ActiveMQ Artemis 的實作依賴於語言本身的實作，可以避免 polling 帶來的 overhead

## Netflix Dyno Queues
Netflix 的 Content Platform Engineering 也有使用 Delayed Queue 的需求\
原本他們是使用 [Cassandra](https://cassandra.apache.org/_/index.html) 搭配 [Zookeeper](https://zookeeper.apache.org/) 實現的\
不過他們很快發現了問題所在

1. Cassandra 使用 queue 的資料結構是 anti pattern
2. Distributed Lock 導致效能不佳(一次只能有一個 consumer，即使使用 shard，問題也只能暫時緩解)

而 [Dyno Queue](https://github.com/Netflix/dyno-queues) 的設計很好的解決了以上的問題\
基於 [Dynomite](https://github.com/Netflix/dynomite) 搭配 [Redis Sorted Set](#redis-sorted-set) 的設計可以擁有以下特性
1. 分散式的系統
2. 不需要外部 lock 機制
3. 非強制 FIFO
4. 支援 sharding
5. At least once delivery

> 基本上 Dynomite 就是一個抽象封裝，底下可以替換不同的 storage engine\
> 支援 multi-datacenter replication 達到高可用性

### Redis Sorted Set
具體來說資料是儲存在 `Sorted Set` 之上的\
因為我們要做 Delayed Queue 嘛，本質上就是根據時間排序的 Priority Queue\
那要怎麼查詢 Delayed 的資料呢？

> 有關 priority queue 可以參考 [神奇的演算法 - 為什麼你的 Priority Queue 那麼慢！ \| Shawn Hsu](../../algorithm/alogrithm-priority-queue)

其實問題比想像中還簡單\
在 Sorted Set 裡面的 key 肯定是跟時間有關\
Dyno Queue 是將 `時間` 以及 `priority` 組合起來當作 key\
要判斷一個資料是否 delay 就將 `當前時間` 與 max priority 做計算\
並拿取 `0 ~ score` 之間的資料

為什麼是 `0 ~ score` 之間的資料呢？\
因為你的 score 是當前時間，所以小於 score 的資料就是 delay 的資料\
拿出來之後，為了避免資料遺失，所以他需要手動進行 ACK

也就是說，當你 pop 資料的時候，他會被移動到所謂的 `unack set` 中(並不是直接被移除)\
手動 ACK 代表你已經處理完了這個資料，`unack set` 中的資料會被移除\
如果你沒有 ACK 會發生什麼事情？

因為不確定你是否處理完這個資料，所以過一段時間之後\
`unack set` 中的資料會被放回 Delayed Queue 當中(這是透過一個 background job 定期去檢查的)\
有了這種機制，基本上就可以保證 `At least once delivery` 的特性

而 Redis In memory 以及 Single Thread 的特性，使得其滿足 Netflix 團隊對於 Delayed Queue 的需求

> 有關 Redis 可以參考 [資料庫 - Cache Strategies 與常見的 Solutions \| Shawn Hsu](../../database/database-cache)

# References
+ [Netflix 開發的 Delayed Queue](https://blog.gslin.org/archives/2016/08/20/6755/netflix-%E9%96%8B%E7%99%BC%E7%9A%84-delayed-queue/)
+ [Distributed delay queues based on Dynomite](https://netflixtechblog.com/distributed-delay-queues-based-on-dynomite-6b31eca37fbc)
+ [Scheduling Messages with RabbitMQ](https://www.rabbitmq.com/blog/2015/04/16/scheduling-messages-with-rabbitmq)
+ [Metadata store](https://www.rabbitmq.com/docs/metadata-store)
+ [Delay interval predictability](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/issues/72)
+ [rabbitmq-delayed-message-exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
+ [Time-to-Live and Expiration](https://www.rabbitmq.com/docs/ttl)
+ [RabbitMQ Queue Types Explained](https://www.cloudamqp.com/blog/rabbitmq-queue-types.html)
+ [Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
+ [Differences From ActiveMQ 5](https://activemq.apache.org/components/artemis/migration-documentation/key-differences.html)
