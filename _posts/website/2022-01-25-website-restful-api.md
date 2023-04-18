---
title: 網頁程式設計三兩事 - RESTful API
date: 2022-01-25
categories: [website]
tags: [api]
math: true
---

# What is API
![](https://img-comment-fun.9cache.com/media/aAYBA2o/aqxMnkn4_700w_0.jpg)\
API - Application Programming Interface 是一種 ***介面***，他高度抽象化了背後的實作原理\
使得呼叫端可以透過簡單的呼叫達成一件相對複雜的事情

而 API 的概念不僅限於網頁開發，包括像是 kernel system call 這種也是屬於 API\
(因為你必須要透過作業系統操作各項事情, 諸如: 於螢幕上顯示字元)

說到底，程式設計師是一個非常懶惰的一群人，能夠重複使用的事情，我們就會把它獨立出來變成一個 function\
這樣既節省時間也節省人力開發資源

# RESTful API
假設現在要開發一組 user 的 API, 他必須要包含以下功能
+ 查詢使用者，更新使用者名稱，刪除使用者

設計上的思維就是三支 API 對吧
```
GET /api/getUser/
{
    "userId": "xxx"
}

POST /api/UpdateUser
{
    "userId": "xxx",
    "userName: "xxx"
}

GET /api/deleteUser
```

有覺得哪裡怪怪的嗎?\
`getUser`, `updateUser`, `deleteUser` 是不是沒有必要寫那麼長?\
但不加動詞要怎麼樣判斷當前的操作是屬於哪一種的?

<hr>

RESTful API 的設計概念於 2000 年的時候提出\
我們來看一下 REST 的幾個 architectural constrains

## Uniform Interface
對於同一個 resource 盡量用同義化的字詞表示\
有點抽象對吧 讓我們來看一下 best practice 裡面怎麼寫的

+ Use nouns to represent resource
    + 上述 api 設計，是不是都可以改寫成 `/api/user`?
+ Consistency is the key
    + 固定命名規則可以很有效的避免不必要的誤會以及最大化可讀性(e.g. `/api/user`)
    + 在命名 URI 的時候，避免路徑中使用 `_` 底線符號(有些瀏覽器無法正確顯示) :arrow_right: 改用 `-` dash 符號
    + 在命名 URI 的時候，避免於路徑尾端使用 `/`(因為沒意義 而且會增加誤會的可能)
+ Never use CRUD function names in URIs
    + **避免在 URI 當中指定操作類型(不要出現 create, update, delete ... etc. 字眼)**

我都遵照完 best practice 了\
但問題是現在 API 都變成
```
GET /api/user
POST /api/user
GET /api/user
```
我要如何確定他是做甚麼用的?

REST guidelines 建議開發者可以多多利用 HTTP method 去對應 CRUD 的操作

||||||
|:--:|:--:|:--:|:--:|:--:|
|GET|POST|PUT|DELETE|PATCH|
|Read|Create|Update|Delete|Update|

ㄟ等等\
put, patch 都是屬於更新資料?\
具體的來說
+ put 是更新 **整體** 資料
+ patch 是更新 **部分** 資料


## Stateless
Server 並 **不會儲存任何 session, history**\
所有跟狀態有關的都必須由 **client 自行儲存**

假設我們要實作 紀錄使用者登入狀態\
傳統的設計上是使用 [session](https://en.wikipedia.org/wiki/Session_(computer_science)) 在 server 端註冊使用者狀態對吧?\
或者是使用 [cookie](https://en.wikipedia.org/wiki/HTTP_cookie)\
而上述兩者的出現本來就是為了應對 HTTP stateless 的情況

既然不能儲存狀態在 server 端\
client 端就勢必要儲存必要資訊(e.g. 使用者登入與否?)\
其中一個做法就是使用 [JWT](https://jwt.io/) 帶入資訊，詳細可以參考 [網頁程式設計三兩事 - JWT \| Shawn Hsu](../)\
在每次發送 request 的時候帶上這些資訊提供 server 端做檢查\
而這正好符合原本 HTTP stateless 的特性

<!-- jwt -->

> 這兩種做法並沒有好壞之分，單純是作法不同

# References
+ [REST Architectural Constraints](https://restfulapi.net/rest-architectural-constraints/)
+ [gRPC vs REST: Understanding gRPC, OpenAPI and REST and when to use them in API design](https://cloud.google.com/blog/products/api-management/understanding-grpc-openapi-and-rest-and-when-to-use-them)
