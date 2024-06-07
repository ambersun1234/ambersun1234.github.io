---
title: 資料庫 - 從 Apache Kafka 認識 Message Queue
date: 2023-12-31
description: 本文將會藉由導讀 JMS, MQTT 以及 AMQP 的標準，理解 Apache Kafka 以及 RabbitMQ 的基本概念
categories: [database]
tags: [distributed, cluster, message queue, publisher, consumer, producer, subscriber, event, kafka, amqp, mqtt, jms, rabbitmq, dlq]
math: true
---

# Preface
message queue 顧名思義他是一個 queue，用來存放 message 的\
你可以用 Inter-Process Communication 的概念去思考它\
基本上就是提供一個空間或是，讓兩個 process 進行通訊

> 有關 IPC 的相關討論可以參考 [Goroutine 與 Channel 的共舞 \| Shawn Hsu](../../random/golang-channel/#inter-process-communication)

不過，當然 message queue 服務的對象是 application\
與傳統的 IPC 還是不同的\
但問題是為什麼我們需要 message queue?

1. 我用 HTTP, gRPC 之類的 protocol 也能進行通訊
2. 我透過讀取共享檔案的方式，也能進行通訊

> 有關 gRPC 相關的討論可以參考 [網頁程式設計三兩事 - gRPC \| Shawn Hsu](../../website/website-grpc)

是什麼樣的原因讓我們必須要開發一個新的方式\
是這些行之有年的技術比較不能做到的？

# Introduction to Message Queue
所以到底為什麼需要 message queue?\
假設你是用 HTTP request 跟不同的 service 互動\
你可能會遇到什麼狀況？
1. 網路是不可靠的，application 之間可能會出於各種原因斷線，資料可能會丟失
2. 使用傳統的方式收送資料，他的 data format 是不容易更改的
3. 不同的 application 的吞吐能力可能不同，量大的時候相當於你在 DDOS 你的服務，他有可能掛掉，資料可能會丟失
4. 收送資料時，client 與 server 必須同時在線

我知道有些理由有點牽強\
但你大概可以有個概念說，為什麼 message queue 會被發明出來

那 message queue 大致上可以做到以下這幾件事情
1. 允許 **非同步** 處理
2. 不同的 service 可以 **解耦合**
3. 讓不同 service 之間有個緩衝區(i.e. 不會被打爆)
4. 允許個別 service scale up(i.e. 不會被打爆)
    + 如果是 server produce 太多 message 導致 client 消化不過來
    + 那麼我只要將 client scale up(或 scale out) 即可, server 可以不需要更改
5. 簡化 message routing 的部份(要送去哪阿之類的)
6. 可以讓 message 有容錯機制(亦即他有 retry 機制)
7. 擁有 message persistence 的特性
    + 雖說 message queue 本身是以 highly reliable 為原則設計的，但它還是有機率掛掉，掛掉之後還沒被 consume 的 message 不能不見
8. 一致性的 message format
    + message queue 本身並沒有規定傳入的資料需要符合特定的資料格式(提供彈性)，對它來說都是 "資料"。

## Re-enqueue Message
message queue 在某些狀況下，會需要重新將 message 放入 queue 當中\
比如說，message 正確的被 consumer consume 了，但該 message 沒辦法被正確處理(i.e. 資料格式不能被 consumer 處理, 網路有問題 ... etc.)\
多半時候我們會選擇實作 retry 的機制

retry 基本上有兩種作法
1. 在 consumer 內，使用 for-loop 進行 retry
2. 或者是選擇重新將 message enqueue

先講結論，重新 enqueue 的方式會比較好\
如果處理失敗，可能的原因可能是因為網路出問題，或者是遇到 rate limit 等等的問題\
如果是使用 for-loop retry, 網路的問題並不會被解決(中間網路斷線，rate limit 都是)\
而如果你選擇重新 enqueue, 在多個 consumer 的情況下(執行在不同機器上)，可能就解決了

## DLQ(Dead Letter Queue)
前面我們提到，message 可能會執行失敗\
為了解決這個問題，可以透過 `retry` 的機制重試

不過，重試的成本在大流量系統中可能會出現效能瓶頸\
而 DLQ ，就是將那些執行執行失敗的 message 最終要去的地方\
把這些 message 儲存起來，就不會擋到原本的標準佇列，而待 IT 人員修復系統之後，就可以重新執行這些資料了

<hr>

如果說你需要一直執行 message(不論它會不會失敗)\
那顯然 DLQ 並不是一個最好的選擇\
我們可以參考 OS 設計 [Multilevel Queue Scheduling](https://testbook.com/operating-system/multilevel-queue-scheduling) 以及 [Priority Scheduling](https://www.scaler.com/topics/operating-system/priority-scheduling-algorithm/) 的概念\
我們可以分成 
1. high priority queue
2. low priority queue

當 message 在 high priority queue 中失敗三次之後就將它移到 low priority queue\
如此一來便不會造成 high priority queue 的效能瓶頸\
而每個 queue 可以對應到不同的 consumer 實作做最佳化

# Publisher-Subscriber Pattern
稍微複習一下 Publisher-Subscriber Pattern

> 或者你可以到 [設計模式 101 - Observer Pattern \| Shawn Hsu](../../design%20pattern/design-pattern-observer#publisher-subscriber-pattern) 複習

![](https://miro.medium.com/max/495/1*-GHFC93E4ODwNc98IE5_vA.gif)
> ref: [Observer vs Pub-Sub Pattern](https://betterprogramming.pub/observer-vs-pub-sub-pattern-50d3b27f838c)

publisher 將 message 放入一個空間內，通常是一個 queue\
然後由 subscriber 根據資料的 **標籤**(i.e. topic) 自行取用需要的資料\
這種方式，publisher, subscriber 雙方都不會知道對方是誰\
而且你 ***哪時候*** 要拿，我也不 care

# Pull/Push Protocol
+ server 直接往 client 丟資料，然後 client 沒有要求 :arrow_right: push protocol
+ client 向 server 主動要資料 :arrow_right: pull protocol

push protocol 由於是 server 主動往 client 丟資料\
一般來說，你會有很多個 client 同時處理資料\
對於每一個 connection 都使用相同的發送速度顯然太不合理(而且也難以維護)\
萬一有某個 client 它消化的速度跟不上怎麼辦？ 只好建立一個 buffer 留著，但這顯然沒意義(你都用 message queue 了)

與其這樣不如讓 client 自己決定接收資料的速度\
它可以根據自己處理的狀況動態的調整\
但有一個缺點是，當 queue 是空的的情況下，client 的行為就會變成 polling 了

> 可參考 [淺談 Polling, Long Polling 以及其他即時通訊方法論 \| Shawn Hsu](../../random/real-time-communication)

# Protocols of Message Queue
## JMS
現有的 RPC call 系統，要求 client 與 server 都同時在線才能進行通訊\
並且該通訊方式是屬於 block I/O, 亦即他是非同步的\
而這無疑阻礙了低耦合系統的開發

JMS - Java Messaging Service 是為了克服以上問題而開發出的一套 messaging 系統\
支援一般 P2P 以及 [Publisher-Subscriber Pattern](#publisher-subscriber-pattern) 的通訊模型\
它包含了以下元件
+ `JMS provider` :arrow_right: 實作了 JMS specification 的 server
+ `JMS client`
+ `Messages` 
+ `Administered Objects`

要注意的是，JMS 只有在 P2P 的模式下是使用 message queue(`QueueConnectionFactory`)\
在 Pub/Sub 模式下是使用 `TopicConnectionFactory`

## MQTT
你可能有聽過 MQTT 這個東西，通常是在嵌入式系統的領域較為常見\
MQTT 定義了訊息傳遞的標準，其標準已經來到了 [MQTT Version 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.pdf), 就讓我們稍微看一下標準內容吧

MQTT - Message Queuing Telemetry Transport 是一種基於 [Publisher-Subscriber pattern](#publisher-subscriber-pattern) 的訊息交換協議\
它可以跑在任何提供 有序的、無壓縮、雙向連接的協議之上，如 TCP/IP

與 [AMQP](#amqp) 不同的是，MQTT 並沒有使用任何 message queue\
單純的就是 client, server 的角色而已，client 發送帶有 MQTT header 的訊息至 server 上\
server 根據 subscription 轉送至不同的 client\
而 MQTT 也有支援 Topic 的概念，因此 client 可以根據自己感興趣的部份進行 subscribe

此外 message delivery 的方式也有分成
+ `at most once`
+ `at least once`
+ `exactly once`

從上述你可以知道，client server 的訊息交換是建立在 network connection 之上的\
萬一斷線要怎麼辦？ 理論上來說，當發生 disconnect 行為的時候，不論是網路問題還是正常結束\
都沒辦法再繼續傳送訊息，因此，MQTT **只能在網路有通的情況下進行訊息的交換**

另外就是當 disconnect 的情況發生，如果 will flag 有設定，server 必須主動發送 `will message` 跟其他人說 connection closed

> 2611 After sending a DISCONNECT packet the sender:\
> 2612 &nbsp;&nbsp;&nbsp;&nbsp;• MUST NOT send any more MQTT Control Packets on that Network Connection [MQTT-3.14.4-1].\
> 2613 &nbsp;&nbsp;&nbsp;&nbsp;• MUST close the Network Connection [MQTT-3.14.4-2].\
> 2614\
> 2615 On receipt of DISCONNECT with a Reason Code of 0x00 (Success) the Server:\
> 2616 &nbsp;&nbsp;&nbsp;&nbsp;• MUST discard any Will Message associated with the current Connection without publishing it\
> 2617 [MQTT-3.14.4-3], as described in section 3.1.2.5.\
> 2618\
> 2619 On receipt of DISCONNECT, the receiver:\
> 2620 &nbsp;&nbsp;&nbsp;&nbsp;• SHOULD close the Network Connection.

## AMQP
AMQP(Advanced Message Queue Protocol) 是一個執行在 **應用層** 之上的 binary 協議\
其標準內容已經被正式收錄在 [ISO/IEC 19464](https://www.iso.org/standard/64955.html) 之中\
但他是收費的，所以我們看 RabbitMQ 上的這一份 0.9.1 的 spec - [AMQP - Advanced Message Queuing Protocol - Protocol Specification](https://www.rabbitmq.com/resources/specs/amqp0-9-1.pdf)

AMQP 是為了解決跨系統間的整合，降低成本而提出的一套訊息傳遞的標準\
而它由兩大部份 service-side services(稱為 **broker**) 以及 network protocol 所組成\
而 server-side services 是由 [AMQ Model](#amq-model) 構成

### AMQ Model
AMQ Model 全名為 The Advanced Message Queuing Model\
包含了三大元件 [exchange](#exchange), [message queue](#message-queue) 以及 [binding](#binding)

#### exchange
exchange 主要負責執行 `routing` 的工作，負責將從 publisher 送過來的資料\
轉送到特定的 message queue 上

> 所以 exchange 本身並不會儲存 message

exchange 通常會檢查一個叫做 `routing key` 的欄位
+ 在 P2P 的模式下，通常為 message queue 的名字
+ 在 pub/sub 的模式下，通常為 topic 的名字

exchange 有 5 種模式(direct, topic, fanout, headers 以及 system)，但是下面兩種是最重要的
1. Direct Exchange(Default Exchange)
    + Direct Exchange 會使用 `routing key` 進行綁定
    + exchange 的名字可以是 `amqp.direct` 或是 `<empty>`(空值)
2. Topic Exchange
    + Topic 就是在 [Publisher-Subscriber Pattern](#publisher-subscriber-pattern) 裡面講到的 topic
    + subscriber 可以根據自己有興趣的主題(topic) 進行訂閱
    + 而它就是透過 [binding](#binding) 定義的 pattern 進行轉送的

#### message queue
message queue 主要負責儲存資料，直到它被安全的被 consumer 處理掉\
它可以儲存在 memory 或者是 disk 裡面

message queue 有分兩種形式\
一種是 `Durable` 的，意味著說就算沒有 consumer, queue 一樣會繼續存在\
另一種則是 `Temporary`, 當這個 queue 只服務特定的 consumer 的時候，然後那個 consumer 結束的時候，該 queue 就會被刪除了

#### binding
定義 [exchange](#exchange) 以及 [message queue](#message-queue) 之間的關係

考慮 Topic Exchange type\
它主要是透過 "類似 regex" 的方式進行匹配的\
匹配的關係式長的像這樣子 `user.stock`\
他是由多個詞語所組成的，其中每個詞都是大小寫的 a 到 z 以及數字 0 到 9 組成的\
每個字詞中間是使用 `.` 做區隔\
並且配合上 `*`, `#` 字號(`*` 代表只出現 1 個詞，`#` 代表出現 0 次以上)

比如說 binding 的條件(pattern)是 `*.stock.#`
+ `user.stock` 以及 `eur.stock.db` 這些是 match 的 :heavy_check_mark:
+ `stock.nasdaq` 而這個不會 match :x:

當 routing key 與 routing pattern 符合的時候，就將它轉送到特定的 message queue 上\
注意到它可能會 match 到多個符合的 routing pattern，也就是多個 queue 都會拿到資料

> 其他 Exchange type 也都是透過類似的方法決定要如何 route message 的

<hr>

所以整體的流程會是這樣子的\
producer 將 message 送到 AMQP server 上\
exchange 會根據 message 內部的 properties(i.e. [binding](#binding)) 決定要轉送到哪個 message queue 上\
如果無法決定要送到哪個 queue 上面，AMQP server 會把它丟掉或者是原路送回(看實作而定)\
message queue 會在 **第一時間**，想辦法將訊息送到 consumer 手上，如果 consumer 沒空，它才會選擇儲存起來\
之後 consumer 在從 message queue 將訊息取走

### Comparison
上述我們看了幾個比較重要的協議，讓我們整理成表格看一下好了

||[JMS](#jms)|[MQTT](#mqtt)|[AMQP](#amqp)|
|:--|:--:|:--:|:--:|
|Pattern|P2P<br>[Publisher-Subscriber pattern](#publisher-subscriber-pattern)|[Publisher-Subscriber pattern](#publisher-subscriber-pattern)|P2P<br>[Publisher-Subscriber pattern](#publisher-subscriber-pattern)|
|Have Message Queue|:heavy_check_mark:(only exists in P2P)|:x:|:heavy_check_mark:|
|Asynchronous|:heavy_check_mark:|:x:|:heavy_check_mark:|
|Multiple Language Support|:x:(Java)|:heavy_check_mark:|:heavy_check_mark:|

# Apache Kafka
根據 [Kafka](https://kafka.apache.org/) 官網，他是這麼定義自己的產品的

> Apache Kafka is an open-source distributed event streaming platform \
> used by thousands of companies for high-performance \
> data pipelines, streaming analytics, data integration, and mission-critical applications.

對，Kafka 主要是用於 **event streaming**\
Kafka 鼓勵開發者以 event 的角度去思考世界\
每一次的變動都可以被視為是 "事件"，比如說使用者將某個商品放到購物車\
他是一個 event(事件)

而 event 擁有幾個特性
1. 它一定是 **有序的**，事件有先後順序
2. 事件不可以被改變，因為改變 = 另一個事件

## Architecture
Apache Kafka 本質上是 [Publisher-Subscriber Pattern](#publisher-subscriber-pattern) 的實現\
它擁有 
+ publisher 負責生產訊息
+ topic(log-like structure) 負責儲存訊息
+ subscriber 負責消化訊息

### Data Store
其中 topic 是主要儲存訊息的資料結構(N to N 的架構，可以有多個 publisher 也可以有多個 subscriber)\
它可以設定不同的名字，用以區分訊息種類，subscriber 再依據需要的主題進行監聽即可

topic 是一個 order sequence of event, 我們剛剛提到，事件是會分先後的\
並且 topic 本身的資料是 **durably stored** 的，亦即它不會因為斷電等因素而掉資料\
其中的原因為
1. 他是儲存在 `硬碟` 裡面
2. 資料會被拆成多份(partitioned)，並且擁有多個副本(replication), 可參考 [Partition and Replication](#partition-and-replication)

儲存在硬碟裡，是可以避免掉資料的問題\
但硬碟不是很慢嗎，Kafka 是如何維持高吞吐量的?\
well, 他們在 [4.2 Persistence](https://kafka.apache.org/documentation/#persistence) 裡面有詳細說明\
其中最大的優勢是在 **sequential I/O**(可參考 [資料庫 - 最佳化 Read/Write 設計(硬體層面) \| Shawn Hsu](../../database/database-optimization-hardware/#random-io-vs-sequential-io))

sequential I/O 根據他們的說法，相對於 Random I/O 有高達 6000 倍的效能提昇\
與其自己維護 in-memory cache 增加維護難度，程式複雜度\
並且 in-memory cache 如果碰上重啟，會需要有 warm up 的時間以及 cache miss 的問題\
我們可以藉著 kernel 的 page cache 自動幫我們做 cache(現代 OS 會利用空閒的記憶體用作 disk cache)，搭配上 sequential I/O\
使得整體的邏輯更簡單，並且效能也不會差太多

> 有關 cache 的討論，可參考 [資料庫 - Cache Strategies 與常見的 Solutions \| Shawn Hsu](../database-cache)

將源源不斷的事件資料，透過適當的壓縮儲存\
而這些原本屬於 random write 的資料，變成 linear write\
也就是可以利用上面提到的 sequential I/O

利用 page cache(disk cache) 搭配 [sendfile](https://man7.org/linux/man-pages/man2/sendfile.2.html) system call，更可以減少 overhead\
在傳輸資料的時候，sendfile 系統呼叫能夠減少 copy buffer 的次數\
使得 kernel-space 的資料可以直接透過 NIC buffer 傳到 consumer 手上(不用經過 user-space)

<hr>

另一個維持高吞吐量的重點在於儲存的資料結構\
Apache Kafka 是使用 log-like 的結構(e.g. queue) 儲存資料的\
你可曾想過為什麼它不使用像是 PostgreSQL 之類的資料庫嗎？

資料庫的操作，如果是 B-Tree 結構的\
我們知道他的時間複雜度是 $O(LogN)$(其中 N 為樹高)\
又根據我們對於 Sequential 以及 Random I/O 的認識，資料庫是屬於 **Random I/O**\
Random I/O 必須要做 disk seek, 而這個操作幾乎不可能 parallel 執行\
因此採用 B-Tree 結構會有一些 overhead

所以 Kafka 是使用 Queue 這個資料結構\
它可以實現真正意義上的 $O(1)$ 寫入\
而 Kafka 你可以想像成是寫入 **檔案**, 一個 topic 對應到一個資料夾，裡面有若干個檔案

> 另外就是，topic 裡面的資料不會因為已經被 consume 就把它刪掉\
> 我們可以設定資料要被留存多久

![](https://kafka.apache.org/images/streams-and-tables-p1_p4.png)
> ref: [INTRODUCTION](https://kafka.apache.org/intro)

<hr>

稍早我們也提到，message queue 有自己的通用格式\
Kafka 為了維持高吞吐量，也擁有自己的 binary message format\
broker, producer, consumer 都共用，所以不需要額外的處理

### Partition and Replication
Kafka 本身是分散式的系統\
就我們目前知道的，Kafka 的 topic 是會被 partitioned，配合 replication 可以達到高可用性\
每個 topic 裡面的資料都將被切分成若干個 partition(僅擁有部份 topic 的資料)\
Kafka 的設計是在單位時間內只允許一個 consumer 讀取一個 partition\
前面提到一個 topic 可以有很多個 consumer, 利用 partition 的方式可以達到高可用

而 Kafka 是使用 single leader replication 的機制\
亦即每個 partition 只有一個 node(leader) 負責寫入，剩下的 node(follower) 或是 leader 提供讀取的功能

如同教科書上對於 single leader replication 的描述一樣\
Kafka 一樣要處理節點失效的問題\
這部份是透過一個特殊的 node(稱為 `controller`)\
controller 主要負責做兩件事情
1. 定時將 metadata 更新至所有的 node
2. 監控並處理已經離線的 node(透過 `heartbeat`)

> 有關 single leader replication，可參考 [資料庫 - 最佳化 Read/Write 設計(硬體層面) \| Shawn Hsu](../../database/database-optimization-hardware/#single-leadermaster-slave)

Kafka 對於節點失效的定義有那麼一點點的不同\
以下兩種都可以被視為是失效的狀態
1. 節點無回應(i.e. 沒有接受到 heartbeat 的信號)
2. 節點回應得很慢，並且資料已經落後一小段
失效的節點，會從 ***ISR(In-Sync Replicas)*** 當中所移除

> ISR(In-Sync Replica) 指的是與 leader 同步的 replicas\
> 新的 leader 只能從 ISR 裡面挑選

### How to Consume Message
使用哪一種的 [Pull/Push Protocol](#pullpush-protocol) 是個好問題

以 Kafka 來說，是使用 pull based 的 protocol\
client 透過 offset 指定要從哪一個位置開始讀取\
因為資料的儲存方式是檔案，所以就是直接 seek 到指定位置，讀取一定數量的資料即可

再來的問題是\
即使資料是保存在硬碟當中的，我們不可能無限的永久的儲存\
他在某一天肯定是會被刪除的

確保資料被正確的 consume 是一件重要的事情\
[RabbitMQ](#rabbitmq) 會透過 acknowledgement 來確保資料被正確的讀取以及處理\
所以可以安全的刪除，但這會有問題
1. consume 了，處理了但是失敗了，同一個資料會被重複處理
2. 一筆資料現在必須包含 ack 的欄位，用以紀錄是否已經被正確的處理

Kafka 的設計是這樣的\
我一樣利用 ack 的概念，只不過我不需要每筆資料都紀錄\
因為 "事件" 的概念是 Kafka 的核心，而又因為他是儲存在類似檔案的結構裡面，他是有序的\
所以我只要紀錄該 consumer 的 offset 就好了(offset 以前的我就已經讀取完成了)\
我只需要 maintain offset 就好了, 相比維護每筆資料的 ack 這顯然輕量多了

> 此外透過 offset 我也可以讀取以前的資料(當你發現已經 consume 過的資料有錯誤的時候可以再次讀取)

## ZooKeeper and KRaft
> To be continued

# RabbitMQ
提到 message queue\
不免俗的還是要要介紹一下 RabbitMQ

## Architecture
RabbitMQ 是一套 open source 的 message broker\
其實作了 [AMQP](#amqp), 提供了高可用性、且易於擴展的分散式 broker 架構

其核心概念就如同我們上面討論過 [AMQP](#amqp) 一樣\
這裡就不在贅述

### How to Consume Message
RabbitMQ 是採用 [Pull/Push Protocol](#pullpush-protocol) 中的 push protocol\
亦即資料是由 server 主動推送至 client 的\
而這些資料會需要進行 acknowledgement 的操作，所以 producer 是知道 consumer 拿資料了沒\
並且這個資料不會像 Kafka 一樣是永久的儲存

然後 1 個 topic 通常只會有 1 個 consumer\
這點也是不同的

## Example
### Installation
一樣使用 docker 將服務跑起來
```shell
$ docker run -d \
    -p 5672:5672 \
    -p 15672:15672 \
    -e RABBITMQ_DEFAULT_USER=rabbitmq \
    -e RABBITMQ_DEFAULT_PASS=rabbitmq \
    rabbitmq:3.13-rc-management
```

container 需要使用兩個 port `5672` 與 `15672`\
其中 5672 是給 application 使用的，而 15672 則是 GUI 管理界面\
使用帳號密碼登入後你應該會看到類似以下的東西

![](https://www.cloudamqp.com/img/blog/rabbitmq-mngmt-overview.png)
> ref: [Part 3: The RabbitMQ Management Interface](https://www.cloudamqp.com/blog/part3-rabbitmq-for-beginners_the-management-interface.html)

### Hello world
```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    amqp "github.com/rabbitmq/amqp091-go"
)

func publishToMessageQueue(ch *amqp.Channel) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    counter := 1
    for {
        body := fmt.Sprintf("Hello World %v!", counter)
        err := ch.PublishWithContext(ctx, "", "test", false, false, amqp.Publishing{ContentType: "text/plain", Body: []byte(body)})
        if err != nil {
            log.Panic("Failed to publish message")
        }
        time.Sleep(1 * time.Second)
        counter += 1
    }
}

func consumeFromMessageQueue(ch *amqp.Channel) {
    queue, err := ch.Consume("test", "", true, false, false, false, nil)
    if err != nil {
        log.Panic("Failed to consume from queue")
    }

    for msg := range queue {
        log.Printf("Received message: %s", msg.Body)
    }
}

func main() {
    conn, err := amqp.Dial("amqp://rabbitmq:rabbitmq@localhost:5672/")
    if err != nil {
        log.Panic("Failed to connect to RabbitMQ")
    }
    defer conn.Close()

    ch, err := conn.Channel()
    if err != nil {
        log.Panic("Failed to open a channel")
    }
    defer ch.Close()

    _, err = ch.QueueDeclare("test", false, false, false, false, nil)
    if err != nil {
        log.Panic("Failed to declare queue")
    }

    go publishToMessageQueue(ch)
    go consumeFromMessageQueue(ch)

    select {}
}
```

雖然說 message queue 主要是拿來用作跨服務的溝通\
把它寫在同一隻檔案顯然是不正確的，不過這裡主要是展示如何使用 RabbitMQ 而已

code 主要的流程是\
建立與 RabbitMQ 的連線，建立 channel 以及 queue\
我很好奇一件事情，在先前的 [AMQP](#amqp) 裡面我們並沒有提到 channel 這個東西\
那他是要用來做什麼的？

> Next we create a channel, which is where most of the API for getting things done resides

如果你往下看就可以發現，publish 與 consume message 都是透過 channel 所建立的\
所以 channel 實際上可以算是 API 之間溝通的橋樑

<hr>

```go
ch.QueueDeclare("test", false, false, false, false, nil)
```
message queue 需要手動建立，參數依序為 name, durable, delete when unused, exclusive, no wait, arguments\
我們將 message queue 的名字命為 `test`, 其餘的都是 false

> queue 的建立僅會在不存在的時候建立(i.e. `idempotent`)

```go
ch.PublishWithContext(
    ctx, "", "test", false, false, 
    amqp.Publishing{ContentType: "text/plain", Body: []byte(body)}
)
```
publish data 到 queue 的方法是使用 `PublishWithContext`, 參數為 context, exchange name, routing key, mandatory, immediate, data\
context 就是 golang 的 context 套件\
比較值得注意的是 `exchange` 以及 `routing key`\
[AMQP - Exchange](#exchange) 中提到，要將訊息送往何處，是由 routing key 所決定的, 所以我們的 routing key 就是 `test`\
但是 exchange 欄位為什麼是 empty string?

很明顯的 根據 [AMQP - Exchange](#exchange) 以及 [AMQP - Binding](#binding) 所述\
這裡使用的 exchange type 是 `Direct Exchange` 所以 exchange 的值可以為空

```go
ch.Consume("test", "", true, false, false, false, nil)
```
consume data 的參數為，queue, consumer, auto-ack, exclusive, no-local, no await, args\
然後你可以用一個 for-loop 去取資料這樣

no await 表示不會等待 server 確認 request 並且立即開始傳送訊息

consumer 的欄位是 consumer tag，用以辨別 consumer 的 identity

auto-ack 是 acknowledge 的意思\
RabbitMQ 有提供 message acknowledgement，亦即你可以確保 consumer 有正確接收到資料\
這個 acknowledgement 是由 consumer 送回 server 的\
當 message 沒有被正確 receive，RabbitMQ 會自動將訊息重新 enqueue 確保資料不會消失

> 如果 Consume 有設置 auto-ack, 你手動呼叫 `msg.Ack()` 會錯哦

完整原始碼可以參考 [ambersun1234/blog-labs/message-queue](https://github.com/ambersun1234/blog-labs/tree/master/message-queue)

# Differences between Kafka and RabbitMQ

||[Apache Kafka](#apache-kafka)|[RabbitMQ](#rabbitmq)|
|:--|:--:|:--:|
|Pattern|Publisher-Subscriber Pattern|Producer-Consumer Pattern|
|Main Usage|event streaming|message proxy|
|Check on Receive|:x:|:heavy_check_mark:|
|Performance|Million messages per second|Thousands messages per second|
|Authentication|:heavy_check_mark:|:heavy_check_mark:|
|Fault Tolerance|:heavy_check_mark:|:heavy_check_mark:|
|Data Persistence|:heavy_check_mark:(with delay)|:x:(delete on acknowledgement)|
|Message Fetching|pull based|push based|

# References
+ [Kafka 和 RabbitMQ 有何區別？](https://aws.amazon.com/tw/compare/the-difference-between-rabbitmq-and-kafka/)
+ [高級消息隊列協議](https://zh.wikipedia.org/zh-tw/%E9%AB%98%E7%BA%A7%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97%E5%8D%8F%E8%AE%AE)
+ [Advanced Message Queuing Protocol](https://en.wikipedia.org/wiki/Advanced_Message_Queuing_Protocol)
+ [什麼是 MQTT？](https://aws.amazon.com/tw/what-is/mqtt/)
+ [Getting Started with Java Message Service (JMS)](https://www.oracle.com/technical-resources/articles/java/intro-java-message-service.html)
+ [What is Apache Kafka?](https://youtu.be/vHbvbwSEYGo)
+ [Introduction](https://www.rabbitmq.com/tutorials/tutorial-one-go.html)
+ [三種Exchange模式](https://jim-5.gitbook.io/rabbitmq/san-zhongexchange-mo-shi)
+ [Consumer Tags](https://www.rabbitmq.com/consumers.html#consumer-tags)
+ [9张图，Kafka为什么要放弃Zookeeper](https://www.51cto.com/article/658581.html)
+ [4.7 Replication](https://kafka.apache.org/documentation/#replication)
+ [5.5 Distribution](https://kafka.apache.org/documentation/#distributionimpl)
+ [KRaft: Apache Kafka Without ZooKeeper](https://developer.confluent.io/learn/kraft/)
+ [ZooKeeper](https://zookeeper.apache.org/doc/current/zookeeperOver.html)
+ [什麼是無效字母佇列 (DLQ)？](https://aws.amazon.com/tw/what-is/dead-letter-queue/)
