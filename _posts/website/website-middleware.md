---
title: 網頁設計三兩事 - Middleware
date: 2023-07-05
categories: [middleware]
tags: [website, middleware]
math: true
---

# Preface
![](https://miro.medium.com/max/1400/1*MoxFEabKGx6NxlKoZ0lXJQ.png)
> ref: [Sending Type-safe HTTP Requests With Go](https://betterprogramming.pub/sending-type-safe-http-requests-with-go-eb5bd1f91558)

在現代網頁程式設計開發當中，最基本的邏輯就是 client 發 request, 然後 server 回 response\
隨著需求越來越大，你可能會提供使用者登入的機制，對系統做 log，甚至是修改 HTTP request/response header(e.g. [CORS](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS))
> 有關 CORS 的詳細介紹可以參考 [網頁程式設計三兩事 - 萬惡的 Same Origin 與 CORS \| Shawn Hsu](../../website/website-cors)

你可能會選擇在商業邏輯的實作裡面加上檢查，比如說
```go
func GetAllPost(userID, postID string) ([]*PostList, error) {
    // check if user login or not
    if ok, err := userservice.CheckLogin(userID); err != nil {
        log.Println("User not login")
        return nil, err
    }

    // get all post
    if data, err := postrepository.GetAll(postID); err != nil {
        log.Println("Failed to get all post")
        return nil, err
    }

    return data, nil
}
```

看起來沒啥問題，而事實的確如此\
但如果說你有很多的 function 都需要做這些檢查，你就會寫很多一樣的程式碼\
[DRY 原則](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) 告訴你，要減少重複的程式碼實作\
所以比較好的作法是可以將這些要做的事情統一集中起來放在某個地方\
而放在 middleware 裡面顯然是這些問題的最佳解

# What is Middleware
***middleware 旨在為不同的 software 之間提供服務***，方便不同網路上的計算機可以互相存取\
比較貼近使用者的案例是 **第三方登入**

以 [Google OAuth 2.0 API](https://developers.google.com/identity/protocols/oauth2) 為例\
你可以使用 google 的帳號註冊登入其他平台(e.g. [HackMD](https://hackmd.io))\
透過使用 google 提供的身份認證，登入第三方平台\
![](https://i.imgur.com/hRIGgDt.png)

而 OAuth 的作法是提供一個 `特殊的 token`, 它並不會提供使用者的帳號以及密碼\
當這個 token 被傳回到第三方平台之後，就可以驗證登入成功了\
而這基本上就是在服務與服務之間提供服務(middleware)\
在 HackMD 與 Google 之間提供了 [Google OAuth 2.0 API](https://developers.google.com/identity/protocols/oauth2) 這個 middleware 供使用\
![](https://ghost.hacksoft.io/content/images/2021/05/Google-OAuth-FE-flow@2x.png)
> ref: [Google OAuth2 with Django REST Framework & React: Part 2](https://www.hacksoft.io/blog/google-oauth2-with-django-react-part-2)

## Types of Middleware

![](https://docs.microsoft.com/zh-tw/aspnet/core/fundamentals/middleware/index/_static/request-delegate-pipeline.png?view=aspnetcore-6.0)
> ref: [ASP.NET Core 中介軟體](https://docs.microsoft.com/zh-tw/aspnet/core/fundamentals/middleware/?view=aspnetcore-6.0)

# References
+ [GIN - MIDDLEWARE (中間件) 程式運作原理及用法教學](https://hoohoo.top/blog/teaching-how-gin-middleware-programs-work-and-how-to-use-them/)
+ [What is Middleware?](https://www.integrate.io/glossary/what-is-middleware/)
