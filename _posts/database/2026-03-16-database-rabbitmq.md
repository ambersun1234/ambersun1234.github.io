---
title: 資料庫 - 解耦助手 RabbitMQ
date: 2026-03-16
categories: [database]
description: 了解 Message Queue 之後，RabbitMQ 作為其中常用的解決方案，本文將會介紹其基本概念以及一些在實作中你需要注意的小細節
tags: [distributed, cluster, message queue, consumer, producer, event, amqp, rabbitmq, prefetch, qos, round robin]
math: true
---

# Prerequisites
有關 Message Queue 的相關概念可以參考 [資料庫 - 從 Apache Kafka 認識 Message Queue \| Shawn Hsu](../../database/database-message-queue)\
本文會注重在 RabbitMQ 的部份

# RabbitMQ
提到 message queue\
不免俗的還是要要介紹一下 RabbitMQ

## Architecture
RabbitMQ 是一套 open source 的 message broker\
其實作了 [AMQP](../../database/database-message-queue#amqp), 提供了高可用性、且易於擴展的分散式 broker 架構

### Data Store
與 [Kafka](../../database/database-message-queue#apache-kafka) 類似，他們都有 disk store\
但 RabbitMQ 還有支援 in-memory store\
速度，吞吐量上兩種方式沒有明顯的差異

因為 RabbitMQ 是一個 queue 的結構，所以其保證了資料的有序性\
先進去的資料一定會先出來

但如果今天你的資料具有優先級\
要怎麼區分不同的資料優先級呢？
1. 開不同的 queue 負責處理不同優先級的資料，類似稍早提過的 [DLQ](../../database/database-message-queue#dlqdead-letter-queue)
2. 使用 `priority queue`(RabbitMQ 有支援)

> Kafka 做不到資料優先級的區分

### How to Consume Message
RabbitMQ 是採用 [Pull/Push Protocol](../../database/database-message-queue#pullpush-protocol) 中的 push protocol\
亦即資料是由 server 主動推送至 client 的\
而這些資料會需要進行 acknowledgement 的操作，所以 producer 是知道 consumer 拿資料了沒

然後 1 個 topic 通常只會有 1 個 consumer\
你可以有多個 consumer, 這個情況用於資料產生的速度來不及消化，所以你選擇多個 consumer 來消化資料\
要注意的是 **同一份資料只會被消化一次**，所以他不會重複讀取

RabbitMQ 會使用 ACK 來確保資料被正確的消化(可參考 [重新認識網路 - 從基礎開始 \| Shawn Hsu](../../network/network-basics#three-way-handshake))\
在下面的例子可以看到我們在 consume 的時候就自動使用 ACK 通知 producer 資料已經被消化\
自動 ACK 很方便，但是當 consumer 直接 crash 的時候，資料就會丟失了\
因為你已經自動確認消化了，producer 就會把資料刪掉

> 如果你 disable auto ack 要記得手動 ACK\
> 不然東西會卡住

但是 consumer panic 可能並非你的本意，所以你可以選擇手動 ACK 避免這個問題\
consumer 的 for loop 裡面，你可以選擇執行完再進行 ACK\
這樣既可以確保資料被正確的消化，又可以避免 application 直接 crash 資料丟失的問題

> 注意到他跟我們手動 retry 的概念不太一樣\
> 這裡手動 ACK 是怕 consumer 直接 panic(nil pointer dereference 之類的), 資料丟失的問題\
> retry 是因為處理失敗，所以要重新 re-enqueue([Re-enqueue Message](../../database/database-message-queue#re-enqueue-message))

### Auto Reconnect
網路超級不可靠，它會一直斷斷續續的\
我自身的例子來說，本地 docker 開發連線都非常的穩定\
一旦上到 server 就會開始時常斷線\
擁有自動重新連線的功能是非常重要的

RabbitMQ 你可以透過 [NotifyClose](https://pkg.go.dev/github.com/streadway/amqp#Connection.NotifyClose) 監聽 connection close 的事件(channel 或 connection)\
寫起來大概長這樣

注意到，不能寫 `case <- r.conn.NotifyClose(make(chan *amqp.Error))`\
他有可能會接不到 notify close 的訊號\
然後他也不會死掉，就是會整個無回應

> 建議使用 buffered channel 避免 deadlock

```go
msgs, err := r.channel.Consume(key, "", false, false, false, false, nil)
if err != nil {
    panic(err)
}

connectionChan := r.conn.NotifyClose(make(chan *amqp.Error, 1))
channelChan := r.channel.NotifyClose(make(chan *amqp.Error, 1))

for {
    select {
    case msg := <-msgs:
        // consume message
    
    case <-connectionChan:
        fmt.Println("RabbitMQ connection closed, reconnecting...")
        // do reconnect

    case <-channelChan:
        fmt.Println("RabbitMQ channel closed, reconnecting...")
        // do reconnect
    }
}
```

## Default RabbitMQ Queue
像有一些資料庫有一個功能是它可以有預設的 table\
RabbitMQ 也有一樣的東西

需要先開啟載入 definition 的設定開關
```conf
# rabbitmq.conf
management.load_definitions = /etc/rabbitmq/load_definitions`.json
```

這裡 queue 就是你預設要建立的 queue 相關的設定\
user 會需要是因為要登入才有權限可以操作\
注意到 permission 還是需要寫，即使你的 application 也是使用同一組帳號

import definitions 的時候，vhost 必須要設定\
不然你會遇到 `exit:{error,<<"Please create virtual host \"/\" prior to importing definitions.">>}`

> 完整範例可以參考 [ambersun1234/blog-labs/message-queue](https://github.com/ambersun1234/blog-labs/tree/master/message-queue)

{% raw %}
```json
// load_definitions.json
{
    "users": [
        {
            "name": "rabbitmq",
            "password": "rabbitmq",
            "tags": ["administrator"]
        }
    ],
    "queues":[
        {
            "name": "my_queue",
            "vhost":"/",
            "durable":true,
            "auto_delete":false,
            "arguments":{}
        }
    ],
    "vhosts": [
        {
            "name": "/"
        }
    ],
    "permissions":[
        {
            "user":"rabbitmq",
            "vhost":"/",
            "configure":".*",
            "read":".*",
            "write":".*"}
    ]
}
```
{% endraw %}

## Delay Delivery
除了支援優先級的機制，RabbitMQ 還有支援 delay delivery 的機制\
也就是將資料暫存在 queue 中，等到時間到了才會被消費

可參考 [資料庫 - Delayed Queue 的設計與考量 \| Shawn Hsu](../../database/database-delayed-queue)

# Scale with RabbitMQ
基本上你可以透過建立多個 consumer 同時消費同一個 Queue 就可以達到 scaling 的效果\
RabbitMQ 它本身是採 **Round Robin** 的方式來分配資料給 consumer\
不過有一個地方要注意，就是 [prefetch](https://www.rabbitmq.com/docs/consumer-prefetch)

Qos 的設計是為了盡量讓 `server` 跟 `client` 端之間的 network buffer 盡量保持 "塞滿" 的狀態\
這跟我們一般想的不一樣，有了 prefetch 之後，如果遇到瞬間很多 task，只要 buffer 大小還夠，它會一次性塞進去其中某一個 consumer 身上\
所以在 "該 consumer" 身上，Head-of-Blocking 這件事是存在的\
並且如鍋 "該 consumer" 掛掉，所有 buffer 上的資料都要重新從 server 發過來\
CPU 的負載會突然變高

只有當你把 prefetch 設定為 1 的時候，才是真正的 **Round Robin**

你可以參考 [Hello World](#hello-world) 的範例\
可以看到這裡有設定 prefetch 為 100\
搭配 `consumeSingleFromMessageQueue`\
只有讀取一個就退出，可以得到以下結果

![](/assets/img/posts/rabbitmq-prefetch.png)

可以看到，`unacked` 的數量是 *100*，符合我們的設定

當你把 consumer 停掉之後，就可以看到 `unacked` 的數量變成 *0*\
然後 `ready` 的數量增加然後變成 *999*

![](/assets/img/posts/rabbitmq-prefetch1.png)

# Example
## Installation
一樣使用 docker 將服務跑起來
```shell
$ docker run -d \
    -p 5672:5672 \
    -p 15672:15672 \
    -e RABBITMQ_DEFAULT_USER=rabbitmq \
    -e RABBITMQ_DEFAULT_PASS=rabbitmq \
    rabbitmq:3.13-rc-management
```

> `rabbitmq` image 是沒有帶管理介面的，記得要用有 management 的 image

container 需要使用兩個 port `5672` 與 `15672`\
其中 5672 是給 application 使用的，而 15672 則是 GUI 管理界面\
使用帳號密碼登入後你應該會看到類似以下的東西

![](https://www.cloudamqp.com/img/blog/rabbitmq-mngmt-overview.png)
> ref: [Part 3: The RabbitMQ Management Interface](https://www.cloudamqp.com/blog/part3-rabbitmq-for-beginners_the-management-interface.html)

## Hello world
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
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	counter := 1
	for i := 0; i < 1000; i++ {
		body := fmt.Sprintf("Hello World (iter %v) %v!", counter, i)
		if err := ch.PublishWithContext(context.Background(), "", "test", false, false, amqp.Publishing{ContentType: "text/plain", Body: []byte(body)}); err != nil {
			log.Panic("Failed to publish message", err)
		}
	}
}

func consumeSingleFromMessageQueue(ch *amqp.Channel) {
	queue, err := ch.Consume("test", "", false, false, false, false, nil)
	if err != nil {
		log.Panic("Failed to consume from queue", err)
	}

	for msg := range queue {
		log.Printf("Received message: %s", msg.Body)
		msg.Ack(false)
		break
	}
}

func consumeFromMessageQueue(ch *amqp.Channel) {
	queue, err := ch.Consume("test", "", false, false, false, false, nil)
	if err != nil {
		log.Panic("Failed to consume from queue", err)
	}

	for msg := range queue {
		log.Printf("Received message: %s", msg.Body)
		msg.Ack(false)
	}
}

func main() {
	conn, err := amqp.Dial("amqp://rabbitmq:rabbitmq@localhost:5672/")
	if err != nil {
		log.Panic("Failed to connect to RabbitMQ", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Panic("Failed to open a channel", err)
	}
	defer ch.Close()
	if err := ch.Qos(100, 0, false); err != nil {
		log.Panic("Failed to set QoS", err)
	}

	_, err = ch.QueueDeclare("test", false, false, false, false, nil)
	if err != nil {
		log.Panic("Failed to declare queue", err)
	}

	go publishToMessageQueue(ch)
	time.Sleep(10 * time.Second)
	go consumeSingleFromMessageQueue(ch)
	// go consumeFromMessageQueue(ch)

	select {}
}

```

雖然說 message queue 主要是拿來用作跨服務的溝通\
把它寫在同一隻檔案顯然是不正確的，不過這裡主要是展示如何使用 RabbitMQ 而已

code 主要的流程是\
建立與 RabbitMQ 的連線，建立 channel 以及 queue\
我很好奇一件事情，在先前的 [AMQP](../../database/database-message-queue#amqp) 裡面我們並沒有提到 channel 這個東西\
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
[AMQP - Exchange](../../database/database-message-queue#exchange) 中提到，要將訊息送往何處，是由 routing key 所決定的, 所以我們的 routing key 就是 `test`\
但是 exchange 欄位為什麼是 empty string?

很明顯的 根據 [AMQP - Exchange](../../database/database-message-queue#exchange) 以及 [AMQP - Binding](../../database/database-message-queue#binding) 所述\
這裡使用的 exchange type 是 `Direct Exchange` 所以 exchange 的值可以為空

```go
ch.Consume("test", "", false, false, false, false, nil)
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

# References
+ [How to create a queue in RabbitMQ upon startup](https://stackoverflow.com/questions/58266688/how-to-create-a-queue-in-rabbitmq-upon-startup)
+ [Consumer Tags](https://www.rabbitmq.com/consumers.html#consumer-tags)
+ [Introduction](https://www.rabbitmq.com/tutorials/tutorial-one-go.html)
+ [三種Exchange模式](https://jim-5.gitbook.io/rabbitmq/san-zhongexchange-mo-shi)
+ [Priority](https://www.rabbitmq.com/docs/consumers#priority)
+ [Consumer Prefetch](https://www.rabbitmq.com/docs/consumer-prefetch)
+ [Channel Prefetch Setting (QoS)](https://www.rabbitmq.com/docs/confirms#channel-qos-prefetch)
