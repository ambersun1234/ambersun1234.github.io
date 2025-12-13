---
title: 網頁程式設計三兩事 - 萬惡的 Same Origin 與 CORS
date: 2023-03-10
description: 不同的網站是否可以互相存取資源？ CORS 的機制就可以解決這個問題！。本篇文章將會介紹 Same Origin Policy 以及 CORS 的概念
categories: [website]
tags: [cors, website, preflight request, same origin, chrome, golang, gin]
math: true
---

# Preface
我最初遇到 CORS 的問題是在我的個人部落格上面，因為我引用了其他網站的圖片\
某一天我突然發現圖片跑不出來了？ 思來想去我應該也沒有改到程式碼才對\
後來看了一下發現好像是 CORS 的問題\
所以今天要來講講 CORS

# Same Origin Policy
來源相同的定義為何？

1. 協定一樣
2. port 一樣
3. domain 一樣(包含 sub domain)

只要上述條件都符合即代表相同來源

> 反之違反任一條件即為不同來源

![](https://i.imgur.com/U21aYxA.png)
> ref: [[Day 27] Cross-Origin Resource Sharing (CORS)](https://ithelp.ithome.com.tw/articles/10251693)

<hr>

網站的同源政策主要就是為了避免不同來源能夠透過 [Document Object Model(DOM)](https://en.wikipedia.org/wiki/Document_Object_Model) 存取機密資料(e.g. cookies, session)

> 因此可以得知 Same Origin Policy 主要是實作在瀏覽器上面的

你說為什麼不同來源能夠存取 cookie?\
那是因為早期的瀏覽器實作，即使是不同來源，它依然會帶 cookie 過去\
就也因此可能會造成一些資安風險

> 延伸閱讀 [[Day 26] Cookies - SameSite Attribute](https://ithelp.ithome.com.tw/articles/10251288)

所以引入了 Same Origin Policy 之後，可以有效的避免上述的事情發生

# Introduction to CORS
![](/assets/img/posts/cors1.png)

CORS - Cross-Origin Resource Sharing 跨來源資源共用定義於 [WHATWG's Fetch Living Standard](https://fetch.spec.whatwg.org/)\
CORS **不是一種安全機制**，相反的，他是一種能夠突破 [Same Origin Policy](#same-origin-policy) 限制的東西\
有時候我們覺的 Same Origin Policy 太嚴格了，一些大網站用了不同的 sub domain 也被視為是不同來源實屬有點麻煩\
因此 CORS 能夠使不同來源的要求被存取

## Define Origin
那我要怎麼確定我的來源是誰\
網站會使用 `第一個 request` 來確認你的來源
![](https://mdn.github.io/shared-assets/images/diagrams/http/cors/preflight-correct.svg)
> ref: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

# How does CORS Work
前面有提到，普遍瀏覽器為了安全問題，都有實作 [Same Origin Policy](#same-origin-policy)\
為了有效的放寬此政策，便引入 CORS 的機制\
允許部份的 origin 可以存取

如果瀏覽器要發起一個 cross origin request\
它會先發一個 [Preflight Request](#preflight-request) 跟目標 server 確認\
server 會回傳一系列的 header 來描述哪些 request 可以被接受，可以被支援\
確認可以支援之後，才會發起正式 request

> cross origin request 不限於 api call, \<img\>, \<script\> 如果不同來源，也都算 cross origin request

你可以發現，基本上 CORS 不會管你不同來源是否合法\
它只是要確認說 server 有支援你的 request 而已\
安不安全跟它沒關係

> 所以基本上，如果你碰到 CORS 的問題，是你的後端需要做處理

注意到 CORS 的請求，預設是不會帶身份驗證相關的資料的(i.e. Authorization)\
只有當 server 回傳特定 CORS header 它才會帶\
設定的部份可參考 [CORS Headers](#cors-headers)

## Modify Origin Header
既然 [Same Origin Policy](#same-origin-policy) 是用於保護網站被其他網站存取\
而且他依靠的是 origin header\
那有沒有可能我手動把它改掉，bypass 這個限制？

基本上你沒有辦法透過手動修改 origin header 來 bypass 這個限制\
瀏覽器帶的 origin header 是不可更改的

但是你可以透過其他方式來達到這個目的\
比如說 proxy\
[Nginx](https://www.nginx.com/) 的 [proxy_set_header](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header) 可以新增或修改 header\
以這個例子來說就是要修改 origin header

不過這種做法算沒必要\
他的前提是你要能夠操作 server\
以攻擊者的角度來說，其實使用 [CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) 來做攻擊更有效率

## CORS Headers

這裡就大概列出幾個常用常見的 header\
完整的 header list 可以造訪 [HTTP 回應標頭](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS#http_%E5%9B%9E%E6%87%89%E6%A8%99%E9%A0%AD)

||Value|Description|
|:--|:--|:--|
|Access-Control-Allow-Credentials|`true`|是否允許帶 credential(e.g. cookies, authorization header, tls certificate)|
|Access-Control-Allow-Headers|`*`<br>`Content-Type, Accept`|允許的 header|
|Access-Control-Allow-Methods|`*`<br>`GET, POST, PATCH`|允許的 HTTP methods|
|Access-Control-Allow-Origin|`*`<br>`https://example.com`(僅允許 https://example.com)<br>`null`([null origin](#null-origin))|允許的 request 來源|
|Access-Control-Max-Age|`86400`|預檢後多久以內不需要在檢查|

### Credential with Wildcard Origin
當你的 origin 設為 wildcard 而且 credential 又為 true 的時候，會出現錯誤

> `Access-Control-Allow-Origin: '*'`

注意到，這裡的 credential ***不是 Access-Control-Allow-Credentials***\
它說的是 XMLHttpRequest 裡面的 `withCredentials` 的設定(e.g. [Angular - HttpRequest](https://angular.io/api/common/http/HttpRequest#withCredentials))\
那麼他有兩種解決方案
+ `withCredentials` 設定不能為 `true`(default 為 false)
+ explicit 設定 origin header :arrow_right: `Access-Control-Allow-Origin: 'http://localhost:4200'`

```typescript
@Injectable({
  providedIn: 'root',
})
export class HttpInterceptorService implements HttpInterceptor {
  constructor(private userStore: Store<{ user: UserState }>) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return this.userStore.select('user').pipe(
      first(),
      mergeMap((userState) => {
        req = req.clone({
          setHeaders: {
            Authorization: userState.Token,
          },
          withCredentials: true                <---
        });

        return next.handle(req);
      })
    );
  }
}
```

### null origin
不建議使用 null origin\
因為如果 request scheme 非 http(e.g. `data:`, `file:`)\
這些 scheme 的 origin 會預設為 `null`\
那這樣就會有點危險，所以一般不建議這樣設定

# Request Types
## Simple Request
HTTP 的 request 當中，不受限於 [Same Origin Policy](#same-origin-policy) 的 request 被稱之為 simple request\
也就是說，符合下列規則的 request 不需要套用 CORS header 即可正常請求

|||
|:--|:--|
|Methods|GET<br>HEAD<br>POST|
|Headers|Accept<br>Accept-Language<br>Content-Language<br>Content-Type<br>Range|
|Content-Type|`application/x-www-form-urlencoded`<br>`multipart/form-data`<br>`text/plain`|

## Preflight Request
預檢請求，亦即在正式 request 之前必須要先額外發一個 request 進行檢查\
根據 server 的回應，來判斷是否可以往下執行

哪些 request 會屬於 preflight 的呢？ 簡單來說就是 非 [Simple Request](#simple-request) 的都是

![](/assets/img/posts/cors2.png)
上圖是一個完整 preflight request 的示意圖\
可以看到 `http://localhost:8888/me` 的 request 被 call 了兩次\
其中第一行即為 preflight request(他的 type 為 preflight)

> 如果你在 developer tools 沒有看到 preflight request, 記得把 filter 設為 all 才可以\
> 做為 demo, http 401 可以先忽略(他是正常行為)

![](/assets/img/posts/cors3.png)
執行 preflight 的方式是\
使用 [HTTP Options method](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods/OPTIONS) 並帶上一些 request header 進行檢查\
`Access-Control-Request-Headers: Authorization`\
`Access-Control-Request-Method: GET`

> Options Method 為 safe method, 詳細可以參考 [重新認識網路 - HTTP1 與他的小夥伴們 \| Shawn Hsu](../../network/network-http1#safe-methods)\
> HTTP header field 並無大小寫之區分，可參考 [RFC 1945 §4.2](https://www.rfc-editor.org/rfc/rfc1945#page-22)

這隻 API 主要會根據 user jwt token 取出對應 user 資料並回傳\
所以他的 headers 帶了 authorization, 因為 credential 是存於 cookie 當中的\
然後 server 這邊就要回應，它能夠處理的 CORS header 有哪些\
有 4 個
1. `Access-Control-Allow-Credentials` 允不允許 request 帶 credential
2. `Access-Control-Allow-Headers` 允許哪些 HTTP header
3. `Access-Control-Allow-Methods` 允許哪些 methods
4. `Access-Control-Allow-Origin` 允許特定 request origin(i.e. 從哪裡來)

當所有條件都符合，都 ok，status code 會是 [HTTP 204 No Content](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/Status/204)\
你的 web browser 就會放行，進行真正的 request

# CORS in Postman?
CORS 的問題基本上是為了解決瀏覽器實作的 [Same Origin Policy](#same-origin-policy)\
也因此，在你 debug 的時候使用 [postman](https://www.postman.com/) 或是 [curl](https://curl.se/)\
CORS 的問題基本上不會出現(因為它不在瀏覽器裡面跑)

# Refferer Policy: strict-origin-when-cross-origin
有的時候不是你設定有錯，是瀏覽器的問題

假設你 **後端** 正確的設定了 CORS header 了，但是你還是遇到問題\
八成是瀏覽器在搞事，舉例來說 Google Chrome

![](https://global.discourse-cdn.com/business4/uploads/athom/optimized/3X/2/a/2a72131a869b1a4bf1a22e4a56f28b356a29b0f5_2_1366x1000.png)
> ref: [How to restrict LAN addresses in a browser?](https://security.stackexchange.com/questions/243357/how-to-restrict-lan-addresses-in-a-browser)

Chrome 的選項 `Block insecure private network requests` 記得要把它關閉\
然後你的網站就可以正常運作了

# Configure CORS Support in Golang Gin
```go
import (
    "net/http"

    "github.com/gin-gonic/gin"
)

func CorsMiddleware() gin.HandlerFunc {
    return func(ctx *gin.Context) {
        allowHeaders := `
            Content-Type, Content-Length,
            Authorization, Accept,
            Accept-Encoding, Origin,
            DNT, User-Agent,
            Referer
        `
        allowMethods := `
            POST, GET, PUT,
            DELETE, PATCH, OPTIONS
        `

        ctx.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        ctx.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        ctx.Writer.Header().Set("Access-Control-Allow-Headers", allowHeaders)
        ctx.Writer.Header().Set("Access-Control-Allow-Methods", allowMethods)

        if ctx.Request.Method == "OPTIONS" {
            ctx.AbortWithStatus(http.StatusNoContent)
            return
        }

        ctx.Next()
    }
}
```

> Referer 這個字其實是有故事的，可參考 [HTTP 協定的悲劇](https://medium.com/%E5%BD%AD%E6%AD%A6%E8%88%88/http-%E5%8D%94%E5%AE%9A%E7%9A%84%E6%82%B2%E5%8A%87-194bf072bd86)

基本上就是定義你允許的各種條件\
像是 origin 為 wildcard 代表你允許所有來源\
allow credentials 可以允許攜帶 token 之類的東西\
允許的 header 以及 method

為了處理 preflight request 不要出錯\
會刻意抓 options request 出來，因為我們 router 並沒有定義相關 routing\
沒有特別處理他到後面會 404 not found

Gin 其實有一套 CORS 的 library [gin-contrib/cors](https://github.com/gin-contrib/cors)\
可以比較簡單的設定

```go
package main

import (
    "time"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
)

func main() {
    router := gin.Default()
    // CORS for https://foo.com and https://github.com origins, allowing:
    // - PUT and PATCH methods
    // - Origin header
    // - Credentials share
    // - Preflight requests cached for 12 hours
    router.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"https://foo.com"},
        AllowMethods:     []string{"PUT", "PATCH"},
        AllowHeaders:     []string{"Origin"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
        AllowOriginFunc: func(origin string) bool {
            return origin == "https://github.com"
        },
        MaxAge: 12 * time.Hour,
    }))
    router.Run()
}
```
> ref: [gin-contrib/cors](https://github.com/gin-contrib/cors)

# References
+ [跨來源資源共用（CORS）](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)
+ [What is the issue CORS is trying to solve?](https://stackoverflow.com/questions/27365303/what-is-the-issue-cors-is-trying-to-solve)
+ [同源政策 (Same-origin policy)](https://developer.mozilla.org/zh-TW/docs/Web/Security/Same-origin_policy)
+ [Cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
+ [If browser cookies aren't shared between different websites, then why is Same origin Policy useful?](https://security.stackexchange.com/questions/264784/if-browser-cookies-arent-shared-between-different-websites-then-why-is-same-or)
+ [[Day 26] Cookies - SameSite Attribute](https://ithelp.ithome.com.tw/articles/10251288)
+ [Does every web request send the browser cookies?](https://stackoverflow.com/questions/1336126/does-every-web-request-send-the-browser-cookies)
+ [how exactly CORS is improving security [duplicate]](https://stackoverflow.com/questions/71294134/how-exactly-cors-is-improving-security)
+ [In CORS, Are POST request with credentials pre-flighted ?](https://stackoverflow.com/questions/36613051/in-cors-are-post-request-with-credentials-pre-flighted)
+ [Why is jQuery's .ajax() method not sending my session cookie?](https://stackoverflow.com/questions/2870371/why-is-jquerys-ajax-method-not-sending-my-session-cookie)
+ [What's to stop malicious code from spoofing the "Origin" header to exploit CORS?](https://stackoverflow.com/questions/21058183/whats-to-stop-malicious-code-from-spoofing-the-origin-header-to-exploit-cors)
+ [Same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy)
+ [CORS - Is it a client-side thing, a server-side thing, or a transport level thing? [duplicate]](https://stackoverflow.com/questions/36958999/cors-is-it-a-client-side-thing-a-server-side-thing-or-a-transport-level-thin)
+ [Reason: Credential is not supported if the CORS header 'Access-Control-Allow-Origin' is '*'](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSNotSupportingCredentials)
+ [CORS error on request to localhost dev server from remote site](https://stackoverflow.com/questions/66534759/cors-error-on-request-to-localhost-dev-server-from-remote-site)
