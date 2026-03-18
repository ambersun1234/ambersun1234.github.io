---
title: 系統的最後一道防線 Rate Limit 機制
date: 2026-03-18
description: Cache 掛掉怎麼辦？ 資料庫掛掉怎麼辦？ 直接讓流量衝進去系統內部明顯不是個好選擇，本文將會介紹 5 種 Rate Limit 的演算法以及其 Trade offs。透過了解其概念並應用於實務中，你的系統可靠性將會大幅提昇
categories: [random]
tags: [rate limit, token bucket, leaking bucket, fixed window, sliding window log, sliding window counter, http 429, too many requests, cache, database, burst traffic]
math: true
---

# The Guardian of the System
在之前的文章當中，我們討論了許多系統設計上優化的方法，包括在資料庫層級使用 `Sharding` 以及 `Replica` 技術使得系統能夠承受更大的負載，如何藉由 `Cache` 來提昇系統的效能\
這些無疑都能夠讓系統擁有更高程度的高可用性\
但它其實也都架不住惡意的攻擊(有時甚至不是惡意的，單純是流量過大)

系統的韌性是非常重要的\
有 `Replica` 就可以完全不考慮整體掛掉的問題嗎？\
有 `Cache` 就能夠確保突然的高流量會竄進去系統內部嗎？\
其實答案是否定的

如果 `Cache` 失效，比如說由於硬體問題導致，所有的流量全部會灌到資料庫上\
能讓流量跑進去嗎？ 當然不行阿\
又比如說，有人在亂試密碼，讓它慢慢試嗎？ 也不是個好選擇

# Introduction to Rate Limit
所以通常會設計一種機制，來限制流量\
某種程度上來說他是最後一道防線，端看你怎麼使用就是

比方說對於嘗試登入這種，如果你發現一個人一秒內嘗試超過 10 次，就阻擋它\
此時的目的是為了避免系統內部資源被濫用，同時也是一種防禦的機制，避免被暴力破解\
但有時候 Rate Limit 負擔的責任更大\
例如，你的 `Cache` 失效，所有的流量大量進入資料庫系統中，此時 Rate Limit 阻擋大部分的流量，僅讓少部份流量進到系統內部，維持一定的基本運作(i.e. 可能是讓 Admin 進去管理系統之類的)

# Rate Limit Algorithms

