---
title: 資料庫 - Cache Strategies 與常見的 Solutions
date: 2022-09-28
categories: [database]
tags: [cache, redis, transaction]
math: true
---

# Cache
Cache 快取是在計算機當中最重要的概念\
作為當今最有效加速的手段之一，其重要程度在作業系統、網頁伺服器以及資料庫當中都可以看到他的身影

Cache 的概念其實很簡單\
也就是 **常用的東西 要能夠越快拿到**

那麼問題來了，哪些是常用的東西？

# Cache vs. Buffer
兩個很相似的概念\
Cache 如同先前所述，是為了要更快的拿到，所以將資料放在 Cache 裡面\
而 Buffer 是為了應對不同裝置速度而做出的機制，當所需的資料還沒準備好供 process 的時候，這時候你可以將資料先寫到 buffer 裡面，當資料 ready 好的時候，就能夠一次拿走\
Buffer 不限於軟體，硬體層也有類似的東西

||Cache|Buffer|
|:--|:--|:--|
|Description|為了能夠快速的回應常存取的資料|儲存資料直到被使用|
|Storage|原始資料的備份|原始資料|

# Memory Hierarchy
![](https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/ComputerMemoryHierarchy.svg/1280px-ComputerMemoryHierarchy.svg.png)
> [Memory hierarchy](https://en.wikipedia.org/wiki/Memory_hierarchy)

|device|description|volatile|
|:--|:--|:--|
|register 暫存器|位於 CPU 內部|:heavy_check_mark:|
|CPU cache|位於 CPU 內部(分為 L1, L2, L3 cache)|:heavy_check_mark:|
|RAM 記憶體|我們常說的 8G, 16G 就是這個|:heavy_check_mark:|
|flash|USB 隨身碟|:x:|
|HDD|傳統硬碟|:x:|
|磁帶|冷儲存用，現已少見於個人 PC|:x:|

> volatile 指的是易揮發，亦即斷電後資料就不見了

> L1 cache 是不共享的，亦即一個 core 一個 L1 cache\
> L4 cache 的設計並不常見

上圖是電腦的 memory hierarchy\
越上層速度越快，空間越小；越下層速度越慢，空間越大

我們所熟知的記憶體，硬碟分別對應到第三跟第五層\
那麼既然要做 cache, 把資料放在 flash 以下顯然就不合適(因為速度慢)\
那麼 register, cpu cache, ram 哪一個適合放資料呢？

register 主要用於 CPU 運算期間的暫存空間之用途，且空間極度狹小，雖然速度最快，但很不適合也沒辦法直接使用\
cpu cache 的空間，以最新發布家用旗艦處理器 [AMD Ryzen 9 7950x](https://www.amd.com/zh-hant/products/cpu/amd-ryzen-9-7950x) 來說，他的 L3 cache 大小為 64MB。大小是可以了，但你還是不能直接用

CPU 的 memory 不能讓程式設計師直接存取是很合理的事情\
試想如果你能夠手動操作，那這將會是個災難(搞亂 cache data 有可能會導致一直 cache miss, 造成效能低下)\
不過不要誤會，即使我們不能直接操作，作業系統也替我們做了許多的 cache 在 cpu cache 了

# Cache Warming
cache 的容量通常不大，因此所儲存的資料是有限的\
這就會遇到一些問題，當我需要的資料不在 cache 裡面的時候，是不是要去 database 撈資料出來放著\
這個情況被稱之為 **cache miss**，反之則為 **cache hit**

> c.f. array 操作這種，也跟 cache hit/miss 有關哦(CPU L1 cache)

cache miss 的情況下，很明顯的會比 cache hit 的 `反應時間還要久`\
所以我們需要 cache warming

為了最大可能，避免 cache miss 的情況發生\
你可以怎麼做？\
手動的將需要的資料放到 cache 裡面，這樣對於 end-user 來說，沒有 cache miss, 載入速度更快，使用者體驗會更好\
問題是 我要怎麼知道要放哪些資料到 cache 裡面？\
**crawler(爬蟲)** 或許是個手段，爬完一次，所有 miss 的資料現在都會在 cache 裡面了\
但是這樣會有一點問題
1. 現今系統都不是 single server 這麼簡單，幾千、幾萬台的 cache server 要更新到哪時候？
2. 為了防止 [DDOS](https://en.wikipedia.org/wiki/Denial-of-service_attack), 太頻繁的發 request 也會被擋

根據現有的手段，我們可以做的更好嗎？\
試想，每一台 cache server 他們的資料是不是一樣的？\
如果是一樣的，那為什麼需要用爬蟲重新爬一次？ 直接從現有的 cache server 複製一份不就好了？\
而這正是 Netflix 的 Cache Warming 的機制

<hr>

![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*FffR7-sUe6alYL6-XvInfg.png)
> ref: [Cache warming: Agility for a stateful service](https://netflixtechblog.com/cache-warming-agility-for-a-stateful-service-2d3b1da82642)

從現有的正在運行的 cache node 完整的複製一份資料出來(i.e. `dumper`)\
透過 `populator` 寫到新的 node 上面\
不就好了嗎？

為了進一步縮減 warm up 的時間，我們不必等待 "全部資料複製出來" 再操作\
可以把它切成一小塊一小塊，中間擺一個 message queue, 資料塞進去\
兩邊同時作業(i.e. [producer consumer problem](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem))，可以更快完成

# Cache Strategies
## Cache Aside(Read Aside)
![](https://www.prisma.io/dataguide/static/ef9dda8c508f666cdb64e3e67b12f27c/d880f/cache-aside.png)
> ref: [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)

這大概是最常見的 cache 策略之一了\
概念很簡單，因為資料庫的讀寫通常很慢，如果每一次都需要 access 資料庫，那麼響應時間會太久\
假如在旁邊放一個 cache 呢？

cache 有資料(i.e. `cache hit`), 就不用 query 資料庫，效率也會變高\
如果找不到資料(i.e. `cache miss`), 查詢資料庫撈資料，順便寫回 cache(讓下次存取不會 cache miss)

Cache Aside 在大多數情況下都是很好的解決辦法\
尤其是在 **read heavy** 的情況，因為常用的資料會在 cache 裡面，而 cache 讀取效率高所以再多的讀取 request 都可以 handle\
倘若 cache 意外下線了，也沒關係，因為資料都可以透過資料庫 restore

![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*dPnVCTxrsXgsJdOtXUN3IA.png)
> ref: [Consistency between Cache and Database, Part 1](https://medium.com/starbugs/consistency-between-cache-and-database-part-1-f64f4a76720)

唯一算是缺點的，兩邊的資料可能會 **不一致**(可參考上圖)\
為什麼？\
我們的好朋友 [Atomic Operation](../../random/python-gil/#atomic-operation) 解釋了一切\
重新審視 cache aside 的實作，你會發現\
當 cache miss 的時候，你會 query 資料庫，然後再寫入 cache\
問題出在這裡，多執行緒的狀況下，你沒辦法保證他是 unit of work\
所以會出現 inconsistency 的狀況

> 可參考 [關於 Python 你該知道的那些事 - GIL(Global Interpreter Lock) \| Shawn Hsu](../../random/python-gil)

## Read Through
![](https://www.prisma.io/dataguide/static/ea53bdb85f36e30cdeee2f4faca908a6/d880f/read-through.png)
> ref: [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)

長的跟 [Cache Aside](#cache-asideread-aside) 很像\
不同的是，Read Through 是將 cache 放在中間\
所有的讀取都跟 cache 讀取，然後 write 全部直接跟 database 溝通

一樣？ 我覺的是一模一樣阿\
這麼說吧, 因為讀取全部都找 cache, 所以在某種程度上，application 是不會知道有 database 的存在的(所以架構上較簡單)

> 可是 cache miss 的時候不是要去 database 找？

對！\
但這步驟是透過 library 或者是第三方的套件完成的\
而 [Cache Aside](##cache-asideread-aside) 是自己 **手動** 寫回 cache 的\
所以這是他們的不同

缺點呢，也一樣會有資料 **不一致** 的問題

## Write Through
![](https://www.prisma.io/dataguide/static/ca5ab292ecc451ab99f380bc101ea126/d880f/write-through.png)
> ref: [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)

解決 **不一致** 最簡單的解法就是\
每一次的更新，都寫進去 cache 裡面，永遠保持 cache 的資料是最新的

Write Through 的概念就是，每一次的更新，都一起更新 cache 跟 database\
這樣就不會 cache miss\
當然這個作法也是有缺點的，同時更新 cache 與 database，會增加延遲

> double write 不會遇到前面 [Cache Aside](#cache-asideread-aside) 的問題嗎？\
> 答案是不會，因為 [Cache Aside](#cache-asideread-aside) 是 reader 更新，而 [Write Through](#write-through) 是 writer 更新

通常使用 [Write Through](#write-through) 會搭配使用 [Read Through](#read-through)\
因為 cache 的資料永遠都是 up-to-date 且與資料庫的資料始終同步\
因此配合 [Read Through](#read-through) 可以解決資料不一致的問題

## Write Back(Write Behind)
![](https://www.prisma.io/dataguide/static/f950c899e6be1b733a8fff259cb4dd82/d880f/write-back.png)
> ref: [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)

[Write Through](#write-through) 每一次都要寫回去，overhead 會太重\
所以，[Write Back](#write-backwrite-behind) 的策略是，**每隔一段時間再寫回去**\
這樣，你可以增加 write performance\
缺點也很明顯，如果你是用 [Redis](#redis) 這種 in-memory cache\
當它掛的時候，會有 data loss

[Write Back](#write-backwrite-behind) 可以搭配 [Read Through](#read-through) 組合\
合併兩者的優勢，組合成 最佳讀寫策略

## Write Around
![](https://www.prisma.io/dataguide/static/476bcd7061339deb7071e25444cb662f/d880f/write-around.png)
> ref: [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)

仔細看可以發現他是 [Cache Aside](#cache-asideread-aside) 與 [Read Through](#read-through) 的結合體\
write 永遠寫入 database, read 永遠讀 cache\
因此，兩者的缺點仍然存在，也就是資料會 **不一致**

<hr>

稍微總結一下\
只要是 reader 更新 cache 就有可能會導致資料不一致的情況\
如果是 writer 更新 cache 就有可能會拖慢執行速度

|Strategy|Pros|Cons|
|:--|:--|:--|
|[Cache Aside](##cache-asideread-aside)|容易實作，增加 read 效率|資料可能不一致|
|[Read Through](#read-through)|架構簡單，可增加 read 效率|資料可能不一致|
|[Write Through](#write-through)|解決資料不一致的問題|速度偏慢|
|[Write Back](#write-backwrite-behind)|可增加 write 效率|資料可能會遺失|
|[Write Around](#write-around)|read 效率可以最佳化|資料可能不一致|

# Redis
REmote DIctionary Server - Redis 是一款 in-memory 的 key-value 系統\
Redis 可以拿來當作 cache、正規的 database 使用、streaming engine 或 message broker\
由於其資料都是 in-memory 的特性，因此操作速度極快

除了上述特性，Redis 也提供 replication 以及 clustering 的功能(不過這些細節就留給以後的我來做吧)

## Redis Data Structures
Redis 提供了一套完整且常見的資料結構，常見的有以下
+ strings
+ lists
+ sets
+ sorted sets
+ hashes

使用方法你可以參考官方的 [documentation](https://redis.io/commands/), 操作直覺容易理解，我就不在這裡贅述了

### Sorted Sets vs. Lists
我想把這個單獨拉出來做一個比較\
因為我看到了一個討論([Why use Sorted Set instead of List Redis](https://stackoverflow.com/questions/48630763/why-use-sorted-set-instead-of-list-redis))說 sorted sets 跟 lists 在某些情況下效能會有差別

> 1. LIST can have duplicates.
> 2. Checking in an element exists is very efficient in ZSET, but very expansive in a LIST (especially if the element is not there).
> 3. Fetching non-edges elements from a LIST can be slow (depends on the size of the LIST and on the distance of the object from one of the edges).
> 4. LIST is most efficient when working with the edges (L/R PUSH/POP).
> 5. ZSET has the added functionality of unions and intersects, and you can sort by any other score/weight.
> 6. In ZSET, the score can be updated later on, and the order will change.

大致上都挺好理解的，唯獨第三以及第四點\
另外我也想要 benchmark 一下 lists 跟 sorted sets 的速度差異\
接下來我就會設計個簡單的實驗來驗證上述內容真偽

<hr>

我會分別對 lists 以及 sorted sets 取值(在頭尾各取不定數量的資料)\
透過時間分析不同 data structure 會如何影響取值效率\
你可以在 [ambersun1234/Redis Benchmark - Lists vs. Sorted Sets](https://github.com/ambersun1234/blog-labs/tree/master/redis-lists-sorted-sets-benchmark) 這裡找到實驗程式碼

首先，先看看一次取 100 筆資料的結果\
![](https://github.com/ambersun1234/blog-labs/blob/master/redis-lists-sorted-sets-benchmark/benchmark-100.png?raw=true)\
從上圖你可以很明顯的看到，lists 在頭尾的部份表現與 sorted sets 差距比中間來的小，換言之就是 lists 在頭尾的操作效率會比中間高

再來是取 1000 筆 以及 10000 資料\
![](https://github.com/ambersun1234/blog-labs/blob/master/redis-lists-sorted-sets-benchmark/benchmark-1000.png?raw=true)\
![](https://github.com/ambersun1234/blog-labs/blob/master/redis-lists-sorted-sets-benchmark/benchmark-10000.png?raw=true)\
不難看出即使一次取一大段的資料，在多數情況下 lists 的效率仍然比 sorted sets 還要來的差(約 $0.5 * 10^6$ nanoseconds)

## Redis Transactions
在讀寫資料的時候，不同執行緒同時對同一個變數讀寫有可能會造成資料不正確\
而在 Redis 裡面也會遇到同樣的事情，有可能同一個 key 被塞了兩次的資料，這當然不會是我們所樂見的

但是 Redis 本身其實並不會有 data race 的問題\
因為 Redis 本身其實是 single thread 的，亦即它不會有所謂的 atomic operation 的考量(因為一次只能做一個 operation)\
參考 [Redis benchmark - Pitfalls and misconceptions](https://redis.io/docs/reference/optimization/benchmarks/#pitfalls-and-misconceptions) 中提到
> Redis is, mostly, a single-threaded server from the POV of commands execution\
> (actually modern versions of Redis use threads for different things).\
> It is not designed to benefit from multiple CPU cores.\
> People are supposed to launch several Redis instances to scale out on several cores if needed.\
> It is not really fair to compare one single Redis instance to a multi-threaded data store.

那為什麼我在上面說它還是會造成資料不正確？\
Redis 不單純只提供 strings 的資料結構，還有 lists, sets 等等的資料結構\
如果不同人先後對 Redis 的 lists 進行寫入操作，同樣的資料，它最終還是會被寫兩次資料進去\
**因為他的 atomic operation 是 command level 的，並不是針對 key**

所以最終你需要的是\
確保我在真正寫入之前，我的 key 不會有任何改動(被其他人改動)\
這需要 transaction

<hr>

Redis 的 transaction 操作其實很簡單
```
> MULTI
OK
> INCR foo
QUEUED
> INCR bar
QUEUED
> EXEC
1) (integer) 1
2) (integer) 1
```
透過 `MULTI` 關鍵字宣告一個 transaction block\
在這個 block 裡面的所有操作都會被 queue 起來直到執行或丟棄\
`EXEC` 會將 block 裡面的 command **逐一執行**(因為他是 single thread)\
`DISCARD` 會將 block 裡面的 command 丟棄

但光是這樣仍然避免不了上述同時寫入的問題\
`WATCH` 關鍵字可以起到 check-and-set 的作用，亦即如果某個 key 改變了，那麼 transaction 就會 failed(亦即所有 transaction block 內的 command 都不會執行)\
而當 transaction 成功執行、失敗或者是 connection 斷線都會把全部的 key 給 `UNWATCH`

如此一來，透過 `MULTI` 以及 `WATCH` 的搭配，就可以避免 data race 了

> 有關 transaction 更詳細的介紹，可以參考 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction)

## Redis Persistence
在上面我們討論到了，Redis 本身是 in-memory 的設計，而 memory 是屬於易揮發的(i.e. 只要斷電資料就會消失)\
對於多數系統，可能沒什麼差別，只是會多個幾秒鐘的等待將資料重新寫入，沒有太嚴重

只不過我們還是會希望，系統的 downtime 能夠越低越好\
而 Redis 也提供了一些備份的機制，盡量降低 downtime 時間

### RDB - Redis Database
RDB 的設計是會自動的對你的資料進行備份(可能是每個小時備份一次)\
他的備份方法是由 parent process [fork](https://linux.die.net/man/2/fork) 出一個 child process\
然後由 child process 進行資料備份(操作 disk io)，而 parent process 就繼續服務 server\
![](https://sumeetjainengineer.files.wordpress.com/2015/09/child_parent1.png)

聽起來沒啥問題，但是它可能會導致部份的 data loss\
由於 [fork](https://linux.die.net/man/2/fork) 並不會真正的拷貝記憶體，直到某個人要改寫記憶體的時候，它才會做複製的動作(也就是 [copy on write](https://zh.wikipedia.org/zh-tw/%E5%AF%AB%E5%85%A5%E6%99%82%E8%A4%87%E8%A3%BD))
![](https://media.geeksforgeeks.org/wp-content/uploads/20200512181458/12127.png)\
又因為 Redis 是 in-memory 的設計，所以當他正在備份的時候，萬一這時候 parent 用了一個 `SET xxx yyy` 更改資料，那麼 child 並不會拉到新的資料(因為 copy on write)\
如果 Redis 的資料東西很多，備份很久，那麼以上的情況很可能會出現很多次，造成 data loss

### AOF - Append Only File
AOF 很直覺，就是紀錄下你所有的操作 command(這樣就可以最完整的重建你的 Redis 資料庫)\
當然啦 當你的檔案太大，它就會寫一個新檔案(用最短的指令重建你的資料，一模一樣的)，與此同時，它還是會繼續紀錄 log 在之前的檔案，當重建完成之後，它就會換到新的上面\
整個 rewrite 的過程一樣由另一條 thread 執行，對主要服務不會有影響

<hr>

預設情況下，Redis 是有啟用 RDB 的，每隔一段時間就會將資料快照寫入 persistence storage\
AOF 需要手動啟用
```
appendonly yes
```

# References
+ [Redis persistence](https://redis.io/docs/manual/persistence/#append-only-file)
+ [Difference between Buffering and Caching in OS](https://www.geeksforgeeks.org/difference-between-buffering-and-caching-in-os/)
+ [Cache Strategies](https://medium.com/@mmoshikoo/cache-strategies-996e91c80303)
+ [Introduction to database caching](https://www.prisma.io/dataguide/managing-databases/introduction-database-caching)
+ [Consistency between Cache and Database, Part 1](https://medium.com/starbugs/consistency-between-cache-and-database-part-1-f64f4a76720)
+ [淺談各種資料庫cache策略: cache aside、read through、write through、write back](https://homuchen.com/posts/databse-chache-strategies/)
+ [What is Cache Warming?](https://www.section.io/blog/what-is-cache-warming/)
+ [Cache warming: Agility for a stateful service](https://netflixtechblog.com/cache-warming-agility-for-a-stateful-service-2d3b1da82642)
+ [Cache Warming: Know it’s Importance to Improve Website Performance](https://www.payoda.com/cache-warming/)
+ [Cache warming: Agility for a stateful service](https://netflixtechblog.com/cache-warming-agility-for-a-stateful-service-2d3b1da82642)
