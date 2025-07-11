---
title: 資料庫 - 分散式系統中的那些 Read/Write 問題
date: 2024-07-05
description: 分散式系統是如今系統架構中最重要的一個概念之一，由於其複雜程度高，因此也衍生出了許多需要考慮的事情。本文將一一列舉這些問題，並且更深入的理解分散式系統的設計
categories: [database]
tags: [database, distributed, cluster, byzantine fault, split brain, network, clock, monotonic read, vector clock, version vector, last write wins, lamport timestamp, transaction, 2PC, 3PC]
math: true
---

# Unstable Network
在分散式系統中，每個節點多為使用網路互相連接起來的\
然而網路實際上是不可靠的

> 網路比你我想像的更不可靠

想想看以下這些問題
1. 請求/回應 丟失，封包在路上掉了
2. 節點失效，你不知道你的請求有沒有正確的被處理
3. 節點暫時停止回應，可能因為目前 request 太多，處理的速度變慢

對於 client 來說，以上這幾種狀況是沒辦法分別的\
你唯一能確定的只有，我沒收到回應\
那在這種情況下你要怎麼處理？

寫過 web application 的你可能在處理 router 的時候，有寫過類似 timeout 的東西\
他的目的也挺簡單的，就是當我超過多久時間沒回應的時候，我就不等了，直接回一個 error\
對於分散式系統來說，這也是一個可行的方法\
只不過他的 timeout 要怎麼設定？
+ 固定 timeout 時間
    + 有可能節點只是太忙所以導致回應時間變慢，如果它已經成功寫入，但卻被你回了一個 error，很明顯這是不對的
    + 如果我們認為你一直 timeout 是因為節點已經失效了，把你的請求轉移到其他節點，那不是更糟嗎？
+ 動態 timeout 時間
    + 動態的設定 timeout 時間是不是顯得合理多了？
    + 透過實驗或是動態測量網路 round trip 的時間，動態設定，是不是就能夠取得平衡了

# Unreliable Clock
有玩過一些單機遊戲的你，可能有發現一個可以偷吃步的方法\
有一些遊戲不是會有所謂的每日登入獎勵嗎？ 其實你可以透過更改手機或電腦的時間，然後拿到獎勵\
這很明顯的是一個開發商的失誤，不過藉此你也可以發現，用時間來判斷一些東西顯然不是這麼的合適

> 有關時鐘的介紹，可以搭配 [Linux Kernel - Clock \| Shawn Hsu](../../linux/linux-clock) 一起參考

不同電腦的硬體時鐘可能會有些微的差異(millisecond 之類的)\
但即使是在我們看來是這麼微小，每天的誤差可能越來越大，對於精準度極為要求的環境下仍然是不可忽視的

> 可以使用 NTP(Network Time Protocol) 來同步時間

舉例來說，multi-leader replication 的情況下允許多個節點同時寫入\
那它極大可能會出現衝突的情況，上面我們有提到說可以使用 [Last Write Wins](#last-write-wins) 或 [version vector](#version-vector) 等等的解法去處理衝突

錯誤的時鐘，有可能會導致錯誤的資料被寫入，而這種錯誤是無法被感知到的

# Data Consistency
在分散式系統中，根據 [CAP Theorem](../../database/database-distributed-database) 我們知道\
AP 系統，沒辦法保證所有節點在收到相同的資料的時候維持一致(因為還沒同步完成)\
所以這類系統提供的保證通常都是 **Eventually Consistent**\
也就是他最終會趨於一致，只是時間不好說

也因此這個保證是非常弱的\
那最強的保證是什麼？ 是 **Strong Consistency**\
強一致性的系統，在高階角度看下來就好像只有一個資料副本\
也就是說他並不會出現一些奇奇怪怪的狀況，例如說寫進去的資料過一段時間才出來之類的

> 一個可線性化的系統(強一致性)，本身就會提供近新保證\
> 單台資料庫並不一定可以線性化，要看隔離機制\
> snapshot isolation 不能保證 linearizability，因為 snapshot 不能讀到比他新的資料

> 有關 isolation 的介紹，可以參考 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction)

