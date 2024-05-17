---
title: 重新認識網路 - 從基礎開始
date: 2024-05-07
description: 本篇文章將會涵蓋所有網際網路的基礎，包含 DNS, TCP, UDP, TLS。其中會使用 Tcpdump, Wireshark 等工具實際觀察
categories: [network]
tags: [tcp, udp, ssl, tls, dns, nc, tcpdump, wireshark, broadcast, load balance, ip, telnet, multicast, unicast]
redirect_from:
    - /network/networking-basics/
math: true
---

# DNS - Domain Name System
Domain Name System 是一個分散式的系統，用於紀錄網域名稱和 IP 位址之間的關聯\
基本上現今我們在瀏覽網站的時候，多半是使用所謂的 domain name 上網的\
比方說 `google.com`, `facebook.com`

對於人類來說，這是比較容易理解的\
IP address 則是方便於電腦進行解析的，但卻是不容易理解\
因此 DNS 的作用就是將 IP address 轉換成網域名稱

本質上 DNS 分散式架構有助於提昇整體吞吐量\
包含單一節點失效，效能問題(可參考 [資料庫 - 最佳化 Read/Write 設計(硬體層面) \| Shawn Hsu](../../database/database-optimization-hardware))

## DNS Server Categories
![](https://qph.cf2.quoracdn.net/main-qimg-5ed6b5866ff2e2d1d26095a49aa4c25e)
> ref: [What is a DNS root server and what do they do?](https://www.quora.com/What-is-a-DNS-root-server-and-what-do-they-do)

基本上分為三種類型

+ Root DNS Server
    + 這些伺服器是整體網路的最高階，共有 13 個組織負責管理
    + Root server 不會直接回 ip address, 它會告訴你誰擁有這些資訊，然後你去找 `TLD DNS Server`
+ Top-level Domain DNS Server
    + 高階網域如 `com`, `org`, `edu` 等都會紀錄在 Top-level Domain DNS Server 中
    + 同樣它也不會直接回 ip address, 它會告訴你誰有這些資訊，然後你再去找 `Authoritative DNS Server`
+ Authoritative DNS Server
    + 到這層就會真的給你 ip address 了

所以每次你的查詢都是從高階到低階\
這樣很慢嘛，所以也會有 caching 的機制在裡面

## DNS Load Balancing
現今的服務器通常都是分散式系統，這就意謂著一個 domain name 可能會對到很多台實體伺服器\
那麼當你存取的時候，是哪一台伺服器需要回應你呢

DNS 通常會回應一連串的 IP address\
client 通常會取第一個 ip 使用\
每次 DNS 回應的時候，server 會輪流改變 ip address 的順序\
所以同一台伺服器就不會太操勞

這樣就可以做到基本的 load balancing

## nslookup
這個指令可以查詢網域名稱對應的 IP address\
舉例來說

```shell
$ nslookup google.com
Server:         127.0.0.53
Address:        127.0.0.53#53

Non-authoritative answer:
Name:   google.com
Address: 172.217.163.46
Name:   google.com
Address: 2404:6800:4012:4::200e

```

不熟悉 command line 操作也可以使用類似 [NsLookup.io](https://www.nslookup.io/) 等網站來查詢

# Socket
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

# IP - Internet Protocol
提供 `主機` 之間的通訊，但不提供任何保障

+ 不保證送達目的地
+ 不保證會依序送達

# Process Communication - A High Level View
兩個不同的 process 要透過 network 的方式進行溝通\
離不開兩個觀念，送資料([Transport-layer Multiplexing](#transport-layer-multiplexing))與收資料([Demultiplexing](#demultiplexing))

## Transport-layer Multiplexing
將資料與 header 封裝在一起透過 [Socket](#socket) 往下丟給網路層\
而 header 包含了一些下層需要知道的事情\
比方說你要送到哪裡，要給誰\
舉例來說 sender/receiver 的 ip 跟 port

換言之，如果 ip port 都一樣，那代表這兩個連線是一樣的

> port 1024 以後都可以隨意用，1 ~ 1023 不能使用

> 為什麼要有 sender 的資料？ 因為要知道資料要送回哪裡

## Demultiplexing
將網路層上來的資料分送到正確的 [Socket](#socket) 端口\
然後在根據 header 裡面的內容，送到正確的地方

# TCP - Transmission Control Protocol
TCP 是建立在 [IP](#ip---internet-protocol) 之上的協議\
IP 是專注在 **主機** 之間的通訊，而 TCP 則是專注在 **行程(process)** 之間的通訊

> 可參考 [RFC 793](https://datatracker.ietf.org/doc/html/rfc793)

TCP 相比 [IP](#ip---internet-protocol) 額外提供了
+ 可靠性傳輸(保證送達以及保證順序送達)
+ 壅塞控制(congestion control)

> 有關傳輸層的討論可以參考 [重新認識網路 - OSI 七層模型 \| Shawn Hsu](../../network/networking-osi)

## Why Handshake is Important
TCP 是可靠傳輸，所以它需要花一點時間建立可靠連線\
為什麼要花時間建立連線？

試想線上會議的情況下，當你加入會議，你可能會先確保你的麥克風、喇叭是不是正常的\
確定對方聽的到你的聲音，然後你也聽的到對方的，才會開始開會對吧\
這就是一個確保連線成功的機制

結束會議也一樣\
跟對方說你要下線了，對方也會跟你說要下線了\
雙方都要認知道對方要下線，並且同意\
才可以關閉連線

> TCP 在 [RFC 793](https://datatracker.ietf.org/doc/html/rfc793) 並沒有定義需要做 結束會議的握手\
> 但是 [RFC 6824](https://datatracker.ietf.org/doc/rfc6824/) 裡面有定義而且 tcpdump 的結果有時候有出現\
> 就在這裡提一下

你可能會覺的什麼都要 double check 是一件很麻煩的事情\
但沒有進行這個確保的情況下，你可能會漏掉對方的資訊\
而這樣就不是可靠性傳輸了

對應到網路世界，這個過程稱之為握手\
TCP 在以下情況會做握手
1. 建立連線 - [Three-way Handshake](#three-way-handshake)
2. 結束連線 - [Four-way Handshake](#four-way-handshake)

<hr>

需要注意的是\
TCP server 會需要 **2 個 socket** 來處理連線\
為什麼呢

我們說過，一個 connection 背後代表著一個 unique 的 [Socket](#socket)\
TCP 是可靠性傳輸協定，每一個獨立的連線傳輸都有一個 socket\
也就是說會有若干個 socket

如果說每一個連線的 socket 都不一樣\
那麼你需要一個統一的連接進入點來處理不同的 connection\
這也就是為什麼 TCP server 會需要 2 個 socket 來處理連線

一個是主要進入點的 socket\
另一個則是每個 client 獨立的 socket\
所以是兩個

## Three-way Handshake
![](https://www.techopedia.com/wp-content/uploads/2023/03/ad900dc1-ad94-4c7b-a3f8-154ad27c35f1.png)
> ref: [Three-Way Handshake](https://www.techopedia.com/definition/10339/three-way-handshake)

所以基本上 TCP 三方交握就是一個初始化 say hello 的流程\
確認你已經準備好要收訊息了 我也準備好要發訊息了這樣

![](/assets/img/posts/tcpdump1.png)

> 前情提要 tcpdump flag
> 
> |flag|shortened|description|
> |S|syn|synchronize 同步|
> |.|ack|acknowledge 確認|
> |F|fin|結束連線|
> |P|push|傳送資料|

用 [Tcpdump](https://www.tcpdump.org/) 這個工具來稍微理解一下吧，不然光用講的我也聽不懂

執行以下指令開始監聽 `$ sudo tcpdump -i lo port 4000`\
我這次測試的目標，是在本機上的 4000 port\
因為是在本機上，所以是 `lo`(loopback) interface(可以用 `$ ifconfig` 查網卡名稱)\
tcpdump 會監聽目標 port 上所有的流量，所以你就可以用他來觀察連線的狀態

第一個藍色框框表示 TCP 三方交握\
很明顯符合 `SYN`(S), `SYN + ACK`(S.) 以及 `ACK`(.) 這三種狀態\
細心的你會發現，三方交握裡面有兩個奇怪的 seq 數字(1708137740 以及 3857014844)\
sequential number 是一個隨機的數字，方便 server/client 溝通同步用的

你可以看到第一個藍色框框，在第二階段 `SYN + ACK`，它回復的 ack 數字是 1708137740 + 1\
這很明顯不是巧合，他是根據 client 的 sequential number 再加一回復的(**seq + 1**)\
不過 server 回復的 sequential number 卻是不同的？ 因為 server client 他們會個別產生數字，不會共用

<hr>

最後當連線都建立完成之後，你可以看到黃色框框的部份\
就是在進行資料傳輸了\
這時你會發現為什麼 sequential number 變成一個 pair 了？\
而且它似乎擁有某種關聯，`1:377` 然後 `377:14857`\
聰明的你一定猜到，它是在確保資料的 **到達順序**

<hr>

你可能會發現，為什麼會有兩個三方交握(藍色框框)\
仔細看會發現他是兩個不同的 client 分別跟 4000 port 進行連線\
我雖然無法確定為什麼會有多個 client 連線，但這證明了一件事情，server 是可以多工處理不同 client 的連線的！\
而且它還不會亂掉(因為 client port 不同，所以是不同的 [Socket](#socket))

<hr>

但藍色框框，最後 server 回 `ACK` 的時候, 為什麼是 1 呢？\
這是 tcpdump 預設輸出相對 sequence number\
可以在下指令的時候加一個 flag `-S` 就可以了\
下圖，`ACK` 回的數字就是 **seq + 1** 了

![](/assets/img/posts/tcpdump2.png)

## Four-way Handshake
![](/assets/img/posts/tcpdump3.png)

> 再次註明，在原始的 [RFC 793](https://datatracker.ietf.org/doc/html/rfc793) 的定義中\
> 並沒有指出需要四方握手以結束連線\
> 我在測試的時候也是有時候有看到，有時候又沒看到

跟三方交握相反，四方握手是用在關閉連線的時候會用到\
概念在 [Why Handshake is Important](#why-handshake-is-important) 提到\
基本上是一樣的

這裡的關閉連線是從 server 開始的\
第一個藍色框框，使用 `FIN + ACK` 來表明我想要中斷連線\
我想要終止 sequential number 為 `20412` 這段連線\
並且跟你說，上一段資訊 `1573` 我已經收到了

所以第二段\
`ACK` client 表示說好的我已經收到了你想要關閉 `20412` 的連線

第三段\
既然你想要關閉連線，那我這邊也想要關閉 `1573` 的連線(`FIN`)\
並且 `20412` 連線已經結束了，回一個 `20412 + 1` 的 `ACK` 給你

最後 server 表示，你的 `1573` 關閉請求已經批准！回一個 `1573 + 1` 的 `ACK` 給你

<hr>

基本上就是每個人做的每件事情都一定要回\
所以才會拆成四個步驟來做\
說到底就是 `server 想關`, `client 想關`, `server 結束`, `client 結束` 這樣

## Congestion Control
網路是會塞車的，網路頻寬是一個主要的因素\
相信你有過一個狀況，家裡很多人在用 wifi 的時候，你會感覺到它變慢\
這個就是網路已經塞車的現象了

說到塞車，假設連假你要出門旅遊\
從連假的前一天開始就會有塞車的現象\
這時候你可以選擇當個聰明用路人或者是跟著一起塞\
一起塞的時候，你會發現到匝道會有管制，幾秒鐘放行幾輛車子這種\
這就是 **壅塞控制** 的概念

避免過多的車子進入國道，使得塞車的現象變得更嚴重\
我們可以使用基本的管制措施限制數量，用以緩解塞車的現象

當網路上的封包多到開始掉的時候，一個常見的方法就是減緩發送封包的頻率(`congestion window` :arrow_right: 給定時間內能傳多少資料)\
對，[TCP](#tcp---transmission-control-protocol) 是會掉封包的，因為底層是 [IP](#ip---internet-protocol) 不可靠傳輸\
TCP 有自己的偵錯方法，所以我們可以信任它

## telnet
測試 TCP 連線可以使用 telnet\
基本的用法就是

```shell
$ telnet localhost 8080
```

然後就可以開始傳輸資料了

# UDP - User Datagram Protocol
UDP 的定義是在 [RFC 768](https://datatracker.ietf.org/doc/html/rfc768)\
相較於 [TCP](#tcp---transmission-control-protocol)，UDP 是不會進行握手的\
所以他是無連線的 protocol

UDP 相比 [IP](#ip---internet-protocol) 額外新增了兩個服務

+ datagram header 中加入錯誤偵測欄位，確保資料無誤
+ process 之間的通訊

UDP 並沒有像 [TCP](#tcp---transmission-control-protocol) 一樣提供可靠性傳輸哦

## UDP Observation
UDP 在傳送資料前並不會有任何握手確認的動作\
看一下實際上是不是真的這樣子

> 我們可以用 [Tcpdump](https://www.tcpdump.org/) 以及 [Wireshark](https://www.wireshark.org/download.html) 觀察\
> 測試指令我們可以用 [netcat](https://netcat.sourceforge.io/) 來測試

![](/assets/img/posts/udpdump.png)

測試 UDP 的指令為 `$ echo "Hello world" | nc -u 127.0.0.1 8083 -w 10`

我們用 netcat(nc) 的指令，發送資料(Hello world) 到本機上的 8083 port\
`w` flag 是指等待秒數，在這裡我們等 10 秒

你可以看到 tcpdump 的確有抓到我們送過去的資料(沒錯 tcpdump 也可以用來抓 udp traffic)\
詭異的是它為什麼會顯示長度為 12 呢？

![](/assets/img/posts/udpdump1.png)

透過 wireshark 觀察可以得知，最後一個 byte 是 `0A`\
參照 [ASCII](https://zh.wikipedia.org/zh-tw/ASCII) 表來對照就是 `LF`\
所以實際上是 `Hello world\n`, 也就是 12 個 byte 了

<hr>

你可以很明顯的看到，UDP 並沒有所謂握手的動作\
參照 tcpdump 的結果，他是直接傳資料過來的\
就像有人突然跟你搭話，你有可能沒聽清楚蛤回去\
封包就掉了

## UDP Transfer Type
UDP 在傳輸資料的時候有分成三種不同的模式 [Unicast](#unicast), [Multicast](#multicast) 以及 [Broadcast](#broadcast)

### Unicast
在 [UDP Observation](#udp-observation) 我們看到的例子就是屬於 unicast\
他是點對點的傳輸，跟 [TCP](#tcp---transmission-control-protocol) 很像\
只是沒有握手而已

### Multicast
相較於單點傳播，multicast 為多點傳播\
但它跟 [Broadcast](#broadcast) 不一樣\
多點傳播只會把資料傳給訂閱者，而不會把資料傳給其他人\
有點類似 `Observer Pattern`(可參考 [設計模式 101 - Observer Pattern \| Shawn Hsu](../../design%20pattern/design-pattern-observer))

multicast 需要執行在特定的 ip 地址上\
這個是因為它可以確保路由的時候更順利，因為只要送到這個地址的資料我就知道他是 multicast\
這個區段從 `224.0.0.0` 到 `239.255.255.255`

訂閱 multicast server 的人，每當新訊息來的時候，就會收到\
類似 mailing list\
而發送訊息的本人，是不會收到自己發送的訊息的

### Broadcast
廣播就是所有人都可以收到資料了\
它不需要明確的加入 "群組", 就可以收到資料

同樣的，廣播也需要一個地址 `255.255.255.255`\
把資料丟過去，所有同個區域網路都會收到你的訊息\
而這其實會造成一些問題

不是每個人都需要這個訊息\
它會造成網路壅塞(c.f. [Congestion Control](#congestion-control))，這顯然不好\
所以其實 broadcast 已經被廢棄了

# SSL - Secure Sockets Layer(TLS)
一個常見的誤區，至少對我來說\
是錯誤的認為 TCP/UDP 這些協定會自己幫我們把資料加密\
這是錯的 是錯的 錯的！

![](/assets/img/posts/udpdump1.png)

至少你可以從我們做的 wireshark 小實驗中得出\
我們甚至不用 decrypt 就知道我們送的資料是 `Hello world`

我們能在網路上肆意的遊玩，是因為我們的資料都是加密過的\
得益於 SSL(i.e. TLS) 的幫助

TLS(現在比較常說 TLS) 是一種補強的 protocol\
定義於 [RFC 5246](https://datatracker.ietf.org/doc/html/rfc5246)\
其宗旨是為了提供在網路上雙方的隱私以及資料的完整性

> At the lowest level, layered on top of some reliable\
> transport protocol (e.g., TCP [TCP]), is the TLS Record Protocol.

TLS 需要跑在可靠性的傳輸協定之上，如 [TCP](#tcp---transmission-control-protocol)

+ 隱私性是透過 `對稱性加密演算法` 或 `非對稱式加密演算法` 所提供
+ 資料的完整性是透過 `Message Authenticate Codes(MACs)` 所提供

基本上 TLS 是由兩部份組成 [TLS Record Protocol](#tls-record-protocol) 以及 [TLS Handshake Protocol](#tls-handshake-protocol)

## TLS Record Protocol
record protocol 主要是用於封裝高階 protocol 的資料\
舉例來說 HTTP(可參考 [重新認識網路 - HTTP1 與他的小夥伴們 \| Shawn Hsu](../../network/networking-http1))

怎麼封裝呢？\
將 message-based 的資料包裝成一個可管理的封包\
適當的壓縮資料，加上 `Message Authenticate Codes(MACs)` 來確保資料完整性

> MACs 不能驗證來源合法性(i.e. 不確定是不是本人簽的)\
> 如果需要驗證 1. 資料完整性 2. 來源合法性，可以考慮使用數位簽章(digital signature)

## TLS Handshake Protocol
重頭戲來啦，client 跟 server 要建立一個安全的連線了！

+ 他們會先核對基本資料(e.g. `protocol version`, `加密演算法` 等等的)
    + 然後嘗試做 session resumption(簡單的理解是 connection caching, 這樣就不用重新握手，很方便)
+ 驗證彼此的合法性
    + 交換 certificate 驗證彼此的身份(透過 CA 組織, 比如說免費的 [Let's Encrypt](https://letsencrypt.org/))
+ 產生 master secret, premaster secret，交換 random number(避免 [relay attack](https://en.wikipedia.org/wiki/Replay_attack))
+ secure session 建立成功！ 可以開始享受安全的資料傳輸了！

![](https://infocenter.nokia.com/public/7705SAR234R1A/topic/com.nokia.system-mgmt-guide/graphics/sw1394.png)
> ref: [TLS Handshake](https://infocenter.nokia.com/public/7705SAR234R1A/index.jsp?topic=%2Fcom.nokia.system-mgmt-guide%2Ftls-handshake.html)

# TCP/UDP Comparison

||TCP|UDP|
|:--:|:--|:--|
|Reliable|:heavy_check_mark:|:x:|
|Ordered|:heavy_check_mark:|:x:|
|Handshake|:heavy_check_mark:|:x:|
|Connection|:heavy_check_mark:|:x:|
|Congestion|:heavy_check_mark:|:x:|
|Packet size|Large|Small|
|Used Socket|2|1|

# TCP/UDP Golang Example
詳細的程式碼可以參考 [ambersun1234/blog-labs/echo-tcp-udp](https://github.com/ambersun1234/blog-labs/tree/master/echo-tcp-udp)

## TCP
```go
func tcpHandle(conn net.Conn) {
    defer conn.Close()

    scann := bufio.NewScanner(conn)
    for scann.Scan() {
        input := scann.Text()

        logger.Println("Receive: ", input)
        if _, err := conn.Write([]byte(fmt.Sprintf("%s\n", input))); err != nil {
            logger.Fatalln(err)
        }
    }
}

func tcpServer() {
    li, err := net.Listen("tcp", fmt.Sprintf(":%d", tcpPort))
    if err != nil {
        logger.Fatalln(err)
    }
    defer li.Close()
    logger.Printf("Listening on: localhost:%v\n", tcpPort)

    for {
        conn, err := li.Accept()
        if err != nil {
            logger.Fatalln(err)
        }
        if err := conn.SetDeadline(time.Time{}); err != nil {
            logger.Fatalln(err)
        }

        go tcpHandle(conn)
    }
}

func tcpClient() {
    host := os.Getenv("HOST")
    conn, err := net.Dial("tcp", fmt.Sprintf("%v:%d", host, tcpPort))
    if err != nil {
        logger.Fatalln(err)
    }

    ticker := time.NewTicker(2 * time.Second)
    for {
        <-ticker.C

        // send data
        msg := "Hello World!"
        logger.Println("Send: ", msg)
        if _, err := conn.Write([]byte(fmt.Sprintf("%s\n", msg))); err != nil {
            logger.Fatalln(err)
        }

        // receive data
        data, err := bufio.NewReader(conn).ReadString('\n')
        if err != nil {
            logger.Fatalln(err)
        }
        logger.Printf("Server ACK with: '%v'\n", string(data))
    }
}
```
基本上需要注意的點是
1. TCP 是以換行為分隔符號, 所以你送資料的時候記得加 `\n`

其他就相對單純\
用一個 for-loop 持續監聽連線\
當新的連線進來的時候，就開啟 goroutine 來處理它(line 32)\
這也是為什麼上面我們說 [TCP](#tcp---transmission-control-protocol) 需要兩個 sockets

## UDP Unicast
```go
func udpUnicastHandle(conn *net.UDPConn) {
    buf := make([]byte, 1024)

    for {
        n, adr, err := conn.ReadFromUDP(buf)
        if err != nil {
            logger.Fatalln(err)
        }

        data := string(buf[:n])
        logger.Println("Receive: ", data)
        if _, err := conn.WriteToUDP([]byte(fmt.Sprintf("%v\n", data)), adr); err != nil {
            logger.Fatalln(err)
        }
    }
}

func udpUnicastServer() {
    address := net.UDPAddr{
        Port: udpUnicastPort,
        IP:   net.ParseIP("0.0.0.0"),
    }
    li, err := net.ListenUDP("udp", &address)
    if err != nil {
        logger.Fatalln(err)
    }
    logger.Printf("Listening on: localhost:%v\n", udpUnicastPort)

    udpUnicastHandle(li)
}

func udpUnicastClient() {
    host := os.Getenv("HOST")
    conn, err := net.Dial("udp", fmt.Sprintf("%v:%d", host, udpUnicastPort))
    if err != nil {
        logger.Fatalln(err)
    }

    ticker := time.NewTicker(2 * time.Second)
    for {
        <-ticker.C

        // send data
        msg := "Hello World!"
        logger.Println("Send: ", msg)
        if _, err := conn.Write([]byte(msg)); err != nil {
            logger.Fatalln(err)
        }

        // receive data
        data, err := bufio.NewReader(conn).ReadString('\n')
        if err != nil {
            logger.Fatalln(err)
        }
        logger.Printf("Server ACK with: '%v'\n", string(data))
    }
}
```

跟 [TCP](#tcp) 的實作可以說是一模一樣\
差在它不會預先建立連線\
然後一些 function 改成使用 UDP 版本的這樣而已

## UDP Multicast
```go
func udpMulticastHandle(conn *net.UDPConn) {
    address, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%v:%v", udpMulticastHost, udpMulticastPort))
    if err != nil {
        logger.Fatalln(err)
    }
    buf := make([]byte, 1024)

    for {
        n, _, err := conn.ReadFromUDP(buf)
        if err != nil {
            logger.Fatalln(err)
        }

        data := string(buf[:n])
        logger.Println("Receive: ", data)
        if _, err := conn.WriteTo([]byte(fmt.Sprintf("%v\n", data)), address); err != nil {
            logger.Fatalln(err)
        }
    }
}

func udpMulticastServer() {
    address, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%v:%v", udpMulticastHost, udpMulticastPort))
    if err != nil {
        logger.Fatalln(err)
    }
    li, err := net.ListenMulticastUDP("udp", nil, address)
    if err != nil {
        logger.Fatalln(err)
    }
    logger.Printf("Listening on: localhost:%v\n", udpMulticastPort)

    udpMulticastHandle(li)
}

func udpMulticastClient() {
    address, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%v:%v", udpMulticastHost, udpMulticastPort))
    if err != nil {
        logger.Fatalln(err)
    }

    conn, err := net.ListenMulticastUDP("udp", nil, address)
    if err != nil {
        logger.Fatalln(err)
    }

    ticker := time.NewTicker(2 * time.Second)
    for {
        <-ticker.C

        // send data
        msg := "Hello World!"
        logger.Println("Send: ", msg)
        if _, err := conn.WriteTo([]byte(msg), address); err != nil {
            logger.Fatalln(err)
        }

        // receive data
        data, err := bufio.NewReader(conn).ReadString('\n')
        if err != nil {
            logger.Fatalln(err)
        }
        logger.Printf("Server ACK with: '%v'\n", string(data))
    }
}
```

UDP Multicast 就有意思的多了\
首先，你必須使用 `ListenMulticastUDP` 這個 function\
不論 client 或 server\
注意到不能使用 ListenUDP

另外一個有趣的點是先前在 [Multicast](#multicast) 提到\
群播發送訊息的人不會收到自己的訊息\
根據 [https://pkg.go.dev/net#ListenMulticastUDP](https://pkg.go.dev/net#ListenMulticastUDP) 裡面提到

> Note that ListenMulticastUDP will set the IP_MULTICAST_LOOP socket option to 0 under IPPROTO_IP, to disable loopback of multicast packets.

而你在測試 Multicast 的時候就必須要使用不同的機器\
才可以正確的讀取到群播的資料\
並不需要手動撰寫過濾自身訊息的程式(你必須要使用 `ListenMulticastUDP` 這個 function)

並且，server 寫資料的時候也要注意\
因為是群播，所以你的 destination 也必須要是 `群播地址`(第 16 行)\
不要寫成 client address 不然你會讀不到資料

# References
+ 電腦網際網路(ISBN: 978-986-463-950-2)
+ [網際網路協議套組](https://zh.wikipedia.org/wiki/TCP/IP%E5%8D%8F%E8%AE%AE%E6%97%8F)
+ [TCP header format](https://jyhshin.pixnet.net/blog/post/31256044)
+ [What is TCP Three-Way HandShake?](https://www.guru99.com/tcp-3-way-handshake.html)
+ [傳輸控制協定](https://zh.wikipedia.org/wiki/%E4%BC%A0%E8%BE%93%E6%8E%A7%E5%88%B6%E5%8D%8F%E8%AE%AE)
+ [Root Servers](https://www.iana.org/domains/root/servers)
+ [Why does TCP socket programming need two sockets(one welcome socket and one connection socket) but UDP only needs one?](https://stackoverflow.com/questions/41389880/why-does-tcp-socket-programming-need-two-socketsone-welcome-socket-and-one-conn)
+ [TCP: can two different sockets share a port?](https://stackoverflow.com/questions/11129212/tcp-can-two-different-sockets-share-a-port)
+ [透過 TCP/IP 進行三向交握的說明](https://learn.microsoft.com/zh-tw/troubleshoot/windows-server/networking/three-way-handshake-via-tcpip)
+ [Three-Way Handshake](https://github.com/steveLauwh/TCP-IP/blob/master/TCP/Three-Way%20Handshake%20And%20Four-Way%20Wavehand.md)
+ [Why is the ACK flag in a tcpdump represented as a period "." instead of an "A"?](https://stackoverflow.com/questions/60443487/why-is-the-ack-flag-in-a-tcpdump-represented-as-a-period-instead-of-an-a)
+ [tcpdump: Learning how to read UDP packets](https://dzone.com/articles/tcpdump-learning-how-read-udp)
+ [串流技術簡介- 什麼是 UDP, TCP, Unicast, Multicast, RTP, RTSP, RTMP?](https://www.datavideo.com/hk/article/51/streaming-terminology)
+ [What IP to use in order to perform a UDP broadcast?](https://stackoverflow.com/questions/72843819/what-ip-to-use-in-order-to-perform-a-udp-broadcast)
+ [TCP擁塞控制](https://zh.wikipedia.org/zh-tw/TCP%E6%8B%A5%E5%A1%9E%E6%8E%A7%E5%88%B6)
+ [How do multiple clients connect simultaneously to one port, say 80, on a server? [duplicate]](https://stackoverflow.com/questions/3329641/how-do-multiple-clients-connect-simultaneously-to-one-port-say-80-on-a-server)
