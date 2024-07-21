---
title: 實際上手體驗 Golang DI Framework 之 Uber Dig
date: 2024-07-20
categories: [random]
description: 這篇文章主要紀錄如何使用 Uber/dig 這個 Dependency Injection Framework，並且實際建構一個簡單的 Web Server
tags: [dependency injection, dig, golang, unit test]
math: true
---

# Uber/dig
[uber/dig](https://github.com/uber-go/dig) 是一套基於 reflection 的 Dependency Injection Framework\
意思是我們不需要手動指定依賴，而是透過 reflection 來幫我們自動找出依賴，依靠框架管理

讓我們直接看例子

# Web Server Architecture
假設現在我們需要構建一個網頁後端伺服器\
依照基本的 MVC 架構，我們會有以下幾個部分
1. Model 資料儲存
2. Controller 處理邏輯
3. Server 伺服器

## Dependency Direction
所以我們知道目前需要以上這三個部分\
他們的依賴關係是

```
Server -> Controller -> Model
```

controller 不應該需要知道底層儲存資料具體是怎麼做的，他可以是 MySQL, PostgreSQL 甚至 Redis 等等\
同樣道理，server 也不應該需要知道 controller 具體是怎麼處理邏輯

<hr>

如果是手動建立，可以依照上圖的方向，你可以很輕鬆的建立依賴關係\
並且實作也不會太困難

# How dig Handle Dependency Injection
前面提到 dig 是基於 reflection 的\
並且會自己幫你找出依賴，這樣你就不需要手動指定

具體來說他是這樣幹的\
手動建立依賴關係可能會長成這樣
```go
func NewController(model *Model) *Controller {
    return &Controller{model}
}
```

有發現什麼嗎？\
我要建立 controller 我必須要傳入一個 model, 然後他的型別是 `Model`\
輸出會是一個 `Controller`

dig 的思想是這樣的\
既然我知道你的 `輸入型別` 以及 `輸出型別`\
我是不是只要找到 **哪一個 function 會輸出我要的型別**\
我就找到依賴了？

好這就是他能做的事情了\
function 要我們手動提供給他\
我們需要手動將所有 function(其實說 constructor 比較準確) 提供給 dig\
`container` 是一個容器，負責管理所有的依賴，也就是說 function 都要在 container 註冊\
此過程稱為 `Provide`

到這裡還沒完，因為我們只是提供了 function\
你最後要的是什麼，他不知道\
所以你需要告訴他，你要的是什麼，這個過程稱為 `Invoke`

# Web Server Implementation
## Provide
```go
if err := container.Provide(func() *gin.Engine {
    gin.SetMode(gin.DebugMode)
    server := gin.New()
    return server
}); err != nil {
    panic(err)
}

if err := container.Provide(inmemory.NewInMemory, dig.As(new(storage.StorageI))); err != nil {
    panic(err)
}

if err := container.Provide(post.NewPostService); err != nil {
    panic(err)
}
if err := container.Provide(user.NewUserService); err != nil {
    panic(err)
}

if err := container.Provide(NewController); err != nil {
    panic(err)
}
```

這裡總共提供了 5 個 function\
大致分為 web server, storage, service 以及 controller\
大部分的情況下可以直接傳 callback 進去，或者是 anonymous function

這個步驟就是告訴 dig 你有哪些 function 可以提供給他

## Invoke
```go
if err := container.Invoke(func(controller *Controller, server *gin.Engine) {
    controller.Register()
    server.Run(":8080")
}); err != nil {
    panic(err)
}
```

我們的最終目標是建構網頁後端的伺服器\
根據上述的 [Dependency Direction](#dependency-direction) 我們知道 server 會依賴 controller\
所以這裡傳入的參數就是 controller 以及 server

> 有哪些參數可以用？ 就是稍早 [Provide](#provide) 的 function

裡面我們告訴 dig 我們要的是 controller 以及 server\
然後再手動組裝起來\
hmmm 為什麼？

既然他聰明到可以自己找出依賴，為什麼不直接幫我們組裝好呢？\
因為 dig 不了解你的商業邏輯，他沒辦法知道你必須要要先註冊 route 才能啟動 server\
他能做的是，自動建構需要的依賴，並提供給你

## Parameter Objects
一般來說 Dependency Injection 的參數會寫成這樣
```go
func NewController(postService post.PServiceI, usesrService user.UServiceI, engine *gin.Engine) *Controller {
	return &Controller{
		post: postService,
		user: userService,
		app: engine,
	}
}
```
把需要的依賴手動傳入 function parameter 當中，但是當參數數量過多的時候，他的維護會相對變得困難
dig 使用另一種方式解決這個問題

透過定義一個 struct 來傳入參數\
取代原本數量繁多的 function parameter

```go
type ControllerDependency struct {
	dig.In

	PostService post.PServiceI
	UserService user.UServiceI
	App        *gin.Engine
}

type Controller struct {
	post post.PServiceI
	user user.UServiceI
	app *gin.Engine
}

func NewController(dep ControllerDependency) *Controller {
	return &Controller{
		post: dep.PostService,
		user: dep.UserService,
		app: dep.App,
	}
}
```

注意到實作裡，有兩個 structure, 一個是 dependency 的，另一個是 controller 的\
dependency struct 必須要 embed `dig.In`\
用以告訴 dig 這是一個 parameter object

# Dependency Injection with Interface
你可能會注意到上述的例子裡面，我們依賴的東西都是 interface 而非 concrete type\
這是因為使用 interface 可以讓我們更容易的進行測試\
也方便進行解耦合

實務上當然也是可以使用 concrete type\
只不過這樣會讓你的程式碼更難測試，以及更難維護

要注意的是，dig DI 的型別要是一致的\
也就是說，當你依賴於 interface 的時候，你傳一個 concrete struct 進去會錯誤

```
panic: could not build arguments for function "main".main.func2
> (/blog-labs/golang-dig/server.go:39):
> failed to build *main.Controller: could not build arguments for function "main".NewController
> (/blog-labs/golang-dig/controller.go:26): failed to build post.PServiceI:
> missing dependencies for function "golang-dig/service/post".NewPostService 
> (/blog-labs/golang-dig/service/post/post.go:24):
> missing type: storage.StorageI (did you mean *inmemory.InMemory?)
```

<hr>

```go
if err := container.Provide(inmemory.NewInMemory, dig.As(new(storage.StorageI))); err != nil {
    panic(err)
}
```

主程式有一樣很特別的東西，如上所示\
他相比其他的 provide 多了一個參數 `dig.As(new(storage.StorageI))`

model 層我做了一層抽象，稱為 `storage.StorageI`\
上層只要知道這層是一個儲存的介面即可，如同我們提到的 他不需要管是 MySQL, PostgreSQL 還是 Redis\
但是實際運行的時候我們還是要具體的提供一個 storage 的實作

這裡，我們給了一個 `inmemory.InMemory`\
他是一個具體的實作，並且實作了 `storage.StorageI`\
可是 controller 期待的是一個 `storage.StorageI`

即使 `inmemory.InMemory` 實作了 `storage.StorageI`\
最終的型態還是不一樣，所以會報錯

具體的解法就是 `dig.As`\
他的意思是這個 constructor 實作了一個或多個 interface\
以我們的例子來說是 `storage.StorageI`\
所以這樣他就會動了

# Debug Dig
如果你撰寫的程式碼發生了錯誤，在 dig 裡面 debug 我覺得是相對困難的地方\
舉例來說，我們剛剛看過的例子\
以下有 5 個 provide 的 function

```go
if err := container.Provide(func() *gin.Engine {
    gin.SetMode(gin.DebugMode)
    server := gin.New()
    return server
}); err != nil {
    panic(err)
}

if err := container.Provide(inmemory.NewInMemory, dig.As(new(storage.StorageI))); err != nil {
    panic(err)
}

if err := container.Provide(post.NewPostService); err != nil {
    panic(err)
}
if err := container.Provide(user.NewUserService); err != nil {
    panic(err)
}

if err := container.Provide(NewController); err != nil {
    panic(err)
}
```

```
panic: could not build arguments for function "main".main.func2
> (/blog-labs/golang-dig/server.go:39):
> failed to build *main.Controller: could not build arguments for function "main".NewController
> (/blog-labs/golang-dig/controller.go:26): failed to build post.PServiceI:
> missing dependencies for function "golang-dig/service/post".NewPostService 
> (/blog-labs/golang-dig/service/post/post.go:24):
> missing type: storage.StorageI (did you mean *inmemory.InMemory?)
```

從這裡的錯物訊息來看，你可以很清楚的知道是型別出問題\
但是，我自己遇到的例子是我的程式直接 crash 掉，並沒有任何的實用錯誤訊息\
這時候你就會像個無頭蒼蠅一樣，不知道從何看起

我遇到的，是從 reflection 那裡開始報錯\
我唯一看得出來的錯誤訊息是，他無法正確的建構我要的 service
![](/assets/img/posts/dig.png)

但錯誤訊息仍然提供了一個我疏忽的的提示
```text
panic: could not build arguments for function "main".main.func2
```

看到那個 `func2` 了嗎\
這或許是個提示，但這個 2 是啥\
往回看 provide 的 function，總共有 5 個\
第 2 個剛好就是出錯的那個函數\
一下子範圍就縮小了許多

```go
if err := container.Provide(inmemory.NewInMemory, dig.As(new(storage.StorageI))); err != nil {
    panic(err)
}
```

# Example
上述的例子可以在 [ambersun1234/blog-labs/golang-dig](https://github.com/ambersun1234/blog-labs/tree/master/golang-dig) 找到

# References
+ [Implementing DI and DIP in Golang: A Guide with Dig and Gin](https://medium.com/@italoservio/implementing-di-and-dip-in-golang-a-guide-with-dig-and-gin-60b3b8bb4ee)
+ [uber/dig](https://pkg.go.dev/go.uber.org/dig)
