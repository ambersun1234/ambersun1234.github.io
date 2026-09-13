---
title: 資料庫 - 可以跳頁的分頁機制？ Deferred Join 是你需要的
date: 2026-09-13
categories: [database]
description: 想要跳頁功能卻又受不了傳統 OFFSET 的效能瓶頸？本文帶你從底層執行計畫與實驗數據，全面剖析 Deferred Join 的優缺點與選型指南
tags: [cursor based pagination, offset based, page offset, pagination, offset, limit, deferred join, primary index, secondary index, index, taskset, cpupower, dataset, composite index, mariadb, filesort, cache]
math: true
---

# Deferred Join
儘管 [Cursor Based Pagination](../../database/database-cursor-pagination#cursor-based-pagination) 可以帶來很好的效能表現\
但是也有一些事情是它做不到的\
好比如說它沒辦法跳轉到指定的頁面\
它只可以根據當前的 cursor 往前或往後

有些產品功能，如果在設計上仍然需要 **跳頁** 功能，但又不想 [Page Number + Page Offset](../../database/database-cursor-pagination#page-number--page-offset) 這種效能奇差的實作方法\
其實還可以利用 [Deferred Join](#deferred-join)

思想上其實就是 [Page Number + Page Offset](../../database/database-cursor-pagination#page-number--page-offset) 跟 [Cursor Based Pagination](../../database/database-cursor-pagination#cursor-based-pagination) 的結合體

## How to Speed Up
傳統上的 `OFFSET` 搭配 `LIMIT` 會慢的原因有
+ 他需要一個一個慢慢數，走完全部 `OFFSET`
+ 邊遍歷的過程中，會載入所有你 query 的資料，這些搬資料的過程造成的浪費

所以 [Deferred Join](#deferred-join) 主要在解決後者的問題\
資料遍歷這件事情是不能省的(因為你想要保留 **跳頁機制**)\
解決的方式其實也很簡單，我在算 `OFFSET` 的時候，我只載入必要資料(如 id) 並且搭配 index

然後其實我也很好奇，primary index 跟 secondary index 用起來有沒有差異

> 可參考 [資料庫 - Index 與 Histogram 篇 \| Shawn Hsu](../../database/database-index-histogram)

根據我學的\
primary index 是建立在主表上的(i.e. 資料也同時在旁邊)\
secondary index 因為是另一張獨立的 index 表，上面並沒有資料\
所以我猜單純用 secondary index 可能會比較快？\
不過在這用猜測的其實不準，還是透過實驗吧

# Benchmark Testing

## Prerequiste
```shell
$ uname -a
Linux station 6.8.0-138-generic #138~22.04.1-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 7 13:43:15 UTC x86_64 x86_64 x86_64 GNU/Linux
$ docker -v
Docker version 29.8.0, build 88096ef
$ docker-compose -v
Docker Compose version v2.14.0
$ mariadb -v
11.0.2-MariaDB-1:11.0.2+maria~ubu2204
```

為了讓測試資料變得更穩定，我們可以利用 [taskset](https://man7.org/linux/man-pages/man1/taskset.1.html) 固定 process 在特定的 CPU core 之上\
也還可以額外調整 CPU 效能模式，進而降低測試數據晃動問題

```shell
$ sudo cpupower frequency-set -g performance
# 然後記得要把它調整回去
$ sudo cpupower frequency-set -g powersave
```

## Dataset Preparation
我一開始嘗試使用 `1w`, `2w` 筆資料\
但後來發現測試出來效果不太好，差距並不明顯

所以我想說，調整 dataset 的大小，並同步調整分頁測試的 offset 以及開始頁等等\
設定 `300w` 筆資料，從第 1 頁開始進行測試間隔頁數設定為 10 直到第 301 頁\
每頁都取 10000 筆資料

## SQL
要測試 [Deferred Join](#deferred-join) 著實是花了我不少的時間\
因為 SQL 本身其實不好寫

你要下去看執行計劃確保 DB 真的照你想像中的方式下去執行\
一開始寫錯是因為語法問題，導致他沒有正確吃到 index\
再來我發現到，四種 SQL 撈出來的資料並不一致\
既然資料不同，那肯定就沒有比較基礎\
最後發現，他實際上用的 index 並不是我要他用的(就是我希望他用 secondary index 結果他用到 primary index 之類的)

但總之，經過我的一番努力，資料正確了，使用的 index 也正確的

||[Cursor Based Pagination](../../database/database-cursor-pagination#cursor-based-pagination)|[Deferred Join](#deferred-join) Primary Index|[Deferred Join](#deferred-join) Secondary Index|
|:--|:--:|:--:|:--:|
|Data|![](/assets/img/posts/deferred-join3.png)|![](/assets/img/posts/deferred-join1.png)|![](/assets/img/posts/deferred-join2.png)|
|Execution Plan|[Explain](#explain-cursor-based-pagination)|[Explain](#explain-deferred-join-primary-index)|[Explain](#explain-deferred-join-secondary-index)|

### Explain Cursor Based Pagination
```json
[
    {"id":"1","select_type":"SIMPLE","table":"User","type":"index","possible_keys":null,"key":"ci_username_id_key","key_len":"770","ref":null,"rows":"1000","Extra":"Using where"}
]
```

從這裡你可以看到說，`type: index` 而且 `key: ci_username_id_key`\
代表說這次的執行計劃有使用到 index, 使用的 index 名字是 `ci_username_id_key`(i.e. *composite index*)

符合 schema 定義

```js
model User {
    id         Int      @id @default(autoincrement())
    username   String   @unique(map: "si_username_key")
    created_at DateTime @default(now())

    @@index([username, id], map: "ci_username_id_key")
}
```

### Explain Deferred Join Primary Index
```json
[
    {"id":"1","select_type":"PRIMARY","table":"<derived2>","type":"ALL","possible_keys":null,"key":null,"key_len":null,"ref":null,"rows":"11000","Extra":"Using temporary; Using filesort"},
    {"id":"1","select_type":"PRIMARY","table":"u","type":"eq_ref","possible_keys":"PRIMARY","key":"PRIMARY","key_len":"4","ref":"temp.id","rows":"1","Extra":""},
    {"id":"2","select_type":"DERIVED","table":"User","type":"index","possible_keys":null,"key":"ci_username_id_key","key_len":"770","ref":null,"rows":"199875","Extra":"Using index"}
]
```

> 這邊執行計劃有三個步驟，怎麼看？\
> MariaDB 是先看 `select_type`: `DERIVED` 優先，然後是看 `id`, 大到小
> 同 `id` 就是依照順序(上到下)

第一步他一樣先用 composite index 選定範圍\
第二步他仍然需要執行 filesort(原因在於 sub query 的結果傳出去的時候順序不保證)\
到最後一步才是用 `PRIMARY key`

### Explain Deferred Join Secondary Index
```json
[
    {"id":"1","select_type":"PRIMARY","table":"<derived2>","type":"ALL","possible_keys":null,"key":null,"key_len":null,"ref":null,"rows":"11000","Extra":"Using temporary; Using filesort"},
    {"id":"1","select_type":"PRIMARY","table":"u","type":"eq_ref","possible_keys":"si_username_key","key":"si_username_key","key_len":"766","ref":"temp.username","rows":"1","Extra":"Using index condition"},
    {"id":"2","select_type":"DERIVED","table":"User","type":"index","possible_keys":null,"key":"ci_username_id_key","key_len":"770","ref":null,"rows":"199875","Extra":"Using index"}
]
```

你會發現到說，為什麼這個長得跟 [Explain Deferred Join Primary Index](#explain-deferred-join-primary-index) 如此相似\
差異只有在最後一步，他使用的是 `si_username_key` 而不是 `PRIMARY`

## Test Results
![](https://github.com/ambersun1234/blog-labs/blob/master/cursor-based-pagination/benchmark/deferred-join/benchmark-deferred-join.png?raw=true)

所以其實你可以看到\
[Deferred Join](#deferred-join) 在使用不同 index 效能上竟沒有多少差異\
而 `Offset Based` 與 `Cursor Based` 的差異，在 [資料庫 - 更好的分頁機制 Cursor Based Pagination \| Shawn Hsu](../../database/database-cursor-pagination) 我們已經看過了

[Deferred Join](#deferred-join) 可以看到表現算不差\
但你還是能夠看出來 Offset 對他的影響，所以圖形上的表現也是斜線\
跟 `Cursor Based` 單純的直線比，仍然是有差距的

那為什麼兩種 [Deferred Join](#deferred-join) 效能沒啥差異？\
實驗的確不嚴謹，因為真正會造成效能瓶頸的地方是在計算 Offset 的地方\
而這部分是 sub query 負責的，你在外面使用不同 index 去 join 差異不大

> 詳細的實驗細節，可以在 [ambersun1234/blog-labs/cursor-based-pagination](https://github.com/ambersun1234/blog-labs/tree/master/cursor-based-pagination) 找到

# Sub query Benchmark Testing
那其實這部分滿難測試的\
因為我想要控制他撈出來的資料相等，才可以開始比較\
但問題這有點難寫也不好測試

舉例來說，cache 的問題\
如果不同測試連在一起跑，後面跑的那個效率就會高很多，因為上一個測試已經把 cache warm 好了\
所以每一次開始執行的時候你要清空 cache，那比較簡單的方式是重啟 db 就可以

再來是 SQL, 等價的部分還好寫，你會需要使用 explain 去查看執行計劃\
確保它有正確使用到 index 而且還必須是正確的 index

||Benchmark|
|:--|:--:|
|Sort ASC|![](https://github.com/ambersun1234/blog-labs/blob/master/cursor-based-pagination/benchmark/deferred-join-subquery/benchmark-deferred-join-withsort-subquery.png?raw=true)|
|Sort DESC|![](https://github.com/ambersun1234/blog-labs/blob/master/cursor-based-pagination/benchmark/deferred-join-subquery/benchmark-deferred-join-withsort-desc-subquery.png?raw=true)|
|No Sort|![](https://github.com/ambersun1234/blog-labs/blob/master/cursor-based-pagination/benchmark/deferred-join-subquery/benchmark-deferred-join-withoutsort-subquery.png?raw=true)|

但總之，測出來是沒看出來什麼差異的\
實際上我跑了很多次測試，每次都沒看出什麼太多的差別\
資料庫內部的優化等等可能一時沒辦法剔除的非常完整，所以才測不出來

> 詳細的實驗細節，可以在 [ambersun1234/blog-labs/cursor-based-pagination](https://github.com/ambersun1234/blog-labs/tree/master/cursor-based-pagination) 找到

# Which Pagination Method Should You Choose

||[Page Number + Page Offset](../../database/database-cursor-pagination#page-number--page-offset)|[Cursor Based Pagination](../../database/database-cursor-pagination#cursor-based-pagination)|[Deferred Join](#deferred-join)|
|:--|--:|--:|--:|
|核心邏輯|透過計算偏移量找到正確起點|直接定位起點|分段式查詢<br>第一階段用 page 計算起點，再來查詢資料|
|跳轉任意頁|:heavy_check_mark:|:x:|:heavy_check_mark:|
|深層分頁效能|差|好|偏差|
|漏資料風險|存在|不存在|存在|
|適用場景|資料量小|高併發，數據量大<br>需要無限滾動|需要跳頁功能<br>但仍希望優於 [Page Number + Page Offset](../../database/database-cursor-pagination#page-number--page-offset) 的過度方法|

# References
+ [使用延迟关联实现高效分页](https://learnku.com/articles/75282)
