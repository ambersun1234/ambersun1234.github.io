---
title: DevOps - 詳解 Mock 概念以及如何 Mock HTTP Request
date: 2025-01-24
categories: [devops]
tags: [mock, test double, dummy, fake object, stub, spy, mock, state verification, behaviour verification, mockery, golang, httptest, http request, mux]
description: 撰寫測試的時候，mock 是一個很重要的概念，誤用 mock 會導致測試失去意義。本文將會告訴你如何正確的使用 mock 以及該怎麼實作才符合 best practice
math: true
---

# Test Double
雖然常常講要 mock 這個 mock 那個\
不過人家的正式名稱是 `Test double`(測試替身)

## Type
![](https://yu-jack.github.io/images/unit-test/unit-test-best-practice-12.png)

Test Double 以功能性分為兩派 [State Verification](#state-verification) 以及 [Behaviour Verification](#behaviour-verification)

### Verification Type
#### State Verification
狀態，指的是系統內的狀態\
軟體工程裡系統的狀態通常是 variable, object properties 等等

通俗點說，你的變數狀態在經過一系列的操作之後，必須要符合某種狀態\
比如說一個計算器，當前數值為 10\
當我進行加法 +1 的時候，它應該要變成 11\
這就是狀態驗證

而 Stub 類型多以模擬狀態(資料)為主

#### Behaviour Verification
這裡的行為就指的是，你的運行過程，狀態遷移的 **過程** 合不合理\
像是他有沒有跟對的 component 互動

符合這個類型的，歸類在 Mock 類型裡面，以模擬行為為主

<hr>

Test Double 內部又分五個種類

+ `Dummy`
    + 用於填充目標物件(i.e. 參數)，僅僅是為了不讓測試掛掉的作用
+ `Fake Object`
    + 較為 **簡單版本** 的實作
    + 比如說用 in-memory database 取代原本的 MySQL 之類的
+ `Stub`
    + 根據不同的輸入，給定相對應的輸出
+ `Spy`(Partial Mock)
    + 原本的定義是用以監看，各種被呼叫的實作的各項數據(被 call 了幾次, 誰被 call) :arrow_right: 跟間諜一樣
    + 有時候也指 Partial Mock, 不同的是，只有實作中的 **部份內容** 被替代
+ `Mock`
    + 跟 `Stub` 一樣，此外還包含了 [Behaviour Verification](#behaviour-verification)

整理成表格的話就如下

|Object Type|Have Implementation|Verification Type|
|:--|:--:|:--:|
|Dummy|:x:|[State Verification](#state-verification)|
|Fake Object|:heavy_check_mark:|[State Verification](#state-verification) or [Behaviour Verification](#behaviour-verification)|
|Stub|:x:|[State Verification](#state-verification)|
|Spy|:heavy_check_mark:|[Behaviour Verification](#behaviour-verification)|
|Mock|:heavy_check_mark:|[State Verification](#state-verification) or [Behaviour Verification](#behaviour-verification)|

> Dummy 為什麼可以做狀態驗證？\
> 它沒有在 check 輸出阿？\
> 事實上狀態驗證也包含了驗證參數數量這種，即使 Dummy 只有填充物件的用途，它仍然可以做驗證

> Fake Object 可以驗證狀態或行為的原因在於\
> 他是簡單版本的實作，同時因為他是實作，代表它能驗證輸出是否符合預期\
> 更重要的是實作本身可以驗證行為(i.e. 確保執行順序像是 A :arrow_right: B :arrow_right: C)

## Manually Create Mock Implementation
那你要怎麼建立 mock 的實作呢？\
通常來講是建議使用第三方的 library 如 [mockery](https://github.com/vektra/mockery) 自動產生\
但你能不能自己寫呢？當然可以 但不建議

![](/assets/img/posts/dip.jpg)

考慮以上的關係圖，要建立 mock 的實作，你只要將所有的 interface 實作一遍就好\
但是這個實作是需要非常小心的

什麼意思？\
mock 的實作 **應該最小化商業邏輯，甚至不應該有**\
舉例來說你要實作一個 `function GetUser(userID string): User` 的 mock\
他不應該真的去查詢什麼東西，確認他存在/不存在 再回傳\
這樣的實作是不對的，因為這樣的實作會讓你的測試變得複雜，且不容易維護

取而代之的是，他要回應一個固定的數值\
或者是 **根據不同的輸入，給定相對應的輸出**\
在調用的時候就會類似像這樣

```js
userMock.On("GetUser", "myuserid").Return(User{
    ID: "myuserid",
    Name: "myname",
    Age: 18,
})
```

當參數為 `myuserid` 的時候，回傳一個固定的 User 物件\
不過如今都有現代化的 testing framework 提供了這樣的功能\
就不需要自己寫了

# Mocking HTTP Request
像我最近有遇到一個狀況是，我的 service 需要去呼叫外部的 API\
而這個 service 是屬於比較低階的實作，它會直接用 `http.Get` 來呼叫\
針對這種狀況，你就很難的去把它 mock 掉

這個 function 你當然也可以不去寫測試，因為它已經是貼近底層的實作了\
就像我個人針對資料庫的實作，針對 unit test 通常是不寫的，我會在 integration test 驗證這部份

> 有關 integration test 可以參考 [DevOps - 整合測試 Integration Test \| Shawn Hsu](../../devops/devops-integration-test)

我們有說過， integration 這裡你就必須要連到真實的環境\
跑 container 不是問題，問題是有些服務可能是付費的，也沒有提供測試環境\
等於說你必須要自己架一個環境起來

> 你當然可以連線到真正的 production 環境，但你要想，有些服務是只有在內網的\
> 如果要上到 CI/CD，這些服務可能是無法連線的

## Why Mock HTTP Request?
你可能會好奇，為什麼我需要跟第三方的 API 一起測試？\
一個常見的原因是，我們必須要確保我們的實作跟第三方的 API 有正確的串接\
換言之，如果第三方的 API 有變動，我們的實作也必須要跟著變動\
透過持續測試你就可以確保這一點

## httptest
內建的函式庫 [net/http/httptest](https://pkg.go.dev/net/http/httptest) 提供了一個 `httptest.Server`\
將它執行起來，你就可以模擬一個 server 了\
其概念就等同於我們用 docker 跑 PostgreSQL 一樣，連線設定好，就可以執行了

```go
ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "Hello, client")
}))
defer ts.Close()
```

> 每個 test server 都有一個 URL，你可以透過這個 URL 來連線\
> 這個 URL 是隨機的，你可以透過 `ts.URL` 來取得

上述是一個簡單版本的 test server\
你可以看到它其實沒辦法針對不同的 route 做不同的處理\
這時候你就需要用到 `http.ServeMux` 來處理

```go
package main

import (
    "net/http"
    "fmt"
    "net/http/httptest"
)

func handler1(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello from handler1\n")
}

func handler2(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello from handler2\n")
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/route1", handler1)
    mux.HandleFunc("/route2", handler2)

    s := httptest.NewServer(mux)
    defer s.Close()
    fmt.Println(s.URL)
    select {}
}
```

建立好 test server 以後，它會一直跑，不需要特定開一個 goroutine\
然後你就可以透過 `http.Get` 之類的方法來連線了

你的程式碼裡面，API call 理論上應該是動態的組字串\
所以你可以自己設定特定的 route, 特定的 host, 來模擬不同的狀況\
那麼這樣你就有辦法撰寫測試了

# References
+ [mocking outbound http requests in go: you’re (probably) doing it wrong](https://medium.com/zus-health/mocking-outbound-http-requests-in-go-youre-probably-doing-it-wrong-60373a38d2aa)
+ [Test Double（2）：五種替身簡介](https://teddy-chen-tw.blogspot.com/2014/09/test-double2.html)
+ [https://go.dev/src/net/http/httptest/example_test.go](https://go.dev/src/net/http/httptest/example_test.go)
