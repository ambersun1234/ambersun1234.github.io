---
title: 淺談 Polling, Long Polling 以及其他即時通訊方法論
date: 2024-01-18
description: 即時通訊是一個很有趣的議題，本文將會介紹 Polling, Long Polling 以及 WebSocket 的各個特性，並且會分析他們的優缺點
categories: [random]
tags: [polling, long polling, webhook, webrtc, websocket, tcp, file descriptor, socket]
math: true
---

# Preface
![](https://www.helpshift.com/wp-content/uploads/2022/04/Screen20Shot202017-07-1420at2011.26.2420AM.png)
> [A Little Bit of Background on Our New Typing Indicator](https://www.helpshift.com/a-little-bit-of-background-on-our-new-typing-awareness-indicator/)

# Polling
polling 輪詢是最為簡單的一種作法\
其核心概念為定時的發出 request 確認

![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*YiWBVCm1Ge7LklMsOcZi2g.png)
> ref: [HTTP Short vs Long Polling vs WebSockets vs SSE](https://medium.com/techieahead/http-short-vs-long-polling-vs-websockets-vs-sse-8d9e962b2ba8)

舉例來說每隔 1 分鐘，client 送 request 到 server 詢問目前的狀態\
polling 的實作非常的簡單，從上圖你應該可以想像的出來他是怎麼工作的

> 其實你現在在使用的電腦鍵盤，也是使用 polling 的機制的\
> 早期 PS/2 的鍵盤則是使用 interrupt 的方式(中斷) 觸發訊號給 OS\
> 可以參考 [What Is Keyboard Polling Rate and How Much Does It Matter?](https://www.makeuseof.com/what-is-keyboard-polling-rate-and-how-much-does-it-matter/)

# WebSocket
> to be continued

# Long Polling
![](https://miro.medium.com/v2/resize:fit:828/format:webp/1*JyLiDASqEXBs3ZjvldUrEQ.png)
> ref: [HTTP Short vs Long Polling vs WebSockets vs SSE](https://medium.com/techieahead/http-short-vs-long-polling-vs-websockets-vs-sse-8d9e962b2ba8)

Long Polling 跟 [Polling](#polling) 很像\
但不太一樣\
同樣都是每隔一段時間發 request 到 server\
但是差別在於 server 這邊可以選擇要不要馬上回復\
而判斷的標準是 `狀態有沒有改變`\
舉一個例子可能比較好理解

以我們在使用的社群媒體如 [Facebook](https://facebook.com), [Line](https://line.me/tw/) 等等的\
通知這個東西，是可以使用 [Long Polling](#long-polling) 實作的\
是不是每當有人按讚你的貼文，回覆你的留言的時候\
你就會收到一個通知

假設 Long Polling 的 timeout 設定成 1 分鐘\
那麼用人類的話來說，Long Polling 可以簡化成這句話\
`請告訴我，在接下來的 1 分鐘內，有沒有新的通知`\
因此，會有兩個狀況
1. 如果 1 分鐘內有新的通知，就馬上告訴 client
2. 如果超過 1 分鐘，沒有任何新的通知，則告訴 client 沒有新的通知

發現了嗎？\
server 會在給定的時間內 **hold 住** connection\
直到新的狀態出現\
寫成 code 大概會長這樣
```js
// client
notifications = get('/notifications/me')

// server
while (timeout !== 0) {
    // wait for 1 second
    haveNewNotifications = db.getUserNotificationsCount()
    if (haveNewNotifications) {
        return db.getUserNotifications()
    }
}
```

> Long Polling 的實作不需要管 client 多久 call 一次\
> timeout 是設定 server 要 hold 住 connection 多長的時間

# Long Polling vs Polling
考慮以下例子

假設我用 [Polling](#polling), client 每隔 5 秒詢問一次\
跟使用 [Long Polling](#long-polling), client 每隔 1 秒問一次，然後 server timeout 為 5 秒\
這兩種方法是不是結果都一樣？

這樣是不是看起來改用 Long Polling 並沒有任何好處\
當然不是

這一切取決於 client 要如何呼叫 server\
如果 client 仍然每隔 1 秒就問一次 server, 那麼確實使用 [Long Polling](#long-polling) 並不會帶來任何好處\
因為你呼叫的次數還是那麼多，它並不會減少

<hr>

[Polling](#polling) 我們知道，它會 **一直** 詢問 server\
而這個一直的過程，是不斷的 TCP 建立/中斷 連線\
正因為這個建立刪除的過程，使得使用 polling 的方法，他的 overhead 會比較高\
因為 TCP 建立連線會需要進行 `Three-way handshake`(三方交握)

> 使用 [Long Polling](#long-polling) 一樣會有握手的情況發生\
> 但這個次數相對 Polling 來說是減少的

<hr>

雖然以結果來說\
兩者方法能達到的結果都是相同的\
只不過如果你把 client [Polling](#polling) 的時間調得很長\
**那就不即時了吧?**

timeout 設定成一分鐘的情況下\
有可能在這一分鐘內就有新的資料，不過因為 client 還在 timeout 的時間內，client 端對新資料是一無所知的\
只有當下一次 request 的時候才會包含 "幾秒鐘前的新資料"

> [Long Polling](#long-polling) 跟 [Websocket](#websocket) 這種真正即時的還是有差\
> 不過還是比 Polling 更好

# Websocket Overhead
[WebSocket](#websocket) 一旦連線建立，就會一直維持住\
在這一方面可謂完美的解決了 [Polling](#polling) 以及 [Long Polling](#long-polling) 建立連線的巨大成本帶來的 overhead\
看似完美的解決方案，但是它會遇到另一個問題，file descriptor 數量限制

<hr>

> In UNIX, Everything is a File

事情還得要從作業系統說起\
UNIX 的設計哲學是，Everything is a File\
每個東西都是檔案，什麼意思？\
檔案不就是檔案嗎？ 那麼網路，印表機這些也算檔案嗎？\
依照作業系統的邏輯，如果要詳細區分這些東西為各種不同的類別，那麼實作起來將會無比困難\
因此，就算是印表機這種東西，底層實作也會將它視為是 **檔案**

建立網路連線，它分成大約兩步驟
1. 建立 socket(i.e. file descriptor)，建立好一個對接的端口
2. 建立連線(並且透過 socket 進行資料的傳輸)

而 socket 就是那個 **檔案**\
每個應用程式都擁有自己的 socket 接口\
你可以使用 [lsof](https://linux.die.net/man/8/lsof) 這個指令查看當前 internet file descriptor 的狀況\
執行 `$ sudo lsof -i` 你會看到類似這張圖的輸出
![](/assets/img/posts/lsof.png)
可以很清楚的看到，chrome 瀏覽器開了許多的 socket

> 你應該還會看到其他應用程式，像我的還有 telegram, docker ... etc.

<hr>

socket 有沒有數量限制呢？ 或者說比較 general 一點\
file descriptor 有沒有上限？\
我想答案很明顯是有的

```shell
$ ulimit -n
1024
```

> 可參考 [man ulimit](https://linuxcommand.org/lc3_man_pages/ulimith.html)

我的電腦，預設 file descriptor 上限數量為 `1024`\
也就是說一個 process 的 file descriptor 上限就那麼多\
回到我們原本的主題，[WebSocket](#websocket) 會維持住 internet connection 對吧\
是不是代表，你的伺服器在一定時間下，預設 WebSocket 連線數量就只能這麼多\
想當然你沒有辦法一直無限開大機器對吧\
也因此我們需要一個折衷的辦法，Long Polling 就誕生了

# References
+ [Why are TCP/IP sockets considered "open files"?](https://unix.stackexchange.com/questions/157351/why-are-tcp-ip-sockets-considered-open-files)
+ [Is socket creation-deletion very expensive process?](https://stackoverflow.com/questions/14051984/is-socket-creation-deletion-very-expensive-process)
+ [HTTP Short vs Long Polling vs WebSockets vs SSE](https://medium.com/techieahead/http-short-vs-long-polling-vs-websockets-vs-sse-8d9e962b2ba8)
+ [Socket and file descriptors](https://stackoverflow.com/questions/13378035/socket-and-file-descriptors)