但是，最終一致性與強一致性，跨距太遠了\
我們需要有一些介於兩者之間的保證 [Read-after-write](#read-after-write), [Monotonic Read](#monotonic-read), [Same Prefix Read](#same-prefix-read)\
這些都在一定程度上保證了資料的一致性

## Read-after-write
一個常見的問題是，我寫入的資料，我馬上讀取，卻讀不到\
而原因在於你寫入與讀取的 replica 可能是不同台機器，資料還沒有同步這麼快\
對於使用者來說這無疑是很奇怪的，我應該要能夠看到我剛剛做的改變

`read-after-write` 保證了，你寫入的資料，你馬上讀取，就會讀到\
但是對於別人的資料，就無法保證

解法可以針對自己的資料，讓他讀取 leader 的 replica，這樣就保證不會有未同步的問題\
缺點是當讀取自己的資料量大的時候，速度就會變慢了

## Monotonic Read
更糟糕的是，如果多次查詢，返回的結果不一致，這可能比查不到還要糟糕\
比如說，你查詢一個商品的庫存，第一次查詢是 10，第二次查詢是 0，第三次又是 10\
那他到底是有還是沒有？ 這種 **時間倒流的現象** 是 Monotonic Read 想要避免的問題

問題同樣也在讀取不同的 replica 資料同步問題\
解決的辦法也滿簡單的，你只要確保，該 user 的所有 request 都是由同一個 replica 處理就好了\
比如說用 hash function 將特定的使用者全部導向特定的機器上\
稱之為 `Monotonic read`

> 為什麼叫做單調讀取？ 因為當你讀了新的資料，就保證不會讀到舊的

問題是出在讀取不同的 replica 資料，那解法很自然就是讀取相同的 replica

## Same Prefix Read
假設資料有順序性或者說因果關係\
讀取不同 replica 的資料，也同樣是遇到同步問題，導致使用者會看到牛頭不對馬尾的資料\
比如說留言板，留言的順序是有因果關係/時間關係的

一樣是因為讀取不同 replica 資料造成的\
解法可以讀取相同的 replica, 或者是依靠時間戳記，但時間並不可靠，可參考 [Unreliable Clock](#unreliable-clock)

# Read/Write Phenomena
單一節點(以及 single leader)的讀寫異常，我們在 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction#database-read-write-phenomena) 已經看了滿多的\
但在分散式系統中，事情更複雜了，尤其是在 multi-leader 以及 leaderless replication 的情況下

雖然 multi leader 會增加系統的複雜度\
但是在某些情況下，multi leader 會是一個不錯的選擇\
single leader 因為每個 partition 只能有一個 leader，所以所有寫入都必須要經過他\
這顯然在某些情況下會增加延遲，這並不是我們想看到的

> 可參考 [資料庫 - 初探分散式資料庫 \| Shawn Hsu](../../database/database-distributed-database/)

但要怎麼處理 multi leader 帶來的衝突問題？\
以我們熟知的版本控制工具 git 來說，通常是我們要手動處理衝突\
分散式系統下，不是不行啦 但我們有更好的方法

## Last Write Wins
把最後一筆寫入的資料當成是正確的資料是一種做法\
但是分散式系統下，每一台機器的時間可能會有誤差，幾毫秒甚至幾秒，這些誤差會導致你無法判斷誰是最後一個寫入的

> 時間戳記不一定代表事件的先後順序

刪除舊的資料這件事情並不會收到任何的通知\
所以在別的節點看來會有部分資料神秘地消失了

除此之外，Last Write Wins 無法判斷事件的先後順序\
`順序寫入` 與 `並發(concurrent)` 在時間上的表示都是類似的\
所以你會需要額外的機制判斷資料的因果關係(如 vector clock, [Lamport Timestamp](#lamport-timestamp) 或 logical clock)

為了避免資料被安靜的刪除\
如 [Cassandra](https://cassandra.apache.org/_/index.html) 推薦每個寫入 assign 一個 UUID

## Lamport Timestamp
既然用絕對時間會有誤差，我能不能使用類似的方法\
使用一個單調遞增的數字表示事件的先後順序，數字小的先發生，數字大的後發生(i.e. `logical clock`)

Lamport Timestamp 是類似的概念\
他由 (node id, counter) 所組成\
counter 就是那個單調遞增的數字，針對每一次對 x 的操作我都 counter++\
這樣一來，藉由排序 counter 我就可以知道事件的先後順序，也知道是誰做的改變(根據 node id)

看似美好但執行起來會有點小問題\
因為 Lamport Timestamp 是存在在廣大的叢集裡面\
要知道順序，唯一的辦法只有從系統當中收集所有資訊才能判斷\
也因此他所花費的時間很多，況且萬一其中一個節點掛掉，你就很難確定事件的先後順序了

## Version Vector
![](https://miro.medium.com/v2/resize:fit:1400/1*cjgLEXEx9aTEQ7tblwtoeg.png)
> ref: [《Designing Data-Intensive Applications》ch 5—Replication](https://medium.com/theskyisblue/designing-data-intensive-applications-ch-5-replication-4e89f92eb93f)

簡單來說，就是替每個 key 維護一個版本號\
藉由版本號，系統可以知道依賴關係(注意到不是順序關係)\
比對版本號，你可以知道淺在的衝突，但 version vector 本身並沒有辦法解決衝突\
他只是會儲存所有已經寫入的資料，並提供一個機制讓你可以知道這些資料的因果關係

> 注意到他跟 vector clock 不是一個東西\
> vector clock 是用於確認事件的先後關係\
> version vector 是用於確認資料的因果關係(使用者發文前必須要有帳號)\
> 也可以使用 logical clock(單調遞增的計數器) 來達到類似的效果

# Transaction
[資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction) 裡面我們知道了各種 Transaction 的細節\
重點在 unit of work 對吧，我希望全部的操作都是一起成功或是一起失敗\
分散式系統下，你的操作不一定會在同一個資料庫下，那你要怎麼保證 unit of work?

舉例來說，新的使用者註冊服務需要
1. user table 新增一筆資料
2. permission table 也新增一筆資料

我們學過 partition 以及 replication\
所以當上述的 table 不在同一個地方的時候，你要怎麼做 transaction 呢？

## Two-phase Commit(2PC)
核心想法是，他依然是 transaction，只是他的 commit 在不同的機器上完成的\
為了追蹤每一台機器上的 transaction 的狀況，你需要一個 coordinator\
他會決定要不要執行這個 transaction，具體來說他會這樣做

他會問每一台參與交易的資料庫，你能不能執行這個 transaction\
為什麼會有不能執行的問題？ 可能是因為 unique constraint 這種東西或者是其他外力影響(網路斷線，硬碟滿了 ... etc.)導致無法 commit\
如果有一台資料庫回覆說不能執行，那這個 transaction 就會被取消

> 注意到，2PC 要求 **所有人** 都同意才能 commit

反之，如果每一台資料庫都確定可以執行，那 coordinator 會發送 commit 的指令\
然後每個人都個別做 commit

<hr>

所以所謂的 2 phase commit 指的是
1. coordinator 確認每個人都可以 commit(prepare phase)
2. 由 coordinator 發送 commit 指令(commit phase)

> coordinator 扮演著類似 `transaction manager` 的角色\
> 所有節點的 commit 都會由 coordinator 控制，並 assign 一個全域的 transaction id

### Issue
2PC 有一個問題，就是當 coordinator 掛掉的時候，整個 transaction 就會陷入一個自我懷疑的狀態\
前面提到，2PC 要不要執行交易，是由 coordinator 決定的\
也就是說，只有 coordinator 知道要不要做，參與交易的節點是被動的接收指令的\
節點接收不到指令，他就不知道要不要 commit，這就是 2PC 的問題

那節點這時候會做什麼？\
nothing, 等待 coordinator 的回應 如此而已

> 對於有一些節點已經 commit 了的情況，這時候 coordinator 掛掉，這些節點就會一直等待，直到 coordinator 回來\
> 恢復了之後，因為 coordinator 有保留之前的決策，所以 2PC 可以保證 eventual consistency

## Three-phase Commit(3PC)
3PC 為了解決 coordinator 掛掉的問題，與其讓節點等待，而且不知道要等多長時間\
不如讓節點擁有部分選擇的權利

所以 3PC 會多加一個 phase，叫做 `can commit`\
這個 phase 是在 prepare phase 之後，commit phase 之前\
在真正 commit 之前，他有一個等待的時間，而 3PC 假設這個時間是有限的\
我跟你說，我已經準備好 commit 了，但是我要等一下，等 coordinator 給我 commit 的指令\
如果 coordinator 一直沒有回應，我就自己 commit(因為 prepare phase 的時候大家都同意可以執行交易)\
這個等待的時間有兩個好處
1. 維持原本 2PC 交給 coordinator 判斷的權利
2. 避免無限等待的情況

不過分散式系統中，假設擁有有限的等待時間這件事情是錯誤的\
有時候單純是因為網路斷線，導致 coordinator 無法回應\
這時候，節點就會自己 commit，這樣就會導致資料不一致的問題\
當然，因為所有節點都同意可以 commit，所以 3PC 依然可以保證 eventual consistency

# Split Brain
節點的故障有時候是無意的

比如說在 single-leader architecture 下\
leader 可能會因為短暫的不可用(GC 導致 `stop-the-world`, 瞬間流量太大導致處理回應時間變長或是網路異常 ... etc.)\
而被降級成 follower\
但是 old leader 可能沒有意識到它不再是 leader\
這個時候就會出現 2 個 leader 的情況\
這種情況稱為腦分裂(Split Brain)

有一個解法是這樣子的\
透過簡單的 `fencing token`, 判斷你是否為合法的 leader\
其他 follower 會透過這個 token 去尋找合法的 leader\
因此，大家都知道誰是真正的 leader

> 這個 token 本質上就是一個單調遞增的數字，數字大的擁有者就是 leader

問題來了\
old leader 恢復上線，並開始運作\
這時候 follower 會告訴他說，根據 fencing token 你已經不再是 leader\
因為 token 不一樣了，現在的 leader 是別人(token 的擁有者)\
透過這樣的機制就可以避免腦分裂的問題

# Byzantine Fault
節點的故障有時候是無意的
比如說在太空的環境下\
輻射滿天飛，這時候你的硬體是有可能出現不如預期的情況的\
這時候你要怎麼修正？

這種狀況通常是依靠特殊能抵抗輻射的硬體或者是準備多台硬體來進行故障恢復

<hr>

有時候，節點會故意發送錯誤的訊息，意圖摧毀你的系統\
這種時候，帶有惡意的故障，被稱為 `Byzantine Fault`

你說有哪些無聊的人要攻擊你的系統？\
以區塊鏈來說，攻擊你的網路，我就可以把別人的錢轉走，這就很有可能了對吧？\
著名的 `51% Attack` 就是典型的 `Byzantine General Problem`

故事大概是這樣子\
不同的將軍想要執行一個作戰計畫\
由於將軍們所在地點並不相同\
訊息的傳遞都是由傳令兵完成的\
如果傳令兵想要叛變，它完全可以發送虛假的消息，欺騙其他人

> 有關 51% Attack 可以參考 [從 0 認識 Blockchain - 區塊鏈基礎 \| Shawn Hsu](../../blockchain/blockchain-basics#51-attack)

# References
+ 資料密集型應用系統設計(ISBN: 978-986-502-835-0)
+ [宇航级CPU是如何做到抗辐射的？中美间有多大差距？ ](https://www.sohu.com/a/195189780_609521)
