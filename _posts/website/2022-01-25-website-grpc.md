---
title: 網頁程式設計三兩事 - gRPC 與 JSON-RPC
description: Remote Procedure Call 是一種傳輸協定，本文將會探討 RPC 與 RESTful API 的差異，並且會介紹 gRPC 以及 JSON-RPC 的使用方式以及 Protocol Buffer 的使用。最後會以實際的 benchmark 結果更直觀的說明
date: 2022-01-25
categories: [website]
tags: [api, grpc, rpc, json-rpc, design pattern, protobuf]
math: true
---

# RPC
RPC(Remote Procedure Call) 是一種通信協定, 它能夠 **允許本機電腦程式呼叫遠端電腦程式**\
聽起來好像還好? 重點是它能夠以 **類似於呼叫本地 function 般輕鬆**(稱為 `location transparency`)

```golang
// post.go
import userClient

func CreatePost() error {
    ...

    user := userClient.GetUser()
}
```

如上所示，我在 post.go 裡面透過 userClient 執行了一次 rpc call\
而它的呼叫就跟一般 call function 一樣簡單，但 userClient 可能是遠在其他機器上的 service

<hr>

RPC 的呼叫流程如下
+ client > 呼叫 client stub(然後 push 到 stack，就像一般 function call)
+ client > 打包呼叫參數(marshalling)
+ client > 傳送資訊到遠端伺服器
+ server > 傳送至 server stub
+ server > 解析呼叫參數(unmarshalling)
+ server > 呼叫 function
+ 再依序返回

