---
title: 重新認識網路 - OSI 七層模型
date: 2022-04-28
categories: [http]
tags: [network, osi, rfc, endian, ]
math: true
---

# Introduction
OSI 七層模型是由 [國際電信聯盟電信標準化部門 - ITU-T](https://www.itu.int/en/ITU-T/Pages/default.aspx) 與 [國際標準組織 - ISO](https://www.iso.org/home.html) 於 1989 年制定的 **開放式系統互聯模型**\
標準的部份目前我有看到兩個版本
+ `ISO/IEC 7498` - 1989 第一版
+ `ISO/IEC 7498` - 1994 第二版

每個版本的標準都包含若干個部份
1. The Basic Model
2. Security Architecture
3. Naming and Addressing
4. Management Framework

本次探討主題主要會是七層模型的部份，所以只要看 `ISO/IEC 7498-1` 就可以了\
網路上我找不到官網的 spec, 只有找到其他備份網站的 **第二版** 規格 [ISO/IEC 7498-1](https://www.ecma-international.org/wp-content/uploads/s020269e.pdf)\
或是可以參考另一個版本的 [ITU-T Rec.X.200(1994E)](https://www.itu.int/rec/dologin_pub.asp?lang=e&id=T-REC-X.200-199407-I!!PDF-E&type=items)(內容與 ISO/IEC 7498-1 完全一樣，他有多個 release)\
這邊強烈建議搭配 [RFC 1122](https://datatracker.ietf.org/doc/html/rfc1122) 服用
> 比如說 header 那些的定義其實都是寫在 [RFC 1122](https://datatracker.ietf.org/doc/html/rfc1122) 裡面的，網路上的資料多數沒有標明清楚\
> 事實上 ISO/IEC 7498-1 只有寫說這一層應該要做哪些事情而已

這邊要特別注意的是，模型只是 ***參考用的***\
我一直以為說 OSI 七層模型是強制規定，但實際上並不是的

# OSI 7 layer Model
## Application Layer - 7
應用層提供了軟體跨網路之間溝通的 interface(唯一橋樑)\
兩台機器之間的溝通(i.e. 資料交換如網頁伺服器)需要使用 `應用層協議` 以及 `表達層` 的服務

許多的協議都是跑在應用層之上\
例如 HTTP, HTTPS, Telnet SSH ... etc.

## Presentation Layer - 6
表達層負責將資料轉換為 **通用格式**, 使的 application layer 能看懂資料

一開始看到這我有點看不懂這是啥意思 傳輸用的不都是 binary 嗎？\
理論上只要 decode 不就可以看懂了

後來我想到 grpc 的 message encoding\
它實際上並不是一般的 encode, 他有自己的一套方法(ref: [Encoding](https://developers.google.com/protocol-buffers/docs/encoding))，而如果這些訊息沒有得到適當的 decode 是沒辦法讀出正確的資訊的\
所以這就是 presentation layer 實際上在處理的事情
> 有關 gRPC 的相關介紹，可以參考 [網頁程式設計三兩事 - gRPC \| Shawn Hsu](../../website/website-grpc)

## Session Layer - 5
會議層主要的目的是維持溝通雙方的連線，確保資料交換的過程

## Transport Layer - 4
傳輸層顧名思義，它為上層提供了一個可靠性傳輸的方式，讓上層不用擔心網路連線以及 routing 等等的問題

其中傳輸層的資料格式為 `datagram`([PDU](#pdu-and-sdu))
> 通常在 TCP 裡面會稱為 segment, UDP 則是稱呼為 datagram

注意到這裡的 datagram 跟 [RFC 1122 §1.3.3](https://datatracker.ietf.org/doc/html/rfc1122#page-18) 裡面提到的 IP datagram 是不一樣的東西\
這裡的 datagram 算是一個統稱, 可以參考 [RFC 1594 §13](https://www.rfc-editor.org/rfc/rfc1594#page-33)
> A self-contained, independent entity of data carrying\
> sufficient information to be routed from the source\
> to the destination computer without reliance on earlier\
> exchanges between this source and destination computer and\
> the transporting network.

<hr>

常見的協議如 [TCP](https://en.wikipedia.org/wiki/Transmission_Control_Protocol) 以及 [UDP](https://en.wikipedia.org/wiki/User_Datagram_Protocol) 都是跑在傳輸層之上的協議
<!-- > 詳細的討論可以參考 [重新認識網路 - TCP/IP \| Shawn Hsu](../networking-tcp) 以及 [重新認識網路 - UDP \| Shawn Hsu](../networking-udp) -->

## Network Layer - 3
網路層主要是作 routing 的功能\
網際網路的連線主要連線是由數個開放網路的中繼站所組成\
你可以做一個簡單的測試, 使用 [traceroute](https://zh.wikipedia.org/wiki/Traceroute) 測試本機連線到 [github.com](https://github.com) 中間會經過多少 relay
```shell
$ sudo apt install traceroute -y
$ traceroute github.com
```

預設跑出來的結果是只有 ip 以及域名解析，但我想要知道 ip 的所在地(i.e. 國家)\
所以我參考 [Associate IP addresses with countries [closed]](https://stackoverflow.com/questions/1935621/associate-ip-addresses-with-countries)，使用 [MAXMIND](https://www.maxmind.com/en/home) 做查詢\
它大概長這樣

|IP address|Location|
|:--|:--|
|60.199.4.173|Taiwan,Asia|
|52.95.218.48|Ashburn,Virginia,United States,North America|
|52.93.95.79|United States,North America|
|52.95.31.222|Tokyo,Tokyo,Japan,Asia|
|52.93.73.224|United States,North America|

上表你可以發現，它經過了至少 3 個地方(Taiwan, US, Japan)\
你想哦 世界上開放網路的中繼站這麼多，他要怎麼知道怎麼走？\
為什麼 traceroute 出來不是走 `歐洲再到美國` 而是走 `日本到美國`？\
所以 network layer 會負責篩選出合適的路徑進行最佳化，避免你繞了地球走了三圈浪費網路資源

<hr>

為了要找出最佳路徑，network layer 會帶一些重要的路由資訊\
網路層的傳輸單位為 `packet`([PDU](#pdu-and-sdu))\
他是由 `ip header` + 資料組成
> 其中資料為真正要傳輸的 data

ip header 要帶的東西包含 source address, destination address, length, metadate(routing 相關) 以及 [hop limit](https://en.wikipedia.org/wiki/Hop_(networking))\
hop 這個東西簡單講就是，`經過的中繼站點個數`, 它也可以用來粗略的估計兩台機器間的距離(路由個數)\
![](https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Hop-count-trans.png/600px-Hop-count-trans.png)\
以上述圖片來說，hop 的數值為 2(因為經過兩台 router)

<hr>

那有哪些設備是跑在網路層的呢？\
layer 3 switch 以及 IP 分享器 都是網路層的設備

除此之外，[Internet Protocol IP](https://en.wikipedia.org/wiki/Internet_Protocol) 也是跑在網路層的上的協議
<!-- > 詳細關於 TCP/IP 的討論可以參考 [重新認識網路 - TCP/IP \| Shawn Hsu](../networking-tcp) -->

## Data Link Layer - 2
資料連結層為了提供 [connectionless-mode](https://en.wikipedia.org/wiki/Connectionless_communication) 以及 connection-mode，所以它必須提供了一系列的連線建立、維護\
而資料連結層會對實體層發出的錯誤訊號進行偵測以及 **嘗試修正**

資料連結層的傳輸單位為 `frame`([PDU](#pdu-and-sdu))\
他是由 `link-layer header` + `packet`(layer 3 SDU)\
其中 link-layer header 的資料就跟 MAC 子層的內容是一樣的

資料連結層由兩個子層所構成 - LLC 以及 MAC
### 邏輯鏈路控制 Logical Link Control - LLC
LLC 子層在做的事情就是提供一個 interface, 讓上層可以不用管底層網路連接類型\
而它還有一個更重要的功能是 multiplex(嘿對就是邏輯設計課堂教的 [multiplexer 多工器](https://zh.wikipedia.org/zh-tw/%E6%95%B0%E6%8D%AE%E9%80%89%E6%8B%A9%E5%99%A8))

你說為什麼這裡需要用到多工器\
試想你平常在用電腦，你的網頁需要連網，line 需要連網，搞不好你還連了 NAS\
是不是這些東西都需要用網路？ 理論上你電腦只有一張網卡，那當然不可能只能由一個程式霸佔網路對吧\
所以你需要多工器，為每一個獨立運行的程式提供網路服務
> 每個 process 都能夠在一定的時間內分到網卡的資源(切換 logical link)

![](http://www.tsnien.idv.tw/Network_WebBook/%E6%8F%92%E5%9C%96/chap7/7-8.png)

### 媒介存取控制 Media Access Control - MAC
logical link 的排程處理已經交由 LLC 子層處理了，那萬一我想要連線的對象不一樣呢？\
假設你的電腦目前透過有線的方式連接了遠端伺服器 server1，以及透過無線的方式連接了你的另一台 server2\
它會長的像下面這樣子(示意圖)\
![](https://www.exoscale.com/static/syslog/2016-01-15-secure-your-cloud-computing-architecture-with-a-bastion/bastion-security-groups-example.svg)
> ref: [Secure your Cloud Computing Architecture with a Bastion](https://www.exoscale.com/syslog/secure-your-cloud-computing-architecture-with-a-bastion/)

很明顯你的 server1 以及 server2 的實體連線路徑並不相同\
因此當你想要操作 server2 的時候，LLC 將網卡使用權交給連接 server2 的進程，同理他的底層連線路徑也需要做切換(不然你會連到別台機器)

所以切換 [transmission medium](#transmission-medium)(i.e. 實體連線路徑) 是 MAC 子層要做的事情\
同時它還會將一些必要資訊塞入(e.g. MAC address, 必要 padding 以及 [Frame Check Sequence - FCS](https://zh.wikipedia.org/wiki/%E5%B8%A7%E6%A0%A1%E9%AA%8C%E5%BA%8F%E5%88%97))

<hr>

除以上提到的功能之外，資料連結層也針對 *區域網路* 提供了 routing 的功能

layer2 交換器(記憶 MAC address 進行資料交換)是跑在資料連接層上面的設備

## Physical Layer - 1
實體層定義了一種可以在多台機器間啟用、維護的物理連接，可以在這個連接上面傳輸 0, 1 位元資料(i.e. bits)

實體層傳輸的單位為 `bit`([PDU](#pdu-and-sdu)), 它通常為 *一個 bit* 或 *一串 bits*

+ 實體層傳輸資料可以是 serial 或 parallel(看實作)
+ 實體層傳輸可以是[全雙工](https://zh.wikipedia.org/wiki/%E9%9B%99%E5%B7%A5#%E5%85%A8%E9%9B%99%E5%B7%A5)或[半雙工](https://zh.wikipedia.org/wiki/%E9%9B%99%E5%B7%A5#%E5%8D%8A%E9%9B%99%E5%B7%A5)(i.e. 可不可以同時收送資料)

那麼有哪些設備是跑在實體層的呢？\
網路線(RJ45)、網路卡以及集線器

<hr>

看了基本的 OSI 七層模型，想必你對網路基本架構原理有認識了\
這裡有幾張圖能夠幫助你更了解每層 layer 之間的關係\
![](https://i.stack.imgur.com/oMOGd.png)
![](https://i.stack.imgur.com/Zknbj.png)

## Common Functionality in OSI Model
基本上撇除最高的 3 層(application, presentation and session layer)\
其他的 layer 都擁有這以下功能
+ 偵錯以及除錯
    + 如果有發現錯誤，能解決的就會在該層解決，如果沒有，它就會將 error 往上送(propagate)
+ 固定傳輸順序(sequential order)
    + 傳輸資料時一定保證是依照一定的順序送資料(這樣才能確保資料讀取正確)
    + 一般來說，網路之間傳遞資料是使用 Big endian(詳細可以參考 [Endian](#endian))

# Endian
Endian 指的是資料在記憶體中的排列順序\
注意到 ***Endian 並不是受限於作業系統，而是受限於 CPU 架構***\
它一共分為兩種

## Big-endian
big-endian 為 **MSB** 在 **低位置** 的排列方法

big-endian 多數用於網路資料傳輸，或者是少數的系統中如 [Solaris](https://zh.wikipedia.org/zh-tw/Solaris)(因為 Solaris 用的是 big-endian 的 CPU)

## Little-endian
little-endian 為 **LSB** 在 **低位置** 的排列方法

little-endian 多數用於現今系統當中(像是我的 CPU 架構就是 little-endian)\
但並不是所有系統都是 little-endian, 實際情況還是要進行確認\
如果是 linux 系統你可以用以下指令進行確認
```shell
$ echo -n I | od -to2 | head -n1 | cut -f2 -d" " | cut -c6
// 0: big-endian
// 1: littel-endian
```
> ref: [How to tell if a Linux system is big endian or little endian?](https://serverfault.com/questions/163487/how-to-tell-if-a-linux-system-is-big-endian-or-little-endian)

<hr>

這裡做個簡單的比較讓你清楚的看懂他們之間的差別

|Big-endian|Little-endian|
|:--|:--|
|![](https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Big-Endian.svg/420px-Big-Endian.svg.png)|![](https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Little-Endian.svg/420px-Little-Endian.svg.png)|

<hr>

那麼要如何判斷高位置以及低位置？\
記憶體的位置我們通常用 16 進位表示(hex) 例如 `0x12345678`\
64 位元的 CPU 可以定址 $2^{64} - 1$ 這麼多空間, 它可以表示從 `0x00000000` 到 `0xFFFFFFFF`\
我們說 `0x00000000` 是低位置，`0xFFFFFFFF` 是高位置

> high, low memory 實際上還有別的意思, 是關於 kernel 對記憶體的分配([High memory](https://en.wikipedia.org/wiki/High_memory))\
> 有機會會針對這個主題寫一篇來探討

# MSB and LSB
在二進位當中我們常常需要描述特定位元\
其中又以 MSB, LSB 最常被提到
+ MSB - Most Significant Bit:
    + 在一個長度為 n 的二進位數字下，在 `第 n - 1 位` 上的數字被視為是 MSB 因為它是最重要的
    + 因為少了這個 bit 數字就跟原本的天差地遠了
+ LSB - Least Significant Bit:
    + 同理，只是他是在 `第 0 位` 的數字
    + 因為少了它也不會對結果造成太大影響

直接上圖比較好懂\
![](https://pic.pimg.tw/ytliu0/1545280500-398832370_wn.jpg)

## Will Endian Effect MSB?
既然 MSB 代表的是第 n - 1 位的數字，那 endian 會不會影響 MSB 的數值?\
假設 num = `0x12345678`\
那麼他在記憶體中的表示法為下列兩種

|Endian|Value|MSB|
|:--|:--|:--|
|big|0x 78 56 34 12|0x7|
|little|0x 12 34 56 78|0x1|

> 上述 value 表示法，左邊為 高位置，右邊為 低位置\
> 上述 MSB 為求方便辨識，取一個 byte 表示

那他們在不同的 endian 下，MSB 就不一樣了對吧！\
答案是 對但也不對\
事實上 endian 是一種表示法而已，當 endian 改變的時候，MSB 確實會改變\
但不變的是，MSB 依舊是表示 `第 n - 1 位` 的數值

> ref: [Does bit-shift depend on endianness?](https://stackoverflow.com/questions/7184789/does-bit-shift-depend-on-endianness)

# PDU and SDU
在 computer network layer 裡傳輸的資料，通常稱為 [Protocol Data Unit - PDU](https://en.wikipedia.org/wiki/Protocol_data_unit#OSI_model)\
PDU 的內容由使用者資料以及 protocol control 相關資料所組成\
在上面 OSI 七層我們討論的 `frame`, `packet`, `datagram` 都是被稱為 PDU

考慮 OSI 七層模型\
假設，當我們從 network layer 將資料往下傳給 data link layer 的時候\
資料將會從 packet 變成為 frame\
但是 data link layer 面對新到來的資料 *並不認識*，它必須透過所謂的 [encapsulation](https://en.wikipedia.org/wiki/Encapsulation_(networking))(像是增加 header field) 將資料轉換為我認識的格式\
而這個新來不認識的資料稱之為 [Service Data Unit - SDU](https://en.wikipedia.org/wiki/Service_data_unit)

他們之間的關係就是 舉例來說

|layer|data|type|
|:--|:--|:--|
|transport|packet0|packet0 :arrow_right: PDU|
|network|packet1|packet0 :arrow_right: SDU<br>packet1 :arrow_right: PDU(ip address, length)|
|data link|packet2|packet1 :arrow_right: SDU<br>packet2 :arrow_right: PDU(Mac address, FCS)|
|physical|packet3|packet2 :arrow_right: SDU<br>packet3 :arrow_right: PDU|

PDU 與 SDU 的關係是雙向的\
亦即他的收送資料的封裝拆解是對稱的
+ `sender`: 送資料需要一層一層的 **將資料加上各種 metadata**(這些 metadata 又稱作 [Protocol Control Information - PCI](https://en.wikipedia.org/wiki/Protocol-control_information))
+ `receiver`: 收資料的時候需要一層一層的 **將資料扒開**

## IP fragmentation
參照上面 PDU 與 SDU 的關係\
我們不難推論出最後 physical layer 的資料會是最龐大的對吧(因為這層它塞了最多的東西)\
在網路的世界裡，傳送封包(data packets)是有大小限制的, 這個限制稱作 [Maximum Transmission Unit - MTU](https://en.wikipedia.org/wiki/Maximum_transmission_unit)\
如果說因為你在新增 header 的過程中，讓整體的封包變得超出 MTU 的大小，那就必須要將封包分批送\
而這個分批次送的概念稱作 `IP fragmentation`

MTU 的預設大小可以參考下表(完整的可以參考 [常見的媒體的 MTU 表](https://zh.wikipedia.org/wiki/%E6%9C%80%E5%A4%A7%E4%BC%A0%E8%BE%93%E5%8D%95%E5%85%83#%E5%B8%B8%E8%A6%8B%E5%AA%92%E9%AB%94%E7%9A%84MTU%E8%A1%A8))

|Network Type|MTU size(bytes)|
|:--|:--|
|Ethernet|1500|
|IEEE 802.2/802.3|1492|

# Transmission Medium
Transmission medium 的定義是 `一條由 sender 以及 receiver 建立傳輸資料的溝通渠道`\
在資料傳輸的領域中泛指一條傳輸的實體通道\
這個通道可以將資料(i.e. bits) 從 sender 經由通道傳送給 receiver

資料傳輸共分為兩大類

## Guided Media
又稱作 bounded media, 簡單來說你可以理解成 **有線傳輸**

常見的 RJ45 網路線是屬於 guided media

## Unguided Media
又稱作 unbounded media, 你可以理解為 **無線傳輸**

它可以經由空氣、水進行傳輸\
主要的好處就是不用多那一條線\
常見的像是 無線電波(radio wave) 以及 微波(micro wave)

# References
+ [電腦網路與連結技術：第七章 區域網路模型](http://www.tsnien.idv.tw/Network_WebBook/chap7/7-2%20LLC%20%E5%B1%A4%E7%B0%A1%E4%BB%8B.html)
+ [Logical Link Control](https://en.wikipedia.org/wiki/Logical_link_control)
+ [網路通訊PDU和SDU的區別](https://www.w3help.cc/a/202107/358763.html)
+ [什麼是OSI的7層架構？和常聽到的Layer 7有關？](https://ithelp.ithome.com.tw/articles/10000021)
+ [OSI模型](https://zh.wikipedia.org/wiki/OSI%E6%A8%A1%E5%9E%8B)
+ [Medium access control](https://en.wikipedia.org/wiki/Medium_access_control)
+ [Frame (networking)](https://en.wikipedia.org/wiki/Frame_(networking))
+ [Network packet](https://en.wikipedia.org/wiki/Network_packet)
+ [Difference between PACKETS and FRAMES](https://stackoverflow.com/questions/31446777/difference-between-packets-and-frames)
+ [RFC 1042](https://datatracker.ietf.org/doc/html/rfc1042)
