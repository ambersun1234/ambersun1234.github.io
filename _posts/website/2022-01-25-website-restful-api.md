---
title: 網頁程式設計三兩事 - RESTful API
date: 2022-01-25
description: RESTful API 是一種風格，我們能不能夠用更簡單的方式來設計 API 呢？
categories: [website]
tags: [api, restful, stateless, url length limit, version control, backward compatibility, batch endpoint, bulk operation, batch operation, http 414, http 301, redirect, session, jwt, cookie, http]
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

|HTTP Method|Explanation|
|:--|--:|
|GET|讀取資料|
|POST|新增資料|
|PUT|更新資料|
|DELETE|刪除資料|
|PATCH|更新資料|

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
其中一個做法就是使用 [JWT](https://jwt.io/) 帶入資訊，詳細可以參考 [網頁程式設計三兩事 - 不一樣的驗證思維 JWT(JSON Web Token) \| Shawn Hsu](../../website/website-jwt)\
在每次發送 request 的時候帶上這些資訊提供 server 端做檢查\
而這正好符合原本 HTTP stateless 的特性

> 這兩種做法並沒有好壞之分，單純是作法不同

> 有關 HTTP 的討論，可以參考 [重新認識網路 - HTTP1 與他的小夥伴們 \| Shawn Hsu](../../network/network-http1)

## URL Length Limit of GET Request
URL 的長度是有限制的，粗略的估算大約是 2000 的字元\
你說這跟 RESTful API 有什麼關係?

如果你有一隻 `GET` 的 API，然後參數是一個 id 陣列好了\
因為參數實際上是帶在 URL 上的，所以如果參數太多太長就會撞到這個上限\
撞到會怎麼樣呢？

有可能會遇到 [HTTP 414 URI Too Long](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/Reference/Status/414) 的錯誤\
那網路上有很多人會跟你說，改成用 `POST` 就好了\
確實，實務上因為 `POST` 的 request body 是沒有大小限制的\
你可以將資料一股腦塞過去不會報錯

用 `POST` 是合理的選擇，但這不符合 RESTful API 的設計\
所以他其實算是必要之惡，不過這個惡能不能被改善？

Google 採取了 Batch Endpoint 的做法\
就是將多個 request 組成一個 batch request\
送到 `/batch/{API_NAME}/{API_VERSION}`(e.g. `/batch/drive/v3`) 之後再拆開來處理\
根據 request body 轉發到不同的 endpoint 上面

與單純改成 `POST` 的差別在於有一個獨立的 batch endpoint 負責處理所有批次相關的\
相比於原本的 `POST` 來說，我覺得 Google 的做法比較合理且較為彈性\
他裡面也是遵循著 RESTful API 的設計

# Version Control
隨著系統升級改版，API 也會隨之改變\
這時候就會有一個問題，新版的 API 跟舊版的 API 該怎麼區分?

常見的一種作法是在 URI 中加入版本號\
也就是 `v1`, `v2` 這樣的方式\
這樣的好處是可以讓 client 端自行選擇要使用哪一個版本的 API\
不過壞處是，當 API 版本越來越多的時候，管理維護的成本會越來越高\
並且 version number 並不是強制性的

## Backward Compatibility
即使 API endpoint 擁有不同的版本號做出別，我們仍然沒辦法阻止 client 呼叫舊版本 API\
因此維持好向後相容性就很重要了

新的 API 實作出來之後，我們仍然可以保留舊版 API 的功能，只不過可以在 response body 中提及 deprecate 相關的訊息\
注意到，`做 301 redirect 不是一個好方法`, 因為 redirect 指的只是單純 endpoint 搬家\
但是新版 API 可能有新增欄位，導致 client 期待的回傳值不一致的行為

> 可以 301 頁面，但是 301 API 就不好了

# References
+ [REST Architectural Constraints](https://restfulapi.net/rest-architectural-constraints/)
+ [gRPC vs REST: Understanding gRPC, OpenAPI and REST and when to use them in API design](https://cloud.google.com/blog/products/api-management/understanding-grpc-openapi-and-rest-and-when-to-use-them)
+ [What is the maximum length of a URL in different browsers?](https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers)
+ [When do you use POST and when do you use GET?](https://stackoverflow.com/questions/46585/when-do-you-use-post-and-when-do-you-use-get)
+ [Adding batch or bulk endpoints to your REST API](https://www.codementor.io/blog/batch-endpoints-6olbjay1hd)
+ [https://developers.google.com/workspace/drive/api/guides/performance?hl=zh-tw#details](https://developers.google.com/workspace/drive/api/guides/performance?hl=zh-tw#details)