# Proxy Pattern
而 [RPC](#rpc) 的概念即是對應到 Design Pattern 裡的 Proxy Pattern 代理模式\
用戶端藉由呼叫 `stub` 這個替身，這個替身會替它將 request forward 給真正的處理函式\
用戶不需要管這個 function 在哪裡，替身都會幫它處理好

## Definition
代理模式真正的定義如下\
`為物件提供一個代表或替身，藉以控制外界的接觸`

在 [RPC](#rpc) 中，替身單純做 request forward，並沒有 "控制外界的接觸"\
這是因為 proxy pattern 有很多變體，如下所示

|Name|Description|
|:--|:--|
|遠端代理|管理遠端與用戶端的互動|
|虛擬代理|控制與 `成本高昂的物件` 的互動|
|保護代理|控制用戶端與物件的接觸，通常與權限有關|

# Schema Evolution
資料格式可能會因為需求的改變而改變\
這時候格式的變更可能會造成一些不相容的問題\
而相容格式的情況包含兩種

## Backward Compatibility
向後相容(Backward Compatibility)亦即 `新 code 可以讀取舊的 format`\
因為你有辦法明確的處理舊的格式，你甚至知道它長怎樣

## Forward Compatibility
向前相容(Forward Compatibility)的定亦是 `舊的 code 有辦法讀取新的 format`\
這裡指的是即使遇到新的格式，我仍有辦法 **不出錯**\
代表它可以忽略新格式裡的新東西

# JSON-RPC
JSON-RPC 是一個輕量的 RPC 協定，其主要使用的資料格式是 `JSON`\
它可以執行在 HTTP 或者是 websocket 之上

使用著方法滿簡單的，就像是一般呼叫 RESTful API 一樣\
我們將要呼叫的 function name 指定在 body 裡面，並使用 **POST** method 送到伺服器上即可

詳細的 spec 可以參考 [JSON-RPC 1.0 Specification](https://www.jsonrpc.org/archive_json-rpc.org/specification.html) 以及 
[JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

> 需要注意的是如果你用的是 [gorilla/rpc](https://github.com/gorilla/rpc)，他的 param 欄位長的不太一樣

```json
{
  "jsonrpc" : "1.0",
  "method" : "Server.Function",
  "params" : [
    "hello", "world"
  ],
  "id": 1
}
```
以上是一個簡單的 JSON-RPC 呼叫範例，可以看到 JSON 裡面包含了 4 個欄位
+ `jsonrpc` 是 `1.0` 代表是 JSON-RPC 的版本，現在到 `2.0` 了
+ `method` 是呼叫的 function name
+ `params` 是呼叫的參數
+ `id` 是 client 的 id, 如果為空則代表為通知訊息

server 回傳的格式也類似
```json
{
  "jsonrpc" : "1.0",
  "result" : {
	"hello": "world"
  },
  "error" : null,
  "id": 1
}
```

server 回傳的 id 需要跟 client 發起的 id 一樣\
格式方面則是多了 `result` 和 `error`

# gRPC
gRPC 是 google 基於 rpc 所開發的一套 library, 其支援超過十幾種語言(包含 [C++](https://github.com/grpc/grpc/tree/master/src/cpp), [Python](https://github.com/grpc/grpc/tree/master/src/python), [Go](https://github.com/grpc/grpc-go) ... etc.)\
所以你可以作到像是 server side 用 GoLang 跑, client side 用 Python 跑這種\
![](https://grpc.io/img/landing-2.svg)

定義好了傳輸方式之後，資料傳輸格式以及 [Interface Definition Language - IDL](https://en.wikipedia.org/wiki/Interface_description_language) 的部份 gRPC 是使用 [protocol buffer](https://developers.google.com/protocol-buffers)，其擁有以下特性
+ 跨平台 跨語言
+ 更快速 - 自行 encode 有可能會增加 run time cost

# Protocol Buffer
Protocol Buffer 是一種資料編碼格式\
由於其**採用 binary encode** 的方式，使得整體資料的大小相比 textual encode 還要更小\
也因此傳輸速度可以更快

接下來就讓我們實際的來定義 protocol 檔案吧

```proto
syntax = "proto3";
package users;

option go_package = ".;users";

service Users {
  rpc GetUser (UserRequest) returns (User) {};
}

message UserRequest {
  string user_id = 1;
}

message User {
  string user_id = 1;
  string user_name = 2;
  string first_name = 3;
  string last_name = 4;
  string email = 5;
}
```

首先你會先定義 protobuf 的版本(現在都用 proto3)，以及 package name(避免撞名)\
go_package 定義了 generated file 的檔案位置

## Service
service 包含了所有你定義的 RPC 方法\
而 gRPC 總共有 4 種 RPC 模式

|Method|Example|
|:--|:--|
|Simple RPC(Unary RPC)|rpc SayHello(HelloRequest) returns (HelloResponse);|
|Client-side Streaming|rpc LotsOfReplies(HelloRequest) returns (**stream** HelloResponse);|
|Server-side Streaming|rpc LotsOfGreetings(**stream** HelloRequest) returns (HelloResponse);|
|Bidirectional Streaming|rpc BidiHello(**stream** HelloRequest) returns (**stream** HelloResponse);|

本篇將專注在 Simple RPC 的部份

## Message
message 區塊就是定義資料格式，我覺的有點像是 C 語言的 structure\
裡面包含了

|Content Type|Description|
|:--|:--|
|Field ID|ID 為對應每個欄位的號碼，以 ***= x*** 表示，其中 x 可以是<br>`1 到 15` :arrow_right: 是使用 `1 個 byte`<br>`16 到 2047` :arrow_right: 是使用 `2 個 byte`<br>`2048 到 2^29 - 1` :arrow_right: 可以使用<br>`19000 到 19999` :arrow_right: protobuf 保留用, **不能做使用**<br>|
|Field Type|它可以是 string, int32, bool ... etc.(詳細支援型別可以上 [Scalar Value Types](https://developers.google.com/protocol-buffers/docs/proto3#scalar) 查找)|
|Field Data||

encode 完成之後，他的排列方式會長這樣
```
|----------|------------|------------|
| Field ID | Field Type | Field Data |
|----------|------------|------------|
```

<hr>

為什麼需要 `Field ID`?\
`Field Name`(i.e. `user_id`, `user_name`) 不就足以區分各個欄位了嗎？\
沒錯！ 你說的對，但是為了 [Backward Compatibility](#backward-compatibility) 以及 [Forward Compatibility](#forward-compatibility)\
Field ID 是必要的

根據上述的 protocol buffer 的定義，我們可以知道\
`tag 1` 對應到 `user_id`\
`tag 2` 對應到 `user_name`

如果今天我把 `user_name` 改成 `user_fullname` 會發生什麼事情？\
舊的系統可以讀取新的資料格式嗎？\
你當然可以直接改實作\
但是有了 `Field ID` 之後，**只要 ID 不變，不管 Field Name 怎麼改都不會有差**\
因此可以達到 [Backward Compatibility](#backward-compatibility)

至於 [Forward Compatibility](#forward-compatibility)\
我要怎麼讀取新的資料格式？\
如果遇到沒看過得 ID，略過往下一個繼續看不就行了？\
因為 encode 過的資料都是排列緊湊在一起的，其中也包含了 **偏移量**(可以從 `Field Type` 得知)\
所以利用 `Field ID` 與 `Field Type` 你可以輕易的達成向前相容

### Repeated
```proto
message UserList {
    repeated User users = 1;
}
```

其實就是 array\
他在格式裡面的表示方法也一樣就是
```
|----------|------------|------------|
| Field ID | Field Type | Field Data |
|----------|------------|------------|
```
只不過有很多組這樣
```
|---|-----|----|---|-----|----|-----|
| 1 | int | 12 | 1 | int | 33 | ... |
|---|-----|----|---|-----|----|-----|
  ^              ^
```
上述等價於 `[]int{12, 33}`

## Compile protocol Buffer
撰寫完成之後，我們必須要把 proto 檔 compile 成我們能用的

需要使用到的工具有 [protoc](https://grpc.io/docs/protoc-installation/), [protoc-gen-go](https://pkg.go.dev/google.golang.org/protobuf@v1.27.1/cmd/protoc-gen-go), [protoc-gen-go-grpc](https://pkg.go.dev/google.golang.org/grpc/cmd/protoc-gen-go-grpc)\
安裝指令如下
```shell
$ sudo apt install protobuf-compiler -y
$ go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.26
$ go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.1
$ export PATH="$PATH:$(go env GOPATH)/bin" >> ~/.bashrc
```

接下來使用以下指令編譯
```shell
$ protoc --go_out=. --go_opt=paths=source_relative \
        --go-grpc_out=. --go-grpc_out=paths=source_relative \
        users.proto
```

期間可能會遇到一些問題
+ `protoc-gen-go-grpc: program not found or is not executable` 或 `protoc-gen-go: program not found or is not executable`
    + 這個狀況是你要正確的 install 這些 `command` 在機器上(也就是 `go install google.golang.org/protobuf/cmd/proto-gen-go` 之類的)
    + go package 的部份有分成 `module` 跟 `command`, 其中 command 的部份需要手動下載，你用 go mod download 是沒有用的
+ `protoc: command not found`
    + 記得 `export PATH="\$PATH:$(go env GOPATH)/bin" >> ~/.bashrc`
+ `protoc-gen-go-grpc: unable to determine Go import path for "users.proto"`
    + 可參考 [proto编译组件使用](https://www.cnblogs.com/yisany/p/14888041.html#1503280869), [Windows 使用 protoc 编译 Go 语言的 protobuf 文件](https://zhuanlan.zhihu.com/p/446199514)

當你克服萬難之後，你會得到兩個文件
+ `*.pb.go` :arrow_right: 包含各種序列化、反序列化、getter 以及 setter 的 message type
+ `*_grpc.pb.go` :arrow_right: 包含 server 以及 client 端的實作 interface 程式碼

> 在某些網站上，你會看到有人在 compile protobuf 的時候使用 `--go_out=plugins=grpc=.` 這個參數\
> 這個參數在 **github.com/golang/protobuf** 這裡是支援的，但是在 **google.golang.org/protobuf** 這裡是不支援的\
> 這裡都建議使用 google.golang.org 開頭的 :arrow_left: 這個是新版的\
> ref: [Switch from --go_out=plugins to -go-grpc_out PATH problem [duplicate]](https://stackoverflow.com/questions/61044883/switch-from-go-out-plugins-to-go-grpc-out-path-problem)

## Pros and Cons
所以 [Protocol Buffer](#protocol-buffer) 他有哪些優缺點？

|Pros|Cons|
|:--|:--|
|特殊的 binary encode，減少資料大小，使得傳輸速度快|相比 textual encode(e.g. [JSON](https://en.wikipedia.org/wiki/JSON), [XML](https://en.wikipedia.org/wiki/XML)), binary encode 無法肉眼 decode|
|支援 [Backward Compatibility](#backward-compatibility) 以及 [Forward Compatibility](#forward-compatibility)||


# How do I use gRPC on website
根據 [The state of gRPC in the browser](https://grpc.io/blog/state-of-grpc-web/) 所述\
很可惜的，即使 web 已經走到 HTTP3, 但是由於瀏覽器的 API 並沒有提供可以直接操作 HTTP2, 因此他們不能直接呼叫 gRPC 的 API

> It is currently impossible to implement the HTTP/2 gRPC spec3 in the browser, \
> as there is simply no browser API with enough fine-grained control over the requests.\
> For example: there is no way to force the use of HTTP/2, and even if there was, \
> raw HTTP/2 frames are inaccessible in browsers. \
> The gRPC-Web spec starts from the point of view of the HTTP/2 spec, \
> and then defines the differences. These notably include:

> + Supporting both HTTP/1.1 and HTTP/2.
> + Sending of gRPC trailers at the very end of request/response bodies as indicated by a new bit in the gRPC message header4.
> + A mandatory proxy for translating between gRPC-Web requests and gRPC HTTP/2 responses.


那它沒用嗎？ 其實不然

gRPC 在 microservices 的架構下擁有出眾的效能\
得益於 HTTP2，使得其與傳統 HTTP1 在速度上擁有著本質上的差異(因為 HTTP1 使用 plain text 進行傳輸，而 HTTP2 使用二進位封包傳輸)\
更遑論提供可插拔的 auth, tracing, load balancing, health checking\
並且支援多種語言的 gRPC 在開發上有更多種的選擇

回到正題，為了要讓現代瀏覽器能夠支援呼叫 gRPC API, 我們勢必要做一個 `reverse proxy(反向代理)`\
讓 reverse proxy 將一般常見的 RESTful API 轉換成 gRPC(如下圖所示)\
![](https://grpc-ecosystem.github.io/grpc-gateway/assets/images/architecture_introduction_diagram.svg)

因此 [gRPC-Gateway](https://grpc-ecosystem.github.io/grpc-gateway/) 就是為了處理這種情況而誕生的！\
使用起來也不麻煩，除了準備原本的 proto 檔之後，接下來你要準備的就是 config yaml 檔

```yaml
type: google.api.service
config_version: 3

http:
  rules:
    - selector: users.Users.GetUser
      get: /api/users/{user_id}
```

> 切記, yaml 檔必須使用 "空格" 進行縮排，不然會報錯

接著，簡單的 compile
```shell
$ protoc -I./proto --grpc-gateway_out ./proto/users \
	--grpc-gateway_opt logtostderr=true \
	--grpc-gateway_opt paths=source_relative \
	--grpc-gateway_opt grpc_api_configuration=./proto/users/users.yaml \
	./proto/users/users.proto
```
你就會得到 `users.pb.gw.go`\
而這裡面就是將 RESTful-API request 轉換成為 gRPC call 的實作了

## Proto Versioning
等到你完成基本的 server.go 並且滿心期待的要測試第一隻 gRPC API 的時候
```shell
# cloud/users/proto/users
proto/users/users.pb.gw.go:56:2: cannot use msg (type *User) as type protoreflect.ProtoMessage in return argument:
	*User does not implement protoreflect.ProtoMessage (missing ProtoReflect method)
proto/users/users.pb.gw.go:82:2: cannot use msg (type *User) as type protoreflect.ProtoMessage in return argument:
	*User does not implement protoreflect.ProtoMessage (missing ProtoReflect method)
```

哇這個問題阿，我在網路上看了很多文章阿\
知識有點零散\
總的來說呢，如果你仔細看 `user.pb.go` 以及 `user.pb.gw.go` 的 import 你會發現
```go
// users.pb.gw.go
import (
	"context"
	"io"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/grpc-ecosystem/grpc-gateway/v2/utilities"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

// users.pb.go
import (
	context "context"
	fmt "fmt"
	proto "github.com/golang/protobuf/proto"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
	math "math"
)
```
他們兩個用的 proto 有兩個版本 不一樣的版本\
根據 [Go Frequently Asked Questions - What's the difference between github.com/golang/protobuf and google.golang.org/protobuf?](https://developers.google.com/protocol-buffers/docs/reference/go/faq#modules) 裡面提到
+ `github.com/golang/protobuf/proto` 是原始的 Go protocol buffer API
+ `google.golang.org/protobuf/proto` 則是更新版本的 Go protocol buffer API

他們之間有 breaking change(e.g. reflection)\
雖然說 `github.com/golang/protobuf v1.4.0` 以上有針對新的 API 進行包裝，使其呼叫新版 API 不會報錯(向上相容？)\
不過 proto Message interface 定義似乎並沒有相容到, 進而導致上述問題的發生
+ `github.com/golang/protobuf/proto` **v1 message**
+ `google.golang.org/protobuf/proto` **v2 message**(reflection 為 first-class function)

既然已經定義了問題所在，接下來只有兩個選擇
+ protoc-gen-go 使其使用新版實作(i.e. `google.golang.org/protobuf/proto`)
+ grpc-gateway 降版，然後 generate 出來的就會是使用舊版實作(i.e. `github.com/golang/protobuf/proto`)

前者我沒找到如何更改的相關資料\
後者，根據 [github.com/grpc-ecosystem/grpc-gateway #1989](https://github.com/grpc-ecosystem/grpc-gateway/issues/1989#issuecomment-783244615) 的討論串可以得知\
我們可以改用 v1 版本的 [github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway](https://pkg.go.dev/github.com/grpc-ecosystem/grpc-gateway#section-readme)

> Note: v2 的為 [github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway](https://pkg.go.dev/github.com/grpc-ecosystem/grpc-gateway/v2#section-readme)

把所有的 import path 改完之後記得要在跑一次
```shell
$ go install github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
```
這樣才不會一樣抓到舊的

## Result
經過了一段時間的修改與調整，最終 gRPC + gateway 已經可以成功運行了

```shell
// server
$ go run server.go
{"address":"0.0.0.0:6666","file":"/media/ambersun/ambersun1234/gitRepo/grpc-gateway-users/server.go:67","func":"main.main","level":"info","msg":"gRPC server start","service":"users","time":"2022-05-14T21:20:04+08:00"}
{"address":"0.0.0.0:7777","file":"/media/ambersun/ambersun1234/gitRepo/grpc-gateway-users/server.go:80","func":"main.main","level":"info","msg":"gateway server start","service":"users","time":"2022-05-14T21:20:04+08:00"}
{"body":{"user_id":"1"},"file":"/media/ambersun/ambersun1234/gitRepo/grpc-gateway-users/server.go:32","func":"main.(*UsersServer).GetUser","level":"info","msg":"Start GetUser request","service":"users","time":"2022-05-14T21:20:26+08:00"}
```

```shell
// client
$ curl localhost:6666/api/user/1
{"user_id":"1","user_name":"test_user_name","first_name":"test_first_name","last_name":"test_last_name","email":"test@test.com"}
```

詳細的實作程式碼可參考 [ambersun1234/blog-labs/grpc-gateway-users](https://github.com/ambersun1234/blog-labs/tree/master/grpc-gateway-users)

# Compare with Traditional RESTful-API

||REST|gRPC|JSON-RPC|
|:--|:--:|:--:|:--:|
|Method|HTTP|HTTP2|HTTP<br>websocket
|Data Exchange Format|JSON, XML|Binary|JSON|
|Addressable Entities|Resource|Behaviour|Functions|
|Speed|Slow|Fast|Fast|
|Readable|Yes|No|Yes|

看到上面的比較圖，你可能會好奇為什麼 RPC 會比 RESTful-API 還要來的快\
更重要的問題是，快了多少？

## Benchmark
為了使得效能測量誤差值不要太大，實驗準備如下
+ 準備一個 echo api(執行簡單的操作，將其他 I/O 影響降到最低)
+ 分別準備原生 server 接口與 rpc server 接口
+ 分別進行 10000 次測量

我原本想要用 curl, grpcurl 進行 benchmark 測試\
無奈 grpcurl 似乎並沒有提供 [-w, --write-out](https://curl.se/docs/manpage.html) 可以更好的進行測試\
ref: [How do I measure request and response times at once using cURL?](https://stackoverflow.com/questions/18215389/how-do-i-measure-request-and-response-times-at-once-using-curl)

除此之外，我也查詢到可以利用 [man 1 time](https://man7.org/linux/man-pages/man1/time.1.html)，但是他的輸出精度僅到小數點後兩位(見下圖)\
對於本次實驗需要高精度的需求屬實不是那麼的匹配
```shell
$ /usr/bin/time -v ls
Command being timed: "ls"
User time (seconds): 0.00
System time (seconds): 0.00
Percent of CPU this job got: 66%
Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.00
Average shared text size (kbytes): 0
Average unshared data size (kbytes): 0
Average stack size (kbytes): 0
Average total size (kbytes): 0
Maximum resident set size (kbytes): 3180
Average resident set size (kbytes): 0
Major (requiring I/O) page faults: 1
Minor (reclaiming a frame) page faults: 135
Voluntary context switches: 2
Involuntary context switches: 0
Swaps: 0
File system inputs: 136
File system outputs: 0
Socket messages sent: 0
Socket messages received: 0
Signals delivered: 0
Page size (bytes): 4096
Exit status: 0
```

因此我決定使用 [python - perf_counter_ns()](https://docs.python.org/3/library/time.html#time.perf_counter_ns) 作為主要量測工具

<hr>

### Prerequisite
```shell
$ uname -a
Linux station 5.13.0-30-generic #33~20.04.1-Ubuntu SMP Mon Feb 7 14:25:10 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
$ python3 --version
Python 3.8.10
$ go version
go versi9on go1.17.6 linux/amd64
```

### Description
首先使用 Golang 分別架設 gRPC, JSON-RPC 與 RESTful server\
client 端使用 Python 分別對其進行 一萬次的 benchmark testing

值得注意的是，gRPC 的部份 server 與 client 端分別使用 Golang 與 Python 實作\
跨語言的支援同時也是 gRPC 的一大強項\
就我這幾天的撰寫而言，就上手程度而言沒有太大的難度，基本上只要能夠順利 generate proto 就沒太大問題了

實驗相關程式碼可以在 [ambersun1234/blog-labs/RESTful_gRPC_JSON-RPC-benchmark](https://github.com/ambersun1234/blog-labs/tree/master/RESTful_gRPC_JSON-RPC-benchmark) 中找到

### Result
![](https://github.com/ambersun1234/blog-labs/blob/master/RESTful_gRPC_JSON-RPC-benchmark/benchmark.png?raw=true)

上述 benchmark 結果為 gRPC, JSON-RPC 與 RESTful API 的速度測試\
其中綠色線代表 JSON-RPC, 藍色代表 RESTful, 紫色線代表 gRPC\
這裡總共進行了 一萬次 的測試，y 軸代表執行時間(nanoseconds)

從上圖你可以很清楚的看到\
JSON-RPC 跟 RESTful 平均呼叫時間都幾乎在 $1 \times 10^6$ nanoseconds\
但是你可以很明顯的看到，他們之間仍然有差別\
即使兩者皆走 HTTP 協議，JSON-RPC 還是快那麼一點點

而 gRPC 則是完勝以上\
根據 [實驗數據](https://github.com/ambersun1234/blog-labs/blob/master/RESTful_gRPC_JSON-RPC-benchmark/benchmark.txt), gRPC 相對 JSON-RPC 快了 **5.77 倍**

會有這樣的結果其實是因為 gRPC 是基於於 HTTP2\
所以在速度上與傳統 API call(i.e. HTTP) 有著本質上的差異
> 有關 HTTP 的介紹，可以參考 [重新認識網路 - HTTP1 與他的小夥伴們 \| Shawn Hsu](../../http/networking-http1)

# References
+ 深入淺出設計模式 第二版(ISBN: 978-986-502-936-4)
+ 資料密集型應用系統設計(ISBN: 978-986-502-835-0)
+ [gRPC Concepts Overview](https://github.com/grpc/grpc/blob/master/CONCEPTS.md)
+ [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/)
+ [Protocol Buffer Basics: Go](https://developers.google.com/protocol-buffers/docs/gotutorial)
+ [Quick start](https://grpc.io/docs/languages/go/quickstart/)
+ [gRPC API Configuration](https://grpc-ecosystem.github.io/grpc-gateway/docs/mapping/grpc_api_configuration/)
+ [Go Frequently Asked Questions](https://developers.google.com/protocol-buffers/docs/reference/go/faq)
+ [Why does a cURL request return a percent sign (%) with every request in ZSH?](https://stackoverflow.com/questions/29497038/why-does-a-curl-request-return-a-percent-sign-with-every-request-in-zsh)
+ [关于makefile中，一直显示“XXX is up to date”的解决方法](https://blog.csdn.net/LinuxTiger/article/details/7955060)
+ [Reflection not detected](https://github.com/fullstorydev/grpcurl/issues/133)
+ [How do I measure request and response times at once using cURL?](https://stackoverflow.com/questions/18215389/how-do-i-measure-request-and-response-times-at-once-using-curl)
+ [Why doesn't the `time` command work with any option?](https://askubuntu.com/questions/434289/why-doesnt-the-time-command-work-with-any-option)
+ [gnuplot 語法解說和示範](https://hackmd.io/@sysprog/Skwp-alOg)
+ [The state of gRPC in the browser](https://grpc.io/blog/state-of-grpc-web/)
+ [Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)
+ [JSON-RPC](https://zh.wikipedia.org/zh-tw/JSON-RPC)