||[Token Bucket](#token-bucket)|[Leaking Bucket](#leaking-bucket)|[Fixed Window](#fixed-window)|[Sliding Window Log](#sliding-window-log)|[Sliding Window Counter](#sliding-window-counter)|
|:---|:---:|:---:|:---:|:---:|:---:|
|Description|控制 **進入系統** 的速度|控制請求 **被處理** 的速度|計算區間內請求數量|較好的計算區間內請求數量|**估算** 區間內請求數量|
|Burst Traffic Handling|:heavy_check_mark:|:x:|:heavy_check_mark:(Unexpected)|:heavy_check_mark:|:heavy_check_mark:|
|Memory Usage|Low|Low|Low|High|Low|
|Precision|N/A|N/A|N/A|High|Medium|
|Condition|瞬時流量|瞬時流量|區間流量|區間流量|區間流量|

## Token Bucket
要限制流量，基本上直覺的想法會是一段時間內允許定量請求

![](https://media.geeksforgeeks.org/wp-content/uploads/20240725172832/Tocken-Bucket-Algorithm.png)
> ref: [Rate Limiting Algorithms - System Design](https://www.geeksforgeeks.org/system-design/rate-limiting-algorithms-system-design/)

`Token Bucket` 的概念是\
有一個桶子(Bucket)，裡面裝的東西是 Token，這些 Token 會勻速的填入桶中\
每當請求到來的時候，就從桶子裡面拿一個 Token 出來，並放行操作\
也就是說，當桶子裡面的 Token 不足的時候，就會阻擋請求

> 你也可以客製不同的請求所消耗的 Token 數量\
> 比如說 GET 消耗 1 個 Token, POST 消耗 2 個 Token ... etc.

因為 Token 是 **勻速** 被填入桶中的，你可以理解為它代表了單位時間內可以處理的最大請求數量\
你去看桶子的內容的時候，就是系統當下能夠處理的請求數量\
你填入 Token 的速度決定了系統平均處理請求的速度

## Leaking Bucket
[Token Bucket](#token-bucket) 可以一下子處理很多的請求數量，只要桶內的 Token 足夠多\
一次消耗完是沒問題的

![](https://media.geeksforgeeks.org/wp-content/uploads/20240725172914/Leaky-Bucket-Algorithm.png)
> ref: [Rate Limiting Algorithms - System Design](https://www.geeksforgeeks.org/system-design/rate-limiting-algorithms-system-design/)

`Leaking Bucket` 則是 **控制請求被處理的速度**\
你一樣有個桶子，但它裝的是請求本身，當然，當桶子滿的時候多餘的依然會被丟掉\
只是在從桶子拿出請求的時候是以 **固定速度拿取**\
也就是它並不能很好的處理突發流量

通常，當你希望系統以一個較為穩定的速度處理請求，會使用 `Leaking Bucket`

## Fixed Window
又或者你可以根據時間來限制請求數量\
比方說一分鐘內允許 100 次請求之類的

![](https://media.geeksforgeeks.org/wp-content/uploads/20260218162813693411/a.webp)
> ref: [Rate Limiting Algorithms - System Design](https://www.geeksforgeeks.org/system-design/rate-limiting-algorithms-system-design/)

但他有可能在 00:59 送了全部的 100 次請求，而前 58 秒都沒有任何請求\
雖然它符合你的定義，不過你期待的應該是這 100 次請求平均分散在這一分鐘內\
很明顯的 `Fixed Window` 並不符合你的需求

## Sliding Window Log
那把 [Fixed Window](#fixed-window) 加上 sliding window 其實就可以解決這件事\
你計算的是，當前請求往前 1 分鐘內的數量不得超過 100 次

![](https://media.geeksforgeeks.org/wp-content/uploads/20240725173030/Sliding-Window-Algorithm.png)
> ref: [Rate Limiting Algorithms - System Design](https://www.geeksforgeeks.org/system-design/rate-limiting-algorithms-system-design/)

你需要把之前的請求時間戳記錄下來，寫到日誌當中\
以我們的例子，1 分鐘以前的紀錄會被刪掉因為它不再重要，只保留當前的請求紀錄\
但相對它會耗費一些時間以及空間

如果你的服務流量很大，1 分鐘可能就幾萬筆資料要讀寫\
造成的 overhead 更難以接受

## Sliding Window Counter
`Sliding Window Counter` 則是結合了 [Fixed Window](#fixed-window) 以及 [Sliding Window Log](#sliding-window-log) 的概念\
一樣是看一個 window 內的請求總量，假設是一分鐘的區間\
不同的是，你的計算時間可能橫跨兩個 window 的時間\
所以你要做的就是分別計算其百分比，算出這中間的平均

相比於 [Sliding Window Log](#sliding-window-log)，它不需要額外儲存紀錄\
基本上你只需要兩個時間區間的全部請求數量\
`T` 總共有 10 個請求，`T + 1` 總共有 23 個請求\
假設現在這個當下是 30% 的 `T` 以及 70% 的 `T + 1`\
那麼這個當下的請求數量就是 `10 * 0.3 + 23 * 0.7 = 19.1`

對，他是一個估算，但在大多數情況下這樣的誤差是可以接受的

# Rate Limit Client side Handling
在後端擋掉過量的流量基本上就依靠上述提到的演算法下去做就行\
對於客戶端來說，雖然我們無法阻止它一直發送請求，不過可以禮貌的跟它講

通常，我們會用 [HTTP 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) 來告訴客戶端，它超過了 Rate Limit\
與其配套的還有一些特殊的 header 用以明確告知客戶端相關行為
+ `X-RateLimit-Limit`: 該請求資源在單位時間內的 **最大請求數量**
+ `X-RateLimit-Remaining`: 該請求資源在單位時間內 **還可以發送的** 請求數量
+ `X-RateLimit-Retry-After`: 你還要再等多久才能再次發送請求

# How to Set the Limit
實務上，根據不同的需求有不同的條件\
比方說，像是 [LeetCode](https://leetcode.com/) 如果你太頻繁的 submit code, 它會跟你說你需要升級成 premium 會員才能如此頻繁的提交

![](/assets/img/posts/leetcode-rate-limit.png)

這種就是，針對不同會員等級設定的 Rate Limit\
常見的還有，忘記密碼所寄送的簡訊需要隔 30 秒才能再重新發送一次，這也是一種 Rate Limit\
又或者是你希望根據當前伺服器的負載 **動態的** 調整 Rate Limit 通過的請求數量

等等以上都是很常見並且生活化的例子\
要怎麼設定這些參數其實很大程度取決於你的需求\
而某些則是要透過精密的實驗才能得出這個數值，沒辦法一概而論

# References
+ 內行人才知道的系統設計面試指南(ISBN: 978-986-502-885-5)
