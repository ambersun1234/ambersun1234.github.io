---
title: 設計模式 101 - Observer Pattern
date: 2023-05-17
categories: [design pattern]
tags: [observer, observable, subject, publisher, subscriber, topic]
math: true
---

# Observer Pattern
程式設計中，時常會需要處理到所謂的 "事件"\
這些的事件的出現是 **隨機的**, 亦即你沒辦法判定何時何地會突然有一個事件送進來

而在傳統的實作當中，我們常常必須以 background-thread 對事件進行監聽\
舉例來說，[Polling](https://en.wikipedia.org/wiki/Polling_(computer_science))，每隔一段時間主動詢問狀態是否更新\
但這通常不是一個很好的辦法，因為很耗 cpu time

觀察者模式的出現可以很有效的解決上述問題\
既然讓 Observer(觀察者) 一直去做監聽的事情，不如讓 Subject 在事件發生時，主動喚醒 Observer(就像 [Webhook](https://en.wikipedia.org/wiki/Webhook))\
如此一來，觀察者就 **不用一直傻傻的等待事件發生**

> 注意到是 Subject 通知 Observer 有事件\
> 所以 Observer Pattern 只是解決了等待事件而已

除了以上好處，Observer Pattern 還解決了哪些事情呢？\
由 Observer 主動更新狀態而非由 Subject 主動更新所有 Observer, 這樣賦予了彈性
+ 降低耦合性
    + 更新的過程完全由 Observer 掌控可以大幅的降低耦合性(因為 Subject 內部要有每一個 Observer 的 update 方法)
+ 依賴反轉
    + Subject 必須確保所有 Observer 都實作了相同的 `interface`(通知事件), 如果沒有統一規範，即使由 Subject 主動通知更新，也會遇到每個 class 的通知長的不一樣(e.g. `getUpdate`, `update` ... etc.)
    + 如此一來，Subject 依賴的對象就不會是 class 而是 interface 了
+ 一對多關係
    + Subject 作為唯一擁有狀態的物件，負責將狀態同步更新至多個不同的觀察者(Observer)

## Data
Observer pattern 主要以 Subject 進行主動推送資料至 Observer 實做\
但是也有另一種方法是讓 Observer 主動更新(透過 Subject 的 public getter)\
但一般來說是使用推送的方法居多

## Implementation
這裡我們嘗試實作一次 observer pattern
```python
from abc import ABCMeta, abstractclassmethod

# 定義 interface
class Observer:
    __metaclass__ = ABCMeta

    @abstractclassmethod
    def notify(self, value: int) -> None: raise NotImplementedError

# 定義 subject, 發送事件
class Subject:
    def __init__(self):
        self.observers = list()
        self.counter = 0

    # 發送事件
    def next(self, value: int) -> None:
        self.counter = value
        self.notify_observers()

    # 通知所有訂閱者
    def notify_observers(self) -> None:
        for observer in self.observers:
            observer.notify(self.counter)

    # 訂閱
    def subscribe(self, observer: Observer) -> None:
        self.observers.append(observer)

    # 取消訂閱
    def unsubscribe(self, observer: Observer) -> bool:
        try:
            self.observers.remove(observer)
        except ValueError as e:
            pass
        finally:
            return True

# 訂閱者 john
class John(Observer):
    def __init__(self):
        self.counter = 0

    def notify(self, counter: int) -> None:
        self.counter = counter
        print(f"[John] new observable counter: {self.counter}")

# 訂閱者 bob
class Bob(Observer):
    def __init__(self):
        self.counter = 0

    def notify(self, counter: int) -> None:
        self.counter = counter
        print(f"[Bob] new observable counter: {self.counter}")

if __name__ == "__main__":
    subject = Subject()
    john = John()
    bob = Bob()

    subject.next(0)

    subject.subscribe(john)
    subject.subscribe(bob)
    subject.next(1)

    subject.unsubscribe(bob)
    subject.next(2)
```

上述程式碼執行結果如下
```shell
$ python3 observer_pattern.py
[John] new observable counter: 1
[Bob] new observable counter: 1
[John] new observable counter: 2
```

上述實作就是一個簡單的 observer pattern, 你可以看到當 subject 發送事件的時候，它會一一通知所有 observer list 裡面的訂閱者，使其主動更新資料
+ 在 `subject.next(0)` 的時候因為目前沒有訂閱者，所以 john 跟 bob 都沒有收到上一個更新的資料(有時候你會希望說新的訂閱者能夠拿到上一個事件的資料，我們之後在 ReplaySubject 會提到)
+ 在 `subject.next(1)` 的時候，john 以及 bob 都有拿到最新的訂閱資料
+ 在 `subject.next(2)` 的時候，因為 bob 已經取消訂閱了，所以只有 john 有拿到更新的資料

# Producer-Consumer Pattern
同樣都是發送訊息給訂閱者\
[Observer Pattern](#observer-pattern) 是為了要讓 **每個訂閱者都有資料**\
但是 Producer-Consumer 的目標在於，透過多個 consumer 消化資料\
所以他的目的是 **消化**

所以我沒必要讓全部的訂閱者都拿到資料\
因此，一筆資料只會由一個 consumer 處理\
所以 Producer-Consumer Pattern 是屬於 1 To 1 的架構

# Publisher-Subscriber Pattern
跟 [Observer Pattern](#observer-pattern) 一樣擁有 publisher(subject) 以及 subscriber(observer)\
不同的是他們發送事件的方式
+ Observer Pattern 是直接通知訂閱者更新資料
+ Publisher-Subscriber Pattern 是透過 ***event bus*** 進行資料傳遞

也就是說 Publisher-Subscriber 可以用於不同系統上的事件監聽\
透過將資料放在 event bus 當中讓訂閱者自行拿取\
你有沒有覺的這個跟 [shared memory](https://en.wikipedia.org/wiki/Shared_memory) 有點類似

同樣都是透過將資料放在同一個地方進行傳遞\
並且也有生產者(publisher)以及消費者(subscriber)\
而且他們都 **不知道對方的存在**，亦即誰送的資料誰收的資料其實對它來說都是未知的

唯一不同的是，訂閱者可能會訂閱不同的東西對吧？\
假設 A 要訂閱 X, B 要訂閱 Y\
那麼不同資料全部混在同一個 event bus 裡頭顯然是不合理的，因此我們需要對不同資料進行 filter 處理

## Message Filter
### Topic Based
publisher 送出的訊息中會帶有所謂的 topic, 而 subscriber 只會收到相對應的 topic 發送的訊息\
你可以把它想像成標籤，它會對訊息進行分類

### Content Based
根據內容屬性進行分類

<hr>

當然也有部份系統支援兩種模式，亦即 publisher 發送帶有特定 topic 的訊息，而 subscriber 可以根據 topic 註冊其內容屬性\
這邊附上兩張對比圖，可以更清楚的了解其差異

![](https://miro.medium.com/max/770/1*s1kclXywIwae86iNa7cKZQ.png)
![](https://miro.medium.com/max/495/1*-GHFC93E4ODwNc98IE5_vA.gif)
> ref: [Observer vs Pub-Sub Pattern](https://betterprogramming.pub/observer-vs-pub-sub-pattern-50d3b27f838c)

# Differences Comparison

|Description|[Observer Pattern](#observer-pattern)|[Publisher-Subscriber Pattern](#publisher-subscriber-pattern)|[Producer-Consumer Pattern](#producer-consumer-pattern)|
|:--|:--:|:--:|:--:|
|Message Delivery|Synchronous|Asynchronous|Asynchronous|
|Aware of Subscriber|:heavy_check_mark:|:x:|:x:|
|Decouple|:x:|:heavy_check_mark:|:x:|
|Broker|:x:|:heavy_check_mark:|:x:|
|Type|1 to Many|1 to Many<br>Many to Many|1 To 1|

# References
+ 深入淺出設計模式 第二版(ISBN: 978-986-502-936-4)
+ [Observer vs Pub-Sub Pattern](https://betterprogramming.pub/observer-vs-pub-sub-pattern-50d3b27f838c)
+ [Publish-subscribe pattern](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern#Message_filtering)
+ [Publish/Subscribe vs Producer/Consumer?](https://stackoverflow.com/questions/42471870/publish-subscribe-vs-producer-consumer)
